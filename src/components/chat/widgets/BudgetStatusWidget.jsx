import { useNavigate } from 'react-router-dom'
import { CircleDollarSign, ArrowUpRight, AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import useSettingsStore from '../../../store/useSettingsStore'
import { formatCurrency, toSafeNumber } from '../../../lib/utils'
import { getTransactionCategoryLabels } from '../../../lib/categoryIcon'
import { getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../../../lib/budgetUtils'
import { parseISO, differenceInCalendarDays } from 'date-fns'

export default function BudgetStatusWidget({
  category = 'makanMinum',
  limit = 0,
  spent = 0,
  currency = 'IDR',
  action = 'status',
}) {
  const navigate = useNavigate()
  const { locale, t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)
  const budgetCycleStartDay = useSettingsStore((s) => s.budgetCycleStartDay) || 1

  const numLimit = toSafeNumber(limit)
  const numSpent = toSafeNumber(spent)
  const percentage = numLimit > 0 ? Math.min(Math.round((numSpent / numLimit) * 100), 999) : 0
  const remaining = Math.max(0, numLimit - numSpent)
  const isOverbudget = numSpent > numLimit
  const isNearLimit = percentage >= 75 && !isOverbudget

  const categoryLabels = getTransactionCategoryLabels(category, 'expense', locale)
  const categoryName = categoryLabels.sub || categoryLabels.main || category

  const handleNavigate = () => {
    if (onClose) onClose()
    navigate('/budget')
  }

  // Pacing calculations (Day of Cycle vs Spend %) respecting custom payday cycle
  const currentMonthKey = getCurrentBudgetMonthKey(new Date(), budgetCycleStartDay)
  const budgetPeriod = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)
  const now = new Date()
  const startDate = parseISO(budgetPeriod.startDate)
  const endDate = parseISO(budgetPeriod.endDate)
  const totalCycleDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1)
  const daysElapsed = Math.min(totalCycleDays, Math.max(1, differenceInCalendarDays(now, startDate) + 1))
  const daysRemaining = Math.max(1, totalCycleDays - daysElapsed)
  const monthElapsedPct = Math.min(100, Math.max(1, Math.round((daysElapsed / totalCycleDays) * 100)))
  const dailyAllowance = remaining > 0 ? Math.round(remaining / daysRemaining) : 0
  const pacingDiff = percentage - monthElapsedPct

  // Status Theme & Badge
  let statusBadge = {
    label: t('budget.status.safe', 'Aman'),
    colorClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    barClass: 'bg-emerald-500',
    Icon: CheckCircle2,
    pacingText: locale === 'en' ? 'On Track' : 'Terkendali',
  }

  if (isOverbudget) {
    statusBadge = {
      label: t('budget.status.overbudget', 'Melebihi Limit'),
      colorClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      barClass: 'bg-rose-500',
      Icon: AlertOctagon,
      pacingText: locale === 'en' ? 'Over Budget' : 'Melebihi Limit',
    }
  } else if (pacingDiff > 10) {
    statusBadge = {
      label: locale === 'en' ? `Overpacing (+${pacingDiff}%)` : `Boros (+${pacingDiff}%)`,
      colorClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      barClass: 'bg-rose-500',
      Icon: AlertTriangle,
      pacingText: locale === 'en' ? 'High Velocity' : 'Pengeluaran Cepat',
    }
  } else if (isNearLimit) {
    statusBadge = {
      label: t('budget.status.nearLimit', 'Mendekati Limit'),
      colorClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      barClass: 'bg-amber-500',
      Icon: AlertTriangle,
      pacingText: locale === 'en' ? 'Near Limit' : 'Mendekati Limit',
    }
  }

  const StatusIcon = statusBadge.Icon

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-4 shadow-sm my-1.5 ft-msg-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <CircleDollarSign size={16} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">{categoryName}</div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {action === 'update' ? t('ai.action.budgetUpdated', 'Anggaran Diperbarui') : t('budget.monthlyTitle', 'Status Anggaran Bulanan')}
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold shrink-0 ${statusBadge.colorClass}`}>
          <StatusIcon size={12} strokeWidth={2.5} />
          <span>{statusBadge.label}</span>
        </div>
      </div>

      {/* Numerical Stats Hero */}
      <div className="flex items-baseline justify-between mt-3 mb-2">
        <div>
          <span className="text-lg sm:text-xl font-black tabular-nums text-[var(--fg)] font-mono">
            {formatCurrency(numSpent, currency)}
          </span>
          <span className="text-xs text-[var(--muted)] font-medium"> / {formatCurrency(numLimit, currency)}</span>
        </div>
        <span className="text-xs font-bold text-[var(--muted)]">
          {percentage}% {locale === 'en' ? 'spent' : 'terpakai'}
        </span>
      </div>

      {/* Dual-Marker Progress Track */}
      <div className="space-y-1.5 my-2">
        <div className="relative h-2 w-full rounded-full bg-[var(--field-bg)] overflow-hidden border border-[var(--border)]/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${statusBadge.barClass}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
          {/* Day of cycle marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--fg)]/40 pointer-events-none"
            style={{ left: `${monthElapsedPct}%` }}
            title={`Hari ke-${daysElapsed} (${monthElapsedPct}%)`}
          />
        </div>
        <div className="flex justify-between text-[9.5px] text-[var(--muted)] font-semibold">
          <span>{locale === 'en' ? `Day ${daysElapsed} of ${totalCycleDays} (${monthElapsedPct}%)` : `Hari ke-${daysElapsed} dari ${totalCycleDays} (${monthElapsedPct}%)`}</span>
          <span>{statusBadge.pacingText}</span>
        </div>
      </div>

      {/* Daily Allowance & Footer */}
      <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-[var(--border)]/40">
        <div className="text-[10.5px] font-medium text-[var(--muted)] min-w-0">
          {isOverbudget ? (
            <span className="text-rose-500 font-bold">
              +{formatCurrency(numSpent - numLimit, currency)} {t('budget.over', 'lebih')}
            </span>
          ) : (
            <span className="truncate block">
              {locale === 'en'
                ? `Left: ${formatCurrency(remaining, currency)} (${formatCurrency(dailyAllowance, currency)}/day)`
                : `Sisa: ${formatCurrency(remaining, currency)} (${formatCurrency(dailyAllowance, currency)}/hari)`}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
        >
          <span>{t('budget.manage', 'Kelola')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

