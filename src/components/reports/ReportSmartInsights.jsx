import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, TrendingDown, TrendingUp, Minus, CalendarClock, Tag, ArrowRight } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import useChatStore from '../../store/useChatStore'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import { calculateSpendingTrend } from '../../lib/reportAnalytics'
import { triggerHaptic } from '../../lib/haptics'

export default function ReportSmartInsights({
  topCategory,
  totalExpense,
  dailyBurnRate,
  thisMonthExpense,
  averageMonthlyExpense,
  thisMonthIncome,
  periodSummary,
  rangeMonths = 6,
  selectedMonthKey = null,
  anchorDate = null,
}) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const isCurrentMonthAnchor = useMemo(() => {
    const now = new Date()
    const anchor = anchorDate || now
    return (
      anchor.getFullYear() === now.getFullYear() &&
      anchor.getMonth() === now.getMonth()
    )
  }, [anchorDate])

  const isEarlyMonth = isCurrentMonthAnchor && new Date().getDate() <= 3
  const isEarlyMonthDistorted =
    isEarlyMonth &&
    (toSafeNumber(thisMonthExpense) === 0 ||
      (toSafeNumber(averageMonthlyExpense) > 0 &&
        toSafeNumber(thisMonthExpense) < toSafeNumber(averageMonthlyExpense) * 0.2))

  const isEarlyMonthZeroExpense =
    toSafeNumber(thisMonthExpense) === 0 &&
    (isCurrentMonthAnchor || toSafeNumber(averageMonthlyExpense) > 0)

  const hasExpense = toSafeNumber(totalExpense) > 0
  const topCategoryVal = toSafeNumber(topCategory?.value)
  const topCategoryPct = hasExpense && topCategoryVal > 0
    ? Math.round((topCategoryVal / toSafeNumber(totalExpense)) * 100)
    : 0

  const { diffPercent, isLower, isHigher, hasHistory } = calculateSpendingTrend(
    thisMonthExpense,
    averageMonthlyExpense
  )

  const handleOpenAiAdvisor = () => {
    triggerHaptic('light')
    const store = useChatStore.getState()
    const isMultiMonth = (rangeMonths === 'ytd' || Number(rangeMonths) > 1) && !selectedMonthKey
    const periodLabel = rangeMonths === 'ytd'
      ? (locale === 'en' ? 'Year-to-Date (YTD)' : 'Tahun Berjalan (YTD)')
      : `${rangeMonths} ${locale === 'en' ? 'Months' : 'Bulan'}`

    const incVal = isMultiMonth ? toSafeNumber(periodSummary?.totalIncome) : toSafeNumber(thisMonthIncome)
    const expVal = isMultiMonth ? toSafeNumber(periodSummary?.totalExpense) : toSafeNumber(thisMonthExpense)
    const incomeFormatted = formatCurrency(incVal, defaultCurrency)
    const expenseFormatted = formatCurrency(expVal, defaultCurrency)
    const burnRateFormatted = formatCurrency(toSafeNumber(dailyBurnRate), defaultCurrency)

    const trendStatus = isEarlyMonthDistorted || isEarlyMonthZeroExpense
      ? (locale === 'en' ? 'Early in the month, spending trend not yet established' : 'Awal bulan, tren belanja belum stabil')
      : hasHistory
        ? `${diffPercent >= 0 ? '+' : ''}${diffPercent}% vs rata-rata`
        : 'Belum ada data historis'

    const systemPromptContext = `[KONTEKS ANALISIS KEUANGAN FINTRACK]:
- Rentang Waktu: ${periodLabel}
- Pemasukan Periode Ini: ${incomeFormatted}${isMultiMonth && periodSummary?.avgIncome ? ` (Rata-rata: ${formatCurrency(periodSummary.avgIncome, defaultCurrency)}/bln)` : ''}
- Pengeluaran Periode Ini: ${expenseFormatted}${isMultiMonth && periodSummary?.avgExpense ? ` (Rata-rata: ${formatCurrency(periodSummary.avgExpense, defaultCurrency)}/bln)` : ''}
- Pos Belanja Dominan: ${hasExpense ? `${topCategory?.label || 'Umum'} (${topCategoryPct}%)` : 'Belum Ada'}
- Rata-rata Belanja Harian: ${burnRateFormatted}/hari
- Tren vs Rata-rata: ${trendStatus}`

    store.addMessage({
      id: Date.now(),
      role: 'system',
      type: 'hidden',
      content: systemPromptContext,
    })

    const hasAnyPeriodData = Boolean((periodSummary?.periodTxCount > 0) || incVal > 0 || expVal > 0)

    const promptText = locale === 'en'
      ? hasAnyPeriodData
        ? `Please give me smart financial advice based on my financial report (${periodLabel}): Total income is ${incomeFormatted}, total expense is ${expenseFormatted}, top category is ${topCategory?.label || 'General'} (${topCategoryPct}% of spend), and daily burn rate is ${burnRateFormatted}. What are your key insights and saving recommendations?`
        : 'I currently have no transactions logged for this period. How can I start setting up a healthy monthly budget and financial goals?'
      : hasAnyPeriodData
        ? `Tolong berikan rekomendasi finansial cerdas berdasarkan laporan keuangan saya (${periodLabel}): Total pemasukan ${incomeFormatted}, total pengeluaran ${expenseFormatted}, pos belanja terbesar adalah ${topCategory?.label || 'Umum'} (${topCategoryPct}% pengeluaran), dan rata-rata belanja harian ${burnRateFormatted}. Apa saran penghematan dan optimasi terbaik untuk saya?`
        : 'Saat ini belum ada transaksi tercatat pada periode ini. Bagaimana panduan awal untuk menyusun anggaran bulanan dan target tabungan yang sehat?'

    store.openWithPrompt(promptText)
    navigate('/ai-chat')
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
              {t('reports.smartInsights', 'Wawasan Finansial Cerdas')}
            </h3>
            <p className="text-[11px] font-medium text-[var(--muted)]">
              {t('reports.smartInsightsSubtitle', 'Ringkasan performa & sorotan data')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAiAdvisor}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-black text-[var(--fg)] transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer shadow-2xs"
        >
          <span>{t('reports.consultAiCta', 'Tanya AI')}</span>
          <ArrowRight className="h-3.5 w-3.5 text-[var(--accent)]" />
        </button>
      </div>

      {/* Grid of 3 Insight Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* 1. Dominant Spending Category */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border)]/70 bg-[var(--field-bg)]/80 p-3.5 shadow-2xs transition hover:border-[var(--border-strong)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('reports.topCategoryInsight', 'Kategori Terbesar')}
            </span>
            <div className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--panel-strong)] text-[var(--muted)] border border-[var(--border)]">
              <Tag className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm font-black text-[var(--fg)] truncate">
              {hasExpense ? topCategory?.label || '—' : '—'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)] truncate">
              {hasExpense
                ? t('reports.topCategoryDesc', { category: topCategory?.label, percent: topCategoryPct })
                : t('reports.noExpenseYet', 'Belum ada pengeluaran.')}
            </p>
          </div>
        </div>

        {/* 2. Daily Pace */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border)]/70 bg-[var(--field-bg)]/80 p-3.5 shadow-2xs transition hover:border-[var(--border-strong)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('reports.burnRate', 'Rata-rata Harian')}
            </span>
            <div className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--panel-strong)] text-[var(--muted)] border border-[var(--border)]">
              <CalendarClock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm font-black tabular-nums text-[var(--fg)] truncate">
              {formatCurrency(dailyBurnRate, defaultCurrency)}
              <span className="text-[11px] font-medium text-[var(--muted)]"> /hari</span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)] truncate">
              {hasExpense
                ? t('reports.burnRateDesc', 'Kecepatan belanja harian periode ini')
                : t('reports.noExpenseYet', 'Belum ada pengeluaran.')}
            </p>
          </div>
        </div>

        {/* 3. Spending Trend vs Average */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border)]/70 bg-[var(--field-bg)]/80 p-3.5 shadow-2xs transition hover:border-[var(--border-strong)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('reports.monthlyTrendInsight', 'Tren vs Rata-rata')}
            </span>
            <div
              className={`grid h-6 w-6 place-items-center rounded-lg ${
                isEarlyMonthDistorted || isEarlyMonthZeroExpense || !hasHistory
                  ? 'bg-[var(--panel-strong)] text-[var(--muted)] border border-[var(--border)]'
                  : isLower
                    ? 'bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/20'
                    : isHigher
                      ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border border-[var(--status-expense)]/20'
                      : 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[var(--status-warning)]/20'
              }`}
            >
              {isEarlyMonthDistorted || isEarlyMonthZeroExpense || !hasHistory ? (
                <Minus className="h-3.5 w-3.5" />
              ) : isLower ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : isHigher ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
          <div className="mt-2">
            <p
              className={`text-sm font-black tabular-nums truncate ${
                isEarlyMonthDistorted || isEarlyMonthZeroExpense || !hasHistory
                  ? 'text-[var(--muted)]'
                  : isLower
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isHigher
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[var(--fg)]'
              }`}
            >
              {isEarlyMonthDistorted || isEarlyMonthZeroExpense || !hasHistory ? '—' : diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)] truncate">
              {isEarlyMonthZeroExpense
                ? t('reports.earlyMonthNoExpense', 'Awal bulan berjalan, belum ada pengeluaran')
                : isEarlyMonthDistorted
                  ? t('reports.earlyMonthStabilizing', 'Awal bulan berjalan, tren belanja belum stabil')
                  : !hasHistory
                    ? t('reports.noTrendComparison', 'Belum ada data pembanding')
                    : isLower
                      ? t('reports.spendingLower', { percent: Math.abs(diffPercent) })
                      : isHigher
                        ? t('reports.spendingHigher', { percent: diffPercent })
                        : t('reports.spendingNormal', 'Selaras dengan rata-rata')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
