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
import { triggerHaptic } from '../../lib/haptics'
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
      { value: 0, label: t('settings.security.immediately', 'Segera') },
      { value: 60, label: t('settings.security.oneMin', '1 Menit') },
      { value: 300, label: t('settings.security.fiveMin', '5 Menit') },
      { value: 900, label: t('settings.security.fifteenMin', '15 Menit') },
    ],
    [t],
  )

  const handleToggleSecurity = async (enabled) => {
    triggerHaptic('medium')
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
    triggerHaptic('light')
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
                ? t('settings.security.bioActive', 'Proteksi Biometrik Aktif')
                : t('settings.security.bioInactive', 'Proteksi Kunci Nonaktif')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 leading-relaxed">
              {isEnabledState
                ? t('settings.security.bioActiveDesc', 'Data transaksi dilindungi oleh autentikasi biometrik & sandi layar HP')
                : t('settings.security.bioInactiveDesc', 'Aktifkan untuk melindungi privasi data keuangan Anda saat aplikasi dibuka')}
            </p>
          </div>
        </div>

        {isEnabledState && (
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--border)]/60">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{t('settings.security.methodLabel', 'Metode Kunci')}</span>
              <span className="block text-xs font-black text-[var(--fg)] mt-0.5">{t('settings.security.fingerprintOrDevice', 'Sidik Jari / Sandi HP')}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{t('settings.security.timeoutLabel', 'Waktu Kunci')}</span>
              <span className="block text-xs font-black text-[var(--fg)] mt-0.5">
                {timeoutOptions.find((opt) => opt.value === timeoutSec)?.label || (timeoutSec === 0 ? t('settings.security.immediately', 'Segera') : `${timeoutSec}s`)}
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
          label={t('settings.security.appLockTitle', 'Kunci Aplikasi & Biometrik')}
          description={t('settings.security.appLockDesc', 'Gunakan kunci default perangkat Anda')}
          icon={Fingerprint}
          checked={isEnabledState}
          onChange={handleToggleSecurity}
        />

        {isEnabledState && (
          <>
            {/* Auto Lock Timeout */}
            <SettingsSplitRow
              label={t('settings.security.autoLockTimeoutTitle', 'Waktu Kunci Otomatis')}
              description={t('settings.security.autoLockTimeoutDesc', 'Kunci saat aplikasi di latar belakang')}
              icon={Clock}
            >
              <SettingsSegmentControl
                options={timeoutOptions}
                value={timeoutSec}
                onChange={(val) => handleSaveTimeout(Number(val))}
                ariaLabel={t('settings.security.autoLockTimeoutTitle', 'Waktu Kunci Otomatis')}
              />
            </SettingsSplitRow>

            {/* Info Cell */}
            <div className="ft-settings-cell flex items-center gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-2xs">
                <Smartphone className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                {t('settings.security.infoCellDesc', 'Saat aplikasi dibuka atau diminimalkan, dialog biometrik/sandi bawaan HP Anda akan otomatis muncul untuk verifikasi cepat dan aman.')}
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
              <span>{t('settings.security.lockNow', 'Kunci Aplikasi Sekarang')}</span>
            </button>
          </div>
        )}
      </SettingsSection>
    </>
  )
}
