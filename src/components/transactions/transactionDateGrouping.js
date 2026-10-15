import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { convertCurrency, formatCurrency, isExcludeAnalyticsTx, toSafeNumber } from '../../lib/utils'

function getTxSafeTimestamp(tx) {
  if (!tx?.createdAt) return 0
  const num = Number(tx.createdAt)
  if (Number.isFinite(num)) return num
  if (typeof tx.createdAt === 'string') {
    const parsed = Date.parse(tx.createdAt)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function getIntradaySortKey(tx) {
  if (tx?.time && typeof tx.time === 'string' && tx.time.trim()) {
    return tx.time.trim().slice(0, 5)
  }
  const ts = getTxSafeTimestamp(tx)
  if (ts > 0) {
    try {
      const d = new Date(ts)
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      }
    } catch {
      // fallback
    }
  }
  return ''
}

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

    const itemsWithKeys = items.map((item) => {
      let score = -1
      if (item?.time && typeof item.time === 'string' && item.time.trim()) {
        const trimmed = item.time.trim()
        if (trimmed.length >= 4) {
          const hh = parseInt(trimmed.slice(0, 2), 10) || 0
          const mm = parseInt(trimmed.slice(3, 5), 10) || 0
          score = hh * 60 + mm
        }
      } else {
        const ts = getTxSafeTimestamp(item)
        if (ts > 0) {
          const d = new Date(ts)
          score = d.getHours() * 60 + d.getMinutes()
        }
      }
      return {
        item,
        score,
        ts: getTxSafeTimestamp(item),
        idNum: Number(item?.id) || 0,
        idStr: String(item?.id || ''),
      }
    })

    itemsWithKeys.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.ts !== b.ts) return b.ts - a.ts
      if (a.idNum && b.idNum && a.idNum !== b.idNum) return b.idNum - a.idNum
      return b.idStr.localeCompare(a.idStr)
    })

    const sortedItems = itemsWithKeys.map((k) => k.item)

    const net = totalIncome - totalExpense
    let dailySummaryText = ''
    if (net > 0) {
      dailySummaryText = `+${formatCurrency(net, defaultCurrency)}`
    } else if (net < 0) {
      dailySummaryText = `-${formatCurrency(Math.abs(net), defaultCurrency)}`
    } else if (totalIncome > 0 && totalExpense > 0) {
      dailySummaryText = formatCurrency(0, defaultCurrency)
    }

    return {
      dateKey,
      items: sortedItems,
      dateLabel,
      dailySummaryText,
      isPositive: net > 0,
    }
  })
}
