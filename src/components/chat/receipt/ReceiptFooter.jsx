import { memo } from 'react'
import { Receipt, Copy, Check } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'

const BARCODE_WIDTHS = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 3, 1, 2, 4, 1, 2, 3]

export const ReceiptFooter = memo(function ReceiptFooter({
  refCode,
  copiedRef,
  onCopyRef,
  contextualTheme,
}) {
  const { t } = useTranslation()

  return (
    <>
      {/* Pronounced Perforated Ticket Notches & Tear Line */}
      <div className="relative flex items-center px-3 py-1 my-0.5">
        <div className="absolute -left-3 h-5 w-5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_-2px_0_3px_rgba(0,0,0,0.15)]" />
        <div className="w-full border-t-2 border-dashed border-[var(--border-strong)]/40" />
        <div className="absolute -right-3 h-5 w-5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_2px_0_3px_rgba(0,0,0,0.15)]" />
      </div>

      {/* Decorative Mini Barcode */}
      <div className="px-4 pt-1 flex items-center justify-center gap-[2px] opacity-30 select-none overflow-hidden" aria-hidden="true">
        {BARCODE_WIDTHS.map((w, i) => (
          <div
            key={i}
            className="h-3 bg-[var(--fg)] rounded-xs shrink-0"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>

      {/* Compact Receipt Footer (Ref Code & Verification) */}
      <div className="px-3.5 py-2 bg-[var(--field-bg)]/40 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 font-mono text-[var(--muted)]">
          <Receipt className="h-3 w-3 text-[var(--accent)]" />
          <span className="tracking-wide font-bold">{refCode}</span>
          <button
            type="button"
            onClick={onCopyRef}
            className="p-1 hover:text-[var(--fg)] hover:bg-[var(--panel)] rounded transition cursor-pointer"
            title={t('common.copyRef', 'Salin No. Referensi')}
          >
            {copiedRef ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>

        <span className={`font-black text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--panel)] border border-[var(--border)]/60 ${contextualTheme.tag}`}>
          FinTrack Verified
        </span>
      </div>
    </>
  )
})

export default ReceiptFooter
