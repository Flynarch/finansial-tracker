import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { translate } from '../lib/i18n'
import useSettingsStore from '../store/useSettingsStore'
import { createTransaction as addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService'
import { createWallet } from '../services/walletService'
import useLoanStore from '../store/useLoanStore'
import { db } from '../lib/db'
import { invalidateWalletBalance } from '../lib/balanceEngine'
import { getCachedCurrencyRates } from '../lib/api'
import { useLiveQuery } from 'dexie-react-hooks'
import { parseTransactionFromText, distributeReceiptTransactions } from '../lib/gemini'
import { sanitizeCategoryPath } from '../lib/categorySanitizer'
import { getMergedExpenseTree } from '../lib/expenseCategories'
import { format } from 'date-fns'
import { getLocalDateString } from '../lib/dateUtils'
import {
  Send,
  Trash2,
  Sparkles,
  Mic,
  Camera,
  ChevronLeft,
  Paintbrush,
  Check,
} from 'lucide-react'
import { UserBubble, AiBubble, ReasoningIndicator, ChartBubble } from '../components/chat/ChatBubble'
import WelcomeHero from '../components/chat/WelcomeHero'
import ScrollToBottomFAB from '../components/chat/ScrollToBottomFAB'
import MessageContextMenu from '../components/chat/MessageContextMenu'
import FinancialHealthWidget from '../components/chat/widgets/FinancialHealthWidget'
import CardCarousel from '../components/chat/CardCarousel'
import TransactionSuccess from '../components/chat/TransactionSuccess'
import ActionSuccessCard from '../components/chat/ActionSuccessCard'
import QuickChips from '../components/chat/QuickChips'
import ReceiptScanModePicker from '../components/chat/ReceiptScanModePicker'
import VoiceVisualizer from '../components/chat/VoiceVisualizer'
import MediaSourcePickerModal from '../components/chat/MediaSourcePickerModal'
import useChatStore from '../store/useChatStore'
import useBackButton from '../hooks/useBackButton'
import { triggerHaptic } from '../lib/haptics'
import { formatCurrency, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx, convertCurrency } from '../lib/utils'
import { calculateBudgetSpent, getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from '../lib/budgetUtils'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import {
  validateTransferWallets,
  findMatchingTransactionForAction,
  findMatchingLoanForAction,
  prepareUnifiedMessage,
} from '../lib/ai/aiChatHelpers'

const BG_TEXTURE_OPTIONS = [
  { id: 'paper', labelKey: 'aiChat.texture.paper', defaultLabel: 'Kertas Jurnal' },
  { id: 'dots', labelKey: 'aiChat.texture.dots', defaultLabel: 'Dot Matrix' },
  { id: 'grid', labelKey: 'aiChat.texture.grid', defaultLabel: 'Ledger Grid' },
  { id: 'topo', labelKey: 'aiChat.texture.topo', defaultLabel: 'Topografis' },
  { id: 'clean', labelKey: 'aiChat.texture.clean', defaultLabel: 'Minimalis' },
]

export default function AiFinanceChat() {
  const navigate = useNavigate()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const defaultWalletId = useSettingsStore((s) => s.defaultWalletId)
  const addLoan = useLoanStore((s) => s.addLoan)
  const recordPayment = useLoanStore((s) => s.recordPayment)
  const updateLoan = useLoanStore((s) => s.updateLoan)
  const deleteLoan = useLoanStore((s) => s.deleteLoan)
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.isArchived).toArray(), []) || []

  // Today's total expense for WelcomeHero live snapshot
  const todayStr = useMemo(() => getLocalDateString(), [])
  const todayExpense = useLiveQuery(async () => {
    try {
      const txs = await db.transactions.where('date').equals(todayStr).toArray()
      const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
      let total = 0
      txs.forEach((tx) => {
        if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          tx.splitItems.forEach((si) => {
            const itemTx = {
              ...tx,
              ...si,
              category: si.category || tx.category,
              amount: si.amount,
              type: si.type || tx.type,
              currency: si.currency || tx.currency || defaultCurrency,
              isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
              isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
              excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
            }
            if (isExcludeAnalyticsTx(itemTx)) return
            if ((si.type || tx.type) === 'expense') {
              total += convertCurrency(Number(si.amount || 0), si.currency || tx.currency || defaultCurrency, defaultCurrency, activeRates)
            }
          })
          return
        }
        if (isExcludeAnalyticsTx(tx)) return
        if (tx.type === 'expense') {
          total += convertCurrency(Number(tx.amount || 0), tx.currency || defaultCurrency, defaultCurrency, activeRates)
        }
      })
      return Math.round(total * 100) / 100
    } catch {
      return 0
    }
  }, [todayStr, defaultCurrency]) || 0

  // Chat Store
  const messages = useChatStore((s) => s.messages)
  const setMessages = useChatStore((s) => s.setMessages)
  const initialInput = useChatStore((s) => s.initialInput)
  const setInitialInput = useChatStore((s) => s.setInitialInput)
  const backgroundTexture = useChatStore((s) => s.backgroundTexture) || 'paper'
  const setBackgroundTexture = useChatStore((s) => s.setBackgroundTexture)
  
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const [selectedImage, setSelectedImage] = useState(null)
  const [showScanModePicker, setShowScanModePicker] = useState(false)
  const [showMediaSourcePicker, setShowMediaSourcePicker] = useState(false)
  const [showTexturePicker, setShowTexturePicker] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showScrollFAB, setShowScrollFAB] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [contextMenuMsg, setContextMenuMsg] = useState(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const textureDropdownRef = useRef(null)
  const deletingMsgIdsRef = useRef(new Set())
  const longPressTimerRef = useRef(null)

  useBackButton(() => {
    if (contextMenuMsg) {
      setContextMenuMsg(null)
      return
    }
    if (showMediaSourcePicker) {
      setShowMediaSourcePicker(false)
      return
    }
    if (showTexturePicker) {
      setShowTexturePicker(false)
      return
    }
    if (showClearConfirm) {
      setShowClearConfirm(false)
      return
    }
    if (showScanModePicker) {
      setShowScanModePicker(false)
      setSelectedImage(null)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }, true)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const chatScrollContainerRef = useRef(null)
  const isStreamingRef = useRef(false)
  const streamBufferRef = useRef('')
  const streamRafRef = useRef(null)

  const handleSendRef = useRef(null)
  const recognitionRef = useRef(null)
  const baseInputBeforeRecordingRef = useRef('')

  const handleScroll = useCallback(() => {
    const el = chatScrollContainerRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isFar = distanceToBottom > 150
    setShowScrollFAB(isFar)
    if (!isFar) {
      setUnreadCount(0)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    triggerHaptic('light')
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollFAB(false)
    setUnreadCount(0)
  }, [])

  const handleMsgTouchStart = useCallback((msg) => {
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic('medium')
      setContextMenuMsg(msg)
    }, 450)
  }, [])

  const handleMsgTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleMsgContextMenu = useCallback((e, msg) => {
    e.preventDefault()
    triggerHaptic('medium')
    setContextMenuMsg(msg)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (textureDropdownRef.current && !textureDropdownRef.current.contains(event.target)) {
        setShowTexturePicker(false)
      }
    }
    if (showTexturePicker) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }
    return undefined
  }, [showTexturePicker])

  // Lifecycle retention: prune db.chatMessages older than 90 days and rehydrate on mount
  useEffect(() => {
    let isMounted = true
    const initChatMessages = async () => {
      try {
        if (db.chatMessages) {
          const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
          await db.chatMessages.where('timestamp').below(ninetyDaysAgo).delete()

          if (useChatStore.getState().messages.length === 0) {
            const stored = await db.chatMessages.orderBy('timestamp').toArray()
            if (isMounted && stored.length > 0) {
              setMessages(stored)
              return
            }
          }
        }
      } catch (err) {
        console.error('Failed to init chat messages from DB:', err)
      }

      if (isMounted && useChatStore.getState().messages.length === 0) {
        setMessages([
          {
            id: Date.now(),
            timestamp: Date.now(),
            role: 'ai',
            type: 'welcome',
            content: translate(locale, 'aiChat.welcome') || 'Halo! Saya asisten AI keuangan Anda. Ada yang bisa saya bantu catat atau analisis hari ini?',
          },
        ])
      }
    }
    initChatMessages()
    return () => {
      isMounted = false
    }
  }, [locale, setMessages])

  // Persist messages to db.chatMessages when not streaming
  useEffect(() => {
    if (isStreamingRef.current || isLoading) return
    if (!messages || messages.length === 0) return

    const persistTimeout = setTimeout(async () => {
      try {
        if (!db.chatMessages) return
        const toSave = messages.map((m) => ({
          ...m,
          timestamp: m.timestamp || m.id || Date.now(),
        }))
        await db.transaction('rw', db.chatMessages, async () => {
          await db.chatMessages.clear()
          await db.chatMessages.bulkAdd(toSave)
        })
      } catch (err) {
        console.warn('Failed to persist chat messages to DB:', err)
      }
    }, 400)

    return () => clearTimeout(persistTimeout)
  }, [messages, isLoading])

  useEffect(() => {
    if (initialInput) {
      const promptToSend = initialInput
      setInitialInput('')
      setInputValue(promptToSend)
      const timer = setTimeout(() => {
        if (handleSendRef.current) {
          handleSendRef.current(promptToSend)
        }
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [initialInput, setInitialInput])

  useEffect(() => {
    const el = chatScrollContainerRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNear = distanceToBottom < 150

    if (isStreamingRef.current) {
      if (isNear) {
        el.scrollTop = el.scrollHeight
      }
    } else {
      if (isNear) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else {
        setUnreadCount((c) => c + 1)
      }
    }
  }, [messages, isLoading])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (window.history.length > 1) navigate(-1)
        else navigate('/dashboard')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setSelectedImage(ev.target.result)
        setShowScanModePicker(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
    }
    setIsRecording(false)
  }

  const handleCancelRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'ai',
          content: locale === 'en' ? 'Voice input is not supported on this device.' : 'Perangkat Anda belum mendukung input suara.',
        },
      ])
      return
    }

    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (micErr) {
        if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'ai',
              content:
                locale === 'en'
                  ? 'Microphone permission was denied. Please allow microphone access in device settings.'
                  : 'Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan.',
            },
          ])
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
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'ai',
              content:
                locale === 'en'
                  ? 'Microphone permission was denied. Please allow microphone access in device settings.'
                  : 'Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan.',
            },
          ])
        } else if (event?.error === 'audio-capture') {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'ai',
              content:
                locale === 'en'
                  ? 'Microphone is unavailable or in use by another app.'
                  : 'Mikrofon tidak tersedia atau sedang digunakan oleh aplikasi lain.',
            },
          ])
        }
      }
      recognition.onend = () => setIsRecording(false)
      recognition.start()
    } catch {
      setIsRecording(false)
    }
  }

  const handleSend = async (text = inputValue, image = selectedImage, scanMode = 'all', targetWalletId = null) => {
    if (!text?.trim() && !image) return
    triggerHaptic('light')
    
    const clampedText = text ? String(text).slice(0, 4000) : ''

    const userMsg = {
      id: Date.now(),
      role: 'user',
      type: 'text',
      content: clampedText,
      image: image
    }
    
    setInputValue('')
    setSelectedImage(null)
    setShowScanModePicker(false)
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setIsLoading(true)

    const aiMsgId = Date.now() + 1
    setMessages(prev => [...prev, userMsg])

    isStreamingRef.current = true
    streamBufferRef.current = ''

    try {
      const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
      const result = await parseTransactionFromText(clampedText || "Lihat gambar struk ini", {
        locale,
        defaultCurrency,
        previousMessages: messages,
        imageData: image,
        wallets,
        rates: activeRates,
        scanMode,
        onStream: (chunk) => {
          streamBufferRef.current += chunk
          if (!streamRafRef.current) {
            streamRafRef.current = requestAnimationFrame(() => {
              streamRafRef.current = null
              const currentBuffered = streamBufferRef.current
              setMessages(prev => {
                const exists = prev.some(m => m.id === aiMsgId)
                if (exists) {
                  return prev.map(m => m.id === aiMsgId ? { ...m, content: currentBuffered } : m)
                }
                return [...prev, { id: aiMsgId, role: 'ai', type: 'text', content: currentBuffered }]
              })
              if (chatScrollContainerRef.current) {
                chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight
              }
            })
          }
        }
      })

      if (result.error) {
        throw new Error(result.message)
      }

      const newMsgs = []



      if (result.type === 'transactions') {
        if (result.action === 'create' && result.transactions?.length > 0) {
          let transactionsToProcess = distributeReceiptTransactions(result.transactions, result, scanMode)
          const savedTxs = []
          for (const tx of transactionsToProcess) {
              const numericAmount = Number(tx.amount || 0)
              if (!Number.isFinite(numericAmount) || numericAmount <= 0) continue

              const configuredDefaultWalletId = useSettingsStore.getState().defaultWalletId
              const primaryDefaultWalletId = wallets.find((w) => w.id === configuredDefaultWalletId)?.id || (wallets.length > 0 ? wallets[0].id : null)
              let finalWalletId = targetWalletId || (tx.walletId ? Number(tx.walletId) : primaryDefaultWalletId)
              if (finalWalletId !== null && !wallets.find(w => w.id === finalWalletId)) {
                 finalWalletId = primaryDefaultWalletId
              }
             const matchedWallet = wallets.find(w => w.id === finalWalletId)
             const txCurrency = tx.currency || matchedWallet?.currency || defaultCurrency
             
             const txEngine = tx.engine || result.engine || (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_nlp' : 'online_ai')
             const txEngineLabel = tx.engineLabel || result.engineLabel || (txEngine === 'offline_nlp' ? 'NLP Lokal (Offline)' : 'AI Gemini (Online)')

             const txToSave = {
               ...tx,
               merchant: tx.merchant || result.merchant || undefined,
               engine: txEngine,
               engineLabel: txEngineLabel,
               amount: numericAmount,
               date: tx.date || format(new Date(), 'yyyy-MM-dd'),
               category: sanitizeCategoryPath(tx.category, tx.type),
               walletId: finalWalletId,
               currency: txCurrency,
               createdAt: Date.now()
             }
             
             if (tx.type === 'transfer' && tx.targetWalletId) {
                let twId = Number(tx.targetWalletId)
                if (wallets.find(w => w.id === twId)) txToSave.targetWalletId = twId
             }
             
             const newTxId = await addTransaction(txToSave)
             txToSave.id = newTxId
             savedTxs.push(txToSave)
          }
          if (savedTxs.length > 0) {
            triggerHaptic('success')
            newMsgs.push({ id: Date.now() + 2, role: 'ai', type: 'success', data: savedTxs })
          } else {
            newMsgs.push({
              id: Date.now() + 2,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? 'No valid transactions to record (amount must be greater than 0).'
                : 'Tidak ada transaksi valid untuk dicatat (nominal harus lebih dari 0).'
            })
          }
        }
        
        if (result.action === 'update' || result.action === 'delete') {
          const allFreshTxs = await db.transactions.toArray()
          allFreshTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0))

          const matchedTx = findMatchingTransactionForAction(allFreshTxs, result)
          const sq = result.searchQuery ? result.searchQuery.toLowerCase().trim() : ''

          if (!matchedTx) {
            const isVagueDelete = result.action === 'delete' && !result.transactionId && !sq
            const vagueMsg = locale === 'en'
              ? 'Please specify which transaction you would like to delete (for example: "delete transaction coffee 30k" or "delete latest transaction").'
              : 'Mohon sebutkan transaksi mana yang ingin Anda hapus (contoh: "hapus transaksi kopi 30rb" atau "hapus transaksi terakhir").'
            const notFoundMsg = locale === 'en'
              ? 'Sorry, the requested transaction was not found in your history.'
              : 'Maaf, transaksi yang dimaksud tidak ditemukan di riwayat Anda.'

            newMsgs.push({
              id: Date.now() + 3,
              role: 'ai',
              type: 'text',
              content: isVagueDelete ? vagueMsg : notFoundMsg,
            })
          } else {
            if (result.action === 'update') {
              const updatedPayload = { ...result.updatedFields }
              if (updatedPayload.amount !== undefined) {
                updatedPayload.amount = Number(updatedPayload.amount)
              }
              if (updatedPayload.walletId !== undefined) {
                updatedPayload.walletId = updatedPayload.walletId ? Number(updatedPayload.walletId) : undefined
              }
              if (updatedPayload.targetWalletId !== undefined) {
                updatedPayload.targetWalletId = updatedPayload.targetWalletId ? Number(updatedPayload.targetWalletId) : undefined
              }
              if (updatedPayload.category) {
                updatedPayload.category = sanitizeCategoryPath(updatedPayload.category, matchedTx.type || 'expense')
              }

              await updateTransaction(matchedTx.id, updatedPayload)
              const updatedTx = { ...matchedTx, ...updatedPayload }
              newMsgs.push({
                id: Date.now() + 3,
                role: 'ai',
                type: 'success',
                data: updatedTx,
                customMsg: locale === 'en' ? 'Transaction updated successfully' : 'Transaksi berhasil diperbarui',
              })
            } else {
              newMsgs.push({
                id: Date.now() + 3,
                role: 'ai',
                type: 'delete_confirm',
                data: {
                  id: matchedTx.id,
                  amount: matchedTx.amount,
                  category: matchedTx.category,
                  date: matchedTx.date,
                  notes: matchedTx.notes,
                  type: matchedTx.type,
                  currency: matchedTx.currency || defaultCurrency,
                },
                content: locale === 'en'
                  ? 'Are you sure you want to delete this transaction?'
                  : 'Apakah Anda yakin ingin menghapus transaksi ini?',
              })
            }
          }
        }
      }
      
      if (result.type === 'habit') {
        const habits = await db.habits.toArray()
        const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())
        
        if (result.action === 'create') {
          const newHabit = {
            title: result.title,
            color: result.color || 'indigo',
            category: 'Lainnya',
            frequencyType: result.frequencyType || 'daily',
            frequencyValue: null,
            reminderEnabled: !!result.reminderTime,
            reminderTime: result.reminderTime || null,
            createdAt: Date.now()
          }
          const newHabitId = await db.habits.add(newHabit)
          newMsgs.push({
            id: Date.now()+3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'habit',
              action: 'create',
              title: result.title,
              data: {
                id: newHabitId,
                title: result.title,
                color: result.color || 'indigo',
                frequencyType: result.frequencyType || 'daily'
              }
            }
          })
        } else if (result.action === 'log') {
          const matched = habits.find(h => fuzzyMatch(h.title, result.title))
          if (matched) {
            const todayStr = format(new Date(), 'yyyy-MM-dd')
            const existingLog = await db.habitLogs.where({ habitId: matched.id, date: todayStr }).first()
            if (!existingLog) {
              await db.habitLogs.add({ habitId: matched.id, date: todayStr })
            }
            newMsgs.push({
              id: Date.now()+3,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'habit',
                action: 'log',
                title: matched.title,
                data: {
                  id: matched.id,
                  title: matched.title,
                  color: matched.color || 'indigo',
                  frequencyType: matched.frequencyType || 'daily'
                }
              }
            })
          } else {
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: `Habit yang mirip dengan "${result.title}" tidak ditemukan di daftar Anda.` })
          }
        } else if (result.action === 'log_all') {
          const todayStr = format(new Date(), 'yyyy-MM-dd')
          let count = 0
          for (const h of habits) {
            const existingLog = await db.habitLogs.where({ habitId: h.id, date: todayStr }).first()
            if (!existingLog) {
              await db.habitLogs.add({ habitId: h.id, date: todayStr })
              count++
            }
          }
          if (count > 0) {
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'habit', action: 'log_all', subtitle: `${count} habit berhasil dicentang` } })
          } else {
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: "Semua habit sudah dicentang sebelumnya hari ini! Luar biasa!" })
          }
        }
      }

      if (result.type === 'savings') {
        const goals = await db.goals.toArray()
        const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())
        
        if (result.action === 'create') {
          const targetAmt = Number(result.amount) || 0
          const goalCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
            ? result.currency.trim().toUpperCase()
            : defaultCurrency
          await db.goals.add({
            name: result.name,
            targetAmount: targetAmt,
            currentAmount: 0,
            deadline: null,
            currency: goalCurrency
          })
          newMsgs.push({
            id: Date.now()+3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'savings',
              action: 'create',
              title: result.name,
              data: {
                title: result.name,
                targetAmount: targetAmt,
                currentAmount: 0,
                currency: goalCurrency
              }
            }
          })
        } else if (result.action === 'add_funds') {
          const matched = goals.find(g => fuzzyMatch(g.name, result.name))
          if (matched) {
            const depositAmt = Number(result.amount) || 0
            if (depositAmt <= 0) {
              newMsgs.push({
                id: Date.now() + 3,
                role: 'ai',
                type: 'text',
                content: locale === 'en'
                  ? 'Deposit amount must be greater than 0.'
                  : 'Nominal setoran tabungan harus lebih dari 0.',
              })
            } else {
              // Resolve funding wallet (specified wallet, default wallet from settings, cash wallet, or first active wallet)
              const activeWallets = (wallets || []).filter(w => !w.isArchived)
              let chosenWallet = null
              if (result.walletId) {
                chosenWallet = activeWallets.find(w => w.id === Number(result.walletId)) || null
              }
              if (!chosenWallet && defaultWalletId) {
                chosenWallet = activeWallets.find(w => w.id === Number(defaultWalletId)) || null
              }
              if (!chosenWallet) {
                chosenWallet = activeWallets.find(w => w.institutionType === 'cash') || activeWallets[0] || null
              }

              if (!chosenWallet) {
                newMsgs.push({
                  id: Date.now() + 3,
                  role: 'ai',
                  type: 'text',
                  content: locale === 'en'
                    ? 'Cannot deposit to savings: no active wallet found to debit funds from. Please create a wallet first.'
                    : 'Gagal menyetor ke tabungan: tidak ditemukan dompet aktif untuk memotong saldo. Silakan buat dompet terlebih dahulu.',
                })
              } else {
                const walletIdNum = Number(chosenWallet.id)
                const inputCurrency = result.currency || matched.currency || chosenWallet?.currency || defaultCurrency
                const goalCurrency = matched.currency || defaultCurrency
                const walletCurrency = chosenWallet?.currency || defaultCurrency
                const rates = getCachedCurrencyRates('USD')
                const depositAmtInGoalCurrency = convertCurrency(depositAmt, inputCurrency, goalCurrency, rates)
                const depositAmtInWalletCurrency = convertCurrency(depositAmt, inputCurrency, walletCurrency, rates)
                const newCurrent = (matched.currentAmount || 0) + depositAmtInGoalCurrency
                const logDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

                await db.transaction('rw', [db.transactions, db.goals, db.goalLogs], async () => {
                  const createdTxId = await db.transactions.add({
                    date: getLocalDateString(),
                    amount: depositAmtInWalletCurrency,
                    type: 'expense',
                    category: 'tabungan',
                    notes: `Setor ke Tabungan: ${matched.name}`,
                    currency: walletCurrency,
                    walletId: walletIdNum,
                    goalId: matched.id,
                    createdAt: Date.now(),
                    isExcludeFromAnalytics: true,
                    excludeFromAnalytics: true,
                  })

                  await db.goals.update(matched.id, { currentAmount: newCurrent })
                  await db.goalLogs.add({
                    goalId: matched.id,
                    amount: depositAmtInGoalCurrency,
                    notes: 'Dicatat oleh AI',
                    date: logDate,
                    walletName: chosenWallet?.name || null,
                    transactionId: createdTxId || null,
                  })
                })
                await invalidateWalletBalance([walletIdNum])
                triggerHaptic('success')

                const walletSubtitle = locale === 'en'
                  ? `Deducted from ${chosenWallet.name}`
                  : `Dipotong dari dompet ${chosenWallet.name}`

                newMsgs.push({
                  id: Date.now() + 3,
                  role: 'ai',
                  type: 'action_success',
                  data: {
                    type: 'savings',
                    action: 'add',
                    title: matched.name,
                    subtitle: walletSubtitle,
                    data: {
                      title: matched.name,
                      targetAmount: matched.targetAmount,
                      currentAmount: newCurrent,
                      currency: matched.currency || defaultCurrency,
                      walletName: chosenWallet?.name,
                    }
                  }
                })
              }
            }
          } else {
            newMsgs.push({
              id: Date.now() + 3,
              role: 'ai',
              type: 'text',
              content: locale === 'en'
                ? `Savings goal matching "${result.name || ''}" not found.`
                : `Tabungan yang mirip dengan "${result.name || ''}" tidak ditemukan.`
            })
          }
        } else if (result.action === 'withdraw') {
          const matched = goals.find(g => fuzzyMatch(g.name, result.name))
          if (matched) {
            const withdrawAmt = Number(result.amount) || 0
            const currentSavings = Number(matched.currentAmount) || 0
            if (withdrawAmt <= 0) {
              newMsgs.push({
                id: Date.now() + 3,
                role: 'ai',
                type: 'text',
                content: locale === 'en'
                  ? 'Withdrawal amount must be greater than 0.'
                  : 'Nominal pencairan tabungan harus lebih dari 0.',
              })
            } else if (withdrawAmt > currentSavings) {
              newMsgs.push({
                id: Date.now() + 3,
                role: 'ai',
                type: 'text',
                content: locale === 'en'
                  ? `Insufficient savings in "${matched.name}". Current balance is ${formatCurrency(currentSavings, matched.currency || defaultCurrency)}.`
                  : `Saldo tabungan "${matched.name}" tidak mencukupi. Saldo saat ini adalah ${formatCurrency(currentSavings, matched.currency || defaultCurrency)}.`,
              })
            } else {
              const activeWallets = (wallets || []).filter(w => !w.isArchived)
              let chosenWallet = null
              if (result.walletId) {
                chosenWallet = activeWallets.find(w => w.id === Number(result.walletId)) || null
              }
              if (!chosenWallet && defaultWalletId) {
                chosenWallet = activeWallets.find(w => w.id === Number(defaultWalletId)) || null
              }
              if (!chosenWallet) {
                chosenWallet = activeWallets.find(w => w.institutionType === 'cash') || activeWallets[0] || null
              }

              if (!chosenWallet) {
                newMsgs.push({
                  id: Date.now() + 3,
                  role: 'ai',
                  type: 'text',
                  content: locale === 'en'
                    ? 'Cannot withdraw savings: no active destination wallet found. Please create a wallet first.'
                    : 'Gagal mencairkan tabungan: tidak ditemukan dompet tujuan aktif. Silakan buat dompet terlebih dahulu.',
                })
              } else {
                const walletIdNum = Number(chosenWallet.id)
                const inputCurrency = result.currency || matched.currency || chosenWallet?.currency || defaultCurrency
                const goalCurrency = matched.currency || defaultCurrency
                const walletCurrency = chosenWallet?.currency || defaultCurrency
                const rates = getCachedCurrencyRates('USD')
                const withdrawAmtInGoalCurrency = convertCurrency(withdrawAmt, inputCurrency, goalCurrency, rates)
                const withdrawAmtInWalletCurrency = convertCurrency(withdrawAmt, inputCurrency, walletCurrency, rates)
                const newCurrent = Math.max(0, currentSavings - withdrawAmtInGoalCurrency)
                const logDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

                await db.transaction('rw', [db.transactions, db.goals, db.goalLogs], async () => {
                  const createdTxId = await db.transactions.add({
                    date: getLocalDateString(),
                    amount: withdrawAmtInWalletCurrency,
                    type: 'income',
                    category: 'cairkan_tabungan',
                    notes: `Pencairan Tabungan: ${matched.name}`,
                    currency: walletCurrency,
                    walletId: walletIdNum,
                    goalId: matched.id,
                    createdAt: Date.now(),
                    isExcludeFromAnalytics: true,
                    excludeFromAnalytics: true,
                  })

                  const targetAmt = Number(matched.targetAmount) || 0
                  await db.goals.update(matched.id, {
                    currentAmount: newCurrent,
                    isCompleted: targetAmt > 0 ? newCurrent >= targetAmt : false,
                  })
                  await db.goalLogs.add({
                    goalId: matched.id,
                    amount: -withdrawAmtInGoalCurrency,
                    notes: 'Dicatat oleh AI',
                    date: logDate,
                    walletName: chosenWallet?.name || null,
                    transactionId: createdTxId || null,
                  })
                })
                await invalidateWalletBalance([walletIdNum])
                triggerHaptic('success')

                const walletSubtitle = locale === 'en'
                  ? `Deposited to ${chosenWallet.name}`
                  : `Masuk ke dompet ${chosenWallet.name}`

                newMsgs.push({
                  id: Date.now() + 3,
                  role: 'ai',
                  type: 'action_success',
                  data: {
                    type: 'savings',
                    action: 'withdraw',
                    title: matched.name,
                    subtitle: walletSubtitle,
                    data: {
                      title: matched.name,
                      targetAmount: matched.targetAmount,
                      currentAmount: newCurrent,
                      currency: matched.currency || defaultCurrency,
                      walletName: chosenWallet?.name,
                    }
                  }
                })
              }
            }
          } else {
            newMsgs.push({
              id: Date.now() + 3,
              role: 'ai',
              type: 'text',
              content: locale === 'en'
                ? `Savings goal matching "${result.name || ''}" not found.`
                : `Tabungan yang mirip dengan "${result.name || ''}" tidak ditemukan.`
            })
          }
        }
      }

      if (result.type === 'todo') {
        const todos = await db.todos.toArray()
        const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())
        
        if (result.action === 'create') {
          const validCategories = ['tagihan', 'investasi', 'belanja', 'tabungan', 'pekerjaan', 'pribadi', 'kesehatan', 'pendidikan', 'rumah', 'transportasi', 'lainnya']
          const aiCategory = result.category && validCategories.includes(result.category) ? result.category : 'lainnya'
          const todoId = await db.todos.add({
            title: result.title,
            description: result.description || '',
            category: aiCategory,
            dueDate: result.dueDate || format(new Date(), 'yyyy-MM-dd'),
            priority: result.priority || 'medium',
            completed: false,
            reminderTime: result.reminderTime || null,
            createdAt: Date.now()
          })
          
          if (result.subTasks && Array.isArray(result.subTasks) && result.subTasks.length > 0) {
            const subTasksToInsert = result.subTasks.map(label => ({
              todoId,
              label,
              checked: false
            }))
            await db.sub_tasks.bulkAdd(subTasksToInsert)
          }
          
          newMsgs.push({
            id: Date.now()+3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'todo',
              action: 'create',
              title: result.title,
              data: {
                id: todoId,
                title: result.title,
                category: aiCategory,
                dueDate: result.dueDate || format(new Date(), 'yyyy-MM-dd'),
                priority: result.priority || 'medium',
                subTasks: result.subTasks || []
              }
            }
          })
        } else if (result.action === 'complete') {
          const matched = todos.find(t => !t.completed && fuzzyMatch(t.title, result.title))
          if (matched) {
            await db.todos.update(matched.id, { completed: true })
            newMsgs.push({
              id: Date.now()+3,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'todo',
                action: 'done',
                title: matched.title,
                data: {
                  id: matched.id,
                  title: matched.title,
                  category: matched.category,
                  dueDate: matched.dueDate,
                  priority: matched.priority
                }
              }
            })
          } else {
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: `Tugas aktif yang mirip dengan "${result.title}" tidak ditemukan.` })
          }
        }
      }

      if (result.type === 'budget') {
        const budgets = await db.budgets.toArray()
        const allTxs = await db.transactions.toArray()
        const fuzzyMatch = (str, query) => str?.toLowerCase().includes((query || '').toLowerCase())
        const budgetCycleStartDay = useSettingsStore.getState().budgetCycleStartDay || 1
        const currentMonthKey = getCurrentBudgetMonthKey(new Date(), budgetCycleStartDay)
        const period = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)
        const monthExpenseTxs = allTxs.filter((tx) => (tx.date || '') >= period.startDate && (tx.date || '') <= period.endDate)
        const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
        
        const rawCategory = (result.category || '').trim()
        const isAllCategory = !rawCategory || rawCategory.toLowerCase() === 'semua' || rawCategory.toLowerCase() === 'all'

        // Check if rawCategory matches a parent category
        const expenseTree = getMergedExpenseTree()
        const cleanRawCat = rawCategory.toLowerCase().replace(/[_-\s]+/g, ' ')
        const matchedParent = !isAllCategory ? expenseTree.find((p) => {
          const pId = p.id.toLowerCase().replace(/[_-\s]+/g, ' ')
          const pNameId = (p.names?.id || '').toLowerCase().replace(/[_-\s]+/g, ' ')
          const pNameEn = (p.names?.en || '').toLowerCase().replace(/[_-\s]+/g, ' ')
          return pId === cleanRawCat || pNameId === cleanRawCat || pNameEn === cleanRawCat
        }) : null

        const budgetCatKey = isAllCategory ? 'all' : (matchedParent ? matchedParent.id : sanitizeCategoryPath(rawCategory, 'expense'))
        const displayTitle = isAllCategory ? 'Semua' : (matchedParent ? (matchedParent.names?.[locale === 'en' ? 'en' : 'id'] || matchedParent.id) : rawCategory)
        const isBudgetCategoryMatch = (bCat) => {
          if (isAllCategory) {
            const bLower = (bCat || '').toLowerCase()
            return bLower === 'all' || bLower === 'semua'
          }
          const bLower = (bCat || '').toLowerCase()
          return bLower === budgetCatKey.toLowerCase() || fuzzyMatch(bCat, budgetCatKey) || fuzzyMatch(bCat, rawCategory)
        }

        const matched = budgets.find(b => b.month === currentMonthKey && isBudgetCategoryMatch(b.category))
        const effectiveCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
          ? result.currency.trim().toUpperCase()
          : (matched?.currency || defaultCurrency)
        const spentThisMonth = calculateBudgetSpent(budgetCatKey, monthExpenseTxs, effectiveCurrency, activeRates)

        if (result.action === 'status') {
          const foundLimit = matched ? Number(matched.limit) : (Number(result.limit) || 0)
          newMsgs.push({
            id: Date.now()+3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'budget',
              action: 'status',
              title: displayTitle,
              data: {
                category: budgetCatKey,
                limit: foundLimit,
                spent: spentThisMonth,
                currency: effectiveCurrency
              }
            }
          })
        } else if (result.action === 'create' || result.action === 'update') {
          const numLimit = Number(result.limit) || 0
          if (matched) {
            await db.budgets.update(matched.id, {
              limit: numLimit,
              ...(result.currency ? { currency: effectiveCurrency } : {}),
            })
            newMsgs.push({
              id: Date.now()+3,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'budget',
                action: 'update',
                title: matched.category,
                data: {
                  category: matched.category,
                  limit: numLimit,
                  spent: spentThisMonth,
                  currency: matched.currency || effectiveCurrency
                }
              }
            })
          } else {
            await db.budgets.add({
              category: budgetCatKey,
              limit: numLimit,
              month: currentMonthKey,
              currency: effectiveCurrency
            })
            newMsgs.push({
              id: Date.now()+3,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'budget',
                action: 'create',
                title: displayTitle,
                data: {
                  category: budgetCatKey,
                  limit: numLimit,
                  spent: spentThisMonth,
                  currency: effectiveCurrency
                }
              }
            })
          }
        }
      }

      if (result.type === 'chart') {
         newMsgs.push({ 
           id: Date.now() + 5, 
           role: 'ai', 
           type: 'chart', 
           content: result.text || (result.chartType === 'income' ? 'Berikut adalah grafik rincian pemasukan Anda:' : 'Berikut adalah grafik rincian pengeluaran Anda:'),
           data: result.data, 
           chips: result.chips, 
           chartType: result.chartType 
         })
      }

      if (result.type === 'recurring') {
        const recurrings = await db.recurringTransactions.toArray()
        const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())
        
        if (result.action === 'create') {
          const recAmt = Number(result.amount) || 0
          const recCategory = sanitizeCategoryPath(result.category, 'expense') || 'kebutuhan_harian/umum'
          await db.recurringTransactions.add({
            title: result.title,
            type: 'expense',
            category: recCategory,
            amount: recAmt,
            currency: defaultCurrency,
            frequency: result.frequency || 'monthly',
            nextDate: format(new Date(), 'yyyy-MM-dd'),
            enabled: true
          })
          newMsgs.push({
            id: Date.now()+3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'recurring',
              action: 'create',
              title: result.title,
              data: {
                title: result.title,
                amount: recAmt,
                frequency: result.frequency || 'monthly',
                category: recCategory,
                currency: defaultCurrency
              }
            }
          })
        } else if (result.action === 'update' || result.action === 'delete') {
          const recTitle = (result.title || '').trim()
          if (!recTitle) {
            newMsgs.push({
              id: Date.now() + 3,
              role: 'ai',
              type: 'text',
              content: locale === 'en'
                ? `Please specify which recurring subscription you would like to ${result.action === 'delete' ? 'cancel' : 'update'}.`
                : `Mohon sebutkan langganan berulang mana yang ingin Anda ${result.action === 'delete' ? 'batalkan' : 'ubah'}.`,
            })
          } else {
            const matched = recurrings.find(r => fuzzyMatch(r.title, recTitle))
            if (matched) {
              if (result.action === 'update') {
                const updates = {}
                if (result.amount) updates.amount = Number(result.amount)
                if (result.frequency) updates.frequency = result.frequency
                if (result.category) updates.category = sanitizeCategoryPath(result.category, 'expense') || 'kebutuhan_harian/umum'
                await db.recurringTransactions.update(matched.id, updates)
                newMsgs.push({
                  id: Date.now()+3,
                  role: 'ai',
                  type: 'action_success',
                  data: {
                    type: 'recurring',
                    action: 'update',
                    title: matched.title,
                    data: {
                      title: matched.title,
                      amount: updates.amount ?? matched.amount,
                      frequency: updates.frequency ?? matched.frequency,
                      category: updates.category ?? matched.category,
                      currency: defaultCurrency
                    }
                  }
                })
              } else {
                newMsgs.push({
                  id: Date.now() + 3,
                  role: 'ai',
                  type: 'delete_confirm',
                  data: {
                    id: matched.id,
                    entityType: 'recurring',
                    title: matched.title,
                    notes: matched.title,
                    amount: matched.amount,
                    frequency: matched.frequency,
                    category: matched.category,
                    currency: defaultCurrency,
                  },
                  content: locale === 'en'
                    ? `Are you sure you want to cancel the recurring subscription "${matched.title}"?`
                    : `Apakah Anda yakin ingin membatalkan langganan berulang "${matched.title}"?`,
                })
              }
            } else {
              newMsgs.push({
                id: Date.now()+3,
                role: 'ai',
                type: 'text',
                content: locale === 'en'
                  ? `Recurring subscription "${result.title || ''}" not found.`
                  : `Maaf, langganan bernama "${result.title || ''}" tidak ditemukan.`
              })
            }
          }
        }
      }

      if (result.type === 'export') {
        const txs = await db.transactions.toArray()
        const filtered = result.month ? txs.filter(t => (t?.date || '').startsWith(result.month)) : txs
        
        if (filtered.length === 0) {
           newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: "Tidak ada data transaksi untuk diekspor." })
        } else {
          const headers = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan']
          const rows = filtered.map(t => [t.date, t.type, t.category, t.amount, t.notes || ''])
          const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          ].join('\n')
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Laporan-Keuangan-${result.month || 'Semua'}.csv`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          
          newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'export', action: 'create', title: 'Ekspor Berhasil', subtitle: `File CSV berhasil diunduh (${filtered.length} baris)` } })
        }
      }

      if (result.type === 'wallet') {
        if (result.action === 'create') {
          const walletName = result.name || 'Dompet Baru'
          const initialBal = result.initialBalance || 0
          const rawType = (result.walletType || 'bank').toLowerCase().replace('-', '')
          const wType = ['bank', 'ewallet', 'cash', 'credit_card', 'investment', 'other'].includes(rawType) ? rawType : 'bank'
          const walletCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
            ? result.currency.trim().toUpperCase()
            : defaultCurrency
          const createdId = await createWallet({
            name: walletName,
            institutionType: wType,
            currency: walletCurrency,
            balance: initialBal,
            logoUrl: null,
            createdAt: Date.now()
          })
          if (createdId) {
            await invalidateWalletBalance([createdId])
          }
          const balFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: walletCurrency, maximumFractionDigits: 0 }).format(initialBal)
          newMsgs.push({ 
            id: Date.now()+3, 
            role: 'ai', 
            type: 'action_success', 
            data: { type: 'wallet', action: 'create', title: walletName, subtitle: `Saldo awal: ${balFormatted}` } 
          })
        } else if (result.action === 'transfer') {
          const { isValid, fromWallet, toWallet, errorMessageKey } = validateTransferWallets(
            result.fromWalletId,
            result.toWalletId,
            wallets
          )

          if (!isValid) {
            newMsgs.push({
              id: Date.now() + 3,
              role: 'ai',
              type: 'text',
              isError: true,
              preserveContent: true,
              content: errorMessageKey === 'missing_wallets'
                ? (locale === 'en'
                    ? 'Transfer requires two different valid wallets. Please specify both source and destination wallets.'
                    : 'Transfer membutuhkan dua dompet yang berbeda dan valid. Mohon tentukan dompet asal dan dompet tujuan.')
                : (locale === 'en'
                    ? 'Source wallet and destination wallet cannot be the same.'
                    : 'Dompet asal dan dompet tujuan transfer tidak boleh sama.')
            })
          } else {
            const transferAmt = result.amount || 0
            const transferCurrency = fromWallet?.currency || defaultCurrency
            const targetCurrency = toWallet?.currency || transferCurrency
            const rates = getCachedCurrencyRates('USD')
            const targetAmount = convertCurrency(transferAmt, transferCurrency, targetCurrency, rates)
            const amtFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: transferCurrency, maximumFractionDigits: 0 }).format(transferAmt)
            
            const txToSave = {
              type: 'transfer',
              category: 'transfer/umum',
              amount: transferAmt,
              targetAmount: targetAmount,
              targetCurrency: targetCurrency,
              date: format(new Date(), 'yyyy-MM-dd'),
              notes: `Transfer AI: ${fromWallet ? fromWallet.name : 'Dompet Asal'} ke ${toWallet ? toWallet.name : 'Dompet Tujuan'}`,
              walletId: fromWallet ? fromWallet.id : null,
              targetWalletId: toWallet ? toWallet.id : null,
              currency: transferCurrency,
              createdAt: Date.now()
            }
            await addTransaction(txToSave)
            triggerHaptic('success')
            
            newMsgs.push({ 
              id: Date.now()+3, 
              role: 'ai', 
              type: 'action_success', 
              data: { 
                type: 'wallet', 
                action: 'transfer', 
                title: `Transfer ${amtFormatted}`, 
                subtitle: `${fromWallet ? fromWallet.name : 'Asal'} -> ${toWallet ? toWallet.name : 'Tujuan'}` 
              } 
            })
          }
        }
      }

      if (result.type === 'loan' || result.type === 'loans') {
        if (result.action === 'create') {
          let selectedWalletId = result.walletId ? Number(result.walletId) : null
          if (!selectedWalletId || !wallets.find((w) => w.id === selectedWalletId)) {
            const configuredDefaultWalletId = useSettingsStore.getState().defaultWalletId
            selectedWalletId = wallets.find((w) => w.id === configuredDefaultWalletId)?.id || (wallets.length > 0 ? wallets[0].id : null)
          }
          const matchedWallet = wallets.find((w) => w.id === selectedWalletId)
          const loanCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
            ? result.currency.trim().toUpperCase()
            : (matchedWallet?.currency || defaultCurrency)
          await addLoan({
            type: result.loanType || 'debt',
            personName: result.personName || 'Pihak Terkait',
            title: result.title || 'Pinjaman Baru',
            totalAmount: result.amount,
            dueDate: result.dueDate || null,
            walletId: selectedWalletId,
            currency: loanCurrency,
          })
          newMsgs.push({
            id: Date.now() + 4,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'loan',
              action: 'create',
              title: result.title || 'Pinjaman Baru',
              data: {
                title: result.title || 'Pinjaman Baru',
                personName: result.personName || 'Pihak Terkait',
                loanType: result.loanType || 'debt',
                amount: Number(result.amount) || 0,
                dueDate: result.dueDate || null,
                currency: loanCurrency
              }
            },
          })
        } else if (result.action === 'pay') {
          const allLoans = await db.loans.toArray()
          const { filterTerm, matched } = findMatchingLoanForAction(allLoans, result, { includePaid: false })
          if (!filterTerm) {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? 'Please specify the loan title or person name to record a payment.'
                : 'Mohon sebutkan judul pinjaman atau nama pihak terkait untuk mencatat pembayaran.',
            })
          } else if (matched) {
            const matchedActiveWallet = wallets.find((w) => !w.isArchived && w.id === (result.walletId ? Number(result.walletId) : matched.walletId))
            if (!matchedActiveWallet) {
              newMsgs.push({
                id: Date.now() + 4,
                role: 'ai',
                type: 'text',
                isError: true,
                content: locale === 'en'
                  ? 'Please specify or choose an active wallet to record the loan payment.'
                  : 'Mohon pilih atau sebutkan dompet aktif untuk mencatat pembayaran pinjaman.',
              })
            } else {
              const payWalletId = matchedActiveWallet.id
              await recordPayment(matched.id, result.amount, getLocalDateString(), 'Dicatat via AI Assistant', payWalletId, result.currency)
              newMsgs.push({
                id: Date.now() + 4,
                role: 'ai',
                type: 'action_success',
                data: {
                  type: 'loan',
                  action: 'pay',
                  title: matched.title,
                  data: {
                    title: matched.title,
                    personName: matched.personName,
                    loanType: matched.type,
                    amount: Number(result.amount) || 0,
                    dueDate: matched.dueDate,
                    currency: result.currency || matchedActiveWallet.currency || matched.currency || defaultCurrency
                  }
                },
              })
            }
          } else {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? `Active loan "${result.title || result.personName || ''}" not found or already paid off.`
                : `Catatan pinjaman aktif "${result.title || result.personName || ''}" tidak ditemukan atau sudah lunas.`,
            })
          }
        } else if (result.action === 'mark_paid') {
          const allLoans = await db.loans.toArray()
          const { filterTerm, matched } = findMatchingLoanForAction(allLoans, result, { includePaid: false })
          if (!filterTerm) {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? 'Please specify the loan title or person name to mark as paid.'
                : 'Mohon sebutkan judul pinjaman atau nama pihak terkait untuk menandai lunas.',
            })
          } else if (matched) {
            const matchedActiveWallet = wallets.find((w) => !w.isArchived && w.id === (result.walletId ? Number(result.walletId) : matched.walletId))
            if (!matchedActiveWallet) {
              newMsgs.push({
                id: Date.now() + 4,
                role: 'ai',
                type: 'text',
                isError: true,
                content: locale === 'en'
                  ? 'Please specify or choose an active wallet to settle the loan.'
                  : 'Mohon pilih atau sebutkan dompet aktif untuk melunasi pinjaman.',
              })
            } else {
              const payWalletId = matchedActiveWallet.id
              const remaining = Number(matched.remainingAmount) || 0
              if (remaining > 0) {
                await recordPayment(matched.id, remaining, getLocalDateString(), 'Pelunasan pinjaman via AI Assistant', payWalletId, matched.currency)
              } else {
                await updateLoan(matched.id, { status: 'paid', remainingAmount: 0 })
              }
              newMsgs.push({
                id: Date.now() + 4,
                role: 'ai',
                type: 'action_success',
                data: {
                  type: 'loan',
                  action: 'pay',
                  title: matched.title,
                  subtitle: 'Pinjaman berhasil dilunasi',
                  data: {
                    title: matched.title,
                    personName: matched.personName,
                    loanType: matched.type,
                    amount: remaining,
                    currency: matchedActiveWallet.currency || matched.currency || defaultCurrency,
                  },
                },
              })
            }
          } else {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? `Active loan "${result.title || result.personName || ''}" not found or already paid off.`
                : `Catatan pinjaman aktif "${result.title || result.personName || ''}" tidak ditemukan atau sudah lunas.`,
            })
          }
        } else if (result.action === 'delete') {
          const allLoans = await db.loans.toArray()
          const { filterTerm, matched } = findMatchingLoanForAction(allLoans, result, { includePaid: true })
          if (!filterTerm) {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? 'Please specify which loan record you would like to delete (for example: "delete loan Motor").'
                : 'Mohon sebutkan catatan pinjaman mana yang ingin Anda hapus (contoh: "hapus pinjaman Motor").',
            })
          } else if (matched) {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'delete_confirm',
              data: {
                id: matched.id,
                entityType: 'loan',
                title: matched.title,
                notes: matched.title,
                personName: matched.personName,
                amount: matched.remainingAmount ?? matched.totalAmount ?? matched.amount,
                currency: matched.currency || defaultCurrency,
                loanType: matched.type,
              },
              content: locale === 'en'
                ? `Are you sure you want to delete the loan "${matched.title}"?`
                : `Apakah Anda yakin ingin menghapus catatan pinjaman "${matched.title}"?`,
            })
          } else {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              isError: true,
              content: locale === 'en'
                ? `Loan "${result.title || result.personName || ''}" not found.`
                : `Catatan pinjaman "${result.title || result.personName || ''}" tidak ditemukan.`,
            })
          }
        } else if (result.action === 'query') {
          const allLoans = await db.loans.toArray()
          const activeLoans = allLoans.filter((l) => l.status !== 'paid' && !l.isArchived)
          const filterTitle = (result.title || result.personName || '').toLowerCase().trim()
          const matchedLoans = filterTitle
            ? activeLoans.filter((l) => (l.title || '').toLowerCase().includes(filterTitle) || (l.personName || '').toLowerCase().includes(filterTitle))
            : activeLoans

          const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
          let totalDebt = 0
          let totalReceivable = 0

          matchedLoans.forEach((l) => {
            const rem = Number(l.remainingAmount ?? l.totalAmount ?? l.amount) || 0
            const inDef = convertCurrency(rem, l.currency || defaultCurrency, defaultCurrency, activeRates)
            if (l.type === 'debt') {
              totalDebt += inDef
            } else {
              totalReceivable += inDef
            }
          })

          const formatMoney = (val, curr = defaultCurrency) => new Intl.NumberFormat(locale, { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val)

          let summaryText = ''
          if (matchedLoans.length === 0) {
            summaryText = locale === 'en'
              ? (filterTitle ? `No active loans found matching "${filterTitle}".` : 'You currently have no active debts or receivables.')
              : (filterTitle ? `Tidak ditemukan catatan pinjaman aktif untuk "${filterTitle}".` : 'Saat ini Anda tidak memiliki catatan utang maupun piutang aktif.')
          } else {
            const listLines = matchedLoans.map((l) => {
              const rem = Number(l.remainingAmount ?? l.totalAmount ?? l.amount) || 0
              const typeLabel = l.type === 'debt' ? (locale === 'en' ? 'Debt' : 'Utang') : (locale === 'en' ? 'Receivable' : 'Piutang')
              const personStr = l.personName ? ` (${l.personName})` : ''
              return `- [${typeLabel}] **${l.title}**${personStr}: ${formatMoney(rem, l.currency || defaultCurrency)}`
            }).join('\n')

            summaryText = locale === 'en'
              ? `### Loan Summary\n${listLines}\n\n- **Total Debt**: ${formatMoney(totalDebt)}\n- **Total Receivable**: ${formatMoney(totalReceivable)}`
              : `### Ringkasan Utang & Piutang\n${listLines}\n\n- **Total Utang**: ${formatMoney(totalDebt)}\n- **Total Piutang**: ${formatMoney(totalReceivable)}`
          }

          newMsgs.push({
            id: Date.now() + 4,
            role: 'ai',
            type: 'text',
            preserveContent: true,
            content: summaryText,
          })
        }
      }

      if (result.type === 'financial_health') {
        const healthMsg = {
          id: aiMsgId,
          role: 'ai',
          type: 'financial_health',
          score: result.score,
          rating: result.rating,
          metrics: result.metrics,
          content: result.text,
          chips: result.chips,
        }
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === aiMsgId)
          if (exists) {
            return prev.map((m) => (m.id === aiMsgId ? healthMsg : m))
          }
          return [...prev, healthMsg]
        })
        return
      }

      if (newMsgs.length > 0) {
         const unifiedMsg = prepareUnifiedMessage(newMsgs, result)
         setMessages(prev => {
            const exists = prev.some(m => m.id === aiMsgId)
            if (exists) {
               return prev.map(m => m.id === aiMsgId ? unifiedMsg : m)
            }
            return [...prev, unifiedMsg]
         })
      } else if (result.text) {
         setMessages(prev => {
            const exists = prev.some(m => m.id === aiMsgId)
            if (exists) {
               return prev.map(m => m.id === aiMsgId ? { ...m, content: result.text, chips: result.chips } : m)
            }
            return [...prev, { id: aiMsgId, role: 'ai', type: 'text', content: result.text, chips: result.chips }]
         })
      } else {
         setMessages(prev => prev.filter(m => m.id !== aiMsgId))
      }
    } catch (err) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
      const offlineMsg = locale === 'en'
        ? 'No internet connection. Please check your network connection and try again.'
        : 'Tidak ada koneksi internet. Silakan periksa jaringan Anda dan coba lagi.'
      const displayMsg = err?.message || (isOffline ? offlineMsg : translate(locale, 'aiChat.error'))
      setMessages(prev => {
         const filtered = prev.filter(m => m.id !== aiMsgId)
         return [...filtered, {
           id: Date.now() + 1,
           role: 'ai',
           type: 'text',
           content: displayMsg
         }]
      })
    } finally {
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current)
        streamRafRef.current = null
      }
      isStreamingRef.current = false
      setIsLoading(false)
      if (inputRef.current) inputRef.current.focus()
    }
  }

  const handleClear = () => {
    triggerHaptic('medium')
    setShowClearConfirm(false)
    if (db.chatMessages) {
      db.chatMessages.clear().catch(() => {})
    }
    setMessages([
      {
        id: Date.now(),
        role: 'ai',
        type: 'welcome',
        content:
          translate(locale, 'aiChat.welcome') ||
          'Halo! Aku asisten cerdas FinTrack kamu. Mau catat pengeluaran atau nanya-nanya soal uang? Langsung ketik santai aja di sini!',
      },
    ])
    window.dispatchEvent(
      new CustomEvent('ft-show-toast', {
        detail: {
          title: locale === 'en' ? 'Chat Cleared' : 'Percakapan Dibersihkan',
          message:
            locale === 'en'
              ? 'Conversation history has been reset.'
              : 'Riwayat percakapan telah diatur ulang.',
          type: 'info',
        },
      })
    )
  }

  const handleConfirmDelete = async (id, msgId, entityType = 'transaction') => {
    if (deletingMsgIdsRef.current.has(msgId)) return
    deletingMsgIdsRef.current.add(msgId)
    try {
      triggerHaptic('medium')
      if (entityType === 'loan') {
        await deleteLoan(id)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en' ? 'Loan record has been deleted.' : 'Catatan pinjaman telah berhasil dihapus.',
                  deleted: true,
                }
              : m,
          ),
        )
      } else if (entityType === 'recurring') {
        await db.recurringTransactions.delete(id)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en' ? 'Recurring subscription cancelled.' : 'Langganan berulang berhasil dibatalkan.',
                  deleted: true,
                }
              : m,
          ),
        )
      } else {
        await deleteTransaction(id)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  type: 'text',
                  content: locale === 'en' ? 'Transaction has been deleted.' : 'Transaksi telah berhasil dihapus.',
                  deleted: true,
                }
              : m,
          ),
        )
      }
      triggerHaptic('success')
    } catch (err) {
      triggerHaptic('warning')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                type: 'text',
                content: err.message || (locale === 'en' ? 'Failed to delete.' : 'Gagal menghapus.'),
              }
            : m,
        ),
      )
    } finally {
      deletingMsgIdsRef.current.delete(msgId)
    }
  }

  const handleCancelDelete = (msgId, entityType = 'transaction') => {
    triggerHaptic('light')
    const cancelMsg = entityType === 'loan'
      ? (locale === 'en' ? 'Loan deletion cancelled.' : 'Penghapusan pinjaman dibatalkan.')
      : entityType === 'recurring'
      ? (locale === 'en' ? 'Cancellation cancelled.' : 'Pembatalan langganan dibatalkan.')
      : (locale === 'en' ? 'Transaction deletion cancelled.' : 'Penghapusan transaksi dibatalkan.')
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              type: 'text',
              content: cancelMsg,
            }
          : m,
      ),
    )
  }

  handleSendRef.current = handleSend

  const bgTextureClass = useMemo(() => {
    switch (backgroundTexture) {
      case 'dots':
        return 'ft-chat-bg-dots'
      case 'grid':
        return 'ft-chat-bg-grid'
      case 'topo':
        return 'ft-chat-bg-topo'
      case 'clean':
        return 'ft-chat-bg-clean'
      case 'paper':
      default:
        return 'ft-chat-bg-paper'
    }
  }, [backgroundTexture])

  return (
    <div className={`fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden text-[var(--fg)] ft-page-enter ${bgTextureClass}`}>
      {/* ── Top Header ── */}
      <header className="shrink-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-strong)]/90 backdrop-blur-xl px-3 py-2.5 pt-[max(env(safe-area-inset-top,0px),0.75rem)] shadow-xs z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] active:scale-95 transition cursor-pointer"
            aria-label={translate(locale, 'common.back') || 'Kembali'}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
              <Sparkles size={16} strokeWidth={2.2} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} ring-2 ring-[var(--panel-strong)]`} />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-[var(--fg)] truncate">
                {translate(locale, 'aiChat.title') || 'AI Finance Advisor'}
              </h1>
              <p className="text-[10.5px] font-semibold text-[var(--muted)] truncate flex items-center gap-1">
                <span>{isOnline ? 'Gemini 3.8 Flash' : 'NLP Lokal'}</span>
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--muted-2)]" />
                <span className={isOnline ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                  {isOnline ? (locale === 'en' ? 'Online' : 'Aktif') : (locale === 'en' ? 'Offline' : 'Offline')}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Background Picker & Clear History */}
        <div className="flex items-center gap-1.5 shrink-0" ref={textureDropdownRef}>
          {/* Background Texture Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTexturePicker((prev) => !prev)}
              className={`grid h-8.5 w-8.5 place-items-center rounded-xl border transition active:scale-95 cursor-pointer ${
                showTexturePicker
                  ? 'bg-[var(--fg)] text-[var(--bg)] border-transparent'
                  : 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)]'
              }`}
              title={locale === 'en' ? 'Background Texture' : 'Tekstur Latar Belakang'}
              aria-label={locale === 'en' ? 'Background Texture' : 'Tekstur Latar Belakang'}
            >
              <Paintbrush size={15} strokeWidth={2.2} />
            </button>

            {showTexturePicker && (
              <div className="absolute right-0 top-10 z-50 w-52 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)]/95 backdrop-blur-xl p-2 shadow-xl animate-[ft-spring-dropdown_0.2s_ease-out_both]">
                <p className="px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  {locale === 'en' ? 'Background Texture' : 'Pilihan Latar Belakang'}
                </p>
                <div className="mt-1 space-y-1">
                  {BG_TEXTURE_OPTIONS.map((tex) => {
                    const isSelected = backgroundTexture === tex.id
                    return (
                      <button
                        key={tex.id}
                        type="button"
                        onClick={() => {
                          setBackgroundTexture(tex.id)
                          setShowTexturePicker(false)
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-[0.98] cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white shadow-2xs'
                            : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                        }`}
                      >
                        <span>{tex.defaultLabel}</span>
                        {isSelected && <Check size={14} strokeWidth={2.5} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clear Chat Button */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-rose-500 hover:border-rose-500/30 transition active:scale-95 cursor-pointer"
            title={locale === 'en' ? 'Clear History' : 'Hapus Percakapan'}
            aria-label={locale === 'en' ? 'Clear History' : 'Hapus Percakapan'}
          >
            <Trash2 size={15} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {/* ── Clear Confirmation Modal ── */}
      <ConfirmDeleteModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        title={locale === 'en' ? 'Clear Conversation?' : 'Hapus Percakapan?'}
        description={
          locale === 'en'
            ? 'All messages in this session will be cleared.'
            : 'Semua riwayat percakapan sesi ini akan dihapus dan diatur ulang ke pesan pembuka.'
        }
        confirmText={locale === 'en' ? 'Clear' : 'Hapus'}
        cancelText={locale === 'en' ? 'Cancel' : 'Batal'}
      />

      {/* ── Scan Mode Picker Modal ── */}
      {showScanModePicker && selectedImage && (
        <ReceiptScanModePicker
          image={selectedImage}
          wallets={wallets}
          locale={locale}
          onConfirm={(mode, walletId) => {
            triggerHaptic('light')
            setShowScanModePicker(false)
            handleSend(inputValue, selectedImage, mode, walletId)
          }}
          onCancel={() => {
            setShowScanModePicker(false)
            setSelectedImage(null)
          }}
          onChangeImage={() => {
            setShowMediaSourcePicker(true)
          }}
        />
      )}

      {/* ── Media Source Picker Modal (Camera vs Gallery) ── */}
      <MediaSourcePickerModal
        isOpen={showMediaSourcePicker}
        onClose={() => setShowMediaSourcePicker(false)}
        onSelectCamera={() => cameraInputRef.current?.click()}
        onSelectGallery={() => fileInputRef.current?.click()}
        locale={locale}
      />

      {/* ── Hidden File Inputs ── */}
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

      {/* ── Message List Container ── */}
      <main
        ref={chatScrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3.5 ft-hide-scrollbar"
      >
        {(() => {
          const visibleMessages = messages.filter((m) => m.type !== 'hidden')
          const isOnlyWelcome = visibleMessages.length <= 1 && (visibleMessages.length === 0 || visibleMessages[0]?.type === 'welcome')

          if (isOnlyWelcome && !isLoading) {
            return (
              <WelcomeHero
                onSelectPrompt={handleSend}
                todayExpense={todayExpense}
                todayCurrency={defaultCurrency}
              />
            )
          }

          const getMessagePosition = (all, i) => {
            const curr = all[i]
            const prev = all[i - 1]
            const next = all[i + 1]
            const isPrevSame = prev && prev.role === curr.role
            const isNextSame = next && next.role === curr.role
            if (!isPrevSame && !isNextSame) return 'single'
            if (!isPrevSame && isNextSame) return 'first'
            if (isPrevSame && isNextSame) return 'middle'
            if (isPrevSame && !isNextSame) return 'last'
            return 'single'
          }

          return visibleMessages.map((msg, index) => {
            const isLastAi = msg.role === 'ai' && msg.id === visibleMessages[visibleMessages.length - 1].id
            const isLatestMessage = index === visibleMessages.length - 1
            const position = getMessagePosition(visibleMessages, index)

            return (
              <div key={msg.id || index} className="flex flex-col gap-2 w-full min-w-0 max-w-full">
                {msg.role === 'user' && (
                  <div
                    className="flex flex-col items-end gap-1 w-full min-w-0 max-w-full cursor-pointer"
                    onTouchStart={() => handleMsgTouchStart(msg)}
                    onTouchEnd={handleMsgTouchEnd}
                    onContextMenu={(e) => handleMsgContextMenu(e, msg)}
                  >
                    {msg.image && <img src={msg.image} alt="Upload" className="max-w-[200px] rounded-2xl border border-[var(--border)] shadow-xs" />}
                    {msg.content && (
                      <UserBubble
                        content={msg.content}
                        timestamp={msg.timestamp}
                        status={isLoading && isLatestMessage ? 'sent' : 'confirmed'}
                      />
                    )}
                  </div>
                )}

                {(msg.role === 'ai' || msg.role === 'assistant') && (
                  <>
                    <div
                      className="w-full min-w-0 max-w-full cursor-pointer"
                      onTouchStart={() => handleMsgTouchStart(msg)}
                      onTouchEnd={handleMsgTouchEnd}
                      onContextMenu={(e) => handleMsgContextMenu(e, msg)}
                    >
                      <AiBubble
                        content={msg.content || (msg.type === 'welcome' ? translate(locale, 'aiChat.welcome') : '')}
                        timestamp={msg.timestamp}
                        position={position}
                        isNew={isLatestMessage}
                        isStreaming={isLoading && isLatestMessage}
                        expandableDetails={msg.expandableDetails || null}
                        embeddedWidget={
                          msg.type === 'carousel' && Array.isArray(msg.items) ? (
                            <CardCarousel>
                              {msg.items.map((item, idx) => (
                                <ActionSuccessCard
                                  key={idx}
                                  type={item.type}
                                  action={item.action}
                                  title={item.title}
                                  subtitle={item.subtitle}
                                  data={item.data || item}
                                  embedded={true}
                                />
                              ))}
                            </CardCarousel>
                          ) : msg.type === 'financial_health' ? (
                            <FinancialHealthWidget
                              score={msg.score}
                              rating={msg.rating}
                              savingsRate={msg.metrics?.savingsRatio}
                              expenseVelocity={msg.metrics?.monthlyIncome > 0 ? Math.round((msg.metrics?.monthlyExpense / msg.metrics?.monthlyIncome) * 100) : null}
                              debtRatio={msg.metrics?.dti}
                              budgetCompliance={msg.metrics?.emergencyMonths != null ? Math.min(100, Math.round(msg.metrics.emergencyMonths / 6 * 100)) : null}
                              onAction={handleSend}
                            />
                          ) : msg.type === 'chart' && msg.data ? (
                            <ChartBubble data={msg.data} chartType={msg.chartType} embedded={true} />
                          ) : msg.type === 'success' ? (
                            <TransactionSuccess
                              data={msg.data}
                              embedded={true}
                              onUndo={async () => {
                                try {
                                  if (Array.isArray(msg.data)) {
                                    await Promise.all(msg.data.map((tx) => deleteTransaction(tx.id)))
                                  } else if (msg.data?.id) {
                                    await deleteTransaction(msg.data.id)
                                  }
                                  setMessages((prev) => prev.filter((m) => m.id !== msg.id))
                                } catch (err) {
                                  console.error('Failed to undo transactions:', err)
                                }
                              }}
                              contextMsg={msg.customMsg || translate(locale, 'aiChat.more')}
                            />
                          ) : msg.type === 'action_success' && msg.data ? (
                            <ActionSuccessCard
                              type={msg.data.type}
                              action={msg.data.action}
                              title={msg.data.title}
                              subtitle={msg.data.subtitle}
                              data={msg.data.data || msg.data}
                              embedded={true}
                            />
                          ) : msg.type === 'delete_confirm' && msg.data ? (
                            <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-3">
                              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-[var(--fg)] truncate">
                                    {msg.data.title || msg.data.notes || msg.data.category || (locale === 'en' ? 'Item' : 'Data')}
                                  </p>
                                  <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                                    {msg.data.entityType === 'loan' ? (
                                      <span>{msg.data.loanType === 'debt' ? (locale === 'en' ? 'Debt' : 'Hutang') : (locale === 'en' ? 'Receivable' : 'Piutang')}{msg.data.personName ? ` • ${msg.data.personName}` : ''}</span>
                                    ) : msg.data.entityType === 'recurring' ? (
                                      <span>{msg.data.frequency || (locale === 'en' ? 'Recurring' : 'Berulang')}{msg.data.category ? ` • ${msg.data.category}` : ''}</span>
                                    ) : (
                                      <>
                                        <span>{msg.data.date}</span>
                                        {msg.data.category && <span>• {msg.data.category}</span>}
                                      </>
                                    )}
                                  </p>
                                </div>
                                {msg.data.amount != null && (
                                  <span className={`text-xs font-black shrink-0 ${msg.data.type === 'income' ? 'text-[var(--income)]' : 'text-[var(--expense)]'}`}>
                                    {formatCurrency(msg.data.amount, msg.data.currency)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleCancelDelete(msg.id, msg.data.entityType)}
                                  className="flex-1 py-2 px-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer text-center"
                                >
                                  {locale === 'en' ? 'Cancel' : 'Batal'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDelete(msg.data.id, msg.id, msg.data.entityType)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <Trash2 size={13} strokeWidth={2.2} />
                                  <span>{locale === 'en' ? 'Delete' : 'Hapus'}</span>
                                </button>
                              </div>
                            </div>
                          ) : null
                        }
                      />
                    </div>
                    {isLastAi && !isLoading && (
                      <QuickChips
                        chips={msg.type === 'welcome' ? null : msg.chips}
                        onSelect={handleSend}
                      />
                    )}
                  </>
                )}
              </div>
            )
          })
        })()}

        {isLoading && !messages.some((m) => m.id === (messages[messages.length - 1]?.id) && m.role === 'ai' && m.content) && (
          <ReasoningIndicator />
        )}

        <div ref={messagesEndRef} className="h-2" />
      </main>

      {/* Floating Scroll to Bottom FAB */}
      <ScrollToBottomFAB
        isVisible={showScrollFAB}
        unreadCount={unreadCount}
        onClick={scrollToBottom}
      />

      {/* ── Footer / Input Controls ── */}
      <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--panel-strong)]/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] pt-2 px-3 shadow-2xl z-20 space-y-2">
        {/* Voice Visualizer Overlay during recording */}
        {isRecording && (
          <div className="mb-2">
            <VoiceVisualizer
              isRecording={isRecording}
              onStop={handleStopRecording}
              onCancel={handleCancelRecording}
              locale={locale}
            />
          </div>
        )}

        {/* Text Input Bar */}
        <form
          className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1.5 shadow-xs focus-within:border-[var(--accent)] transition-colors"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          {/* Unified Camera / Gallery Media Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setShowMediaSourcePicker(true)
            }}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95 cursor-pointer ${
              selectedImage
                ? 'border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)]'
            }`}
            title={translate(locale, 'aiChat.media.title') || (locale === 'en' ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
            aria-label={translate(locale, 'aiChat.media.title') || (locale === 'en' ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
          >
            <Camera size={18} strokeWidth={2.2} />
          </button>

          {/* Mic button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95 cursor-pointer ${
              isRecording
                ? 'border border-rose-500 bg-rose-500/20 text-rose-500 shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)]'
            }`}
            title={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti merekam') : (locale === 'en' ? 'Voice Input' : 'Input Suara')}
            aria-label={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti merekam') : (locale === 'en' ? 'Voice Input' : 'Input Suara')}
          >
            <Mic size={18} strokeWidth={2.2} />
          </button>

          {/* Auto-growing Textarea */}
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={translate(locale, 'aiChat.placeholder') || (locale === 'en' ? 'Ask anything...' : 'Ketik apapun...')}
            className="flex-1 max-h-[120px] min-h-[36px] resize-none bg-transparent py-2 px-2 text-[13px] font-medium leading-snug text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading || (!inputValue.trim() && !selectedImage)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
              inputValue.trim() || selectedImage
                ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30 hover:opacity-90'
                : 'bg-[var(--panel-strong)] text-[var(--muted)] opacity-40 cursor-not-allowed'
            }`}
            title={translate(locale, 'common.send') || 'Kirim'}
            aria-label={translate(locale, 'common.send') || 'Kirim'}
          >
            {isLoading ? (
              <Sparkles size={16} className="animate-spin text-white" />
            ) : (
              <Send size={16} strokeWidth={2.2} />
            )}
          </button>
        </form>
      </footer>

      {/* ── Message Long-Press Context Menu ── */}
      <MessageContextMenu
        isOpen={Boolean(contextMenuMsg)}
        onClose={() => setContextMenuMsg(null)}
        messageContent={contextMenuMsg?.content || ''}
        messageType={contextMenuMsg?.role === 'user' ? 'user' : contextMenuMsg?.type === 'success' ? 'transaction' : 'ai'}
        onCopyText={(text) => {
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: locale === 'en' ? 'Copied' : 'Disalin',
                  message: locale === 'en' ? 'Text copied to clipboard' : 'Teks berhasil disalin ke papan klip',
                  type: 'info',
                },
              })
            )
          }
        }}
        onCopyAmount={(amt) => {
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(amt)
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: locale === 'en' ? 'Copied' : 'Disalin',
                  message: locale === 'en' ? 'Amount copied' : 'Nominal berhasil disalin',
                  type: 'info',
                },
              })
            )
          }
        }}
        onDeleteMessage={() => {
          if (contextMenuMsg) {
            setMessages((prev) => prev.filter((m) => m.id !== contextMenuMsg.id))
          }
        }}
      />
    </div>
  )
}
