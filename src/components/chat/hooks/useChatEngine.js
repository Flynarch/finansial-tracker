import { useState, useRef, useEffect, useCallback } from 'react'
import { triggerHaptic } from '../../../lib/haptics'
import { translate } from '../../../lib/i18n'
import { getCachedCurrencyRates } from '../../../lib/api'
import { FALLBACK_EXCHANGE_RATES } from '../../../lib/utils'
import { parseTransactionFromText } from '../../../lib/gemini'
import { prepareUnifiedMessage } from '../../../lib/ai/aiChatHelpers'
import { executeAiChatAction } from '../../../lib/ai/chatActions'
import useLoanStore from '../../../store/useLoanStore'

export function useChatEngine({
  locale = 'id',
  defaultCurrency = 'IDR',
  defaultWalletId = null,
  wallets = [],
  messages = [],
  setMessages,
  chatScrollContainerRef,
  inputRef,
  inputValue = '',
  selectedImage = null,
  setSelectedImage,
  setInputValue,
  setShowScanModePicker,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const isStreamingRef = useRef(false)
  const streamBufferRef = useRef('')
  const streamRafRef = useRef(null)
  const handleSendRef = useRef(null)

  const inputValueRef = useRef(inputValue)
  useEffect(() => {
    inputValueRef.current = inputValue
  }, [inputValue])

  const selectedImageRef = useRef(selectedImage)
  useEffect(() => {
    selectedImageRef.current = selectedImage
  }, [selectedImage])

  const addLoan = useLoanStore((s) => s.addLoan)
  const recordPayment = useLoanStore((s) => s.recordPayment)
  const updateLoan = useLoanStore((s) => s.updateLoan)
  const deleteLoan = useLoanStore((s) => s.deleteLoan)

  useEffect(() => {
    return () => {
      if (streamRafRef.current) {
        cancelAnimationFrame(streamRafRef.current)
      }
    }
  }, [])

  const handleSend = useCallback(
    async (text, image, scanMode = 'all', targetWalletId = null) => {
      if (isLoadingRef.current || isStreamingRef.current) return

      const textToSend = (text !== undefined ? text : inputValueRef.current) || ''
      const imageToSend = image !== undefined ? image : (text !== undefined ? null : selectedImageRef.current)
      if (!textToSend?.trim() && !imageToSend) return
      triggerHaptic('light')

      const now = Date.now()
      const clampedText = textToSend ? String(textToSend).slice(0, 4000) : ''
      const userMsg = {
        id: now,
        timestamp: now,
        role: 'user',
        type: 'text',
        content: clampedText,
        image: imageToSend || null,
      }

      inputValueRef.current = ''
      selectedImageRef.current = null
      setInputValue?.('')
      setSelectedImage?.(null)
      setShowScanModePicker?.(false)
      if (inputRef?.current) inputRef.current.style.height = 'auto'

      isLoadingRef.current = true
      setIsLoading(true)

      const aiMsgId = now + 1
      setMessages((prev) => [...prev, userMsg])

      isStreamingRef.current = true
      streamBufferRef.current = ''

      try {
        const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
        const result = await parseTransactionFromText(clampedText || 'Lihat gambar struk ini', {
          locale,
          defaultCurrency,
          previousMessages: messages,
          imageData: imageToSend,
          wallets,
          rates: activeRates,
          scanMode,
          onStream: (chunk) => {
            streamBufferRef.current += chunk
            if (!streamRafRef.current) {
              streamRafRef.current = requestAnimationFrame(() => {
                streamRafRef.current = null
                const currentBuffered = streamBufferRef.current
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === aiMsgId)
                  if (exists) {
                    return prev.map((m) => (m.id === aiMsgId ? { ...m, content: currentBuffered } : m))
                  }
                  return [...prev, { id: aiMsgId, timestamp: aiMsgId, role: 'ai', type: 'text', content: currentBuffered }]
                })
                if (chatScrollContainerRef?.current) {
                  chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight
                }
              })
            }
          },
        })

        if (result?.error) {
          if (result.type === 'omission_clarification' || (Array.isArray(result.chips) && result.chips.length > 0)) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === aiMsgId)
              if (exists) {
                return prev.map((m) => (m.id === aiMsgId ? { ...m, content: result.message, chips: result.chips } : m))
              }
              return [...prev, { id: aiMsgId, timestamp: aiMsgId, role: 'ai', type: 'text', content: result.message, chips: result.chips }]
            })
            return
          }
          throw new Error(result.message)
        }

        const actionContext = {
          locale,
          defaultCurrency,
          defaultWalletId,
          wallets,
          scanMode,
          targetWalletId,
          aiMsgId,
          addLoan,
          recordPayment,
          updateLoan,
          deleteLoan,
        }

        const actionResult = await executeAiChatAction(result, actionContext)

        if (actionResult.isFinancialHealth) {
          const healthMsg = { ...actionResult.healthMsg, id: aiMsgId, timestamp: actionResult.healthMsg?.timestamp || aiMsgId }
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === aiMsgId)
            if (exists) {
              return prev.map((m) => (m.id === aiMsgId ? healthMsg : m))
            }
            return [...prev, healthMsg]
          })
          return
        }

        const { newMsgs = [] } = actionResult

        if (newMsgs.length > 0) {
          const rawUnified = prepareUnifiedMessage(newMsgs, result)
          const unifiedMsg = { ...rawUnified, id: aiMsgId, timestamp: rawUnified?.timestamp || aiMsgId }
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === aiMsgId)
            if (exists) {
              return prev.map((m) => (m.id === aiMsgId ? unifiedMsg : m))
            }
            return [...prev, unifiedMsg]
          })
        } else if (result?.text) {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === aiMsgId)
            if (exists) {
              return prev.map((m) => (m.id === aiMsgId ? { ...m, content: result.text, chips: result.chips } : m))
            }
            return [...prev, { id: aiMsgId, timestamp: aiMsgId, role: 'ai', type: 'text', content: result.text, chips: result.chips }]
          })
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId))
        }
      } catch (err) {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
        const offlineMsg = locale === 'en'
          ? 'No internet connection. Please check your network connection and try again.'
          : 'Tidak ada koneksi internet. Silakan periksa jaringan Anda dan coba lagi.'
        const displayMsg = err?.message || (isOffline ? offlineMsg : translate(locale, 'aiChat.error'))

        const errTimestamp = Date.now()
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== aiMsgId)
          return [
            ...filtered,
            {
              id: errTimestamp,
              timestamp: errTimestamp,
              role: 'ai',
              type: 'text',
              content: displayMsg,
            },
          ]
        })
      } finally {
        if (streamRafRef.current) {
          cancelAnimationFrame(streamRafRef.current)
          streamRafRef.current = null
        }
        isStreamingRef.current = false
        isLoadingRef.current = false
        setIsLoading(false)
        if (inputRef?.current) inputRef.current.focus()
      }
    },
    [
      locale,
      defaultCurrency,
      defaultWalletId,
      wallets,
      messages,
      setMessages,
      chatScrollContainerRef,
      inputRef,
      setSelectedImage,
      setInputValue,
      setShowScanModePicker,
      addLoan,
      recordPayment,
      updateLoan,
      deleteLoan,
    ],
  )

  useEffect(() => {
    handleSendRef.current = handleSend
  }, [handleSend])

  return {
    isLoading,
    isStreamingRef,
    handleSend,
    handleSendRef,
  }
}
