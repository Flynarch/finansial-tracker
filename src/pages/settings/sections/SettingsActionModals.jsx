import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ShieldCheck,
  LogOut,
  Database,
  RefreshCw,
} from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useSettingsStore from '../../../store/useSettingsStore'
import Modal from '../../../components/ui/Modal'
import AuthModal from '../../../components/auth/AuthModal'
import { signOutCurrentUser } from '../../../lib/auth'
import { db } from '../../../lib/db'
import { exportAllDataAsJson, exportAllDataAsEncryptedEnvelope } from '../../../lib/backup'
import { getSessionMnemonicPhrase, clearSessionMnemonicPhrase } from '../../../lib/mnemonicCrypto'
import { uploadLatestBackup } from '../../../lib/cloudBackup'
import { firebaseErrorToI18nKey } from '../../../lib/firebaseErrors'
import { clearFinancialLocalStorage } from '../settingsConstants'

export default function SettingsActionModals({
  isGuestWarningOpen,
  onCloseGuestWarning,
  isLogoutConfirmOpen,
  onCloseLogoutConfirm,
  isConnectModalOpen,
  onCloseConnectModal,
  onOpenConnectModal,
  onLogout,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const authUserId = useSettingsStore((state) => state.authUserId)
  const resetOnboarding = useSettingsStore((state) => state.resetOnboarding)
  const setAuthUser = useSettingsStore((state) => state.setAuthUser)

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isLoggingOutRef = useRef(false)

  const executePerformLogout = async () => {
    if (isLoggingOutRef.current || isLoggingOut) return
    isLoggingOutRef.current = true
    setIsLoggingOut(true)

    try {
      if (onLogout) {
        await onLogout()
        return
      }

      const e2eePhrase = getSessionMnemonicPhrase()
      const isE2eeActive = Boolean(e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12)

      const backup = await exportAllDataAsJson().catch(() => null)
      if (backup && authUserId) {
        const txList = backup?.data?.transactions || backup?.transactions || []
        const walletList = backup?.data?.wallets || backup?.wallets || []
        const hasData = txList.length > 0 || walletList.length > 0

        if (hasData && isE2eeActive) {
          let uploadPayload = null

          try {
            uploadPayload = await exportAllDataAsEncryptedEnvelope(e2eePhrase.trim())
          } catch (err) {
            console.error(
              'Failed to encrypt backup envelope for E2EE cloud backup, aborting upload to protect privacy:',
              err
            )
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('ft-show-toast', {
                  detail: {
                    title: t('settings.security.e2eeEncryptFailedTitle', 'Enkripsi Gagal'),
                    message: t(
                      'settings.security.e2eeEncryptFailedMsg',
                      'Gagal mengenkripsi data cadangan E2EE. Unggahan ke cloud dibatalkan untuk menjaga keamanan.'
                    ),
                    type: 'danger',
                  },
                })
              )
            }
            return
          }

          if (uploadPayload) {
            try {
              const uploadRes = await Promise.race([
                uploadLatestBackup(authUserId, uploadPayload, { isEncrypted: true }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000)),
              ])
              if (!uploadRes) {
                throw new Error('BACKUP_FAILED')
              }
            } catch (err) {
              console.warn('[SettingsActionModals] Cloud backup before logout failed:', err)
              if (typeof window !== 'undefined') {
                const errorKey =
                  err?.message === 'TIMEOUT'
                    ? 'profile.cloud.err.timeout'
                    : err?.i18nKey || firebaseErrorToI18nKey(err) || 'profile.cloud.err.generic'
                window.dispatchEvent(
                  new CustomEvent('ft-show-toast', {
                    detail: {
                      title: t('common.error', 'Terjadi Kesalahan'),
                      message: t(
                        errorKey,
                        'Gagal mencadangkan data ke cloud. Logout dibatalkan agar data lokal Anda tidak hilang.'
                      ),
                      type: 'danger',
                    },
                  })
                )
              }
              // ABORT LOGOUT to protect local data from being wiped!
              return
            }
          }
        }
      }

      // Safely clear financial and feature data tables only if user has an active E2EE cloud backup
      if (isE2eeActive) {
        const dataTables = [
          db.transactions,
          db.investments,
          db.investmentOrders,
          db.budgets,
          db.goals,
          db.goalLogs,
          db.calendarEvents,
          db.recurringTransactions,
          db.todos,
          db.sub_tasks,
          db.habits,
          db.habitLogs,
          db.ideas,
          db.board_links,
          db.notifications,
          db.wallets,
          db.loans,
          db.loanPayments,
          db.walletBalanceCache,
          db.chatMessages,
        ].filter(Boolean)

        await Promise.all(
          dataTables.map((tbl) => tbl?.clear?.().catch((err) => console.warn('[SettingsActionModals]', err)))
        )
        clearFinancialLocalStorage()
      }

      await signOutCurrentUser().catch((err) => console.warn('[SettingsActionModals]', err))
      try {
        localStorage.removeItem('ft_onboarding_seen_v1')
        localStorage.removeItem('ft_onboarding_progress')
      } catch (err) {
        console.warn('[SettingsActionModals]', err)
        /* ignore */
      }
      clearSessionMnemonicPhrase()
      await resetOnboarding().catch((err) => console.warn('[SettingsActionModals]', err))
      await setAuthUser({
        uid: '',
        email: '',
        displayName: '',
        photoURL: '',
        provider: 'guest',
        emailVerified: false,
      }).catch((err) => console.warn('[SettingsActionModals]', err))

      onCloseGuestWarning?.()
      onCloseLogoutConfirm?.()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.warn('[SettingsActionModals]', err)
      /* ignore */
    } finally {
      isLoggingOutRef.current = false
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      {/* Modal Guest Warning when Logging Out */}
      <Modal
        isOpen={isGuestWarningOpen}
        title={t('settings.guestWarningTitle', 'Peringatan Mode Tamu')}
        onClose={() => {
          if (!isLoggingOut) onCloseGuestWarning?.()
        }}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h5 className="font-bold text-xs text-[var(--fg)]">
                {t('settings.guestWarningSubtitle', 'Data Transaksi Belum Terhubung ke Cloud')}
              </h5>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t(
                  'settings.guestWarningDesc',
                  'Anda saat ini menggunakan Mode Tamu. Jika Anda keluar tanpa menghubungkan akun Google, data transaksi Anda di perangkat ini tidak akan tersinkronisasi ke cloud. Ayo hubungkan akun sekarang agar data Anda aman!'
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {/* Primary Action: Link Account Now */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => {
                onCloseGuestWarning?.()
                onOpenConnectModal?.()
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-white font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              <span>{t('settings.connectAccountNow', 'Hubungkan Akun Sekarang')}</span>
            </button>

            {/* Secondary Action: Log out anyway */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => {
                executePerformLogout()
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-[var(--status-expense)]/30 bg-[var(--status-expense)]/10 text-[var(--status-expense)] font-bold text-xs hover:bg-[var(--status-expense)]/20 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingOut ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <LogOut size={15} />
              )}
              <span>
                {isLoggingOut
                  ? t('common.loading', 'Memproses...')
                  : t('settings.proceedLogoutAnyway', 'Tetap Keluar & Ganti Akun')}
              </span>
            </button>

            {/* Cancel */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => onCloseGuestWarning?.()}
              className="w-full py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              {t('common.cancel', 'Batal')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Logout Confirmation for Logged-In accounts */}
      <Modal
        isOpen={isLogoutConfirmOpen}
        title={t('settings.logoutConfirmTitle', 'Konfirmasi Keluar Akun')}
        onClose={() => {
          if (!isLoggingOut) onCloseLogoutConfirm?.()
        }}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Database size={18} strokeWidth={2.5} />
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed min-w-0 flex-1">
              {t(
                'settings.logoutConfirmDesc',
                'Data transaksi Anda telah dicadangkan secara aman. Anda dapat masuk kembali dengan akun Google/Email ini kapan saja.'
              )}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => {
                executePerformLogout()
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--status-expense)] text-white font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingOut ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <LogOut size={15} />
              )}
              <span>
                {isLoggingOut
                  ? t('common.loading', 'Memproses...')
                  : t('settings.proceedLogoutAnyway', 'Keluar & Ganti Akun')}
              </span>
            </button>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => onCloseLogoutConfirm?.()}
              className="w-full py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer text-center disabled:opacity-50"
            >
              {t('common.cancel', 'Batal')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Connect Account / Switch Account (Google / Email / Register) */}
      {isConnectModalOpen && (
        <AuthModal
          isOpen={isConnectModalOpen}
          onClose={onCloseConnectModal}
          onSuccess={onCloseConnectModal}
        />
      )}
    </>
  )
}
