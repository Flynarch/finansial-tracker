import { useEffect, useState, useMemo } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Grid3x3,
  Fingerprint,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react'
import PatternPad from '../../components/ui/PatternPad'
import { canUseBiometric } from '../../lib/biometric'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection, SettingsSegmentControl, SettingsSplitRow } from './settingsComponents'

export default function SettingsSecurity() {
  const { t } = useTranslation()
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const securityMethod = useSettingsStore((state) => state.securityMethod)
  const lockSecret = useSettingsStore((state) => state.lockSecret)
  const setSecurity = useSettingsStore((state) => state.setSecurity)
  const lock = useSettingsStore((state) => state.lock)

  const [statusMessage, setStatusMessage] = useState('')
  const [securityForm, setSecurityForm] = useState({
    method: securityMethod || 'pin',
    secret: lockSecret || '',
  })
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  useEffect(() => {
    canUseBiometric().then(setBiometricAvailable)
  }, [])

  const lockStatusOptions = useMemo(
    () => [
      { value: 'off', label: t('settings.lockStatus.off', 'Nonaktif'), icon: Unlock },
      { value: 'on', label: t('settings.lockStatus.on', 'Aktif'), icon: Lock },
    ],
    [t],
  )

  const methodOptions = useMemo(() => {
    const list = [
      { value: 'pin', label: 'PIN', icon: KeyRound },
      { value: 'pattern', label: 'Pola', icon: Grid3x3 },
    ]
    if (biometricAvailable) {
      list.push({ value: 'biometric', label: 'Biometrik', icon: Fingerprint })
    }
    return list
  }, [biometricAvailable])

  const handleSaveSecurity = async () => {
    if (securityEnabled && !securityForm.secret && securityForm.method !== 'biometric') {
      setStatusMessage(t('settings.status.securityNeedSecret', 'Silakan masukkan kode PIN atau pola terlebih dahulu.'))
      return
    }
    await setSecurity({
      securityEnabled,
      securityMethod: securityForm.method,
      lockSecret: securityForm.method === 'biometric' ? 'biometric-enabled' : securityForm.secret,
    })
    setStatusMessage(t('settings.status.securitySaved', 'Pengaturan keamanan berhasil disimpan.'))
    setTimeout(() => {
      lock()
    }, 600)
  }

  return (
    <>
      {statusMessage ? (
        <div
          className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-500 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Security Status Card */}
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
              securityEnabled
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}
          >
            {securityEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--fg)]">
              {securityEnabled ? 'Aplikasi Terkunci' : 'Kunci Aplikasi Nonaktif'}
            </h3>
            <p className="text-[11px] font-medium text-[var(--muted)] mt-0.5">
              {securityEnabled
                ? `Menggunakan ${securityMethod.toUpperCase()} untuk proteksi data`
                : 'Aktifkan kunci untuk melindungi privasi data keuangan Anda'}
            </p>
          </div>
        </div>
      </div>

      <SettingsSection
        label={t('settings.appLock', 'Kunci Aplikasi')}
        footnote={t(
          'settings.securityFootnote',
          'Kunci aplikasi melindungi akses saat aplikasi diminimalkan atau dibuka kembali.',
        )}
      >
        <SettingsSplitRow
          label={t('settings.lockStatus', 'Status Kunci')}
          description="Nyalakan atau matikan kunci privasi"
          icon={securityEnabled ? Lock : Unlock}
          iconColor={securityEnabled ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'}
        >
          <SettingsSegmentControl
            options={lockStatusOptions}
            value={securityEnabled ? 'on' : 'off'}
            onChange={(val) =>
              setSecurity({
                securityEnabled: val === 'on',
              })
            }
            ariaLabel={t('settings.lockStatus', 'Status Kunci')}
          />
        </SettingsSplitRow>

        {securityEnabled && (
          <>
            <SettingsSplitRow
              label={t('settings.lockMethod', 'Metode Kunci')}
              description="Pilih cara autentikasi Anda"
              icon={KeyRound}
            >
              <SettingsSegmentControl
                options={methodOptions}
                value={securityForm.method}
                onChange={(val) => setSecurityForm((prev) => ({ ...prev, method: val }))}
                ariaLabel={t('settings.lockMethod', 'Metode Kunci')}
              />
            </SettingsSplitRow>

            {securityForm.method === 'pattern' ? (
              <div className="ft-settings-cell space-y-3">
                <p className="text-xs font-bold text-[var(--fg)]">
                  {t('settings.patternSecret', 'Buat Pola Kunci')}
                </p>
                <div className="flex justify-center py-2">
                  <PatternPad
                    value={securityForm.secret}
                    onChange={(pattern) =>
                      setSecurityForm((prev) => ({ ...prev, secret: pattern }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {securityForm.method === 'pin' ? (
              <div className="ft-settings-cell space-y-2">
                <label
                  className="block text-xs font-bold text-[var(--fg)]"
                  htmlFor="settings-pin-sub"
                >
                  {t('settings.pin', 'Kode PIN Rahasia')}
                </label>
                <input
                  id="settings-pin-sub"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t('settings.pinPlaceholder', 'Masukkan 4-6 digit PIN...')}
                  value={securityForm.secret}
                  onChange={(event) =>
                    setSecurityForm((prev) => ({ ...prev, secret: event.target.value }))
                  }
                  onInput={() => setStatusMessage('')}
                  className="ft-settings-field-compact font-mono text-center tracking-widest text-base"
                  autoComplete="off"
                />
              </div>
            ) : null}

            {securityForm.method === 'biometric' ? (
              <div className="ft-settings-cell flex items-center gap-3">
                <Fingerprint className="h-8 w-8 text-emerald-500 shrink-0" />
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  Autentikasi biometrik perangkat (sidik jari atau face unlock) siap digunakan saat
                  membuka aplikasi.
                </p>
              </div>
            ) : null}
          </>
        )}

        <div className="ft-settings-cell">
          <button
            type="button"
            onClick={handleSaveSecurity}
            className="w-full rounded-xl bg-[var(--fg)] py-2.5 px-4 text-xs font-extrabold text-[var(--bg)] shadow-md transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            {t('settings.saveLockSettings', 'Simpan Pengaturan Kunci')}
          </button>
        </div>
      </SettingsSection>
    </>
  )
}
