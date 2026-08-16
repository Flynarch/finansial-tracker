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
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
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
  const autoLockTimeout = useSettingsStore((state) => state.autoLockTimeout)
  const setSecurity = useSettingsStore((state) => state.setSecurity)
  const lock = useSettingsStore((state) => state.lock)

  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isEnabledState, setIsEnabledState] = useState(securityEnabled)
  const [method, setMethod] = useState(securityMethod || 'pin')
  const [timeoutSec, setTimeoutSec] = useState(autoLockTimeout || 0)

  // PIN Form
  const [pinInput, setPinInput] = useState(securityMethod === 'pin' ? lockSecret : '')
  const [confirmPinInput, setConfirmPinInput] = useState(securityMethod === 'pin' ? lockSecret : '')
  const [showPin, setShowPin] = useState(false)

  // Pattern Form
  const [patternInput, setPatternInput] = useState(securityMethod === 'pattern' ? lockSecret : '')
  const [confirmPatternInput, setConfirmPatternInput] = useState(
    securityMethod === 'pattern' ? lockSecret : '',
  )
  const [patternStep, setPatternStep] = useState(1) // 1: draw new, 2: confirm

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

  const timeoutOptions = useMemo(
    () => [
      { value: 0, label: 'Segera' },
      { value: 60, label: '1 Menit' },
      { value: 300, label: '5 Menit' },
    ],
    [],
  )

  const handleToggleStatus = (val) => {
    const enabled = val === 'on'
    setIsEnabledState(enabled)
    setStatusMessage('')
    setErrorMessage('')
    if (!enabled) {
      // Direct disable
      setSecurity({
        securityEnabled: false,
        securityMethod: method,
        lockSecret: '',
        autoLockTimeout: timeoutSec,
      })
      setStatusMessage(t('settings.securityDisabledSuccess', 'Kunci aplikasi berhasil dinonaktifkan.'))
    }
  }

  const handleSaveSecurity = async () => {
    setStatusMessage('')
    setErrorMessage('')

    if (!isEnabledState) {
      await setSecurity({
        securityEnabled: false,
        securityMethod: method,
        lockSecret: '',
        autoLockTimeout: timeoutSec,
      })
      setStatusMessage(t('settings.securityDisabledSuccess', 'Kunci aplikasi dinonaktifkan.'))
      return
    }

    if (method === 'pin') {
      if (!pinInput || pinInput.length < 4) {
        setErrorMessage(t('settings.pinTooShort', 'PIN minimal 4 digit angka.'))
        return
      }
      if (pinInput !== confirmPinInput) {
        setErrorMessage(t('settings.pinMismatch', 'Konfirmasi PIN tidak cocok dengan PIN baru.'))
        return
      }
      await setSecurity({
        securityEnabled: true,
        securityMethod: 'pin',
        lockSecret: pinInput,
        autoLockTimeout: timeoutSec,
      })
      setStatusMessage(t('settings.securityPinSaved', 'Kunci PIN berhasil disimpan dan aktif!'))
    } else if (method === 'pattern') {
      if (!patternInput || patternInput.split('-').length < 4) {
        setErrorMessage(t('settings.patternTooShort', 'Pola minimal menghubungkan 4 titik.'))
        return
      }
      if (patternInput !== confirmPatternInput) {
        setErrorMessage(
          t('settings.patternMismatch', 'Pola konfirmasi tidak cocok. Silakan ulangi.'),
        )
        return
      }
      await setSecurity({
        securityEnabled: true,
        securityMethod: 'pattern',
        lockSecret: patternInput,
        autoLockTimeout: timeoutSec,
      })
      setStatusMessage(t('settings.securityPatternSaved', 'Kunci Pola berhasil disimpan dan aktif!'))
    } else if (method === 'biometric') {
      await setSecurity({
        securityEnabled: true,
        securityMethod: 'biometric',
        lockSecret: 'biometric-enabled',
        autoLockTimeout: timeoutSec,
      })
      setStatusMessage(t('settings.securityBioSaved', 'Kunci Biometrik berhasil diaktifkan!'))
    }
  }

  const isPinMatch = pinInput && confirmPinInput && pinInput === confirmPinInput

  return (
    <>
      {statusMessage ? (
        <div
          className="mb-3.5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-500 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          className="mb-3.5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-500 animate-fadeIn"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Security Status Card */}
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-2.5 shadow-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
            {securityEnabled ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--fg)]">
              {securityEnabled ? 'Proteksi Aplikasi Aktif' : 'Proteksi Kunci Nonaktif'}
            </h3>
            <p className="text-[10.5px] font-medium text-[var(--muted)] truncate mt-0.5">
              {securityEnabled
                ? `Metode: ${securityMethod.toUpperCase()} • Kunci otomatis saat latar belakang`
                : 'Aktifkan kunci untuk melindungi privasi data finansial Anda'}
            </p>
          </div>
        </div>
      </div>

      <SettingsSection
        label={t('settings.appLock', 'Kunci Aplikasi')}
        footnote={t(
          'settings.securityFootnote',
          'Aplikasi akan terkunci secara otomatis saat berpindah aplikasi atau setelah periode latar belakang.',
        )}
      >
        <SettingsSplitRow
          label={t('settings.lockStatus', 'Status Kunci')}
          description="Nyalakan atau matikan proteksi"
          icon={isEnabledState ? Lock : Unlock}
        >
          <SettingsSegmentControl
            options={lockStatusOptions}
            value={isEnabledState ? 'on' : 'off'}
            onChange={handleToggleStatus}
            ariaLabel={t('settings.lockStatus', 'Status Kunci')}
          />
        </SettingsSplitRow>

        {isEnabledState && (
          <>
            <SettingsSplitRow
              label={t('settings.lockMethod', 'Metode Kunci')}
              description="Pilih cara autentikasi"
              icon={KeyRound}
            >
              <SettingsSegmentControl
                options={methodOptions}
                value={method}
                onChange={(val) => {
                  setMethod(val)
                  setErrorMessage('')
                  setStatusMessage('')
                }}
                ariaLabel={t('settings.lockMethod', 'Metode Kunci')}
              />
            </SettingsSplitRow>

            <SettingsSplitRow
              label="Waktu Kunci Otomatis"
              description="Kunci saat di latar belakang"
              icon={Clock}
            >
              <SettingsSegmentControl
                options={timeoutOptions}
                value={timeoutSec}
                onChange={(val) => setTimeoutSec(Number(val))}
                ariaLabel="Waktu Kunci Otomatis"
              />
            </SettingsSplitRow>

            {/* PIN INPUT FORM WITH CONFIRMATION & SHOW/HIDE */}
            {method === 'pin' && (
              <div className="ft-settings-cell space-y-3">
                {/* 1. New PIN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="new-pin-input"
                      className="text-[11px] font-bold text-[var(--fg)]"
                    >
                      PIN Baru (4-6 Digit)
                    </label>
                    <span className="text-[10px] font-medium text-[var(--muted)]">
                      {pinInput.length}/6 Digit
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="new-pin-input"
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t('settings.pinPlaceholder', 'Masukkan 4-6 digit PIN...')}
                      value={pinInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setPinInput(val)
                        setErrorMessage('')
                      }}
                      className="ft-settings-field-compact font-mono text-center tracking-widest text-sm pr-8"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-2 text-[var(--muted)] hover:text-[var(--fg)] p-1 transition cursor-pointer"
                      title={showPin ? t('settings.hidePin', 'Sembunyikan PIN') : t('settings.showPin', 'Tampilkan PIN')}
                    >
                      {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* 2. Confirm PIN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="confirm-pin-input"
                      className="text-[11px] font-bold text-[var(--fg)]"
                    >
                      {t('settings.confirmPinLabel', 'Ulangi PIN Konfirmasi')}
                    </label>
                    {confirmPinInput.length > 0 && (
                      <span
                        className={`text-[10px] font-bold ${
                          isPinMatch ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {isPinMatch ? t('settings.pinMatched', 'Cocok') : t('settings.pinNotMatched', 'Belum Cocok')}
                      </span>
                    )}
                  </div>
                  <input
                    id="confirm-pin-input"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('settings.confirmPinPlaceholder', 'Ketik ulang PIN...')}
                    value={confirmPinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setConfirmPinInput(val)
                      setErrorMessage('')
                    }}
                    className={`ft-settings-field-compact font-mono text-center tracking-widest text-sm ${
                      confirmPinInput && !isPinMatch
                        ? 'border-rose-500/50'
                        : confirmPinInput && isPinMatch
                          ? 'border-emerald-500/50'
                          : ''
                    }`}
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* PATTERN FORM */}
            {method === 'pattern' && (
              <div className="ft-settings-cell space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[var(--fg)]">
                    {patternStep === 1 ? 'Langkah 1: Buat Pola Baru' : 'Langkah 2: Konfirmasi Pola'}
                  </p>
                  <span className="text-[10.5px] font-medium text-[var(--muted)]">
                    Minimal 4 Titik
                  </span>
                </div>

                <div className="flex justify-center py-1">
                  <PatternPad
                    value={patternStep === 1 ? patternInput : confirmPatternInput}
                    onChange={(pattern) => {
                      if (patternStep === 1) {
                        setPatternInput(pattern)
                      } else {
                        setConfirmPatternInput(pattern)
                      }
                      setErrorMessage('')
                    }}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  {patternStep === 1 ? (
                    <button
                      type="button"
                      disabled={!patternInput || patternInput.split('-').length < 4}
                      onClick={() => setPatternStep(2)}
                      className="w-full rounded-lg bg-[var(--fg)] py-2 text-xs font-bold text-[var(--bg)] shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      Lanjut Konfirmasi Pola
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPatternStep(1)
                          setConfirmPatternInput('')
                        }}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-2 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
                      >
                        Ulangi Pola
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* BIOMETRIC */}
            {method === 'biometric' && (
              <div className="ft-settings-cell flex items-center gap-2.5">
                <Fingerprint className="h-6 w-6 text-[var(--fg)] shrink-0" />
                <p className="text-[11px] font-medium text-[var(--muted)] leading-relaxed">
                  Autentikasi sidik jari atau Face Unlock bawaan perangkat Anda akan otomatis
                  diminta saat membuka aplikasi.
                </p>
              </div>
            )}
          </>
        )}

        {/* ACTION BUTTONS */}
        <div className="ft-settings-cell space-y-2">
          <button
            type="button"
            onClick={handleSaveSecurity}
            className="w-full rounded-lg bg-[var(--fg)] py-2.5 px-3 text-xs font-extrabold text-[var(--bg)] shadow-sm transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            {t('settings.saveLockSettings', 'Simpan Pengaturan Kunci')}
          </button>

          {securityEnabled && (
            <button
              type="button"
              onClick={() => lock()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Tes Kunci Aplikasi Sekarang</span>
            </button>
          )}
        </div>
      </SettingsSection>
    </>
  )
}
