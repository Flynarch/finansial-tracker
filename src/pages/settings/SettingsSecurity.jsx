import { useState, useMemo } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Lock,
  CheckCircle2,
  Clock,
  Smartphone,
  KeyRound,
  Download,
  RotateCcw,
  ArrowRight,
  Loader2,
  Grid3X3,
  Pencil,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import { downloadTextFile } from '../../lib/utils'
import { getLocalDateString } from '../../lib/dateUtils'
import { exportAllDataAsEncryptedEnvelope } from '../../lib/backup'
import { getSessionMnemonicPhrase } from '../../lib/mnemonicCrypto'
import { getStoredPasskeys } from '../../lib/passkeys'
import {
  SettingsSection,
  SettingsSegmentControl,
  SettingsToggleRow,
  SettingsSplitRow,
} from './settingsComponents'
import MnemonicSetupModal from '../../components/security/MnemonicSetupModal'
import MnemonicRecoveryModal from '../../components/security/MnemonicRecoveryModal'
import PasskeysManagerModal from '../../components/security/PasskeysManagerModal'
import PinPadModal from '../../components/security/PinPadModal'
import PatternLockModal from '../../components/security/PatternLockModal'

export default function SettingsSecurity() {
  const { t } = useTranslation()
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const securityMethod = useSettingsStore((state) => state.securityMethod || 'none')
  const lockSecret = useSettingsStore((state) => state.lockSecret || '')
  const biometricEnabled = useSettingsStore((state) => state.biometricEnabled !== false)
  const autoLockTimeout = useSettingsStore((state) => state.autoLockTimeout || 0)
  const setSecurity = useSettingsStore((state) => state.setSecurity)
  const lock = useSettingsStore((state) => state.lock)

  const [statusMessage, setStatusMessage] = useState('')
  const [timeoutSec, setTimeoutSec] = useState(autoLockTimeout)

  // PIN & Pattern modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false)

  // Zero-Knowledge E2EE State
  const [isE2eeActive, setIsE2eeActive] = useState(() => {
    return localStorage.getItem('fintrack_e2ee_active') === 'true'
  })
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false)
  const [isExportingEnc, setIsExportingEnc] = useState(false)

  // Passkeys State
  const [isPasskeysModalOpen, setIsPasskeysModalOpen] = useState(false)
  const [passkeysCount, setPasskeysCount] = useState(() => getStoredPasskeys().length)

  const currentMethod = securityEnabled
    ? (securityMethod === 'pattern' ? 'pattern' : 'pin')
    : 'none'

  const methodOptions = useMemo(
    () => [
      { value: 'none', label: t('common.disabled', 'Mati') },
      { value: 'pin', label: 'PIN (Sandi)' },
      { value: 'pattern', label: 'Pola (Pattern)' },
    ],
    [t],
  )

  const timeoutOptions = useMemo(
    () => [
      { value: 0, label: t('settings.security.immediately', 'Segera') },
      { value: 60, label: t('settings.security.oneMin', '1 Menit') },
      { value: 300, label: t('settings.security.fiveMin', '5 Menit') },
      { value: 900, label: t('settings.security.fifteenMin', '15 Menit') },
    ],
    [t],
  )

  const handleSelectMethod = async (nextMethod) => {
    triggerHaptic('medium')
    setStatusMessage('')

    if (nextMethod === 'none') {
      await setSecurity({
        securityEnabled: false,
        securityMethod: 'none',
      })
      setStatusMessage(t('settings.securityDisabledSuccess', 'Kunci aplikasi dinonaktifkan.'))
      return
    }

    if (nextMethod === 'pin') {
      if (securityMethod === 'pin' && lockSecret) {
        await setSecurity({
          securityEnabled: true,
          securityMethod: 'pin',
          biometricEnabled: true, // auto-enable biometrics
        })
        setStatusMessage(t('settings.pinEnabled', 'Kunci PIN aktif bersama verifikasi biometrik.'))
      } else {
        setIsPinModalOpen(true)
      }
      return
    }

    if (nextMethod === 'pattern') {
      if (securityMethod === 'pattern' && lockSecret) {
        await setSecurity({
          securityEnabled: true,
          securityMethod: 'pattern',
          biometricEnabled: true, // auto-enable biometrics
        })
        setStatusMessage(t('settings.patternEnabled', 'Kunci Pola aktif bersama verifikasi biometrik.'))
      } else {
        setIsPatternModalOpen(true)
      }
    }
  }

  const handleSavePin = async (newPin) => {
    await setSecurity({
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: newPin,
      biometricEnabled: true, // auto-enable biometrics
      autoLockTimeout: timeoutSec,
    })
    setStatusMessage(t('settings.pinSavedSuccess', 'PIN berhasil disimpan dan biometrik otomatis aktif.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  const handleSavePattern = async (newPatternSeq) => {
    await setSecurity({
      securityEnabled: true,
      securityMethod: 'pattern',
      lockSecret: newPatternSeq,
      biometricEnabled: true, // auto-enable biometrics
      autoLockTimeout: timeoutSec,
    })
    setStatusMessage(t('settings.patternSavedSuccess', 'Pola berhasil disimpan dan biometrik otomatis aktif.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  const handleToggleBiometric = async (enabled) => {
    triggerHaptic('light')
    await setSecurity({
      biometricEnabled: enabled,
    })
    setStatusMessage(
      enabled
        ? t('settings.bioActiveMsg', 'Verifikasi biometrik diaktifkan.')
        : t('settings.bioInactiveMsg', 'Verifikasi biometrik dinonaktifkan.'),
    )
    setTimeout(() => setStatusMessage(''), 3000)
  }

  const handleSaveTimeout = async (sec) => {
    triggerHaptic('light')
    setTimeoutSec(sec)
    await setSecurity({
      autoLockTimeout: sec,
    })
  }

  const handleExportEncrypted = async () => {
    triggerHaptic('selection')
    setStatusMessage('')

    const savedPhrase = getSessionMnemonicPhrase()
    if (!savedPhrase || savedPhrase.trim().split(/\s+/).length !== 12) {
      setIsSetupModalOpen(true)
      return
    }

    setIsExportingEnc(true)
    try {
      const envelope = await exportAllDataAsEncryptedEnvelope(savedPhrase.trim())
      const jsonStr = JSON.stringify(envelope, null, 2)
      const ymd = getLocalDateString()
      downloadTextFile(`fintrack-e2ee-backup-${ymd}.enc`, jsonStr, 'application/json')
      setStatusMessage(t('mnemonic.exportSuccessBanner', 'Cadangan terenkripsi berhasil diunduh.'))
      setTimeout(() => setStatusMessage(''), 4000)
    } catch (err){
      console.warn('[SettingsSecurity]', err)
      setStatusMessage(t('common.error.saveFailed', 'Gagal mengenkripsi data cadangan.'))
    } finally {
      setIsExportingEnc(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card space-y-3">
        <div className="flex items-center gap-3.5">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-2xs ${
            securityEnabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
          }`}>
            {securityEnabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
              {t('settings.security.title', 'Keamanan & Kunci Aplikasi')}
            </h2>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              {securityEnabled
                ? (securityMethod === 'pattern' ? 'Dilindungi Pola & Biometrik' : 'Dilindungi PIN & Biometrik')
                : 'Kunci aplikasi saat ini dinonaktifkan'}
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* ── APP LOCK CONFIGURATION ── */}
      <SettingsSection
        label={t('settings.appLock', 'Kunci Aplikasi')}
        footnote={t(
          'settings.securityFootnote',
          'Pilih salah satu metode kunci: PIN angka atau Pola usap (keduanya bersifat eksklusif). Saat PIN atau Pola dinyalakan, autentikasi biometrik bawaan HP akan otomatis aktif untuk akses cepat.',
        )}
      >
        {/* Method Selector: None vs PIN vs Pattern */}
        <SettingsSplitRow
          label={t('settings.lockMethodTitle', 'Metode Kunci')}
          description={t('settings.lockMethodDesc', 'Pilih PIN atau Pola untuk mengamankan data')}
          icon={Lock}
        >
          <SettingsSegmentControl
            options={methodOptions}
            value={currentMethod}
            onChange={handleSelectMethod}
            ariaLabel={t('settings.lockMethodTitle', 'Metode Kunci')}
          />
        </SettingsSplitRow>

        {/* Change PIN / Pattern button */}
        {securityEnabled && securityMethod === 'pin' && (
          <div className="ft-settings-cell flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--lock-soft)] text-[var(--lock)] border border-[var(--lock)]/20">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-[var(--fg)]">
                  {t('settings.currentPin', 'PIN 4 Digit')}
                </span>
                <span className="text-[11px] font-medium text-[var(--muted)]">
                  {t('settings.pinActiveLabel', 'Aktif untuk membuka FinTrack')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPinModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5 text-[var(--muted)]" />
              <span>{t('settings.changePinBtn', 'Ubah PIN')}</span>
            </button>
          </div>
        )}

        {securityEnabled && securityMethod === 'pattern' && (
          <div className="ft-settings-cell flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--lock-soft)] text-[var(--lock)] border border-[var(--lock)]/20">
                <Grid3X3 className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-[var(--fg)]">
                  {t('settings.currentPattern', 'Pola Usap 3x3')}
                </span>
                <span className="text-[11px] font-medium text-[var(--muted)]">
                  {t('settings.patternActiveLabel', 'Aktif untuk membuka FinTrack')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPatternModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5 text-[var(--muted)]" />
              <span>{t('settings.changePatternBtn', 'Ubah Pola')}</span>
            </button>
          </div>
        )}

        {/* Biometric Toggle (Active alongside PIN or Pattern) */}
        {securityEnabled && (
          <SettingsToggleRow
            label={t('settings.biometricCombinedTitle', 'Buka dengan Sidik Jari / Biometrik')}
            description={t('settings.biometricCombinedDesc', 'Gunakan biometrik atau sandi HP sebagai alternatif instan')}
            icon={Fingerprint}
            checked={biometricEnabled}
            onChange={handleToggleBiometric}
          />
        )}

        {/* Auto Lock Timeout */}
        {securityEnabled && (
          <SettingsSplitRow
            label={t('settings.security.autoLockTimeoutTitle', 'Waktu Kunci Otomatis')}
            description={t('settings.security.autoLockTimeoutDesc', 'Kunci saat aplikasi diminimalkan')}
            icon={Clock}
          >
            <SettingsSegmentControl
              options={timeoutOptions}
              value={timeoutSec}
              onChange={(val) => handleSaveTimeout(Number(val))}
              ariaLabel={t('settings.security.autoLockTimeoutTitle', 'Waktu Kunci Otomatis')}
            />
          </SettingsSplitRow>
        )}

        {/* Action Button: Lock App Now */}
        {securityEnabled && (
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

      {/* ZERO-KNOWLEDGE E2EE SECTION */}
      <SettingsSection
        label={t('mnemonic.sectionTitle', 'Zero-Knowledge End-to-End Encryption (E2EE)')}
        footnote={t(
          'mnemonic.sectionFootnote',
          'Enkripsi lokal dengan standar BIP-39 dan AES-256-GCM. Kunci enkripsi dibuat secara eksklusif dari 12 kata rahasia Anda dan tidak pernah dikirim ke server manapun.',
        )}
      >
        <div className="ft-settings-cell space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--lock-soft)] text-[var(--lock)] border border-[var(--lock)]/20">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-extrabold text-[var(--fg)]">
                  {t('mnemonic.recoveryPhraseTitle', '12-Word Recovery Phrase')}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isE2eeActive ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-[var(--muted)]">
                    {isE2eeActive
                      ? t('mnemonic.statusActive', 'E2EE Aktif & Terlindungi')
                      : t('mnemonic.statusNotSetup', 'Belum Diatur')}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSetupModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>{isE2eeActive ? t('mnemonic.viewPhrase', 'Lihat Frasa') : t('mnemonic.setupPhrase', 'Atur Frasa')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="pt-2 border-t border-[var(--border)]/50 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={!isE2eeActive || isExportingEnc}
              onClick={handleExportEncrypted}
              className="flex-1 py-2.5 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isExportingEnc ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[var(--lock)]" />
              )}
              <span>{t('mnemonic.exportBackupBtn', 'Ekspor Cadangan Terenkripsi')}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRecoveryModalOpen(true)}
              className="py-2.5 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('mnemonic.restoreBackupBtn', 'Pulihkan dari Cadangan')}</span>
            </button>
          </div>

          {/* Cloud Backup Encryption Boundary Info */}
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] p-3 border border-[color-mix(in_srgb,var(--border)_50%,transparent)] text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[var(--fg)]">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <span>{t('mnemonic.cloudBoundaryTitle', 'Batas Keamanan Cadangan Cloud')}</span>
            </div>
            <p className="text-[var(--muted)] leading-relaxed text-[11px]">
              {isE2eeActive
                ? t('mnemonic.cloudBoundaryE2ee', 'Cadangan cloud otomatis dienkripsi End-to-End (E2EE) menggunakan amplop AES-256-GCM. Firebase Storage hanya menyimpan ciphertext yang mustahil dibaca tanpa 12 kata rahasia Anda.')
                : t('mnemonic.cloudBoundaryStandard', 'Cadangan cloud saat ini diamankan oleh enkripsi bawaan server Google Cloud / Firebase (in-transit TLS & at-rest). Aktifkan frasa 12-kata di atas untuk perlindungan Zero-Knowledge E2EE tanpa mempercayai server.')}
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* PASSKEYS SECTION */}
      <SettingsSection
        label={t('passkeys.sectionTitle', 'Kredensial Perangkat (Passkeys)')}
        footnote={t(
          'passkeys.sectionFootnote',
          'Passkeys menggunakan standar WebAuthn / FIDO2 untuk autentikasi nir-kata-sandi yang tahan phishing.',
        )}
      >
        <div className="ft-settings-cell flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-alt)]/10 text-[var(--accent-alt)] border border-[var(--accent-alt)]/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-extrabold text-[var(--fg)]">
                {t('passkeys.registeredTitle', 'Passkey Terdaftar')}
              </span>
              <span className="text-xs font-bold text-[var(--muted)]">
                {t('passkeys.countRegistered', '{{count}} kunci aktif di perangkat ini', { count: passkeysCount })}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPasskeysModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>{t('passkeys.manageBtn', 'Kelola')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </SettingsSection>

      {/* Modals */}
      {isPinModalOpen && (
        <PinPadModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onSave={handleSavePin}
          currentSecret={securityMethod === 'pin' ? lockSecret : ''}
        />
      )}

      {isPatternModalOpen && (
        <PatternLockModal
          isOpen={isPatternModalOpen}
          onClose={() => setIsPatternModalOpen(false)}
          onSave={handleSavePattern}
          currentSecret={securityMethod === 'pattern' ? lockSecret : ''}
        />
      )}

      {isSetupModalOpen && (
        <MnemonicSetupModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          onSuccess={() => {
            setIsE2eeActive(true)
          }}
        />
      )}

      {isRecoveryModalOpen && (
        <MnemonicRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          onRestoreComplete={() => {
            setStatusMessage(t('mnemonic.restoreSuccessBanner', 'Pemulihan data terenkripsi berhasil disinkronkan!'))
          }}
        />
      )}

      {isPasskeysModalOpen && (
        <PasskeysManagerModal
          isOpen={isPasskeysModalOpen}
          onClose={() => {
            setIsPasskeysModalOpen(false)
            setPasskeysCount(getStoredPasskeys().length)
          }}
        />
      )}
    </div>
  )
}
