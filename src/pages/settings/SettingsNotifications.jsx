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
  ShieldCheck,
  Trash2,
  MessageSquare,
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
  syncHistoricalSms,
  scanSuspectPromoTransactions,
  cleanSuspectPromoTransactions,
} from '../../lib/notificationIngestion'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import { SettingsSection } from './settingsComponents'
import ProminentDisclosureModal from '../../components/notifications/ProminentDisclosureModal'

export default function SettingsNotifications() {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const defaultWalletId = useSettingsStore((s) => s.defaultWalletId)
  const setDefaultWalletId = useSettingsStore((s) => s.setDefaultWalletId)
  const dailyReminderEnabled = useSettingsStore((s) => s.dailyReminderEnabled)
  const setDailyReminderEnabled = useSettingsStore((s) => s.setDailyReminderEnabled)
  const dailyReminderTime = useSettingsStore((s) => s.dailyReminderTime || '20:00')
  const setDailyReminderTime = useSettingsStore((s) => s.setDailyReminderTime)
  const budgetAlertsEnabled = useSettingsStore((s) => s.budgetAlertsEnabled)
  const setBudgetAlertsEnabled = useSettingsStore((s) => s.setBudgetAlertsEnabled)
  const notificationAutoApprove = useSettingsStore((s) => s.notificationAutoApprove)
  const setNotificationAutoApprove = useSettingsStore((s) => s.setNotificationAutoApprove)

  // Wallet list for auto-assignment
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || []
  const activeWallets = wallets.filter((w) => !w.isArchived)
  const autoWalletId = defaultWalletId ? String(defaultWalletId) : (activeWallets[0]?.id ? String(activeWallets[0].id) : '')

  useEffect(() => {
    if (!defaultWalletId && activeWallets[0]?.id) {
      setDefaultWalletId(activeWallets[0].id)
    }
  }, [defaultWalletId, activeWallets, setDefaultWalletId])

  // Native Notification Listener State
  const [isListenerGranted, setIsListenerGranted] = useState(false)
  const [isDisclosureOpen, setIsDisclosureOpen] = useState(false)
  const [isSyncingQueue, setIsSyncingQueue] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState({ text: '', isError: false })

  // Native SMS Ingestion State
  const [isSmsGranted, setIsSmsGranted] = useState(false)
  const [isRequestingSms, setIsRequestingSms] = useState(false)
  const [isScanningSms, setIsScanningSms] = useState(false)
  const [smsFeedback, setSmsFeedback] = useState({ text: '', isError: false })

  // Suspect Promo Cleaner State
  const [suspectTxs, setSuspectTxs] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanFeedback, setCleanFeedback] = useState('')

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
      if (FinTrackNotificationPlugin.checkSmsPermission) {
        const smsRes = await FinTrackNotificationPlugin.checkSmsPermission()
        setIsSmsGranted(Boolean(smsRes?.granted || (smsRes?.receiveGranted && smsRes?.readGranted)))
      }
    } catch (err){
      console.warn('[SettingsNotifications]', err)
      setIsListenerGranted(false)
    }
  }, [])

  const handleRequestSmsPermission = async () => {
    triggerHaptic('medium')
    setIsRequestingSms(true)
    try {
      if (FinTrackNotificationPlugin.requestSmsPermission) {
        await FinTrackNotificationPlugin.requestSmsPermission()
        await checkNativePermission()
      }
    } catch (err) {
      console.error('[SettingsNotifications] SMS request error', err)
    } finally {
      setIsRequestingSms(false)
    }
  }

  const handleScanHistoricalSms = async () => {
    triggerHaptic('medium')
    setIsScanningSms(true)
    setSmsFeedback({ text: '', isError: false })
    try {
      const res = await syncHistoricalSms({ days: 30 })
      if (res?.error) {
        triggerHaptic('error')
        setSmsFeedback({
          text: t('notif.smsScanError', 'Gagal memindai SMS: {{error}}', { error: res.error }),
          isError: true,
        })
      } else if (res?.syncedCount > 0) {
        triggerHaptic('success')
        setSmsFeedback({
          text: t('notif.smsScanSuccess', 'Berhasil memindai {{count}} transaksi SMS ke antrean peninjauan.', {
            count: res.syncedCount,
          }),
          isError: false,
        })
      } else {
        setSmsFeedback({
          text: t('notif.smsScanEmpty', 'Tidak ditemukan transaksi SMS perbankan baru dalam 30 hari terakhir.'),
          isError: false,
        })
      }
    } catch (err) {
      triggerHaptic('error')
      setSmsFeedback({
        text: err?.message || t('notif.smsScanError', 'Gagal memindai SMS: {{error}}', { error: 'Error' }),
        isError: true,
      })
    } finally {
      setIsScanningSms(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    FinTrackNotificationPlugin.isPermissionGranted()
      .then((res) => {
        if (isMounted) setIsListenerGranted(Boolean(res?.granted))
      })
      .catch((err) => console.warn('[SettingsNotifications]', err))

    if (FinTrackNotificationPlugin.checkSmsPermission) {
      FinTrackNotificationPlugin.checkSmsPermission()
        .then((smsRes) => {
          if (isMounted) {
            setIsSmsGranted(Boolean(smsRes?.granted || (smsRes?.receiveGranted && smsRes?.readGranted)))
          }
        })
        .catch((err) => console.warn('[SettingsNotifications] SMS check error', err))
    }

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

  const handleToggleAutoApprove = async () => {
    triggerHaptic('selection')
    const next = !notificationAutoApprove
    await setNotificationAutoApprove(next)
  }

  const handleScanPromo = async () => {
    triggerHaptic('selection')
    setIsScanning(true)
    setCleanFeedback('')
    try {
      const found = await scanSuspectPromoTransactions()
      setSuspectTxs(found)
      if (found.length === 0) {
        setCleanFeedback(t('notif.scanClean', 'Tidak ada mutasi promosi yang terdeteksi. Data Anda bersih.'))
      }
    } catch (err) {
      console.warn('[SettingsNotifications:handleScanPromo]', err)
      setCleanFeedback(t('common.error.generic', 'Gagal memindai transaksi.'))
    } finally {
      setIsScanning(false)
    }
  }

  const handleCleanPromo = async () => {
    if (!suspectTxs || suspectTxs.length === 0) return
    triggerHaptic('medium')
    setIsCleaning(true)
    try {
      const ids = suspectTxs.map((t) => t.id)
      const res = await cleanSuspectPromoTransactions(ids)
      triggerHaptic('success')
      setCleanFeedback(
        t('notif.cleanSuccess', 'Berhasil membersihkan {{count}} transaksi promosi dan memulihkan saldo dompet.', {
          count: res.deletedCount,
        })
      )
      setSuspectTxs([])
    } catch (err) {
      console.warn('[SettingsNotifications:handleCleanPromo]', err)
      setCleanFeedback(t('common.error.generic', 'Gagal membersihkan transaksi promosi.'))
    } finally {
      setIsCleaning(false)
    }
  }

  const handleManualSyncNotifs = async () => {
    triggerHaptic('selection')
    setIsSyncingQueue(true)
    setSyncFeedback({ text: '', isError: false })

    try {
      const result = await syncNotificationQueue({
        defaultWalletId: autoWalletId,
        defaultCurrency,
        notificationAutoApprove,
      })

      if (result?.error) {
        triggerHaptic('error')
        setSyncFeedback({
          text: t('notif.syncError', 'Gagal sinkronisasi notifikasi: {{error}}', { error: result.error }),
          isError: true,
        })
      } else if (result?.syncedCount > 0) {
        triggerHaptic('success')
        setSyncFeedback({
          text: t('notif.syncSuccess', 'Berhasil mencatat {{count}} mutasi baru.', { count: result.syncedCount }),
          isError: false,
        })
      } else {
        setSyncFeedback({
          text: t('notif.syncEmpty', 'Antrean notifikasi kosong.'),
          isError: false,
        })
      }
    } catch (err) {
      console.warn('[SettingsNotifications]', err)
      triggerHaptic('error')
      setSyncFeedback({
        text: err?.message || t('common.error.generic', 'Terjadi kesalahan saat sinkronisasi.'),
        isError: true,
      })
    } finally {
      setIsSyncingQueue(false)
      setTimeout(() => setSyncFeedback({ text: '', isError: false }), 4000)
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
                  onChange={async (e) => {
                    const val = e.target.value
                    await setDefaultWalletId(val ? Number(val) : null)
                  }}
                  className="ft-field text-xs font-bold py-1.5 px-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)]"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Safe Staging Review Switch */}
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5">
                <div>
                  <span className="block text-xs font-bold text-[var(--fg)]">
                    {t('notif.stagingReviewTitle', 'Wajibkan Tinjauan Sebelum Masuk Saldo')}
                  </span>
                  <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5 max-w-sm">
                    {t(
                      'notif.stagingReviewDesc',
                      'Mutasi notifikasi menunggu persetujuan Anda di halaman Transaksi, mencegah saldo dompet berkurang otomatis oleh notifikasi keliru.'
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!notificationAutoApprove}
                  onClick={handleToggleAutoApprove}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    !notificationAutoApprove ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      !notificationAutoApprove ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sync Action Button */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)]">
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

      {/* Group 1B: Integrasi SMS Perbankan (Hybrid & Historical Scanner) */}
      <SettingsSection
        label={t('notif.smsSection', 'Integrasi SMS Perbankan (Hybrid & Offline)')}
        footnote={t(
          'notif.smsFootnote',
          'Mendeteksi mutasi dari SMS perbankan (BCA, Mandiri, BRI, BNI, CIMB, Permata, Danamon, Mega, dll.). Pesan kode OTP, token rahasia, dan nomor pribadi otomatis difilter dan dibuang (Zero-Knowledge).'
        )}
      >
        <div className="ft-settings-cell space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-extrabold text-[var(--fg)]">
                  {t('notif.smsTitle', 'Penangkapan SMS Perbankan')}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSmsGranted ? 'bg-emerald-500' : 'bg-zinc-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-[var(--muted)]">
                    {isSmsGranted
                      ? t('notif.smsActive', 'Izin SMS Aktif (Latar Belakang Penuh)')
                      : t('notif.smsInactive', 'Mode Notifikasi (Standar)')}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestSmsPermission}
              disabled={isRequestingSms}
              className="px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{isSmsGranted ? t('notif.smsGranted', 'Aktif') : t('notif.smsEnable', 'Aktifkan Izin SMS')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Historical 30-Day SMS Scan */}
          <div className="border-t border-[var(--border)] pt-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="block text-xs font-bold text-[var(--fg)]">
                  {t('notif.smsHistoricalTitle', 'Pindai Riwayat SMS (30 Hari Terakhir)')}
                </span>
                <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5">
                  {t(
                    'notif.smsHistoricalDesc',
                    'Membaca SMS perbankan yang sudah ada di kotak masuk untuk memasukkan mutasi masa lalu ke antrean peninjauan.'
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={handleScanHistoricalSms}
                disabled={isScanningSms}
                className="h-9 px-3.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isScanningSms ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>{t('notif.smsScanBtn', 'Pindai Kotak Masuk')}</span>
              </button>
            </div>

            {smsFeedback?.text && (
              <p
                className={`text-xs font-bold animate-fadeIn pt-1 ${
                  smsFeedback.isError ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-500'
                }`}
              >
                {smsFeedback.text}
              </p>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Group 1C: Pembersih Transaksi Promosi & Spam */}
      <SettingsSection
        label={t('notif.cleanerSection', 'Pembersih Mutasi Promosi & Spam')}
        footnote={t(
          'notif.cleanerFootnote',
          'Pindai dan bersihkan transaksi promosi atau marketing clickbait yang tidak sengaja tercatat di riwayat mutasi Anda, serta pulihkan saldo dompet yang terpotong.'
        )}
      >
        <div className="ft-settings-cell space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-extrabold text-[var(--fg)]">
                  {t('notif.scanTitle', 'Pindai Transaksi Promosi')}
                </span>
                <span className="block text-xs font-medium text-[var(--muted)] mt-0.5">
                  {t('notif.scanSubtitle', 'Deteksi mutasi yang berasal dari teks penawaran / promo e-wallet.')}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isScanning}
              onClick={handleScanPromo}
              className="h-9 px-3.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>{t('notif.scanAction', 'Pindai')}</span>
            </button>
          </div>

          {/* Scan Results / Feedback */}
          {cleanFeedback && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 text-xs font-semibold text-[var(--fg)]">
              {cleanFeedback}
            </div>
          )}

          {suspectTxs && suspectTxs.length > 0 && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {t('notif.foundSuspect', 'Ditemukan {{count}} transaksi promosi marketing:', {
                      count: suspectTxs.length,
                    })}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isCleaning}
                  onClick={handleCleanPromo}
                  className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50 hover:bg-rose-700"
                >
                  {isCleaning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  <span>{t('notif.cleanAll', 'Hapus & Pulihkan Saldo')}</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {suspectTxs.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--panel)] border border-[var(--border)] text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[var(--fg)] truncate">{tx.notes || tx.category}</p>
                      <p className="text-[10px] text-[var(--muted)]">{tx.date}</p>
                    </div>
                    <span className="font-bold text-rose-500 shrink-0">
                      -Rp {Number(tx.amount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
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
      {isDisclosureOpen && (
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
      )}
    </div>
  )
}
