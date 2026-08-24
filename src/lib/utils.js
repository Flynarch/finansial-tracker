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
})

/** Cache for Intl.NumberFormat instances keyed by locale+currency to avoid re-instantiation on every call. */
const _fmtCache = new Map()

export function formatCurrency(amount, currency = 'IDR', locale = 'id-ID') {
  const numeric = Number(amount || 0)
  const key = `${locale}:${currency}`
  let fmt = _fmtCache.get(key)
  if (!fmt) {
    const isIdr = currency === 'IDR'
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: isIdr ? 0 : 0,
      maximumFractionDigits: isIdr ? 0 : 2,
    })
    _fmtCache.set(key, fmt)
  }
  return fmt.format(Number.isFinite(numeric) ? numeric : 0)
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

  const sanitized = raw.replace(/[^\d,]/g, '')
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
  const raw = String(value ?? '')
  if (!raw) return 0
  if (currency === 'IDR') {
    return toSafeNumber(raw.replace(/[^\d]/g, ''))
  }

  const normalized = raw.replace(/\./g, '').replace(',', '.')
  return toSafeNumber(normalized)
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

  const amountInUsd = numericAmount / fromRate
  return amountInUsd * toRate
}

function escapeCsvValue(value) {
  const text = String(value ?? '')
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function toTransactionsCsv(rows) {
  const header = ['id', 'date', 'type', 'category', 'amount', 'currency', 'notes', 'walletId', 'walletName', 'targetWalletId', 'loanId', 'isExcludeFromAnalytics', 'tags']
  const body = rows.map((row) =>
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
      .join(','),
  )
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
  if (tx.isExcludeFromAnalytics || tx.excludeFromAnalytics) return true
  if (tx.type === 'balance_adjustment') return true
  if (LOAN_CATEGORIES.includes(tx.category)) return true
  return false
}

