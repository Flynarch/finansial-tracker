import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  Lock,
  Delete,
  Fingerprint,
  RotateCcw,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react'
import { authenticateBiometric, canUseBiometric } from '../../lib/biometric'
import PatternPad from './PatternPad'
import Modal from './Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

function LockScreen({ method, secret, onUnlock }) {
  const { t } = useTranslation()
  const setSecurity = useSettingsStore((state) => state.setSecurity)

  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [isShaking, setIsShaking] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)

  const methodLabel = useMemo(() => {
    if (method === 'pattern') return 'Pola'
    if (method === 'biometric') return 'Biometrik'
    return 'PIN'
  }, [method])

  const expectedLength = secret?.length || 4

  const triggerError = useCallback((msg) => {
    setError(msg)
    setIsShaking(true)
    setInput('')
    setTimeout(() => setIsShaking(false), 500)
  }, [])

  const handleKeyPress = useCallback(
    (num) => {
      if (input.length >= 6) return
      const nextInput = input + String(num)
      setInput(nextInput)
      setError('')

      // Auto-verify if reached secret length
      if (nextInput.length === expectedLength) {
        if (nextInput === secret) {
          setTimeout(() => onUnlock(), 80)
        } else {
          setTimeout(() => {
            triggerError(t('lock.incorrectPin', 'PIN salah, coba lagi.'))
          }, 150)
        }
      }
    },
    [input, expectedLength, secret, onUnlock, t, triggerError],
  )

  const handleDelete = useCallback(() => {
    setInput((prev) => prev.slice(0, -1))
    setError('')
  }, [])

  // Desktop physical keyboard support
  useEffect(() => {
    if (method !== 'pin') return undefined

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleKeyPress(Number(e.key))
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
      } else if (e.key === 'Escape') {
        setInput('')
        setError('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [method, handleKeyPress, handleDelete])

  const handleBiometricUnlock = useCallback(async () => {
    setIsAuthenticating(true)
    setError('')
    const available = await canUseBiometric()
    if (!available) {
      setError(t('lock.biometricUnavailable', 'Biometrik tidak tersedia di perangkat ini.'))
      setIsAuthenticating(false)
      return
    }
    const success = await authenticateBiometric()
    setIsAuthenticating(false)
    if (success) {
      onUnlock()
      return
    }
    triggerError(t('lock.biometricFailed', 'Autentikasi biometrik gagal.'))
  }, [onUnlock, t, triggerError])

  // Auto trigger biometric on mount if biometric method
  useEffect(() => {
    if (method !== 'biometric') return undefined
    const timer = setTimeout(() => {
      handleBiometricUnlock()
    }, 150)
    return () => clearTimeout(timer)
  }, [method, handleBiometricUnlock])

  const handlePatternComplete = (pattern) => {
    if (pattern === secret) {
      onUnlock()
    } else {
      triggerError(t('lock.incorrectPin', 'Pola salah, silakan coba lagi.'))
    }
  }

  const handleResetLock = async () => {
    await setSecurity({
      securityEnabled: false,
      securityMethod: 'pin',
      lockSecret: '',
    })
    setIsForgotModalOpen(false)
    onUnlock()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg)]/95 px-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Lock Icon */}
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] mb-3.5 shadow-card">
          <Lock className="h-5 w-5" />
        </div>

        <h2 className="text-base font-black tracking-tight text-[var(--fg)]">
          FinTrack Terkunci
        </h2>
        <p className="mt-1 text-xs font-medium text-[var(--muted)]">
          Masukkan {methodLabel} untuk membuka aplikasi
        </p>

        {/* PIN METHOD: Native-style PIN Dots & Numpad */}
        {method === 'pin' ? (
          <div className="mt-5 w-full flex flex-col items-center">
            {/* PIN Dots Indicator */}
            <div
              className={`flex items-center gap-3 mb-5 transition-transform ${
                isShaking ? 'animate-shake' : ''
              }`}
            >
              {Array.from({ length: expectedLength }).map((_, idx) => {
                const isFilled = idx < input.length
                return (
                  <div
                    key={idx}
                    className={`h-3 w-3 rounded-full transition-all duration-150 border ${
                      isFilled
                        ? 'bg-[var(--fg)] border-[var(--fg)] scale-110'
                        : 'bg-transparent border-[var(--muted)]/50'
                    }`}
                  />
                )
              })}
            </div>

            {/* Error Message */}
            {error ? (
              <p className="mb-3 flex items-center gap-1 text-xs font-bold text-rose-500 animate-fadeIn">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error}</span>
              </p>
            ) : (
              <div className="h-4 mb-3" />
            )}

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="grid h-13 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-lg font-black text-[var(--fg)] shadow-2xs transition active:scale-90 active:bg-[var(--panel-strong)] cursor-pointer select-none"
                >
                  {num}
                </button>
              ))}

              {/* Reset/Forgot on bottom-left */}
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="grid h-13 place-items-center rounded-2xl text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-90 cursor-pointer"
                title={t('lock.forgotTitle', 'Lupa PIN')}
              >
                {t('lock.forgotShort', 'Lupa?')}
              </button>

              {/* Zero */}
              <button
                type="button"
                onClick={() => handleKeyPress(0)}
                className="grid h-13 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-lg font-black text-[var(--fg)] shadow-2xs transition active:scale-90 active:bg-[var(--panel-strong)] cursor-pointer select-none"
              >
                0
              </button>

              {/* Delete on bottom-right */}
              <button
                type="button"
                onClick={handleDelete}
                className="grid h-13 place-items-center rounded-2xl border border-transparent text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-90 cursor-pointer"
                title={t('lock.delete', 'Hapus')}
                aria-label={t('lock.deleteDigit', 'Hapus Digit')}
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : method === 'pattern' ? (
          /* PATTERN METHOD */
          <div className="mt-5 w-full flex flex-col items-center">
            <PatternPad
              value={input}
              onChange={setInput}
              onComplete={handlePatternComplete}
              error={Boolean(error)}
            />

            {error ? (
              <p className="mt-2 text-xs font-bold text-rose-500 animate-fadeIn">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={() => setIsForgotModalOpen(true)}
              className="mt-4 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              {t('lock.forgotPattern', 'Lupa Pola? Reset Kunci')}
            </button>
          </div>
        ) : (
          /* BIOMETRIC METHOD */
          <div className="mt-5 w-full flex flex-col items-center">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--fg)] py-3 px-4 text-xs font-black text-[var(--bg)] shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Fingerprint className="h-4 w-4" />
              <span>
                {isAuthenticating
                  ? t('lock.biometricVerifying', 'Memverifikasi...')
                  : t('lock.biometricButton', 'Buka dengan Biometrik')}
              </span>
            </button>

            {error ? (
              <p className="mt-3 text-xs font-bold text-rose-500 animate-fadeIn">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={() => setIsForgotModalOpen(true)}
              className="mt-4 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
            >
              {t('lock.resetLock', 'Reset Kunci')}
            </button>
          </div>
        )}
      </div>

      {/* Forgot PIN / Reset Lock Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        title={t('lock.resetModalTitle', 'Lupa PIN / Reset Kunci')}
        onClose={() => setIsForgotModalOpen(false)}
      >
        <div className="space-y-3.5 text-left">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[var(--fg)]">Matikan Proteksi Kunci</h4>
              <p className="text-[11px] font-medium text-[var(--muted)] leading-relaxed mt-0.5">
                Data keuangan, transaksi, akun dompet, dan anggaran Anda <strong>tetap aman dan tidak akan hilang</strong>. Hanya proteksi kunci yang akan dinonaktifkan.
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
              <span>Matikan Kunci & Masuk</span>
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
