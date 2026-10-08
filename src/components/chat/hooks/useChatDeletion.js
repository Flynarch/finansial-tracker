import { useRef, useCallback } from 'react'
import { db } from '../../../lib/db'
import { deleteTransaction, updateTransaction } from '../../../services/transactionService'
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
      } else if (Array.isArray(id)) {
        await Promise.all(id.map((singleId) => deleteTransaction(singleId)))
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en'
                    ? `${id.length} transactions have been deleted.`
                    : `${id.length} transaksi telah berhasil dihapus.`,
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

  const handleUndoTransaction = useCallback(async (data, msgId, isUpdate = false, previousData = null) => {
    try {
      if (isUpdate) {
        const revertList = Array.isArray(previousData)
          ? previousData
          : (previousData ? [previousData] : [])
        for (const prevTx of revertList) {
          if (prevTx?.id) {
            const { id, ...fieldsToRevert } = prevTx
            await updateTransaction(id, fieldsToRevert)
          }
        }
      } else {
        if (Array.isArray(data)) {
          await Promise.all(data.map((tx) => (tx?.id ? deleteTransaction(tx.id) : Promise.resolve())))
        } else if (data?.id) {
          await deleteTransaction(data.id)
        }
      }
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    } catch (err) {
      console.error('[useChatDeletion.handleUndoTransaction] Failed to undo transactions:', err)
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: locale === 'en' ? 'Undo Failed' : 'Gagal Membatalkan',
            message: err.message || (locale === 'en' ? 'Could not undo transaction' : 'Gagal membatalkan transaksi'),
            type: 'error',
          },
        }),
      )
    }
  }, [setMessages, locale])

  return {
    deletingMsgIdsRef,
    handleConfirmDelete,
    handleCancelDelete,
    handleUndoTransaction,
  }
}
