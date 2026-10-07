import { lazy, Suspense } from 'react'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'
import ReceiptPreviewModal from './ReceiptPreviewModal'
import TransactionDetailSheet from './TransactionDetailSheet'
import TransactionEditSheet from './TransactionEditSheet'
import TransactionFilterSheet from './TransactionFilterSheet'
import TransactionBulkBar from './TransactionBulkBar'
import CategoryPickerModal from './CategoryPickerModal'
import CustomDatePickerModal from '../ui/CustomDatePickerModal'
import SplitBillModal from '../split-bill/SplitBillModal'
import { getDecryptedNoteSync } from '../../lib/fieldEncryption'
import { getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { formatCurrency } from '../../lib/utils'

const StatementImportModal = lazy(() => import('./StatementImportModal'))

/**
 * Manages all modal sheets, bottom drawers, and overlays for the Transactions screen.
 */
export default function TransactionModalsManager({
  // Single delete modal
  singleDeleteTx,
  onCloseSingleDelete,
  onConfirmSingleDelete,

  // Receipt preview modal
  receiptPreviewTx,
  onCloseReceiptPreview,

  // Transaction detail sheet
  detailTransaction,
  onCloseDetail,
  onOpenEditFromDetail,
  onDeleteFromDetail,

  // Transaction edit sheet
  editingTransaction,
  onCloseEdit,
  editFormData,
  setEditFormData,
  onSubmitEdit,

  // Filter sheet
  isFilterOpen,
  onCloseFilter,
  filters,
  onApplyFilters,
  userWallets,
  usedCategories,
  onOpenDatePickerModal,

  // Bulk actions & batch modals
  isBulkMode,
  selectedTxIds,
  totalFilteredCount,
  onSelectAllVisible,
  onOpenBatchCategory,
  onOpenBatchDelete,
  onCancelBulk,

  isBatchDeleteModalOpen,
  onCloseBatchDelete,
  onConfirmBatchDelete,

  isBatchCategoryModalOpen,
  onCloseBatchCategory,
  onSelectBatchCategory,

  // Custom date picker modal
  isDatePickerModalOpen,
  onCloseDatePicker,
  onSelectDateRange,

  // Split bill modal
  isSplitBillOpen,
  onCloseSplitBill,

  // Statement import modal
  isStatementImportOpen,
  onCloseStatementImport,
  hasOpenedStatementImport,
  onImportStatementComplete,

  // Global shared context
  allWallets = [],
  transactions = [],
  defaultCurrency = 'IDR',
  rates = {},
  convertCurrency,
  locale = 'id',
  t,
}) {
  return (
    <>
      {/* Single Delete Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(singleDeleteTx)}
        onClose={onCloseSingleDelete}
        onConfirm={onConfirmSingleDelete}
        title={t('tx.item.delete') || 'Hapus Transaksi'}
        message={t('tx.item.deleteConfirm') || 'Apakah Anda yakin ingin menghapus transaksi ini?'}
      />

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={Boolean(receiptPreviewTx)}
        onClose={onCloseReceiptPreview}
        imageSrc={
          receiptPreviewTx?.receiptImage ||
          receiptPreviewTx?.receipt ||
          receiptPreviewTx?.receiptUrl ||
          receiptPreviewTx?.image ||
          null
        }
        amountFormatted={
          receiptPreviewTx
            ? `${receiptPreviewTx.type === 'income' ? '+' : '-'}${formatCurrency(
                Math.abs(Number(receiptPreviewTx.amount || 0)),
                receiptPreviewTx.currency || defaultCurrency,
              )}`
            : ''
        }
        date={receiptPreviewTx?.date}
        notes={getDecryptedNoteSync(receiptPreviewTx?.notes)}
        category={
          receiptPreviewTx
            ? getTransactionCategoryLabels(receiptPreviewTx.category, receiptPreviewTx.type, locale)?.main
            : ''
        }
        zIndex="z-[60]"
      />

      {/* Transaction Detail BottomSheet */}
      <TransactionDetailSheet
        isOpen={Boolean(detailTransaction)}
        onClose={onCloseDetail}
        transaction={detailTransaction}
        openEditTransaction={(tx) => {
          onCloseDetail()
          onOpenEditFromDetail(tx)
        }}
        deleteTransaction={(tx) => {
          const targetTx = tx || detailTransaction
          if (!targetTx?.id) return
          onCloseDetail()
          onDeleteFromDetail(targetTx)
        }}
        wallets={allWallets}
        defaultCurrency={defaultCurrency}
        rates={rates}
        formatCurrency={formatCurrency}
        convertCurrency={convertCurrency}
        locale={locale}
        t={t}
      />

      {/* Transaction Edit BottomSheet */}
      <TransactionEditSheet
        isOpen={Boolean(editingTransaction)}
        onClose={onCloseEdit}
        formData={editFormData}
        setFormData={setEditFormData}
        onSubmit={onSubmitEdit}
        t={t}
        locale={locale}
        wallets={allWallets}
      />

      {/* Advanced Filter BottomSheet Modal */}
      <TransactionFilterSheet
        isOpen={isFilterOpen}
        onClose={onCloseFilter}
        filters={filters}
        onApplyFilters={onApplyFilters}
        userWallets={userWallets}
        usedCategories={usedCategories}
        onOpenDatePickerModal={onOpenDatePickerModal}
      />

      {/* Bulk Actions Floating Bar */}
      <TransactionBulkBar
        isBulkMode={isBulkMode}
        selectedTxIds={selectedTxIds}
        totalFilteredCount={totalFilteredCount}
        onSelectAll={onSelectAllVisible}
        onOpenBatchCategory={onOpenBatchCategory}
        onOpenBatchDelete={onOpenBatchDelete}
        onCancel={onCancelBulk}
      />

      {/* Batch Delete Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={onCloseBatchDelete}
        onConfirm={onConfirmBatchDelete}
        title={t('tx.bulk.deleteTitle', 'Hapus Transaksi Terpilih')}
        message={t(
          'tx.bulk.deleteMessage',
          { count: selectedTxIds.size },
          `Apakah Anda yakin ingin menghapus ${selectedTxIds.size} transaksi yang dipilih? Tindakan ini tidak dapat dibatalkan.`
        )}
      />

      {/* Category Picker Modal for Batch Category */}
      <CategoryPickerModal
        isOpen={isBatchCategoryModalOpen}
        txType="expense"
        onClose={onCloseBatchCategory}
        onSelectCategory={(categoryKey) => {
          onSelectBatchCategory(categoryKey)
        }}
      />

      {/* Custom Date Picker Modal */}
      <CustomDatePickerModal
        isOpen={isDatePickerModalOpen}
        onClose={onCloseDatePicker}
        startDate={filters.startDate || ''}
        endDate={filters.endDate || ''}
        locale={locale}
        onSelectRange={onSelectDateRange}
      />

      {/* Split Bill Modal */}
      <SplitBillModal
        isOpen={isSplitBillOpen}
        onClose={onCloseSplitBill}
      />

      {/* Universal e-Statement & Bank Mutation Import Modal */}
      {hasOpenedStatementImport && (
        <Suspense fallback={null}>
          <StatementImportModal
            isOpen={isStatementImportOpen}
            onClose={onCloseStatementImport}
            wallets={allWallets}
            existingTransactions={transactions}
            onImportComplete={onImportStatementComplete}
          />
        </Suspense>
      )}
    </>
  )
}
