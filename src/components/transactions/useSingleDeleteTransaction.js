import { useState } from 'react'
import { db } from '../../lib/db'
import { invalidateWalletBalance } from '../../lib/balanceEngine'
import { triggerHaptic } from '../../lib/haptics'
import { clearCachedDashboardState } from '../../hooks/useDashboardData'
import { scheduleNativeWidgetSync } from '../../lib/nativeWidgetSync'

/**
 * Custom hook to manage single transaction deletion confirmation and reversible undo toast.
 */
export function useSingleDeleteTransaction({
  deleteTransaction,
  swipedTransactionId,
  setSwipedTransactionId,
  t,
  setApiError,
  setApiErrorTone,
}) {
  const [singleDeleteTx, setSingleDeleteTx] = useState(null)

  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteTx?.id) return
    const txId = singleDeleteTx.id
    const deletedTxCopy = { ...singleDeleteTx }
    setSingleDeleteTx(null)
    try {
      await deleteTransaction(txId)
      if (swipedTransactionId === txId) setSwipedTransactionId(null)

      if (typeof window !== 'undefined') {
        const hasCascade = Boolean(
          deletedTxCopy.loanId ||
          deletedTxCopy.goalId ||
          deletedTxCopy.investmentId ||
          deletedTxCopy.investmentOrderId ||
          deletedTxCopy.splitBillId
        )

        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: t('tx.deleted', 'Transaksi Dihapus'),
              message: hasCascade
                ? undefined
                : t('tx.undoHint', 'Ketuk Urungkan untuk mengembalikan transaksi'),
              type: 'warning',
              duration: 5000,
              action: hasCascade
                ? undefined
                : {
                    label: t('common.undo', 'Urungkan'),
                    onClick: async () => {
                      try {
                        const updatePayload = { deletedAt: null }
                        if (deletedTxCopy.receiptImage) {
                          updatePayload.receiptImage = deletedTxCopy.receiptImage
                        }
                        await db.transactions.update(txId, updatePayload)
                        if (deletedTxCopy.walletId) {
                          await invalidateWalletBalance(
                            [deletedTxCopy.walletId, deletedTxCopy.targetWalletId].filter(Boolean)
                          )
                        }
                        clearCachedDashboardState()
                        scheduleNativeWidgetSync()
                        triggerHaptic('success')
                      } catch (e) {
                        console.warn('[Transactions:undoDelete]', e)
                      }
                    },
                  },
            },
          })
        )
      }
    } catch (err) {
      console.error('[Transactions:singleDelete]', err)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setApiError(
        err?.userMessage || err?.message || (offline ? t('common.error.offline') : t('common.error.saveFailed'))
      )
      setApiErrorTone('error')
    }
  }

  return {
    singleDeleteTx,
    setSingleDeleteTx,
    handleConfirmSingleDelete,
  }
}
