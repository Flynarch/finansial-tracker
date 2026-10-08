import { Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../lib/fieldEncryption'

export default function DeleteConfirmCard({
  msgId,
  data,
  locale = 'id',
  onConfirm,
  onCancel,
}) {
  if (!data) return null

  const isBatch = Boolean(data.isBatch || (Array.isArray(data.items) && data.items.length > 1))
  const items = Array.isArray(data.items) ? data.items : []
  const totalAmount = isBatch
    ? items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : Number(data.amount) || 0

  const rawNote = data.notes
  const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
  const safeNote = isFieldEncrypted(plainNote) ? '' : (plainNote || '')

  return (
    <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-3">
      {isBatch ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
            <div>
              <p className="text-xs font-bold text-[var(--fg)]">
                {locale === 'en' ? `Delete ${items.length} Transactions` : `Hapus ${items.length} Transaksi`}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {locale === 'en' ? 'Total amount to delete' : 'Total nominal yang akan dihapus'}
              </p>
            </div>
            <span className="text-xs font-black shrink-0 text-rose-500">
              {formatCurrency(totalAmount, items[0]?.currency || data.currency)}
            </span>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 ft-hide-scrollbar">
            {items.map((item, idx) => {
              const itemRaw = item.notes
              const itemPlain = isFieldEncrypted(itemRaw) ? getDecryptedNoteSync(itemRaw) : itemRaw
              const itemSafeNote = isFieldEncrypted(itemPlain) ? '' : (itemPlain || '')
              return (
                <div key={item.id || idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[var(--field-bg)]">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-[var(--fg)] truncate">
                      {itemSafeNote || item.category || (locale === 'en' ? `Item #${idx + 1}` : `Item #${idx + 1}`)}
                    </p>
                    <p className="text-[10px] text-[var(--muted)] truncate">
                      {item.date} {item.category ? `• ${item.category}` : ''}
                    </p>
                  </div>
                  <span className="font-bold shrink-0 text-[var(--fg)]">
                    {formatCurrency(item.amount, item.currency || data.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--fg)] truncate">
              {data.title || safeNote || data.category || (locale === 'en' ? 'Item' : 'Data')}
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
      )}

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
          onClick={() => onConfirm?.(isBatch ? (data.ids || items.map((t) => t.id)) : data.id, msgId, data.entityType)}
          className="flex-1 py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Trash2 size={13} strokeWidth={2.2} />
          <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
        </button>
      </div>
    </div>
  )
}
