import { useState, useCallback } from 'react'
import Modal from '../ui/Modal'
import { Delete, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'
import useTranslation from '../../hooks/useTranslation'

export default function PinPadModal({ isOpen, onClose, onSave, currentSecret = '' }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1) // 1: enter new pin, 2: confirm pin
  const [firstPin, setFirstPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const activePin = step === 1 ? firstPin : confirmPin

  const handleClose = useCallback(() => {
    setStep(1)
    setFirstPin('')
    setConfirmPin('')
    setErrorMsg('')
    setIsSuccess(false)
    onClose()
  }, [onClose])

  const handleDigit = useCallback(
    (digit) => {
      triggerHaptic('light')
      setErrorMsg('')
      if (step === 1) {
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
                onSave(next)
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
    [step, firstPin, confirmPin, onSave, handleClose, t],
  )

  const handleDelete = useCallback(() => {
    triggerHaptic('selection')
    setErrorMsg('')
    if (step === 1) {
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
      title={currentSecret ? t('settings.changePin', 'Ubah PIN Aplikasi') : t('settings.setPin', 'Atur PIN Aplikasi')}
      maxWidth="max-w-xs"
    >
      <div className="flex flex-col items-center text-center py-2 space-y-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-2xs">
          <KeyRound className="h-6 w-6" />
        </div>

        <div>
          <h3 className="text-sm font-black text-[var(--fg)]">
            {step === 1
              ? t('settings.enterNewPin', 'Masukkan 4 Digit PIN Baru')
              : t('settings.confirmNewPin', 'Konfirmasi 4 Digit PIN')}
          </h3>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            {step === 1
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
                    ? 'bg-indigo-500 border-indigo-500 scale-110 shadow-xs'
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
            <span>{t('common.saved', 'PIN Berhasil Disimpan!')}</span>
          </div>
        ) : (
          <div className="h-4" />
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
                className="h-13 w-13 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 text-[var(--fg)] text-lg font-black transition-all hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-90 active:bg-indigo-500/20 active:text-indigo-500 cursor-pointer shadow-2xs mx-auto flex items-center justify-center"
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
