import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import { parseTransactionFromText } from '../../lib/gemini'
import { Send, Trash2, Sparkles } from 'lucide-react'
import { UserBubble, AiBubble, TypingIndicator } from './ChatBubble'
import TransactionCard from './TransactionCard'
import TransactionSuccess from './TransactionSuccess'
import QuickChips from './QuickChips'

export default function AiChatSheet({ isOpen, onClose, messages, setMessages }) {
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  
  // Animation states for entry/exit transitions
  const [shouldRender, setShouldRender] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  
  // Undo state
  const [undoState, setUndoState] = useState(null)

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
      // Delay focus slightly for animation
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Visual Viewport for Keyboard (Mobile)
  useEffect(() => {
    if (!isOpen) return
    const vp = window.visualViewport
    if (!vp) return
    const handler = () => {
      const sheet = document.getElementById('ai-chat-sheet')
      if (sheet) {
        const offset = window.innerHeight - vp.height
        sheet.style.bottom = `${offset}px`
        // Prevent the sheet from flying off the top of the screen by capping max-height
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

  const handleSend = async (text = inputValue) => {
    if (!text.trim()) return
    
    const userMsg = {
      id: Date.now(),
      role: 'user',
      type: 'text',
      content: text
    }
    
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const result = await parseTransactionFromText(text, {
        locale,
        defaultCurrency,
        previousMessages: messages
      })

      if (result.error) {
        throw new Error(result.message)
      }

      const newMsgs = []
      
      // Always add textual reply
      if (result.text) {
        newMsgs.push({
          id: Date.now() + 1,
          role: 'ai',
          type: 'text',
          content: result.text
        })
      }

      if (result.type === 'transactions' && result.transactions?.length > 0) {
        // Auto save all transactions
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

        // Push success messages
        savedTxs.forEach((tx, idx) => {
          newMsgs.push({
            id: Date.now() + 2 + idx,
            role: 'ai',
            type: 'success',
            data: tx
          })
        })
      }

      setMessages(prev => [...prev, ...newMsgs])
      setConsecutiveErrors(0) // Reset errors on success
    } catch (err) {
      setConsecutiveErrors(prev => prev + 1)
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        type: 'text',
        content: translate(locale, 'aiChat.error')
      }])
    } finally {
      setIsLoading(false)
      // Refocus input after sending
      if (inputRef.current) inputRef.current.focus()
    }
  }

  const handleSaveTransaction = async (msgId, txData) => {
    // Legacy fallback (should no longer be reached for new architecture, but kept just in case)
  }

  const handleUndo = async () => {
    setUndoState(null)
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
      {/* Backdrop */}
      <div 
        className={`ft-chat-backdrop ${isAnimatingIn ? 'ft-chat-backdrop--visible' : ''}`}
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        id="ai-chat-sheet"
        className={`ft-chat-sheet ${isAnimatingIn ? 'ft-chat-sheet--open' : ''}`}
      >
        <div className="ft-chat-drag-handle" />
        
        {/* Header */}
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

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 overscroll-contain">
          {messages.map(msg => (
            <div key={msg.id} className="flex flex-col gap-2">
              {msg.role === 'user' && <UserBubble content={msg.content} />}
              
              {msg.role === 'ai' && msg.type === 'text' && <AiBubble content={msg.content} />}
              
              {msg.role === 'ai' && msg.type === 'welcome' && (
                <>
                  <AiBubble content={msg.content} />
                  <QuickChips onSelect={handleSend} />
                </>
              )}
              
              {msg.role === 'ai' && msg.type === 'transaction' && (
                <div className="ml-8">
                  <TransactionCard
                    data={msg.data}
                    isEditing={editingId === msg.id}
                    onEdit={() => setEditingId(msg.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={(editedData) => handleSaveTransaction(msg.id, editedData)}
                  />
                </div>
              )}

              {msg.role === 'ai' && msg.type === 'success' && (
                <div className="ml-8">
                  <TransactionSuccess 
                    data={msg.data}
                    onUndo={() => {
                      deleteTransaction(msg.data.id)
                      setMessages(prev => prev.filter(m => m.id !== msg.id))
                    }}
                    contextMsg={translate(locale, 'aiChat.more')}
                  />
                  {/* Follow-up chips after success */}
                  <div className="mt-2">
                     <QuickChips onSelect={handleSend} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && <TypingIndicator />}
          
          {consecutiveErrors >= 2 && (
             <div className="flex justify-center mt-2">
               <button 
                 onClick={() => {
                   onClose()
                   // Assuming AppShell provides a way to open manual form, we trigger custom event
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
        <form 
          className="ft-chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="ft-chat-input"
            placeholder={translate(locale, 'aiChat.placeholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button 
            type="submit" 
            className="ft-send-btn"
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={18} className={inputValue.trim() && !isLoading ? 'translate-x-[-1px] translate-y-[1px]' : ''} />
          </button>
        </form>
      </div>
    </>,
    document.body
  )
}
