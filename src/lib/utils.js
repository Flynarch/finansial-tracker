import { format } from 'date-fns'
import Decimal from 'decimal.js-light'
import { getDecryptedNoteSync } from './fieldEncryption'
export { getCachedCurrencyRates } from './api'

/** When live FX fetch fails: 1 USD = currency rates (approximate fallback). */
export const FALLBACK_EXCHANGE_RATES = Object.freeze({
  USD: 1,
  IDR: 16800,
  EUR: 0.95,
  SGD: 1.34,
  MYR: 4.45,
  JPY: 154.0,
  GBP: 0.79,
  AUD: 1.55,
  THB: 34.5,
  KRW: 1380,
  SAR: 3.75,
  VND: 25400,
  CNY: 7.25,
  HKD: 7.78,
  CAD: 1.38,
  CHF: 0.88,
  PHP: 57.5,
  INR: 84.5,
})

/** Cache for Intl.NumberFormat instances keyed by locale+currency to avoid re-instantiation on every call. */
const _fmtCache = new Map()

export function formatCurrency(amount, currency = 'IDR', locale = 'id-ID', options = {}) {
  const cleanCurrency = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'IDR'
  const cleanLocale = typeof locale === 'string' && locale.trim() ? locale.trim() : 'id-ID'
  const numeric = Number(amount || 0)
  const maxFractionDigits = options?.maxFractionDigits
  const minFractionDigits = options?.minFractionDigits
  const hasCustomFractions = maxFractionDigits !== undefined || minFractionDigits !== undefined

  const key = hasCustomFractions
    ? `${cleanLocale}:${cleanCurrency}:${minFractionDigits ?? ''}:${maxFractionDigits ?? ''}`
    : `${cleanLocale}:${cleanCurrency}`

  let fmt = _fmtCache.get(key)
  if (!fmt) {
    const zeroDecimalCurrencies = ['IDR', 'JPY', 'KRW', 'VND']
    const isZeroDecimal = zeroDecimalCurrencies.includes(cleanCurrency)
    const minDigits = minFractionDigits !== undefined ? minFractionDigits : (isZeroDecimal ? 0 : 2)
    const maxDigits = maxFractionDigits !== undefined ? maxFractionDigits : (isZeroDecimal ? 0 : 2)
    try {
      fmt = new Intl.NumberFormat(cleanLocale, {
        style: 'currency',
        currency: cleanCurrency,
        minimumFractionDigits: minDigits,
        maximumFractionDigits: Math.max(minDigits, maxDigits),
      })
    } catch (err){
      console.warn('[utils]', err)
      fmt = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    }
    _fmtCache.set(key, fmt)
  }
  return fmt.format(Number.isFinite(numeric) ? numeric : 0)
}

export function formatCompactCurrency(amount, currency = 'IDR', locale = 'id', includeSymbol = true) {
  const n = Number(amount || 0)
  if (!Number.isFinite(n)) {
    return formatCurrency(0, currency, locale)
  }

  const isEn = locale === 'en'
  const isIDR = currency === 'IDR'
  const prefix = includeSymbol ? (isIDR ? 'Rp\u00A0' : `${currency}\u00A0`) : ''

  if (!isIDR && currency !== 'USD') {
    return formatCurrency(n, currency, locale)
  }

  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const activeLocale = isEn ? 'en-US' : 'id-ID'

  const fmt = (val, maxDigits = 1) =>
    val.toLocaleString(activeLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: val % 1 === 0 ? 0 : maxDigits,
    })

  if (abs >= 1_000_000_000_000) {
    return `${sign}${prefix}${fmt(abs / 1_000_000_000_000, 1)}\u00A0T`
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${fmt(abs / 1_000_000_000, 1)}\u00A0${isEn ? 'B' : 'M'}`
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${fmt(abs / 1_000_000, 1)}\u00A0${isEn ? 'M' : 'jt'}`
  }
  if (abs >= 100_000) {
    return `${sign}${prefix}${fmt(abs / 1_000, 0)}\u00A0${isEn ? 'k' : 'rb'}`
  }
  return formatCurrency(n, currency, locale)
}

export function toSafeNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function formatGroupedIntegerInput(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '').slice(0, 15)
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

export function formatMoneyInput(value, currency = 'IDR') {
  const raw = String(value ?? '')
  if (currency === 'IDR') {
    return formatGroupedIntegerInput(raw)
  }

  // Support both '.' and ',' as decimal separators on foreign currencies
  let normalizedRaw = raw
  if (raw.includes('.') && !raw.includes(',')) {
    const lastDotIdx = raw.lastIndexOf('.')
    const intPart = raw.slice(0, lastDotIdx).replace(/\./g, '')
    const decPart = raw.slice(lastDotIdx + 1)
    normalizedRaw = `${intPart},${decPart}`
  }

  const sanitized = normalizedRaw.replace(/[^\d,]/g, '')
  const hasComma = sanitized.includes(',')
  const [rawInt = '', ...rawRest] = sanitized.split(',')
  const intDigits = rawInt.replace(/[^\d]/g, '').slice(0, 15)
  const decimalDigits = rawRest.join('').replace(/[^\d]/g, '').slice(0, 2)
  const groupedInt = intDigits ? Number(intDigits).toLocaleString('id-ID') : ''

  if (hasComma) {
    return `${groupedInt || '0'},${decimalDigits}`
  }
  return groupedInt
}

export function parseMoneyInput(value, currency = 'IDR') {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const isNegative = raw.startsWith('-') || /^\(.*\)$/.test(raw)
  if (currency === 'IDR') {
    const trimmed = raw.replace(/[^\d]+$/, '')
    // Support trailing sen: e.g. ,00, ,000, ,50, or .00, .50 (1-2 digits decimal, or 3 zero decimals after comma)
    const decimalMatch = trimmed.match(/^(.*?)(?:,(000)|[,.]([\d]{1,2}))$/)
    if (decimalMatch) {
      const intDigits = decimalMatch[1].replace(/[^\d]/g, '')
      const decDigits = decimalMatch[2] ? '0' : decimalMatch[3]
      const intNum = toSafeNumber(intDigits)
      const decNum = Number(`0.${decDigits}`)
      const total = intNum + (Number.isFinite(decNum) ? decNum : 0)
      return isNegative ? -total : total
    }
    const num = toSafeNumber(trimmed.replace(/[^\d]/g, ''))
    return isNegative ? -num : num
  }

  // Foreign currency: support both '1.234,50' (id-ID) and '1,234.50' (en-US) or '10.50' / '10,50'
  const clean = raw.replace(/[^\d.,]/g, '')
  let normalized = clean
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      normalized = clean.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = clean.replace(/,/g, '')
    }
  } else if (clean.includes(',')) {
    normalized = clean.replace(',', '.')
  } else if (clean.includes('.')) {
    normalized = clean
  }

  const num = toSafeNumber(normalized)
  return isNegative ? -num : num
}

export function formatMoneyValueForInput(value, currency = 'IDR') {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return ''
  if (currency === 'IDR') return formatGroupedIntegerInput(String(Math.trunc(numeric)))
  return numeric.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function getMoneyInputCaret(rawValue, formattedValue, rawCaret, currency = 'IDR') {
  const isToken = (char) => (currency === 'IDR' ? /\d/.test(char) : /[\d,]/.test(char))
  const raw = String(rawValue ?? '')
  const formatted = String(formattedValue ?? '')
  const safeCaret = Math.max(0, Math.min(Number(rawCaret ?? raw.length), raw.length))

  let tokenCount = 0
  for (let i = 0; i < safeCaret; i += 1) {
    if (isToken(raw[i])) tokenCount += 1
  }
  if (tokenCount <= 0) return 0

  let seen = 0
  for (let i = 0; i < formatted.length; i += 1) {
    if (isToken(formatted[i])) {
      seen += 1
      if (seen === tokenCount) return i + 1
    }
  }
  return formatted.length
}

export function convertCurrency(amount, fromCurrency = 'IDR', toCurrency = 'IDR', rates = {}) {
  const numericAmount = toSafeNumber(amount)
  if (!fromCurrency || !toCurrency) return numericAmount
  if (fromCurrency === toCurrency) return numericAmount

  const effectiveRates = { ...FALLBACK_EXCHANGE_RATES, ...(rates || {}) }
  const fromRate = toSafeNumber(effectiveRates[fromCurrency])
  const toRate = toSafeNumber(effectiveRates[toCurrency])
  if (fromRate <= 0 || toRate <= 0) return numericAmount

  return new Decimal(numericAmount).dividedBy(fromRate).times(toRate).toNumber()
}

export function escapeCsvValue(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r') || text.startsWith("'")) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function toTransactionsCsv(rows) {
  const header = ['id', 'date', 'type', 'category', 'amount', 'currency', 'notes', 'walletId', 'walletName', 'targetWalletId', 'loanId', 'isExcludeFromAnalytics', 'tags']
  const body = []

  rows.forEach((row) => {
    if (row.isSplit && Array.isArray(row.splitItems) && row.splitItems.length > 0) {
      row.splitItems.forEach((item, idx) => {
        const itemType = item.type || row.type
        const itemNote = item.notes || row.notes || ''
        const splitNote = itemNote ? `[Split ${idx + 1}] ${itemNote}` : `[Split ${idx + 1}]`
        body.push(
          [
            `${row.id}-${idx + 1}`,
            row.date,
            itemType,
            item.category || row.category,
            item.amount,
            item.currency || row.currency,
            splitNote,
            row.walletId ?? '',
            row.walletName ?? '',
            row.targetWalletId ?? '',
            row.loanId ?? '',
            item.isExcludeAnalyticsTx || row.isExcludeFromAnalytics ? '1' : '0',
            Array.isArray(row.tags) ? row.tags.join(';') : '',
          ]
            .map(escapeCsvValue)
            .join(',')
        )
      })
    } else {
      body.push(
        [
          row.id,
          row.date,
          row.type,
          row.category,
          row.amount,
          row.currency,
          row.notes,
          row.walletId ?? '',
          row.walletName ?? '',
          row.targetWalletId ?? '',
          row.loanId ?? '',
          row.isExcludeFromAnalytics ? '1' : '0',
          Array.isArray(row.tags) ? row.tags.join(';') : '',
        ]
          .map(escapeCsvValue)
          .join(',')
      )
    }
  })

  return [header.join(','), ...body].join('\n')
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const LOAN_CATEGORIES = Object.freeze([
  'Pinjaman Diterima',
  'Pinjaman Diberikan',
  'Bayar Hutang',
  'Terima Piutang',
])

export function isExcludeAnalyticsTx(tx) {
  if (!tx) return false
  if (tx.deletedAt) return true
  if (tx.isExcludeAnalyticsTx || tx.isExcludeFromAnalytics || tx.excludeFromAnalytics) return true
  if (tx.isPendingReview === true || tx.isPendingReview === 1) return true
  if (Array.isArray(tx.tags) && (tx.tags.includes('exclude_analytics') || tx.tags.includes('excludeFromAnalytics'))) return true
  if (tx.type === 'balance_adjustment') return true
  if ((tx.loanId != null && !tx.isLoanExcess) || (tx.splitBillId != null && (LOAN_CATEGORIES.includes(tx.category) || tx.isExcludeAnalyticsTx))) return true
  if (LOAN_CATEGORIES.includes(tx.category)) return true
  if (['tabungan', 'cairkan_tabungan'].includes(tx.category)) return true
  if (typeof tx.category === 'string') {
    if (tx.category === 'investasi_pengeluaran' || tx.category.startsWith('investasi_pengeluaran/')) return true
    if (tx.category === 'investasi_penjualan' || tx.category.startsWith('investasi_penjualan/')) return true
    // Investment liquidation gross proceeds excluded from analytics, preserving dividend & interest yield
    if (
      tx.type === 'income' &&
      (tx.category === 'investasi' || tx.category.startsWith('investasi/')) &&
      !tx.category.includes('dividen') &&
      !tx.category.includes('bunga')
    ) {
      return true
    }
    const resolvedNotes = typeof tx.notes === 'string' ? getDecryptedNoteSync(tx.notes) : ''
    if (
      resolvedNotes &&
      (resolvedNotes.startsWith('Sell ') || resolvedNotes.startsWith('Buy ')) &&
      (tx.category === 'investasi' || tx.category.startsWith('investasi/'))
    ) {
      return true
    }
  }
  return false
}

export function safeFormatDate(val, formatPattern = 'dd MMM yyyy', options = {}) {
  if (!val) return ''
  try {
    let d
    if (typeof val === 'number') {
      d = new Date(val)
    } else if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!trimmed) return ''
      if (/^\d{11,15}$/.test(trimmed)) {
        d = new Date(Number(trimmed))
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, day] = trimmed.split('-').map(Number)
        d = new Date(y, m - 1, day)
        if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) {
          return ''
        }
      } else {
        d = new Date(trimmed)
      }
    } else if (val instanceof Date) {
      d = val
    } else {
      return ''
    }

    if (isNaN(d.getTime())) return ''
    return format(d, formatPattern, options)
  } catch (err) {
    console.error('[utils:formatSafeDate]', err)
    return ''
  }
}

/**
 * Standardized floating-point rounding for financial currency calculations.
 * Ensures consistent precision across all aggregation and ledger totals.
 *
 * @param {number|string} val
 * @returns {number}
 */
export function roundCurrency(val, currency = null) {
  const n = Number(val)
  if (!Number.isFinite(n)) return 0
  if (currency && typeof currency === 'string') {
    const cleanCurrency = currency.trim().toUpperCase()
    if (['IDR', 'JPY', 'KRW', 'VND'].includes(cleanCurrency)) {
      return new Decimal(n).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
    }
  }
  return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
}


