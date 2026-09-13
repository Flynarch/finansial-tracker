import { useState, useRef, useEffect, useMemo } from 'react'
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
import { parseTransactionFromText } from '../lib/gemini'
import { sanitizeCategoryPath } from '../lib/categorySanitizer'
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
import { UserBubble, AiBubble, TypingIndicator, ChartBubble } from '../components/chat/ChatBubble'
import TransactionSuccess from '../components/chat/TransactionSuccess'
import ActionSuccessCard from '../components/chat/ActionSuccessCard'
import QuickChips from '../components/chat/QuickChips'
import ReceiptScanModePicker from '../components/chat/ReceiptScanModePicker'
import VoiceVisualizer from '../components/chat/VoiceVisualizer'
import MediaSourcePickerModal from '../components/chat/MediaSourcePickerModal'
import useChatStore from '../store/useChatStore'
import useBackButton from '../hooks/useBackButton'
import { triggerHaptic } from '../lib/haptics'
import { formatCurrency, FALLBACK_EXCHANGE_RATES } from '../lib/utils'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'

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
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || []

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
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const textureDropdownRef = useRef(null)
  const deletingMsgIdsRef = useRef(new Set())

  useBackButton(() => {
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

  useEffect(() => {
    return () => {
      if (streamRafRef.current) cancelAnimationFrame(streamRafRef.current)
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

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: Date.now(),
          role: 'ai',
          type: 'welcome',
          content: translate(locale, 'aiChat.welcome') || 'Halo! Saya asisten AI keuangan Anda. Ada yang bisa saya bantu catat atau analisis hari ini?',
        },
      ])
    }
  }, [messages.length, setMessages, locale])

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
    if (isStreamingRef.current) {
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const toggleRecording = () => {
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
          role: 'assistant',
          content: locale === 'en' ? 'Voice input is not supported on this device.' : 'Perangkat Anda belum mendukung input suara.',
        },
      ])
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
        if (event?.error === 'not-allowed') {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'assistant',
              content:
                locale === 'en'
                  ? 'Microphone permission was denied. Please allow microphone access in device settings.'
                  : 'Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan.',
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
    
    const userMsg = {
      id: Date.now(),
      role: 'user',
      type: 'text',
      content: text,
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
      const result = await parseTransactionFromText(text || "Lihat gambar struk ini", {
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
          const savedTxs = []
          for (const tx of result.transactions) {
             let finalWalletId = targetWalletId || (tx.walletId ? Number(tx.walletId) : (wallets.length > 0 ? wallets[0].id : null))
             if (finalWalletId !== null && !wallets.find(w => w.id === finalWalletId)) {
                finalWalletId = wallets.length > 0 ? wallets[0].id : null
             }
             const matchedWallet = wallets.find(w => w.id === finalWalletId)
             const txCurrency = matchedWallet?.currency || tx.currency || defaultCurrency
             
             const txToSave = {
               ...tx,
               amount: Math.abs(Number(tx.amount || 0)),
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
          newMsgs.push({ id: Date.now() + 2, role: 'ai', type: 'success', data: savedTxs })
        }
        
        if (result.action === 'update' || result.action === 'delete') {
          const allFreshTxs = await db.transactions.toArray()
          allFreshTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0))

          let matchedTx = null
          if (result.transactionId) {
            matchedTx = allFreshTxs.find((t) => t.id === Number(result.transactionId))
          }

          const sq = result.searchQuery ? result.searchQuery.toLowerCase().trim() : ''
          if (!matchedTx && sq) {
            if (sq === 'terakhir' || sq === 'latest' || sq === 'tadi' || sq === 'barusan') {
              matchedTx = allFreshTxs[0]
            } else {
              matchedTx = allFreshTxs.find((t) =>
                (t.notes && t.notes.toLowerCase().includes(sq)) ||
                (t.category && t.category.toLowerCase().includes(sq)) ||
                (result.date && t.date === result.date)
              )
            }
          }

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
          await db.goals.add({
            name: result.name,
            targetAmount: targetAmt,
            currentAmount: 0,
            deadline: null,
            currency: defaultCurrency
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
                currency: defaultCurrency
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
                const newCurrent = (matched.currentAmount || 0) + depositAmt

                const createdTxId = await db.transactions.add({
                  date: getLocalDateString(),
                  amount: depositAmt,
                  type: 'expense',
                  category: 'tabungan',
                  notes: `Setor ke Tabungan: ${matched.name}`,
                  currency: matched.currency || chosenWallet?.currency || defaultCurrency,
                  walletId: walletIdNum,
                  goalId: matched.id,
                  createdAt: Date.now(),
                  isExcludeFromAnalytics: true,
                  excludeFromAnalytics: true,
                })
                void invalidateWalletBalance([walletIdNum])

                await db.goals.update(matched.id, { currentAmount: newCurrent })
                await db.goalLogs.add({
                  goalId: matched.id,
                  amount: depositAmt,
                  notes: 'Dicatat oleh AI',
                  date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
                  walletName: chosenWallet?.name || null,
                  transactionId: createdTxId || null,
                })

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
        const monthStr = format(new Date(), 'yyyy-MM')
        
        const catTarget = result.category || 'Semua'
        const spentThisMonth = allTxs
          .filter(tx => tx.type === 'expense' && (tx.date || '').startsWith(monthStr) && (catTarget === 'Semua' || (tx.category || '').toLowerCase().includes(catTarget.toLowerCase())))
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)

        if (result.action === 'status') {
          const matched = budgets.find(b => b.month === monthStr && (catTarget === 'Semua' || fuzzyMatch(b.category, catTarget)))
          const foundLimit = matched ? Number(matched.limit) : (Number(result.limit) || 0)
          newMsgs.push({
            id: Date.now()+3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'budget',
              action: 'status',
              title: catTarget,
              data: {
                category: catTarget,
                limit: foundLimit,
                spent: spentThisMonth,
                currency: defaultCurrency
              }
            }
          })
        } else if (result.action === 'create' || result.action === 'update') {
          const matched = budgets.find(b => b.month === monthStr && fuzzyMatch(b.category, catTarget))
          const numLimit = Number(result.limit) || 0
          if (matched) {
            await db.budgets.update(matched.id, { limit: numLimit })
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
                  currency: defaultCurrency
                }
              }
            })
          } else {
            await db.budgets.add({
              category: catTarget,
              limit: numLimit,
              month: monthStr
            })
            newMsgs.push({
              id: Date.now()+3,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'budget',
                action: 'create',
                title: catTarget,
                data: {
                  category: catTarget,
                  limit: numLimit,
                  spent: spentThisMonth,
                  currency: defaultCurrency
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
          await db.recurringTransactions.add({
            title: result.title,
            type: 'expense',
            category: result.category || 'Lainnya',
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
                category: result.category || 'Lainnya',
                currency: defaultCurrency
              }
            }
          })
        } else if (result.action === 'update' || result.action === 'delete') {
          if (result.action === 'delete' && (!result.title || !result.title.trim())) {
            newMsgs.push({
              id: Date.now() + 3,
              role: 'ai',
              type: 'text',
              content: locale === 'en'
                ? 'Please specify which recurring subscription you would like to cancel.'
                : 'Mohon sebutkan langganan berulang mana yang ingin Anda batalkan.',
            })
          } else {
            const matched = recurrings.find(r => fuzzyMatch(r.title, result.title))
            if (matched) {
              if (result.action === 'update') {
                const updates = {}
                if (result.amount) updates.amount = Number(result.amount)
                if (result.frequency) updates.frequency = result.frequency
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
                      category: matched.category,
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
        const filtered = result.month ? txs.filter(t => t.date.startsWith(result.month)) : txs
        
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
          const wType = result.walletType || 'bank'
          await createWallet({
            name: walletName,
            institutionType: wType,
            currency: defaultCurrency,
            balance: initialBal,
            logoUrl: null,
            createdAt: Date.now()
          })
          const balFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: defaultCurrency, maximumFractionDigits: 0 }).format(initialBal)
          newMsgs.push({ 
            id: Date.now()+3, 
            role: 'ai', 
            type: 'action_success', 
            data: { type: 'wallet', action: 'create', title: walletName, subtitle: `Saldo awal: ${balFormatted}` } 
          })
        } else if (result.action === 'transfer') {
          let fromWallet = wallets.find(w => w.id === Number(result.fromWalletId))
          let toWallet = wallets.find(w => w.id === Number(result.toWalletId))
          
          if (!fromWallet && wallets.length > 0) fromWallet = wallets[0]
          if (!toWallet && wallets.length > 1) toWallet = wallets[1]

          const transferAmt = result.amount || 0
          const amtFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: defaultCurrency, maximumFractionDigits: 0 }).format(transferAmt)
          
          const txToSave = {
            type: 'transfer',
            category: 'transfer/out',
            amount: transferAmt,
            date: format(new Date(), 'yyyy-MM-dd'),
            notes: `Transfer AI: ${fromWallet ? fromWallet.name : 'Dompet Asal'} ke ${toWallet ? toWallet.name : 'Dompet Tujuan'}`,
            walletId: fromWallet ? fromWallet.id : null,
            targetWalletId: toWallet ? toWallet.id : null,
            currency: defaultCurrency,
            createdAt: Date.now()
          }
          const transferTxId = await addTransaction(txToSave)
          txToSave.id = transferTxId
          
          newMsgs.push({ 
            id: Date.now()+3, 
            role: 'ai', 
            type: 'action_success', 
            data: { 
              type: 'wallet', 
              action: 'transfer', 
              title: `Transfer ${amtFormatted}`, 
              subtitle: `${fromWallet ? fromWallet.name : 'Dompet Asal'} → ${toWallet ? toWallet.name : 'Dompet Tujuan'}` 
            } 
          })
        }
      }

      if (result.type === 'loan') {
        if (result.action === 'create') {
          let selectedWalletId = result.walletId ? Number(result.walletId) : null
          if (!selectedWalletId || !wallets.find((w) => w.id === selectedWalletId)) {
            selectedWalletId = wallets.length > 0 ? wallets[0].id : null
          }
          await addLoan({
            type: result.loanType || 'debt',
            personName: result.personName || 'Pihak Terkait',
            title: result.title || 'Pinjaman Baru',
            totalAmount: result.amount,
            dueDate: result.dueDate || null,
            walletId: selectedWalletId,
            currency: defaultCurrency,
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
                currency: defaultCurrency
              }
            },
          })
        } else if (result.action === 'pay') {
          const allLoans = await db.loans.toArray()
          const matched = allLoans.find((l) => l.title?.toLowerCase().includes((result.title || '').toLowerCase()) && l.status !== 'paid')
          if (matched) {
            let payWalletId = result.walletId ? Number(result.walletId) : matched.walletId
            if (payWalletId && !wallets.find((w) => w.id === payWalletId)) {
              payWalletId = matched.walletId || (wallets.length > 0 ? wallets[0].id : null)
            }
            if (payWalletId && matched.walletId !== payWalletId) {
              await db.loans.update(matched.id, { walletId: payWalletId })
            }
            await recordPayment(matched.id, result.amount, getLocalDateString(), 'Dicatat via AI Assistant', payWalletId)
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
                  currency: defaultCurrency
                }
              },
            })
          }
        } else if (result.action === 'mark_paid') {
          const allLoans = await db.loans.toArray()
          const matched = allLoans.find((l) => l.title?.toLowerCase().includes((result.title || '').toLowerCase()))
          if (matched) {
            const payWalletId = result.walletId ? Number(result.walletId) : (matched.walletId || (wallets.length > 0 ? wallets[0].id : null))
            const remaining = Number(matched.remainingAmount) || 0
            if (remaining > 0) {
              await recordPayment(matched.id, remaining, getLocalDateString(), 'Pelunasan pinjaman via AI Assistant', payWalletId)
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
                  currency: matched.currency || defaultCurrency,
                },
              },
            })
          }
        } else if (result.action === 'delete') {
          if (!result.title || !result.title.trim()) {
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'text',
              content: locale === 'en'
                ? 'Please specify which loan record you would like to delete (for example: "delete loan Motor").'
                : 'Mohon sebutkan catatan pinjaman mana yang ingin Anda hapus (contoh: "hapus pinjaman Motor").',
            })
          } else {
            const allLoans = await db.loans.toArray()
            const matched = allLoans.find((l) => l.title?.toLowerCase().includes(result.title.toLowerCase()))
            if (matched) {
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
                content: locale === 'en'
                  ? `Loan "${result.title || ''}" not found.`
                  : `Catatan pinjaman "${result.title || ''}" tidak ditemukan.`,
              })
            }
          }
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
         const unifiedMsg = newMsgs[0]
         unifiedMsg.content = result.text || unifiedMsg.content || unifiedMsg.customMsg || ''
         if (result.chips && result.chips.length > 0) {
            unifiedMsg.chips = result.chips
         }
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
      setMessages(prev => {
         const filtered = prev.filter(m => m.id !== aiMsgId)
         return [...filtered, {
           id: Date.now() + 1,
           role: 'ai',
           type: 'text',
           content: isOffline ? offlineMsg : (err?.message || translate(locale, 'aiChat.error'))
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
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--panel-strong)]" />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-[var(--fg)] truncate">
                {translate(locale, 'aiChat.title') || 'AI Finance Advisor'}
              </h1>
              <p className="text-[10.5px] font-semibold text-[var(--muted)] truncate flex items-center gap-1">
                <span>Gemini 2.5 Flash</span>
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--muted-2)]" />
                <span className="text-emerald-500 font-bold">{locale === 'en' ? 'Online' : 'Aktif'}</span>
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
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3.5 ft-hide-scrollbar"
      >
        {messages.filter((m) => m.type !== 'hidden').map((msg, index) => {
          const visibleMessages = messages.filter((m) => m.type !== 'hidden')
          const isLastAi = msg.role === 'ai' && msg.id === visibleMessages[visibleMessages.length - 1].id
          const isLatestMessage = index === visibleMessages.length - 1

          return (
            <div key={msg.id || index} className="flex flex-col gap-2 w-full min-w-0 max-w-full">
              {msg.role === 'user' && (
                <div className="flex flex-col items-end gap-1 w-full min-w-0 max-w-full">
                  {msg.image && <img src={msg.image} alt="Upload" className="max-w-[200px] rounded-2xl border border-[var(--border)] shadow-xs" />}
                  {msg.content && <UserBubble content={msg.content} />}
                </div>
              )}

              {msg.role === 'ai' && (
                <>
                  <AiBubble
                    content={msg.content || (msg.type === 'welcome' ? translate(locale, 'aiChat.welcome') : '')}
                    timestamp={msg.timestamp}
                    isNew={isLatestMessage}
                    isStreaming={isLoading && isLatestMessage}
                    embeddedWidget={
                      msg.type === 'chart' && msg.data ? (
                        <ChartBubble data={msg.data} chartType={msg.chartType} embedded={true} />
                      ) : msg.type === 'success' ? (
                        <TransactionSuccess
                          data={msg.data}
                          embedded={true}
                          onUndo={() => {
                            if (Array.isArray(msg.data)) {
                              msg.data.forEach((tx) => deleteTransaction(tx.id))
                            } else {
                              deleteTransaction(msg.data.id)
                            }
                            setMessages((prev) => prev.filter((m) => m.id !== msg.id))
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
        })}

        {isLoading && !messages.some((m) => m.id === (messages[messages.length - 1]?.id) && m.role === 'ai' && m.content) && (
          <TypingIndicator />
        )}

        <div ref={messagesEndRef} className="h-2" />
      </main>

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
    </div>
  )
}
