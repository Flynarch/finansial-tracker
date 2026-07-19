import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import { db } from '../../lib/db'
import { parseTransactionFromText } from '../../lib/gemini'
import { format } from 'date-fns'
import { Send, Trash2, Sparkles, Mic, Image as ImageIcon, X } from 'lucide-react'
import { UserBubble, AiBubble, TypingIndicator, ChartBubble } from './ChatBubble'
import TransactionCard from './TransactionCard'
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
  
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  const [undoState, setUndoState] = useState(null)
  
  const [selectedImage, setSelectedImage] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const initialInput = useChatStore((s) => s.initialInput)
  const setInitialInput = useChatStore((s) => s.setInitialInput)

  useEffect(() => {
    if (isOpen && initialInput) {
      setInputValue(initialInput)
      setInitialInput('')
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
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus()
      }, 300)
    } else {
      setIsAnimatingIn(false)
      timeoutId = setTimeout(() => {
        setShouldRender(false)
      }, 450)
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

  useEffect(() => {
    if (!isOpen) return
    const vp = window.visualViewport
    if (!vp) return
    const handler = () => {
      const sheet = document.getElementById('ai-chat-sheet')
      if (sheet) {
        const offset = window.innerHeight - vp.height
        sheet.style.bottom = `${offset}px`
        if (offset > 10) {
          sheet.style.maxHeight = `${vp.height - 20}px`
        } else {
          sheet.style.maxHeight = ''
        }
      }
    }
    vp.addEventListener('resize', handler)
    return () => vp.removeEventListener('resize', handler)
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
        onStream: (chunk) => {
           setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + chunk } : m))
        }
      })

      if (result.error) {
        throw new Error(result.message)
      }

      if (result.text) {
         setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: result.text, chips: result.chips } : m))
      } else {
         setMessages(prev => prev.filter(m => m.id !== aiMsgId))
      }

      const newMsgs = []

      if (result.type === 'transactions') {
        if (result.action === 'create' && result.transactions?.length > 0) {
          const savedTxs = []
          for (const tx of result.transactions) {
             const txToSave = {
               ...tx,
               id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
               createdAt: new Date().toISOString()
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
          const todoId = await db.todos.add({
            title: result.title,
            category: 'lainnya',
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

      if (newMsgs.length > 0) {
         if (result.chips && result.chips.length > 0) {
           newMsgs[newMsgs.length - 1].chips = result.chips
         }
         setMessages(prev => [...prev, ...newMsgs])
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
    setUndoState(null)
  }

  if (!shouldRender) return null

  return createPortal(
    <>
      <div 
        className={`ft-chat-backdrop ${isAnimatingIn ? 'ft-chat-backdrop--visible' : ''}`}
        onClick={onClose}
      />
      
      <div 
        id="ai-chat-sheet"
        className={`ft-chat-sheet ${isAnimatingIn ? 'ft-chat-sheet--open' : ''}`}
      >
        <div className="ft-chat-drag-handle" />
        
        <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-1.5 font-semibold text-[15px] font-display">
            <Sparkles size={16} className="text-[var(--accent)] shrink-0" />
            {translate(locale, 'aiChat.title')}
          </div>
          <button 
            onClick={handleClear}
            className="flex items-center gap-1 text-[var(--muted)] text-xs bg-[var(--field-bg)] px-2.5 py-1.5 rounded-full hover:bg-[var(--border)] transition-colors"
          >
            <Trash2 size={12} />
            {translate(locale, 'aiChat.clear')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 overscroll-contain">
          {messages.filter(m => m.type !== 'hidden').map((msg, idx) => {
            const visibleMessages = messages.filter(m => m.type !== 'hidden')
            const isLastAi = msg.role === 'ai' && msg.id === visibleMessages[visibleMessages.length - 1].id
            return (
            <div key={msg.id} className="flex flex-col gap-2">
              {msg.role === 'user' && (
                <div className="flex flex-col items-end gap-1">
                  {msg.image && <img src={msg.image} alt="Upload" className="max-w-[200px] rounded-lg border border-[var(--border)]" />}
                  {msg.content && <UserBubble content={msg.content} />}
                </div>
              )}
              
              {msg.role === 'ai' && msg.type === 'text' && (
                 <>
                   {msg.content && <AiBubble content={msg.content} />}
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
                <div className="ml-8">
                  <TransactionSuccess 
                    data={msg.data}
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
                </div>
              )}

              {msg.role === 'ai' && msg.type === 'action_success' && (
                <div className="ml-8">
                  <ActionSuccessCard 
                    type={msg.data.type}
                    action={msg.data.action}
                    title={msg.data.title}
                    subtitle={msg.data.subtitle}
                  />
                </div>
              )}

              {/* Show QuickChips only after the very last AI message (except welcome which has its own) */}
              {isLastAi && !isLoading && msg.type !== 'welcome' && msg.type !== 'text' && msg.type !== 'chart' && (
                <QuickChips chips={msg.chips} onSelect={handleSend} />
              )}
            </div>
          )})}


          {isLoading && !messages.find(m => m.content === '') && <TypingIndicator />}
          
          {consecutiveErrors >= 2 && (
             <div className="flex justify-center mt-2">
               <button 
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

        {/* Input Bar */}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--card)] flex flex-col gap-2">
          {selectedImage && (
             <div className="relative inline-block self-start">
               <img src={selectedImage} alt="Preview" className="h-16 rounded-md border border-[var(--border)]" />
               <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5">
                  <X size={12} />
               </button>
             </div>
          )}
          <form 
            className="flex items-end gap-2 bg-[var(--field-bg)] border border-[var(--border)] rounded-2xl px-3 py-2 focus-within:ring-2 ring-[var(--accent)] transition-all"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors p-1.5 shrink-0 mb-0.5" title="Upload Image">
               <ImageIcon size={18} />
            </button>
            <button type="button" onClick={toggleRecording} className={`${isRecording ? 'text-red-500 animate-pulse' : 'text-[var(--muted)] hover:text-[var(--text)]'} transition-colors p-1.5 shrink-0 mb-0.5`} title="Voice Input">
               <Mic size={18} />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 bg-transparent border-none text-[14px] text-[var(--text)] focus:outline-none px-1 py-1.5 placeholder-[var(--muted)] resize-none max-h-32 ft-hide-scrollbar"
              placeholder={isRecording ? "Mendengarkan..." : translate(locale, 'aiChat.placeholder')}
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
              className={`p-1.5 rounded-full shrink-0 mb-0.5 transition-colors ${inputValue.trim() || selectedImage ? 'bg-[var(--accent)] text-white' : 'bg-transparent text-[var(--muted)]'}`}
              disabled={isLoading || (!inputValue.trim() && !selectedImage)}
            >
              <Send size={16} className={inputValue.trim() || selectedImage ? 'ml-0.5' : ''} />
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  )
}
