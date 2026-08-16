import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Wallet, Check, Search, X, Plus, ChevronDown } from 'lucide-react'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import { formatCurrency } from '../../lib/utils'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'

function formatAbbreviatedBalance(val, currency = 'IDR') {
  const num = Number(val ?? 0)
  if (!Number.isFinite(num) || num === 0) return `${currency === 'IDR' ? 'Rp' : currency} 0`
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1000000) {
    const millions = (abs / 1000000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${currency === 'IDR' ? 'Rp' : currency} ${millions}jt`
  }
  if (abs >= 1000) {
    const thousands = Math.round(abs / 1000)
    return `${sign}${currency === 'IDR' ? 'Rp' : currency} ${thousands}rb`
  }
  return `${sign}${currency === 'IDR' ? 'Rp' : currency} ${abs}`
}

export function WalletSelectTrigger({
  wallet,
  placeholder = 'Pilih Dompet',
  onClick,
  className = '',
  disabled = false,
  error = false,
  compact = false,
  abbreviateBalance = false,
}) {
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full items-center justify-between gap-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        compact
          ? 'min-h-[42px] rounded-xl bg-[var(--field-bg)] px-3 py-1.5 border-none hover:bg-[var(--panel-strong)] active:scale-[0.99] cursor-pointer'
          : `min-h-[50px] rounded-2xl border bg-[var(--field-bg)] px-3.5 py-2.5 ${
              disabled
                ? 'opacity-60 cursor-not-allowed border-[var(--border)]'
                : error
                ? 'border-rose-500/50 hover:border-rose-500'
                : 'border-[var(--border)] hover:border-[var(--border-strong)] active:scale-[0.99] cursor-pointer'
            }`
      } ${className}`}
    >
      {wallet ? (
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`${compact ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'} relative grid shrink-0 place-items-center border border-[var(--border)]/60 bg-[var(--panel)] overflow-hidden shadow-2xs`}>
            {getWalletLogoUrl(wallet) ? (
              <img
                src={getWalletLogoUrl(wallet)}
                alt={wallet.name}
                className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} object-contain`}
                onError={(e) => {
                  e.target.style.display = 'none'
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="hidden h-full w-full items-center justify-center font-black text-xs text-[var(--accent)]"
              style={{ display: getWalletLogoUrl(wallet) ? 'none' : 'flex' }}
            >
              {wallet.name ? wallet.name.substring(0, 2).toUpperCase() : 'W'}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
              {wallet.name}
            </p>
            <p className="text-[10px] font-medium text-[var(--muted)] truncate tabular-nums mt-0.5">
              Saldo: {abbreviateBalance ? formatAbbreviatedBalance(wallet.balance ?? wallet.currentBalance ?? 0, wallet.currency || defaultCurrency) : formatCurrency(wallet.balance ?? wallet.currentBalance ?? 0, wallet.currency || defaultCurrency)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <div className={`${compact ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl'} grid shrink-0 place-items-center border border-dashed border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]`}>
            <Wallet className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
          </div>
          <span className="text-xs font-bold text-[var(--muted)] truncate">
            {placeholder}
          </span>
        </div>
      )}

      <ChevronDown className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-[var(--muted)] transition-transform group-hover:text-[var(--fg)]`} />
    </button>
  )
}

export default function WalletSelectModal({
  isOpen,
  onClose,
  wallets = [],
  selectedWalletId,
  onSelectWallet,
  title = 'Pilih Dompet / Akun',
  subtitle = 'Pilih akun dompet untuk transaksi ini',
  allowNone = false,
  noneLabel = 'Tanpa Dompet (Manual Log)',
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [search, setSearch] = useState('')

  const activeWallets = useMemo(() => {
    return (wallets || []).filter((w) => !w.isArchived)
  }, [wallets])

  const filteredWallets = useMemo(() => {
    if (!search.trim()) return activeWallets
    const q = search.toLowerCase().trim()
    return activeWallets.filter(
      (w) =>
        String(w.name || '').toLowerCase().includes(q) ||
        String(w.institutionType || '').toLowerCase().includes(q)
    )
  }, [activeWallets, search])

  if (!isOpen) return null

  const handleSelect = (id) => {
    onSelectWallet(id)
    onClose()
  }

  const modalContent = (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-[2rem] sm:rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transition-all max-h-[85vh] flex flex-col z-10 animate-[ft-spring-up_0.36s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-[var(--border)]/60" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[var(--border)]/60">
          <div>
            <h3 className="text-base font-black text-[var(--fg)] tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs font-semibold text-[var(--muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar (Shown if 4+ wallets) */}
        {activeWallets.length >= 4 && (
          <div className="px-5 pt-3 pb-1">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-[var(--muted)] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('wallets.searchPlaceholder', 'Cari nama dompet...')}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] pl-9 pr-3.5 py-2 text-xs font-bold text-[var(--fg)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Wallet List Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {allowNone && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                !selectedWalletId
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-2xs'
                  : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--panel)] text-[var(--muted)] border border-[var(--border)]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-[var(--fg)] truncate">
                    {noneLabel}
                  </p>
                  <p className="text-[10px] font-semibold text-[var(--muted)]">
                    Tidak mencatat ke saldo dompet
                  </p>
                </div>
              </div>

              {!selectedWalletId && (
                <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-white shrink-0">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </div>
              )}
            </button>
          )}

          {filteredWallets.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-bold text-[var(--muted)]">
                {activeWallets.length === 0 ? 'Belum ada dompet tersimpan' : 'Dompet tidak ditemukan'}
              </p>
            </div>
          ) : (
            filteredWallets.map((w) => {
              const isSelected = String(w.id) === String(selectedWalletId)
              const balance = w.balance ?? w.currentBalance ?? 0
              const logoUrl = getWalletLogoUrl(w)

              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleSelect(w.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-2xs'
                      : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)] hover:bg-[var(--panel)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)]/60 bg-[var(--panel)] overflow-hidden shadow-2xs">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={w.name}
                          className="h-7 w-7 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="hidden h-full w-full items-center justify-center font-black text-xs text-[var(--accent)]"
                        style={{ display: logoUrl ? 'none' : 'flex' }}
                      >
                        {w.name ? w.name.substring(0, 2).toUpperCase() : 'W'}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-[var(--fg)] truncate">
                          {w.name}
                        </p>
                        {w.accountType && (
                          <span className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)] border border-[var(--border)]">
                            {w.accountType}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-[var(--muted)] tabular-nums mt-0.5">
                        Saldo: <span className="text-[var(--fg)] font-black">{formatCurrency(balance, w.currency || defaultCurrency)}</span>
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-white shrink-0">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer Shortcut */}
        <div className="p-4 border-t border-[var(--border)]/60 bg-[var(--panel)] flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate('/add-account')
            }}
            className="flex items-center gap-1.5 text-xs font-black text-[var(--accent)] hover:underline cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Akun Dompet Baru
          </button>

          <span className="text-[10px] font-bold text-[var(--muted)]">
            {activeWallets.length} Akun Tersedia
          </span>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
