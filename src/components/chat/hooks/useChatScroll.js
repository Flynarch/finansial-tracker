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
  const [isScrolled, setIsScrolled] = useState(false)

  const handleScroll = useCallback(() => {
    const el = chatScrollContainerRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isFar = distanceToBottom > 150
    setShowScrollFAB(isFar)
    setIsScrolled(el.scrollTop > 15)
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
  const isInitialMountRef = useRef(true)

  useEffect(() => {
    const el = chatScrollContainerRef.current
    if (!el) return

    const hasRealMessages = messages.some(
      (m) => m.type !== 'welcome' && (m.role === 'user' || m.role === 'ai')
    )

    // On initial mount with no real messages, ensure pinned at top
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      if (!hasRealMessages) {
        el.scrollTop = 0
        prevMsgLengthRef.current = messages.length
        return
      }
    }

    // Never auto-scroll to bottom on welcome screen
    if (!hasRealMessages) {
      prevMsgLengthRef.current = messages.length
      return
    }

    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNear = distanceToBottom < 150
    const hasNewMessage = messages.length > prevMsgLengthRef.current
    prevMsgLengthRef.current = messages.length

    if (isLoading) {
      if (isNear) {
        el.scrollTop = el.scrollHeight
      }
    } else {
      if (hasNewMessage && isNear) {
        if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      } else if (hasNewMessage && !isNear) {
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
    isScrolled,
    handleScroll,
    scrollToBottom,
  }
}
