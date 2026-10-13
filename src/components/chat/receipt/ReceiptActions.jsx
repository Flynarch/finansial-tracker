import { memo } from 'react'
import { Plus, Pencil, RotateCcw, ArrowRight } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'

export const ReceiptActions = memo(function ReceiptActions({
  isSingle,
  singleTx,
  isUndoing,
  onLogAnother,
  onStartEdit,
  handleUndo,
  handleViewTransactions,
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      {/* Primary CTA */}
      <button
        type="button"
        onClick={onLogAnother}
        className="ft-btn-primary w-full py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99] transition rounded-xl"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        <span>{t('ai.logAnother', 'Catat Transaksi Lagi')}</span>
      </button>

      {/* Secondary CTAs */}
      <div className="flex items-center gap-1.5">
        {isSingle && (
          <button
            type="button"
            onClick={() => onStartEdit(singleTx)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
          >
            <Pencil className="h-3 w-3 text-[var(--accent)]" />
            <span>{t('common.edit', 'Edit')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleUndo}
          disabled={isUndoing}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{isUndoing ? t('common.cancelling', 'Membatalkan...') : t('common.undo', 'Batalkan')}</span>
        </button>

        <button
          type="button"
          onClick={handleViewTransactions}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
        >
          <span>{t('common.history', 'Riwayat')}</span>
          <ArrowRight className="h-3 w-3 text-[var(--muted)]" />
        </button>
      </div>
    </div>
  )
})

export default ReceiptActions
