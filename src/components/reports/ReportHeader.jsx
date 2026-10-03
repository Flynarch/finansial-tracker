import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { Printer, Sparkles, FileSpreadsheet, Check, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import useChatStore from '../../store/useChatStore'
import { formatCurrency } from '../../lib/utils'
import { triggerHaptic } from '../../lib/haptics'

const RANGE_OPTIONS = [
  { id: 1, label: '1M' },
  { id: 3, label: '3M' },
  { id: 6, label: '6M' },
  { id: 'ytd', label: 'YTD' },
  { id: 12, label: '1Y' },
]

export default function ReportHeader({
  rangeMonths,
  setRangeMonths,
  monthlyIncomeExpense,
  onExportCsv,
  onPrintReport,
  anchorDate,
  setAnchorDate,
  periodSummary,
  selectedMonthKey = null,
  selectedMonthData = null,
}) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [csvExported, setCsvExported] = useState(false)

  const anchor = anchorDate || new Date()
  const isCurrentMonth = isSameMonth(anchor, new Date())
  const dateLocale = locale === 'en' ? enUS : idLocale
  const formattedAnchorMonth = format(anchor, 'MMMM yyyy', { locale: dateLocale })

  const handlePrevMonth = () => {
    triggerHaptic('light')
    if (setAnchorDate) {
      setAnchorDate((prev) => subMonths(startOfMonth(prev || new Date()), 1))
    }
  }

  const handleNextMonth = () => {
    if (isCurrentMonth) return
    triggerHaptic('light')
    if (setAnchorDate) {
      setAnchorDate((prev) => addMonths(startOfMonth(prev || new Date()), 1))
    }
  }

  const handleResetToCurrentMonth = () => {
    triggerHaptic('light')
    if (setAnchorDate) {
      setAnchorDate(new Date())
    }
  }

  const handleOpenAiChat = () => {
    triggerHaptic('medium')
    const isDrilldown = Boolean(selectedMonthKey && selectedMonthData?.current)
    const isMultiMonth = (rangeMonths === 'ytd' || Number(rangeMonths) > 1) && !isDrilldown
    const periodLabel = rangeMonths === 'ytd'
      ? (locale === 'en' ? 'Year-to-Date (YTD)' : 'Tahun Berjalan (YTD)')
      : `${rangeMonths} ${locale === 'en' ? 'Months' : 'Bulan'}`

    let promptText
    if (isDrilldown) {
      const currentMonthData = selectedMonthData.current
      const incFormatted = formatCurrency(currentMonthData.income, defaultCurrency)
      const expFormatted = formatCurrency(currentMonthData.expense, defaultCurrency)
      const netSavings = currentMonthData.income - currentMonthData.expense
      const netSavingsFormatted = formatCurrency(netSavings, defaultCurrency)
      const monthName = currentMonthData.month || selectedMonthKey

      promptText = locale === 'en'
        ? `Please analyze my financial report for ${monthName}. Total income is ${incFormatted} and total expense is ${expFormatted} with net savings of ${netSavingsFormatted}. What are your key insights and saving recommendations?`
        : `Tolong analisis laporan keuangan saya untuk bulan ${monthName}. Total pemasukan ${incFormatted} dan total pengeluaran ${expFormatted} dengan surplus bersih ${netSavingsFormatted}. Apa saran optimasi dan penghematan untuk bulan ini?`
    } else if (isMultiMonth && periodSummary) {
      const incFormatted = formatCurrency(periodSummary.totalIncome, defaultCurrency)
      const expFormatted = formatCurrency(periodSummary.totalExpense, defaultCurrency)
      const avgIncFormatted = formatCurrency(periodSummary.avgIncome, defaultCurrency)
      const avgExpFormatted = formatCurrency(periodSummary.avgExpense, defaultCurrency)
      const netSavingsFormatted = formatCurrency(periodSummary.totalNetSavings, defaultCurrency)

      promptText = locale === 'en'
        ? `Please analyze my financial report (${periodLabel} period). Total income is ${incFormatted} (avg ${avgIncFormatted}/mo) and total expense is ${expFormatted} (avg ${avgExpFormatted}/mo) with net savings of ${netSavingsFormatted} (${periodSummary.periodSavingsRate}% savings rate). What are your key insights and saving recommendations?`
        : `Tolong analisis laporan keuangan saya (rentang ${periodLabel}). Total pemasukan ${incFormatted} (rata-rata ${avgIncFormatted}/bln) dan total pengeluaran ${expFormatted} (rata-rata ${avgExpFormatted}/bln) dengan surplus bersih ${netSavingsFormatted} (tingkat tabungan ${periodSummary.periodSavingsRate}%). Apa saran penghematan dan optimasi terbaik untuk saya?`
    } else {
      const latestData = monthlyIncomeExpense?.at(-1) || { income: 0, expense: 0, month: '' }
      const incFormatted = formatCurrency(latestData.income, defaultCurrency)
      const expFormatted = formatCurrency(latestData.expense, defaultCurrency)

      promptText = locale === 'en'
        ? `Please analyze my financial report (1-month period). This month income is ${incFormatted} and expense is ${expFormatted}. What are your key insights and saving recommendations?`
        : `Tolong analisis laporan keuangan saya (rentang 1 bulan). Bulan ini pemasukan ${incFormatted} dan pengeluaran ${expFormatted}. Apa saran penghematan dan optimasi terbaik untuk saya?`
    }

    useChatStore.getState().openWithPrompt(promptText)
    navigate('/ai-chat')
  }

  const handleCsvClick = () => {
    triggerHaptic('medium')
    if (onExportCsv) {
      const ok = onExportCsv()
      if (ok) {
        setCsvExported(true)
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: t('reports.csvExportSuccess', 'Ekspor CSV Berhasil'),
              message: t('reports.csvExportSuccessDesc', 'Laporan data transaksi berhasil diunduh.'),
              type: 'success',
            },
          })
        )
        setTimeout(() => setCsvExported(false), 2500)
      } else {
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: t('reports.csvExportEmpty', 'Tidak Ada Transaksi'),
              message: t('reports.csvExportEmptyDesc', 'Tidak ada data transaksi pada rentang waktu ini untuk diekspor.'),
              type: 'warning',
            },
          })
        )
      }
    }
  }

  const handlePrintClick = () => {
    triggerHaptic('light')
    if (onPrintReport) {
      onPrintReport()
    } else {
      window.print()
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {/* Top Row: Title + Action Pill Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--fg)]">
            {t('reports.title', 'Laporan Finansial')}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm font-medium text-[var(--muted)]">
            {t('reports.subtitle', 'Performa bulanan, arus kas, dan komposisi kekayaan bersih')}
          </p>
        </div>

        {/* Action Buttons Bar with Unified Outlined Pill Styling */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* CSV Export */}
          <button
            type="button"
            onClick={handleCsvClick}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] shadow-2xs transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer"
            title={t('reports.csvTitle', 'Ekspor Laporan Transaksi ke CSV/Excel')}
          >
            {csvExported ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--muted)]" />
            )}
            <span>{csvExported ? t('reports.csvDownloaded', 'Diunduh') : 'CSV'}</span>
          </button>

          {/* AI Advisor Button */}
          <button
            type="button"
            onClick={handleOpenAiChat}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] shadow-2xs transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer"
            title={t('reports.aiTitle', 'Analisis Laporan dengan AI')}
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>AI Advisor</span>
          </button>

          {/* PDF / Print Statement */}
          <button
            type="button"
            onClick={handlePrintClick}
            className="no-print inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] shadow-2xs transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer"
            title={t('reports.pdfTitle', 'Cetak Laporan / Simpan PDF')}
          >
            <Printer className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Month Anchor Navigation & Horizon Selector */}
      <div className="no-print mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--border)]/60 pt-3">
        {/* Month Stepper Navigator */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] shadow-2xs transition hover:bg-[var(--panel)] active:scale-90 cursor-pointer"
            title={t('reports.prevMonth', 'Bulan Sebelumnya')}
            aria-label={t('reports.prevMonth', 'Bulan Sebelumnya')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 px-1.5">
            <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="text-xs sm:text-sm font-black text-[var(--fg)] capitalize">
              {formattedAnchorMonth}
            </span>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={handleResetToCurrentMonth}
                className="ml-1 rounded-md bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition cursor-pointer"
              >
                {t('reports.today', 'Hari Ini')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className={`grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] shadow-2xs transition ${
              isCurrentMonth
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-[var(--panel)] active:scale-90 cursor-pointer'
            }`}
            title={t('reports.nextMonth', 'Bulan Berikutnya')}
            aria-label={t('reports.nextMonth', 'Bulan Berikutnya')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Horizon Selector (1M / 3M / 6M / YTD / 1Y) */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
            {t('reports.timeHorizon', 'Rentang')}:
          </span>
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1 shadow-2xs overflow-x-auto max-w-full">
            {RANGE_OPTIONS.map((opt) => {
              const isSelected = rangeMonths === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light')
                    setRangeMonths(opt.id)
                  }}
                  className={`rounded-lg px-2.5 sm:px-3 py-1 text-xs font-black transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs ring-1 ring-[var(--border)]'
                      : 'text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
