import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import {
  Download,
  Share2,
  Printer,
  ShieldCheck,
  Table,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { triggerHaptic } from '../../lib/haptics'
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateCashFlowStatement,
  calculateSha256Checksum,
  filterTransactionsByDateRange,
} from '../../lib/accountingEngine'
import { downloadExecutiveReportPdf, shareExecutiveReportPdf } from '../../lib/pdfReportGenerator'
import { warmupDecryptionCache, getDecryptedNoteSync, isFieldEncrypted } from '../../lib/fieldEncryption'
import { exportTransactionsToCsv } from '../../lib/exportReports'
import { getAllWalletBalances } from '../../lib/balanceEngine'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'

const TABS = [
  { id: 'summary', labelId: 'reports.tabSummary', fallback: 'Ringkasan KPI' },
  { id: 'income', labelId: 'reports.tabIncome', fallback: 'Laba Rugi' },
  { id: 'balance', labelId: 'reports.tabBalance', fallback: 'Neraca' },
  { id: 'cashflow', labelId: 'reports.tabCashFlow', fallback: 'Arus Kas' },
  { id: 'ledger', labelId: 'reports.tabLedger', fallback: 'Buku Besar' },
]

export default function ReportStatementModal({
  isOpen,
  onClose,
  transactions: propTransactions,
  wallets: propWallets = [],
  savings = [],
  loans = [],
  investments = [],
  rates = {},
}) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const profileName = useSettingsStore((state) => state.profileName) || 'Pengguna FinTrack'

  const [activeTab, setActiveTab] = useState('summary')
  const [periodType, setPeriodType] = useState('this_month')
  const [customStartDate, setCustomStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customEndDate, setCustomEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isSharingPdf, setIsSharingPdf] = useState(false)
  const [checksum, setChecksum] = useState('')

  // Resolve Date Range based on selected Period Preset
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date()
    const curYear = now.getFullYear()
    const isEn = String(locale || '').toLowerCase().startsWith('en')

    switch (periodType) {
      case 'this_month':
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
          periodLabel: format(now, 'MMMM yyyy', { locale: isEn ? enUS : idLocale }),
        }
      case 'last_month': {
        const lastM = subMonths(startOfMonth(now), 1)
        return {
          startDate: format(startOfMonth(lastM), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(lastM), 'yyyy-MM-dd'),
          periodLabel: format(lastM, 'MMMM yyyy', { locale: isEn ? enUS : idLocale }),
        }
      }
      case 'q1':
        return {
          startDate: `${curYear}-01-01`,
          endDate: `${curYear}-03-31`,
          periodLabel: isEn ? `Quarter 1 (Jan - Mar ${curYear})` : `Kuartal 1 (Jan - Mar ${curYear})`,
        }
      case 'q2':
        return {
          startDate: `${curYear}-04-01`,
          endDate: `${curYear}-06-30`,
          periodLabel: isEn ? `Quarter 2 (Apr - Jun ${curYear})` : `Kuartal 2 (Apr - Jun ${curYear})`,
        }
      case 'q3':
        return {
          startDate: `${curYear}-07-01`,
          endDate: `${curYear}-09-30`,
          periodLabel: isEn ? `Quarter 3 (Jul - Sep ${curYear})` : `Kuartal 3 (Jul - Sep ${curYear})`,
        }
      case 'q4':
        return {
          startDate: `${curYear}-10-01`,
          endDate: `${curYear}-12-31`,
          periodLabel: isEn ? `Quarter 4 (Oct - Dec ${curYear})` : `Kuartal 4 (Okt - Des ${curYear})`,
        }
      case 'ytd':
        return {
          startDate: `${curYear}-01-01`,
          endDate: format(now, 'yyyy-MM-dd'),
          periodLabel: isEn ? `Year-to-Date (YTD ${curYear})` : `Tahun Berjalan (YTD ${curYear})`,
        }
      case 'full_year':
        return {
          startDate: `${curYear}-01-01`,
          endDate: `${curYear}-12-31`,
          periodLabel: isEn ? `Full Year ${curYear}` : `Tahun Penuh ${curYear}`,
        }
      case 'last_year': {
        const prevY = curYear - 1
        return {
          startDate: `${prevY}-01-01`,
          endDate: `${prevY}-12-31`,
          periodLabel: isEn ? `Year ${prevY}` : `Tahun ${prevY}`,
        }
      }
      case 'custom':
      default:
        return {
          startDate: customStartDate,
          endDate: customEndDate,
          periodLabel: isEn ? `${customStartDate} to ${customEndDate}` : `${customStartDate} s/d ${customEndDate}`,
        }
    }
  }, [periodType, customStartDate, customEndDate, locale])

  const queriedTransactions = useLiveQuery(
    async () => {
      if (!isOpen || (Array.isArray(propTransactions) && propTransactions.length > 0)) return []
      if (!startDate || !endDate) return []
      const list = await db.transactions.where('date').between(startDate, `${endDate}\uffff`, true, true).toArray()
      return (list || []).filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1)
    },
    [isOpen, startDate, endDate, propTransactions],
    []
  )

  const transactions = useMemo(() => {
    if (Array.isArray(propTransactions) && propTransactions.length > 0) {
      return propTransactions.filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1)
    }
    return queriedTransactions || []
  }, [propTransactions, queriedTransactions])

  const queriedWallets = useLiveQuery(
    async () => {
      if (!isOpen || (Array.isArray(propWallets) && propWallets.length > 0)) return []
      const raw = await db.wallets.toArray()
      if (!raw || raw.length === 0) return []
      return await getAllWalletBalances(raw, rates)
    },
    [isOpen, propWallets, rates],
    []
  )

  const wallets = useMemo(() => {
    if (Array.isArray(propWallets) && propWallets.length > 0) return propWallets
    return queriedWallets || []
  }, [propWallets, queriedWallets])

  const postDateTransactions = useLiveQuery(
    async () => {
      if (!isOpen || !endDate) return []
      const list = await db.transactions.where('date').above(endDate).toArray()
      return (list || []).filter((tx) => !tx.deletedAt)
    },
    [isOpen, endDate],
    []
  )

  const loanPayments = useLiveQuery(
    async () => {
      if (!isOpen) return []
      return await db.loanPayments.toArray()
    },
    [isOpen],
    []
  )

  const investmentOrders = useLiveQuery(
    async () => {
      if (!isOpen) return []
      return await db.investmentOrders.toArray()
    },
    [isOpen],
    []
  )

  // Compute Statements
  const incomeStatement = useMemo(() => {
    if (!isOpen) return { totalIncome: 0, totalExpense: 0, netIncome: 0, revenueLines: [], expenseLines: [], totalOperatingProfit: 0 }
    return generateIncomeStatement(transactions, {
      startDate,
      endDate,
      defaultCurrency,
      rates,
    })
  }, [isOpen, transactions, startDate, endDate, defaultCurrency, rates])

  const balanceSheet = useMemo(() => {
    if (!isOpen) return { assets: { liquidCash: 0, savingsGoals: 0, otherAssets: 0, totalAssets: 0 }, liabilities: { shortTermDebt: 0, total: 0 }, equity: { netWorth: 0, totalEquity: 0 }, isBalanced: true }
    const combinedTxs = [...(transactions || []), ...(postDateTransactions || [])]
    return generateBalanceSheet(wallets, savings, loans, {
      asOfDate: endDate,
      defaultCurrency,
      rates,
      transactions: combinedTxs,
      loanPayments: loanPayments || [],
      investments,
      investmentOrders: investmentOrders || [],
    })
  }, [isOpen, wallets, savings, loans, investments, investmentOrders, endDate, defaultCurrency, rates, transactions, postDateTransactions, loanPayments])

  const cashFlowStatement = useMemo(() => {
    if (!isOpen) return { operating: { net: 0 }, investing: { net: 0 }, financing: { net: 0 }, netChangeInCash: 0 }
    return generateCashFlowStatement(transactions, {
      startDate,
      endDate,
      defaultCurrency,
      rates,
    })
  }, [isOpen, transactions, startDate, endDate, defaultCurrency, rates])

  const filteredTxs = useMemo(() => {
    if (!isOpen) return []
    return filterTransactionsByDateRange(transactions, startDate, endDate)
      .filter((tx) => tx.isPendingReview !== true && tx.isPendingReview !== 1)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [isOpen, transactions, startDate, endDate])

  useEffect(() => {
    if (filteredTxs && filteredTxs.length > 0) {
      warmupDecryptionCache(filteredTxs)
    }
  }, [filteredTxs])

  const [, setDecryptedTick] = useState(0)
  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((t) => t + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  // Calculate live SHA-256 Checksum on data changes
  useEffect(() => {
    if (!isOpen) return
    let active = true
    const updateHash = async () => {
      const payload = JSON.stringify({
        profileName,
        periodLabel,
        netIncome: incomeStatement.netIncome,
        totalAssets: balanceSheet?.assets?.totalAssets,
        totalLiabilities: balanceSheet?.liabilities?.total,
        netChangeInCash: cashFlowStatement?.netChangeInCash,
      })
      const hash = await calculateSha256Checksum(payload)
      if (active) setChecksum(hash)
    }
    updateHash()
    return () => {
      active = false
    }
  }, [isOpen, profileName, periodLabel, incomeStatement, balanceSheet, cashFlowStatement])

  const handleDownloadPdf = async () => {
    triggerHaptic('selection')
    setIsExportingPdf(true)
    try {
      await downloadExecutiveReportPdf({
        incomeStatement,
        balanceSheet,
        cashFlowStatement,
        periodName: periodLabel,
        profileName,
        currency: defaultCurrency,
        locale,
      })
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: t('reports.pdfExportSuccess', 'Laporan PDF Berhasil Dibuat'),
            message: t('reports.pdfExportSuccessDesc', 'Laporan keuangan eksekutif berhasil disimpan.'),
            type: 'success',
          },
        })
      )
    } catch (err) {
      console.error('PDF Export Error:', err)
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: t('reports.pdfExportError', 'Gagal Membuat Laporan PDF'),
            message: t('reports.pdfExportErrorDesc', 'Terjadi kesalahan saat memproses laporan PDF. Silakan coba lagi.'),
            type: 'error',
          },
        })
      )
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleSharePdf = async () => {
    triggerHaptic('selection')
    setIsSharingPdf(true)
    try {
      const res = await shareExecutiveReportPdf({
        incomeStatement,
        balanceSheet,
        cashFlowStatement,
        periodName: periodLabel,
        profileName,
        currency: defaultCurrency,
        locale,
      })
      if (res?.cancelled) {
        return
      }
    } catch (err) {
      console.error('PDF Share Error:', err)
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: t('reports.pdfShareError', 'Gagal Membagikan Laporan'),
            message: t('reports.pdfShareErrorDesc', 'Perangkat tidak mendukung pembagian berkas atau proses gagal.'),
            type: 'error',
          },
        })
      )
    } finally {
      setIsSharingPdf(false)
    }
  }

  const handleExportCsv = () => {
    triggerHaptic('light')
    const validTxs = (filteredTxs || []).filter((tx) => tx.isPendingReview !== true && tx.isPendingReview !== 1)
    exportTransactionsToCsv(validTxs, wallets, defaultCurrency, locale)
  }

  const handlePrint = () => {
    triggerHaptic('light')
    window.print()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('reports.executiveReportTitle', 'Laporan Akuntansi Eksekutif')}
      maxWidth="max-w-2xl"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Period Selector Header */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {t('reports.periodSelection', 'Pilihan Periode Akuntansi')}
              </span>
              <h4 className="text-sm font-black text-[var(--fg)]">{periodLabel}</h4>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className="ft-field text-xs font-bold py-1.5 px-3 rounded-xl bg-[var(--panel-strong)] border border-[var(--border)] text-[var(--fg)]"
              >
                <option value="this_month">{t('reports.periodThisMonth', 'Bulan Ini')}</option>
                <option value="last_month">{t('reports.periodLastMonth', 'Bulan Lalu')}</option>
                <option value="q1">{t('reports.periodQ1', 'Kuartal 1 (Jan - Mar)')}</option>
                <option value="q2">{t('reports.periodQ2', 'Kuartal 2 (Apr - Jun)')}</option>
                <option value="q3">{t('reports.periodQ3', 'Kuartal 3 (Jul - Sep)')}</option>
                <option value="q4">{t('reports.periodQ4', 'Kuartal 4 (Okt - Des)')}</option>
                <option value="ytd">{t('reports.periodYtd', 'Tahun Berjalan (YTD)')}</option>
                <option value="full_year">{t('reports.periodFullYear', '1 Tahun Penuh')}</option>
                <option value="last_year">{t('reports.periodLastYear', 'Tahun Lalu')}</option>
                <option value="custom">{t('reports.periodCustom', 'Kustom Tanggal')}</option>
              </select>
            </div>
          </div>

          {/* Custom Date Pickers */}
          {periodType === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]/60 animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--muted)] mb-1">
                  {t('reports.startDate', 'Dari Tanggal')}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="ft-field w-full text-xs py-1.5 px-2.5 rounded-xl bg-[var(--panel-strong)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--muted)] mb-1">
                  {t('reports.endDate', 'Sampai Tanggal')}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="ft-field w-full text-xs py-1.5 px-2.5 rounded-xl bg-[var(--panel-strong)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Interactive Tab Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 ft-hide-scrollbar border-b border-[var(--border)]/60">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light')
                  setActiveTab(tab.id)
                }}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]'
                }`}
              >
                {t(tab.labelId, tab.fallback)}
              </button>
            )
          })}
        </div>

        {/* TAB 1: SUMMARY KPI SCORECARD */}
        {activeTab === 'summary' && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <span className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  {t('reports.netIncome', 'Laba Bersih')}
                </span>
                <span
                  className={`block text-sm sm:text-base font-black mt-1 tabular-nums ${
                    incomeStatement.netIncome >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {formatCurrency(incomeStatement.netIncome, defaultCurrency)}
                </span>
                <span className="block text-[10.5px] text-[var(--muted)] mt-0.5">
                  Margin: {incomeStatement.netProfitMargin.toFixed(1)}%
                </span>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <span className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  {t('reports.netWorth', 'Kekayaan Bersih')}
                </span>
                <span className="block text-sm sm:text-base font-black text-[var(--fg)] mt-1 tabular-nums">
                  {formatCurrency(balanceSheet.equity.netWorth, defaultCurrency)}
                </span>
                <span className="block text-[10.5px] text-emerald-500 mt-0.5">
                  {balanceSheet.isBalanced ? t('reports.balanced', 'Neraca Seimbang') : t('reports.unbalanced', 'Periksa Data')}
                </span>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <span className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  {t('reports.totalAssets', 'Total Aset')}
                </span>
                <span className="block text-sm sm:text-base font-black text-[var(--fg)] mt-1 tabular-nums">
                  {formatCurrency(balanceSheet.assets.totalAssets, defaultCurrency)}
                </span>
                <span className="block text-[10.5px] text-[var(--muted)] mt-0.5">
                  Kas: {formatCurrency(balanceSheet.assets.currentAssets.total, defaultCurrency)}
                </span>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <span className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  {t('reports.totalLiabilities', 'Total Kewajiban')}
                </span>
                <span
                  className={`block text-sm sm:text-base font-black mt-1 tabular-nums ${
                    balanceSheet.liabilities.total === 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {formatCurrency(balanceSheet.liabilities.total, defaultCurrency)}
                </span>
                <span className="block text-[10.5px] text-[var(--muted)] mt-0.5">
                  D/A Ratio: {balanceSheet.ratios.debtToAssetRatio.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Financial Health Analysis Card */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <h5 className="text-xs font-black text-[var(--fg)]">
                  {t('reports.complianceTitle', 'Evaluasi Kepatuhan & Kesehatan Neraca')}
                </h5>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Laporan ini disusun menggunakan metode pencatatan kas akuntansi formal. Rasio likuiditas lancar saat ini berada di angka{' '}
                <strong className="text-[var(--fg)]">{balanceSheet.ratios.currentRatio.toFixed(1)}x</strong> dan arus kas bersih periode ini adalah{' '}
                <strong className={cashFlowStatement.netChangeInCash >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {formatCurrency(cashFlowStatement.netChangeInCash, defaultCurrency)}
                </strong>.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: INCOME STATEMENT (LABA RUGI) */}
        {activeTab === 'income' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--field-bg)] border-b border-[var(--border)] font-bold text-xs text-[var(--fg)]">
                {t('reports.operatingRevenue', 'I. Pendapatan Operasional')}
              </div>
              <div className="divide-y divide-[var(--border)]/50 text-xs">
                {(incomeStatement.operatingRevenue.items || []).length === 0 ? (
                  <div className="p-3 text-[var(--muted)] text-center text-[11px]">
                    {t('reports.noRevenue', 'Tidak ada pendapatan operasional tercatat')}
                  </div>
                ) : (
                  incomeStatement.operatingRevenue.items.map((item) => (
                    <div key={item.category} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                      <span>{item.category}</span>
                      <span className="font-bold font-mono text-emerald-500">{formatCurrency(item.amount, defaultCurrency)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2.5 font-bold bg-[var(--field-bg)]/40 text-[var(--fg)]">
                  <span>{t('reports.totalOperatingRevenue', 'Total Pendapatan Operasional')}</span>
                  <span className="font-mono text-emerald-500">{formatCurrency(incomeStatement.operatingRevenue.total, defaultCurrency)}</span>
                </div>
              </div>

              <div className="px-4 py-2.5 bg-[var(--field-bg)] border-t border-b border-[var(--border)] font-bold text-xs text-[var(--fg)]">
                {t('reports.operatingExpenses', 'II. Beban Operasional')}
              </div>
              <div className="divide-y divide-[var(--border)]/50 text-xs">
                {(incomeStatement.operatingExpenses.items || []).length === 0 ? (
                  <div className="p-3 text-[var(--muted)] text-center text-[11px]">
                    {t('reports.noExpense', 'Tidak ada beban operasional tercatat')}
                  </div>
                ) : (
                  incomeStatement.operatingExpenses.items.map((item) => (
                    <div key={item.category} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                      <span>{item.category}</span>
                      <span className="font-bold font-mono text-rose-500">({formatCurrency(item.amount, defaultCurrency)})</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2.5 font-bold bg-[var(--field-bg)]/40 text-[var(--fg)]">
                  <span>{t('reports.totalOperatingExpenses', 'Total Beban Operasional')}</span>
                  <span className="font-mono text-rose-500">({formatCurrency(incomeStatement.operatingExpenses.total, defaultCurrency)})</span>
                </div>
              </div>

              <div className="p-4 bg-[var(--field-bg)] border-t border-[var(--border)] flex justify-between items-center text-sm font-black text-[var(--fg)]">
                <span>{t('reports.netIncome', 'LABA BERSIH (NET INCOME)')}</span>
                <span className={`font-mono text-base ${incomeStatement.netIncome >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(incomeStatement.netIncome, defaultCurrency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BALANCE SHEET (NERACA) */}
        {activeTab === 'balance' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-[var(--field-bg)] border-b border-[var(--border)] font-bold text-[var(--fg)]">
                {t('reports.currentAssets', 'ASET LANCAR (KAS & BANK)')}
              </div>
              <div className="divide-y divide-[var(--border)]/50">
                {balanceSheet.assets.currentAssets.items.map((c) => (
                  <div key={c.id} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                    <span>{c.name} ({c.type})</span>
                    <span className="font-bold font-mono">{formatCurrency(c.balance, defaultCurrency)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5 font-bold bg-[var(--field-bg)]/40 text-[var(--fg)]">
                  <span>{t('reports.totalCurrentAssets', 'Total Aset Lancar')}</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.assets.currentAssets.total, defaultCurrency)}</span>
                </div>
              </div>

              <div className="px-4 py-2.5 bg-[var(--field-bg)] border-t border-b border-[var(--border)] font-bold text-[var(--fg)]">
                {t('reports.nonCurrentAssets', 'ASET TIDAK LANCAR (TABUNGAN, INVESTASI & PIUTANG)')}
              </div>
              <div className="divide-y divide-[var(--border)]/50">
                {balanceSheet.assets.nonCurrentAssets.savings.items.map((s) => (
                  <div key={s.id} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                    <span>Tabungan: {s.name}</span>
                    <span className="font-bold font-mono">{formatCurrency(s.currentAmount, defaultCurrency)}</span>
                  </div>
                ))}
                {(balanceSheet.assets.nonCurrentAssets.investments?.items || []).map((inv) => (
                  <div key={inv.id} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                    <span>Investasi: {inv.name}</span>
                    <span className="font-bold font-mono">{formatCurrency(inv.amount, defaultCurrency)}</span>
                  </div>
                ))}
                {balanceSheet.assets.nonCurrentAssets.receivables.items.map((r) => (
                  <div key={r.id} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                    <span>Piutang: {r.personName}</span>
                    <span className="font-bold font-mono">{formatCurrency(r.amount, defaultCurrency)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5 font-bold bg-[var(--field-bg)]/40 text-[var(--fg)]">
                  <span>{t('reports.totalNonCurrentAssets', 'Total Aset Tidak Lancar')}</span>
                  <span className="font-mono">{formatCurrency(balanceSheet.assets.nonCurrentAssets.total, defaultCurrency)}</span>
                </div>
              </div>

              <div className="p-3.5 bg-[var(--field-bg)] border-t border-[var(--border)] flex justify-between font-black text-sm text-[var(--fg)]">
                <span>{t('reports.totalAssets', 'TOTAL ASET')}</span>
                <span className="font-mono text-emerald-500">{formatCurrency(balanceSheet.assets.totalAssets, defaultCurrency)}</span>
              </div>

              <div className="px-4 py-2.5 bg-[var(--field-bg)] border-t border-b border-[var(--border)] font-bold text-[var(--fg)]">
                {t('reports.liabilities', 'KEWAJIBAN / UTANG')}
              </div>
              <div className="divide-y divide-[var(--border)]/50">
                {balanceSheet.liabilities.items.length === 0 ? (
                  <div className="p-3 text-[var(--muted)] text-center text-[11px]">
                    {t('reports.noLiabilities', 'Nihil - Tidak ada utang aktif')}
                  </div>
                ) : (
                  balanceSheet.liabilities.items.map((d) => (
                    <div key={d.id} className="flex justify-between px-4 py-2 text-[var(--fg)]">
                      <span>Utang: {d.personName}</span>
                      <span className="font-bold font-mono text-rose-500">({formatCurrency(d.amount, defaultCurrency)})</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between px-4 py-2.5 font-bold bg-[var(--field-bg)]/40 text-[var(--fg)]">
                  <span>{t('reports.totalLiabilities', 'Total Kewajiban')}</span>
                  <span className="font-mono text-rose-500">({formatCurrency(balanceSheet.liabilities.total, defaultCurrency)})</span>
                </div>
              </div>

              <div className="p-4 bg-[var(--field-bg)] border-t border-[var(--border)] flex justify-between items-center text-sm font-black text-[var(--fg)]">
                <span>{t('reports.netWorth', 'EKUITAS BERSIH (NET WORTH)')}</span>
                <span className="font-mono text-base text-[var(--fg)]">{formatCurrency(balanceSheet.equity.netWorth, defaultCurrency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CASH FLOW STATEMENT (ARUS KAS) */}
        {activeTab === 'cashflow' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden text-xs">
              <div className="divide-y divide-[var(--border)]/50">
                <div className="flex justify-between px-4 py-3 text-[var(--fg)]">
                  <div>
                    <span className="font-bold block">{t('reports.operatingCashFlow', 'Arus Kas Aktivitas Operasional')}</span>
                    <span className="text-[11px] text-[var(--muted)]">Penerimaan & Pengeluaran operasional harian</span>
                  </div>
                  <span className={`font-mono font-bold self-center ${cashFlowStatement.operatingActivities.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(cashFlowStatement.operatingActivities.net, defaultCurrency)}
                  </span>
                </div>

                <div className="flex justify-between px-4 py-3 text-[var(--fg)]">
                  <div>
                    <span className="font-bold block">{t('reports.investingCashFlow', 'Arus Kas Aktivitas Investasi')}</span>
                    <span className="text-[11px] text-[var(--muted)]">Penempatan tabungan / aset investasi</span>
                  </div>
                  <span className={`font-mono font-bold self-center ${cashFlowStatement.investingActivities.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(cashFlowStatement.investingActivities.net, defaultCurrency)}
                  </span>
                </div>

                <div className="flex justify-between px-4 py-3 text-[var(--fg)]">
                  <div>
                    <span className="font-bold block">{t('reports.financingCashFlow', 'Arus Kas Aktivitas Pendanaan')}</span>
                    <span className="text-[11px] text-[var(--muted)]">Penerimaan pinjaman & pelunasan utang</span>
                  </div>
                  <span className={`font-mono font-bold self-center ${cashFlowStatement.financingActivities.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(cashFlowStatement.financingActivities.net, defaultCurrency)}
                  </span>
                </div>

                <div className="p-4 bg-[var(--field-bg)] border-t border-[var(--border)] flex justify-between items-center text-sm font-black text-[var(--fg)]">
                  <span>{t('reports.netCashChange', 'KENAIKAN / PENURUNAN BERSIH KAS')}</span>
                  <span className={`font-mono text-base ${cashFlowStatement.netChangeInCash >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(cashFlowStatement.netChangeInCash, defaultCurrency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LEDGER VIEW (BUKU BESAR) */}
        {activeTab === 'ledger' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden text-xs">
              <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border)]/50 ft-hide-scrollbar">
                {filteredTxs.length === 0 ? (
                  <div className="p-6 text-center text-[var(--muted)]">
                    {t('reports.noLedgerTxs', 'Tidak ada transaksi pada periode ini.')}
                  </div>
                ) : (
                  filteredTxs.map((tx) => {
                    const isIncome = tx.type === 'income'
                    return (
                      <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--field-bg)] transition">
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[var(--muted)]">{tx.date}</span>
                            <span className="font-bold text-[var(--fg)] truncate">
                              {(() => {
                                const rawNote = tx.notes || ''
                                const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
                                const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote
                                return safeNote || tx.category || 'Transaksi'
                              })()}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-[var(--muted)] block truncate">{tx.category}</span>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* SHA-256 Digital Verification Seal Box */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/40 p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-black uppercase text-[var(--fg)]">
                {t('reports.digitalSeal', 'Segel Integritas SHA-256')}
              </span>
              <span className="text-[9px] font-mono text-[var(--muted)]">FinTrack Verified</span>
            </div>
            <p className="text-[10px] font-mono text-[var(--muted)] truncate mt-0.5">
              Hash: {checksum || 'Computing...'}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]/60 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex-1 min-w-[140px] h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition hover:opacity-90 active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{isExportingPdf ? t('common.loading', 'Membuat PDF...') : t('reports.downloadPdf', 'Unduh PDF (Resmi)')}</span>
          </button>

          <button
            type="button"
            onClick={handleSharePdf}
            disabled={isSharingPdf}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isSharingPdf ? <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" /> : <Share2 className="h-4 w-4 text-[var(--accent)]" />}
            <span>{t('common.share', 'Bagikan')}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
          >
            <Table className="h-4 w-4 text-[var(--muted)]" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 font-bold text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center"
            title={t('common.print', 'Cetak')}
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
