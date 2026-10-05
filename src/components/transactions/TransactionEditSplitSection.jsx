import { Layers } from 'lucide-react'

export default function TransactionEditSplitSection({ formData, handleSplitItemChange, t }) {
  if (!formData.isSplit || !Array.isArray(formData.splitItems) || formData.splitItems.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-500">
          <Layers className="h-3.5 w-3.5" />
          <span>
            {t('transactions.splitItemsCount', 'Rincian Split Transaksi ({{count}})', {
              count: formData.splitItems.length,
            })}
          </span>
        </div>
        <span className="text-[10px] font-medium text-[var(--muted-2)]">
          {t('tx.splitEditableHint', 'Edit item & nominal')}
        </span>
      </div>
      <div className="space-y-2">
        {formData.splitItems.map((item, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]/60 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={item.name || item.category || ''}
                onChange={(e) => handleSplitItemChange(idx, 'category', e.target.value)}
                placeholder={t('categories.name', 'Kategori / Item')}
                className="flex-1 min-w-0 bg-[var(--field-bg)] rounded-lg border border-[var(--border)]/50 px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              />
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-[var(--muted-2)]">
                  {formData.currency || 'IDR'}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    item.amount !== '' && item.amount != null
                      ? formData.currency === 'IDR'
                        ? Number(item.amount).toLocaleString('id-ID')
                        : item.amount
                      : ''
                  }
                  onChange={(e) => handleSplitItemChange(idx, 'amount', e.target.value)}
                  placeholder="0"
                  className="w-24 text-right bg-[var(--field-bg)] rounded-lg border border-[var(--border)]/50 px-2 py-1.5 text-xs font-bold tabular-nums text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <input
              type="text"
              value={item.notes || ''}
              onChange={(e) => handleSplitItemChange(idx, 'notes', e.target.value)}
              placeholder={t('addTx.notesPlaceholder', 'Tulis catatan transaksi (opsional)...')}
              className="w-full bg-[var(--field-bg)] rounded-lg border border-[var(--border)]/50 px-2.5 py-1 text-[11px] text-[var(--muted)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
