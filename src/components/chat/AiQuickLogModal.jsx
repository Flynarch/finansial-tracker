import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Mic, MicOff, Image as ImageIcon, Camera, Send, ArrowUpRight, Loader2, Wallet, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { parseTransactionFromText } from '../../lib/gemini'
import { sanitizeCategoryPath } from '../../lib/categorySanitizer'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import useChatStore from '../../store/useChatStore'
import AiDigitalReceipt from './AiDigitalReceipt'
import AiIntentSwitchDialog from './AiIntentSwitchDialog'

function generateSampleChips(userWallets = []) {
  const walletNames = (userWallets || []).map((w) => w.name).filter(Boolean)

  const baseTitles = [
    'Makan siang 35rb',
    'Gaji 5jt',
    'Beli kopi 25rb',
    'Uang saku 50rb',
    'Bensin 30rb',
    'Belanja bulanan 250rb',
    'Token listrik 100rb',
    'Nongkrong 45rb',
    'Dapat cashback 15rb',
    'Beli pulsa 50rb',
    'Bayar WiFi 300rb',
    'Makan malam 60rb',
    'Beli snack 20rb',
    'Bayar langganan 186rb',
  ]

  if (walletNames.length === 0) {
    return baseTitles
  }

  // Cyclically & variedly distribute every wallet across all available chips
  return baseTitles.map((title, idx) => {
    const assignedWallet = walletNames[idx % walletNames.length]
    return `${title} ${assignedWallet}`
  })
}

export default function AiQuickLogModal() {
  const isOpen = useChatStore((s) => s.isQuickLogOpen)
  const closeQuickLog = useChatStore((s) => s.closeQuickLog)
  const switchToFullChat = useChatStore((s) => s.switchToFullChat)

  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || []

  const sampleChips = useMemo(() => generateSampleChips(wallets), [wallets])

  // UI state machine: 'input' | 'analyzing' | 'receipt' | 'intent_switch'
  const [modalMode, setModalMode] = useState('input')
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedTransactions, setRecordedTransactions] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('')
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const sheetRef = useRef(null)
  const baseInputBeforeRecordingRef = useRef('')

  // Open / Close animations (No disruptive auto-focus on open)
  useEffect(() => {
    let timeoutId
    let frameId

    if (isOpen) {
      setShouldRender(true)
      frameId = requestAnimationFrame(() => {
        setIsAnimatingIn(true)
      })
    } else {
      setIsAnimatingIn(false)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      setIsRecording(false)
      timeoutId = setTimeout(() => {
        setShouldRender(false)
        setModalMode('input')
        setInputValue('')
        setSelectedImage(null)
        setRecordedTransactions([])
        setErrorMessage('')
      }, 300)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) closeQuickLog()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeQuickLog])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow && prevOverflow !== 'hidden' ? prevOverflow : ''
    }
  }, [isOpen])

  // Voice recording toggle
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      setIsRecording(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setErrorMessage('Browser Anda tidak mendukung Voice Input.')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = locale === 'id' ? 'id-ID' : 'en-US'
      recognition.continuous = true
      recognition.interimResults = true
      recognitionRef.current = recognition
      baseInputBeforeRecordingRef.current = inputValue ? `${inputValue.trim()} ` : ''

      recognition.onstart = () => {
        setIsRecording(true)
        setErrorMessage('')
      }
      recognition.onresult = (e) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = 0; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript
          if (e.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        const fullText = (baseInputBeforeRecordingRef.current + finalTranscript + interimTranscript).trim()
        setInputValue(fullText)
      }
      recognition.onerror = () => {
        setIsRecording(false)
      }
      recognition.onend = () => {
        setIsRecording(false)
      }
      recognition.start()
    } catch {
      setIsRecording(false)
    }
  }

  // Image select handler
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setSelectedImage(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

function isObviousNonTransaction(text) {
  if (!text) return false
  const lower = text.trim().toLowerCase()

  const isQuestion = lower.endsWith('?') || lower.includes('?')
  const questionWords = [
    'berapa', 'bagaimana', 'gimana', 'kenapa', 'mengapa', 'siapa',
    'apa itu', 'apakah', 'tips', 'saran', 'rekomendasi', 'analisa',
    'analisis', 'laporan', 'grafik', 'ringkasan', 'evaluasi', 'curhat',
    'halo', 'hai', 'hello', 'selamat pagi', 'selamat siang', 'selamat malam',
  ]
  const hasQuestionWord = questionWords.some((w) => lower.startsWith(w) || lower.includes(` ${w} `) || lower.startsWith(`${w} `))

  const hasAmountPattern =
    /\b\d+(\.\d{3})*(k|rb|ribu|jt|juta)?\b/i.test(lower) &&
    (/(rp|\$|k|rb|ribu|jt|juta)/i.test(lower) || /\d{3,}/.test(lower))

  if ((isQuestion || hasQuestionWord) && !hasAmountPattern) {
    return true
  }
  return false
}

  // Submit and Parse AI Intent
  const handleSubmit = async (textToSubmit = inputValue, imageToSubmit = selectedImage) => {
    const cleanText = textToSubmit?.trim()
    if (!cleanText && !imageToSubmit) return

    setLastSubmittedPrompt(cleanText || 'Upload struk/gambar')
    setErrorMessage('')

    // 1. Instant check for obvious non-transaction / questions
    if (!imageToSubmit && isObviousNonTransaction(cleanText)) {
      setModalMode('intent_switch')
      return
    }

    setModalMode('analyzing')

    try {
      const result = await parseTransactionFromText(cleanText || 'Lihat gambar struk ini', {
        locale,
        defaultCurrency,
        wallets,
        imageData: imageToSubmit,
      })

      if (result.error) {
        throw new Error(result.message || 'Gagal memproses dengan AI.')
      }

      // Check Intent: Is this a Transaction Creation?
      if (result.type === 'transactions' && result.action === 'create' && result.transactions?.length > 0) {
        const savedTxs = []
        for (const tx of result.transactions) {
          let finalWalletId = tx.walletId ? Number(tx.walletId) : (wallets.length > 0 ? wallets[0].id : null)
          if (finalWalletId !== null && !wallets.find((w) => w.id === finalWalletId)) {
            finalWalletId = wallets.length > 0 ? wallets[0].id : null
          }

          const txToSave = {
            ...tx,
            category: sanitizeCategoryPath(tx.category, tx.type),
            walletId: finalWalletId,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            createdAt: new Date().toISOString(),
          }

          if (tx.type === 'transfer' && tx.targetWalletId) {
            const twId = Number(tx.targetWalletId)
            if (wallets.find((w) => w.id === twId)) txToSave.targetWalletId = twId
          }

          await addTransaction(txToSave)
          savedTxs.push(txToSave)
        }

        setRecordedTransactions(savedTxs)
        setModalMode('receipt')
        setInputValue('')
        setSelectedImage(null)

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([25, 40, 25])
          } catch {
            // ignore
          }
        }
      } else {
        // Non-Transaction Intent Detected (question, database query, advice, etc.)
        setModalMode('intent_switch')
      }
    } catch (err) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses input.')
      setModalMode('input')
    }
  }

  const handleResetForAnother = () => {
    setModalMode('input')
    setInputValue('')
    setSelectedImage(null)
    setRecordedTransactions([])
    setErrorMessage('')
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        try {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch {
          // ignore
        }
      }
    }, 120)
  }

  const handleSwitchToChat = (prompt) => {
    switchToFullChat(prompt || lastSubmittedPrompt)
  }

  if (!shouldRender) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ease-out ${
        isAnimatingIn ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop */}
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer transition-opacity duration-200 ${
          isAnimatingIn ? 'bg-black/50 opacity-100' : 'bg-black/0 opacity-0'
        }`}
        onClick={closeQuickLog}
        aria-label="Tutup Modal AI"
      />

      {/* Slide-Up Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`absolute inset-x-0 bottom-0 max-h-[92dvh] flex flex-col rounded-t-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl ft-quicklog-sheet max-w-lg mx-auto ${
          isAnimatingIn ? 'ft-quicklog-sheet--open' : ''
        }`}
      >
        {/* Top Drag Handle & Header (Fixed stable dimensions to prevent mobile jumping) */}
        <div className="shrink-0 p-4 pb-3 border-b border-[var(--border)]/50 bg-[var(--panel-strong)] rounded-t-3xl">
          <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-[var(--border-strong)]/40" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-sm font-black text-[var(--fg)] tracking-tight">
                {modalMode === 'receipt'
                  ? 'Struk Transaksi Digital'
                  : modalMode === 'intent_switch'
                  ? 'Konfirmasi Mode AI'
                  : 'Catat Cepat dengan AI'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => switchToFullChat(inputValue)}
                title="Buka AI Finance Chat"
                className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer flex items-center gap-1"
                aria-label="Buka AI Finance Chat"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeQuickLog}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ft-hide-scrollbar">
          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-3.5 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* MODE 1: Input Mode */}
          {modalMode === 'input' && (
            <div className="space-y-3 ft-mode-enter">
              {/* Sapaan Kontekstual */}
              <div className="space-y-0.5 pb-0.5">
                <h2 className="ft-display text-base sm:text-lg font-black tracking-tight text-[var(--fg)]">
                  Mau catat apa hari ini?
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Tulis atau ucapkan transaksi Anda dalam bahasa sehari-hari.
                </p>
              </div>

              {/* Main Input Box */}
              <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 focus-within:border-[var(--accent)] transition-colors shadow-inner">
                {/* Active Voice Recording Live Equalizer Visualizer */}
                {isRecording && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 mb-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1 h-4 px-0.5">
                      <div className="ft-eq-bar" />
                      <div className="ft-eq-bar" />
                      <div className="ft-eq-bar" />
                      <div className="ft-eq-bar" />
                      <div className="ft-eq-bar" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">Mendengarkan suara Anda...</span>
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="Contoh: Makan siang 35rb & bensin 25rb pakai GoPay..."
                  rows={2}
                  className="w-full resize-none bg-transparent text-[15px] sm:text-sm font-medium text-[var(--fg)] placeholder:text-[var(--muted)]/80 focus:outline-none min-h-[64px] leading-relaxed"
                />

                {/* Attached Image Thumbnail */}
                {selectedImage && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 w-fit">
                    <img src={selectedImage} alt="Struk Terlampir" className="h-8 w-8 rounded-lg object-cover" />
                    <span className="text-[10px] font-bold text-[var(--fg)]">Struk terlampir</span>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="rounded-full p-1 text-[var(--muted)] hover:text-rose-500 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Input Actions Footer Bar */}
                <div className="mt-2 flex items-center justify-between pt-2 border-t border-[var(--border)]/40">
                  <div className="flex items-center gap-1.5">
                    {/* Voice Mic Button */}
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
                        isRecording
                          ? 'border-rose-500 bg-rose-500/20 text-rose-500 animate-pulse'
                          : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
                      }`}
                      title={isRecording ? 'Berhenti Merekam' : 'Rekam Suara (Voice Input)'}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>

                    {/* Camera Instant Snapshot Button */}
                    <input
                      type="file"
                      ref={cameraInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
                      title="Foto Struk Fisik (Kamera)"
                    >
                      <Camera className="h-4 w-4" />
                    </button>

                    {/* Image / Struk Upload Gallery Button */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
                      title="Pilih Struk dari Galeri"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={!inputValue.trim() && !selectedImage}
                    className="ft-btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-95 transition shadow-sm"
                  >
                    <span>Catat</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Sample Chips (Infinite Marquee) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    Coba Catat Cepat
                  </span>
                  <span className="text-[9.5px] text-[var(--muted)]/60 font-medium">
                    Geser atau ketuk
                  </span>
                </div>

                <div className="ft-marquee-container ft-marquee-mask overflow-hidden py-1">
                  <div className="ft-marquee-track">
                    {[...sampleChips, ...sampleChips].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInputValue(chip)
                          handleSubmit(chip)
                        }}
                        className="flex items-center gap-1.5 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        <span>{chip}</span>
                        <ArrowUpRight className="h-3 w-3 text-[var(--muted)] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Connected Accounts */}
              {wallets.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] pt-0.5">
                  <Wallet className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span className="truncate">
                    Akun terhubung: {wallets.map((w) => w.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: Analyzing Shimmer State */}
          {modalMode === 'analyzing' && (
            <div className="ft-mode-enter py-3 px-1">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-xl ft-shimmer-scan flex flex-col items-center text-center space-y-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-lg shadow-[var(--accent)]/10">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-[var(--accent)] animate-bounce" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-[var(--fg)] tracking-tight">
                    Menganalisis Transaksi...
                  </h3>
                  <p className="text-xs text-[var(--muted)] max-w-xs">
                    AI sedang mengidentifikasi nominal, kategori, dan menghubungkan akun dompet Anda.
                  </p>
                </div>

                {lastSubmittedPrompt && (
                  <div className="rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-xs italic text-[var(--muted)] max-w-xs truncate shadow-2xs">
                    "{lastSubmittedPrompt}"
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-[var(--accent)]">
                  <CheckCircle2 className="h-3.5 w-3.5 animate-pulse" />
                  <span>FinTrack AI Engine v2.0</span>
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: Receipt Mode (Fase 1 Sukses) */}
          {modalMode === 'receipt' && (
            <div className="ft-mode-enter">
              <AiDigitalReceipt
                transactions={recordedTransactions}
                rawPrompt={lastSubmittedPrompt}
                onLogAnother={handleResetForAnother}
                onClose={closeQuickLog}
                wallets={wallets}
              />
            </div>
          )}

          {/* MODE 4: Intent Switch Mode (Fase 2 Deteksi Non-Transaksi) */}
          {modalMode === 'intent_switch' && (
            <div className="ft-mode-enter">
              <AiIntentSwitchDialog
                rawPrompt={lastSubmittedPrompt}
                onSwitchToChat={handleSwitchToChat}
                onStay={handleResetForAnother}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
