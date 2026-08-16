import { useState, useEffect, useCallback } from 'react'
import {
  Fingerprint,
  RotateCcw,
  AlertCircle,
  ShieldAlert,
  Smartphone,
} from 'lucide-react'
import { authenticateBiometric, canUseBiometric } from '../../lib/biometric'
import Modal from './Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

function LockScreen({ onUnlock }) {
  const { t } = useTranslation()
  const setSecurity = useSettingsStore((state) => state.setSecurity)

  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)

  const handleBiometricUnlock = useCallback(async () => {
    setIsAuthenticating(true)
    setError('')
    const success = await authenticateBiometric()
    setIsAuthenticating(false)
    if (success) {
      onUnlock()
      return
    }
    setError(t('lock.biometricFailed', 'Verifikasi sidik jari / sandi HP dibatalkan atau gagal.'))
  }, [onUnlock, t])

  // Automatically prompt native biometric/device passcode on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleBiometricUnlock()
    }, 200)
    return () => clearTimeout(timer)
  }, [handleBiometricUnlock])

  const handleResetLock = async () => {
    await setSecurity({
      securityEnabled: false,
      securityMethod: 'biometric',
      lockSecret: '',
    })
    setIsForgotModalOpen(false)
    onUnlock()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg)]/95 px-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Fingerprint / Phone Icon */}
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] mb-4 shadow-card">
          <Fingerprint className="h-8 w-8" />
        </div>

        <h2 className="text-base font-black tracking-tight text-[var(--fg)]">
          FinTrack Terkunci
        </h2>
        <p className="mt-1 text-xs font-medium text-[var(--muted)]">
          Verifikasi sidik jari, Face ID, atau sandi HP untuk membuka
        </p>

        {/* Error Alert */}
        {error ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-rose-500 animate-fadeIn">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : (
          <div className="h-4 mt-3" />
        )}

        {/* Primary Action Button */}
        <div className="mt-5 w-full space-y-2.5">
          <button
            type="button"
            onClick={handleBiometricUnlock}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--fg)] py-3 px-4 text-xs font-extrabold text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            <Smartphone className="h-4 w-4" />
            <span>
              {isAuthenticating
                ? t('lock.biometricVerifying', 'Menunggu Verifikasi HP...')
                : 'Buka dengan Sidik Jari / Sandi HP'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsForgotModalOpen(true)}
            className="w-full text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition py-1 cursor-pointer"
          >
            {t('lock.resetLock', 'Matikan Kunci Aplikasi')}
          </button>
        </div>
      </div>

      {/* Recovery Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        title={t('lock.resetLock', 'Matikan Kunci Aplikasi')}
        onClose={() => setIsForgotModalOpen(false)}
      >
        <div className="space-y-3.5 text-left">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[var(--fg)]">Buka Tanpa Sidik Jari</h4>
              <p className="text-[11px] font-medium text-[var(--muted)] leading-relaxed mt-0.5">
                Data transaksi, akun dompet, dan anggaran Anda <strong>tetap aman dan tidak akan hilang</strong>. Proteksi kunci aplikasi akan dinonaktifkan sehingga Anda bisa langsung masuk.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetLock}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[var(--fg)] py-2.5 px-3 text-xs font-bold text-[var(--bg)] shadow-xs transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Matikan & Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-3.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default LockScreen
