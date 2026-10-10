import { useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { getAllWalletBalances } from '../../lib/balanceEngine'
import { unarchiveWallet } from '../../services/walletService'
import { Wallet, Check, Search, X, Plus, ChevronDown, Archive, RotateCcw } from 'lucide-react'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import MoneyBagIcon from './MoneyBagIcon'
import { formatCurrency, FALLBACK_EXCHANGE_RATES } from '../../lib/utils'
import { getCachedCurrencyRates } from '../../lib/api'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import useBottomSheet from '../../hooks/useBottomSheet'
import useBackButton from '../../hooks/useBackButton'
import MaskedBalance from './MaskedBalance'

function formatAbbreviatedBalance(val, currency = 'IDR') {
  const num = Number(val ?? 0)
  if (!Number.isFinite(num) || num === 0) return `${currency === 'IDR' ? 'Rp' : currency} 0`
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  const isIdr = currency === 'IDR'
  const prefix = isIdr ? 'Rp ' : `${currency} `

  if (isIdr) {
    if (abs >= 1000000) {
      const millions = (abs / 1000000).toFixed(1).replace(/\.0$/, '')
      return `${sign}Rp ${millions}jt`
    }
    if (abs >= 1000) {
      const thousands = Math.round(abs / 1000)
      return `${sign}Rp ${thousands}rb`
    }
    return `${sign}Rp ${Math.round(abs)}`
  }

  // Non-IDR (USD, EUR, SGD, MYR, JPY, GBP, etc.)
  if (abs >= 1000000) {
    const millions = (abs / 1000000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${prefix}${millions}M`
  }
  if (abs >= 1000) {
    const thousands = (abs / 1000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${prefix}${thousands}k`
  }
  return `${sign}${prefix}${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function WalletSelectTrigger({
  wallet,
  placeholder,
  onClick,
  className = '',
  disabled = false,
  error = false,
  compact = false,
  abbreviateBalance = false,
}) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const hideBalance = useSettingsStore((state) => state.hideBalance)
  const displayPlaceholder = placeholder || t('wallets.selectPlaceholder', 'Pilih Dompet')

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex w-full items-center justify-between gap-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        compact
          ? `min-h-[42px] rounded-xl px-3 py-1.5 active:scale-[0.99] cursor-pointer ${
              error
                ? 'border border-rose-500/35 bg-rose-500/[0.04]'
                : 'border border-[var(--field-border,var(--border))] bg-[var(--field-bg)] hover:border-[var(--field-border-hover,var(--border-strong))]'
            }`
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
          <div className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} rounded-full aspect-square flex items-center justify-center shrink-0 border-[0.5px] border-[var(--wallet-logo-border,var(--border))] bg-[var(--wallet-logo-bg,var(--panel))] overflow-hidden shadow-2xs`}>
            {wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' || String(wallet.name || '').toLowerCase().includes('uang tunai') ? (
              <div className="w-full h-full flex items-center justify-center text-amber-500">
                <MoneyBagIcon size={compact ? 15 : 19} strokeWidth={2.5} />
              </div>
            ) : getWalletLogoUrl(wallet) ? (
              <img
                src={getWalletLogoUrl(wallet)}
                alt={wallet.name}
                className="w-full h-full object-cover rounded-full aspect-square"
                onError={(e) => {
                  e.target.style.display = 'none'
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="hidden h-full w-full items-center justify-center font-black text-xs text-[var(--accent)]"
              style={{ display: wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' || String(wallet.name || '').toLowerCase().includes('uang tunai') || getWalletLogoUrl(wallet) ? 'none' : 'flex' }}
            >
              {wallet.name ? wallet.name.substring(0, 2).toUpperCase() : 'W'}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
              {wallet.name}
            </p>
            <div className="text-[10px] font-medium text-[var(--muted)] truncate tabular-nums mt-0.5 flex items-center gap-1">
              <span>{t('wallets.balance', 'Saldo')}:</span> {hideBalance ? <MaskedBalance size="sm" /> : (abbreviateBalance ? formatAbbreviatedBalance(wallet.currentBalance ?? wallet.balance ?? 0, wallet.currency || defaultCurrency) : formatCurrency(wallet.currentBalance ?? wallet.balance ?? 0, wallet.currency || defaultCurrency))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <div className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} rounded-full aspect-square grid shrink-0 place-items-center border border-dashed border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]`}>
            <Wallet className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
          </div>
          <span className="text-xs font-bold text-[var(--muted)] truncate">
            {displayPlaceholder}
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
  wallets: propWallets,
  selectedWalletId,
  onSelectWallet,
  onSelect,
  title,
  subtitle,
  allowNone = false,
  noneLabel,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const hideBalance = useSettingsStore((state) => state.hideBalance)
  const [search, setSearch] = useState('')

  const rates = useMemo(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }, [])
  const hasPropWallets = Boolean(propWallets && propWallets.length > 0)
  const computedDbWallets = useLiveQuery(
    async () => {
      if (!isOpen || hasPropWallets) return []
      const raw = await db.wallets.toArray()
      if (!raw || raw.length === 0) return []
      return await getAllWalletBalances(raw, rates)
    },
    [rates, isOpen, hasPropWallets],
    propWallets || []
  )

  const enrichedWallets = useMemo(() => {
    if (hasPropWallets) return propWallets
    return computedDbWallets || []
  }, [hasPropWallets, propWallets, computedDbWallets])

  const activeWallets = useMemo(() => {
    return (enrichedWallets || []).filter((w) => !w.isArchived)
  }, [enrichedWallets])

  const archivedWallets = useMemo(() => {
    return (enrichedWallets || []).filter((w) => Boolean(w.isArchived))
  }, [enrichedWallets])

  const [showArchived, setShowArchived] = useState(false)

  const filteredWallets = useMemo(() => {
    if (!search.trim()) return activeWallets
    const q = search.toLowerCase().trim()
    return activeWallets.filter(
      (w) =>
        String(w.name || '').toLowerCase().includes(q) ||
        String(w.institutionType || '').toLowerCase().includes(q)
    )
  }, [activeWallets, search])

  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    setIsDragging(true)
  }

  const handleTouchMove = (e) => {
    if (!touchStartY.current) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartY.current
    if (deltaY > 0) {
      setDragOffset(deltaY)
    } else {
      setDragOffset(deltaY * 0.15)
    }
  }

  const { isMounted, isVisible, closeSheet } = useBottomSheet({
    isOpen,
    onClose,
    useBackButton: false,
  })

  useBackButton(onClose, Boolean(isOpen))

  const handleTouchEnd = () => {
    const elapsed = Date.now() - touchStartTime.current
    const velocity = dragOffset / (elapsed || 1)
    setIsDragging(false)
    if (dragOffset > 80 || (dragOffset > 30 && velocity > 0.45)) {
      closeSheet()
    } else {
      setDragOffset(0)
    }
    touchStartY.current = 0
  }

  if (!isMounted) return null

  const handleSelect = (id) => {
    const selectedObj = enrichedWallets.find((w) => String(w.id) === String(id)) || { id }
    if (onSelectWallet) onSelectWallet(id)
    if (onSelect) onSelect(selectedObj)
    closeSheet()
  }

  const modalContent = (
    <div className={`fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4 ${
      isVisible ? 'pointer-events-auto' : 'pointer-events-none'
    }`}>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer ${
          isVisible ? 'ft-backdrop-enter' : 'ft-backdrop-exit pointer-events-none'
        }`}
        onClick={closeSheet}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-t-[2rem] sm:rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl max-h-[85vh] flex flex-col z-10 transform-gpu ${
          isDragging ? '' : isVisible ? 'ft-sheet-enter' : 'ft-sheet-exit pointer-events-none'
        }`}
        style={{
          boxShadow: 'var(--shadow-card)',
          ...(isDragging
            ? {
                transform: `translate3d(0, ${Math.max(0, dragOffset)}px, 0)`,
                opacity: Math.max(0.4, 1 - dragOffset / 300),
                transition: 'none',
              }
            : {}),
        }}
      >
        {/* Drag handle for mobile */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex justify-center pt-2.5 pb-1 sm:hidden cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="h-1.5 w-12 rounded-full bg-[var(--border-strong)]/60" />
        </div>

        {/* Modal Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-[var(--border)]/60 cursor-grab select-none touch-none"
        >
          <div>
            <h3 className="text-base font-black text-[var(--fg)] tracking-tight">
              {title || t('wallets.selectWalletTitle', 'Pilih Dompet / Akun')}
            </h3>
            {subtitle !== undefined ? (
              subtitle ? <p className="text-xs font-semibold text-[var(--muted)] mt-0.5">{subtitle}</p> : null
            ) : (
              <p className="text-xs font-semibold text-[var(--muted)] mt-0.5">
                {t('wallets.selectWalletSubtitle', 'Pilih akun dompet untuk transaksi ini')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeSheet}
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
            aria-label={t('common.close', 'Tutup')}
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
                    {noneLabel || t('wallets.manualLogNone', 'Tanpa Dompet (Manual Log)')}
                  </p>
                  <p className="text-[10px] font-semibold text-[var(--muted)]">
                    {t('wallets.noBalanceRecord', 'Tidak mencatat ke saldo dompet')}
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
                {activeWallets.length === 0 ? t('wallets.noWalletsSaved', 'Belum ada dompet tersimpan') : t('wallets.notFound', 'Dompet tidak ditemukan')}
              </p>
            </div>
          ) : (
            filteredWallets.map((w) => {
              const isSelected = String(w.id) === String(selectedWalletId)
              const balance = w.currentBalance ?? w.balance ?? 0
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
                    <div className="w-10 h-10 rounded-full aspect-square flex items-center justify-center shrink-0 border-[0.5px] border-[var(--wallet-logo-border,var(--border))] bg-[var(--wallet-logo-bg,var(--panel))] overflow-hidden shadow-2xs">
                      {w.customIcon === 'dollar' || w.name?.toLowerCase() === 'cash' || String(w.name || '').toLowerCase().includes('uang tunai') ? (
                        <div className="w-full h-full flex items-center justify-center text-amber-500">
                          <MoneyBagIcon size={20} strokeWidth={2.5} />
                        </div>
                      ) : logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={w.name}
                          className="w-full h-full object-cover rounded-full aspect-square"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="hidden h-full w-full items-center justify-center font-black text-xs text-[var(--accent)]"
                        style={{ display: w.customIcon === 'dollar' || w.name?.toLowerCase() === 'cash' || String(w.name || '').toLowerCase().includes('uang tunai') || logoUrl ? 'none' : 'flex' }}
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
                      <div className="text-[11px] font-bold text-[var(--muted)] tabular-nums mt-0.5 flex items-center gap-1">
                        <span>{t('wallets.balance', 'Saldo')}:</span> <span className="text-[var(--fg)] font-black inline-flex items-center">{hideBalance ? <MaskedBalance size="sm" /> : formatCurrency(balance, w.currency || defaultCurrency)}</span>
                      </div>
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

          {archivedWallets.length > 0 && (
            <div className="pt-3 border-t border-[var(--border)]/60 space-y-2">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="w-full flex items-center justify-between py-1.5 px-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Archive className="h-3.5 w-3.5" />
                  {t('wallets.archivedWallets', 'Dompet Diarsipkan')} ({archivedWallets.length})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showArchived ? 'rotate-180' : ''}`} />
              </button>

              {showArchived && (
                <div className="space-y-1.5 pl-1">
                  {archivedWallets.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/60 text-xs opacity-75"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[var(--fg)] truncate">{w.name}</p>
                        <p className="text-[10px] text-[var(--muted)]">
                          {formatCurrency(Number(w.currentBalance ?? w.balance ?? 0), w.currency || defaultCurrency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await unarchiveWallet(w.id)
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(
                              new CustomEvent('ft-show-toast', {
                                detail: {
                                  type: 'success',
                                  message: t('wallets.unarchivedSuccess', 'Akun dompet berhasil dipulihkan.'),
                                },
                              })
                            )
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--field-bg)] text-[10px] font-bold text-[var(--fg)] transition active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <RotateCcw className="h-3 w-3 text-[var(--accent)]" />
                        <span>{t('wallets.unarchive', 'Pulihkan')}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Shortcut */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--border)]/60 bg-[var(--panel)] flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate('/add-account')
            }}
            className="flex items-center gap-1.5 text-xs font-black text-[var(--accent)] hover:underline cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t('wallets.addNewWallet', 'Tambah Akun Dompet Baru')}
          </button>

          <span className="text-[10px] font-bold text-[var(--muted)]">
            {t('wallets.accountsAvailable', '{{count}} Akun Tersedia', { count: activeWallets.length })}
          </span>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
