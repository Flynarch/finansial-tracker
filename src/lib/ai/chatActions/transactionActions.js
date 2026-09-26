import { format } from 'date-fns'
import { db } from '../../db'
import { createTransaction as addTransaction, updateTransaction } from '../../../services/transactionService'
import useSettingsStore from '../../../store/useSettingsStore'
import { sanitizeCategoryPath } from '../../categorySanitizer'
import { distributeReceiptTransactions } from '../receiptDistributor'
import { findMatchingTransactionForAction } from '../aiChatHelpers'
import { rememberTransactionEntity } from '../entityMemory'
import { triggerHaptic } from '../../haptics'

export async function handleTransactionAction(result, {
  locale,
  defaultCurrency,
  wallets = [],
  scanMode = 'all',
  targetWalletId = null,
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
        if (wallets.find((w) => w.id === twId)) txToSave.targetWalletId = twId
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

  if (result.action === 'update' || result.action === 'delete') {
    const rawFreshTxs = await db.transactions.toArray()
    const allFreshTxs = rawFreshTxs.filter((t) => t && !t.deletedAt && !t.isPendingReview)
    allFreshTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0))

    const matchedTx = findMatchingTransactionForAction(allFreshTxs, result)
    const sq = result.searchQuery ? result.searchQuery.toLowerCase().trim() : ''

    if (!matchedTx) {
      const isVagueDelete = result.action === 'delete' && !result.transactionId && !sq
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
    } else {
      if (result.action === 'update') {
        const updatedPayload = { ...result.updatedFields }
        if (updatedPayload.amount !== undefined) {
          updatedPayload.amount = Number(updatedPayload.amount)
        }
        if (updatedPayload.walletId !== undefined) {
          updatedPayload.walletId = updatedPayload.walletId ? Number(updatedPayload.walletId) : undefined
        }
        if (updatedPayload.targetWalletId !== undefined) {
          updatedPayload.targetWalletId = updatedPayload.targetWalletId ? Number(updatedPayload.targetWalletId) : undefined
        }
        if (updatedPayload.category) {
          updatedPayload.category = sanitizeCategoryPath(updatedPayload.category, matchedTx.type || 'expense')
        }
        if (updatedPayload.isSplit !== undefined) {
          updatedPayload.isSplit = Boolean(updatedPayload.isSplit)
        }
        if (Array.isArray(updatedPayload.splitItems)) {
          updatedPayload.splitItems = updatedPayload.splitItems.map((si) => ({
            ...si,
            category: sanitizeCategoryPath(si.category, matchedTx.type || 'expense'),
            amount: Number(si.amount) || 0,
            notes: si.notes || '',
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }))
        }

        await updateTransaction(matchedTx.id, updatedPayload)
        const updatedTx = { ...matchedTx, ...updatedPayload }
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'success',
          data: updatedTx,
          customMsg: locale === 'en' ? 'Transaction updated successfully' : 'Transaksi berhasil diperbarui',
        })
      } else {
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'delete_confirm',
          data: {
            id: matchedTx.id,
            amount: matchedTx.amount,
            category: matchedTx.category,
            date: matchedTx.date,
            notes: matchedTx.notes,
            type: matchedTx.type,
            currency: matchedTx.currency || defaultCurrency,
          },
          content: locale === 'en'
            ? 'Are you sure you want to delete this transaction?'
            : 'Apakah Anda yakin ingin menghapus transaksi ini?',
        })
      }
    }
  }

  return newMsgs
}
