import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MoreVertical,
  Star,
  Sliders,
  Eye,
  EyeOff,
} from 'lucide-react'
import MoneyBagIcon from '../../ui/MoneyBagIcon'
import PageHeader from '../../ui/PageHeader'
import AnimatedWalletBalance from '../../dashboard/AnimatedWalletBalance'
import { getWalletLogoUrl } from '../../../data/walletInstitutions'
import { safeFormatDate } from '../../../lib/utils'
import useSettingsStore from '../../../store/useSettingsStore'
import useTranslation from '../../../hooks/useTranslation'
import { formatAccountType, getInitials } from './walletDetailUtils'

export default function WalletDetailHero({
  wallet,
  balance = 0,
  isDefaultWallet = false,
  hideBalance,
  onToggleHideBalance,
  onAdjustBalance,
  onOpenOptions,
  onBack,
  defaultCurrency,
  locale,
  t,
}) {
  const navigate = useNavigate()
  const storeHideBalance = useSettingsStore((state) => state.hideBalance)
  const storeToggleHideBalance = useSettingsStore((state) => state.toggleHideBalance)
  const storeDefaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const { locale: defaultLocale, t: defaultT } = useTranslation()

  const activeHideBalance = hideBalance !== undefined ? hideBalance : storeHideBalance
  const handleToggleHideBalance = onToggleHideBalance || storeToggleHideBalance
  const activeDefaultCurrency = defaultCurrency || storeDefaultCurrency
  const activeLocale = locale || defaultLocale
  const activeT = t || defaultT

  const handleBack = onBack || (() => navigate('/dashboard'))

  const displayCurrency = wallet?.currency || activeDefaultCurrency || 'IDR'

  const isCash = useMemo(() => {
    if (!wallet) return false
    return (
      wallet.customIcon === 'dollar' ||
      wallet.customIcon === 'cash' ||
      wallet.institutionType === 'cash' ||
      String(wallet.name || '').toLowerCase().includes('cash') ||
      String(wallet.name || '').toLowerCase().includes('uang tunai')
    )
  }, [wallet])

  const updatedAt = useMemo(() => {
    return (
      safeFormatDate(wallet?.createdAt, 'dd MMM yyyy, HH:mm') ||
      (activeLocale === 'en' ? 'Just now' : 'Baru saja')
    )
  }, [wallet?.createdAt, activeLocale])

  if (!wallet) return null

  return (
    <>
      {/* ── 1. Clean Neutral Hero Section with Wallet Icon ────────────── */}
      <div className="ft-wallet-detail-hero w-full pb-8 pt-[max(env(safe-area-inset-top,0px),0.75rem)] px-4 text-center bg-[var(--panel)] border-b border-[var(--border)] relative overflow-hidden">
        {/* Top Nav Bar with 3-Dots Action Button */}
        <PageHeader
          title={wallet.name}
          titleUppercase={true}
          onBack={handleBack}
          rightAction={
            <button
              type="button"
              onClick={onOpenOptions}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer shadow-xs"
              title={activeT('wallets.options', 'Opsi Akun')}
              aria-label={activeT('wallets.options', 'Opsi Akun')}
            >
              <MoreVertical size={16} strokeWidth={2.5} />
            </button>
          }
        />

        {/* Centered Circular Logo */}
        <div className="relative z-10 w-13 h-13 rounded-full bg-[var(--wallet-logo-bg,var(--panel-strong))] flex items-center justify-center overflow-hidden border-[0.5px] border-[var(--wallet-logo-border,var(--border))] shadow-xs mx-auto mt-2.5 mb-2">
          {isCash ? (
            <div className="w-full h-full flex items-center justify-center text-amber-500">
              <MoneyBagIcon size={26} strokeWidth={2.5} />
            </div>
          ) : getWalletLogoUrl(wallet) ? (
            <img
              src={getWalletLogoUrl(wallet)}
              alt={wallet.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className="w-full h-full flex items-center justify-center font-black text-sm text-[var(--fg)]"
            style={{ display: isCash || getWalletLogoUrl(wallet) ? 'none' : 'flex' }}
          >
            {getInitials(wallet.name)}
          </div>
        </div>

        {/* Subtitles: Account Type Pill Badge & Primary Wallet Pill */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 mb-1">
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-strong)]/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--muted)] shadow-xs">
            <span>{formatAccountType(wallet.institutionType, wallet.name, activeLocale)}</span>
          </div>

          {isDefaultWallet && (
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-black text-amber-500 shadow-xs animate-in fade-in">
              <Star size={10} className="fill-amber-500 text-amber-500" />
              <span>{activeT('wallets.primaryBadge', 'Akun Utama')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Overlapping Balance Card with Single Adjust Balance Action ─────── */}
      <div className="px-4 -mt-3 relative z-20">
        <div className="ft-card-sheen relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 sm:p-4 shadow-md space-y-2">
          {/* Top Row: Label Caption & Direct Adjust Balance Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {activeT('wallets.currentAccountBalance', 'Saldo Akun Saat Ini')}
              </span>
              <button
                type="button"
                onClick={handleToggleHideBalance}
                className="grid h-7 w-7 min-h-[36px] min-w-[36px] place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                title={
                  activeHideBalance
                    ? activeT('dashboard.showBalance', 'Tampilkan Saldo')
                    : activeT('dashboard.hideBalance', 'Sembunyikan Saldo')
                }
                aria-label={
                  activeHideBalance
                    ? activeT('dashboard.showBalance', 'Tampilkan Saldo')
                    : activeT('dashboard.hideBalance', 'Sembunyikan Saldo')
                }
              >
                {activeHideBalance ? <EyeOff size={13} strokeWidth={2.3} /> : <Eye size={13} strokeWidth={2.3} />}
              </button>
            </div>
            <button
              type="button"
              onClick={onAdjustBalance}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] text-[11px] font-bold hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
              title={activeT('wallets.adjustBalance', 'Penyesuaian Saldo')}
            >
              <Sliders size={12} strokeWidth={2} />
              <span>{activeT('wallets.adjustBalance', 'Penyesuaian Saldo')}</span>
            </button>
          </div>

          {/* Middle Row: Crisp Bold Animated Balance Display */}
          <div className="flex items-center min-h-[2rem]">
            <AnimatedWalletBalance
              balance={balance}
              currency={displayCurrency}
              hideBalance={activeHideBalance}
              size="lg"
            />
          </div>

          {/* Bottom Row: Timestamp & Currency Info */}
          <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>{activeT('wallets.lastUpdated', 'Terakhir update: {{time}}', { time: updatedAt })}</span>
            <span className="rounded-md bg-[var(--field-bg)] border border-[var(--border)] px-2 py-0.5 font-black text-[10px] text-[var(--muted)] uppercase tracking-wider">
              {displayCurrency}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
