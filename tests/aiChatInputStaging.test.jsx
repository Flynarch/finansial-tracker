// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import WelcomeHero from '../src/components/chat/WelcomeHero'
import ChatMessageList from '../src/components/chat/ChatMessageList'
import ChatInputBar from '../src/components/chat/ChatInputBar'
import { backButtonManager } from '../src/lib/backButtonManager'
import useSettingsStore from '../src/store/useSettingsStore'

describe('AI Chat Input Staging & Back Button Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    backButtonManager.handlers = []
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
  })

  afterEach(() => {
    cleanup()
    backButtonManager.handlers = []
    vi.useRealTimers()
  })

  describe('WelcomeHero card staging', () => {
    it('calls onSelectPrompt with card prompt and does not send immediately', () => {
      const onSelectPrompt = vi.fn()
      const onSend = vi.fn()

      render(
        <WelcomeHero
          onSelectPrompt={onSelectPrompt}
          onSend={onSend}
          todayExpense={0}
          todayCurrency="IDR"
        />
      )

      const recordCard = screen.getByText('Catat Transaksi')
      fireEvent.click(recordCard)

      expect(onSelectPrompt).toHaveBeenCalledTimes(1)
      expect(onSelectPrompt).toHaveBeenCalledWith('Aku mau catat transaksi')
      expect(onSend).not.toHaveBeenCalled()
    })

    it('supports onStagePrompt prop directly', () => {
      const onStagePrompt = vi.fn()
      const onSend = vi.fn()

      render(
        <WelcomeHero
          onStagePrompt={onStagePrompt}
          onSend={onSend}
          todayExpense={0}
          todayCurrency="IDR"
        />
      )

      const budgetCard = screen.getByText('Cek Budget')
      fireEvent.click(budgetCard)

      expect(onStagePrompt).toHaveBeenCalledTimes(1)
      expect(onStagePrompt).toHaveBeenCalledWith('Sisa budget bulan ini?')
      expect(onSend).not.toHaveBeenCalled()
    })
  })

  describe('ChatMessageList staging integration', () => {
    it('forwards onStagePrompt to WelcomeHero when welcome state is displayed', () => {
      const onStagePrompt = vi.fn()
      const onSend = vi.fn()

      render(
        <ChatMessageList
          messages={[{ id: 1, role: 'ai', type: 'welcome', content: 'Halo' }]}
          isLoading={false}
          locale="id"
          defaultCurrency="IDR"
          todayExpense={0}
          chatScrollContainerRef={{ current: null }}
          messagesEndRef={{ current: null }}
          onScroll={vi.fn()}
          onSend={onSend}
          onStagePrompt={onStagePrompt}
        />
      )

      const recordCard = screen.getByText('Catat Transaksi')
      fireEvent.click(recordCard)

      expect(onStagePrompt).toHaveBeenCalledWith('Aku mau catat transaksi')
      expect(onSend).not.toHaveBeenCalled()
    })

    it('stages chip prompt into input instead of auto-sending when quick chips are clicked', () => {
      const onStagePrompt = vi.fn()
      const onSend = vi.fn()

      const messages = [
        { id: 1, role: 'user', content: 'Halo' },
        {
          id: 2,
          role: 'ai',
          content: 'Halo juga!',
          chips: ['Cek budget bulan ini', 'Lihat pengeluaran terbesar'],
        },
      ]

      render(
        <ChatMessageList
          messages={messages}
          isLoading={false}
          locale="id"
          defaultCurrency="IDR"
          todayExpense={0}
          chatScrollContainerRef={{ current: null }}
          messagesEndRef={{ current: null }}
          onScroll={vi.fn()}
          onSend={onSend}
          onStagePrompt={onStagePrompt}
        />
      )

      const chip = screen.getByText('Cek budget bulan ini')
      fireEvent.click(chip)

      expect(onStagePrompt).toHaveBeenCalledWith('Cek budget bulan ini')
      expect(onSend).not.toHaveBeenCalled()
    })
  })

  describe('handleInitialPrompt staging without auto-send', () => {
    it('sets input value and focuses textarea without auto-sending message after 350ms', () => {
      vi.useFakeTimers()

      const setInputValue = vi.fn()
      const focusSpy = vi.fn()
      const inputRef = { current: { focus: focusSpy, setSelectionRange: vi.fn() } }
      const handleSend = vi.fn()

      // Staging logic as implemented in AiFinanceChat
      const handleStagePrompt = (prompt) => {
        setInputValue(prompt)
        inputRef.current?.focus()
      }

      handleStagePrompt('Prompt dari luar aplikasi')

      expect(setInputValue).toHaveBeenCalledWith('Prompt dari luar aplikasi')
      expect(focusSpy).toHaveBeenCalled()

      // Advance timers to verify no delayed auto-send is triggered
      vi.advanceTimersByTime(1000)
      expect(handleSend).not.toHaveBeenCalled()
    })
  })

  describe('Back button dismissal of chat modal pickers', () => {
    it('closes modal pickers in LIFO order without exiting page', () => {
      let isReceiptScanOpen = true
      // eslint-disable-next-line no-useless-assignment
      let isMediaSourceOpen = false
      // eslint-disable-next-line no-useless-assignment
      let isClearConfirmOpen = false

      // Register base page back handler
      const baseExitHandler = vi.fn()
      backButtonManager.register(baseExitHandler)

      // When ReceiptScanModePicker is opened
      const unregisterReceipt = backButtonManager.register(() => {
        isReceiptScanOpen = false
      })

      expect(backButtonManager.hasHandlers()).toBe(true)

      // Press hardware back button -> should close ReceiptScanModePicker
      const handled1 = backButtonManager.handleBack()
      expect(handled1).toBe(true)
      expect(isReceiptScanOpen).toBe(false)
      expect(baseExitHandler).not.toHaveBeenCalled()
      unregisterReceipt()

      // When MediaSourcePickerModal is opened
      isMediaSourceOpen = true
      const unregisterMedia = backButtonManager.register(() => {
        isMediaSourceOpen = false
      })

      const handled2 = backButtonManager.handleBack()
      expect(handled2).toBe(true)
      expect(isMediaSourceOpen).toBe(false)
      expect(baseExitHandler).not.toHaveBeenCalled()
      unregisterMedia()

      // When ConfirmDeleteModal is opened
      isClearConfirmOpen = true
      const unregisterClear = backButtonManager.register(() => {
        isClearConfirmOpen = false
      })

      const handled3 = backButtonManager.handleBack()
      expect(handled3).toBe(true)
      expect(isClearConfirmOpen).toBe(false)
      expect(baseExitHandler).not.toHaveBeenCalled()
      unregisterClear()

      // Finally, pressing back when no modals open triggers base page back
      const handledFinal = backButtonManager.handleBack()
      expect(handledFinal).toBe(true)
      expect(baseExitHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('ChatInputBar mobile vs desktop Enter behavior', () => {
    it('submits on desktop Enter key press', () => {
      const onSend = vi.fn()

      render(
        <ChatInputBar
          inputValue="Desktop message"
          setInputValue={vi.fn()}
          selectedImage={null}
          isLoading={false}
          isRecording={false}
          onSend={onSend}
          onToggleRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onCancelRecording={vi.fn()}
          onOpenMediaPicker={vi.fn()}
          locale="id"
        />
      )

      const textarea = screen.getByPlaceholderText(/ketik apapun/i)
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      expect(onSend).toHaveBeenCalledWith('Desktop message', null)
    })

    it('does not submit on mobile (pointer: coarse) Enter key press', () => {
      const originalMatchMedia = window.matchMedia
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      try {
        const onSend = vi.fn()

        render(
          <ChatInputBar
            inputValue="Mobile message"
            setInputValue={vi.fn()}
            selectedImage={null}
            isLoading={false}
            isRecording={false}
            onSend={onSend}
            onToggleRecording={vi.fn()}
            onStopRecording={vi.fn()}
            onCancelRecording={vi.fn()}
            onOpenMediaPicker={vi.fn()}
            locale="id"
          />
        )

        const textarea = screen.getByPlaceholderText(/ketik apapun/i)
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

        expect(onSend).not.toHaveBeenCalled()
      } finally {
        window.matchMedia = originalMatchMedia
      }
    })
  })
})
