import { useState, useEffect, useCallback } from 'react'
import {
  Fingerprint,
  AlertCircle,
  Smartphone,
} from 'lucide-react'
import { authenticateBiometric } from '../../lib/biometric'
import useTranslation from '../../hooks/useTranslation'

function LockScreen({ onUnlock }) {
  const { t } = useTranslation()

  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg)]/95 px-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Fingerprint / Security Icon */}
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] mb-4 shadow-card">
          <Fingerprint className="h-8 w-8" />
        </div>

        <h2 className="text-base font-black tracking-tight text-[var(--fg)]">
          {t('lock.title', 'FinTrack Terkunci')}
        </h2>
        <p className="mt-1 text-xs font-medium text-[var(--muted)]">
          {t('lock.desc', 'Verifikasi sidik jari, Face ID, atau sandi HP untuk membuka')}
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
        <div className="mt-5 w-full">
          <button
            type="button"
            onClick={handleBiometricUnlock}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--fg)] py-3.5 px-4 text-xs font-extrabold text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            <Smartphone className="h-4 w-4" />
            <span>
              {isAuthenticating
                ? t('lock.biometricVerifying', 'Menunggu Verifikasi HP...')
                : t('lock.unlockBtn', 'Buka dengan Sidik Jari / Sandi HP')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default LockScreen
