import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Sparkles, X, MessageSquare } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import {
  parseTransactionFromText,
  distributeReceiptTransactions,
  parseShortTransactionFast,
} from '../../lib/gemini'
import { sanitizeCategoryPath } from '../../lib/categorySanitizer'
import useSettingsStore from '../../store/useSettingsStore'
import { createTransaction as addTransaction } from '../../services/transactionService'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import AiDigitalReceipt from './AiDigitalReceipt'
import AiIntentSwitchDialog from './AiIntentSwitchDialog'
import ReceiptScanModePicker from './ReceiptScanModePicker'
import MediaSourcePickerModal from './MediaSourcePickerModal'
import { triggerHaptic } from '../../lib/haptics'
import { compressImage } from '../../lib/imageCompression'
import { getLocalDateString } from '../../lib/dateUtils'
import {
  generateSampleChips,
  getInputPlaceholder,
  isObviousNonTransaction,
} from './quicklog/currencySampleTemplates'
import QuickLogInputSection from './quicklog/QuickLogInputSection'
import QuickLogAnalyzingState, { QuickLogErrorBanner } from './quicklog/QuickLogAnalyzingState'

export default function AiQuickLogModal() {
  const navigate = useNavigate()
  const isOpen = useChatStore((s) => s.isQuickLogOpen)
  const closeQuickLog = useChatStore((s) => s.closeQuickLog)
  const switchToFullChat = useChatStore((s) => s.switchToFullChat)
  const autoScan = useChatStore((s) => s.autoScan)
  const clearAutoScan = useChatStore((s) => s.clearAutoScan)

  const { t } = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const queriedWallets = useLiveQuery(
    () => {
      if (!isOpen) return []
      return db.wallets.filter((w) => !w.isArchived).toArray()
    },
    [isOpen],
    []
  )
  const [cachedWallets, setCachedWallets] = useState([])
  const [prevQueriedWallets, setPrevQueriedWallets] = useState(queriedWallets)
  if (queriedWallets && queriedWallets.length > 0 && queriedWallets !== prevQueriedWallets) {
    setPrevQueriedWallets(queriedWallets)
    setCachedWallets(queriedWallets)
  }
  const wallets = (queriedWallets && queriedWallets.length > 0) ? queriedWallets : cachedWallets

  const sampleChips = useMemo(
    () => generateSampleChips(wallets || [], defaultCurrency, locale),
    [wallets, defaultCurrency, locale],
  )

  const inputPlaceholder = useMemo(
    () => getInputPlaceholder(defaultCurrency, locale),
    [defaultCurrency, locale]
  )

  // UI state machine: 'input' | 'scan_mode' | 'analyzing' | 'receipt' | 'intent_switch'
  const [modalMode, setModalMode] = useState('input')
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [scanMode, setScanMode] = useState('all') // 'all' | 'per_item'
  const [recordedMerchant, setRecordedMerchant] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedTransactions, setRecordedTransactions] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [omissionData, setOmissionData] = useState(null)
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('')
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [showMediaSourcePicker, setShowMediaSourcePicker] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  const [prevOpen, setPrevOpen] = useState(isOpen)
  const isOpenRef = useRef(isOpen)
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setShouldRender(true)
    } else {
      setIsAnimatingIn(false)
    }
  }

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const sheetRef = useRef(null)
  const baseInputBeforeRecordingRef = useRef('')

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!touchStartY.current) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartY.current
    if (deltaY > 0) {
      setDragOffset(deltaY)
    } else {
      setDragOffset(deltaY * 0.15)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const elapsed = Date.now() - touchStartTime.current
    const velocity = dragOffset / (elapsed || 1)
    setIsDragging(false)
    if (dragOffset > 80 || (dragOffset > 30 && velocity > 0.45)) {
      closeQuickLog()
    } else {
      setDragOffset(0)
    }
    touchStartY.current = 0
  }, [dragOffset, closeQuickLog])

  // Open / Close animations with clean frame scheduling
  useEffect(() => {
    let timeoutId
    let frameId
    let focusTimer

    if (isOpen) {
      frameId = requestAnimationFrame(() => {
        setIsAnimatingIn(true)
      })
      focusTimer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    } else {
      frameId = requestAnimationFrame(() => {
        setIsAnimatingIn(false)
      })
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err){
          console.warn('[AiQuickLogModal]', err)
        }
      }
      timeoutId = setTimeout(() => {
        setShouldRender(false)
        setIsRecording(false)
        setModalMode('input')
        setInputValue('')
        setSelectedImage(null)
        setScanMode('all')
        setRecordedMerchant('')
        setRecordedTransactions([])
        setErrorMessage('')
        setOmissionData(null)
        setDragOffset(0)
      }, 200)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (frameId) cancelAnimationFrame(frameId)
      if (focusTimer) clearTimeout(focusTimer)
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

  useBackButton(() => {
    if (showMediaSourcePicker) {
      setShowMediaSourcePicker(false)
      return
    }
    if (modalMode === 'scan_mode') {
      setModalMode('input')
      setSelectedImage(null)
      return
    }
    if (modalMode === 'intent_switch') {
      setModalMode('input')
      setInputValue(lastSubmittedPrompt)
      setErrorMessage('')
      setOmissionData(null)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 120)
      return
    }
    closeQuickLog()
  }, Boolean(isOpen))

  // Auto-scan trigger on open if requested
  useEffect(() => {
    if (isOpen && autoScan) {
      clearAutoScan?.()
      const timer = setTimeout(() => {
        fileInputRef.current?.click()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoScan, clearAutoScan])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow && prevOverflow !== 'hidden' ? prevOverflow : ''
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err){
          console.warn('[AiQuickLogModal]', err)
        }
      }
    }
  }, [])

  // Voice recording toggle
  const handleStopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err){
        console.warn('[AiQuickLogModal]', err)
      }
    }
    setIsRecording(false)
  }

  const handleCancelRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err){
        console.warn('[AiQuickLogModal]', err)
      }
    }
    setIsRecording(false)
    setInputValue(baseInputBeforeRecordingRef.current.trim())
  }

  const toggleRecording = async () => {
    if (isRecording) {
      handleStopRecording()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setErrorMessage(
        locale === 'en'
          ? 'Your browser does not support Voice Input.'
          : 'Browser atau perangkat Anda tidak mendukung Voice Input.',
      )
      return
    }

    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (micErr) {
        console.warn('[AiQuickLogModal]', micErr)
        if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
          setErrorMessage(
            locale === 'en'
              ? 'Microphone permission was denied. Please allow microphone access in device settings.'
              : 'Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan.',
          )
          return
        }
      }
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
      recognition.onerror = (event) => {
        setIsRecording(false)
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setErrorMessage(
            locale === 'en'
              ? 'Microphone access was denied. Please allow microphone permission.'
              : 'Izin mikrofon ditolak. Mohon aktifkan izin mikrofon di pengaturan.',
          )
        } else if (event?.error === 'audio-capture') {
          setErrorMessage(
            locale === 'en'
              ? 'Microphone is unavailable or in use by another app.'
              : 'Mikrofon tidak tersedia atau sedang digunakan oleh aplikasi lain.',
          )
        }
      }
      recognition.onend = () => {
        setIsRecording(false)
      }
      recognition.start()
    } catch (err){
      console.warn('[AiQuickLogModal]', err)
      setIsRecording(false)
    }
  }

  // Image select handler
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setErrorMessage(
          locale === 'en'
            ? 'Receipt scanning requires an internet connection.'
            : 'Pemindaian struk memerlukan koneksi internet.'
        )
        if (e.target) {
          e.target.value = ''
        }
        return
      }
      try {
        const compressed = await compressImage(file, 1024, 0.75)
        if (compressed) {
          setSelectedImage(compressed)
          setModalMode('scan_mode')
        }
      } catch (err) {
        console.warn('[AiQuickLogModal.handleImageSelect] Compression failed, falling back:', err)
        const reader = new FileReader()
        reader.onload = (ev) => {
          setSelectedImage(ev.target.result)
          setModalMode('scan_mode')
        }
        reader.readAsDataURL(file)
      } finally {
        if (e.target) {
          e.target.value = ''
        }
      }
    }
  }

  // Submit and Parse AI Intent
  const handleSubmit = async (
    textToSubmit = inputValue,
    imageToSubmit = selectedImage,
    modeToUse = scanMode,
    targetWalletId = null
  ) => {
    handleStopRecording()
    const cleanText = textToSubmit?.trim()
    if (!cleanText && !imageToSubmit) return

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false

    if (imageToSubmit && isOffline) {
      setErrorMessage(
        locale === 'en'
          ? 'Receipt scanning requires an internet connection.'
          : 'Pemindaian struk memerlukan koneksi internet.'
      )
      setModalMode('input')
      return
    }

    setLastSubmittedPrompt(cleanText || (imageToSubmit ? (modeToUse === 'per_item' ? 'Scan struk per item' : 'Scan struk total') : 'Upload struk/gambar'))
    setErrorMessage('')
    setOmissionData(null)

    // 1. Instant check for obvious non-transaction / questions
    if (!imageToSubmit && isObviousNonTransaction(cleanText)) {
      setModalMode('intent_switch')
      return
    }

    const clampedText = cleanText ? String(cleanText).slice(0, 4000) : ''

    // 2. Fast Path Routing (Online-First):
    // When offline, parse casual transactions instantly in 0ms locally without calling remote AI.
    // When online, skip local fast-path pre-parsing, enter 'analyzing' state, and call Gemini AI!
    let preParsedResult = null
    if (isOffline && !imageToSubmit && clampedText) {
      const fastResult = parseShortTransactionFast(clampedText, wallets, defaultCurrency)
      if (fastResult && (fastResult.type === 'transactions' || (Array.isArray(fastResult.transactions) && fastResult.transactions.length > 0))) {
        preParsedResult = fastResult
      }
    }

    if (!preParsedResult) {
      setModalMode('analyzing')
    }

    try {
      let result = preParsedResult
      if (!result) {
        try {
          result = await parseTransactionFromText(clampedText || 'Lihat gambar struk ini', {
            locale,
            defaultCurrency,
            wallets,
            imageData: imageToSubmit,
            scanMode: modeToUse,
            preferFastNlp: !imageToSubmit,
            isQuickLog: true,
          })
        } catch (apiErr) {
          console.warn('[AiQuickLogModal] Remote AI call failed, attempting local NLP fallback:', apiErr)
          if (!imageToSubmit && clampedText) {
            const fallbackResult = parseShortTransactionFast(clampedText, wallets, defaultCurrency)
            if (fallbackResult && (fallbackResult.type === 'transactions' || fallbackResult.transactions?.length > 0)) {
              result = fallbackResult
            }
          }
          if (!result) throw apiErr
        }
      }

      // Race condition guard: bail out if modal was closed during AI processing
      if (!isOpenRef.current) return

      if (result.error) {
        // If remote AI returned an error (e.g. quota 429), try local NLP fallback before giving up
        if (!imageToSubmit && clampedText && result.type !== 'omission_clarification') {
          const fallbackResult = parseShortTransactionFast(clampedText, wallets, defaultCurrency)
          if (fallbackResult && (fallbackResult.type === 'transactions' || fallbackResult.transactions?.length > 0)) {
            result = fallbackResult
          }
        }
      }

      if (result.error) {
        if (result.type === 'omission_clarification' || (Array.isArray(result.chips) && result.chips.length > 0)) {
          setOmissionData({
            message: result.message,
            chips: result.chips,
            pendingFrame: result.pendingFrame || null,
            originalText: clampedText,
          })
          setModalMode('input')
          return
        }
        throw new Error(result.message || 'Gagal memproses dengan AI.')
      }

      // Check Intent: Is this a Transaction Creation?
      if ((result.type === 'transactions' || result.type === 'transfer') && result.action === 'create' && result.transactions?.length > 0) {
        let transactionsToProcess = distributeReceiptTransactions(result.transactions, result, modeToUse)

        const savedTxs = []
        for (const tx of transactionsToProcess) {
          const numericAmount = Number(tx.amount || 0)
          if (!Number.isFinite(numericAmount) || numericAmount <= 0) continue

          const configuredDefaultWalletId = useSettingsStore.getState().defaultWalletId
          const primaryDefaultWalletId = wallets.find((w) => w.id === configuredDefaultWalletId)?.id || (wallets.length > 0 ? wallets[0].id : null)
          let finalWalletId = targetWalletId || (tx.walletId ? Number(tx.walletId) : primaryDefaultWalletId)
          if (finalWalletId !== null && !wallets.find((w) => w.id === finalWalletId)) {
            finalWalletId = primaryDefaultWalletId
          }

          const matchedWallet = wallets.find((w) => w.id === finalWalletId)
          const txCurrency = tx.currency || matchedWallet?.currency || defaultCurrency

          // Resolve individual item category if per_item
          const itemCategory = modeToUse === 'per_item'
            ? sanitizeCategoryPath(tx.category || tx.notes, tx.type || 'expense')
            : sanitizeCategoryPath(tx.category, tx.type)

          const isSplit = Boolean(tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0)
          const cleanSplitItems = isSplit
            ? tx.splitItems.map((si) => ({
                ...si,
                category: sanitizeCategoryPath(si.category || si.notes, si.type || tx.type || 'expense'),
                amount: Number(si.amount) || 0,
                notes: si.notes || '',
                isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
              }))
            : undefined

          const txEngine = tx.engine || result.engine || (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_nlp' : 'online_ai')
          const txEngineLabel = tx.engineLabel || result.engineLabel || (txEngine === 'offline_nlp' ? 'NLP Lokal (Offline)' : 'AI Gemini (Online)')

          const txToSave = {
            ...tx,
            engine: txEngine,
            engineLabel: txEngineLabel,
            amount: numericAmount,
            date: tx.date || getLocalDateString(),
            time: tx.time || format(new Date(), 'HH:mm'),
            category: itemCategory,
            isSplit,
            splitItems: cleanSplitItems,
            walletId: finalWalletId,
            currency: txCurrency,
            merchant: tx.merchant || result.merchant || undefined,
            items: Array.isArray(tx.items) && tx.items.length > 0 ? tx.items : undefined,
            subtotal: typeof tx.subtotal === 'number' ? tx.subtotal : undefined,
            tax: typeof tx.tax === 'number' ? tx.tax : undefined,
            discount: typeof tx.discount === 'number' ? tx.discount : undefined,
            paymentMethod: tx.paymentMethod || undefined,
            receiptImage: imageToSubmit || undefined,
            createdAt: Date.now(),
          }

          if (tx.type === 'transfer' && tx.targetWalletId) {
            const twId = Number(tx.targetWalletId)
            if (wallets.find((w) => w.id === twId)) txToSave.targetWalletId = twId
          }

          const createdId = await addTransaction(txToSave)
          txToSave.id = createdId
          savedTxs.push(txToSave)
        }

        if (savedTxs.length > 0) {
          setRecordedTransactions(savedTxs)
          setRecordedMerchant(result.merchant || (savedTxs[0]?.merchant) || '')
          setModalMode('receipt')
          setInputValue('')
          setSelectedImage(null)

          triggerHaptic('success')
        } else {
          setErrorMessage(locale === 'en' ? 'No valid transactions to record (amount must be greater than 0).' : 'Tidak ada transaksi valid untuk dicatat (nominal harus lebih dari 0).')
          setModalMode('input')
        }
      } else {
        // Non-Transaction Intent Detected (question, database query, advice, etc.)
        setModalMode('intent_switch')
      }
    } catch (err) {
      console.warn('[AiQuickLogModal]', err)
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses input.')
      setModalMode('input')
    }
  }

  const handleResetForAnother = () => {
    setModalMode('input')
    setInputValue('')
    setSelectedImage(null)
    setScanMode('all')
    setRecordedMerchant('')
    setRecordedTransactions([])
    setErrorMessage('')
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        try {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch (err){
          console.warn('[AiQuickLogModal]', err)
        }
      }
    }, 120)
  }

  const handleStayAndEdit = () => {
    setModalMode('input')
    setInputValue(lastSubmittedPrompt)
    setErrorMessage('')
    setOmissionData(null)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        try {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch (err) {
          console.warn('[AiQuickLogModal]', err)
        }
      }
    }, 120)
  }

  const handleSwitchToChat = (prompt) => {
    switchToFullChat(prompt || lastSubmittedPrompt)
    closeQuickLog()
    navigate('/ai-chat')
  }

  if (!shouldRender) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 ${
        isAnimatingIn ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer transition-opacity duration-200 ease-out ${
          isAnimatingIn ? 'bg-black/60 opacity-100' : 'bg-black/0 opacity-0 pointer-events-none'
        }`}
        onClick={closeQuickLog}
        aria-label={t('common.close', 'Tutup Modal AI')}
      />

      {/* Slide-Up Bottom Sheet */}
      <div
        ref={sheetRef}
        style={{
          boxShadow: 'var(--shadow-card)',
          transform: isAnimatingIn
            ? `translate3d(0, ${Math.max(0, dragOffset)}px, 0)`
            : 'translate3d(0, 100%, 0)',
          transition: isDragging
            ? 'none'
            : isAnimatingIn
            ? 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out'
            : 'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in',
        }}
        className={`absolute left-0 right-0 bottom-0 w-full ${modalMode === 'receipt' ? 'max-h-[96dvh]' : 'max-h-[92dvh]'} flex flex-col rounded-t-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl max-w-lg mx-auto transform-gpu ft-hide-scrollbar`}
      >
        {/* Top Drag Handle & Header (Fixed stable dimensions to prevent mobile jumping) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`shrink-0 ${modalMode === 'receipt' ? 'px-4 py-2.5' : 'p-4 pb-3'} border-b border-[var(--border)]/50 bg-[var(--panel-strong)] rounded-t-3xl cursor-grab active:cursor-grabbing touch-none select-none`}
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--border-strong)]/40" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6.5 w-6.5 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-black text-[var(--fg)] tracking-tight">
                {modalMode === 'receipt'
                  ? (locale === 'en' ? 'Digital Receipt' : 'Struk Transaksi Digital')
                  : modalMode === 'scan_mode'
                  ? (locale === 'en' ? 'Receipt Scan Mode' : 'Pilih Mode Pindai Struk')
                  : modalMode === 'intent_switch'
                  ? (locale === 'en' ? 'AI Mode Confirmation' : 'Konfirmasi Mode AI')
                  : (locale === 'en' ? 'Quick AI Log' : 'Catat Cepat dengan AI')}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  switchToFullChat(inputValue)
                  closeQuickLog()
                  navigate('/ai-chat')
                }}
                title={t('aiChat.title', 'Buka AI Finance Chat')}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer flex items-center gap-1"
                aria-label={t('aiChat.title', 'Buka AI Finance Chat')}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={closeQuickLog}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer"
                aria-label={t('common.close', 'Tutup')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${modalMode === 'receipt' ? 'p-2.5 sm:p-3.5' : 'p-4'} pb-[calc(1rem+env(safe-area-inset-bottom))] ft-hide-scrollbar`}>
          {/* Error Banner across modes */}
          <QuickLogErrorBanner errorMessage={errorMessage} />

          {/* MODE 1: Input Mode */}
          {modalMode === 'input' && (
            <QuickLogInputSection
              locale={locale}
              t={t}
              inputValue={inputValue}
              setInputValue={setInputValue}
              inputPlaceholder={inputPlaceholder}
              inputRef={inputRef}
              isRecording={isRecording}
              handleStopRecording={handleStopRecording}
              handleCancelRecording={handleCancelRecording}
              toggleRecording={toggleRecording}
              selectedImage={selectedImage}
              setSelectedImage={setSelectedImage}
              setShowMediaSourcePicker={setShowMediaSourcePicker}
              handleSubmit={handleSubmit}
              sampleChips={sampleChips}
              wallets={wallets}
              omissionData={omissionData}
              setOmissionData={setOmissionData}
            />
          )}

          {/* Hidden File Inputs for Camera and Gallery */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* Media Source Picker Modal (Camera vs Gallery) */}
          <MediaSourcePickerModal
            isOpen={showMediaSourcePicker}
            onClose={() => setShowMediaSourcePicker(false)}
            onSelectCamera={() => cameraInputRef.current?.click()}
            onSelectGallery={() => fileInputRef.current?.click()}
            locale={locale}
          />

          {/* MODE 1.5: Receipt Scan Mode Picker */}
          {modalMode === 'scan_mode' && (
            <ReceiptScanModePicker
              image={selectedImage}
              wallets={wallets}
              locale={locale}
              onConfirm={(mode, walletId) => {
                triggerHaptic('light')
                setScanMode(mode)
                handleSubmit(inputValue, selectedImage, mode, walletId)
              }}
              onCancel={() => {
                setSelectedImage(null)
                setModalMode('input')
              }}
              onChangeImage={() => {
                setShowMediaSourcePicker(true)
              }}
            />
          )}

          {/* MODE 2: Analyzing Shimmer State */}
          {modalMode === 'analyzing' && (
            <QuickLogAnalyzingState
              lastSubmittedPrompt={lastSubmittedPrompt}
              t={t}
            />
          )}

          {/* MODE 3: Receipt Mode (Fase 1 Sukses) */}
          {modalMode === 'receipt' && (
            <div className="ft-mode-enter">
              <AiDigitalReceipt
                transactions={recordedTransactions}
                rawPrompt={lastSubmittedPrompt}
                merchant={recordedMerchant}
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
                onStay={handleStayAndEdit}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
