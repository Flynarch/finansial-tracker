import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { convertCurrency, formatCurrency, isExcludeAnalyticsTx, toSafeNumber } from '../../lib/utils'

/**
 * Groups a list of transactions by date (yyyy-MM-dd), calculates daily income/expense/net totals,
 * unpacks split items respecting analytics exclusions, and returns structured date sections.
 *
 * @param {Array} filteredTransactions
 * @param {Object} options
 * @param {string} options.locale
 * @param {string} options.defaultCurrency
 * @param {Object} options.rates
 * @param {Function} options.t
 * @returns {Array<{ dateKey: string, items: Array, dateLabel: string, dailySummaryText: string, isPositive: boolean }>}
 */
export function groupTransactionsDetailed(
  filteredTransactions = [],
  { locale = 'id', defaultCurrency = 'IDR', rates = {}, t = (k, f) => f || k } = {}
) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const safeList = Array.isArray(filteredTransactions) ? filteredTransactions : []
  const grouped = {}
  for (let i = 0; i < safeList.length; i++) {
    const tx = safeList[i]
    const key = tx.date ? String(tx.date).slice(0, 10) : 'unknown'
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(tx)
  }

  const sortedEntries = Object.entries(grouped).sort((a, b) => String(b[0]).localeCompare(String(a[0])))

  return sortedEntries.map(([dateKey, items]) => {
    const cleanDateKey = String(dateKey || '').slice(0, 10)
    let dateLabel
    if (cleanDateKey === todayStr) {
      dateLabel = t('tx.today', 'HARI INI')
    } else if (cleanDateKey === yesterdayStr) {
      dateLabel = t('tx.yesterday', 'KEMARIN')
    } else if (cleanDateKey !== 'unknown') {
      try {
        const dateObj = new Date(`${cleanDateKey}T12:00:00`)
        dateLabel = format(dateObj, 'EEEE, d MMMM yyyy', {
          locale: locale === 'en' ? enUS : idLocale,
        }).toUpperCase()
      } catch (err) {
        console.error('[Transactions:formatDate]', err)
        dateLabel = dateKey
      }
    } else {
      dateLabel = t('tx.unknownDate', 'Tanggal Tidak Diketahui')
    }

    let totalIncome = 0
    let totalExpense = 0

    for (const item of items) {
      if (item.isSplit && Array.isArray(item.splitItems) && item.splitItems.length > 0) {
        for (const si of item.splitItems) {
          const splitTxItem = {
            ...item,
            ...si,
            amount: toSafeNumber(si.amount),
            type: si.type || item.type,
            category: si.category || item.category,
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
          }
          if (isExcludeAnalyticsTx(splitTxItem)) continue
          const convertedAmount = convertCurrency(
            splitTxItem.amount,
            splitTxItem.currency || item.currency || defaultCurrency,
            defaultCurrency,
            rates
          )
          if (splitTxItem.type === 'income') totalIncome += convertedAmount
          else if (splitTxItem.type === 'expense') totalExpense += convertedAmount
        }
      } else {
        if (isExcludeAnalyticsTx(item)) continue
        const convertedAmount = convertCurrency(
          toSafeNumber(item.amount),
          item.currency || defaultCurrency,
          defaultCurrency,
          rates
        )
        if (item.type === 'income') totalIncome += convertedAmount
        else if (item.type === 'expense') totalExpense += convertedAmount
      }
    }

    const net = totalIncome - totalExpense
    let dailySummaryText = ''
    if (net > 0) {
      dailySummaryText = `+${formatCurrency(net, defaultCurrency)}`
    } else if (net < 0) {
      dailySummaryText = `-${formatCurrency(Math.abs(net), defaultCurrency)}`
    } else if (totalIncome > 0 && totalExpense > 0) {
      dailySummaryText = formatCurrency(0, defaultCurrency)
    } else if (totalExpense > 0) {
      dailySummaryText = `-${formatCurrency(totalExpense, defaultCurrency)}`
    }

    return {
      dateKey,
      items,
      dateLabel,
      dailySummaryText,
      isPositive: net > 0,
    }
  })
}
