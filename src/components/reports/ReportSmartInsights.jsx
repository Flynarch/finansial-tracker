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
}) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

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
    const incomeFormatted = formatCurrency(toSafeNumber(thisMonthIncome), defaultCurrency)
    const expenseFormatted = formatCurrency(toSafeNumber(thisMonthExpense), defaultCurrency)
    const burnRateFormatted = formatCurrency(toSafeNumber(dailyBurnRate), defaultCurrency)

    const systemPromptContext = `[KONTEKS ANALISIS KEUANGAN FINTRACK]:
- Pemasukan Periode Ini: ${incomeFormatted}
- Pengeluaran Periode Ini: ${expenseFormatted}
- Pos Belanja Dominan: ${hasExpense ? `${topCategory?.label || 'Umum'} (${topCategoryPct}%)` : 'Belum Ada'}
- Rata-rata Belanja Harian: ${burnRateFormatted}/hari
- Tren vs Rata-rata: ${hasHistory ? `${diffPercent >= 0 ? '+' : ''}${diffPercent}%` : 'Belum ada data historis'}`

    store.addMessage({
      id: Date.now(),
      role: 'system',
      type: 'hidden',
      content: systemPromptContext,
    })

    const promptText = locale === 'en'
      ? hasExpense
        ? `Please give me smart financial advice based on my current report: Top category is ${topCategory?.label || 'General'} (${topCategoryPct}% of spend), daily burn rate is ${burnRateFormatted}, and this month is ${diffPercent >= 0 ? '+' : ''}${diffPercent}% vs average.`
        : 'I currently have no transactions logged for this period. How can I start setting up a healthy monthly budget and financial goals?'
      : hasExpense
        ? `Tolong berikan rekomendasi finansial cerdas berdasarkan laporan terkini: Pos belanja terbesar adalah ${topCategory?.label || 'Umum'} (${topCategoryPct}% pengeluaran), rata-rata pengeluaran harian ${burnRateFormatted}, dan pengeluaran bulan ini ${diffPercent >= 0 ? '+' : ''}${diffPercent}% dibanding rata-rata.`
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
                !hasHistory
                  ? 'bg-[var(--panel-strong)] text-[var(--muted)] border border-[var(--border)]'
                  : isLower
                    ? 'bg-[var(--status-income-soft)] text-[var(--status-income)] border border-[var(--status-income)]/20'
                    : isHigher
                      ? 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border border-[var(--status-expense)]/20'
                      : 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[var(--status-warning)]/20'
              }`}
            >
              {!hasHistory ? (
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
                !hasHistory
                  ? 'text-[var(--muted)]'
                  : isLower
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isHigher
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[var(--fg)]'
              }`}
            >
              {!hasHistory ? '—' : diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)] truncate">
              {!hasHistory
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
