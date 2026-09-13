import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Modal from '../ui/Modal'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import useBackButton from '../../hooks/useBackButton'
import { triggerHaptic } from '../../lib/haptics'
import { formatCurrency } from '../../lib/utils'
import {
  getLoanInstallmentSummary,
  formatInstallmentRelativeDate,
} from '../../lib/loanUtils'
import {
  Clock,
  AlertCircle,
  HandCoins,
  Receipt,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

export default function LoanInstallmentModal({
  isOpen,
  onClose,
  loan = null,
  onPayInstallment = null,
}) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  useBackButton(onClose, isOpen)

  const payments = useLiveQuery(
    async () => {
      if (!loan?.id) return []
      return await db.loanPayments.where('loanId').equals(loan.id).reverse().toArray()
    },
    [loan?.id],
    []
  )

  const currency = loan?.currency || defaultCurrency
  const isDebt = loan?.type === 'debt'

  const {
    totalInstallments,
    paidInstallmentsCount,
    nextInstallment,
    isFullyPaid,
    schedule,
  } = useMemo(() => {
    if (!loan) return { totalInstallments: 0, paidInstallmentsCount: 0, nextInstallment: null, isFullyPaid: true, schedule: [] }
    return getLoanInstallmentSummary(loan, payments || [])
  }, [loan, payments])

  if (!loan) return null

  const progressPct = totalInstallments > 0 ? Math.min(100, Math.round((paidInstallmentsCount / totalInstallments) * 100)) : 0

  const handlePayClick = (installment) => {
    triggerHaptic('medium')
    onPayInstallment?.(installment?.remainingAmount || installment?.amount || loan?.monthlyPayment || 0)
    onClose?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      title={t('loans.installments.title', 'Jadwal & Riwayat Cicilan')}
    >
      <div className="space-y-4 pt-1 pb-2">
        {/* Loan Context Header */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                  isDebt
                    ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25'
                    : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25'
                }`}
              >
                {isDebt ? <HandCoins className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-extrabold text-[var(--fg)]">{loan.title}</h4>
                <p className="text-[11px] font-semibold text-[var(--muted)] truncate">
                  {loan.personName}
                  {loan.interestRate ? ` · ${loan.interestRate}%/thn` : ''}
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black border uppercase tracking-wider ${
                isDebt
                  ? 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)] border-[var(--earthy-terra)]/25'
                  : 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)] border-[var(--earthy-green)]/25'
              }`}
            >
              {isDebt ? t('loans.myDebt', 'Utang') : t('loans.myReceivable', 'Piutang')}
            </span>
          </div>

          {/* Progress Bar & Counter */}
          <div className="space-y-1.5 pt-1 border-t border-[var(--border)]/50">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[var(--muted)]">
                {t('loans.installments.progress', 'Progres Pembayaran')}
              </span>
              <span className="text-[var(--fg)] tabular-nums">
                {t('loans.installments.paidOfTotal', { paid: paidInstallmentsCount, total: totalInstallments }, `${paidInstallmentsCount} dari ${totalInstallments} Cicilan`)} ({progressPct}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--panel-strong)] border border-[var(--border)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFullyPaid
                    ? 'bg-emerald-500'
                    : isDebt
                      ? 'bg-[var(--earthy-terra)]'
                      : 'bg-[var(--earthy-green)]'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Next Installment Action Hero Card (if not fully paid) */}
        {!isFullyPaid && nextInstallment && (
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {t('loans.installments.nextDue', 'Cicilan Jatuh Tempo Berikutnya')}
              </span>
              <span className="text-xs font-bold text-[var(--accent)]">
                {formatInstallmentRelativeDate(nextInstallment.dueDate, locale)}
              </span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--muted)]">
                  {t('loans.installments.installmentNum', { number: nextInstallment.installmentNumber }, `Cicilan #${nextInstallment.installmentNumber}`)}
                </p>
                <p className="text-lg font-black text-[var(--fg)] tabular-nums">
                  {formatCurrency(nextInstallment.remainingAmount, currency)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handlePayClick(nextInstallment)}
                className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-extrabold shadow-sm hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <span>{isDebt ? t('loans.installments.payThis', 'Bayar Cicilan Ini') : t('loans.installments.receiveThis', 'Terima Cicilan Ini')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {isFullyPaid && (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-xs font-bold">
              {t('loans.installments.allPaid', 'Semua cicilan telah lunas!')}
            </p>
          </div>
        )}

        {/* Schedule List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              {t('loans.installments.schedule', 'Daftar Cicilan')}
            </span>
            <span className="text-[11px] font-bold text-[var(--muted)]">
              {schedule.length} {locale === 'id' ? 'Bulan' : 'Months'}
            </span>
          </div>

          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
            {schedule.map((item) => {
              const isPaid = item.status === 'paid'
              const isPartial = item.status === 'partial'
              const isOverdue = item.isOverdue

              return (
                <div
                  key={item.installmentNumber}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                    isPaid
                      ? 'bg-[var(--panel-strong)]/60 border-[var(--border)]/60 opacity-80'
                      : isOverdue
                        ? 'bg-rose-500/5 border-rose-500/30'
                        : 'bg-[var(--field-bg)] border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                        isPaid
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : isOverdue
                            ? 'bg-rose-500/15 text-rose-500'
                            : 'bg-[var(--panel-strong)] text-[var(--muted)]'
                      }`}
                    >
                      {item.installmentNumber}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--fg)]">
                          {formatInstallmentRelativeDate(item.dueDate, locale)}
                        </span>
                        {isPaid && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('loans.installments.statusPaid', 'Lunas')}
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-500">
                            <Clock className="h-3 w-3" />
                            {t('loans.installments.statusPartial', 'Sebagian')}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-rose-500">
                            <AlertCircle className="h-3 w-3" />
                            {t('loans.installments.statusOverdue', 'Lewat Tempo')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--muted)]">
                        {item.dueDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 text-right">
                    <div>
                      <p className={`text-xs font-black tabular-nums ${isPaid ? 'line-through text-[var(--muted)]' : 'text-[var(--fg)]'}`}>
                        {formatCurrency(item.amount, currency)}
                      </p>
                      {isPartial && (
                        <p className="text-[10px] font-bold text-amber-500 tabular-nums">
                          {t('loans.installments.remainingLabel', 'Sisa')}: {formatCurrency(item.remainingAmount, currency)}
                        </p>
                      )}
                    </div>

                    {!isPaid && !isFullyPaid && (
                      <button
                        type="button"
                        onClick={() => handlePayClick(item)}
                        className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all cursor-pointer active:scale-95"
                      >
                        {isDebt ? t('loans.installments.quickPay', 'Bayar') : t('loans.installments.receiveThis', 'Terima')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
