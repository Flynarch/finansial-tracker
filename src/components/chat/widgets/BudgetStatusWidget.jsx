import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { CircleDollarSign, ArrowUpRight, AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { formatCurrency, toSafeNumber } from '../../../lib/utils'
import { getTransactionCategoryLabels } from '../../../lib/categoryIcon'

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

  // Status Theme & Badge
  let statusBadge = {
    label: t('budget.status.safe', 'Aman'),
    colorClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    barClass: 'bg-emerald-500',
    Icon: CheckCircle2,
  }

  if (isOverbudget) {
    statusBadge = {
      label: t('budget.status.overbudget', 'Melebihi Limit'),
      colorClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      barClass: 'bg-rose-500',
      Icon: AlertOctagon,
    }
  } else if (isNearLimit) {
    statusBadge = {
      label: t('budget.status.nearLimit', 'Mendekati Limit'),
      colorClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      barClass: 'bg-amber-500',
      Icon: AlertTriangle,
    }
  }

  const StatusIcon = statusBadge.Icon

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-4 shadow-sm my-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
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

      {/* Numerical Stats */}
      <div className="grid grid-cols-2 gap-2 my-3">
        <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/70 p-2.5">
          <div className="text-[10px] font-medium text-[var(--muted)]">{t('budget.spent', 'Terpakai')}</div>
          <div className="text-xs sm:text-sm font-black text-[var(--fg)] mt-0.5">
            {formatCurrency(numSpent, currency)}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/70 p-2.5">
          <div className="text-[10px] font-medium text-[var(--muted)]">{t('budget.limit', 'Batas Anggaran')}</div>
          <div className="text-xs sm:text-sm font-black text-[var(--fg)] mt-0.5">
            {formatCurrency(numLimit, currency)}
          </div>
        </div>
      </div>

      {/* Dynamic Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-[var(--muted)]">{t('budget.progress', 'Progres')}</span>
          <span className={isOverbudget ? 'text-rose-500' : isNearLimit ? 'text-amber-500' : 'text-emerald-500'}>
            {percentage}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--field-bg)] overflow-hidden border border-[var(--border)]/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${statusBadge.barClass}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Footer Info & Quick CTA */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[var(--border)]/40">
        <div className="text-[10.5px] font-medium text-[var(--muted)]">
          {isOverbudget ? (
            <span className="text-rose-500 font-bold">
              +{formatCurrency(numSpent - numLimit, currency)} {t('budget.over', 'lebih')}
            </span>
          ) : (
            <span>
              {t('budget.remaining', 'Sisa')}: <strong className="text-[var(--fg)]">{formatCurrency(remaining, currency)}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
        >
          <span>{t('budget.manage', 'Kelola Anggaran')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

BudgetStatusWidget.propTypes = {
  category: PropTypes.string,
  limit: PropTypes.number,
  spent: PropTypes.number,
  currency: PropTypes.string,
  action: PropTypes.string,
}
