import { useState, useMemo } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Lock,
  CheckCircle2,
  Clock,
  Smartphone,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import {
  SettingsSection,
  SettingsSegmentControl,
  SettingsToggleRow,
  SettingsSplitRow,
} from './settingsComponents'

export default function SettingsSecurity() {
  const { t } = useTranslation()
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const autoLockTimeout = useSettingsStore((state) => state.autoLockTimeout)
  const setSecurity = useSettingsStore((state) => state.setSecurity)
  const lock = useSettingsStore((state) => state.lock)

  const [statusMessage, setStatusMessage] = useState('')
  const [isEnabledState, setIsEnabledState] = useState(securityEnabled)
  const [timeoutSec, setTimeoutSec] = useState(autoLockTimeout || 0)

  const timeoutOptions = useMemo(
    () => [
      { value: 0, label: 'Segera' },
      { value: 60, label: '1 Menit' },
      { value: 300, label: '5 Menit' },
    ],
    [],
  )

  const handleToggleSecurity = async (enabled) => {
    setIsEnabledState(enabled)
    setStatusMessage('')
    await setSecurity({
      securityEnabled: enabled,
      securityMethod: 'biometric',
      lockSecret: enabled ? 'biometric-enabled' : '',
      autoLockTimeout: timeoutSec,
    })
    setStatusMessage(
      enabled
        ? t('settings.securityBioSaved', 'Kunci sidik jari / sandi bawaan HP berhasil diaktifkan!')
        : t('settings.securityDisabledSuccess', 'Kunci aplikasi dinonaktifkan.'),
    )
  }

  const handleSaveTimeout = async (sec) => {
    setTimeoutSec(sec)
    if (isEnabledState) {
      await setSecurity({
        securityEnabled: true,
        securityMethod: 'biometric',
        lockSecret: 'biometric-enabled',
        autoLockTimeout: sec,
      })
      setStatusMessage(t('settings.securityTimeoutSaved', 'Waktu kunci otomatis berhasil diperbarui!'))
    }
  }

  return (
    <>
      {statusMessage ? (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Security Hero Status Shield */}
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border shadow-2xs ${
            isEnabledState
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
          }`}>
            {isEnabledState ? (
              <ShieldCheck className="h-7 w-7" />
            ) : (
              <ShieldAlert className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
              {isEnabledState
                ? 'Proteksi Biometrik Aktif'
                : 'Proteksi Kunci Nonaktif'}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 leading-relaxed">
              {isEnabledState
                ? 'Data transaksi dilindungi oleh autentikasi biometrik & sandi layar HP'
                : 'Aktifkan untuk melindungi privasi data keuangan Anda saat aplikasi dibuka'}
            </p>
          </div>
        </div>

        {isEnabledState && (
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--border)]/60">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Metode Kunci</span>
              <span className="block text-xs font-black text-[var(--fg)] mt-0.5">Sidik Jari / Sandi HP</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Waktu Kunci</span>
              <span className="block text-xs font-black text-[var(--fg)] mt-0.5">
                {timeoutSec === 0 ? 'Segera (Background)' : timeoutSec === 60 ? '1 Menit' : '5 Menit'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Lock Configuration */}
      <SettingsSection
        label={t('settings.appLock', 'Konfigurasi Kunci')}
        footnote={t(
          'settings.biometricFootnote',
          'Aplikasi menggunakan keamanan bawaan HP (Sidik Jari, Face Unlock, atau Pola/PIN layar HP). Anda tidak perlu menghafal PIN terpisah.',
        )}
      >
        {/* iOS-Style Toggle Switch */}
        <SettingsToggleRow
          label="Kunci Aplikasi & Biometrik"
          description="Gunakan kunci default perangkat Anda"
          icon={Fingerprint}
          checked={isEnabledState}
          onChange={handleToggleSecurity}
        />

        {isEnabledState && (
          <>
            {/* Auto Lock Timeout */}
            <SettingsSplitRow
              label="Waktu Kunci Otomatis"
              description="Kunci saat aplikasi di latar belakang"
              icon={Clock}
            >
              <SettingsSegmentControl
                options={timeoutOptions}
                value={timeoutSec}
                onChange={(val) => handleSaveTimeout(Number(val))}
                ariaLabel="Waktu Kunci Otomatis"
              />
            </SettingsSplitRow>

            {/* Info Cell */}
            <div className="ft-settings-cell flex items-center gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-2xs">
                <Smartphone className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Saat aplikasi dibuka atau diminimalkan, dialog biometrik/sandi bawaan HP Anda akan otomatis muncul untuk verifikasi cepat dan aman.
              </p>
            </div>
          </>
        )}

        {/* Action Button: Lock App Now */}
        {isEnabledState && (
          <div className="ft-settings-cell">
            <button
              type="button"
              onClick={() => lock()}
              className="w-full h-12 flex items-center justify-center gap-2.5 rounded-2xl bg-[var(--fg)] text-[var(--bg)] py-3 px-4 text-sm font-black hover:opacity-90 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Lock className="h-4.5 w-4.5" />
              <span>Kunci Aplikasi Sekarang</span>
            </button>
          </div>
        )}
      </SettingsSection>
    </>
  )
}
