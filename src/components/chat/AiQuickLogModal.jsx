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
import useTranslation from '../../hooks/useTranslation'
import AiDigitalReceipt from './AiDigitalReceipt'
import AiIntentSwitchDialog from './AiIntentSwitchDialog'
import ReceiptScanModePicker from './ReceiptScanModePicker'

const CURRENCY_SAMPLE_TEMPLATES = {
  IDR: {
    id: [
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
    ],
    en: [
      'Lunch 35k IDR',
      'Salary 5M IDR',
      'Coffee 25k IDR',
      'Pocket money 50k IDR',
      'Gas 30k IDR',
      'Groceries 250k IDR',
      'Electricity 100k IDR',
      'Hangout 45k IDR',
      'Cashback 15k IDR',
      'Mobile data 50k IDR',
      'WiFi bill 300k IDR',
      'Dinner 60k IDR',
      'Snacks 20k IDR',
      'Subscription 186k IDR',
    ],
  },
  USD: {
    id: [
      'Makan siang $5',
      'Gaji $3000',
      'Beli kopi $3.5',
      'Uang saku $20',
      'Bensin $25',
      'Belanja bulanan $60',
      'Token listrik $30',
      'Nongkrong $15',
      'Dapat cashback $5',
      'Beli pulsa $10',
      'Bayar WiFi $40',
      'Makan malam $18',
      'Beli snack $4',
      'Bayar langganan $12',
    ],
    en: [
      'Lunch $5',
      'Salary $3000',
      'Coffee $3.5',
      'Pocket money $20',
      'Gas $25',
      'Groceries $60',
      'Electricity bill $30',
      'Hangout $15',
      'Cashback $5',
      'Mobile top-up $10',
      'WiFi bill $40',
      'Dinner $18',
      'Snacks $4',
      'Subscription $12',
    ],
  },
  EUR: {
    id: [
      'Makan siang €5',
      'Gaji €2800',
      'Beli kopi €3.5',
      'Uang saku €20',
      'Bensin €25',
      'Belanja bulanan €55',
      'Token listrik €28',
      'Nongkrong €15',
      'Dapat cashback €5',
      'Beli pulsa €10',
      'Bayar WiFi €35',
      'Makan malam €16',
      'Beli snack €4',
      'Bayar langganan €12',
    ],
    en: [
      'Lunch €5',
      'Salary €2800',
      'Coffee €3.5',
      'Pocket money €20',
      'Gas €25',
      'Groceries €55',
      'Electricity bill €28',
      'Hangout €15',
      'Cashback €5',
      'Mobile top-up €10',
      'WiFi bill €35',
      'Dinner €16',
      'Snacks €4',
      'Subscription €12',
    ],
  },
  SGD: {
    id: [
      'Makan siang S$6',
      'Gaji S$4000',
      'Beli kopi S$4',
      'Uang saku S$25',
      'Bensin S$30',
      'Belanja bulanan S$70',
      'Token listrik S$35',
      'Nongkrong S$18',
      'Dapat cashback S$6',
      'Beli pulsa S$12',
      'Bayar WiFi S$45',
      'Makan malam S$20',
      'Beli snack S$5',
      'Bayar langganan S$15',
    ],
    en: [
      'Lunch S$6',
      'Salary S$4000',
      'Coffee S$4',
      'Pocket money S$25',
      'Gas S$30',
      'Groceries S$70',
      'Electricity bill S$35',
      'Hangout S$18',
      'Cashback S$6',
      'Mobile top-up S$12',
      'WiFi bill S$45',
      'Dinner S$20',
      'Snacks S$5',
      'Subscription S$15',
    ],
  },
  MYR: {
    id: [
      'Makan siang RM15',
      'Gaji RM3500',
      'Beli kopi RM10',
      'Uang saku RM40',
      'Bensin RM30',
      'Belanja bulanan RM150',
      'Token listrik RM60',
      'Nongkrong RM30',
      'Dapat cashback RM10',
      'Beli pulsa RM20',
      'Bayar WiFi RM90',
      'Makan malam RM35',
      'Beli snack RM8',
      'Bayar langganan RM35',
    ],
    en: [
      'Lunch RM15',
      'Salary RM3500',
      'Coffee RM10',
      'Pocket money RM40',
      'Gas RM30',
      'Groceries RM150',
      'Electricity bill RM60',
      'Hangout RM30',
      'Cashback RM10',
      'Mobile top-up RM20',
      'WiFi bill RM90',
      'Dinner RM35',
      'Snacks RM8',
      'Subscription RM35',
    ],
  },
  JPY: {
    id: [
      'Makan siang ¥800',
      'Gaji ¥300.000',
      'Beli kopi ¥450',
      'Uang saku ¥3.000',
      'Bensin ¥3.500',
      'Belanja bulanan ¥8.000',
      'Token listrik ¥4.500',
      'Nongkrong ¥2.000',
      'Dapat cashback ¥500',
      'Beli pulsa ¥2.000',
      'Bayar WiFi ¥4.500',
      'Makan malam ¥1.800',
      'Beli snack ¥400',
      'Bayar langganan ¥1.500',
    ],
    en: [
      'Lunch ¥800',
      'Salary ¥300,000',
      'Coffee ¥450',
      'Pocket money ¥3,000',
      'Gas ¥3,500',
      'Groceries ¥8,000',
      'Electricity bill ¥4,500',
      'Hangout ¥2,000',
      'Cashback ¥500',
      'Mobile top-up ¥2,000',
      'WiFi bill ¥4,500',
      'Dinner ¥1,800',
      'Snacks ¥400',
      'Subscription ¥1,500',
    ],
  },
  GBP: {
    id: [
      'Makan siang £5',
      'Gaji £2500',
      'Beli kopi £3.5',
      'Uang saku £20',
      'Bensin £25',
      'Belanja bulanan £50',
      'Token listrik £25',
      'Nongkrong £15',
      'Dapat cashback £5',
      'Beli pulsa £10',
      'Bayar WiFi £30',
      'Makan malam £15',
      'Beli snack £3',
      'Bayar langganan £10',
    ],
    en: [
      'Lunch £5',
      'Salary £2500',
      'Coffee £3.5',
      'Pocket money £20',
      'Gas £25',
      'Groceries £50',
      'Electricity bill £25',
      'Hangout £15',
      'Cashback £5',
      'Mobile top-up £10',
      'WiFi bill £30',
      'Dinner £15',
      'Snacks £3',
      'Subscription £10',
    ],
  },
}

function generateSampleChips(userWallets = [], currency = 'IDR', locale = 'id') {
  const walletNames = (userWallets || []).map((w) => w.name).filter(Boolean)
  const currencySet = CURRENCY_SAMPLE_TEMPLATES[currency] || CURRENCY_SAMPLE_TEMPLATES.IDR
  const baseTitles = currencySet[locale] || currencySet.id || CURRENCY_SAMPLE_TEMPLATES.IDR.id

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

  const { t } = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  const sampleChips = useMemo(
    () => generateSampleChips(wallets || [], defaultCurrency, locale),
    [wallets, defaultCurrency, locale],
  )

  const inputPlaceholder = useMemo(() => {
    if (defaultCurrency === 'USD') {
      return locale === 'en'
        ? 'e.g., Lunch $12 & gas $20 with Cash...'
        : 'Contoh: Makan siang $5 & bensin $20 pakai Cash...'
    }
    if (defaultCurrency === 'EUR') {
      return locale === 'en'
        ? 'e.g., Lunch €12 & gas €20 with Card...'
        : 'Contoh: Makan siang €5 & bensin €20 pakai Rekening...'
    }
    if (defaultCurrency === 'SGD') {
      return locale === 'en'
        ? 'e.g., Lunch S$6 & taxi S$15 with DBS...'
        : 'Contoh: Makan siang S$6 & bensin S$25 pakai DBS...'
    }
    if (defaultCurrency === 'MYR') {
      return locale === 'en'
        ? 'e.g., Lunch RM15 & gas RM30 with Maybank...'
        : 'Contoh: Makan siang RM15 & bensin RM30 pakai Touch n Go...'
    }
    if (defaultCurrency === 'JPY') {
      return locale === 'en'
        ? 'e.g., Lunch ¥800 & coffee ¥450 with Suica...'
        : 'Contoh: Makan siang ¥800 & bensin ¥3000 pakai Cash...'
    }
    if (defaultCurrency === 'GBP') {
      return locale === 'en'
        ? 'e.g., Lunch £6 & coffee £3.5 with Monzo...'
        : 'Contoh: Makan siang £5 & bensin £20 pakai Bank...'
    }
    return locale === 'en'
      ? 'e.g., Lunch 35k IDR & gas 25k IDR with GoPay...'
      : 'Contoh: Makan siang 35rb & bensin 25rb pakai GoPay...'
  }, [defaultCurrency, locale])

  // UI state machine: 'input' | 'scan_mode' | 'analyzing' | 'receipt' | 'intent_switch'
  const [modalMode, setModalMode] = useState('input')
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [scanMode, setScanMode] = useState('all') // 'all' | 'per_item'
  const [recordedMerchant, setRecordedMerchant] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedTransactions, setRecordedTransactions] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('')
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)

  const [prevOpen, setPrevOpen] = useState(isOpen)
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

  // Open / Close animations (No disruptive auto-focus on open)
  useEffect(() => {
    let timeoutId
    let frameId

    if (isOpen) {
      frameId = requestAnimationFrame(() => {
        setIsAnimatingIn(true)
      })
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
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
      reader.onload = (ev) => {
        setSelectedImage(ev.target.result)
        setModalMode('scan_mode')
      }
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
  const handleSubmit = async (
    textToSubmit = inputValue,
    imageToSubmit = selectedImage,
    modeToUse = scanMode,
    targetWalletId = null
  ) => {
    const cleanText = textToSubmit?.trim()
    if (!cleanText && !imageToSubmit) return

    setLastSubmittedPrompt(cleanText || (imageToSubmit ? (modeToUse === 'per_item' ? 'Scan struk per item' : 'Scan struk total') : 'Upload struk/gambar'))
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
        scanMode: modeToUse,
      })

      if (result.error) {
        throw new Error(result.message || 'Gagal memproses dengan AI.')
      }

      // Check Intent: Is this a Transaction Creation?
      if (result.type === 'transactions' && result.action === 'create' && result.transactions?.length > 0) {
        const savedTxs = []
        for (const tx of result.transactions) {
          let finalWalletId = targetWalletId || (tx.walletId ? Number(tx.walletId) : (wallets.length > 0 ? wallets[0].id : null))
          if (finalWalletId !== null && !wallets.find((w) => w.id === finalWalletId)) {
            finalWalletId = wallets.length > 0 ? wallets[0].id : null
          }

          const matchedWallet = wallets.find((w) => w.id === finalWalletId)
          const txCurrency = matchedWallet?.currency || tx.currency || defaultCurrency

          const txToSave = {
            ...tx,
            category: sanitizeCategoryPath(tx.category, tx.type),
            walletId: finalWalletId,
            currency: txCurrency,
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
        setRecordedMerchant(result.merchant || '')
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
    setScanMode('all')
    setRecordedMerchant('')
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
        aria-label={t('common.close', 'Tutup Modal AI')}
      />

      {/* Slide-Up Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`absolute inset-x-0 bottom-0 ${modalMode === 'receipt' ? 'max-h-[96dvh]' : 'max-h-[92dvh]'} flex flex-col rounded-t-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl ft-quicklog-sheet max-w-lg mx-auto ${
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
                onClick={() => switchToFullChat(inputValue)}
                title={t('aiChat.title', 'Buka AI Finance Chat')}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer flex items-center gap-1"
                aria-label={t('aiChat.title', 'Buka AI Finance Chat')}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeQuickLog}
                className="rounded-xl p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer"
                aria-label={t('common.close', 'Tutup')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${modalMode === 'receipt' ? 'p-3 sm:p-4' : 'p-4'} pb-[calc(1rem+env(safe-area-inset-bottom))] ft-hide-scrollbar`}>
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
                  {locale === 'en' ? 'What would you like to log today?' : 'Mau catat apa hari ini?'}
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  {locale === 'en'
                    ? 'Type or speak your transaction in natural language.'
                    : 'Tulis atau ucapkan transaksi Anda dalam bahasa sehari-hari.'}
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
                    <span className="text-xs font-bold tracking-tight">
                      {locale === 'en' ? 'Listening to your voice...' : 'Mendengarkan suara Anda...'}
                    </span>
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
                  placeholder={inputPlaceholder}
                  rows={2}
                  className="w-full resize-none bg-transparent text-[15px] sm:text-sm font-medium text-[var(--fg)] placeholder:text-[var(--muted)]/80 focus:outline-none min-h-[64px] leading-relaxed"
                />

                {/* Attached Image Thumbnail */}
                {selectedImage && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 w-fit">
                    <img src={selectedImage} alt="Struk Terlampir" className="h-8 w-8 rounded-lg object-cover" />
                    <span className="text-[10px] font-bold text-[var(--fg)]">
                      {t('aiQuickLog.attachedReceipt', 'Struk terlampir')}
                    </span>
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
                      title={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti Merekam') : (locale === 'en' ? 'Voice input' : 'Rekam Suara (Voice Input)')}
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
                      title={t('aiQuickLog.camera', 'Foto Struk Fisik (Kamera)')}
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
                      title={t('aiQuickLog.gallery', 'Pilih Struk dari Galeri')}
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
                    <span>{t('aiQuickLog.record', 'Catat')}</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Sample Chips (Infinite Marquee) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    {t('aiQuickLog.sampleChipsHeader', 'Coba Catat Cepat')}
                  </span>
                  <span className="text-[9.5px] text-[var(--muted)]/60 font-medium">
                    {t('aiQuickLog.sampleChipsHint', 'Geser atau ketuk')}
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
                    {t('aiQuickLog.connectedAccounts', { accounts: wallets.map((w) => w.name).join(', ') }, `Akun terhubung: ${wallets.map((w) => w.name).join(', ')}`)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MODE 1.5: Receipt Scan Mode Picker */}
          {modalMode === 'scan_mode' && (
            <ReceiptScanModePicker
              image={selectedImage}
              wallets={wallets}
              locale={locale}
              onConfirm={(mode, walletId) => {
                setScanMode(mode)
                handleSubmit(inputValue, selectedImage, mode, walletId)
              }}
              onCancel={() => {
                setSelectedImage(null)
                setModalMode('input')
              }}
              onChangeImage={() => {
                cameraInputRef.current?.click()
              }}
            />
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
                    {t('aiQuickLog.analyzingTitle', 'Menganalisis Transaksi...')}
                  </h3>
                  <p className="text-xs text-[var(--muted)] max-w-xs">
                    {t('aiQuickLog.analyzingDesc', 'AI sedang mengidentifikasi nominal, kategori, dan menghubungkan akun dompet Anda.')}
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
