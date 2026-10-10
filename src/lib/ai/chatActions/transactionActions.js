import { format } from 'date-fns'
import { db } from '../../db'
import { createTransaction as addTransaction, updateTransaction } from '../../../services/transactionService'
import useSettingsStore from '../../../store/useSettingsStore'
import { sanitizeCategoryPath } from '../../categorySanitizer'
import { distributeReceiptTransactions } from '../receiptDistributor'
import { findMatchingTransactionsForAction } from '../aiChatHelpers'
import { rememberTransactionEntity } from '../entityMemory'
import { triggerHaptic } from '../../haptics'
import { convertCurrency } from '../../utils'

export async function handleTransactionAction(result, {
  locale,
  defaultCurrency,
  wallets = [],
  scanMode = 'all',
  targetWalletId = null,
  receiptImage = null,
  rates = null,
}) {
  const newMsgs = []

  if (result.action === 'create' && result.transactions?.length > 0) {
    const transactionsToProcess = distributeReceiptTransactions(result.transactions, result, scanMode)
    const savedTxs = []
    for (const tx of transactionsToProcess) {
      const numericAmount = Number(tx.amount || 0)
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) continue

      const configuredDefaultWalletId = useSettingsStore.getState().defaultWalletId
      const primaryDefaultWalletId = wallets.find((w) => w.id === configuredDefaultWalletId)?.id || (wallets.length > 0 ? wallets[0].id : null)
      let finalWalletId = targetWalletId || (tx.walletId ? Number(tx.walletId) : primaryDefaultWalletId)
      if (finalWalletId !== null && !wallets.find((w) => w.id === finalWalletId)) {
        finalWalletId = primaryDefaultWalletId
      }
      const matchedWallet = wallets.find((w) => w.id === finalWalletId)
      const txCurrency = tx.currency || matchedWallet?.currency || defaultCurrency

      const txEngine = tx.engine || result.engine || (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_nlp' : 'online_ai')
      const txEngineLabel = tx.engineLabel || result.engineLabel || (txEngine === 'offline_nlp' ? 'NLP Lokal (Offline)' : 'AI Gemini (Online)')

      const isSplit = Boolean(tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0)
      const cleanSplitItems = isSplit
        ? tx.splitItems.map((si) => ({
            ...si,
            category: sanitizeCategoryPath(si.category, tx.type || 'expense'),
            amount: Number(si.amount) || 0,
            notes: si.notes || '',
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }))
        : undefined

      const txToSave = {
        ...tx,
        receiptImage: tx.receiptImage || receiptImage || null,
        merchant: tx.merchant || result.merchant || undefined,
        engine: txEngine,
        engineLabel: txEngineLabel,
        amount: numericAmount,
        date: tx.date || format(new Date(), 'yyyy-MM-dd'),
        time: tx.time || format(new Date(), 'HH:mm'),
        category: sanitizeCategoryPath(tx.category, tx.type),
        walletId: finalWalletId,
        currency: txCurrency,
        isSplit,
        splitItems: cleanSplitItems,
        createdAt: Date.now(),
      }

      if (tx.type === 'transfer' && tx.targetWalletId) {
        const twId = Number(tx.targetWalletId)
        if (wallets.find((w) => w.id === twId)) {
          txToSave.targetWalletId = twId
          const sourceWallet = wallets.find((w) => w.id === finalWalletId)
          const targetWallet = wallets.find((w) => w.id === twId)
          const sCurr = sourceWallet?.currency || txCurrency
          const tCurr = targetWallet?.currency || sCurr
          if (sCurr !== tCurr) {
            txToSave.targetCurrency = tCurr
            txToSave.targetAmount = tx.targetAmount ? Number(tx.targetAmount) : convertCurrency(numericAmount, sCurr, tCurr, rates || {})
          }
        }
      }

      const newTxId = await addTransaction(txToSave)
      txToSave.id = newTxId
      rememberTransactionEntity(txToSave)
      savedTxs.push(txToSave)
    }

    if (savedTxs.length > 0) {
      triggerHaptic('success')
      newMsgs.push({ id: Date.now() + 2, role: 'ai', type: 'success', data: savedTxs })
    } else {
      newMsgs.push({
        id: Date.now() + 2,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? 'No valid transactions to record (amount must be greater than 0).'
          : 'Tidak ada transaksi valid untuk dicatat (nominal harus lebih dari 0).',
      })
    }
  }

  if (result.action === 'update') {
    const rawFreshTxs = await db.transactions.toArray()
    const allFreshTxs = rawFreshTxs.filter((t) => t && !t.deletedAt && !t.isPendingReview)
    allFreshTxs.sort((a, b) => {
      const dateDiff = (b.date || '').localeCompare(a.date || '')
      if (dateDiff !== 0) return dateDiff
      const timeDiff = (b.time || '').localeCompare(a.time || '')
      if (timeDiff !== 0) return timeDiff
      return (b.id || 0) - (a.id || 0)
    })

    const rawTargetIds = Array.isArray(result.transactionIds)
      ? result.transactionIds.map(Number).filter(Number.isFinite)
      : []

    const targetTxs = rawTargetIds.length > 0
      ? allFreshTxs.filter((tx) => rawTargetIds.includes(tx.id))
      : findMatchingTransactionsForAction(allFreshTxs, result)

    if (targetTxs.length === 0) {
      const notFoundMsg = locale === 'en'
        ? 'Sorry, the requested transaction was not found in your history.'
        : 'Maaf, transaksi yang dimaksud tidak ditemukan di riwayat Anda.'
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: notFoundMsg,
      })
    } else {
      const previousSnapshots = targetTxs.map((t) => ({ ...t }))
      const updatedList = []
      for (const tx of targetTxs) {
        const updatedPayload = { ...result.updatedFields }
        if (updatedPayload.amount !== undefined) {
          updatedPayload.amount = Number(updatedPayload.amount)
        }
        if (updatedPayload.walletId !== undefined) {
          if (typeof updatedPayload.walletId === 'string' && isNaN(Number(updatedPayload.walletId))) {
            const term = updatedPayload.walletId.toLowerCase().trim()
            const matchedW = wallets.find((w) => (w.name || '').toLowerCase().includes(term))
            updatedPayload.walletId = matchedW ? matchedW.id : undefined
          } else {
            updatedPayload.walletId = updatedPayload.walletId ? Number(updatedPayload.walletId) : undefined
          }
        } else if (updatedPayload.wallet && typeof updatedPayload.wallet === 'string') {
          const term = updatedPayload.wallet.toLowerCase().trim()
          const matchedW = wallets.find((w) => (w.name || '').toLowerCase().includes(term))
          if (matchedW) updatedPayload.walletId = matchedW.id
        }
        if (updatedPayload.targetWalletId !== undefined) {
          updatedPayload.targetWalletId = updatedPayload.targetWalletId ? Number(updatedPayload.targetWalletId) : undefined
        }
        if (updatedPayload.category) {
          updatedPayload.category = sanitizeCategoryPath(updatedPayload.category, tx.type || 'expense')
        }
        if (updatedPayload.isSplit !== undefined) {
          updatedPayload.isSplit = Boolean(updatedPayload.isSplit)
        }
        if (Array.isArray(updatedPayload.splitItems)) {
          updatedPayload.splitItems = updatedPayload.splitItems.map((si) => ({
            ...si,
            category: sanitizeCategoryPath(si.category, tx.type || 'expense'),
            amount: Number(si.amount) || 0,
            notes: si.notes || '',
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }))
        }

        const effectiveType = updatedPayload.type || tx.type
        if (effectiveType === 'transfer') {
          const effectiveAmount = updatedPayload.amount !== undefined ? Number(updatedPayload.amount) : Number(tx.amount)
          const effectiveSrcWalletId = updatedPayload.walletId !== undefined ? Number(updatedPayload.walletId) : Number(tx.walletId)
          const effectiveTgtWalletId = updatedPayload.targetWalletId !== undefined ? Number(updatedPayload.targetWalletId) : Number(tx.targetWalletId)

          const srcChanged = updatedPayload.walletId !== undefined && Number(updatedPayload.walletId) !== Number(tx.walletId)
          const tgtChanged = updatedPayload.targetWalletId !== undefined && Number(updatedPayload.targetWalletId) !== Number(tx.targetWalletId)
          const amtChanged = updatedPayload.amount !== undefined && Number(updatedPayload.amount) !== Number(tx.amount)
          const typeChanged = updatedPayload.type !== undefined && updatedPayload.type !== tx.type

          if (srcChanged || tgtChanged || amtChanged || typeChanged || (effectiveSrcWalletId && effectiveTgtWalletId && !tx.targetAmount)) {
            const sWallet = wallets.find((w) => Number(w.id) === effectiveSrcWalletId)
            const tWallet = wallets.find((w) => Number(w.id) === effectiveTgtWalletId)
            const sCurr = sWallet?.currency || tx.currency || defaultCurrency
            const tCurr = tWallet?.currency || defaultCurrency
            updatedPayload.currency = sCurr
            updatedPayload.targetCurrency = tCurr
            if (sCurr !== tCurr) {
              if (updatedPayload.targetAmount === undefined) {
                updatedPayload.targetAmount = convertCurrency(effectiveAmount, sCurr, tCurr, rates || {})
              }
            } else {
              updatedPayload.targetAmount = null
            }
          }
        }

        await updateTransaction(tx.id, updatedPayload)
        updatedList.push({ ...tx, ...updatedPayload })
      }

      triggerHaptic('success')
      const isMulti = updatedList.length > 1
      const defaultSuccessMsg = isMulti
        ? (locale === 'en' ? `${updatedList.length} transactions updated successfully` : `${updatedList.length} transaksi berhasil diperbarui`)
        : (locale === 'en' ? 'Transaction updated successfully' : 'Transaksi berhasil diperbarui')

      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'success',
        action: 'update',
        isUpdate: true,
        previousData: previousSnapshots,
        data: isMulti ? updatedList : updatedList[0],
        customMsg: result.text || defaultSuccessMsg,
      })
    }
  }

  if (result.action === 'delete') {
    const rawFreshTxs = await db.transactions.toArray()
    const allFreshTxs = rawFreshTxs.filter((t) => t && !t.deletedAt && !t.isPendingReview)
    allFreshTxs.sort((a, b) => {
      const dateDiff = (b.date || '').localeCompare(a.date || '')
      if (dateDiff !== 0) return dateDiff
      const timeDiff = (b.time || '').localeCompare(a.time || '')
      if (timeDiff !== 0) return timeDiff
      return (b.id || 0) - (a.id || 0)
    })

    const rawTargetIds = Array.isArray(result.transactionIds)
      ? result.transactionIds.map(Number).filter(Number.isFinite)
      : []

    const matchedTxs = rawTargetIds.length > 0
      ? allFreshTxs.filter((t) => rawTargetIds.includes(t.id))
      : findMatchingTransactionsForAction(allFreshTxs, result)

    const sq = result.searchQuery ? result.searchQuery.toLowerCase().trim() : ''

    const getTxWalletNames = (t) => {
      const w = wallets.find((x) => Number(x.id) === Number(t.walletId))
      const tw = wallets.find((x) => Number(x.id) === Number(t.targetWalletId))
      return {
        walletName: w?.name || '',
        targetWalletName: tw?.name || '',
      }
    }

    if (matchedTxs.length === 0) {
      const isVagueDelete = !result.transactionId && rawTargetIds.length === 0 && !sq
      const vagueMsg = locale === 'en'
        ? 'Please specify which transaction you would like to delete (for example: "delete transaction lunch" or "delete latest transaction").'
        : 'Mohon sebutkan transaksi mana yang ingin Anda hapus (contoh: "hapus transaksi makan siang" atau "hapus transaksi terakhir").'
      const notFoundMsg = locale === 'en'
        ? 'Sorry, the requested transaction was not found in your history.'
        : 'Maaf, transaksi yang dimaksud tidak ditemukan di riwayat Anda.'

      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: isVagueDelete ? vagueMsg : notFoundMsg,
      })
    } else if (matchedTxs.length === 1) {
      const matchedTx = matchedTxs[0]
      const { walletName, targetWalletName } = getTxWalletNames(matchedTx)
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'delete_confirm',
        data: {
          id: matchedTx.id,
          amount: matchedTx.amount,
          category: matchedTx.category,
          date: matchedTx.date,
          time: matchedTx.time || '',
          notes: matchedTx.notes,
          type: matchedTx.type,
          currency: matchedTx.currency || defaultCurrency,
          walletId: matchedTx.walletId,
          targetWalletId: matchedTx.targetWalletId,
          walletName,
          targetWalletName,
        },
        content: locale === 'en'
          ? 'Are you sure you want to delete this transaction?'
          : 'Apakah Anda yakin ingin menghapus transaksi ini?',
      })
    } else {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'delete_confirm',
        data: {
          isBatch: true,
          ids: matchedTxs.map((t) => t.id),
          items: matchedTxs.map((t) => {
            const { walletName, targetWalletName } = getTxWalletNames(t)
            return {
              id: t.id,
              amount: t.amount,
              category: t.category,
              date: t.date,
              time: t.time || '',
              notes: t.notes,
              type: t.type,
              currency: t.currency || defaultCurrency,
              walletId: t.walletId,
              targetWalletId: t.targetWalletId,
              walletName,
              targetWalletName,
            }
          }),
        },
        content: locale === 'en'
          ? `Are you sure you want to delete ${matchedTxs.length} transactions?`
          : `Apakah Anda yakin ingin menghapus ${matchedTxs.length} transaksi ini?`,
      })
    }
  }

  return newMsgs
}
