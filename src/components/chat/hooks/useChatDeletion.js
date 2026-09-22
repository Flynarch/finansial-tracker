import { useRef, useCallback } from 'react'
import { db } from '../../../lib/db'
import { deleteTransaction } from '../../../services/transactionService'
import useLoanStore from '../../../store/useLoanStore'
import { triggerHaptic } from '../../../lib/haptics'

export function useChatDeletion({ setMessages, locale = 'id' }) {
  const deletingMsgIdsRef = useRef(new Set())
  const deleteLoan = useLoanStore((s) => s.deleteLoan)

  const handleConfirmDelete = useCallback(async (id, msgId, entityType = 'transaction') => {
    if (deletingMsgIdsRef.current.has(msgId)) return
    deletingMsgIdsRef.current.add(msgId)
    try {
      triggerHaptic('medium')
      if (entityType === 'loan') {
        await deleteLoan(id)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en' ? 'Loan record has been deleted.' : 'Catatan pinjaman telah berhasil dihapus.',
                  deleted: true,
                }
              : m,
          ),
        )
      } else if (entityType === 'recurring') {
        await db.recurringTransactions.delete(id)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en' ? 'Recurring subscription cancelled.' : 'Langganan berulang berhasil dibatalkan.',
                  deleted: true,
                }
              : m,
          ),
        )
      } else {
        await deleteTransaction(id)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en' ? 'Transaction has been deleted.' : 'Transaksi telah berhasil dihapus.',
                  deleted: true,
                }
              : m,
          ),
        )
      }
      triggerHaptic('success')
    } catch (err) {
      triggerHaptic('warning')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                type: 'text',
                content: err.message || (locale === 'en' ? 'Failed to delete.' : 'Gagal menghapus.'),
              }
            : m,
        ),
      )
    } finally {
      deletingMsgIdsRef.current.delete(msgId)
    }
  }, [deleteLoan, setMessages, locale])

  const handleCancelDelete = useCallback((msgId, entityType = 'transaction') => {
    triggerHaptic('light')
    const cancelMsg = entityType === 'loan'
      ? (locale === 'en' ? 'Loan deletion cancelled.' : 'Penghapusan pinjaman dibatalkan.')
      : entityType === 'recurring'
      ? (locale === 'en' ? 'Cancellation cancelled.' : 'Pembatalan langganan dibatalkan.')
      : (locale === 'en' ? 'Transaction deletion cancelled.' : 'Penghapusan transaksi dibatalkan.')

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              type: 'text',
              content: cancelMsg,
            }
          : m,
      ),
    )
  }, [setMessages, locale])

  const handleUndoTransaction = useCallback(async (data, msgId) => {
    try {
      if (Array.isArray(data)) {
        await Promise.all(data.map((tx) => deleteTransaction(tx.id)))
      } else if (data?.id) {
        await deleteTransaction(data.id)
      }
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    } catch (err) {
      console.error('[useChatDeletion.handleUndoTransaction] Failed to undo transactions:', err)
    }
  }, [setMessages])

  return {
    deletingMsgIdsRef,
    handleConfirmDelete,
    handleCancelDelete,
    handleUndoTransaction,
  }
}
