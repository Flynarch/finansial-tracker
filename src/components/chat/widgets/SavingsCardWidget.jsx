import { useNavigate } from 'react-router-dom'
import { Target, PiggyBank, ArrowUpRight } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { formatCurrency, toSafeNumber } from '../../../lib/utils'

export default function SavingsCardWidget({
  title = 'Target Tabungan',
  targetAmount = 0,
  currentAmount = 0,
  currency = 'IDR',
  action = 'create',
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const numTarget = toSafeNumber(targetAmount)
  const numCurrent = toSafeNumber(currentAmount)
  const percentage = numTarget > 0 ? Math.min(Math.round((numCurrent / numTarget) * 100), 100) : 0
  const remaining = Math.max(0, numTarget - numCurrent)

  const handleNavigate = () => {
    if (onClose) onClose()
    navigate('/savings')
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-4 shadow-sm my-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
            {action === 'add' ? <PiggyBank size={16} strokeWidth={2.2} /> : <Target size={16} strokeWidth={2.2} />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">{title}</div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {action === 'add' ? t('ai.action.savingsDeposit', 'Setoran Tabungan') : t('savings.goalTitle', 'Target Tabungan Impian')}
            </div>
          </div>
        </div>

        <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/15 px-2 py-0.5 text-[10.5px] font-bold text-[var(--accent)] shrink-0">
          {percentage}%
        </span>
      </div>

      {/* Numerical Stats */}
      <div className="grid grid-cols-2 gap-2 my-3">
        <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/70 p-2.5">
          <div className="text-[10px] font-medium text-[var(--muted)]">{t('savings.collected', 'Terkumpul')}</div>
          <div className="text-xs sm:text-sm font-black text-emerald-500 mt-0.5">
            {formatCurrency(numCurrent, currency)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/70 p-2.5">
          <div className="text-[10px] font-medium text-[var(--muted)]">{t('savings.target', 'Target')}</div>
          <div className="text-xs sm:text-sm font-black text-[var(--fg)] mt-0.5">
            {formatCurrency(numTarget, currency)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-[var(--field-bg)] overflow-hidden border border-[var(--border)]/60">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Footer Info & Quick CTA */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[var(--border)]/40">
        <div className="text-[10.5px] font-medium text-[var(--muted)]">
          {remaining === 0 ? (
            <span className="text-emerald-500 font-bold">{t('savings.targetReached', 'Target Tercapai!')}</span>
          ) : (
            <span>
              {t('savings.remaining', 'Kurang')}: <strong className="text-[var(--fg)]">{formatCurrency(remaining, currency)}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
        >
          <span>{t('savings.viewGoals', 'Lihat Tabungan')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

