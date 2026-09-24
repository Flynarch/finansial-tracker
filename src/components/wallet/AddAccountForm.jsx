import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Edit2, Check, ChevronRight } from 'lucide-react'
import { createWallet } from '../../services/walletService'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import { db } from '../../lib/db'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { formatMoneyInput, formatMoneyValueForInput, parseMoneyInput } from '../../lib/utils'
import CurrencyFlag from '../currency/CurrencyFlag'
import CurrencyPickerPage from '../currency/CurrencyPickerPage'
import { getCurrencyName, getCurrencyCountry, getCurrencySymbol } from '../../data/currencies'

export default function AddAccountForm({ institution, onBack, onSuccess }) {
  useBackButton(onBack, Boolean(onBack))
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const initialCurrency =
    institution?.defaultCurrency ||
    (institution?.id === 'paypal' ||
    institution?.id === 'wise' ||
    institution?.id === 'revolut' ||
    institution?.id === 'binance' ||
    institution?.id === 'bybit' ||
    institution?.name?.toLowerCase().includes('paypal')
      ? 'USD'
      : 'IDR')

  const [name, setName] = useState(institution ? institution.name : t('wallets.newAccount', 'Akun Baru'))
  const [isEditingName, setIsEditingName] = useState(!institution)
  const [currency, setCurrency] = useState(initialCurrency)
  const [isSelectingCurrency, setIsSelectingCurrency] = useState(false)
  const balanceInputRef = useRef(null)

  const [displayBalance, setDisplayBalance] = useState('')
  const [rawBalance, setRawBalance] = useState(0)

  const isCustomAccount = !institution

  const handleBalanceChange = (e) => {
    const formatted = formatMoneyInput(e.target.value, currency)
    setDisplayBalance(formatted)
    setRawBalance(parseMoneyInput(formatted, currency))
  }

  const getInitials = (text) => (text ? text.substring(0, 2).toUpperCase() : '')

  const isFormValid = name.trim().length > 0

  const isCashInstitution =
    institution?.id === 'cash' ||
    institution?.customIcon === 'dollar' ||
    institution?.customIcon === 'cash' ||
    String(institution?.name || name || '').toLowerCase().includes('uang tunai') ||
    String(institution?.name || name || '').toLowerCase().includes('cash')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    const newId = await createWallet({
      name,
      institutionType: institution ? institution.type : 'lainnya',
      logoUrl: isCashInstitution ? null : institution ? institution.logoUrl : null,
      customIcon: isCashInstitution ? 'dollar' : institution ? institution.customIcon : null,
      currency,
      balance: rawBalance,
      createdAt: Date.now(),
    })

    const allWallets = await db.wallets.toArray()
    const currentDefaultId = useSettingsStore.getState().defaultWalletId
    if (!currentDefaultId || allWallets.length === 1) {
      await useSettingsStore.getState().setDefaultWalletId(newId)
    }

    if (onSuccess) {
      onSuccess(newId)
    } else {
      navigate(`/wallet/${newId}`)
    }
  }

  if (isSelectingCurrency) {
    return (
      <CurrencyPickerPage
        selectedCurrency={currency}
        title={t('wallets.selectWalletCurrency', 'Pilih Mata Uang Dompet')}
        onBack={() => setIsSelectingCurrency(false)}
        onSelect={(newCurrency) => {
          setCurrency(newCurrency)
          setIsSelectingCurrency(false)
          if (rawBalance > 0) {
            const formatted = formatMoneyValueForInput(rawBalance, newCurrency)
            setDisplayBalance(formatted)
          }
        }}
      />
    )
  }

  return (
    <div className="ft-page-enter min-h-full flex flex-col bg-[var(--bg)]">
      {/* ── Top App Bar Navigation ────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[var(--panel-strong)]/90 backdrop-blur-xl pt-[max(env(safe-area-inset-top,0px),0.75rem)] border-b border-[var(--border)] shadow-xs">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
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
              {institution ? institution.name : t('wallets.newAccount', 'Akun Baru')}
            </h1>
            <p className="text-[11px] font-medium text-[var(--muted)] mt-0.5 truncate">
              {institution ? t('wallets.configureWallet', 'Atur detail & saldo awal') : t('wallets.customAccount', 'Akun Kustom')}
            </p>
          </div>

          <div className="w-9 shrink-0" />
        </div>
      </div>

      {/* ── Main Form Body ────────────────────────────────────────────── */}
      <div className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 pt-5 pb-36 space-y-5">
        {/* ── Hero Account & Balance Card ─────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 sm:p-6 shadow-card transition-all">
          {/* Top Row: Account Identity */}
          <div className="flex items-center gap-3.5 mb-6">
            {/* Logo Avatar */}
            <div className="w-13 h-13 rounded-2xl bg-[var(--wallet-logo-bg,var(--field-bg))] border border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
              {isCashInstitution ? (
                <div className="w-full h-full flex items-center justify-center text-amber-500 p-2">
                  <MoneyBagIcon size={26} strokeWidth={2.5} />
                </div>
              ) : institution?.logoUrl ? (
                <img
                  src={institution.logoUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div
                className="w-full h-full flex items-center justify-center font-black text-base text-[var(--fg)]"
                style={{ display: isCashInstitution || institution?.logoUrl ? 'none' : 'flex' }}
              >
                {getInitials(name)}
              </div>
            </div>

            {/* Name & Type */}
            <div className="min-w-0 flex-1">
              {isCustomAccount ? (
                isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] rounded-xl px-3 py-1.5 text-base font-black text-[var(--fg)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--ring)] w-full transition"
                      autoFocus
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="h-8 w-8 grid place-items-center bg-[var(--fg)] text-[var(--bg)] rounded-xl shadow-2xs cursor-pointer active:scale-95 shrink-0"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="flex items-center gap-2 text-left group cursor-pointer"
                  >
                    <h2 className="text-lg font-black text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {name}
                    </h2>
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--muted)] group-hover:text-[var(--accent)] transition shrink-0">
                      <Edit2 size={12} strokeWidth={2.2} />
                    </span>
                  </button>
                )
              ) : (
                <h2 className="text-lg font-black text-[var(--fg)] truncate">{name}</h2>
              )}

              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block rounded-md bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  {institution ? institution.type : t('wallets.customAccount', 'Akun Kustom')}
                </span>
                <span className="text-[11px] font-semibold text-[var(--muted)]">
                  {getCurrencyName(currency, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border)]/60 my-4" />

          {/* Amount Hero Input */}
          <div
            onClick={() => balanceInputRef.current?.focus()}
            className="pt-1 cursor-text"
          >
            <label htmlFor="wallet-initial-balance" className="block text-[11px] font-black text-[var(--muted)] uppercase tracking-wider mb-2 select-none">
              {t('wallets.initialBalance', 'Saldo Awal')}
            </label>

            <div className="flex items-center gap-2.5 py-2 px-3.5 rounded-2xl bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)] transition-all shadow-inner">
              <span className="text-2xl sm:text-3xl font-extrabold text-[var(--muted)] select-none shrink-0 tabular-nums leading-none">
                {getCurrencySymbol(currency)}
              </span>
              <input
                ref={balanceInputRef}
                id="wallet-initial-balance"
                type="text"
                inputMode="numeric"
                value={displayBalance}
                onChange={handleBalanceChange}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 150)
                }}
                placeholder="0"
                style={{
                  fontSize: 'clamp(28px, 7.5vw, 38px)',
                  fontWeight: 800,
                  lineHeight: '1.15',
                  height: '48px',
                }}
                className="ft-wallet-balance-input w-full bg-transparent font-extrabold text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)] tracking-tight tabular-nums"
              />
            </div>
            <p className="text-[11px] font-medium text-[var(--muted)] mt-2">
              {t('wallets.initialBalanceHint', 'Masukkan saldo yang saat ini Anda miliki di rekening/dompet ini')}
            </p>
          </div>
        </div>

        {/* ── Configuration Settings Group ────────────────────────────── */}
        <div className="space-y-2">
          <span className="block text-[11px] font-black text-[var(--muted)] uppercase tracking-wider pl-1 select-none">
            {t('settings.walletPreferences', 'Pengaturan Rekening')}
          </span>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden shadow-card divide-y divide-[var(--border)]/60">
            {/* Currency Selector Row */}
            <button
              type="button"
              onClick={() => setIsSelectingCurrency(true)}
              className="w-full flex items-center justify-between p-4 bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition-all cursor-pointer text-left active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <CurrencyFlag code={currency} size={36} className="shadow-2xs" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {getCurrencyName(currency, locale)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[var(--field-bg)] border border-[var(--border)] text-[10px] font-black text-[var(--fg)] shrink-0">
                      {currency}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--muted)] mt-0.5 truncate">
                    {getCurrencyCountry(currency, locale)} • <span className="font-extrabold text-[var(--fg)]">{getCurrencySymbol(currency)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors shrink-0 pl-2">
                <span className="text-xs font-bold">{t('common.change', 'Ubah')}</span>
                <ChevronRight size={16} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Fixed Action Button ─────────────────────────────────── */}
      <div className="p-4 bg-[var(--panel-strong)] border-t border-[var(--border)] mt-auto sticky bottom-0 z-30 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="max-w-xl mx-auto w-full">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full py-4 rounded-2xl bg-[var(--fg)] text-[var(--bg)] font-black text-sm shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {t('wallets.saveNewAccount', 'Simpan Akun Baru')}
          </button>
        </div>
      </div>
    </div>
  )
}
