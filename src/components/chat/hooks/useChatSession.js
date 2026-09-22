import { useEffect, useCallback } from 'react'
import { db } from '../../../lib/db'
import useChatStore from '../../../store/useChatStore'
import { translate } from '../../../lib/i18n'
import { triggerHaptic } from '../../../lib/haptics'

export function useChatSession({
  locale = 'id',
  isLoading = false,
  onInitialPrompt,
}) {
  const messages = useChatStore((s) => s.messages)
  const setMessages = useChatStore((s) => s.setMessages)
  const initialInput = useChatStore((s) => s.initialInput)
  const setInitialInput = useChatStore((s) => s.setInitialInput)

  // Lifecycle retention: prune db.chatMessages older than 90 days and rehydrate on mount
  useEffect(() => {
    let isMounted = true
    const initChatMessages = async () => {
      try {
        if (db.chatMessages) {
          const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
          await db.chatMessages.where('timestamp').below(ninetyDaysAgo).delete()

          if (useChatStore.getState().messages.length === 0) {
            const stored = await db.chatMessages.orderBy('timestamp').toArray()
            if (isMounted && stored.length > 0) {
              setMessages(stored)
              return
            }
          }
        }
      } catch (err) {
        console.error('[useChatSession] Failed to init chat messages from DB:', err)
      }

      if (isMounted && useChatStore.getState().messages.length === 0) {
        setMessages([
          {
            id: Date.now(),
            timestamp: Date.now(),
            role: 'ai',
            type: 'welcome',
            content: translate(locale, 'aiChat.welcome') || 'Halo! Saya asisten AI keuangan Anda. Ada yang bisa saya bantu catat atau analisis hari ini?',
          },
        ])
      }
    }

    initChatMessages()
    return () => {
      isMounted = false
    }
  }, [locale, setMessages])

  // Persist messages to db.chatMessages when not loading or streaming
  useEffect(() => {
    if (isLoading) return
    if (!messages || messages.length === 0) return

    const persistTimeout = setTimeout(async () => {
      try {
        if (!db.chatMessages) return
        const toSave = messages.map((m) => ({
          ...m,
          timestamp: m.timestamp || m.id || Date.now(),
        }))
        await db.transaction('rw', db.chatMessages, async () => {
          await db.chatMessages.clear()
          await db.chatMessages.bulkAdd(toSave)
        })
      } catch (err) {
        console.warn('[useChatSession] Failed to persist chat messages to DB:', err)
      }
    }, 400)

    return () => clearTimeout(persistTimeout)
  }, [messages, isLoading])

  // Auto-execute external initial prompt
  useEffect(() => {
    if (initialInput) {
      const promptToSend = initialInput
      setInitialInput('')
      if (onInitialPrompt) {
        onInitialPrompt(promptToSend)
      }
    }
  }, [initialInput, setInitialInput, onInitialPrompt])

  const handleClear = useCallback(() => {
    triggerHaptic('medium')
    if (db.chatMessages) {
      db.chatMessages.clear().catch((err) => console.error('[useChatSession.handleClear] Failed to clear messages:', err))
    }
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
    if (typeof window !== 'undefined') {
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
        }),
      )
    }
  }, [locale, setMessages])

  return {
    messages,
    setMessages,
    handleClear,
  }
}
