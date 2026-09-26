import { TrendingUp, TrendingDown, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, Scale, Inbox } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import {
  calculateSavingsRate,
  calculateCashflowRatio,
  calculateFinancialHealthTier,
  formatDelta,
} from '../../lib/reportAnalytics'

export default function ReportKpiCards({ thisMonth, previousMonth }) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const income = toSafeNumber(thisMonth?.income)
  const expense = toSafeNumber(thisMonth?.expense)
  const prevIncome = toSafeNumber(previousMonth?.income)
  const prevExpense = toSafeNumber(previousMonth?.expense)

  const netSavings = income - expense
  const incomeDelta = formatDelta(income, prevIncome)
  const expenseDelta = formatDelta(expense, prevExpense)

  const savingsRate = calculateSavingsRate(income, expense)
  const { incomePercent, expensePercent, hasData } = calculateCashflowRatio(income, expense)
  const healthTier = calculateFinancialHealthTier(netSavings, hasData)

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-6 shadow-[var(--shadow-card)] transition">
      {/* Top Section: Net Savings / Financial Health Hero */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)]/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
              {t('reports.netSavings', 'Surplus Bersih')}
            </span>
            {healthTier === 'empty' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                <Inbox className="h-3 w-3" />
                {t('reports.noDataYet', 'Belum Ada Data')}
              </span>
            )}
            {healthTier === 'surplus' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-income)]/30 bg-[var(--status-income-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--status-income)]">
                <ShieldCheck className="h-3 w-3" />
                {t('reports.healthSurplus', 'Surplus Prima')}
              </span>
            )}
            {healthTier === 'stable' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-warning)]/30 bg-[var(--status-warning-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--status-warning)]">
                <Scale className="h-3 w-3" />
                {t('reports.healthStable', 'Stabil')}
              </span>
            )}
            {healthTier === 'deficit' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-expense)]/30 bg-[var(--status-expense-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--status-expense)]">
                <AlertTriangle className="h-3 w-3" />
                {t('reports.healthDeficit', 'Defisit')}
              </span>
            )}
          </div>

          <p
            className={`mt-1 text-2xl sm:text-3xl font-black tracking-tight tabular-nums truncate ${
              healthTier === 'surplus'
                ? 'text-[var(--status-income)]'
                : healthTier === 'deficit'
                  ? 'text-[var(--status-expense)]'
                  : 'text-[var(--fg)]'
            }`}
          >
            {healthTier === 'surplus' ? '+' : ''}
            {formatCurrency(netSavings, defaultCurrency)}
          </p>
        </div>

        {/* Savings Rate Meter Badge */}
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/90 px-4 py-3 shadow-2xs">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('reports.savingsRate', 'Tingkat Tabungan')}
            </span>
            <span
              className={`block text-base sm:text-lg font-black tabular-nums ${
                !hasData
                  ? 'text-[var(--muted)]'
                  : savingsRate >= 20
                    ? 'text-[var(--status-income)]'
                    : savingsRate > 0
                      ? 'text-[var(--status-warning)]'
                      : 'text-[var(--status-expense)]'
              }`}
            >
              {hasData ? `${savingsRate}%` : '0%'}
            </span>
          </div>
          <div className="h-9 w-16 overflow-hidden rounded-full bg-[var(--border)]/60 p-0.5">
            {hasData && savingsRate !== 0 ? (
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  savingsRate >= 20 ? 'bg-[var(--status-income)]' : savingsRate > 0 ? 'bg-[var(--status-warning)]' : 'bg-[var(--status-expense)]'
                }`}
                style={{ width: `${Math.min(100, Math.abs(savingsRate))}%` }}
              />
            ) : (
              <div className="h-full w-0 rounded-full bg-transparent" />
            )}
          </div>
        </div>
      </div>

      {/* Proportional Ratio Bar */}
      <div className="pt-4">
        {hasData ? (
          <>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-[var(--muted)]">
              <span className="flex items-center gap-1.5 text-[var(--status-income)] font-extrabold">
                <ArrowDownRight className="h-3.5 w-3.5" />
                {t('reports.income', 'Pemasukan')} ({incomePercent}%)
              </span>
              <span className="flex items-center gap-1.5 text-[var(--status-expense)] font-extrabold">
                {t('reports.expense', 'Pengeluaran')} ({expensePercent}%)
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full bg-[var(--status-income)] transition-all duration-500"
                style={{ width: `${incomePercent}%` }}
              />
              <div
                className="h-full bg-[var(--status-expense)] transition-all duration-500"
                style={{ width: `${expensePercent}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)]/50 px-3 py-2 text-xs font-medium text-[var(--muted)]">
            <span>{t('reports.noTransactionsPeriod', 'Belum ada transaksi pada periode ini')}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">0 Transaksi</span>
          </div>
        )}
      </div>

      {/* Two Column Inflow vs Outflow Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        {/* Income Card */}
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--status-income)_25%,var(--border))] bg-[var(--field-bg)]/80 p-3.5 sm:p-4 shadow-2xs transition hover:border-[var(--status-income)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-[var(--muted)] truncate">
              {t('reports.income', 'Pemasukan')}
            </span>
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/20">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className="mt-2 text-base sm:text-xl font-black tracking-tight text-[var(--status-income)] truncate"
            title={formatCurrency(income, defaultCurrency)}
          >
            {formatCurrency(income, defaultCurrency)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--muted)] truncate">
            <span className="font-extrabold text-[var(--fg)]">{incomeDelta}</span> {t('reports.vsPrev', 'vs bulan lalu')}
          </p>
        </div>

        {/* Expense Card */}
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--status-expense)_25%,var(--border))] bg-[var(--field-bg)]/80 p-3.5 sm:p-4 shadow-2xs transition hover:border-[var(--status-expense)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-[var(--muted)] truncate">
              {t('reports.expense', 'Pengeluaran')}
            </span>
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--status-expense-soft)] text-[var(--status-expense)] border border-[var(--status-expense)]/20">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className="mt-2 text-base sm:text-xl font-black tracking-tight text-[var(--status-expense)] truncate"
            title={formatCurrency(expense, defaultCurrency)}
          >
            {formatCurrency(expense, defaultCurrency)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--muted)] truncate">
            <span className="font-extrabold text-[var(--fg)]">{expenseDelta}</span> {t('reports.vsPrev', 'vs bulan lalu')}
          </p>
        </div>
      </div>
    </section>
  )
}
