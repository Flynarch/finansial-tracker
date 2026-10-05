import { format, subDays, subMonths, startOfMonth, startOfYear } from 'date-fns'
import { convertCurrency, isExcludeAnalyticsTx, toSafeNumber } from '../../lib/utils'
import { calculate1DHourlyFlow } from './dashboardStats'

/**
 * Pure chart series computations for timeframes (1w, 1m, 3m, ytd, 1y, all).
 */
export function calculateChartData({
  normalizedTransactions = [],
  activeWalletIdSet = new Set(),
  walletCurrencyMap = new Map(),
  defaultCurrency = 'IDR',
  rates = null,
}) {
  const safeTx = normalizedTransactions ?? []

  const generateDaily = (daysCount) => {
    const arr = Array.from({ length: daysCount }, (_, idx) => {
      const d = subDays(new Date(), daysCount - 1 - idx)
      return { day: format(d, 'dd MMM'), date: format(d, 'yyyy-MM-dd'), income: 0, expense: 0, net: 0 }
    })
    const map = new Map(arr.map((r) => [r.date, r]))
    return { arr, map }
  }

  const generateMonthly = (monthsCount, endMonthD = new Date()) => {
    const baseDate = startOfMonth(endMonthD)
    const arr = Array.from({ length: monthsCount }, (_, idx) => {
      const d = subMonths(baseDate, monthsCount - 1 - idx)
      return { day: format(d, 'MMM yyyy'), key: format(d, 'yyyy-MM'), income: 0, expense: 0, net: 0 }
    })
    const map = new Map(arr.map((r) => [r.key, r]))
    return { arr, map }
  }

  const { arr: data1w, map: map1w } = generateDaily(7)
  const { arr: data1m, map: map1m } = generateDaily(30)
  const { arr: data3m, map: map3m } = generateDaily(90)
  const { arr: data1y, map: map1y } = generateMonthly(12)

  const currentMonth = new Date().getMonth() + 1
  const { arr: dataYtd, map: mapYtd } = generateMonthly(currentMonth)

  let oldestDate = new Date()
  if (safeTx.length > 0) {
    for (const tx of safeTx) {
      if (tx.date && new Date(tx.date) < oldestDate) oldestDate = new Date(tx.date)
    }
  }
  const allMonthsDiff =
    (new Date().getFullYear() - oldestDate.getFullYear()) * 12 +
    (new Date().getMonth() - oldestDate.getMonth()) +
    1
  const totalMonths = Math.max(2, allMonthsDiff)
  const { arr: dataAll, map: mapAll } = generateMonthly(totalMonths)

  safeTx.forEach((tx) => {
    if (tx?.isPendingReview === true || tx?.isPendingReview === 1) return
    const isAdj = tx.type === 'balance_adjustment'
    const amount = tx.convertedAmount || 0
    const txDate = tx?.date
    if (!txDate) return

    const isSrcActive = activeWalletIdSet.has(String(tx?.walletId))
    const isTgtActive = tx?.targetWalletId ? activeWalletIdSet.has(String(tx.targetWalletId)) : false

    let cashChange = 0
    if (tx.type === 'transfer') {
      if (isSrcActive && !isTgtActive) cashChange = -amount
      else if (!isSrcActive && isTgtActive) {
        const tgtCurrency =
          tx.targetCurrency || (tx.targetWalletId != null ? walletCurrencyMap.get(String(tx.targetWalletId)) : null) || defaultCurrency
        cashChange =
          tx.targetAmount != null && toSafeNumber(tx.targetAmount) > 0
            ? convertCurrency(toSafeNumber(tx.targetAmount), tgtCurrency, defaultCurrency, rates)
            : amount
      }
    } else if (isSrcActive) {
      if (tx.type === 'income' || isAdj) cashChange = amount
      else if (tx.type === 'expense') cashChange = -amount
    }

    const isExcluded = isExcludeAnalyticsTx(tx)

    const applyToRow = (row) => {
      if (!row) return
      row.cashNet = (row.cashNet || 0) + cashChange
      if (isAdj) {
        row.adjustment = (row.adjustment || 0) + amount
      } else if (isSrcActive) {
        if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          tx.splitItems.forEach((si) => {
            const itemTx = {
              ...tx,
              ...si,
              category: si.category || tx.category,
              isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
              isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
              excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            }
            if (isExcludeAnalyticsTx(itemTx)) return
            const itemAmt = convertCurrency(toSafeNumber(si.amount), si.currency || tx.currency || defaultCurrency, defaultCurrency, rates)
            const itemType = si.type || tx.type
            row[itemType] = (row[itemType] || 0) + itemAmt
          })
        } else if (!isExcluded) {
          row[tx.type] = (row[tx.type] || 0) + amount
        }
      }
    }

    applyToRow(map1w.get(txDate))
    applyToRow(map1m.get(txDate))
    applyToRow(map3m.get(txDate))

    const monthKey = txDate.slice(0, 7)
    applyToRow(mapYtd.get(monthKey))
    applyToRow(map1y.get(monthKey))
    applyToRow(mapAll.get(monthKey))
  })

  const calcNet = (arr) =>
    arr.forEach((r) => {
      r.net = r.cashNet !== undefined ? r.cashNet : ((r.income || 0) - (r.expense || 0) + (r.adjustment || 0))
    })
  calcNet(data1w)
  calcNet(data1m)
  calcNet(data3m)
  calcNet(dataYtd)
  calcNet(data1y)
  calcNet(dataAll)

  return {
    data1w,
    data1m,
    data3m,
    dataYtd,
    data1y,
    dataAll,
  }
}

export function calculateSevenDaysStats(data1w = []) {
  if (!Array.isArray(data1w)) return { income: 0, expense: 0, net: 0 }
  let income = 0
  let expense = 0
  for (const d of data1w) {
    income += Number(d.income) || 0
    expense += Number(d.expense) || 0
  }
  return {
    income,
    expense,
    net: income - expense,
  }
}

export function buildRevenueSeries({
  rangeId,
  chartData,
  computeCashBalanceBeforeDate,
  portfolioValue = 0,
  netLoanPosition = 0,
  totalSavings = 0,
  normalizedTransactions = [],
  activeWalletIdSet = new Set(),
  walletCurrencyMap = new Map(),
  defaultCurrency = 'IDR',
  rates = null,
}) {
  if (rangeId === '1d') {
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const startBalance = computeCashBalanceBeforeDate(todayKey) + portfolioValue + netLoanPosition + totalSavings
    const hourNet = calculate1DHourlyFlow(
      normalizedTransactions,
      todayKey,
      activeWalletIdSet,
      walletCurrencyMap,
      defaultCurrency,
      rates,
    )

    const startOfToday = new Date(`${todayKey}T00:00:00`).getTime()
    const currentHour = new Date().getHours()
    let running = startBalance
    return Array.from({ length: currentHour + 1 }, (_, hour) => {
      running += toSafeNumber(hourNet[hour])
      return { time: startOfToday + hour * 60 * 60 * 1000, value: running }
    })
  }

  let sourceData = []
  let isMonthly = false

  if (rangeId === '1w') sourceData = chartData?.data1w || []
  else if (rangeId === '1m') sourceData = chartData?.data1m || []
  else if (rangeId === '3m') sourceData = chartData?.data3m || []
  else if (rangeId === 'ytd') {
    sourceData = chartData?.dataYtd || []
    isMonthly = true
  } else if (rangeId === '1y') {
    sourceData = chartData?.data1y || []
    isMonthly = true
  } else if (rangeId === 'all') {
    sourceData = chartData?.dataAll || []
    isMonthly = true
  }

  if (!sourceData || sourceData.length === 0) return []

  const firstItem = sourceData[0]
  const startDate = rangeId === 'ytd'
    ? format(startOfYear(new Date()), 'yyyy-MM-01')
    : (isMonthly ? `${firstItem.key}-01` : firstItem.date)
  const startBalance = (startDate ? computeCashBalanceBeforeDate(startDate) : 0) + portfolioValue + netLoanPosition + totalSavings

  let running = startBalance
  return sourceData.map((row) => {
    running += toSafeNumber(row.net)
    const dateStr = isMonthly ? `${row.key}-01T12:00:00` : (typeof row.date === 'string' && row.date.length === 10 ? `${row.date}T12:00:00` : row.date)
    const timeMs = new Date(dateStr).getTime()
    return { time: timeMs, value: running }
  })
}

export function buildPreviousPeriodRevenueSeries({
  rangeId,
  currentSeries = [],
  normalizedTransactions = [],
  computeCashBalanceBeforeDate,
  portfolioValue = 0,
  netLoanPosition = 0,
  totalSavings = 0,
}) {
  if (!currentSeries || currentSeries.length === 0) return []
  const safeTx = normalizedTransactions || []

  if (rangeId === '1d') {
    const yesterday = subDays(new Date(), 1)
    const yesterdayKey = format(yesterday, 'yyyy-MM-dd')
    const startBalanceYesterday = computeCashBalanceBeforeDate(yesterdayKey) + portfolioValue + netLoanPosition + totalSavings

    const hourNetYesterday = Array.from({ length: 24 }, () => 0)
    safeTx.forEach((tx) => {
      if (String(tx?.date || '') !== yesterdayKey) return
      const amount = tx.convertedAmount || 0
      const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
      const fallbackMs = Number(new Date(`${yesterdayKey}T12:00:00`).getTime())
      const txMs = Number.isFinite(Number(tx?.createdAt)) ? Number(tx.createdAt) : fallbackMs
      const hour = new Date(txMs).getHours()
      if (hour >= 0 && hour <= 23) hourNetYesterday[hour] += signed
    })

    let running = startBalanceYesterday
    const yesterdayHourly = Array.from({ length: 24 }, (_, hour) => {
      running += toSafeNumber(hourNetYesterday[hour])
      return running
    })

    return currentSeries.map((item) => {
      const timeMs = Number(item?.time)
      const dateObj = Number.isFinite(timeMs) ? new Date(timeMs) : new Date()
      const hour = isNaN(dateObj.getTime()) ? 0 : dateObj.getHours()
      const prevVal = yesterdayHourly[Math.min(23, Math.max(0, hour))] ?? startBalanceYesterday
      return {
        ...item,
        prevValue: prevVal,
        prevLabel: `${format(yesterday, 'dd MMM')}, ${String(hour).padStart(2, '0')}:00`,
      }
    })
  }

  let daysBack = 7
  if (rangeId === '1w') daysBack = 7
  else if (rangeId === '1m') daysBack = 30
  else if (rangeId === '3m') daysBack = 90

  if (['1w', '1m', '3m'].includes(rangeId)) {
    const today = new Date()
    const prevDates = Array.from({ length: daysBack }, (_, idx) => {
      const d = subDays(today, daysBack * 2 - 1 - idx)
      return format(d, 'yyyy-MM-dd')
    })

    const startPrevDate = prevDates[0]
    const startBalancePrev = computeCashBalanceBeforeDate(startPrevDate) + portfolioValue + netLoanPosition + totalSavings

    const prevDailyNetMap = new Map(prevDates.map((d) => [d, 0]))
    safeTx.forEach((tx) => {
      const d = tx?.date
      if (prevDailyNetMap.has(d)) {
        const amount = tx.convertedAmount || 0
        const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
        prevDailyNetMap.set(d, prevDailyNetMap.get(d) + signed)
      }
    })

    let running = startBalancePrev
    const prevRunningArray = prevDates.map((d) => {
      running += prevDailyNetMap.get(d) || 0
      return { date: d, value: running }
    })

    return currentSeries.map((item, idx) => {
      const prevData = prevRunningArray[idx] || prevRunningArray[prevRunningArray.length - 1]
      let prevLabel = ''
      if (prevData?.date) {
        const rawPrevDate = typeof prevData.date === 'string' && prevData.date.length === 10 ? `${prevData.date}T12:00:00` : prevData.date
        const dateObj = new Date(rawPrevDate)
        if (!isNaN(dateObj.getTime())) {
          prevLabel = format(dateObj, 'dd MMM yyyy')
        }
      }
      return {
        ...item,
        prevValue: prevData?.value ?? startBalancePrev,
        prevLabel,
      }
    })
  }

  if (rangeId === 'ytd') {
    const currentYear = new Date().getFullYear()
    const prevYear = currentYear - 1
    const monthsCount = new Date().getMonth() + 1
    const prevMonths = Array.from({ length: monthsCount }, (_, idx) => {
      const m = String(idx + 1).padStart(2, '0')
      return `${prevYear}-${m}`
    })

    const startBalancePrev = computeCashBalanceBeforeDate(`${prevMonths[0]}-01`) + portfolioValue + netLoanPosition + totalSavings
    const prevMonthlyNetMap = new Map(prevMonths.map((m) => [m, 0]))
    safeTx.forEach((tx) => {
      const m = String(tx?.date || '').slice(0, 7)
      if (prevMonthlyNetMap.has(m)) {
        const amount = tx.convertedAmount || 0
        const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
        prevMonthlyNetMap.set(m, prevMonthlyNetMap.get(m) + signed)
      }
    })

    let running = startBalancePrev
    const prevRunningArray = prevMonths.map((m) => {
      running += prevMonthlyNetMap.get(m) || 0
      return { month: m, value: running }
    })

    return currentSeries.map((item, idx) => {
      const prevData = prevRunningArray[idx] || prevRunningArray[prevRunningArray.length - 1]
      let prevLabel = ''
      if (prevData?.month) {
        const dateObj = new Date(`${prevData.month}-01T12:00:00`)
        if (!isNaN(dateObj.getTime())) {
          prevLabel = format(dateObj, 'MMM yyyy')
        }
      }
      return {
        ...item,
        prevValue: prevData?.value ?? startBalancePrev,
        prevLabel,
      }
    })
  }

  if (rangeId === '1y' || rangeId === 'all') {
    const totalMonths = currentSeries.length || 12
    const today = new Date()
    const prevMonths = Array.from({ length: totalMonths }, (_, idx) => {
      const d = subMonths(startOfMonth(today), totalMonths * 2 - 1 - idx)
      return format(d, 'yyyy-MM')
    })

    const firstMonth = prevMonths[0]
    const startBalancePrev = (firstMonth ? computeCashBalanceBeforeDate(`${firstMonth}-01`) : 0) + portfolioValue + netLoanPosition + totalSavings
    const prevMonthlyNetMap = new Map(prevMonths.map((m) => [m, 0]))
    safeTx.forEach((tx) => {
      const m = String(tx?.date || '').slice(0, 7)
      if (prevMonthlyNetMap.has(m)) {
        const amount = tx.convertedAmount || 0
        const signed = tx.type === 'income' ? amount : tx.type === 'expense' ? -amount : 0
        prevMonthlyNetMap.set(m, prevMonthlyNetMap.get(m) + signed)
      }
    })

    let running = startBalancePrev
    const prevRunningArray = prevMonths.map((m) => {
      running += prevMonthlyNetMap.get(m) || 0
      return { month: m, value: running }
    })

    return currentSeries.map((item, idx) => {
      const prevData = prevRunningArray[idx] || prevRunningArray[prevRunningArray.length - 1]
      let prevLabel = ''
      if (prevData?.month) {
        const dateObj = new Date(`${prevData.month}-01T12:00:00`)
        if (!isNaN(dateObj.getTime())) {
          prevLabel = format(dateObj, 'MMM yyyy')
        }
      }
      return {
        ...item,
        prevValue: prevData?.value ?? startBalancePrev,
        prevLabel,
      }
    })
  }

  return currentSeries
}

export function calculateRangedSummaryStats({ range, todayIncome = 0, todayStats = null, chartData = {} }) {
  if (range === '1d') {
    return {
      income: todayIncome,
      expense: todayIncome - (todayStats?.todayNet ?? 0),
      net: todayStats?.todayNet ?? 0,
    }
  }

  let sourceData = null
  if (range === '1w') sourceData = chartData?.data1w
  else if (range === '1m') sourceData = chartData?.data1m
  else if (range === '3m') sourceData = chartData?.data3m
  else if (range === 'ytd') sourceData = chartData?.dataYtd
  else if (range === '1y') sourceData = chartData?.data1y
  else if (range === 'all') sourceData = chartData?.dataAll

  if (!sourceData) return { income: 0, expense: 0, net: 0 }

  return sourceData.reduce(
    (acc, r) => {
      acc.income += r.income || 0
      acc.expense += r.expense || 0
      acc.net += (r.income || 0) - (r.expense || 0)
      return acc
    },
    { income: 0, expense: 0, net: 0 },
  )
}

export function calculateZoomPeakAndFloor({ zoomRevenueSeries = [], net = 0, zoomRevenueRange = '1m' }) {
  if (!zoomRevenueSeries || zoomRevenueSeries.length === 0) {
    return { max: 0, min: 0, avgRateStr: '-', netRate: 0 }
  }
  const vals = zoomRevenueSeries.map((d) => d.value).filter((v) => Number.isFinite(v))
  if (vals.length === 0) return { max: 0, min: 0, avgRateStr: '-', netRate: 0 }
  const max = Math.max(...vals)
  const min = Math.min(...vals)

  let unitKey = 'day'
  let unitLabel = 'hari'
  let duration = 30

  if (zoomRevenueRange === '1d') {
    unitKey = 'hour'
    unitLabel = 'jam'
    duration = 24
  } else if (zoomRevenueRange === '1w') {
    unitKey = 'day'
    unitLabel = 'hari'
    duration = 7
  } else if (zoomRevenueRange === '1m') {
    unitKey = 'day'
    unitLabel = 'hari'
    duration = 30
  } else if (zoomRevenueRange === '3m') {
    unitKey = 'day'
    unitLabel = 'hari'
    duration = 90
  } else if (zoomRevenueRange === 'ytd') {
    unitKey = 'month'
    unitLabel = 'bulan'
    duration = Math.max(1, new Date().getMonth() + 1)
  } else if (zoomRevenueRange === '1y') {
    unitKey = 'month'
    unitLabel = 'bulan'
    duration = 12
  } else if (zoomRevenueRange === 'all') {
    unitKey = 'month'
    unitLabel = 'bulan'
    duration = Math.max(1, vals.length)
  }

  const rate = Math.round(net / duration)
  return { max, min, unitKey, unitLabel, netRate: rate }
}

export function calculateComparisonSummary(zoomCombinedChartSeries = [], comparePrevious = false) {
  if (!comparePrevious || !zoomCombinedChartSeries || zoomCombinedChartSeries.length === 0) return null

  const first = zoomCombinedChartSeries[0]
  const last = zoomCombinedChartSeries[zoomCombinedChartSeries.length - 1]
  const currentEndVal = toSafeNumber(last?.value)
  const currentStartVal = toSafeNumber(first?.value)
  const currentNet = currentEndVal - currentStartVal

  const prevEndVal = toSafeNumber(last?.prevValue)
  const prevStartVal = toSafeNumber(first?.prevValue)
  const prevNet = prevEndVal - prevStartVal

  const diff = currentNet - prevNet
  const isPositive = diff >= 0

  return {
    currentNet,
    prevNet,
    diff,
    isPositive,
    currentEndVal,
    prevEndVal,
  }
}
