import { createPortal } from 'react-dom'
import useTranslation from '../../hooks/useTranslation'
import useBottomSheet from '../../hooks/useBottomSheet'

export default function TransactionBulkBar({
  isBulkMode,
  selectedTxIds,
  totalFilteredCount,
  onSelectAll,
  onOpenBatchCategory,
  onOpenBatchDelete,
  onCancel,
}) {
  const { t } = useTranslation()
  const { isMounted, isVisible } = useBottomSheet({
    isOpen: isBulkMode,
    useBackButton: false,
    lockBodyScroll: false,
  })

  if (!isMounted || typeof document === 'undefined') return null

  return createPortal(
    <div className={`fixed bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-50 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transform-gpu ${
      isVisible ? 'ft-sheet-enter' : 'ft-sheet-exit pointer-events-none'
    }`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--fg)]">
          {selectedTxIds.size} {t('tx.bulk.selected', 'Dipilih')}
        </span>
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-lg bg-[var(--field-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
        >
          {t('tx.bulk.all', 'Semua')} ({totalFilteredCount})
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenBatchCategory}
          disabled={selectedTxIds.size === 0}
          className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/40 disabled:opacity-40 transition active:scale-95 cursor-pointer"
        >
          {t('tx.bulk.changeCategory', 'Ubah Kategori')}
        </button>
        <button
          type="button"
          onClick={onOpenBatchDelete}
          disabled={selectedTxIds.size === 0}
          className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/25 disabled:opacity-40 transition active:scale-95 cursor-pointer"
        >
          {t('tx.bulk.delete', 'Hapus')} ({selectedTxIds.size})
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
        >
          {t('common.cancel', 'Batal')}
        </button>
      </div>
    </div>,
    document.body
  )
}
