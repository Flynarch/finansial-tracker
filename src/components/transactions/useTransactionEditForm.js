import { useCallback, useState } from 'react'
import { format } from 'date-fns'
import { formatMoneyValueForInput, parseMoneyInput } from '../../lib/utils'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../lib/fieldEncryption'
import { rememberMerchantCategory } from '../../lib/ai/merchantCategorizer'

const initialFormData = {
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  type: 'expense',
  category: '',
  notes: '',
  currency: 'IDR',
}

/**
 * Custom hook to manage transaction edit form state, prefill initialization,
 * submission handling with field decryption, and transaction duplication.
 */
export function useTransactionEditForm({
  allWallets = [],
  defaultCurrency = 'IDR',
  addTransaction,
  updateTransaction,
  t,
  setApiError,
  setApiErrorTone,
}) {
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editFormData, setEditFormData] = useState(initialFormData)

  const openEditTransaction = useCallback(
    (transaction) => {
      setEditingTransaction(transaction)
      const matchingWallet = allWallets?.find((w) => String(w.id) === String(transaction.walletId))
      const targetCurrency = transaction.currency || matchingWallet?.currency || defaultCurrency
      const receipt =
        transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null
      const rawNote = transaction.notes || ''
      const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
      const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote

      setEditFormData({
        date: transaction.date,
        amount: formatMoneyValueForInput(transaction.amount, targetCurrency),
        type: transaction.type,
        category: transaction.category,
        notes: safeNote,
        currency: targetCurrency,
        walletId: transaction.walletId,
        targetWalletId: transaction.targetWalletId || '',
        receiptImage: receipt,
        receipt: receipt,
        isSplit: Boolean(transaction.isSplit),
        splitItems: Array.isArray(transaction.splitItems)
          ? transaction.splitItems.map((si) => {
              const rawSi = si?.notes || ''
              const plainSi = isFieldEncrypted(rawSi) ? getDecryptedNoteSync(rawSi) : rawSi
              const safeSi = isFieldEncrypted(plainSi) ? '' : plainSi
              return {
                ...si,
                notes: safeSi,
              }
            })
          : [],
      })
    },
    [allWallets, defaultCurrency]
  )

  const handleEditSubmit = async () => {
    if (!editingTransaction?.id) return
    try {
      setApiError('')
      setApiErrorTone('error')
      const tgtWallet = allWallets?.find((w) => String(w.id) === String(editFormData.targetWalletId))
      const tgtCurr = tgtWallet?.currency || defaultCurrency
      const parsedTargetAmount =
        editFormData.type === 'transfer' && editFormData.targetAmount
          ? parseMoneyInput(editFormData.targetAmount, tgtCurr)
          : undefined

      await updateTransaction(editingTransaction.id, {
        ...editFormData,
        amount: parseMoneyInput(editFormData.amount, editFormData.currency),
        targetAmount: parsedTargetAmount,
        receiptImage: editFormData.receiptImage || null,
        isSplit: Boolean(editFormData.isSplit),
        splitItems:
          editFormData.isSplit && Array.isArray(editFormData.splitItems) ? editFormData.splitItems : undefined,
        isPendingReview: false,
      })

      // If user confirms/edits a transaction from staging, learn the merchant categorization
      if (
        editFormData.category &&
        editFormData.category !== 'lainnya_kategori/umum' &&
        editFormData.category !== 'lainnya/umum'
      ) {
        const rawNote = editingTransaction.notes || ''
        const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
        const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote
        const merchant = editingTransaction.cleanMerchant || editFormData.notes || safeNote || ''
        rememberMerchantCategory(merchant, editFormData.category, editFormData.type)
      }

      setEditingTransaction(null)
    } catch (err) {
      console.error('[Transactions:handleSaveEdit]', err)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setApiError(offline ? t('common.error.offline') : err?.message || t('common.error.saveFailed'))
      setApiErrorTone('error')
    }
  }

  const handleDuplicateTransaction = useCallback(
    async (transaction) => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const payload = {
          ...transaction,
          date: todayStr,
          createdAt: Date.now(),
          isPendingReview: false,
        }
        delete payload.id
        await addTransaction(payload)
        setApiError(t('tx.duplicateSuccess', 'Transaksi berhasil diduplikasi ke hari ini.'))
        setApiErrorTone('success')
      } catch (err) {
        console.error('[Transactions:handleDuplicate]', err)
        setApiError(err?.message || t('common.error.saveFailed', 'Gagal menduplikasi transaksi.'))
        setApiErrorTone('error')
      }
    },
    [addTransaction, t, setApiError, setApiErrorTone]
  )

  return {
    editingTransaction,
    setEditingTransaction,
    editFormData,
    setEditFormData,
    openEditTransaction,
    handleEditSubmit,
    handleDuplicateTransaction,
  }
}
