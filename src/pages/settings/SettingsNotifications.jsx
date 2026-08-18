import { useState } from 'react'
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Zap,
} from 'lucide-react'
import {
  requestNotificationPermission,
  syncDailyReminderSchedule,
} from '../../lib/smartNotifications'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection } from './settingsComponents'

export default function SettingsNotifications() {
  const { t } = useTranslation()
  const dailyReminderEnabled = useSettingsStore((s) => s.dailyReminderEnabled)
  const setDailyReminderEnabled = useSettingsStore((s) => s.setDailyReminderEnabled)
  const dailyReminderTime = useSettingsStore((s) => s.dailyReminderTime || '20:00')
  const setDailyReminderTime = useSettingsStore((s) => s.setDailyReminderTime)
  const budgetAlertsEnabled = useSettingsStore((s) => s.budgetAlertsEnabled)
  const setBudgetAlertsEnabled = useSettingsStore((s) => s.setBudgetAlertsEnabled)

  const [hasPermission, setHasPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted'
    }
    return true
  })
  const [testSent, setTestSent] = useState(false)
  const [timeInput, setTimeInput] = useState(dailyReminderTime)

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

  const handleSendTestNotification = async () => {
    const ok = await requestNotificationPermission()
    setHasPermission(ok)
    if (!ok) return

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('FinTrack • Pengingat Catat Keuangan', {
        body: 'Notifikasi uji coba berhasil! FinTrack siap mengingatkan pencatatan keuangan Anda.',
      })
      setTestSent(true)
      setTimeout(() => setTestSent(false), 2500)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-2xs">
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

      {/* Group 1: Pengingat Harian */}
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
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
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
                dailyReminderEnabled ? 'bg-indigo-600' : 'bg-zinc-700'
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
                className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Group 2: Peringatan Anggaran Real-Time */}
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
          onClick={handleSendTestNotification}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-xs font-extrabold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
        >
          {testSent ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Send className="h-4 w-4 text-indigo-500" />
          )}
          <span>
            {testSent
              ? t('settings.notifications.testSent', 'Notifikasi Uji Terkirim!')
              : t('settings.notifications.testBtn', 'Kirim Notifikasi Uji Coba')}
          </span>
        </button>
      </div>
    </div>
  )
}
