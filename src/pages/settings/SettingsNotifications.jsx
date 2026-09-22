import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Zap,
  Smartphone,
  RefreshCw,
  Wallet,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import {
  requestNotificationPermission,
  syncDailyReminderSchedule,
  sendTestNotification,
} from '../../lib/smartNotifications'
import {
  FinTrackNotificationPlugin,
  syncNotificationQueue,
} from '../../lib/notificationIngestion'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import { SettingsSection } from './settingsComponents'
import ProminentDisclosureModal from '../../components/notifications/ProminentDisclosureModal'

export default function SettingsNotifications() {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const dailyReminderEnabled = useSettingsStore((s) => s.dailyReminderEnabled)
  const setDailyReminderEnabled = useSettingsStore((s) => s.setDailyReminderEnabled)
  const dailyReminderTime = useSettingsStore((s) => s.dailyReminderTime || '20:00')
  const setDailyReminderTime = useSettingsStore((s) => s.setDailyReminderTime)
  const budgetAlertsEnabled = useSettingsStore((s) => s.budgetAlertsEnabled)
  const setBudgetAlertsEnabled = useSettingsStore((s) => s.setBudgetAlertsEnabled)

  // Wallet list for auto-assignment
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || []
  const activeWallets = wallets.filter((w) => !w.isArchived)
  const [autoWalletId, setAutoWalletId] = useState(() => activeWallets[0]?.id || '')

  // Native Notification Listener State
  const [isListenerGranted, setIsListenerGranted] = useState(false)
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false)
  const [isSyncingQueue, setIsSyncingQueue] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState('')

  const [hasPermission, setHasPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted'
    }
    return true
  })
  const [testSent, setTestSent] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [timeInput, setTimeInput] = useState(dailyReminderTime)

  const checkNativePermission = useCallback(async () => {
    try {
      const res = await FinTrackNotificationPlugin.isPermissionGranted()
      setIsListenerGranted(Boolean(res?.granted))
    } catch (err){
      console.warn('[SettingsNotifications]', err)
      setIsListenerGranted(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    FinTrackNotificationPlugin.isPermissionGranted()
      .then((res) => {
        if (isMounted) setIsListenerGranted(Boolean(res?.granted))
      })
      .catch((err) => console.warn('[SettingsNotifications]', err))

    const handleFocus = () => {
      checkNativePermission()
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      isMounted = false
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkNativePermission])

  const handleToggleDaily = async () => {
    const next = !dailyReminderEnabled
    await setDailyReminderEnabled(next)
    await syncDailyReminderSchedule(next, timeInput)
  }

  const handleTimeChange = async (e) => {
    const nextTime = e.target.value
    setTimeInput(nextTime)
    await setDailyReminderTime(nextTime)
    if (dailyReminderEnabled) {
      await syncDailyReminderSchedule(true, nextTime)
    }
  }

  const handleToggleBudget = async () => {
    const next = !budgetAlertsEnabled
    await setBudgetAlertsEnabled(next)
  }

  const handleRequestPerm = async () => {
    const ok = await requestNotificationPermission()
    setHasPermission(ok)
  }

  const handleManualSyncNotifs = async () => {
    triggerHaptic('selection')
    setIsSyncingQueue(true)
    setSyncFeedback('')

    try {
      const result = await syncNotificationQueue({
        defaultWalletId: autoWalletId,
        defaultCurrency,
      })

      if (result.syncedCount > 0) {
        triggerHaptic('success')
        setSyncFeedback(
          t('notif.syncSuccess', 'Berhasil mencatat {{count}} mutasi baru.', { count: result.syncedCount })
        )
      } else {
        setSyncFeedback(t('notif.syncEmpty', 'Antrean notifikasi kosong.'))
      }
    } catch (err){
      console.warn('[SettingsNotifications]', err)
      setSyncFeedback(t('common.error.generic', 'Terjadi kesalahan saat sinkronisasi.'))
    } finally {
      setIsSyncingQueue(false)
      setTimeout(() => setSyncFeedback(''), 3000)
    }
  }

  const handleSendTestNotification = async () => {
    triggerHaptic('medium')
    setIsSendingTest(true)
    try {
      const ok = await sendTestNotification()
      setHasPermission(ok)
      if (ok) {
        setTestSent(true)
        setTimeout(() => setTestSent(false), 3000)
      }
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
            <Bell className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
              {t('settings.notifications.title', 'Notifikasi & Pengingat Cerdas')}
            </h2>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              {t('settings.notifications.subtitle', 'Jadwalkan alarm pencatatan harian dan peringatan batas anggaran')}
            </p>
          </div>
        </div>

        {!hasPermission && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3 text-xs text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('settings.notifications.permRequired', 'Izin notifikasi belum diaktifkan.')}</span>
            </div>
            <button
              type="button"
              onClick={handleRequestPerm}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 active:scale-95 transition cursor-pointer"
            >
              {t('settings.notifications.grantPerm', 'Izinkan')}
            </button>
          </div>
        )}
      </div>

      {/* Group 1: Otomasi Mutasi Notifikasi Bank & E-Wallet (NEW) */}
      <SettingsSection
        label={t('notif.listenerSection', 'Otomasi Mutasi Notifikasi Bank & E-Wallet')}
        footnote={t(
          'notif.listenerFootnote',
          'FinTrack mendeteksi transaksi masuk & keluar secara instan dari notifikasi BCA, Mandiri, BRI, BNI, Jenius, GoPay, OVO, DANA, dan ShopeePay tanpa mengunggah data ke cloud (100% on-device).'
        )}
      >
        <div className="ft-settings-cell space-y-4">
          {/* Permission Status & Action */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-extrabold text-[var(--fg)]">
                  {t('notif.listenerTitle', 'Akses Notifikasi Transaksi')}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isListenerGranted ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-[var(--muted)]">
                    {isListenerGranted
                      ? t('notif.statusActive', 'Aktif & Mendengarkan')
                      : t('notif.statusInactive', 'Belum Diaktifkan')}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDisclosureOpen(true)}
              className="px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>{isListenerGranted ? t('notif.manage', 'Kelola') : t('notif.enable', 'Aktifkan')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Wallet Target Selector & Manual Sync Bar */}
          {isListenerGranted && (
            <div className="border-t border-[var(--border)] pt-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-[var(--fg)] flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>{t('notif.defaultWalletLabel', 'Dompet Tujuan Pencatatan Otomatis')}</span>
                </label>
                <select
                  value={autoWalletId}
                  onChange={(e) => setAutoWalletId(e.target.value)}
                  className="ft-field text-xs font-bold py-1.5 px-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)]"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sync Action Button */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleManualSyncNotifs}
                  disabled={isSyncingQueue}
                  className="h-9 px-3.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSyncingQueue ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>{t('notif.syncNow', 'Sinkronkan Notifikasi Sekarang')}</span>
                </button>

                {syncFeedback && (
                  <span className="text-xs font-bold text-emerald-500 animate-fadeIn truncate">
                    {syncFeedback}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Group 2: Pengingat Harian */}
      <SettingsSection
        label={t('settings.notifications.dailySection', 'Pengingat Pencatatan Harian')}
        footnote={t(
          'settings.notifications.dailyFootnote',
          'Notifikasi harian ramah yang mengingatkan Anda untuk mencatat pengeluaran sebelum istirahat malam.',
        )}
      >
        <div className="ft-settings-cell space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-extrabold text-[var(--fg)]">
                  {t('settings.notifications.dailyToggle', 'Aktifkan Pengingat Harian')}
                </span>
                <span className="block text-xs font-medium text-[var(--muted)] mt-0.5">
                  {dailyReminderEnabled
                    ? `${t('settings.notifications.setAt', 'Setiap hari pukul')} ${dailyReminderTime}`
                    : t('common.disabled', 'Nonaktif')}
                </span>
              </div>
            </div>

            {/* iOS/Android Style Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={dailyReminderEnabled}
              onClick={handleToggleDaily}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                dailyReminderEnabled ? 'bg-[var(--accent)]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  dailyReminderEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {dailyReminderEnabled && (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5">
              <label className="text-xs font-bold text-[var(--fg)]">
                {t('settings.notifications.chooseTime', 'Waktu Pengingat')}
              </label>
              <input
                type="time"
                value={timeInput}
                onChange={handleTimeChange}
                className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Group 3: Peringatan Anggaran Real-Time */}
      <SettingsSection
        label={t('settings.notifications.budgetSection', 'Peringatan Limit Anggaran')}
        footnote={t(
          'settings.notifications.budgetFootnote',
          'Kirim pemberitahuan otomatis saat pengeluaran menyentuh 80% (peringatan waspada) dan 100% (melebihi limit anggaran).',
        )}
      >
        <div className="ft-settings-cell flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-extrabold text-[var(--fg)]">
                {t('settings.notifications.budgetToggle', 'Peringatan Batas Anggaran')}
              </span>
              <span className="block text-xs font-medium text-[var(--muted)] mt-0.5">
                {budgetAlertsEnabled
                  ? t('settings.notifications.budgetActive', 'Aktif (80% & 100% Limit)')
                  : t('common.disabled', 'Nonaktif')}
              </span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={budgetAlertsEnabled}
            onClick={handleToggleBudget}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              budgetAlertsEnabled ? 'bg-amber-600' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                budgetAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </SettingsSection>

      {/* Uji Coba Notifikasi */}
      <div className="pt-2">
        <button
          type="button"
          disabled={isSendingTest}
          onClick={handleSendTestNotification}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-xs font-extrabold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer disabled:opacity-60"
        >
          {isSendingTest ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
          ) : testSent ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Send className="h-4 w-4 text-[var(--accent)]" />
          )}
          <span>
            {isSendingTest
              ? t('common.loading', 'Mengirim Notifikasi...')
              : testSent
              ? t('settings.notifications.testSent', 'Notifikasi Uji Terkirim!')
              : t('settings.notifications.testBtn', 'Kirim Notifikasi Uji Coba')}
          </span>
        </button>
      </div>

      {/* Prominent Disclosure Modal for Google Play Compliance */}
      <ProminentDisclosureModal
        isOpen={isDisclosureOpen}
        onClose={() => {
          setIsDisclosureOpen(false)
          checkNativePermission()
        }}
        onPermissionRequested={() => {
          checkNativePermission()
        }}
      />
    </div>
  )
}
