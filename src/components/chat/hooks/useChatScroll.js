import { useState, useRef, useEffect, useCallback } from 'react'
import { triggerHaptic } from '../../../lib/haptics'

export function useChatScroll({
  messages = [],
  isLoading = false,
}) {
  const chatScrollContainerRef = useRef(null)
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
  }, [])

  const scrollToBottom = useCallback(() => {
    triggerHaptic('light')
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    setShowScrollFAB(false)
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    const el = chatScrollContainerRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNear = distanceToBottom < 150

    if (isLoading) {
      if (isNear) {
        el.scrollTop = el.scrollHeight
      }
    } else {
      if (isNear) {
        if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      } else {
        setUnreadCount((c) => c + 1)
      }
    }
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
