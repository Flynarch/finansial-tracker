import { useState, useMemo } from 'react'
import {
  Coins,
  RefreshCw,
  ArrowRightLeft,
  Check,
} from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import {
  formatCurrency,
  convertCurrency,
  formatMoneyInput,
  parseMoneyInput,
  FALLBACK_EXCHANGE_RATES,
} from '../../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../../lib/api'
import { currencyOptions } from './settingsConstants'
import { SettingsSection } from './settingsComponents'

const SUPPORTED_CURRENCIES = [
  { code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp', country: 'Indonesia' },
  { code: 'USD', name: 'US Dollar', symbol: '$', country: 'Amerika Serikat' },
  { code: 'EUR', name: 'Euro', symbol: '€', country: 'Uni Eropa' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', country: 'Singapura' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', country: 'Malaysia' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', country: 'Jepang' },
  { code: 'GBP', name: 'British Pound', symbol: '£', country: 'Inggris' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', country: 'Australia' },
]

export default function SettingsCurrency() {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const setDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)

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

  const refreshRates = async () => {
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
  }

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

  const tickerCurrencies = useMemo(() => {
    return SUPPORTED_CURRENCIES.filter((c) => c.code !== defaultCurrency)
  }, [defaultCurrency])

  return (
    <>
      {/* Hero Overview Card */}
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
              <Coins className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
                Kurs & Konversi Valuta Asing
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span>Pembaruan real-time • {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshRates}
            disabled={isLoading}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2 text-xs font-extrabold text-[var(--fg)] hover:border-[var(--border-strong)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            title={t('currency.refreshRates', 'Segarkan Nilai Kurs')}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[var(--accent)]' : 'text-[var(--muted)]'}`} />
            <span className="hidden sm:inline">{isLoading ? 'Memuat...' : 'Segarkan'}</span>
          </button>
        </div>

        {/* Live Ticker Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 ft-hide-scrollbar pt-1 border-t border-[var(--border)]/60">
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
      </div>

      {/* Interactive Converter Calculator */}
      <SettingsSection
        label="Kalkulator Konversi Kurs"
        footnote="Kalkulasi menggunakan nilai tukar pasar valuta asing terkini."
      >
        <div className="ft-settings-cell space-y-4">
          {/* Source Input */}
          <div>
            <label className="block mb-1.5 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Dari (Mata Uang Asal)
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => setAmountInput(formatMoneyInput(e.target.value, fromCurrency))}
                  placeholder="0"
                  className="w-full h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-base font-black tabular-nums text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all shadow-2xs"
                />
              </div>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 text-xs sm:text-sm font-extrabold text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer shadow-2xs"
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
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] active:scale-90 transition-all cursor-pointer shadow-xs"
              title={t('currency.swapCurrencies', 'Tukar Mata Uang')}
            >
              <ArrowRightLeft className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Target Result */}
          <div>
            <label className="block mb-1.5 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Hasil Konversi
            </label>
            <div className="flex items-center gap-2.5">
              <div className="flex h-12 flex-1 items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 shadow-2xs">
                <span className="text-lg font-black tabular-nums text-[var(--accent)] truncate">
                  {formatCurrency(convertedResult, toCurrency)}
                </span>
              </div>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 text-xs sm:text-sm font-extrabold text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer shadow-2xs"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Formula info */}
          <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
            <span>Formula acuan saat ini:</span>
            <span className="font-extrabold text-[var(--fg)] tabular-nums">
              1 {fromCurrency} = {formatCurrency(unitRate, toCurrency)}
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* Default Currency Selection Card */}
      <SettingsSection
        label="Mata Uang Utama Aplikasi"
        footnote="Mata uang ini digunakan sebagai patokan utama pada dashboard, analitik, dan total saldo."
      >
        {currencyOptions.map((code) => {
          const item = SUPPORTED_CURRENCIES.find((c) => c.code === code) || {
            code,
            name: code,
            symbol: code,
            country: 'Global',
          }
          const isSelected = defaultCurrency === code

          return (
            <button
              key={code}
              type="button"
              onClick={() => setDefaultCurrency(code)}
              className="ft-settings-cell flex w-full cursor-pointer items-center justify-between gap-3 text-left transition hover:bg-[var(--field-bg)]/60"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] font-black text-sm text-[var(--fg)] shadow-2xs">
                  {item.symbol}
                </div>
                <div className="min-w-0">
                  <span className="block text-[14.5px] font-extrabold text-[var(--fg)] leading-tight">
                    {item.name}
                  </span>
                  <span className="block text-xs font-medium text-[var(--muted)] leading-tight mt-0.5">
                    {item.code} • {item.country}
                  </span>
                </div>
              </div>

              {isSelected ? (
                <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  Utama
                </span>
              ) : null}
            </button>
          )
        })}
      </SettingsSection>
    </>
  )
}
