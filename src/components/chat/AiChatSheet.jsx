import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import { parseTransactionFromText } from '../../lib/gemini'
import { Send, Trash2, Sparkles, Mic, Image as ImageIcon, X } from 'lucide-react'
import { UserBubble, AiBubble, TypingIndicator, ChartBubble } from './ChatBubble'
import TransactionCard from './TransactionCard'
import TransactionSuccess from './TransactionSuccess'
import QuickChips from './QuickChips'

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
    setIsLoading(true)

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
      
      if (result.type === 'chart') {
         newMsgs.push({ id: Date.now() + 5, role: 'ai', type: 'chart', data: result.data, chips: result.chips })
      }

      if (newMsgs.length > 0) {
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
          {messages.map(msg => (
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
                   {msg.chips && msg.chips.length > 0 && <QuickChips chips={msg.chips} onSelect={handleSend} />}
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
                   {ChartBubble && <ChartBubble data={msg.data} />}
                   {msg.chips && msg.chips.length > 0 && <QuickChips chips={msg.chips} onSelect={handleSend} />}
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
                  <div className="mt-2">
                     <QuickChips onSelect={handleSend} />
                  </div>
                </div>
              )}
            </div>
          ))}

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
            className="flex items-center gap-2 bg-[var(--field-bg)] border border-[var(--border)] rounded-full px-3 py-1.5 focus-within:ring-2 ring-[var(--accent)] transition-all"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors p-1" title="Upload Image">
               <ImageIcon size={18} />
            </button>
            <button type="button" onClick={toggleRecording} className={`${isRecording ? 'text-red-500 animate-pulse' : 'text-[var(--muted)] hover:text-[var(--text)]'} transition-colors p-1`} title="Voice Input">
               <Mic size={18} />
            </button>
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-none text-[14px] text-[var(--text)] focus:outline-none px-1 placeholder-[var(--muted)]"
              placeholder={isRecording ? "Mendengarkan..." : translate(locale, 'aiChat.placeholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button 
              type="submit" 
              className={`p-1.5 rounded-full transition-colors ${inputValue.trim() || selectedImage ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)]'}`}
              disabled={(!inputValue.trim() && !selectedImage) || isLoading}
            >
              <Send size={16} className={(inputValue.trim() || selectedImage) && !isLoading ? 'translate-x-[-1px] translate-y-[1px]' : ''} />
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  )
}
