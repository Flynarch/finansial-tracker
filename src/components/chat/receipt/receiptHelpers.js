import { format } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { formatMoneyValueForInput, parseMoneyInput, convertCurrency } from '../../../lib/utils'
import { evaluateExpression } from '../../../lib/calcParser'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../../lib/fieldEncryption'

export function generateReceiptRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = ''
  for (let i = 0; i < 8; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `REC-${hash.slice(0, 4)}-${hash.slice(4)}`
}

export function formatReceiptDate(txList = [], singleTx = {}, locale = 'id') {
  const dateLocaleObj = locale === 'id' ? idLocale : enUS
  const formattedTime = txList[0]?.time || singleTx.time || format(new Date(), 'HH:mm')
  const uniqueDates = Array.from(new Set(txList.map((t) => t.date).filter(Boolean)))

  if (uniqueDates.length === 1) {
    const d = new Date(uniqueDates[0] + 'T12:00:00')
    return `${format(d, 'EEEE, d MMMM yyyy', { locale: dateLocaleObj })} • ${formattedTime}`
  }
  if (uniqueDates.length > 1) {
    uniqueDates.sort()
    const dFirst = new Date(uniqueDates[0] + 'T12:00:00')
    const dLast = new Date(uniqueDates[uniqueDates.length - 1] + 'T12:00:00')
    return `${format(dFirst, 'd MMM', { locale: dateLocaleObj })} - ${format(dLast, 'd MMM yyyy', { locale: dateLocaleObj })}`
  }
  const firstTxDate = singleTx.date ? new Date(singleTx.date + 'T12:00:00') : new Date()
  return `${format(firstTxDate, 'EEEE, d MMMM yyyy', { locale: dateLocaleObj })} • ${formattedTime}`
}

export function computeReceiptTotals(txList = [], defaultCurrency = 'IDR', activeRates = null) {
  const allSameCurrency =
    txList.length > 0 &&
    txList.every((t) => (t.currency || defaultCurrency) === (txList[0]?.currency || defaultCurrency))
  const displayCurrency = allSameCurrency ? (txList[0]?.currency || defaultCurrency) : defaultCurrency

  const totalExpense = txList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + convertCurrency(Number(t.amount) || 0, t.currency || defaultCurrency, displayCurrency, activeRates), 0)

  const totalIncome = txList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + convertCurrency(Number(t.amount) || 0, t.currency || defaultCurrency, displayCurrency, activeRates), 0)

  const netTotal = totalIncome - totalExpense

  return {
    displayCurrency,
    totalExpense,
    totalIncome,
    netTotal,
  }
}

export function getReceiptContextualTheme(isSingle, singleTx, txList, t) {
  if (isSingle) {
    if (singleTx.type === 'income') {
      return {
        glow: 'from-emerald-500/15 via-emerald-500/4 to-transparent',
        line: 'from-transparent via-emerald-500/50 to-transparent',
        badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
        title: t('ai.incomeLogged', 'Pemasukan Tercatat'),
        tag: 'text-emerald-500',
      }
    }
    if (singleTx.type === 'transfer') {
      return {
        glow: 'from-sky-500/15 via-sky-500/4 to-transparent',
        line: 'from-transparent via-sky-500/50 to-transparent',
        badge: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
        title: t('ai.transferLogged', 'Transfer Berhasil'),
        tag: 'text-sky-500',
      }
    }
    return {
      glow: 'from-rose-500/12 via-rose-500/3 to-transparent',
      line: 'from-transparent via-rose-500/40 to-transparent',
      badge: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
      title: t('ai.expenseLogged', 'Pengeluaran Tercatat'),
      tag: 'text-rose-500',
    }
  }

  const hasIncome = txList.some((tx) => tx.type === 'income')
  const hasExpense = txList.some((tx) => tx.type === 'expense')

  if (hasIncome && !hasExpense) {
    return {
      glow: 'from-emerald-500/15 via-emerald-500/4 to-transparent',
      line: 'from-transparent via-emerald-500/50 to-transparent',
      badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      title: t('ai.multipleIncomeLogged', '{{count}} Pemasukan Tercatat', { count: txList.length }),
      tag: 'text-emerald-500',
    }
  }
  if (hasExpense && !hasIncome) {
    return {
      glow: 'from-rose-500/12 via-rose-500/3 to-transparent',
      line: 'from-transparent via-rose-500/40 to-transparent',
      badge: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
      title: t('ai.multipleExpenseLogged', '{{count}} Pengeluaran Tercatat', { count: txList.length }),
      tag: 'text-rose-500',
    }
  }

  return {
    glow: 'from-[var(--accent)]/15 via-[var(--accent)]/4 to-transparent',
    line: 'from-transparent via-[var(--accent)]/50 to-transparent',
    badge: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
    title: t('ai.multipleTxLogged', '{{count}} Transaksi Tercatat', { count: txList.length }),
    tag: 'text-[var(--accent)]',
  }
}

export function buildEditFormData(tx, defaultCurrency = 'IDR', wallets = []) {
  const txCurrency = tx.currency || defaultCurrency
  const tgtWallet = wallets?.find((w) => String(w.id) === String(tx.targetWalletId))
  const tgtCurr = tgtWallet?.currency || defaultCurrency

  return {
    date: tx.date || format(new Date(), 'yyyy-MM-dd'),
    time: tx.time || '',
    amount: formatMoneyValueForInput(tx.amount, txCurrency),
    type: tx.type || 'expense',
    category: tx.category || '',
    notes: (isFieldEncrypted(tx.notes) ? getDecryptedNoteSync(tx.notes) : tx.notes) || '',
    currency: txCurrency,
    walletId: tx.walletId,
    targetWalletId: tx.targetWalletId || '',
    targetAmount: tx.targetAmount ? formatMoneyValueForInput(tx.targetAmount, tgtCurr) : '',
    receiptImage: tx.receiptImage || null,
    items: tx.items || undefined,
    subtotal: tx.subtotal !== undefined ? tx.subtotal : undefined,
    tax: tx.tax !== undefined ? tx.tax : undefined,
    discount: tx.discount !== undefined ? tx.discount : undefined,
    merchant: tx.merchant || undefined,
    isExcludeAnalyticsTx: Boolean(tx.isExcludeAnalyticsTx),
    isSplit: tx.isSplit || false,
    splitItems: Array.isArray(tx.splitItems)
      ? tx.splitItems.map((si) => ({
          ...si,
          notes: (isFieldEncrypted(si?.notes) ? getDecryptedNoteSync(si.notes) : si?.notes) || '',
        }))
      : [],
  }
}

export function buildUpdatedTxPayload(editFormData, editingTx, overrides = {}, wallets = [], defaultCurrency = 'IDR') {
  let numericAmt = overrides?.amount
  if (numericAmt === undefined) {
    const evalResult = evaluateExpression(editFormData.amount, editFormData.currency)
    numericAmt =
      evalResult?.isValid && evalResult?.result !== null
        ? evalResult.result
        : parseMoneyInput(editFormData.amount, editFormData.currency)
  }

  const isTransfer = editFormData.type === 'transfer'
  let targetAmt = overrides?.targetAmount
  if (targetAmt === undefined && isTransfer && editFormData.targetAmount) {
    const tgtWallet = wallets?.find((w) => String(w.id) === String(editFormData.targetWalletId))
    const tgtCurr = tgtWallet?.currency || defaultCurrency
    const evalTgt = evaluateExpression(editFormData.targetAmount, tgtCurr)
    targetAmt =
      evalTgt?.isValid && evalTgt?.result !== null
        ? evalTgt.result
        : parseMoneyInput(editFormData.targetAmount, tgtCurr)
  }

  return {
    date: editFormData.date,
    time: editFormData.time || editingTx?.time || '',
    amount: numericAmt,
    targetAmount: isTransfer ? targetAmt : null,
    type: editFormData.type,
    category: editFormData.category,
    notes: editFormData.notes,
    currency: editFormData.currency,
    walletId: editFormData.walletId,
    targetWalletId: isTransfer && editFormData.targetWalletId ? editFormData.targetWalletId : '',
    receiptImage: editFormData.receiptImage || null,
    items: editFormData.items || editingTx?.items || undefined,
    subtotal: editFormData.subtotal !== undefined ? editFormData.subtotal : editingTx?.subtotal,
    tax: editFormData.tax !== undefined ? editFormData.tax : editingTx?.tax,
    discount: editFormData.discount !== undefined ? editFormData.discount : editingTx?.discount,
    merchant: editFormData.merchant || editingTx?.merchant || undefined,
    isExcludeAnalyticsTx: Boolean(editFormData.isExcludeAnalyticsTx),
    isSplit: editFormData.isSplit || false,
    splitItems: editFormData.splitItems || [],
  }
}
