import { Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

export default function DeleteConfirmCard({
  msgId,
  data,
  locale = 'id',
  onConfirm,
  onCancel,
}) {
  if (!data) return null

  return (
    <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--fg)] truncate">
            {data.title || data.notes || data.category || (locale === 'en' ? 'Item' : 'Data')}
          </p>
          <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
            {data.entityType === 'loan' ? (
              <span>
                {data.loanType === 'debt' ? (locale === 'en' ? 'Debt' : 'Hutang') : (locale === 'en' ? 'Receivable' : 'Piutang')}
                {data.personName ? ` • ${data.personName}` : ''}
              </span>
            ) : data.entityType === 'recurring' ? (
              <span>
                {data.frequency || (locale === 'en' ? 'Recurring' : 'Berulang')}
                {data.category ? ` • ${data.category}` : ''}
              </span>
            ) : (
              <>
                <span>{data.date}</span>
                {data.category && <span>{`• ${data.category}`}</span>}
              </>
            )}
          </p>
        </div>
        {data.amount != null && (
          <span className={`text-xs font-black shrink-0 ${data.type === 'income' ? 'text-[var(--income)]' : 'text-[var(--expense)]'}`}>
            {formatCurrency(data.amount, data.currency)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onCancel?.(msgId, data.entityType)}
          className="flex-1 py-2 px-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer text-center"
        >
          {locale === 'en' ? 'Cancel' : 'Batal'}
        </button>
        <button
          type="button"
          onClick={() => onConfirm?.(data.id, msgId, data.entityType)}
          className="flex-1 py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Trash2 size={13} strokeWidth={2.2} />
          <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
        </button>
      </div>
    </div>
  )
}
