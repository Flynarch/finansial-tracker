// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react'
import { ReasoningIndicator, AiBubble } from '../src/components/chat/ChatBubble'
import MessageContextMenu from '../src/components/chat/MessageContextMenu'
import ChatMessageItem from '../src/components/chat/ChatMessageItem'
import CardCarousel from '../src/components/chat/CardCarousel'
import { useChatEngine } from '../src/components/chat/hooks/useChatEngine'
import * as geminiModule from '../src/lib/gemini'
import * as hapticsModule from '../src/lib/haptics'
import useSettingsStore from '../src/store/useSettingsStore'

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

describe('AI Chat Thinking Polish, Regenerate Animation & Gesture Smoothness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ locale: 'id' })
  })

  afterEach(() => {
    cleanup()
  })

  describe('ReasoningIndicator Polish & Dynamic States', () => {
    it('renders clean thinking indicator in Indonesian by default without fake counter', () => {
      const { container } = render(<ReasoningIndicator hasImage={false} />)

      const cardEl = container.querySelector('.ft-reasoning-card')
      expect(cardEl).toBeDefined()

      const stepText = container.querySelector('.ft-reasoning-step-enter')
      expect(stepText).toBeDefined()
      expect(stepText.textContent).toBe('Sedang berpikir...')

      // No fake robotic counter like 1/6
      const stepCounter = container.querySelector('span.tabular-nums')
      expect(stepCounter).toBeNull()
    })

    it('renders receipt-specific scanning indicator when hasImage is true', () => {
      const { container } = render(<ReasoningIndicator hasImage={true} />)

      const stepText = container.querySelector('.ft-reasoning-step-enter')
      expect(stepText.textContent).toBe('Memindai struk...')

      // No fake robotic counter like 1/5
      const stepCounter = container.querySelector('span.tabular-nums')
      expect(stepCounter).toBeNull()
    })

    it('renders thinking indicator in English when locale is en', () => {
      useSettingsStore.setState({ locale: 'en' })
      const { container } = render(<ReasoningIndicator hasImage={false} />)

      const stepText = container.querySelector('.ft-reasoning-step-enter')
      expect(stepText.textContent).toBe('Thinking...')
    })
  })

  describe('AiBubble Regenerate Button & Animations', () => {
    it('renders regenerate button when onRegenerate is provided and message is not streaming', () => {
      const onRegenerate = vi.fn()
      render(
        <AiBubble
          msgId="ai-123"
          content="Total pengeluaran Anda adalah Rp 50.000."
          timestamp={1700000000000}
          onRegenerate={onRegenerate}
          isStreaming={false}
        />
      )

      const regenBtn = screen.getByRole('button', { name: /buat ulang/i })
      expect(regenBtn).toBeDefined()

      fireEvent.click(regenBtn)
      expect(onRegenerate).toHaveBeenCalledWith('ai-123')
      expect(hapticsModule.triggerHaptic).toHaveBeenCalledWith('light')
    })

    it('does not render regenerate button while message is currently streaming', () => {
      const onRegenerate = vi.fn()
      render(
        <AiBubble
          msgId="ai-123"
          content="Sedang mengetik..."
          timestamp={1700000000000}
          onRegenerate={onRegenerate}
          isStreaming={true}
        />
      )

      const regenBtn = screen.queryByRole('button', { name: /buat ulang/i })
      expect(regenBtn).toBeNull()
    })

    it('applies ft-regenerate-enter class when isNew or isRegenerating is true', () => {
      const { container } = render(
        <AiBubble
          msgId="ai-456"
          content="Hasil setelah regenerate."
          timestamp={1700000000000}
          isRegenerating={true}
        />
      )

      const proseEl = container.querySelector('.ft-md-prose')
      expect(proseEl.className).toContain('ft-regenerate-enter')
    })
  })

  describe('MessageContextMenu Regenerate Option for AI Messages', () => {
    it('shows "Buat Ulang Tanggapan" in context menu when messageType is ai', () => {
      vi.useFakeTimers()
      const onRegenerate = vi.fn()
      const onClose = vi.fn()

      render(
        <MessageContextMenu
          isOpen={true}
          onClose={onClose}
          messageType="ai"
          messageContent="Tanggapan AI terdahulu"
          messageId="ai-msg-999"
          onRegenerate={onRegenerate}
        />
      )

      const regenItem = screen.getByRole('button', { name: /buat ulang tanggapan/i })
      expect(regenItem).toBeDefined()

      fireEvent.click(regenItem)
      expect(onRegenerate).toHaveBeenCalledWith('ai-msg-999')
      expect(hapticsModule.triggerHaptic).toHaveBeenCalledWith('light')

      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(onClose).toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('useChatEngine handleRegenerate Flow', () => {
    it('locates preceding user message and re-runs parseTransactionFromText without duplicate user message', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Jawaban baru yang telah diperbarui.',
      })

      let messages = [
        { id: 100, role: 'user', content: 'Berapa saldo di BCA?', timestamp: 100 },
        { id: 101, role: 'ai', content: 'Saldo BCA Anda adalah Rp 500.000.', timestamp: 101 },
      ]

      const setMessages = vi.fn((updater) => {
        if (typeof updater === 'function') {
          messages = updater(messages)
        } else {
          messages = updater
        }
      })

      const { result } = renderHook(() =>
        useChatEngine({
          locale: 'id',
          defaultCurrency: 'IDR',
          wallets: [],
          messages,
          setMessages,
          inputValue: '',
          selectedImage: null,
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleRegenerate(101)
      })

      // Must call parseTransactionFromText with original user text
      expect(parseSpy).toHaveBeenCalledWith(
        'Berapa saldo di BCA?',
        expect.objectContaining({
          locale: 'id',
          defaultCurrency: 'IDR',
        })
      )

      // The old AI message should be replaced and user message should not be duplicated
      const userMsgs = messages.filter((m) => m.role === 'user')
      expect(userMsgs).toHaveLength(1)
      expect(userMsgs[0].content).toBe('Berapa saldo di BCA?')

      const aiMsgs = messages.filter((m) => m.role === 'ai')
      expect(aiMsgs).toHaveLength(1)
      expect(aiMsgs[0].content).toBe('Jawaban baru yang telah diperbarui.')
    })
  })

  describe('ChatMessageItem Horizontal Swipe & Reply Gesture', () => {
    it('stages message into input when swiped right past 36px threshold', () => {
      const onStagePrompt = vi.fn()
      const msg = { id: 1, role: 'user', content: 'Kopi Kenangan 22rb', timestamp: 1000 }

      const { container } = render(
        <ChatMessageItem
          msg={msg}
          onStagePrompt={onStagePrompt}
          locale="id"
        />
      )

      const cardContainer = container.querySelector('.touch-pan-y')
      expect(cardContainer).toBeDefined()

      // Simulate swipe right: start at x=50, move to x=150 (dx=100 > 36), end touch
      fireEvent.touchStart(cardContainer, {
        touches: [{ clientX: 50, clientY: 100 }],
      })
      fireEvent.touchMove(cardContainer, {
        touches: [{ clientX: 150, clientY: 102 }],
      })
      fireEvent.touchEnd(cardContainer)

      expect(onStagePrompt).toHaveBeenCalledWith('Kopi Kenangan 22rb')
      expect(hapticsModule.triggerHaptic).toHaveBeenCalledWith('medium')
    })
  })

  describe('CardCarousel Smooth Momentum & Drag Support', () => {
    it('renders with scroll-smooth and touch-pan-x classes', () => {
      const { container } = render(
        <CardCarousel cardWidth={250}>
          <div>Card 1</div>
          <div>Card 2</div>
        </CardCarousel>
      )

      const scrollContainer = container.querySelector('.scroll-smooth')
      expect(scrollContainer).toBeDefined()
      expect(scrollContainer.className).toContain('touch-pan-x')
      expect(scrollContainer.className).toContain('overscroll-x-contain')

      // Slide buttons are rendered for pagination
      const slideBtns = screen.getAllByRole('button', { name: /slide/i })
      expect(slideBtns).toHaveLength(2)
    })
  })
})
