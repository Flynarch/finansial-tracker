import { useState, useRef } from 'react'
import {
  FileKey,
  UploadCloud,
  AlertTriangle,
  Lock,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import { triggerHaptic } from '../../lib/haptics'
import { importAllDataFromJsonPayload } from '../../lib/backup'
import {
  decryptPayloadWithMnemonic,
  validateMnemonicPhrase,
  setSessionMnemonicPhrase,
} from '../../lib/mnemonicCrypto'
import useBackButton from '../../hooks/useBackButton'

export default function MnemonicRecoveryModal({
  isOpen,
  onClose,
  onRestoreComplete,
  initialEnvelope = null,
  source = 'file',
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(initialEnvelope ? 'phrase' : 'upload') // 'upload' | 'phrase' | 'preview'
  const [file, setFile] = useState(null)
  const [rawEnvelope, setRawEnvelope] = useState(initialEnvelope)
  const [phraseInput, setPhraseInput] = useState('')
  const [phraseError, setPhraseError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [decryptedData, setDecryptedData] = useState(null)

  useBackButton(() => {
    if (step === 'preview') {
      setStep('phrase')
      setDecryptedData(null)
    } else if (step === 'phrase' && !initialEnvelope) {
      setStep('upload')
      setFile(null)
      setRawEnvelope(null)
      setPhraseError('')
    }
  }, isOpen && (step === 'preview' || (step === 'phrase' && !initialEnvelope)))

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const [prevInitialEnvelope, setPrevInitialEnvelope] = useState(initialEnvelope)

  if (prevIsOpen !== isOpen || prevInitialEnvelope !== initialEnvelope) {
    setPrevIsOpen(isOpen)
    setPrevInitialEnvelope(initialEnvelope)
    if (isOpen) {
      if (initialEnvelope && initialEnvelope.format === 'fintrack_encrypted_envelope') {
        setRawEnvelope(initialEnvelope)
        setStep('phrase')
        setPhraseError('')
        setFile(null)
        setPhraseInput('')
        setDecryptedData(null)
      } else {
        setStep('upload')
        setFile(null)
        setRawEnvelope(null)
        setPhraseInput('')
        setPhraseError('')
        setDecryptedData(null)
      }
    }
  }

  const handleReset = () => {
    setStep(initialEnvelope ? 'phrase' : 'upload')
    setFile(null)
    setRawEnvelope(initialEnvelope || null)
    setPhraseInput('')
    setPhraseError('')
    setDecryptedData(null)
  }

  const handleFileSelected = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    triggerHaptic('selection')

    try {
      const text = await selectedFile.text()
      const envelope = JSON.parse(text)
      if (envelope.format !== 'fintrack_encrypted_envelope') {
        setPhraseError(t('mnemonic.invalidFileFormat', 'Berkas bukan format cadangan FinTrack terenkripsi (.fintrack.enc) yang valid.'))
        return
      }
      setRawEnvelope(envelope)
      setStep('phrase')
    } catch (err){
      console.warn('[MnemonicRecoveryModal]', err)
      setPhraseError(t('mnemonic.fileReadError', 'Gagal membaca berkas cadangan.'))
    }
  }

  const handleDecrypt = async () => {
    triggerHaptic('light')
    setPhraseError('')
    setIsProcessing(true)

    try {
      const cleanPhrase = phraseInput.trim().toLowerCase()
      const isValid = await validateMnemonicPhrase(cleanPhrase)
      if (!isValid) {
        setPhraseError(t('mnemonic.invalidPhraseWords', 'Frasa pemulihan tidak valid (harus 12 kata baku BIP-39).'))
        setIsProcessing(false)
        return
      }

      const payload = await decryptPayloadWithMnemonic(rawEnvelope, cleanPhrase)
      setDecryptedData(payload)
      setStep('preview')
    } catch (err) {
      console.error('Decryption error:', err)
      setPhraseError(t('mnemonic.decryptFailed', 'Gagal mendekripsi berkas: Frasa pemulihan salah atau berkas rusak.'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmRestore = async () => {
    if (!decryptedData) return
    triggerHaptic('success')
    setIsProcessing(true)

    try {
      await importAllDataFromJsonPayload(decryptedData)
      const cleanPhrase = phraseInput.trim().toLowerCase()
      setSessionMnemonicPhrase(cleanPhrase)
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('fintrack_e2ee_active', 'true')
          window.localStorage.removeItem('fintrack_e2ee_phrase')
        }
      } catch (err){
      console.warn('[MnemonicRecoveryModal]', err)
        // ignore
      }

      if (onRestoreComplete) onRestoreComplete()
      handleReset()
      onClose()
    } catch (err) {
      console.error('Restore error:', err)
      setPhraseError(t('mnemonic.restoreFailed', 'Gagal memulihkan data: Format berkas cadangan tidak sesuai.'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        source === 'cloud'
          ? t('mnemonic.cloudRecoveryTitle', 'Pulihkan Cadangan Cloud Terenkripsi')
          : t('mnemonic.recoveryModalTitle', 'Pulihkan Data Terenkripsi (.fintrack.enc)')
      }
      maxWidth="max-w-md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".enc,.json,.fintrack.enc"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* STEP 1: UPLOAD ENCRYPTED BACKUP FILE */}
        {step === 'upload' && (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--field-bg)]/60 hover:bg-[var(--field-bg)] transition cursor-pointer active:scale-[0.99] text-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-[var(--panel-strong)] flex items-center justify-center shadow-xs mb-3 text-[var(--accent)]">
                <UploadCloud className="h-7 w-7" />
              </div>
              <h4 className="text-sm font-black text-[var(--fg)] mb-1">
                {t('mnemonic.selectEncryptedFile', 'Pilih Berkas Cadangan Terenkripsi')}
              </h4>
              <p className="text-xs text-[var(--muted)] max-w-sm">
                {t('mnemonic.selectEncryptedDesc', 'Pilih file cadangan dengan ekstensi .fintrack.enc yang telah Anda buat sebelumnya.')}
              </p>
            </div>

            {phraseError && (
              <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{phraseError}</span>
              </p>
            )}
          </div>
        )}

        {/* STEP 2: INPUT 12-WORD PHRASE */}
        {step === 'phrase' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {source === 'cloud'
                  ? t('mnemonic.cloudBackupReady', 'Cadangan Cloud Terenkripsi')
                  : t('mnemonic.fileReady', 'Berkas Cadangan')}
              </span>
              <h4 className="text-xs font-bold text-[var(--fg)] truncate">
                {source === 'cloud'
                  ? t('mnemonic.cloudEnvelopeReady', 'Cadangan Cloud Akun (Zero-Knowledge E2EE)')
                  : file?.name}
              </h4>
              {source === 'cloud' ? (
                <p className="text-[11px] text-[var(--muted)] leading-relaxed pt-1">
                  {t(
                    'mnemonic.cloudPhraseNotice',
                    'Data akun Anda di cloud diamankan dengan enkripsi Zero-Knowledge. Masukkan 12 kata pemulihan Anda untuk memulihkan transaksi dan saldo ke perangkat ini.',
                  )}
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--fg)] mb-1.5">
                {t('mnemonic.enter12Words', 'Masukkan 12-Word Recovery Phrase')}
              </label>
              <textarea
                rows={3}
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                placeholder={t('mnemonic.phrasePlaceholder', 'Contoh: abandon ability able about above absent absorb abstract absurd abuse access account')}
                className="ft-field w-full text-xs font-mono py-2.5 px-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] leading-relaxed"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {phraseError && (
                <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{phraseError}</span>
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]/60">
              <button
                type="button"
                onClick={handleReset}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('common.cancel', 'Batal')}
              </button>
              <button
                type="button"
                onClick={handleDecrypt}
                disabled={!phraseInput || isProcessing}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                <span>{t('mnemonic.decryptAction', 'Dekripsi Data')}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & RESTORE */}
        {step === 'preview' && decryptedData && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-1">
                <FileKey className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-[var(--fg)]">
                {t('mnemonic.decryptedSuccess', 'Data Berhasil Didekripsi')}
              </h4>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t('mnemonic.readyToRestore', 'Data keuangan siap dipulihkan ke basis data FinTrack.')}
              </p>
            </div>

            {/* Entity Summary Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)]">Transaksi</span>
                <p className="text-sm font-extrabold text-[var(--fg)] mt-0.5">
                  {(decryptedData.data?.transactions || decryptedData.transactions)?.length || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)]">Dompet / Akun</span>
                <p className="text-sm font-extrabold text-[var(--fg)] mt-0.5">
                  {(decryptedData.data?.wallets || decryptedData.wallets)?.length || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)]">Anggaran & Rencana</span>
                <p className="text-sm font-extrabold text-[var(--fg)] mt-0.5">
                  {(decryptedData.data?.budgets || decryptedData.budgets)?.length || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--muted)]">Target & Pinjaman</span>
                <p className="text-sm font-extrabold text-[var(--fg)] mt-0.5">
                  {((decryptedData.data?.goals || decryptedData.goals)?.length || 0) +
                    ((decryptedData.data?.loans || decryptedData.loans)?.length || 0)}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]/60">
              <button
                type="button"
                onClick={handleReset}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('common.cancel', 'Batal')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isProcessing}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                <span>{t('mnemonic.restoreAction', 'Terapkan Pemulihan Data')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
