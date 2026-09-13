import { useState, useEffect } from 'react'
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import {
  generateMnemonicPhrase,
  generate3WordChallenge,
} from '../../lib/mnemonicCrypto'

export default function MnemonicSetupModal({ isOpen, onClose, onSuccess }) {
  const { t } = useTranslation()
  const setE2eeEnabled = useSettingsStore((s) => s.setE2eeEnabled || (() => {}))
  const setHasMnemonicBackup = useSettingsStore((s) => s.setHasMnemonicBackup || (() => {}))

  // Wizard Step: 'generate' | 'challenge' | 'success'
  const [step, setStep] = useState('generate')
  const [phrase, setPhrase] = useState('')
  const [words, setWords] = useState([])
  const [isRevealed, setIsRevealed] = useState(true)
  const [copied, setCopied] = useState(false)

  // 3-Word Challenge state
  const [challenge, setChallenge] = useState([])
  const [userInputs, setUserInputs] = useState({ 0: '', 1: '', 2: '' })
  const [challengeError, setChallengeError] = useState('')

  const handleRegenerate = async () => {
    triggerHaptic('light')
    const newPhrase = await generateMnemonicPhrase()
    setPhrase(newPhrase)
    setWords(newPhrase.split(' '))
    setIsRevealed(true)
    setCopied(false)
  }

  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      const initPhrase = async () => {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('fintrack_e2ee_phrase') : null
        const targetPhrase =
          saved && saved.trim().split(' ').length === 12
            ? saved.trim()
            : await generateMnemonicPhrase()

        if (!isMounted) return
        setStep('generate')
        setIsRevealed(true)
        setCopied(false)
        setChallengeError('')
        setUserInputs({ 0: '', 1: '', 2: '' })
        setPhrase(targetPhrase)
        setWords(targetPhrase.split(' '))
      }
      initPhrase()
    }
    return () => {
      isMounted = false
    }
  }, [isOpen])

  const handleCopyPhrase = () => {
    triggerHaptic('light')
    navigator.clipboard.writeText(phrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProceedToChallenge = () => {
    triggerHaptic('selection')
    const ch = generate3WordChallenge(phrase)
    setChallenge(ch)
    setStep('challenge')
  }

  const handleVerifyChallenge = async () => {
    triggerHaptic('light')
    setChallengeError('')

    let isMatch = true
    challenge.forEach((ch, idx) => {
      const input = (userInputs[idx] || '').trim().toLowerCase()
      if (input !== ch.expectedWord.toLowerCase()) {
        isMatch = false
      }
    })

    if (!isMatch) {
      triggerHaptic('warning')
      setChallengeError(
        t('mnemonic.challengeMismatch', 'Kata yang Anda masukkan tidak sesuai dengan frasa pemulihan.')
      )
      return
    }

    triggerHaptic('success')
    try {
      if (typeof setE2eeEnabled === 'function') await setE2eeEnabled(true)
      if (typeof setHasMnemonicBackup === 'function') await setHasMnemonicBackup(true)
      localStorage.setItem('fintrack_e2ee_phrase', phrase)
      localStorage.setItem('fintrack_e2ee_active', 'true')
    } catch (err) {
      console.error('Error enabling E2EE:', err)
    }

    setStep('success')
    if (onSuccess) onSuccess()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('mnemonic.setupTitle', '12-Word Recovery Phrase (E2EE)')}
      maxWidth="max-w-md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* STEP 1: GENERATE & DISPLAY 12 WORDS */}
        {step === 'generate' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-1">
                <KeyRound className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-[var(--fg)]">
                {t('mnemonic.phraseHeader', 'Frasa Pemulihan Rahasia')}
              </h4>
              <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xs mx-auto">
                {t(
                  'mnemonic.phraseDesc',
                  'Tuliskan 12 kata ini secara berurutan pada kertas. Ini adalah satu-satunya kunci untuk mendekripsi data finansial Anda.'
                )}
              </p>
            </div>

            {/* 12-Word Grid */}
            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 overflow-hidden">
              <div
                className={`grid grid-cols-3 gap-2 transition duration-200 ${
                  !isRevealed ? 'blur-sm select-none' : ''
                }`}
              >
                {words.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[var(--panel-strong)] border border-[var(--border)]"
                  >
                    <span className="text-[10px] font-mono font-bold text-[var(--muted)] w-4">
                      {idx + 1}.
                    </span>
                    <span className="text-xs font-bold text-[var(--fg)] font-mono truncate">
                      {w}
                    </span>
                  </div>
                ))}
              </div>

              {!isRevealed && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--field-bg)]/40 backdrop-blur-xs">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light')
                      setIsRevealed(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    <span>{t('mnemonic.revealWords', 'Ketuk untuk Melihat 12 Kata')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Controls: Reveal toggle & Copy */}
            {isRevealed && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsRevealed(false)}
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] flex items-center gap-1.5 hover:text-[var(--fg)] cursor-pointer"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>{t('mnemonic.hide', 'Sembunyikan')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] flex items-center gap-1.5 hover:text-[var(--fg)] cursor-pointer"
                  >
                    <span>{t('mnemonic.regenerate', 'Acak Ulang')}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPhrase}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? t('common.copied', 'Tersalin!') : t('mnemonic.copyWords', 'Salin Kata')}</span>
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex gap-2 pt-2 border-t border-[var(--border)]/60">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('common.cancel', 'Batal')}
              </button>
              <button
                type="button"
                onClick={handleProceedToChallenge}
                disabled={!isRevealed}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
              >
                <span>{t('mnemonic.savedProceed', 'Saya Sudah Mencatatnya')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 3-WORD VERIFICATION CHALLENGE */}
        {step === 'challenge' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-1">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-[var(--fg)]">
                {t('mnemonic.challengeTitle', 'Uji Verifikasi Frasa Pemulihan')}
              </h4>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t(
                  'mnemonic.challengeDesc',
                  'Untuk memastikan Anda telah mencatatnya, masukkan 3 kata yang diminta di bawah ini.'
                )}
              </p>
            </div>

            {/* 3 Challenge Input Fields */}
            <div className="space-y-3">
              {challenge.map((ch, idx) => (
                <div key={idx} className="space-y-1">
                  <label className="block text-xs font-bold text-[var(--fg)]">
                    {t('mnemonic.wordNumber', 'Kata ke-{{number}} (#{{number}})', { number: ch.position })}
                  </label>
                  <input
                    type="text"
                    value={userInputs[idx] || ''}
                    onChange={(e) =>
                      setUserInputs({ ...userInputs, [idx]: e.target.value })
                    }
                    placeholder={t('mnemonic.inputWordPlaceholder', 'Ketik kata ke-{{number}}', { number: ch.position })}
                    className="ft-field w-full text-xs font-mono font-bold py-2.5 px-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              ))}
            </div>

            {challengeError && (
              <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{challengeError}</span>
              </p>
            )}

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]/60">
              <button
                type="button"
                onClick={() => setStep('generate')}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('common.back', 'Kembali')}
              </button>
              <button
                type="button"
                onClick={handleVerifyChallenge}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Lock className="h-4 w-4" />
                <span>{t('mnemonic.verifyAndActivate', 'Verifikasi & Aktifkan E2EE')}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <div className="space-y-4 text-center py-4 animate-fadeIn">
            <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-base font-black text-[var(--fg)]">
              {t('mnemonic.successTitle', 'Zero-Knowledge E2EE Berhasil Diaktifkan')}
            </h4>
            <p className="text-xs text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
              {t(
                'mnemonic.successDesc',
                'Data keuangan Anda kini dilindungi dengan enkripsi tingkat bank AES-256-GCM. Pastikan frasa pemulihan tersimpan aman.'
              )}
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center"
              >
                {t('common.done', 'Selesai')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
