import { useNavigate } from 'react-router-dom'
import { HandCoins, ArrowUpRight, CheckCircle2, Calendar } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useChatStore from '../../../store/useChatStore'
import { formatCurrency, toSafeNumber } from '../../../lib/utils'
import { triggerHaptic } from '../../../lib/haptics'

export default function LoanCardWidget({
  loanId,
  title = 'Pinjaman Baru',
  personName = '',
  loanType = 'debt',
  amount = 0,
  remainingAmount,
  dueDate,
  currency = 'IDR',
  action = 'create',
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const numAmount = toSafeNumber(amount)
  const isDebt = loanType === 'debt'
  const isPaid = action === 'pay'
  const isPartialPayment = action === 'payment'

  const handleNavigate = () => {
    triggerHaptic('light')
    if (onClose) onClose()
    if (loanId) {
      navigate(`/loans/${loanId}`)
    } else {
      navigate('/loans')
    }
  }

  return (
    <div className="relative rounded-2xl border border-[var(--border)]/70 bg-[var(--panel-strong)]/85 backdrop-blur-md p-3.5 sm:p-4 shadow-sm overflow-hidden my-1.5 ft-msg-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${
              isPaid
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : isPartialPayment
                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                : 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30'
            }`}
          >
            {isPaid ? <CheckCircle2 size={16} strokeWidth={2.2} /> : <HandCoins size={16} strokeWidth={2.2} />}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-[var(--fg)] truncate">
              {personName ? `${personName} • ${title}` : title}
            </div>
            <div className="text-[10px] font-semibold text-[var(--muted)]">
              {isPaid
                ? t('ai.action.loanPaid', 'Pelunasan Pinjaman')
                : isPartialPayment
                ? t('ai.action.loanPayment', 'Pembayaran Cicilan Pinjaman')
                : isDebt
                ? t('loans.type.debt', 'Hutang (Kewajiban)')
                : t('loans.type.receivable', 'Piutang (Hak Tagih)')}
            </div>
          </div>
        </div>

        <span
          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold shrink-0 shadow-2xs ${
            isPaid
              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
              : isPartialPayment
              ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
              : isDebt
              ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
          }`}
        >
          {isPaid
            ? t('loans.paid', 'Lunas')
            : isPartialPayment
            ? t('loans.partialPaid', 'Cicilan')
            : isDebt
            ? t('loans.debt', 'Hutang')
            : t('loans.receivable', 'Piutang')}
        </span>
      </div>

      {/* Numerical Stats */}
      <div className="flex items-center justify-between gap-2 my-3 rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/40 p-2.5">
        <div>
          <div className="text-[10px] font-medium text-[var(--muted)]">
            {isPaid || isPartialPayment ? t('loans.paidNominal', 'Dibayar') : t('loans.nominal', 'Nominal')}
          </div>
          <div className="text-xs sm:text-sm font-black text-[var(--fg)] mt-0.5 font-mono">
            {formatCurrency(numAmount, currency)}
          </div>
        </div>

        {remainingAmount !== undefined && remainingAmount !== null && (
          <div className="text-right">
            <div className="text-[10px] font-medium text-[var(--muted)]">{t('loans.remaining', 'Sisa')}</div>
            <div className={`text-xs sm:text-sm font-bold mt-0.5 font-mono ${remainingAmount === 0 ? 'text-emerald-500' : 'text-[var(--fg)]'}`}>
              {formatCurrency(toSafeNumber(remainingAmount), currency)}
            </div>
          </div>
        )}

        {dueDate && (remainingAmount === undefined || remainingAmount === null) && (
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
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:text-[var(--accent-strong)] transition active:scale-95 cursor-pointer"
        >
          <span>{t('loans.viewAll', 'Kelola Hutang & Piutang')}</span>
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

