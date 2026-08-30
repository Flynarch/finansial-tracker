import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, Sparkles, FileSpreadsheet, Check } from 'lucide-react'
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
}) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [csvExported, setCsvExported] = useState(false)

  const handleOpenAiChat = () => {
    triggerHaptic('medium')
    const latestData = monthlyIncomeExpense?.at(-1) || { income: 0, expense: 0, month: '' }

    const promptText = locale === 'en'
      ? `Please analyze my financial report (${rangeMonths} period). This month income is ${formatCurrency(latestData.income, defaultCurrency)} and expense is ${formatCurrency(latestData.expense, defaultCurrency)}. What are your key insights and saving recommendations?`
      : `Tolong analisis laporan keuangan saya (rentang ${rangeMonths}). Bulan ini pemasukan ${formatCurrency(latestData.income, defaultCurrency)} dan pengeluaran ${formatCurrency(latestData.expense, defaultCurrency)}. Apa saran penghematan dan optimasi terbaik untuk saya?`

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
            <span>{csvExported ? 'Diunduh' : 'CSV'}</span>
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

      {/* Horizon Horizon Selector (1M / 3M / 6M / YTD / 1Y) */}
      <div className="no-print mt-4 flex items-center justify-between border-t border-[var(--border)]/60 pt-3">
        <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
          {t('reports.timeHorizon', 'Rentang Waktu')}:
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
                className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-black transition cursor-pointer shrink-0 ${
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
    </section>
  )
}
