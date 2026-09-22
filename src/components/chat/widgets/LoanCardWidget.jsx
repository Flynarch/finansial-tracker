import { useNavigate } from 'react-router-dom'
import { HandCoins, ArrowUpRight, CheckCircle2, Calendar } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { formatCurrency, toSafeNumber } from '../../../lib/utils'

export default function LoanCardWidget({
  title = 'Pinjaman Baru',
  personName = '',
  loanType = 'debt',
  amount = 0,
  dueDate,
  currency = 'IDR',
  action = 'create',
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const numAmount = toSafeNumber(amount)
  const isDebt = loanType === 'debt'

  const handleNavigate = () => {
    if (onClose) onClose()
    navigate('/loans')
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-4 shadow-sm my-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
              action === 'pay'
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : isDebt
                ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
            }`}
          >
            {action === 'pay' ? <CheckCircle2 size={16} strokeWidth={2.2} /> : <HandCoins size={16} strokeWidth={2.2} />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">
              {personName ? `${personName} • ${title}` : title}
            </div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {action === 'pay'
                ? t('ai.action.loanPaid', 'Pembayaran Pinjaman')
                : isDebt
                ? t('loans.type.debt', 'Hutang (Kewajiban)')
                : t('loans.type.receivable', 'Piutang (Hak Tagih)')}
            </div>
          </div>
        </div>

        <span
          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold shrink-0 ${
            action === 'pay'
              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
              : isDebt
              ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
          }`}
        >
          {action === 'pay' ? t('loans.paid', 'Lunas') : isDebt ? t('loans.debt', 'Hutang') : t('loans.receivable', 'Piutang')}
        </span>
      </div>

      {/* Numerical Stats */}
      <div className="flex items-center justify-between gap-2 my-3 rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/70 p-2.5">
        <div>
          <div className="text-[10px] font-medium text-[var(--muted)]">{t('loans.nominal', 'Nominal')}</div>
          <div className="text-xs sm:text-sm font-black text-[var(--fg)] mt-0.5">
            {formatCurrency(numAmount, currency)}
          </div>
        </div>
        {dueDate && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)]">
            <Calendar size={13} className="text-[var(--accent)]" />
            <span>{dueDate}</span>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]/40">
        <button
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
        >
          <span>{t('loans.viewAll', 'Kelola Hutang & Piutang')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

