import { useState, useCallback } from 'react'
import Modal from '../ui/Modal'
import { Delete, KeyRound, CheckCircle2, AlertCircle, Fingerprint } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import { verifyPin } from '../../lib/crypto'

export default function PinPadModal({
  isOpen,
  onClose,
  onSave,
  onVerifySuccess,
  mode = 'setup',
  currentSecret = '',
  initialBiometric = false,
}) {
  const { t } = useTranslation()
  const isVerifyOnly = mode === 'verify'
  const [step, setStep] = useState(isVerifyOnly ? 0 : (currentSecret ? 0 : 1)) // 0: verify current pin, 1: enter new pin, 2: confirm pin
  const [currentPin, setCurrentPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [useBiometrics, setUseBiometrics] = useState(initialBiometric)

  useBackButton(() => {
    if (step === 2) {
      setStep(1)
      setConfirmPin('')
      setErrorMsg('')
    } else if (step === 1 && currentSecret && !isVerifyOnly) {
      setStep(0)
      setFirstPin('')
      setErrorMsg('')
    }
  }, isOpen && (step === 2 || (step === 1 && Boolean(currentSecret) && !isVerifyOnly)))

  const activePin = step === 0 ? currentPin : (step === 1 ? firstPin : confirmPin)

  const handleClose = useCallback(() => {
    setStep(isVerifyOnly ? 0 : (currentSecret ? 0 : 1))
    setCurrentPin('')
    setFirstPin('')
    setConfirmPin('')
    setErrorMsg('')
    setIsSuccess(false)
    setUseBiometrics(initialBiometric)
    onClose()
  }, [onClose, initialBiometric, currentSecret, isVerifyOnly])

  const handleDigit = useCallback(
    (digit) => {
      triggerHaptic('light')
      setErrorMsg('')
      if (step === 0) {
        if (currentPin.length < 4) {
          const next = currentPin + digit
          setCurrentPin(next)
          if (next.length === 4) {
            setTimeout(async () => {
              const isMatch = await verifyPin(next, currentSecret)
              if (isMatch) {
                triggerHaptic('success')
                if (isVerifyOnly) {
                  setIsSuccess(true)
                  setTimeout(() => {
                    onVerifySuccess?.()
                    handleClose()
                  }, 400)
                  return
                }
                setStep(1)
                setCurrentPin('')
                setErrorMsg('')
              } else {
                triggerHaptic('warning')
                setErrorMsg(t('settings.incorrectCurrentPin', 'PIN saat ini salah. Silakan coba lagi.'))
                setCurrentPin('')
              }
            }, 180)
          }
        }
      } else if (step === 1) {
        if (firstPin.length < 4) {
          const next = firstPin + digit
          setFirstPin(next)
          if (next.length === 4) {
            setTimeout(() => {
              setStep(2)
            }, 180)
          }
        }
      } else {
        if (confirmPin.length < 4) {
          const next = confirmPin + digit
          setConfirmPin(next)
          if (next.length === 4) {
            if (next === firstPin) {
              triggerHaptic('success')
              setIsSuccess(true)
              setTimeout(() => {
                onSave(next, useBiometrics)
                handleClose()
              }, 400)
            } else {
              triggerHaptic('warning')
              setErrorMsg(t('settings.pinMismatch', 'PIN tidak cocok. Silakan ulangi.'))
              setConfirmPin('')
              setTimeout(() => {
                setStep(1)
                setFirstPin('')
                setErrorMsg('')
              }, 1200)
            }
          }
        }
      }
    },
    [step, currentPin, firstPin, confirmPin, currentSecret, onSave, handleClose, t, useBiometrics, isVerifyOnly, onVerifySuccess],
  )

  const handleDelete = useCallback(() => {
    triggerHaptic('selection')
    setErrorMsg('')
    if (step === 0) {
      setCurrentPin((p) => p.slice(0, -1))
    } else if (step === 1) {
      setFirstPin((p) => p.slice(0, -1))
    } else {
      setConfirmPin((p) => p.slice(0, -1))
    }
  }, [step])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isVerifyOnly ? t('settings.verifyPin', 'Verifikasi PIN') : (currentSecret ? t('settings.changePin', 'Ubah PIN Aplikasi') : t('settings.setPin', 'Atur PIN Aplikasi'))}
      maxWidth="max-w-xs"
    >
      <div className="flex flex-col items-center text-center py-2 space-y-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
          <KeyRound className="h-6 w-6" />
        </div>

        <div>
          <h3 className="text-sm font-black text-[var(--fg)]">
            {isVerifyOnly
              ? t('settings.verifyPinToProceed', 'Masukkan PIN Anda saat ini')
              : step === 0
              ? t('settings.enterCurrentPin', 'Masukkan PIN Saat Ini')
              : step === 1
              ? t('settings.enterNewPin', 'Masukkan 4 Digit PIN Baru')
              : t('settings.confirmNewPin', 'Konfirmasi 4 Digit PIN')}
          </h3>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            {isVerifyOnly
              ? t('settings.verifyPinDesc', 'Konfirmasi identitas Anda untuk melanjutkan')
              : step === 0
              ? t('settings.verifyCurrentPinDesc', 'Verifikasi PIN lama Anda sebelum membuat yang baru')
              : step === 1
              ? t('settings.pinStep1Desc', 'PIN ini digunakan untuk membuka aplikasi')
              : t('settings.pinStep2Desc', 'Ketik ulang PIN yang sama untuk verifikasi')}
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex items-center gap-3.5 my-2">
          {[0, 1, 2, 3].map((i) => {
            const isFilled = activePin.length > i
            return (
              <div
                key={i}
                className={`h-3.5 w-3.5 rounded-full border transition-all duration-150 ${
                  isFilled
                    ? 'bg-[var(--accent)] border-[var(--accent)] scale-110 shadow-xs'
                    : 'border-[var(--border-strong)] bg-[var(--field-bg)]'
                }`}
              />
            )
          })}
        </div>

        {errorMsg ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : isSuccess ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{t('common.verified', 'Verifikasi Berhasil!')}</span>
          </div>
        ) : (
          <div className="h-4" />
        )}

        {/* Biometric Toggle Option */}
        {!isVerifyOnly && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setUseBiometrics((prev) => !prev)
            }}
            className="flex items-center justify-between w-full max-w-[240px] px-3.5 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs cursor-pointer hover:bg-[var(--panel)] transition active:scale-98"
          >
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-[var(--lock)]" />
              <span className="text-[11px] font-bold text-[var(--fg)]">
                {t('settings.biometricQuickOption', 'Buka juga via Biometrik')}
              </span>
            </div>
            <div
              className={`w-7 h-4 rounded-full transition-colors relative p-0.5 ${
                useBiometrics ? 'bg-[var(--lock)]' : 'bg-[var(--border-strong)]'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  useBiometrics ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        )}

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px] pt-1">
          {digits.map((item, idx) => {
            if (item === '') {
              return <div key={idx} className="h-13 w-13" />
            }
            if (item === 'del') {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={handleDelete}
                  disabled={activePin.length === 0}
                  className="h-13 w-13 rounded-2xl flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer disabled:opacity-30 disabled:pointer-events-none mx-auto"
                  aria-label={t('common.delete', 'Hapus')}
                >
                  <Delete className="h-5 w-5" />
                </button>
              )
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDigit(item)}
                className="h-13 w-13 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 text-[var(--fg)] text-lg font-black transition-all hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-90 active:bg-[var(--accent)]/20 active:text-[var(--accent)] cursor-pointer shadow-2xs mx-auto flex items-center justify-center"
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
