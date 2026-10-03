import { format, startOfMonth, subMonths, endOfMonth, startOfYear, getMonth } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, TrendingUp, PieChart, Landmark, Calendar, X } from 'lucide-react'
import { db } from '../lib/db'
import { getAllWalletBalances } from '../lib/balanceEngine'
import useTranslation from '../hooks/useTranslation'
import { formatExpenseCategory, parseExpenseCategoryPath } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx, toSafeNumber } from '../lib/utils'
import { aggregateMonthlyIncomeExpense, calculateDailyBurnRate, calculateSavingsRate } from '../lib/reportAnalytics'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import useSettingsStore from '../store/useSettingsStore'
import { exportTransactionsToCsv } from '../lib/exportReports'
import { triggerHaptic } from '../lib/haptics'

import ReportHeader from '../components/reports/ReportHeader'
import ReportKpiCards from '../components/reports/ReportKpiCards'
import ReportSmartInsights from '../components/reports/ReportSmartInsights'
import ReportBarChart from '../components/reports/ReportBarChart'
import ReportDonutSection from '../components/reports/ReportDonutSection'
import ReportNetWorthChart from '../components/reports/ReportNetWorthChart'
import ReportStatementModal from '../components/reports/ReportStatementModal'
import useTransactionStore from '../store/useTransactionStore'
import useBackButton from '../hooks/useBackButton'

export default function Reports() {
  const { t, locale } = useTranslation()
  const [isEntering, setIsEntering] = useState(false)
  const [rangeMonths, setRangeMonths] = useState(6)
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedMonthKey, setSelectedMonthKey] = useState(null)
  const [activePieIdx, setActivePieIdx] = useState(0)
  const [donutKind, setDonutKind] = useState('expense')
  const [selectedDrilldownParent, setSelectedDrilldownParent] = useState(null)
  const [selectedWalletFilter, setSelectedWalletFilter] = useState('all')
  const [compactDonut, setCompactDonut] = useState(false)
  const openQuickAdd = useTransactionStore((s) => s.openQuickAdd)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })

  useBackButton(
    () => {
      if (selectedDrilldownParent) {
        setSelectedDrilldownParent(null)
      } else if (selectedMonthKey) {
        setSelectedMonthKey(null)
      }
    },
    Boolean(selectedDrilldownParent || selectedMonthKey)
  )

  const [prevRangeMonths, setPrevRangeMonths] = useState(rangeMonths)
  const [prevAnchorDate, setPrevAnchorDate] = useState(anchorDate)

  if (prevRangeMonths !== rangeMonths || prevAnchorDate !== anchorDate) {
    setPrevRangeMonths(rangeMonths)
    setPrevAnchorDate(anchorDate)
    if (selectedMonthKey) {
      setSelectedMonthKey(null)
    }
  }

  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
      } catch (err){
      console.warn('[Reports]', err)
        setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
  }, [])

  useEffect(() => {
    const sync = () => setCompactDonut(typeof window !== 'undefined' && window.innerWidth < 420)
    sync()
    window.addEventListener('resize', sync, { passive: true })
    return () => window.removeEventListener('resize', sync)
  }, [])

  const { startDate, endDate, effectiveMonthsCount } = useMemo(() => {
    const anchor = anchorDate || new Date()
    const end = format(endOfMonth(anchor), 'yyyy-MM-dd')
    if (rangeMonths === 'ytd') {
      const start = format(startOfYear(anchor), 'yyyy-MM-dd')
      const count = getMonth(anchor) + 1
      return { startDate: start, endDate: end, effectiveMonthsCount: count }
    }
    const count = Math.max(1, Number(rangeMonths) || 6)
    const start = format(subMonths(startOfMonth(anchor), count - 1), 'yyyy-MM-dd')
    return { startDate: start, endDate: end, effectiveMonthsCount: count }
  }, [anchorDate, rangeMonths])

  const transactions = useLiveQuery(
    async () => {
      const list = await db.transactions
        .where('date')
        .between(startDate, `${endDate}\uffff`, true, true)
        .toArray()
      return (list || []).filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1)
    },
    [startDate, endDate],
    []
  )
  const investments = useLiveQuery(() => db.investments.toArray(), [], [])
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const loans = useLiveQuery(() => db.loans.toArray(), [], [])
  const savings = useLiveQuery(() => db.goals.toArray(), [], [])
  const computedWallets = useLiveQuery(
    async () => {
      const rawWallets = await db.wallets.toArray()
      if (!rawWallets || rawWallets.length === 0) return []
      return await getAllWalletBalances(rawWallets, rates)
    },
    [rates],
    []
  )
  const txCount = useLiveQuery(
    () => db.transactions.filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1).count(),
    [],
    0
  )

  const validTransactions = useMemo(() => {
    if (!transactions) return []
    return transactions.filter((t) => {
      if (t.deletedAt) return false
      if (t.isPendingReview === true || t.isPendingReview === 1) return false
      if (t.isSplit && Array.isArray(t.splitItems) && t.splitItems.length > 0) {
        return t.splitItems.some((si) =>
          !isExcludeAnalyticsTx({
            ...t,
            ...si,
            category: si.category || t.category,
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          })
        )
      }
      return !isExcludeAnalyticsTx(t)
    })
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (selectedWalletFilter === 'all') return validTransactions
    return validTransactions.filter((t) => String(t.walletId) === String(selectedWalletFilter))
  }, [validTransactions, selectedWalletFilter])

  const monthlyIncomeExpense = useMemo(() => {
    return aggregateMonthlyIncomeExpense(
      filteredTransactions,
      effectiveMonthsCount,
      defaultCurrency,
      rates,
      anchorDate
    )
  }, [filteredTransactions, effectiveMonthsCount, defaultCurrency, rates, anchorDate])

  const allMonthlyIncomeExpense = useMemo(() => {
    return aggregateMonthlyIncomeExpense(
      validTransactions,
      effectiveMonthsCount,
      defaultCurrency,
      rates,
      anchorDate
    )
  }, [validTransactions, effectiveMonthsCount, defaultCurrency, rates, anchorDate])

  const netLoanPosition = useMemo(() => {
    const active = (loans || []).filter(
      (l) => l.status !== 'paid' && l.status !== 'forgiven' && toSafeNumber(l.remainingAmount ?? l.totalAmount) > 0
    )
    const debt = active
      .filter((l) => l.type === 'debt')
      .reduce(
        (s, l) =>
          s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount), l.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
    const rec = active
      .filter((l) => l.type === 'receivable')
      .reduce(
        (s, l) =>
          s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount), l.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
    return rec - debt
  }, [loans, defaultCurrency, rates])

  const categorySourceTransactions = useMemo(() => {
    if (!selectedMonthKey) return filteredTransactions
    return filteredTransactions.filter((tx) => tx.date && tx.date.startsWith(selectedMonthKey))
  }, [filteredTransactions, selectedMonthKey])

  const periodSummary = useMemo(() => {
    let totInc = 0
    let totExp = 0
    let txCount = 0

    filteredTransactions.forEach((tx) => {
      txCount += 1
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }
          if (isExcludeAnalyticsTx(itemTx)) return
          let val = toSafeNumber(si.amount)
          const itemCurrency = si.currency || tx.currency || defaultCurrency
          if (itemCurrency !== defaultCurrency) {
            val = convertCurrency(val, itemCurrency, defaultCurrency, rates || FALLBACK_EXCHANGE_RATES)
          }
          const itemType = si.type || tx.type
          if (itemType === 'income') totInc += val
          if (itemType === 'expense') totExp += val
        })
        return
      }

      if (isExcludeAnalyticsTx(tx)) return
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates || FALLBACK_EXCHANGE_RATES)
      }
      if (tx.type === 'income') totInc += val
      if (tx.type === 'expense') totExp += val
    })

    const net = totInc - totExp
    const rate = calculateSavingsRate(totInc, totExp)
    const count = effectiveMonthsCount || 1

    return {
      totalIncome: totInc,
      totalExpense: totExp,
      totalNetSavings: net,
      periodSavingsRate: rate,
      periodTxCount: txCount,
      avgIncome: totInc / count,
      avgExpense: totExp / count,
    }
  }, [filteredTransactions, effectiveMonthsCount, defaultCurrency, rates])

  const expenseByCategory = useMemo(() => {
    const categoryMap = new Map()
    categorySourceTransactions.forEach((tx) => {
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemType = si.type || tx.type
          if (itemType !== 'expense') return
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }
          if (isExcludeAnalyticsTx(itemTx)) return

          const parsed = parseExpenseCategoryPath(itemTx.category)
          let key
          let label
          let isParent
          let parentId

          if (!selectedDrilldownParent) {
            parentId = parsed?.parentId || itemTx.category || 'lainnya'
            key = parentId
            label = parsed?.parent?.names?.[locale === 'en' ? 'en' : 'id'] || formatExpenseCategory(key, locale)
            isParent = true
          } else {
            const itemParent = parsed?.parentId || itemTx.category || 'lainnya'
            if (itemParent !== selectedDrilldownParent) return
            key = parsed?.childId || 'utama'
            label =
              parsed?.child?.names?.[locale === 'en' ? 'en' : 'id'] ||
              (locale === 'en' ? 'Main / General' : 'Utama / Umum')
            isParent = false
            parentId = selectedDrilldownParent
          }

          const current = categoryMap.get(key) || { key, label, value: 0, isParent, parentId }
          let val = toSafeNumber(si.amount)
          const itemCurrency = si.currency || tx.currency || defaultCurrency
          if (itemCurrency !== defaultCurrency) {
            val = convertCurrency(val, itemCurrency, defaultCurrency, rates || FALLBACK_EXCHANGE_RATES)
          }
          current.value += val
          categoryMap.set(key, current)
        })
        return
      }

      if (tx.type !== 'expense') return
      if (isExcludeAnalyticsTx(tx)) return

      const parsed = parseExpenseCategoryPath(tx.category)
      let key
      let label
      let isParent
      let parentId

      if (!selectedDrilldownParent) {
        parentId = parsed?.parentId || tx.category || 'lainnya'
        key = parentId
        label = parsed?.parent?.names?.[locale === 'en' ? 'en' : 'id'] || formatExpenseCategory(key, locale)
        isParent = true
      } else {
        const itemParent = parsed?.parentId || tx.category || 'lainnya'
        if (itemParent !== selectedDrilldownParent) return
        key = parsed?.childId || 'utama'
        label =
          parsed?.child?.names?.[locale === 'en' ? 'en' : 'id'] ||
          (locale === 'en' ? 'Main / General' : 'Utama / Umum')
        isParent = false
        parentId = selectedDrilldownParent
      }

      const current = categoryMap.get(key) || { key, label, value: 0, isParent, parentId }
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates || FALLBACK_EXCHANGE_RATES)
      }
      current.value += val
      categoryMap.set(key, current)
    })
    return [...categoryMap.values()].sort((a, b) => b.value - a.value)
  }, [locale, categorySourceTransactions, selectedDrilldownParent, defaultCurrency, rates])

  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map()
    categorySourceTransactions.forEach((tx) => {
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemType = si.type || tx.type
          if (itemType !== 'income') return
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }
          if (isExcludeAnalyticsTx(itemTx)) return
          const key = si.category || tx.category || ''
          const current = categoryMap.get(key) ?? 0
          let val = toSafeNumber(si.amount)
          const itemCurrency = si.currency || tx.currency || defaultCurrency
          if (itemCurrency !== defaultCurrency) {
            val = convertCurrency(val, itemCurrency, defaultCurrency, rates || FALLBACK_EXCHANGE_RATES)
          }
          categoryMap.set(key, current + val)
        })
        return
      }

      if (tx.type !== 'income') return
      if (isExcludeAnalyticsTx(tx)) return
      const key = tx.category || ''
      const current = categoryMap.get(key) ?? 0
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates || FALLBACK_EXCHANGE_RATES)
      }
      categoryMap.set(key, current + val)
    })
    return [...categoryMap.entries()]
      .map(([key, value]) => ({
        key,
        label: formatIncomeCategory(key, locale),
        value,
      }))
      .sort((a, b) => b.value - a.value)
  }, [locale, categorySourceTransactions, defaultCurrency, rates])

  const totalCash = useMemo(() => {
    return (computedWallets || [])
      .filter((w) => !w.isArchived)
      .reduce((sum, w) => {
        return (
          sum +
          convertCurrency(
            toSafeNumber(w.currentBalance),
            w.currency || defaultCurrency,
            defaultCurrency,
            rates
          )
        )
      }, 0)
  }, [computedWallets, defaultCurrency, rates])

  const investmentValue = useMemo(() => {
    return (investments || []).reduce(
      (acc, row) =>
        acc +
        convertCurrency(
          toSafeNumber(row.quantity) * toSafeNumber(row.purchasePrice),
          row.purchaseCurrency || defaultCurrency,
          defaultCurrency,
          rates
        ),
      0
    )
  }, [investments, defaultCurrency, rates])

  const totalSavings = useMemo(() => {
    return (savings || [])
      .filter((g) => !g.isArchived)
      .reduce((sum, g) => {
        const amt = toSafeNumber(g.currentAmount)
        if (amt <= 0) return sum
        return sum + convertCurrency(amt, g.currency || defaultCurrency, defaultCurrency, rates)
      }, 0)
  }, [savings, defaultCurrency, rates])

  const netWorthTrend = useMemo(() => {
    const currentNetWorth = totalCash + investmentValue + netLoanPosition + totalSavings
    const totalNetFlow = allMonthlyIncomeExpense.reduce((sum, m) => sum + (m.income - m.expense), 0)
    let accumulator = currentNetWorth - totalNetFlow

    const trend = []
    for (const monthData of allMonthlyIncomeExpense) {
      accumulator += monthData.income - monthData.expense
      trend.push({
        month: monthData.month,
        netWorth: accumulator,
      })
    }
    return trend
  }, [totalCash, investmentValue, netLoanPosition, totalSavings, allMonthlyIncomeExpense])

  const selectedMonthData = useMemo(() => {
    if (!selectedMonthKey || !monthlyIncomeExpense?.length) return null
    const idx = monthlyIncomeExpense.findIndex((m) => m.key === selectedMonthKey)
    if (idx === -1) return null
    return {
      current: monthlyIncomeExpense[idx],
      previous: idx > 0 ? monthlyIncomeExpense[idx - 1] : { income: 0, expense: 0 },
    }
  }, [selectedMonthKey, monthlyIncomeExpense])

  const thisMonth = selectedMonthData?.current ?? (monthlyIncomeExpense.at(-1) ?? { income: 0, expense: 0 })
  const previousMonth = selectedMonthData?.previous ?? (monthlyIncomeExpense.at(-2) ?? { income: 0, expense: 0 })
  const totalExpense = expenseByCategory.reduce((acc, row) => acc + toSafeNumber(row.value), 0)

  const averageExpense = monthlyIncomeExpense.length
    ? monthlyIncomeExpense.reduce((acc, row) => acc + toSafeNumber(row.expense), 0) / monthlyIncomeExpense.length
    : 0

  const dailyBurnRate = calculateDailyBurnRate(
    selectedMonthKey ? totalExpense : periodSummary.totalExpense,
    (selectedMonthKey ? 1 : effectiveMonthsCount) * 30.4
  )
  const topDominantCategory = expenseByCategory[0] || null

  const donutBase = donutKind === 'income' ? incomeByCategory : expenseByCategory
  const donutTotal = useMemo(() => {
    return donutBase
      .filter((row) => toSafeNumber(row.value) > 0)
      .reduce((sum, row) => sum + toSafeNumber(row.value), 0)
  }, [donutBase])

  const donutCenterTitle = useMemo(() => {
    if (donutKind === 'income') return t('reports.totalIncome')
    if (selectedDrilldownParent) {
      const p = parseExpenseCategoryPath(selectedDrilldownParent)?.parent
      return p?.names?.[locale === 'en' ? 'en' : 'id'] || selectedDrilldownParent
    }
    return t('reports.totalExpense')
  }, [donutKind, selectedDrilldownParent, locale, t])

  const donutData = useMemo(() => {
    const valid = donutBase.filter((row) => toSafeNumber(row.value) > 0)
    const sorted = [...valid].sort((a, b) => b.value - a.value)
    if (selectedDrilldownParent) return sorted
    const top = sorted.slice(0, 5)
    const others = sorted.slice(5).reduce((acc, row) => acc + toSafeNumber(row.value), 0)
    if (others > 0) {
      top.push({ key: '__others__', label: t('reports.otherCategory', 'Lainnya'), value: others })
    }
    return top
  }, [donutBase, selectedDrilldownParent, t])

  const topExpenseCategories = useMemo(() => {
    const valid = expenseByCategory.filter((row) => toSafeNumber(row.value) > 0)
    const sorted = [...valid].sort((a, b) => b.value - a.value)
    return selectedDrilldownParent ? sorted : sorted.slice(0, 6)
  }, [expenseByCategory, selectedDrilldownParent])

  const topIncomeCategories = useMemo(
    () => [...incomeByCategory].filter((row) => toSafeNumber(row.value) > 0).sort((a, b) => b.value - a.value).slice(0, 6),
    [incomeByCategory]
  )

  const hasAnyTransactionsEver = (txCount || 0) > 0

  return (
    <div className="min-h-full pb-32 sm:pb-24">
      <div
        className={`ft-motion-page min-h-full space-y-4 sm:space-y-5 transform-gpu ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Header Section with Time Switcher and Action Pills */}
        <ReportHeader
          rangeMonths={rangeMonths}
          setRangeMonths={setRangeMonths}
          monthlyIncomeExpense={monthlyIncomeExpense}
          onExportCsv={() => exportTransactionsToCsv(categorySourceTransactions, wallets, defaultCurrency, locale)}
          onPrintReport={() => setIsStatementModalOpen(true)}
          anchorDate={anchorDate}
          setAnchorDate={setAnchorDate}
          periodSummary={periodSummary}
          selectedMonthKey={selectedMonthKey}
          selectedMonthData={selectedMonthData}
        />

        {/* Selected Month Drilldown Notification Banner */}
        {selectedMonthKey && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel-strong))] px-4 py-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--fg)] truncate">
                  {t('reports.drillingDownMonth', 'Rincian Bulan')}: {selectedMonthData?.current?.month || selectedMonthKey}
                </p>
                <p className="text-[11px] font-medium text-[var(--muted)] truncate">
                  {t('reports.drillingDownSubtitle', 'Menampilkan data khusus bulan terpilih. Ketuk tombol untuk kembali ke ringkasan periode.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setSelectedMonthKey(null)
              }}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5 text-xs font-black text-[var(--fg)] shadow-2xs hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>{t('reports.resetPeriodView', 'Kembali ke Total')}</span>
            </button>
          </div>
        )}

        {!hasAnyTransactionsEver ? (
          /* Single Unified Premium Zero-State Hero Bento */
          <div className="space-y-4">
            <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-6 sm:p-8 text-center shadow-[var(--shadow-card)]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_24%,transparent)] shadow-sm mb-4">
                <PieChart className="h-7 w-7 stroke-[2.2]" />
              </div>

              <h2 className="text-lg sm:text-xl font-black tracking-tight text-[var(--fg)]">
                {t('reports.zeroStateTitle', 'Belum Ada Riwayat Transaksi')}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-[var(--muted)] max-w-md mx-auto leading-relaxed">
                {t(
                  'reports.zeroStateDesc',
                  'Laporan finansial komprehensif, analisis arus kas, distribusi kategori, dan grafik perkembangan kekayaan Anda akan otomatis tersusun begitu transaksi pertama dicatat.'
                )}
              </p>

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium')
                    openQuickAdd()
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>{t('reports.recordFirstTx', 'Catat Transaksi Pertama')}</span>
                </button>
              </div>
            </section>

            {/* 3-Pillar Feature Showcase Bento */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-4 shadow-2xs">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500 border border-emerald-500/20 mb-3">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black text-[var(--fg)]">
                  {t('reports.featureCashflow', 'Arus Kas & Surplus Real-Time')}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted)] leading-normal">
                  {t('reports.featureCashflowDesc', 'Pantau rasio tabungan riil dan perbandingan pemasukan vs pengeluaran.')}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-4 shadow-2xs">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/12 text-indigo-500 border border-indigo-500/20 mb-3">
                  <PieChart className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black text-[var(--fg)]">
                  {t('reports.featureCategories', 'Komposisi Belanja & Subkategori')}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted)] leading-normal">
                  {t('reports.featureCategoriesDesc', 'Telusuri pos belanja paling dominan dengan rincian subkategori mendalam.')}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-4 shadow-2xs">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/12 text-amber-500 border border-amber-500/20 mb-3">
                  <Landmark className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black text-[var(--fg)]">
                  {t('reports.featureNetWorth', 'Evolusi Kekayaan Bersih 3 Pilar')}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-[var(--muted)] leading-normal">
                  {t('reports.featureNetWorthDesc', 'Akumulasi terpadu saldo kas dompet, kepemilikan aset investasi, dan posisi pinjaman.')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Full Financial Reporting Suite */
          <>
            {/* Executive Cashflow Hero & Health Meter */}
            <ReportKpiCards
              thisMonth={thisMonth}
              previousMonth={previousMonth}
              periodSummary={periodSummary}
              rangeMonths={rangeMonths}
              selectedMonthKey={selectedMonthKey}
              selectedMonthData={selectedMonthData}
            />

            {/* Smart AI Financial Highlights & Burn Rate Strip */}
            <ReportSmartInsights
              topCategory={topDominantCategory}
              totalExpense={selectedMonthKey ? totalExpense : periodSummary.totalExpense}
              dailyBurnRate={dailyBurnRate}
              thisMonthExpense={thisMonth.expense}
              thisMonthIncome={thisMonth.income}
              averageMonthlyExpense={averageExpense}
              periodSummary={periodSummary}
              rangeMonths={rangeMonths}
              selectedMonthKey={selectedMonthKey}
              anchorDate={anchorDate}
            />

            {/* Monthly Income vs Expense Bar Chart with Average Benchmark */}
            <ReportBarChart
              monthlyIncomeExpense={monthlyIncomeExpense}
              selectedMonthKey={selectedMonthKey}
              onSelectMonthKey={setSelectedMonthKey}
            />

            {/* Donut Chart & Category Breakdown Hierarchy */}
            <ReportDonutSection
              donutKind={donutKind}
              setDonutKind={setDonutKind}
              selectedWalletFilter={selectedWalletFilter}
              setSelectedWalletFilter={setSelectedWalletFilter}
              wallets={wallets}
              selectedDrilldownParent={selectedDrilldownParent}
              setSelectedDrilldownParent={setSelectedDrilldownParent}
              donutCenterTitle={donutCenterTitle}
              donutData={donutData}
              donutTotal={donutTotal}
              activePieIdx={activePieIdx}
              setActivePieIdx={setActivePieIdx}
              topExpenseCategories={topExpenseCategories}
              topIncomeCategories={topIncomeCategories}
              compactDonut={compactDonut}
            />

            {/* Net Worth Trend & 3-Pillar Asset Composition */}
            <ReportNetWorthChart
              netWorthTrend={netWorthTrend}
              totalCash={totalCash}
              investmentValue={investmentValue}
              netLoanPosition={netLoanPosition}
            />
          </>
        )}


        {/* In-App Financial Statement Preview Modal */}
        {isStatementModalOpen && (
          <ReportStatementModal
            isOpen={isStatementModalOpen}
            onClose={() => setIsStatementModalOpen(false)}
            wallets={wallets || []}
            savings={savings || []}
            loans={loans || []}
            investments={investments || []}
            rates={rates}
          />
        )}
      </div>
    </div>
  )
}
