import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Edit2, Check, ChevronDown, XCircle } from 'lucide-react'
import useWalletStore from '../../store/useWalletStore'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { formatMoneyInput, parseMoneyInput } from '../../lib/utils'

export default function AddAccountForm({ institution, onBack, onSuccess }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const createWallet = useWalletStore((state) => state.createWallet)

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

  const [name, setName] = useState(institution ? institution.name : 'Akun Baru')
  const [isEditingName, setIsEditingName] = useState(!institution)
  const [currency, setCurrency] = useState(initialCurrency)

  const [displayBalance, setDisplayBalance] = useState('')
  const [rawBalance, setRawBalance] = useState(0)

  const isCustomAccount = !institution

  const handleBalanceChange = (e) => {
    const formatted = formatMoneyInput(e.target.value, currency)
    setDisplayBalance(formatted)
    setRawBalance(parseMoneyInput(formatted, currency))
  }

  const clearBalance = () => {
    setDisplayBalance('')
    setRawBalance(0)
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

    const currentDefaultId = useSettingsStore.getState().defaultWalletId
    if (!currentDefaultId) {
      await useSettingsStore.getState().setDefaultWalletId(newId)
    }

    if (onSuccess) {
      onSuccess(newId)
    } else {
      navigate(`/wallet/${newId}`)
    }
  }

  return (
    <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)]">
      {/* ── Top Hero Header ────────────────────────────────────────────── */}
      <div className="relative bg-[var(--panel-strong)] pt-5 pb-7 px-5 rounded-b-3xl shrink-0 border-b border-[var(--border)] shadow-xs z-10">
        {/* Header Navigation */}
        <div className="relative z-10 flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer active:scale-95"
            aria-label={t('common.back', 'Kembali')}
          >
            <ChevronLeft size={20} strokeWidth={2.2} />
          </button>

          <span className="rounded-full bg-[var(--field-bg)] border border-[var(--border)] px-4 py-1 text-xs font-black text-[var(--fg)]">
            {institution ? institution.name : 'Akun Kustom'}
          </span>

          <div className="w-9" />
        </div>

        {/* Logo & Name Input */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            {/* Logo Circle */}
            <div className="w-14 h-14 rounded-full bg-[var(--wallet-logo-bg,var(--field-bg))] border-[0.5px] border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              {isCashInstitution ? (
                <div className="w-full h-full flex items-center justify-center text-amber-500 p-2">
                  <MoneyBagIcon size={30} strokeWidth={2.5} />
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
                className="w-full h-full flex items-center justify-center font-black text-lg text-[var(--fg)]"
                style={{ display: isCashInstitution || institution?.logoUrl ? 'none' : 'flex' }}
              >
                {getInitials(name)}
              </div>
            </div>

            {/* Name Editor: Only editable if custom account */}
            {isCustomAccount ? (
              isEditingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-transparent border-b-2 border-[var(--fg)] text-[var(--fg)] font-black text-2xl w-48 text-center outline-none transition pb-0.5"
                    autoFocus
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="p-1.5 bg-[var(--fg)] text-[var(--bg)] rounded-full shadow-xs cursor-pointer active:scale-95"
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 mt-1 cursor-pointer group"
                  onClick={() => setIsEditingName(true)}
                >
                  <h2 className="text-2xl font-black text-[var(--fg)] tracking-tight">{name}</h2>
                  <div className="p-1 rounded-lg bg-[var(--field-bg)] border border-[var(--border)] group-hover:bg-[var(--border)]/40 transition">
                    <Edit2 size={13} className="text-[var(--fg)]" strokeWidth={2.2} />
                  </div>
                </div>
              )
            ) : (
              <h2 className="text-2xl font-black text-[var(--fg)] tracking-tight mt-1">{name}</h2>
            )}
          </div>
        </div>
      </div>

      {/* ── Balance Input Section ────────────────────────────────────────── */}
      <div className="flex-1 px-5 pt-6 pb-28">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Currency Select */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-[var(--muted)] uppercase tracking-wider pl-0.5">
              Mata Uang
            </label>
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => {
                  const nextCurr = e.target.value
                  setCurrency(nextCurr)
                  if (displayBalance) {
                    const formatted = formatMoneyInput(displayBalance, nextCurr)
                    setDisplayBalance(formatted)
                    setRawBalance(parseMoneyInput(formatted, nextCurr))
                  }
                }}
                className="w-full bg-[var(--field-bg)] border border-[var(--border)] rounded-2xl py-3 pl-4 pr-10 text-sm font-bold text-[var(--fg)] appearance-none outline-none focus:border-[var(--fg)] transition cursor-pointer shadow-xs"
              >
                <option value="IDR">Indonesian Rupiah (IDR)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="SGD">Singapore Dollar (SGD)</option>
              </select>
              <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            </div>
          </div>

          {/* Balance Input Box */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-[var(--muted)] uppercase tracking-wider pl-0.5">
              Saldo Awal
            </label>
            <div className="relative flex items-center bg-[var(--panel-strong)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] rounded-2xl p-4 shadow-sm focus-within:border-[var(--fg)] transition">
              <span className="pr-2 text-[var(--fg)] font-black text-2xl sm:text-3xl shrink-0 select-none">
                {currency === 'IDR' ? 'Rp' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={displayBalance}
                onChange={handleBalanceChange}
                placeholder="0"
                className="w-full bg-transparent font-black text-3xl sm:text-4xl text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)] tracking-tight tabular-nums"
              />
              {displayBalance && (
                <button
                  type="button"
                  onClick={clearBalance}
                  className="text-[var(--muted)] hover:text-[var(--fg)] transition p-1 cursor-pointer"
                  title={t('common.clear', 'Hapus')}
                >
                  <XCircle size={20} />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ── Fixed Bottom CTA ────────────────────────────────────────────── */}
      <div className="p-4 bg-[var(--bg)] border-t border-[var(--border)] mt-auto sticky bottom-0 z-40">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="w-full py-4 rounded-2xl bg-[var(--fg)] text-[var(--bg)] font-black text-sm shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          Simpan Akun Baru
        </button>
      </div>
    </div>
  )
}
