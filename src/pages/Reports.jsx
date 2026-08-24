import { format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import { formatExpenseCategory, parseExpenseCategoryPath } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import { convertCurrency, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx, toSafeNumber } from '../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import useSettingsStore from '../store/useSettingsStore'
import { exportTransactionsToCsv, printFinancialReport } from '../lib/exportReports'

import ReportHeader from '../components/reports/ReportHeader'
import ReportKpiCards from '../components/reports/ReportKpiCards'
import ReportBarChart from '../components/reports/ReportBarChart'
import ReportDonutSection from '../components/reports/ReportDonutSection'
import ReportNetWorthChart from '../components/reports/ReportNetWorthChart'

function safeMonthKey(input) {
  if (!input) return ''
  try {
    return format(parseISO(String(input)), 'yyyy-MM')
  } catch {
    return ''
  }
}

export default function Reports() {
  const { t, locale } = useTranslation()
  const [isEntering, setIsEntering] = useState(false)
  const [rangeMonths, setRangeMonths] = useState(6)
  const [activePieIdx, setActivePieIdx] = useState(0)
  const [donutKind, setDonutKind] = useState('expense')
  const [selectedDrilldownParent, setSelectedDrilldownParent] = useState(null)
  const [selectedWalletFilter, setSelectedWalletFilter] = useState('all')
  const [compactDonut, setCompactDonut] = useState(false)
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD'))

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
      } catch {
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

  const cutoffDate = useMemo(() => {
    return format(startOfMonth(subMonths(new Date(), Math.max(rangeMonths, 12))), 'yyyy-MM-dd')
  }, [rangeMonths])

  const transactions = useLiveQuery(
    () => db.transactions.where('date').aboveOrEqual(cutoffDate).toArray(),
    [cutoffDate],
    []
  )
  const investments = useLiveQuery(() => db.investments.toArray(), [], [])
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  const filteredTransactions = useMemo(() => {
    if (!transactions) return []
    const validTxs = transactions.filter((t) => !isExcludeAnalyticsTx(t))
    if (selectedWalletFilter === 'all') return validTxs
    return validTxs.filter((t) => Number(t.walletId) === Number(selectedWalletFilter))
  }, [transactions, selectedWalletFilter])

  const monthlyIncomeExpense = useMemo(() => {
    const monthMap = new Map()
    for (let i = rangeMonths - 1; i >= 0; i -= 1) {
      const month = subMonths(startOfMonth(new Date()), i)
      const key = format(month, 'yyyy-MM')
      monthMap.set(key, { month: format(month, 'MMM yy'), income: 0, expense: 0 })
    }

    filteredTransactions.forEach((tx) => {
      const key = safeMonthKey(tx?.date)
      if (!monthMap.has(key)) return
      const row = monthMap.get(key)
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency && rates) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates)
      }
      if (tx.type === 'income') row.income += val
      if (tx.type === 'expense') row.expense += val
    })
    return [...monthMap.values()]
  }, [rangeMonths, filteredTransactions, defaultCurrency, rates])

  const loans = useLiveQuery(() => db.loans.toArray(), [], [])

  const netLoanPosition = useMemo(() => {
    const active = (loans || []).filter((l) => l.status !== 'paid' && toSafeNumber(l.remainingAmount ?? l.totalAmount) > 0)
    const debt = active
      .filter((l) => l.type === 'debt')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    const rec = active
      .filter((l) => l.type === 'receivable')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    return rec - debt
  }, [loans, defaultCurrency, rates])

  const expenseByCategory = useMemo(() => {
    const categoryMap = new Map()
    filteredTransactions.forEach((tx) => {
      if (tx.type !== 'expense') return
      const itemsToProcess = tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0
        ? tx.splitItems.map((si) => ({ category: si.category, amount: si.amount }))
        : [{ category: tx.category, amount: tx.amount }]

      itemsToProcess.forEach((item) => {
        const parsed = parseExpenseCategoryPath(item.category)
        let key
        let label
        let isParent
        let parentId

        if (!selectedDrilldownParent) {
          parentId = parsed?.parentId || item.category || 'lainnya'
          key = parentId
          label = parsed?.parent?.names?.[locale === 'en' ? 'en' : 'id'] || formatExpenseCategory(key, locale)
          isParent = true
        } else {
          const itemParent = parsed?.parentId || item.category || 'lainnya'
          if (itemParent !== selectedDrilldownParent) return
          key = parsed?.childId || 'utama'
          label = parsed?.child?.names?.[locale === 'en' ? 'en' : 'id'] || (locale === 'en' ? 'Main / General' : 'Utama / Umum')
          isParent = false
          parentId = selectedDrilldownParent
        }

        const current = categoryMap.get(key) || { key, label, value: 0, isParent, parentId }
        let val = toSafeNumber(item.amount)
        if (tx.currency && tx.currency !== defaultCurrency && rates) {
          val = convertCurrency(val, tx.currency, defaultCurrency, rates)
        }
        current.value += val
        categoryMap.set(key, current)
      })
    })
    return [...categoryMap.values()].sort((a, b) => b.value - a.value)
  }, [locale, filteredTransactions, selectedDrilldownParent, defaultCurrency, rates])

  const incomeByCategory = useMemo(() => {
    const categoryMap = new Map()
    filteredTransactions.forEach((tx) => {
      if (tx.type !== 'income') return
      const key = tx.category || ''
      const current = categoryMap.get(key) ?? 0
      let val = toSafeNumber(tx.amount)
      if (tx.currency && tx.currency !== defaultCurrency && rates) {
        val = convertCurrency(val, tx.currency, defaultCurrency, rates)
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
  }, [locale, filteredTransactions, defaultCurrency, rates])

  const netWorthTrend = useMemo(() => {
    const totalCash = (wallets || []).reduce((sum, w) => {
      return (
        sum +
        convertCurrency(
          toSafeNumber(w.balance),
          w.currency || defaultCurrency,
          defaultCurrency,
          rates,
        )
      )
    }, 0)
    const investmentValue = (investments || []).reduce(
      (acc, row) =>
        acc +
        convertCurrency(
          toSafeNumber(row.quantity) * toSafeNumber(row.purchasePrice),
          row.purchaseCurrency || defaultCurrency,
          defaultCurrency,
          rates,
        ),
      0,
    )
    const currentNetWorth = totalCash + investmentValue + netLoanPosition
    const totalNetFlow = monthlyIncomeExpense.reduce((sum, m) => sum + (m.income - m.expense), 0)
    let runningNet = currentNetWorth - totalNetFlow

    return monthlyIncomeExpense.map((monthData) => {
      runningNet += monthData.income - monthData.expense
      return {
        month: monthData.month,
        netWorth: runningNet,
      }
    })
  }, [wallets, investments, netLoanPosition, monthlyIncomeExpense, defaultCurrency, rates])

  const thisMonth = monthlyIncomeExpense.at(-1) ?? { income: 0, expense: 0 }
  const previousMonth = monthlyIncomeExpense.at(-2) ?? { income: 0, expense: 0 }
  const totalExpense = expenseByCategory.reduce((acc, row) => acc + toSafeNumber(row.value), 0)
  const totalIncome = incomeByCategory.reduce((acc, row) => acc + toSafeNumber(row.value), 0)
  const averageExpense = monthlyIncomeExpense.length
    ? monthlyIncomeExpense.reduce((acc, row) => acc + toSafeNumber(row.expense), 0) / monthlyIncomeExpense.length
    : 0

  const donutBase = donutKind === 'income' ? incomeByCategory : expenseByCategory
  const donutTotal = donutKind === 'income' ? totalIncome : totalExpense

  const donutCenterTitle = useMemo(() => {
    if (donutKind === 'income') return t('reports.totalIncome')
    if (selectedDrilldownParent) {
      const p = parseExpenseCategoryPath(selectedDrilldownParent)?.parent
      return p?.names?.[locale === 'en' ? 'en' : 'id'] || selectedDrilldownParent
    }
    return t('reports.totalExpense')
  }, [donutKind, selectedDrilldownParent, locale, t])

  const donutData = useMemo(() => {
    const sorted = [...donutBase].sort((a, b) => b.value - a.value)
    if (selectedDrilldownParent) return sorted
    const top = sorted.slice(0, 5)
    const others = sorted.slice(5).reduce((acc, row) => acc + toSafeNumber(row.value), 0)
    if (others > 0) {
      top.push({ key: '__others__', label: t('reports.otherCategory'), value: others })
    }
    return top
  }, [donutBase, selectedDrilldownParent, t])

  const topExpenseCategories = useMemo(() => {
    const sorted = [...expenseByCategory].sort((a, b) => b.value - a.value)
    return selectedDrilldownParent ? sorted : sorted.slice(0, 6)
  }, [expenseByCategory, selectedDrilldownParent])

  const topIncomeCategories = useMemo(() => [...incomeByCategory].sort((a, b) => b.value - a.value).slice(0, 6), [incomeByCategory])

  return (
    <div className="min-h-full">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Header Section */}
        <ReportHeader
          rangeMonths={rangeMonths}
          setRangeMonths={setRangeMonths}
          monthlyIncomeExpense={monthlyIncomeExpense}
          onExportCsv={() => exportTransactionsToCsv(filteredTransactions, wallets, defaultCurrency, locale)}
          onPrintReport={() => {
            const categories = (donutKind === 'expense' ? expenseByCategory : incomeByCategory).map((cat) => ({
              name: cat.label || cat.key,
              amount: toSafeNumber(cat.value),
              percent: donutTotal > 0 ? Math.round((toSafeNumber(cat.value) / donutTotal) * 100) : 0,
            }))
            const profileName = useSettingsStore.getState().profileName || ''
            printFinancialReport({
              title: t('reports.statementTitle', 'Laporan Keuangan Resmi'),
              periodName: `${rangeMonths} Bulan (${format(new Date(), 'MMMM yyyy')})`,
              profileName,
              totalIncome: thisMonth.income,
              totalExpense: thisMonth.expense,
              netSavings: thisMonth.income - thisMonth.expense,
              categories,
              transactions: filteredTransactions,
              wallets,
              defaultCurrency,
              locale,
            })
          }}
        />

        {/* 2-Column KPI Cards */}
        <ReportKpiCards thisMonth={thisMonth} previousMonth={previousMonth} />

        {/* Monthly Income vs Expense Bar Chart */}
        <ReportBarChart
          monthlyIncomeExpense={monthlyIncomeExpense}
        />

        {/* Donut Chart & Category Breakdown */}
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
          averageExpense={averageExpense}
          compactDonut={compactDonut}
        />

        {/* Net Worth Trend Area Chart */}
        <ReportNetWorthChart netWorthTrend={netWorthTrend} />
      </div>
    </div>
  )
}
