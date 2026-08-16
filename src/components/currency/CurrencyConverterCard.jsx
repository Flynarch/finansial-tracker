import { useState, useEffect, useMemo, useCallback } from 'react'
import { ArrowRightLeft, RefreshCw, TrendingUp } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import {
  formatCurrency,
  convertCurrency,
  formatMoneyInput,
  parseMoneyInput,
  FALLBACK_EXCHANGE_RATES,
} from '../../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../../lib/api'

const SUPPORTED_CURRENCIES = [
  { code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
]

export default function CurrencyConverterCard({ className = '' }) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => {
    try {
      const cached = localStorage.getItem('ft_rates_USD')
      if (cached) {
        const parsed = JSON.parse(cached)
        return parsed?.timestamp ? new Date(parsed.timestamp) : new Date()
      }
    } catch {
      // Ignore
    }
    return new Date()
  })

  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState(defaultCurrency || 'IDR')
  const [amountInput, setAmountInput] = useState('1')

  const refreshRates = useCallback(async () => {
    setIsLoading(true)
    try {
      const fresh = await fetchCurrencyRates('USD')
      setRates(fresh)
      setLastUpdated(new Date())
    } catch {
      setRates((prev) => prev || { ...FALLBACK_EXCHANGE_RATES })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    fetchCurrencyRates('USD')
      .then((fresh) => {
        if (!ignore && fresh) {
          setRates(fresh)
          setLastUpdated(new Date())
        }
      })
      .catch(() => {
        if (!ignore) {
          setRates((prev) => prev || { ...FALLBACK_EXCHANGE_RATES })
        }
      })
    return () => {
      ignore = true
    }
  }, [])

  const parsedAmount = useMemo(() => {
    return parseMoneyInput(amountInput, fromCurrency) || 0
  }, [amountInput, fromCurrency])

  const convertedResult = useMemo(() => {
    if (parsedAmount <= 0) return 0
    return convertCurrency(parsedAmount, fromCurrency, toCurrency, rates)
  }, [parsedAmount, fromCurrency, toCurrency, rates])

  const unitRate = useMemo(() => {
    return convertCurrency(1, fromCurrency, toCurrency, rates)
  }, [fromCurrency, toCurrency, rates])

  const handleSwap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  // Major currencies ticker against defaultCurrency
  const tickerCurrencies = useMemo(() => {
    return SUPPORTED_CURRENCIES.filter((c) => c.code !== defaultCurrency)
  }, [defaultCurrency])

  return (
    <div className={`rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[var(--fg)]">
              {t('settings.fxRatesTitle', 'Kurs & Konversi Mata Uang')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span>{t('settings.fxLiveBadge', 'Nilai tukar real-time')}</span>
              <span>•</span>
              <span>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshRates}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-extrabold text-[var(--fg)] hover:border-[var(--border-strong)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          title={t('settings.fxRefresh', 'Segarkan Kurs')}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[var(--accent)]' : 'text-[var(--muted)]'}`} />
          <span className="hidden sm:inline">{isLoading ? t('common.loading', 'Memuat...') : t('settings.fxRefreshBtn', 'Segarkan')}</span>
        </button>
      </div>

      {/* Live Ticker Scroll */}
      <div className="mb-4.5 flex items-center gap-2 overflow-x-auto pb-1 ft-hide-scrollbar">
        {tickerCurrencies.map((item) => {
          const rateToDefault = convertCurrency(1, item.code, defaultCurrency, rates)
          return (
            <div
              key={item.code}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold shadow-2xs"
            >
              <span className="text-[var(--muted-2)] font-black text-xs">{item.code}</span>
              <span className="text-[var(--muted)] text-xs">=</span>
              <span className="text-[var(--fg)] font-black tabular-nums">{formatCurrency(rateToDefault, defaultCurrency)}</span>
            </div>
          )
        })}
      </div>

      {/* Interactive Converter Form */}
      <div className="space-y-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/90 p-4">
        {/* Source Row */}
        <div>
          <label className="block mb-1.5 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            {t('settings.fxFrom', 'Dari')}
          </label>
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(formatMoneyInput(e.target.value, fromCurrency))}
                placeholder="0"
                className="w-full h-12 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2 text-base font-black tabular-nums text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all shadow-2xs"
              />
            </div>
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 text-xs sm:text-sm font-extrabold text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer shadow-2xs"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Button Divider */}
        <div className="flex items-center justify-center -my-1">
          <button
            type="button"
            onClick={handleSwap}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] active:scale-90 transition-all cursor-pointer shadow-xs"
            title={t('settings.fxSwap', 'Tukar Mata Uang')}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Target Row */}
        <div>
          <label className="block mb-1.5 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            {t('settings.fxTo', 'Hasil Konversi')}
          </label>
          <div className="flex items-center gap-2.5">
            <div className="flex h-12 flex-1 items-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 shadow-2xs">
              <span className="text-base sm:text-lg font-black tabular-nums text-[var(--accent)] truncate">
                {formatCurrency(convertedResult, toCurrency)}
              </span>
            </div>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 text-xs sm:text-sm font-extrabold text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer shadow-2xs"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Unit Formula Rate */}
        <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
          <span>{t('settings.fxFormula', 'Kurs saat ini:')}</span>
          <span className="font-extrabold text-[var(--fg)] tabular-nums">
            1 {fromCurrency} = {formatCurrency(unitRate, toCurrency)}
          </span>
        </div>
      </div>
    </div>
  )
}
