import { useState, useRef, useEffect, useCallback } from 'react'
import { triggerHaptic } from '../../../lib/haptics'

export function useChatScroll({
  messages = [],
  isLoading = false,
  chatScrollContainerRef: externalContainerRef,
}) {
  const internalContainerRef = useRef(null)
  const chatScrollContainerRef = externalContainerRef || internalContainerRef
  const messagesEndRef = useRef(null)
  const [showScrollFAB, setShowScrollFAB] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const handleScroll = useCallback(() => {
    const el = chatScrollContainerRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isFar = distanceToBottom > 150
    setShowScrollFAB(isFar)
    if (!isFar) {
      setUnreadCount(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollToBottom = useCallback(() => {
    triggerHaptic('light')
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    setShowScrollFAB(false)
    setUnreadCount(0)
  }, [])

  const prevMsgLengthRef = useRef(messages.length)

  useEffect(() => {
    const el = chatScrollContainerRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNear = distanceToBottom < 150
    const hasNewMessage = messages.length > prevMsgLengthRef.current
    prevMsgLengthRef.current = messages.length

    if (isLoading) {
      if (isNear) {
        el.scrollTop = el.scrollHeight
      }
    } else {
      if (isNear) {
        if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      } else if (hasNewMessage) {
        setUnreadCount((c) => c + 1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading])

  return {
    chatScrollContainerRef,
    messagesEndRef,
    showScrollFAB,
    unreadCount,
    handleScroll,
    scrollToBottom,
  }
}
