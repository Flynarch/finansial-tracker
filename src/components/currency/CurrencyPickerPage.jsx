import { useState, useMemo } from 'react'
import { ChevronLeft, Search, Check, Globe } from 'lucide-react'
import { CURRENCIES, POPULAR_CURRENCY_CODES, getCurrencyName, getCurrencyCountry } from '../../data/currencies'
import CurrencyFlag from './CurrencyFlag'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'

export default function CurrencyPickerPage({ selectedCurrency = 'IDR', onSelect, onBack, title }) {
  useBackButton(onBack, Boolean(onBack))
  const { t, locale } = useTranslation()
  const [search, setSearch] = useState('')

  const filteredCurrencies = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CURRENCIES
    return CURRENCIES.filter((c) => {
      const matchCode = c.code.toLowerCase().includes(q)
      const matchNameEn = c.name.toLowerCase().includes(q)
      const matchNameId = c.nameId.toLowerCase().includes(q)
      const matchCountry = c.country.toLowerCase().includes(q) || c.countryId.toLowerCase().includes(q)
      const matchSymbol = c.symbol.toLowerCase().includes(q)
      return matchCode || matchNameEn || matchNameId || matchCountry || matchSymbol
    })
  }, [search])

  const popularCurrencies = useMemo(() => {
    return POPULAR_CURRENCY_CODES.map((code) => CURRENCIES.find((c) => c.code === code)).filter(Boolean)
  }, [])

  return (
    <div className="ft-page-enter min-h-full flex flex-col bg-[var(--bg)]">
      {/* ── Sticky Top Header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--panel-strong)]/95 backdrop-blur-xl border-b border-[var(--border)] shadow-xs">
        <div className="px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer active:scale-95 shrink-0"
              aria-label={t('common.back', 'Kembali')}
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>

            <div className="min-w-0 text-center flex-1">
              <h1 className="text-base font-black text-[var(--fg)] leading-tight truncate">
                {title || t('settings.selectDefaultCurrency', 'Pilih Mata Uang')}
              </h1>
              <p className="text-[11px] font-medium text-[var(--muted)] mt-0.5">
                {CURRENCIES.length} {t('settings.currenciesAvailable', 'mata uang tersedia')}
              </p>
            </div>

            <div className="w-9 shrink-0" />
          </div>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-[var(--muted)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('settings.searchCurrencyPlaceholder', 'Cari kode, negara, atau simbol...')}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 pl-10 pr-4 text-xs font-bold text-[var(--fg)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] transition shadow-2xs"
            />
          </div>
        </div>

        {/* Popular Quick Chips (only when not searching) */}
        {!search && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 sm:px-6 pb-3 pt-0.5 no-scrollbar">
            <span className="text-[10.5px] font-black text-[var(--muted)] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Globe size={12} strokeWidth={2.5} />
              {t('settings.popular', 'Populer')}:
            </span>
            {popularCurrencies.map((c) => {
              const isSelected = selectedCurrency === c.code
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onSelect(c.code)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold border transition-all cursor-pointer shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)] shadow-xs'
                      : 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border)] hover:border-[var(--accent)]'
                  }`}
                >
                  <CurrencyFlag code={c.code} size={16} />
                  <span>{c.code}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Currency List Section ────────────────────────────────────────── */}
      <div className="flex-1 px-4 sm:px-6 py-4 pb-28 max-w-2xl mx-auto w-full space-y-2">
        {filteredCurrencies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-8 text-center mt-4">
            <p className="text-xs font-bold text-[var(--muted)]">
              {t('settings.noCurrencyFound', 'Tidak ada mata uang yang cocok')}
            </p>
          </div>
        ) : (
          filteredCurrencies.map((c) => {
            const isSelected = selectedCurrency === c.code
            const currName = getCurrencyName(c.code, locale)
            const currCountry = getCurrencyCountry(c.code, locale)

            return (
              <button
                key={c.code}
                type="button"
                onClick={() => onSelect(c.code)}
                className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-left active:scale-[0.99] group ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs ring-2 ring-[var(--accent)]/20'
                    : 'border-[var(--border)] bg-[var(--panel-strong)] hover:border-[var(--border-strong)] shadow-card'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <CurrencyFlag code={c.code} size={40} className="shadow-2xs" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors truncate">
                        {currName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--field-bg)] border border-[var(--border)] text-[10px] font-black text-[var(--fg)] shrink-0">
                        {c.code}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--muted)] mt-0.5 truncate">
                      {currCountry} • <span className="font-bold text-[var(--fg)]">{c.symbol}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  {isSelected ? (
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-white shadow-2xs">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('common.choose', 'Pilih')}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
