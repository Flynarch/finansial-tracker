import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import useWalletStore from '../../store/useWalletStore'
import useLoanStore from '../../store/useLoanStore'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { parseTransactionFromText } from '../../lib/gemini'
import { seedComprehensiveDebugData } from '../../lib/seedDebugData'
import { sanitizeCategoryPath } from '../../lib/categorySanitizer'
import { format } from 'date-fns'
import { Send, Trash2, Sparkles, Mic, Image as ImageIcon, X } from 'lucide-react'
import { UserBubble, AiBubble, TypingIndicator, ChartBubble } from './ChatBubble'
import TransactionSuccess from './TransactionSuccess'
import ActionSuccessCard from './ActionSuccessCard'
import QuickChips from './QuickChips'
import useChatStore from '../../store/useChatStore'

export default function AiChatSheet({ isOpen, onClose, messages, setMessages }) {
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const transactions = useTransactionStore((s) => s.transactions)
  const addLoan = useLoanStore((s) => s.addLoan)
  const recordPayment = useLoanStore((s) => s.recordPayment)
  const updateLoan = useLoanStore((s) => s.updateLoan)
  const deleteLoan = useLoanStore((s) => s.deleteLoan)
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) || []
  
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  
  const [selectedImage, setSelectedImage] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const initialInput = useChatStore((s) => s.initialInput)
  const setInitialInput = useChatStore((s) => s.setInitialInput)

  const handleSendRef = useRef(null)

  useEffect(() => {
    if (isOpen && initialInput) {
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
  }, [isOpen, initialInput, setInitialInput])

  // Initialization & Auto-focus
  useEffect(() => {
    let timeoutId
    if (isOpen) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimatingIn(true))
      })
      if (messages.length === 0) {
        setMessages([{
          id: Date.now(),
          role: 'ai',
          type: 'welcome',
          content: translate(locale, 'aiChat.welcome')
        }])
      }
      // Focus input cleanly right after sheet slide-up completes (340ms)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true })
        }
      }, 340)
    } else {
      setIsAnimatingIn(false)
      timeoutId = setTimeout(() => {
        setShouldRender(false)
      }, 350)
    }
    return () => clearTimeout(timeoutId)
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow && previousOverflow !== 'hidden' ? previousOverflow : ''
      document.body.style.touchAction = ''
    }
  }, [isOpen])

  // Keyboard-aware: adjust sheet position smoothly using pure GPU transform
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setSelectedImage(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
       setIsRecording(false)
       return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
       alert("Browser Anda tidak mendukung Voice Input.")
       return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = locale === 'id' ? 'id-ID' : 'en-US'
    recognition.start()
    setIsRecording(true)
    recognition.onresult = (e) => {
       setInputValue(prev => prev + (prev ? " " : "") + e.results[0][0].transcript)
       setIsRecording(false)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)
  }

  const handleSend = async (text = inputValue, image = selectedImage) => {
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
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setIsLoading(true)
    setConsecutiveErrors(0)

    const aiMsgId = Date.now() + 1
    setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'ai', type: 'text', content: '' }])

    try {
      const result = await parseTransactionFromText(text || "Lihat gambar struk ini", {
        locale,
        defaultCurrency,
        previousMessages: messages,
        imageData: image,
        wallets,
        onStream: (chunk) => {
           setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + chunk } : m))
        }
      })

      if (result.error) {
        throw new Error(result.message)
      }

      const newMsgs = []

      if (result.type === 'seed_debug_data' || result.name === 'seed_debug_data') {
        const counts = await seedComprehensiveDebugData({ wallets, defaultCurrency })
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'action_success',
          data: {
            type: 'seed_debug',
            action: 'create',
            title: 'Data Dummy Debugging Berhasil Diisi',
            subtitle: `${counts.transactions} Transaksi · ${counts.budgets} Anggaran · ${counts.goals} Tabungan · ${counts.habits} Habit · ${counts.todos} Todo · ${counts.loans} Utang-Piutang`,
          },
        })
      }

      if (result.type === 'transactions') {
        if (result.action === 'create' && result.transactions?.length > 0) {
          const savedTxs = []
          for (const tx of result.transactions) {
             let finalWalletId = tx.walletId ? Number(tx.walletId) : (wallets.length > 0 ? wallets[0].id : null)
             if (finalWalletId !== null && !wallets.find(w => w.id === finalWalletId)) {
                finalWalletId = wallets.length > 0 ? wallets[0].id : null
             }
             
             const txToSave = {
               ...tx,
               category: sanitizeCategoryPath(tx.category, tx.type),
               walletId: finalWalletId,
               id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
               createdAt: new Date().toISOString()
             }
             
             if (tx.type === 'transfer' && tx.targetWalletId) {
                let twId = Number(tx.targetWalletId)
                if (wallets.find(w => w.id === twId)) txToSave.targetWalletId = twId
             }
             
             await addTransaction(txToSave)
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
         newMsgs.push({ id: Date.now() + 5, role: 'ai', type: 'chart', data: result.data, chips: result.chips, chartType: result.chartType })
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
        const createWalletFn = useWalletStore.getState().createWallet
        
        if (result.action === 'create') {
          const walletName = result.name || 'Dompet Baru'
          const initialBal = result.initialBalance || 0
          const wType = result.walletType || 'bank'
          await createWalletFn({
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
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            createdAt: new Date().toISOString()
          }
          await addTransaction(txToSave)
          
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
          if (selectedWalletId && !wallets.find((w) => w.id === selectedWalletId)) {
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
              subtitle: `${result.loanType === 'debt' ? 'Hutang' : 'Piutang'} (${result.personName || 'Pihak Terkait'})`,
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

      if (newMsgs.length > 0) {
         const firstSuccessMsg = newMsgs.find(m => m.type === 'success' || m.type === 'action_success')
         if (firstSuccessMsg) {
            // Merge response text into the action success message so it renders inside a single AiBubble
            firstSuccessMsg.content = result.text || firstSuccessMsg.customMsg || ''
            if (result.chips && result.chips.length > 0) {
               firstSuccessMsg.chips = result.chips
            }
            // Replace temporary streaming aiMsgId with the unified success message
            setMessages(prev => {
               const exists = prev.some(m => m.id === aiMsgId)
               if (exists) {
                  return prev.map(m => m.id === aiMsgId ? firstSuccessMsg : m)
               }
               return [...prev, firstSuccessMsg]
            })
         } else {
            if (result.text) {
               setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: result.text, chips: result.chips } : m))
            } else {
               setMessages(prev => prev.filter(m => m.id !== aiMsgId))
            }
            if (result.chips && result.chips.length > 0) {
               newMsgs[newMsgs.length - 1].chips = result.chips
            }
            setMessages(prev => [...prev, ...newMsgs])
         }
      } else if (result.text) {
         setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: result.text, chips: result.chips } : m))
      } else {
         setMessages(prev => prev.filter(m => m.id !== aiMsgId))
      }
      
      setConsecutiveErrors(0)
    } catch (err) {
      setConsecutiveErrors(prev => prev + 1)
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
      setIsLoading(false)
      if (inputRef.current) inputRef.current.focus()
    }
  }

  const handleClear = () => {
    setMessages([{
      id: Date.now(),
      role: 'ai',
      type: 'welcome',
      content: translate(locale, 'aiChat.welcome')
    }])
    setConsecutiveErrors(0)
  }

  handleSendRef.current = handleSend

  if (!shouldRender) return null

  return createPortal(
    <>
      <div 
        className={`ft-chat-backdrop ${isAnimatingIn ? 'ft-chat-backdrop--visible' : ''}`}
        onClick={onClose}
      />
      
      <div 
        id="ai-chat-sheet"
        style={{
          transform: !isAnimatingIn
            ? 'translate3d(0, 100%, 0)'
            : keyboardOffset > 0
            ? `translate3d(0, -${keyboardOffset}px, 0)`
            : 'translate3d(0, 0, 0)',
          maxHeight: viewportHeight && keyboardOffset > 0
            ? `${Math.max(300, viewportHeight - 16)}px`
            : undefined,
        }}
        className={`ft-chat-sheet ${isAnimatingIn ? 'ft-chat-sheet--open' : ''}`}
      >
        <div className="ft-chat-drag-handle" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]/70 bg-[var(--panel-strong)]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shadow-xs">
              <Sparkles size={16} className="stroke-[2.2]" />
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--panel-strong)] ${isLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[15px] text-[var(--fg)] tracking-tight leading-tight">
                {translate(locale, 'aiChat.title')}
              </span>
              <span className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                {isLoading ? (locale === 'en' ? 'Thinking...' : 'Berpikir...') : (locale === 'en' ? 'Proactive Advisor' : 'Financial Advisor')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClear}
              title={translate(locale, 'aiChat.clear')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--border)]/50 hover:text-[var(--fg)] transition-colors active:scale-95"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--border)]/50 hover:text-[var(--fg)] transition-colors active:scale-95"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 overscroll-contain">
          {messages.filter(m => m.type !== 'hidden').map((msg, index) => {
            const visibleMessages = messages.filter(m => m.type !== 'hidden')
            const isLastAi = msg.role === 'ai' && msg.id === visibleMessages[visibleMessages.length - 1].id
            const isLatestMessage = index === visibleMessages.length - 1
            return (
            <div key={msg.id} className="flex flex-col gap-2">
              {msg.role === 'user' && (
                <div className="flex flex-col items-end gap-1">
                  {msg.image && <img src={msg.image} alt="Upload" className="max-w-[200px] rounded-2xl border border-[var(--border)] shadow-xs" />}
                  {msg.content && <UserBubble content={msg.content} />}
                </div>
              )}
              
              {msg.role === 'ai' && msg.type === 'text' && (
                 <>
                   {msg.content && <AiBubble content={msg.content} isNew={isLatestMessage} isStreaming={isLoading && isLatestMessage} />}
                   {isLastAi && msg.chips && msg.chips.length > 0 && <QuickChips chips={msg.chips} onSelect={handleSend} />}
                 </>
              )}
              
              {msg.role === 'ai' && msg.type === 'welcome' && (
                <>
                  <AiBubble content={msg.content} />
                  <QuickChips onSelect={handleSend} />
                </>
              )}
              
              {msg.role === 'ai' && msg.type === 'chart' && (
                  <>
                   {ChartBubble && <ChartBubble data={msg.data} chartType={msg.chartType} />}
                   {isLastAi && msg.chips && msg.chips.length > 0 && <QuickChips chips={msg.chips} onSelect={handleSend} />}
                 </>
              )}
              
              {msg.role === 'ai' && msg.type === 'success' && (
                <>
                  <AiBubble 
                    content={msg.content || msg.customMsg} 
                    timestamp={msg.timestamp}
                    isNew={isLatestMessage}
                    isStreaming={isLoading && isLatestMessage}
                    embeddedWidget={
                      <TransactionSuccess 
                        data={msg.data}
                        embedded={true}
                        onUndo={() => {
                          if (Array.isArray(msg.data)) {
                            msg.data.forEach(tx => deleteTransaction(tx.id))
                          } else {
                            deleteTransaction(msg.data.id)
                          }
                          setMessages(prev => prev.filter(m => m.id !== msg.id))
                        }}
                        contextMsg={msg.customMsg || translate(locale, 'aiChat.more')}
                      />
                    }
                  />
                  {isLastAi && msg.chips && msg.chips.length > 0 && <QuickChips chips={msg.chips} onSelect={handleSend} />}
                </>
              )}

              {msg.role === 'ai' && msg.type === 'action_success' && (
                <>
                  <AiBubble 
                    content={msg.content} 
                    timestamp={msg.timestamp}
                    isNew={isLatestMessage}
                    isStreaming={isLoading && isLatestMessage}
                    embeddedWidget={
                      <ActionSuccessCard 
                        type={msg.data.type}
                        action={msg.data.action}
                        title={msg.data.title}
                        subtitle={msg.data.subtitle}
                        embedded={true}
                      />
                    }
                  />
                  {isLastAi && msg.chips && msg.chips.length > 0 && <QuickChips chips={msg.chips} onSelect={handleSend} />}
                </>
              )}
            </div>
          )})}


          {isLoading && <TypingIndicator />}
          
          {consecutiveErrors >= 2 && (
             <div className="flex justify-center mt-2">
               <button 
                 type="button"
                 onClick={() => {
                   onClose()
                   window.dispatchEvent(new CustomEvent('ft-open-add-transaction'))
                 }}
                 className="ft-btn-secondary text-xs px-4 py-2 flex items-center gap-2"
               >
                 {translate(locale, 'aiChat.manual')}
               </button>
             </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock Bar */}
        <div className="p-3 border-t border-[var(--border)]/70 bg-[var(--bg)]/80 backdrop-blur-md flex flex-col gap-2 shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {selectedImage && (
             <div className="relative inline-block self-start">
               <img src={selectedImage} alt="Preview" className="h-16 rounded-xl border border-[var(--border)] shadow-xs" />
               <button type="button" onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 shadow-xs">
                  <X size={12} />
               </button>
             </div>
          )}

          {isRecording && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold animate-fade-in backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>{locale === 'en' ? 'Listening...' : 'Mendengarkan ucapan Anda...'}</span>
              <div className="ml-auto ft-waveform">
                <div className="ft-waveform-bar bg-rose-500" />
                <div className="ft-waveform-bar bg-rose-500" />
                <div className="ft-waveform-bar bg-rose-500" />
                <div className="ft-waveform-bar bg-rose-500" />
              </div>
            </div>
          )}

          <form
            className="flex items-center gap-2 bg-[var(--field-bg)]/90 backdrop-blur-md rounded-2xl px-3 py-2 transition-all focus-within:ring-2 ring-indigo-500/40 border border-[var(--field-border)]"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1.5 shrink-0" title="Upload gambar">
               <ImageIcon size={18} />
            </button>
            <button type="button" onClick={toggleRecording} className={`${isRecording ? 'text-rose-500 animate-pulse' : 'text-[var(--muted)] hover:text-[var(--fg)]'} transition-colors p-1.5 shrink-0`} title="Voice input">
               <Mic size={18} />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 bg-transparent border-none text-[13.5px] font-medium text-[var(--fg)] focus:outline-none px-1 py-1 placeholder-[var(--muted)] resize-none max-h-32 ft-hide-scrollbar"
              placeholder={isRecording ? (locale === 'en' ? 'Listening...' : 'Bicara sekarang...') : (locale === 'en' ? 'Ask or record anything...' : 'Ketik transaksi, tugas, atau pertanyaan...')}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                  e.target.style.height = 'auto'
                }
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              className={`p-2 rounded-xl shrink-0 transition-all active:scale-90 ${inputValue.trim() || selectedImage ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20' : 'bg-transparent text-[var(--muted)]'}`}
              disabled={isLoading || (!inputValue.trim() && !selectedImage)}
            >
              {isLoading ? (
                <Sparkles size={16} className="animate-spin text-indigo-500" />
              ) : (
                <Send size={15} className={inputValue.trim() || selectedImage ? 'ml-0.5' : ''} />
              )}
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  )
}
