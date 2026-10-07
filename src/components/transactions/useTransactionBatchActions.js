import { useState } from 'react'
import { db } from '../../lib/db'
import { clearCachedDashboardState } from '../../hooks/useDashboardData'
import { scheduleNativeWidgetSync } from '../../lib/nativeWidgetSync'

/**
 * Custom hook to manage multi-selection and bulk actions on transactions
 * (batch category assignment and batch deletion).
 */
export function useTransactionBatchActions({
  filteredTransactions = [],
  deleteTransaction,
  t,
  setApiError,
  setApiErrorTone,
}) {
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false)
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false)

  const toggleSelectTx = (id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    const allIds = filteredTransactions.map((tx) => tx.id)
    setSelectedTxIds(new Set(allIds))
  }

  const clearBulkSelection = () => {
    setSelectedTxIds(new Set())
    setIsBulkMode(false)
  }

  const handleBatchDelete = async () => {
    if (selectedTxIds.size === 0) return
    const ids = Array.from(selectedTxIds)
    try {
      for (const id of ids) {
        await deleteTransaction(id)
      }
      clearBulkSelection()
      setIsBatchDeleteModalOpen(false)
    } catch (err) {
      console.error('[Transactions:handleBatchDelete]', err)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setApiError(
        err?.userMessage || err?.message || (offline ? t('common.error.offline') : t('common.error.saveFailed'))
      )
      setApiErrorTone('error')
      clearBulkSelection()
      setIsBatchDeleteModalOpen(false)
    }
  }

  const handleBatchCategoryChange = async (newCategory) => {
    if (selectedTxIds.size === 0 || !newCategory) return
    const ids = Array.from(selectedTxIds)
    try {
      const selectedTxs = (await db.transactions.where('id').anyOf(ids).toArray()).filter((tx) => !tx.deletedAt)

      const nonSplitIds = []
      let skippedSplitCount = 0

      for (const tx of selectedTxs) {
        if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          skippedSplitCount++
        } else {
          nonSplitIds.push(tx.id)
        }
      }

      if (nonSplitIds.length > 0) {
        await db.transactions.where('id').anyOf(nonSplitIds).modify({
          category: newCategory,
          updatedAt: new Date().toISOString(),
        })
        clearCachedDashboardState()
        scheduleNativeWidgetSync()
      }

      if (skippedSplitCount > 0) {
        setApiError(
          t('tx.batch.splitSkipped', 'Transaksi split dilewati karena memiliki rincian multi-kategori.')
        )
        setApiErrorTone('warning')
      }

      setIsBatchCategoryModalOpen(false)
      clearBulkSelection()
    } catch (err) {
      console.error('[Transactions:handleBatchCategoryChange]', err)
      setApiError(err?.message || t('common.error.saveFailed'))
      setApiErrorTone('error')
      setIsBatchCategoryModalOpen(false)
      clearBulkSelection()
    }
  }

  return {
    isBulkMode,
    setIsBulkMode,
    selectedTxIds,
    setSelectedTxIds,
    isBatchCategoryModalOpen,
    setIsBatchCategoryModalOpen,
    isBatchDeleteModalOpen,
    setIsBatchDeleteModalOpen,
    toggleSelectTx,
    selectAllVisible,
    clearBulkSelection,
    handleBatchDelete,
    handleBatchCategoryChange,
  }
}
