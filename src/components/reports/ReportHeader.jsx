import { useState } from 'react'
import { Printer, Sparkles, FileSpreadsheet, Check } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import useChatStore from '../../store/useChatStore'
import { formatCurrency } from '../../lib/utils'
import { triggerHaptic } from '../../lib/haptics'

const RANGE_OPTIONS = [
  { id: 3, label: '3M' },
  { id: 6, label: '6M' },
  { id: 12, label: '12M' },
]

export default function ReportHeader({
  rangeMonths,
  setRangeMonths,
  monthlyIncomeExpense,
  onExportCsv,
  onPrintReport,
}) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [csvExported, setCsvExported] = useState(false)

  const handleOpenAiChat = () => {
    triggerHaptic('light')
    const store = useChatStore.getState()
    const latestData = monthlyIncomeExpense?.at(-1) || { income: 0, expense: 0, month: '' }
    const prevData = monthlyIncomeExpense?.at(-2) || { income: 0, expense: 0, month: '' }

    store.addMessage({
      id: Date.now(),
      role: 'system',
      type: 'hidden',
      content: `[KONTEKS LAPORAN FINANSIAL: User sedang melihat Laporan Finansial rentang ${rangeMonths} bulan.\n` +
        `- Bulan ini (${latestData.month}): Pemasukan ${formatCurrency(latestData.income, defaultCurrency)}, Pengeluaran ${formatCurrency(latestData.expense, defaultCurrency)}\n` +
        `- Bulan lalu (${prevData.month}): Pemasukan ${formatCurrency(prevData.income, defaultCurrency)}, Pengeluaran ${formatCurrency(prevData.expense, defaultCurrency)}\n` +
        `Bantu berikan analisis mendalam, perbandingan, dan saran penghematan konkret!]`,
    })

    const promptText = locale === 'en'
      ? 'Please analyze my financial report for this month. What can I optimize or save more on?'
      : 'Tolong analisis laporan keuangan saya bulan ini. Apa yang bisa saya optimalkan atau hemat lagi?'

    store.openWithPrompt(promptText)
  }

  const handleCsvClick = () => {
    triggerHaptic('medium')
    if (onExportCsv) {
      const ok = onExportCsv()
      if (ok) {
        setCsvExported(true)
        setTimeout(() => setCsvExported(false), 2000)
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
    <section className="relative overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 120% 120% at 10% -20%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative p-4 sm:p-5">
        {/* Top Row: Title + Action Buttons */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl">{t('reports.title')}</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--muted)] line-clamp-2">{t('reports.subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* CSV Export Button */}
            <button
              type="button"
              onClick={handleCsvClick}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--fg)] shadow-xs transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer"
              title={t('reports.csvTitle', 'Ekspor Laporan Transaksi ke CSV/Excel')}
            >
              {csvExported ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span>{csvExported ? 'Unduh...' : 'CSV'}</span>
            </button>

            {/* AI Analysis Button */}
            <button
              type="button"
              onClick={handleOpenAiChat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel-strong))] px-2.5 py-1.5 text-xs font-bold text-[var(--accent)] shadow-xs transition hover:bg-[color-mix(in_srgb,var(--accent)_20%,var(--panel-strong))] active:scale-95 cursor-pointer"
              title={t('reports.aiTitle', 'Analisis Laporan dengan AI')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI</span>
            </button>

            {/* PDF / Print Export */}
            <button
              type="button"
              onClick={handlePrintClick}
              className="no-print inline-flex items-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--fg)] shadow-xs transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer"
              title={t('reports.pdfTitle', 'Cetak Laporan / Simpan PDF')}
            >
              <Printer className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Range Picker -- inline row below subtitle */}
        <div className="no-print mt-3 inline-flex rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-1 backdrop-blur-md">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setRangeMonths(opt.id)
              }}
              className={`rounded-[0.625rem] px-3.5 py-1.5 text-xs font-bold tracking-wide transition cursor-pointer ${
                rangeMonths === opt.id
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
