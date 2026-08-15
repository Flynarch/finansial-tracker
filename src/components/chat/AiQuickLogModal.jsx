import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Mic, MicOff, Image as ImageIcon, Send, ArrowUpRight, Loader2, Wallet, AlertCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { parseTransactionFromText } from '../../lib/gemini'
import { sanitizeCategoryPath } from '../../lib/categorySanitizer'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import useChatStore from '../../store/useChatStore'
import AiDigitalReceipt from './AiDigitalReceipt'
import AiIntentSwitchDialog from './AiIntentSwitchDialog'

const SAMPLE_CHIPS = [
  'Makan siang 35rb GoPay',
  'Beli kopi 25rb Cash',
  'Bensin 50rb Mandiri',
  'Belanja bulanan 250rb BCA',
]

export default function AiQuickLogModal() {
  const isOpen = useChatStore((s) => s.isQuickLogOpen)
  const closeQuickLog = useChatStore((s) => s.closeQuickLog)
  const switchToFullChat = useChatStore((s) => s.switchToFullChat)

  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || []

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
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(null)
  const isKeyboardActive = keyboardOffset > 15

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const sheetRef = useRef(null)

  // Open / Close animations & focus management
  useEffect(() => {
    let timeoutId
    let focusTimer
    let frameId

    if (isOpen) {
      setShouldRender(true)
      frameId = requestAnimationFrame(() => {
        setIsAnimatingIn(true)
      })
      focusTimer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true })
        }
      }, 250)
    } else {
      setIsAnimatingIn(false)
      setKeyboardOffset(0)
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
      if (focusTimer) clearTimeout(focusTimer)
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

  // Keyboard-aware: adjust sheet position smoothly using pure GPU transform without DOM destruction
  useEffect(() => {
    if (!isOpen) {
      setKeyboardOffset(0)
      return undefined
    }
    const vp = window.visualViewport
    if (!vp) return undefined

    let rafId = null

    const handleViewportChange = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const offset = Math.max(0, Math.round(window.innerHeight - vp.height))
        setKeyboardOffset(offset > 15 ? offset : 0)
        setViewportHeight(vp.height)
      })
    }

    vp.addEventListener('resize', handleViewportChange)
    vp.addEventListener('scroll', handleViewportChange)
    return () => {
      vp.removeEventListener('resize', handleViewportChange)
      vp.removeEventListener('scroll', handleViewportChange)
      if (rafId) cancelAnimationFrame(rafId)
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
      recognition.continuous = false
      recognition.interimResults = false
      recognitionRef.current = recognition

      recognition.onstart = () => {
        setIsRecording(true)
        setErrorMessage('')
      }
      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript
        setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript))
        setIsRecording(false)
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
        inputRef.current.focus({ preventScroll: true })
      }
    }, 150)
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
        style={{
          transform: !isAnimatingIn
            ? 'translate3d(0, 100%, 0)'
            : keyboardOffset > 0
            ? `translate3d(0, -${keyboardOffset}px, 0)`
            : 'translate3d(0, 0, 0)',
          maxHeight: viewportHeight && keyboardOffset > 0
            ? `${Math.max(240, viewportHeight - 12)}px`
            : undefined,
        }}
        className="absolute inset-x-0 bottom-0 max-h-[88dvh] flex flex-col rounded-t-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl ft-quicklog-sheet max-w-lg mx-auto"
      >
        {/* Top Drag Handle & Header */}
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

            <button
              type="button"
              onClick={closeQuickLog}
              className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition cursor-pointer"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
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
              {/* Sapaan Kontekstual (Collapsible on Keyboard) */}
              <div className={`ft-collapsible-section ${!isKeyboardActive ? 'ft-collapsible-open' : 'ft-collapsible-closed'}`}>
                <div className="ft-collapsible-inner space-y-1 pb-1 ft-stagger-child" style={{ animationDelay: '50ms' }}>
                  <h2 className="ft-display text-lg font-black tracking-tight text-[var(--fg)]">
                    Mau catat apa hari ini?
                  </h2>
                  <p className="text-xs text-[var(--muted)]">
                    Tulis atau ucapkan transaksi Anda dalam bahasa sehari-hari.
                  </p>
                </div>
              </div>

              {/* Main Input Box */}
              <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 focus-within:border-[var(--accent)] transition-colors shadow-inner ft-stagger-child" style={{ animationDelay: '120ms' }}>
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
                  className="w-full resize-none bg-transparent text-xs sm:text-sm font-medium text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none min-h-[58px]"
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
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[var(--border)]/40">
                  <div className="flex items-center gap-1.5">
                    {/* Voice Mic Button */}
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
                        isRecording
                          ? 'border-rose-500 bg-rose-500/20 text-rose-500 animate-pulse'
                          : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
                      }`}
                      title={isRecording ? 'Berhenti Merekam' : 'Rekam Suara (Voice Input)'}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>

                    {/* Image / Struk Upload Button */}
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
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
                      title="Upload Foto Struk"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={!inputValue.trim() && !selectedImage}
                    className="ft-btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <span>Catat</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Sample Chips & Connected Accounts (Collapsible on Keyboard) */}
              <div className={`ft-collapsible-section ${!isKeyboardActive ? 'ft-collapsible-open' : 'ft-collapsible-closed'}`}>
                <div className="ft-collapsible-inner space-y-3 pt-1">
                  <div className="space-y-2 ft-stagger-child" style={{ animationDelay: '200ms' }}>
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                      Coba Catat Cepat
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SAMPLE_CHIPS.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setInputValue(chip)
                            handleSubmit(chip)
                          }}
                          className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
                        >
                          <span>{chip}</span>
                          <ArrowUpRight className="h-3 w-3 text-[var(--muted)]" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {wallets.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] ft-stagger-child" style={{ animationDelay: '270ms' }}>
                      <Wallet className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                      <span className="truncate">
                        Akun terhubung: {wallets.map((w) => w.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: Analyzing Shimmer State */}
          {modalMode === 'analyzing' && (
            <div className="ft-mode-enter">
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-lg shadow-[var(--accent)]/10">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-[var(--accent)] animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-[var(--fg)]">Menganalisis Transaksi...</h3>
                  <p className="text-xs text-[var(--muted)] max-w-xs">
                    AI sedang mengidentifikasi kategori, nominal, dan dompet yang Anda gunakan.
                  </p>
                </div>
                {lastSubmittedPrompt && (
                  <div className="rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-xs italic text-[var(--muted)] max-w-xs truncate">
                    "{lastSubmittedPrompt}"
                  </div>
                )}
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
