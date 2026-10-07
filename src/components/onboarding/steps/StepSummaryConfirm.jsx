import useTranslation from '../../../hooks/useTranslation'
import ProgressHeader from '../ProgressHeader'
import UserAvatar from '../../ui/UserAvatar'
import MoneyBagIcon from '../../ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../../../data/walletInstitutions'
import { formatCurrency } from '../../../lib/utils'
import { Check, ChevronRight, Plus, Star, Trash2 } from 'lucide-react'

export default function StepSummaryConfirm({
  username = '',
  profilePhoto,
  authProvider,
  wallets = [],
  defaultWalletId,
  onSetDefaultWalletId,
  onDeleteWallet,
  onEditUsername,
  onAddExtraWallet,
  onFinish,
}) {
  const { t } = useTranslation()

  const visibleWallets = wallets || []

  return (
    <div className="space-y-6">
      <ProgressHeader step={4} total={4} />

      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
          <Check size={24} strokeWidth={3} />
        </div>
        <h3 className="text-2xl font-black tracking-tight text-[var(--fg)]">
          {t('auth.finishStepTitle', 'Semua Siap!')}
        </h3>
        <p className="text-xs text-[var(--muted)] leading-relaxed max-w-sm mx-auto">
          {t(
            'auth.finishStepSubtitle',
            'FinTrack siap menemani perjalanan finansial Anda. Mari mulai kelola transaksi pertama.'
          )}
        </p>
      </div>

      {/* Summary Bento Card */}
      <div className="space-y-3 p-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-xs">
        {/* Row 1: Profile & Theme summary */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={username || ''}
              photo={profilePhoto}
              size="md"
              shape="circle"
            />
            <div>
              <h4 className="font-extrabold text-sm text-[var(--fg)] truncate">
                {username || t('auth.defaultUserName', 'Pengguna FinTrack')}
              </h4>
              <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                {authProvider === 'google'
                  ? t('auth.accountGoogle', 'Akun Google')
                  : authProvider === 'email'
                  ? t('auth.accountEmail', 'Akun Email')
                  : authProvider === 'anonymous'
                  ? t('auth.accountAnonymous', 'Akun Anonim / Tamu')
                  : t('auth.modeGuest', 'Mode Tamu')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onEditUsername}
            className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
          >
            {t('auth.editName', 'Edit')}
          </button>
        </div>

        {/* Row 2: Configured Wallets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('auth.registeredWallets', 'Dompet Terdaftar ({{count}})', { count: visibleWallets.length })}
            </span>
            <button
              type="button"
              onClick={onAddExtraWallet}
              className="text-xs font-bold text-[var(--accent)] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus size={13} />
              {t('auth.addWallet', 'Tambah')}
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {visibleWallets.map((w) => {
              const logoUrl = getWalletLogoUrl(w)
              const isCash =
                w.customIcon === 'dollar' ||
                w.customIcon === 'cash' ||
                w.name?.toLowerCase() === 'cash' ||
                String(w.name || '').toLowerCase().includes('uang tunai')
              const isDefault = defaultWalletId ? w.id === defaultWalletId : false

              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--wallet-logo-bg,var(--panel))] border-[0.5px] border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      {isCash ? (
                        <MoneyBagIcon size={16} strokeWidth={2.5} className="text-amber-500" />
                      ) : logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={w.name || t('wallets.wallet', 'Dompet')}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span className="font-black text-xs text-[var(--fg)]">
                          {w.name ? w.name.substring(0, 2).toUpperCase() : 'W'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs text-[var(--fg)] truncate">{w.name}</h5>
                      <p className="text-[10px] font-medium text-[var(--muted)] truncate">
                        {formatCurrency(w.balance ?? w.currentBalance ?? 0, w.currency || 'IDR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDefault ? (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--bg)] text-[9px] font-black uppercase tracking-wider">
                        {t('common.primary', 'Utama')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetDefaultWalletId?.(w.id)}
                        title={t('wallets.setAsDefault', 'Jadikan Dompet Utama')}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-amber-500 transition-colors cursor-pointer"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    {visibleWallets.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => onDeleteWallet?.(e, w.id)}
                        className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Finish Action */}
      <button
        type="button"
        onClick={onFinish}
        className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-black text-sm hover:opacity-90 transition-all cursor-pointer shadow-md active:scale-[0.98]"
      >
        <span>{t('auth.startAppCta', 'Mulai Gunakan FinTrack')}</span>
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}
