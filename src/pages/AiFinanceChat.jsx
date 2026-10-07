import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useSettingsStore from '../store/useSettingsStore'
import useChatStore from '../store/useChatStore'
import useBackButton from '../hooks/useBackButton'
import { getCachedCurrencyRates } from '../lib/api'
import { getLocalDateString } from '../lib/dateUtils'
import { triggerHaptic } from '../lib/haptics'
import { FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx, convertCurrency, formatCurrency, formatMoneyInput, parseMoneyInput } from '../lib/utils'

// UI & Subcomponents
import Modal from '../components/ui/Modal'
import ChatHeaderToolbar from '../components/chat/ChatHeaderToolbar'
import ChatMessageList from '../components/chat/ChatMessageList'
import ChatInputBar from '../components/chat/ChatInputBar'
import ScrollToBottomFAB from '../components/chat/ScrollToBottomFAB'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import ReceiptScanModePicker from '../components/chat/ReceiptScanModePicker'
import MediaSourcePickerModal from '../components/chat/MediaSourcePickerModal'
import MessageContextMenu from '../components/chat/MessageContextMenu'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import { updateTransaction } from '../services/transactionService'
import { getTransactionCategoryLabels } from '../lib/categoryIcon'
import { copyToClipboard } from '../lib/clipboard'
import { getDecryptedNoteSync, isFieldEncrypted } from '../lib/fieldEncryption'

// Hooks
import {
  useChatSession,
  useChatScroll,
  useChatInputState,
  useChatEngine,
  useChatDeletion,
} from '../components/chat/hooks'

export default function AiFinanceChat() {
  const navigate = useNavigate()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const defaultWalletId = useSettingsStore((s) => s.defaultWalletId)

  const backgroundTexture = useChatStore((s) => s.backgroundTexture) || 'paper'
  const setBackgroundTexture = useChatStore((s) => s.setBackgroundTexture)

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.isArchived).toArray(), []) || []

  // Today's total expense for WelcomeHero live snapshot
  const todayStr = useMemo(() => getLocalDateString(), [])
  const todayExpense = useLiveQuery(async () => {
    try {
      const txs = await db.transactions.where('date').equals(todayStr).toArray()
      const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
      let total = 0
      txs.forEach((tx) => {
        if (tx.deletedAt) return
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
    } catch (err) {
      console.error('[AiFinanceChat.todaySpending]', err)
      return 0
    }
  }, [todayStr, defaultCurrency]) || 0

  const [showTexturePicker, setShowTexturePicker] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [contextMenuMsg, setContextMenuMsg] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editFormData, setEditFormData] = useState(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const textureDropdownRef = useRef(null)
  const longPressTimerRef = useRef(null)

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
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (window.history.length > 1) navigate(-1)
        else navigate('/dashboard')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleSpeechError = useCallback((errText) => {
    useChatStore.getState().setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'ai',
        content: errText,
      },
    ])
  }, [])

  const {
    inputValue,
    setInputValue,
    selectedImage,
    setSelectedImage,
    showScanModePicker,
    setShowScanModePicker,
    showMediaSourcePicker,
    setShowMediaSourcePicker,
    inputRef,
    fileInputRef,
    cameraInputRef,
    handleImageSelect,
    isRecording,
    toggleRecording,
    handleStopRecording,
    handleCancelRecording,
  } = useChatInputState({ locale, onSpeechError: handleSpeechError })

  const chatScrollContainerRef = useRef(null)

  const {
    isLoading,
    handleSend,
  } = useChatEngine({
    locale,
    defaultCurrency,
    defaultWalletId,
    wallets,
    messages: useChatStore((s) => s.messages),
    setMessages: useChatStore((s) => s.setMessages),
    chatScrollContainerRef,
    inputRef,
    inputValue,
    selectedImage,
    setSelectedImage,
    setInputValue,
    setShowScanModePicker,
  })

  const {
    messagesEndRef,
    showScrollFAB,
    unreadCount,
    handleScroll,
    scrollToBottom,
  } = useChatScroll({
    messages: useChatStore((s) => s.messages),
    isLoading,
    chatScrollContainerRef,
  })

  const handleStagePrompt = useCallback(
    (prompt) => {
      setInputValue(prompt)
      if (inputRef.current) {
        inputRef.current.focus()
        const len = prompt.length
        inputRef.current.setSelectionRange?.(len, len)
      }
    },
    [setInputValue, inputRef],
  )

  const handleInitialPrompt = useCallback(
    (prompt) => {
      handleStagePrompt(prompt)
    },
    [handleStagePrompt],
  )

  const {
    messages,
    setMessages,
    handleClear,
  } = useChatSession({
    locale,
    isLoading,
    onInitialPrompt: handleInitialPrompt,
  })

  const {
    handleConfirmDelete,
    handleCancelDelete,
    handleUndoTransaction,
  } = useChatDeletion({
    setMessages,
    locale,
  })

  const handleStartEdit = useCallback((tx) => {
    if (!tx) return
    setEditingTransaction(tx)
    setEditFormData({
      id: tx.id,
      amount: formatMoneyInput(String(tx.amount || 0), tx.currency || defaultCurrency),
      type: tx.type || 'expense',
      category: tx.category || '',
      date: tx.date || getLocalDateString(),
      walletId: tx.walletId ? String(tx.walletId) : '',
      targetWalletId: tx.targetWalletId ? String(tx.targetWalletId) : '',
      notes: (isFieldEncrypted(tx.notes) ? getDecryptedNoteSync(tx.notes) : tx.notes) || '',
      currency: tx.currency || defaultCurrency,
      isSplit: Boolean(tx.isSplit),
      splitItems: Array.isArray(tx.splitItems)
        ? tx.splitItems.map((si) => ({
            ...si,
            notes: (isFieldEncrypted(si?.notes) ? getDecryptedNoteSync(si.notes) : si?.notes) || '',
          }))
        : [],
      receiptImage: tx.receiptImage || null,
      isExcludeAnalyticsTx: Boolean(tx.isExcludeAnalyticsTx),
    })
  }, [defaultCurrency])

  const handleSaveEdit = useCallback(async () => {
    if (!editFormData || !editingTransaction) return
    const rawAmt = parseMoneyInput(editFormData.amount, editFormData.currency)
    if (rawAmt <= 0) return

    const updatedTx = {
      ...editingTransaction,
      ...editFormData,
      amount: rawAmt,
      updatedAt: new Date().toISOString(),
    }

    try {
      await updateTransaction(updatedTx.id, updatedTx)
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.type === 'success' && msg.data) {
            if (Array.isArray(msg.data)) {
              return {
                ...msg,
                data: msg.data.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
              }
            } else if (msg.data.id === updatedTx.id) {
              return { ...msg, data: updatedTx }
            }
          }
          return msg
        })
      )
      setEditingTransaction(null)
      setEditFormData(null)
    } catch (err) {
      console.warn('[AiFinanceChat] handleSaveEdit error:', err)
    }
  }, [editFormData, editingTransaction, setMessages])

  // Android Hardware Back Button Handlers
  useBackButton(() => {
    setEditingTransaction(null)
    setEditFormData(null)
  }, Boolean(editingTransaction))
  useBackButton(() => setContextMenuMsg(null), Boolean(contextMenuMsg))
  useBackButton(() => setShowTexturePicker(false), Boolean(showTexturePicker))
  useBackButton(() => setShowClearConfirm(false), Boolean(showClearConfirm))
  useBackButton(() => setShowMediaSourcePicker(false), Boolean(showMediaSourcePicker))
  useBackButton(() => {
    setShowScanModePicker(false)
    setSelectedImage(null)
  }, Boolean(showScanModePicker))
  useBackButton(() => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }, true)

  const handleMsgTouchStart = useCallback((msg) => {
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic('medium')
      setContextMenuMsg(msg)
    }, 450)
  }, [])

  const handleMsgTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
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
      <ChatHeaderToolbar
        onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
        isOnline={isOnline}
        locale={locale}
        showTexturePicker={showTexturePicker}
        setShowTexturePicker={setShowTexturePicker}
        backgroundTexture={backgroundTexture}
        setBackgroundTexture={setBackgroundTexture}
        textureDropdownRef={textureDropdownRef}
        onOpenClearConfirm={() => setShowClearConfirm(true)}
      />

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

      <Modal
        isOpen={Boolean(showScanModePicker && selectedImage)}
        onClose={() => {
          setShowScanModePicker(false)
          setSelectedImage(null)
        }}
        title={locale === 'en' ? 'Receipt Scan Mode' : 'Mode Scan Struk'}
      >
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
      </Modal>

      <MediaSourcePickerModal
        isOpen={showMediaSourcePicker}
        onClose={() => setShowMediaSourcePicker(false)}
        onSelectCamera={() => cameraInputRef.current?.click()}
        onSelectGallery={() => fileInputRef.current?.click()}
        locale={locale}
      />

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

      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        locale={locale}
        defaultCurrency={defaultCurrency}
        todayExpense={todayExpense}
        chatScrollContainerRef={chatScrollContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        onSend={handleSend}
        onStagePrompt={handleStagePrompt}
        onMsgTouchStart={handleMsgTouchStart}
        onMsgTouchMove={handleMsgTouchMove}
        onMsgTouchEnd={handleMsgTouchEnd}
        onMsgContextMenu={handleMsgContextMenu}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={handleCancelDelete}
        onUndoTransaction={handleUndoTransaction}
      />

      <ScrollToBottomFAB
        isVisible={showScrollFAB}
        unreadCount={unreadCount}
        onClick={scrollToBottom}
      />

      <ChatInputBar
        inputValue={inputValue}
        setInputValue={setInputValue}
        inputRef={inputRef}
        isRecording={isRecording}
        isLoading={isLoading}
        selectedImage={selectedImage}
        onSend={(text, img) => handleSend(text ?? inputValue, img ?? selectedImage)}
        onToggleRecording={toggleRecording}
        onStopRecording={handleStopRecording}
        onCancelRecording={handleCancelRecording}
        onOpenMediaPicker={() => setShowMediaSourcePicker(true)}
        locale={locale}
      />

      <MessageContextMenu
        isOpen={Boolean(contextMenuMsg)}
        onClose={() => setContextMenuMsg(null)}
        messageContent={contextMenuMsg?.content || ''}
        messageType={contextMenuMsg?.role === 'user' ? 'user' : contextMenuMsg?.type === 'success' ? 'transaction' : 'ai'}
        messageData={contextMenuMsg?.data}
        onCopyText={async (text) => {
          let textToCopy = text || contextMenuMsg?.content || ''
          if (!textToCopy && contextMenuMsg?.type === 'success' && contextMenuMsg?.data) {
            const tx = Array.isArray(contextMenuMsg.data) ? contextMenuMsg.data[0] : contextMenuMsg.data
            const catLabel = getTransactionCategoryLabels(tx.category, tx.type, locale)?.main || tx.category
            const rawNote = tx?.notes
            const plain = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
            const safeNote = isFieldEncrypted(plain) ? '' : (plain || '')
            textToCopy = `${safeNote || catLabel || (locale === 'en' ? 'Transaction' : 'Transaksi')}: ${formatCurrency(tx.amount, tx.currency || defaultCurrency)}`
          }
          const success = await copyToClipboard(textToCopy)
          if (success) {
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: locale === 'en' ? 'Copied' : 'Disalin',
                  message: locale === 'en' ? 'Text copied to clipboard' : 'Teks berhasil disalin ke papan klip',
                  type: 'info',
                },
              }),
            )
          }
        }}
        onCopyAmount={async (amt) => {
          let amtToCopy = amt
          if (!amtToCopy && contextMenuMsg?.data) {
            const tx = Array.isArray(contextMenuMsg.data) ? contextMenuMsg.data[0] : contextMenuMsg.data
            if (tx?.amount != null) amtToCopy = String(tx.amount)
          }
          const success = await copyToClipboard(amtToCopy)
          if (success) {
            window.dispatchEvent(
              new CustomEvent('ft-show-toast', {
                detail: {
                  title: locale === 'en' ? 'Copied' : 'Disalin',
                  message: locale === 'en' ? 'Amount copied' : 'Nominal berhasil disalin',
                  type: 'info',
                },
              }),
            )
          }
        }}
        onEditTransaction={(data) => {
          const tx = Array.isArray(data) ? data[0] : (data || contextMenuMsg?.data)
          if (tx) {
            handleStartEdit(tx)
          }
        }}
        onDeleteMessage={() => {
          if (contextMenuMsg) {
            setMessages((prev) => prev.filter((m) => m.id !== contextMenuMsg.id))
          }
        }}
      />

      {Boolean(editingTransaction && editFormData) && (
        <TransactionEditSheet
          isOpen={Boolean(editingTransaction)}
          formData={editFormData}
          setFormData={setEditFormData}
          onSubmit={handleSaveEdit}
          onClose={() => {
            setEditingTransaction(null)
            setEditFormData(null)
          }}
          locale={locale}
          wallets={wallets}
        />
      )}
    </div>
  )
}
