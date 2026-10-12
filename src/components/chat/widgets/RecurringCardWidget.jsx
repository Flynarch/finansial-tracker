import { useNavigate } from 'react-router-dom'
import { Repeat, Calendar, ArrowUpRight } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { formatCurrency, toSafeNumber } from '../../../lib/utils'
import { triggerHaptic } from '../../../lib/haptics'

export default function RecurringCardWidget({
  title = 'Langganan Baru',
  amount = 0,
  frequency = 'monthly',
  currency = 'IDR',
  category = 'Langganan',
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const numAmount = toSafeNumber(amount)

  const handleNavigate = () => {
    triggerHaptic('light')
    if (onClose) onClose()
    navigate('/settings/recurring')
  }

  const frequencyLabel = {
    monthly: t('recurring.monthly', 'Bulanan'),
    yearly: t('recurring.yearly', 'Tahunan'),
    weekly: t('recurring.weekly', 'Mingguan'),
    daily: t('recurring.daily', 'Harian'),
  }[frequency] || frequency

  return (
    <div className="relative rounded-2xl border border-[var(--border)]/70 bg-[var(--panel-strong)]/85 backdrop-blur-md p-3.5 sm:p-4 shadow-sm overflow-hidden my-1.5 ft-msg-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 shadow-2xs">
            <Repeat size={16} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">{title}</div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">{category}</div>
          </div>
        </div>

        <span className="rounded-full border border-[var(--border)]/60 bg-[var(--field-bg)]/60 px-2 py-0.5 text-[10.5px] font-bold text-[var(--fg)] shrink-0 shadow-2xs">
          {frequencyLabel}
        </span>
      </div>

      {/* Numerical Stats */}
      <div className="flex items-center justify-between gap-2 my-3 rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/40 p-2.5">
        <div>
          <div className="text-[10px] font-medium text-[var(--muted)]">{t('recurring.nominal', 'Biaya Tagihan')}</div>
          <div className="text-xs sm:text-sm font-black text-[var(--fg)] mt-0.5 font-mono">
            {formatCurrency(numAmount, currency)}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)]">
          <Calendar size={13} className="text-[var(--accent)]" />
          <span>{t('recurring.autoRenew', 'Otomatis')}</span>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]/40">
        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:text-[var(--accent-strong)] transition active:scale-95 cursor-pointer"
        >
          <span>{t('recurring.viewAll', 'Kelola Tagihan Berulang')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

