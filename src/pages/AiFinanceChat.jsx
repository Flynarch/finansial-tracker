import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { translate } from '../lib/i18n'
import useSettingsStore from '../store/useSettingsStore'
import { createTransaction as addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService'
import { createWallet } from '../services/walletService'
import useLoanStore from '../store/useLoanStore'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { parseTransactionFromText } from '../lib/gemini'
import { sanitizeCategoryPath } from '../lib/categorySanitizer'
import { format } from 'date-fns'
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
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || []
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
      const result = await parseTransactionFromText(text || "Lihat gambar struk ini", {
        locale,
        defaultCurrency,
        previousMessages: messages,
        imageData: image,
        wallets,
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
           const sq = result.searchQuery.toLowerCase()
           const matchedTx = transactions.find(t => 
              (t.notes && t.notes.toLowerCase().includes(sq)) || 
              (t.category && t.category.toLowerCase().includes(sq)) ||
              (result.date && t.date === result.date)
           )
           
           if (!matchedTx) {
              newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: "Maaf, transaksi yang dimaksud tidak ditemukan di history Anda." })
           } else {
              if (result.action === 'update') {
                 await updateTransaction(matchedTx.id, { ...matchedTx, ...result.updatedFields })
                 newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'success', data: { ...matchedTx, ...result.updatedFields }, customMsg: "Transaksi berhasil diperbarui" })
              } else {
                 await deleteTransaction(matchedTx.id)
                 newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: "Oke, transaksi tersebut telah dihapus." })
              }
           }
        }
      }
      
      if (result.type === 'habit') {
        const habits = await db.habits.toArray()
        const fuzzyMatch = (str, query) => str.toLowerCase().includes(query.toLowerCase())
        
        if (result.action === 'create') {
          const newHabit = {
            title: result.title,
            color: result.color || 'indigo',
            category: 'Lainnya',
            frequencyType: result.frequencyType || 'daily',
            frequencyValue: null,
            reminderEnabled: !!result.reminderTime,
            reminderTime: result.reminderTime || null,
            createdAt: new Date().toISOString()
          }
          await db.habits.add(newHabit)
          newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'habit', action: 'create', title: result.title } })
        } else if (result.action === 'log') {
          const matched = habits.find(h => fuzzyMatch(h.title, result.title))
          if (matched) {
            const todayStr = format(new Date(), 'yyyy-MM-dd')
            const existingLog = await db.habitLogs.where({ habitId: matched.id, date: todayStr }).first()
            if (!existingLog) {
              await db.habitLogs.add({ habitId: matched.id, date: todayStr })
              newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'habit', action: 'log', title: matched.title } })
            } else {
              newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: `Habit "**${matched.title}**" sudah dicentang sebelumnya hari ini.` })
            }
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
        const fuzzyMatch = (str, query) => str.toLowerCase().includes(query.toLowerCase())
        
        if (result.action === 'create') {
          await db.goals.add({
            name: result.name,
            targetAmount: result.amount,
            currentAmount: 0,
            deadline: null,
            currency: defaultCurrency
          })
          newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'savings', action: 'create', title: result.name, subtitle: `Target: Rp ${result.amount.toLocaleString('id-ID')}` } })
        } else if (result.action === 'add_funds') {
          const matched = goals.find(g => fuzzyMatch(g.name, result.name))
          if (matched) {
            await db.goals.update(matched.id, { currentAmount: matched.currentAmount + result.amount })
            await db.goalLogs.add({
              goalId: matched.id,
              amount: result.amount,
              notes: 'Dicatat oleh AI',
              date: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
            })
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'savings', action: 'add_funds', title: matched.name, subtitle: `Ditambah: Rp ${result.amount.toLocaleString('id-ID')}` } })
          } else {
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: `Tabungan yang mirip dengan "${result.name}" tidak ditemukan.` })
          }
        }
      }

      if (result.type === 'todo') {
        const todos = await db.todos.toArray()
        const fuzzyMatch = (str, query) => str.toLowerCase().includes(query.toLowerCase())
        
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
            createdAt: new Date().toISOString()
          })
          
          if (result.subTasks && Array.isArray(result.subTasks) && result.subTasks.length > 0) {
            const subTasksToInsert = result.subTasks.map(label => ({
              todoId,
              label,
              checked: false
            }))
            await db.sub_tasks.bulkAdd(subTasksToInsert)
          }
          
          newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'todo', action: 'create', title: result.title } })
        } else if (result.action === 'complete') {
          const matched = todos.find(t => !t.completed && fuzzyMatch(t.title, result.title))
          if (matched) {
            await db.todos.update(matched.id, { completed: true })
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'todo', action: 'complete', title: matched.title } })
          } else {
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: `Tugas aktif yang mirip dengan "${result.title}" tidak ditemukan.` })
          }
        }
      }

      if (result.type === 'budget') {
        const budgets = await db.budgets.toArray()
        const fuzzyMatch = (str, query) => str.toLowerCase().includes(query.toLowerCase())
        const monthStr = format(new Date(), 'yyyy-MM')
        const limitFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: defaultCurrency, maximumFractionDigits: 0 }).format(result.limit)
        
        if (result.action === 'create' || result.action === 'update') {
          const matched = budgets.find(b => b.month === monthStr && fuzzyMatch(b.category, result.category))
          if (matched) {
            await db.budgets.update(matched.id, { limit: result.limit })
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'budget', action: 'update', title: `Kategori: ${matched.category}`, subtitle: `Batas: ${limitFormatted}` } })
          } else {
            await db.budgets.add({
              category: result.category,
              limit: result.limit,
              month: monthStr
            })
            newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'budget', action: 'create', title: `Kategori: ${result.category}`, subtitle: `Batas: ${limitFormatted}` } })
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
        const fuzzyMatch = (str, query) => str?.toLowerCase().includes(query.toLowerCase())
        
        if (result.action === 'create') {
          await db.recurringTransactions.add({
            title: result.title,
            type: 'expense',
            category: result.category || 'Lainnya',
            amount: result.amount || 0,
            currency: defaultCurrency,
            frequency: result.frequency || 'monthly',
            nextDate: format(new Date(), 'yyyy-MM-dd'),
            enabled: true
          })
          newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'recurring', action: 'create', title: result.title, subtitle: `Rp ${(result.amount || 0).toLocaleString('id-ID')} (${result.frequency || 'monthly'})` } })
        } else if (result.action === 'update' || result.action === 'delete') {
          const matched = recurrings.find(r => fuzzyMatch(r.title, result.title))
          if (matched) {
            if (result.action === 'update') {
               const updates = {}
               if (result.amount) updates.amount = result.amount
               if (result.frequency) updates.frequency = result.frequency
               await db.recurringTransactions.update(matched.id, updates)
               newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'recurring', action: 'update', title: matched.title, subtitle: `Langganan diperbarui` } })
            } else {
               await db.recurringTransactions.delete(matched.id)
               newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'action_success', data: { type: 'recurring', action: 'delete', title: matched.title, subtitle: 'Langganan berhasil dibatalkan' } })
            }
          } else {
             newMsgs.push({ id: Date.now()+3, role: 'ai', type: 'text', content: `Maaf, langganan bernama "${result.title}" tidak ditemukan.` })
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
          const chosenWallet = wallets.find((w) => w.id === selectedWalletId)
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
              subtitle: `${result.loanType === 'debt' ? 'Hutang' : 'Piutang'} (${result.personName || 'Pihak Terkait'})${chosenWallet ? ` • ${chosenWallet.name}` : ''}`,
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
            await recordPayment(matched.id, result.amount, new Date().toISOString().split('T')[0], 'Dicatat via AI Assistant')
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'loan',
                action: 'pay',
                title: matched.title,
                subtitle: `Cicilan ${result.amount ? 'Rp ' + Number(result.amount).toLocaleString('id-ID') : ''} dicatat`,
              },
            })
          }
        } else if (result.action === 'mark_paid') {
          const allLoans = await db.loans.toArray()
          const matched = allLoans.find((l) => l.title?.toLowerCase().includes((result.title || '').toLowerCase()))
          if (matched) {
            await updateLoan(matched.id, { status: 'paid', remainingAmount: 0 })
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'loan',
                action: 'update',
                title: matched.title,
                subtitle: 'Ditandai lunas',
              },
            })
          }
        } else if (result.action === 'delete') {
          const allLoans = await db.loans.toArray()
          const matched = allLoans.find((l) => l.title?.toLowerCase().includes((result.title || '').toLowerCase()))
          if (matched) {
            await deleteLoan(matched.id)
            newMsgs.push({
              id: Date.now() + 4,
              role: 'ai',
              type: 'action_success',
              data: {
                type: 'loan',
                action: 'delete',
                title: matched.title,
                subtitle: 'Catatan pinjaman dihapus',
              },
            })
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
      setMessages(prev => {
         const filtered = prev.filter(m => m.id !== aiMsgId)
         return [...filtered, {
           id: Date.now() + 1,
           role: 'ai',
           type: 'text',
           content: err.message || translate(locale, 'aiChat.error')
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
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-[ft-fade-in_0.15s_ease-out_both]"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4.5 shadow-2xl space-y-3 animate-[ft-spring-dropdown_0.2s_ease-out_both]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-500">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/20 shadow-2xs">
                <Trash2 size={16} strokeWidth={2.2} />
              </div>
              <h3 className="text-sm font-black tracking-tight text-[var(--fg)]">
                {locale === 'en' ? 'Clear Conversation?' : 'Hapus Percakapan?'}
              </h3>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed font-medium">
              {locale === 'en'
                ? 'All messages in this session will be cleared.'
                : 'Semua riwayat percakapan sesi ini akan dihapus dan diatur ulang ke pesan pembuka.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
              >
                {locale === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/30 hover:bg-rose-600 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} strokeWidth={2.2} />
                <span>{locale === 'en' ? 'Clear' : 'Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                          embedded={true}
                        />
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
            placeholder={translate(locale, 'aiChat.placeholder') || (locale === 'en' ? 'Ask or record anything...' : 'Ketik transaksi, tugas, atau pertanyaan...')}
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
