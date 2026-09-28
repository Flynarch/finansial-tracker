// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react'
import ChatInputBar from '../src/components/chat/ChatInputBar'
import { useChatEngine } from '../src/components/chat/hooks/useChatEngine'
import * as geminiModule from '../src/lib/gemini'

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

describe('AI Chat Engine & Input Bar Message Sending Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('ChatInputBar Component Interaction', () => {
    it('calls onSend with inputValue and selectedImage when form is submitted', () => {
      const onSend = vi.fn()
      const setInputValue = vi.fn()

      render(
        <ChatInputBar
          inputValue="Beli kopi 25rb"
          setInputValue={setInputValue}
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

      const sendButton = screen.getByRole('button', { name: /kirim/i })
      expect(sendButton.disabled).toBe(false)

      fireEvent.click(sendButton)
      expect(onSend).toHaveBeenCalledTimes(1)
      expect(onSend).toHaveBeenCalledWith('Beli kopi 25rb', null)
    })

    it('calls onSend with inputValue and selectedImage when Enter key is pressed', () => {
      const onSend = vi.fn()
      const setInputValue = vi.fn()

      render(
        <ChatInputBar
          inputValue="Cek sisa budget"
          setInputValue={setInputValue}
          selectedImage="data:image/jpeg;base64,mock"
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

      expect(onSend).toHaveBeenCalledTimes(1)
      expect(onSend).toHaveBeenCalledWith('Cek sisa budget', 'data:image/jpeg;base64,mock')
    })

    it('does not trigger onSend when Shift+Enter is pressed in textarea', () => {
      const onSend = vi.fn()

      render(
        <ChatInputBar
          inputValue="Baris pertama"
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
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      expect(onSend).not.toHaveBeenCalled()
    })

    it('disables submit button when inputValue is empty and no image is attached', () => {
      render(
        <ChatInputBar
          inputValue=""
          setInputValue={vi.fn()}
          selectedImage={null}
          isLoading={false}
          isRecording={false}
          onSend={vi.fn()}
          onToggleRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onCancelRecording={vi.fn()}
          onOpenMediaPicker={vi.fn()}
          locale="id"
        />
      )

      const sendButton = screen.getByRole('button', { name: /kirim/i })
      expect(sendButton.disabled).toBe(true)
    })

    it('does not trigger onSend when Enter key is pressed while isLoading is true', () => {
      const onSend = vi.fn()

      render(
        <ChatInputBar
          inputValue="Kopi 25rb"
          setInputValue={vi.fn()}
          selectedImage={null}
          isLoading={true}
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
    })

    it('does not trigger onSend when form is submitted while isLoading is true', () => {
      const onSend = vi.fn()

      const { container } = render(
        <ChatInputBar
          inputValue="Kopi 25rb"
          setInputValue={vi.fn()}
          selectedImage={null}
          isLoading={true}
          isRecording={false}
          onSend={onSend}
          onToggleRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onCancelRecording={vi.fn()}
          onOpenMediaPicker={vi.fn()}
          locale="id"
        />
      )

      const form = container.querySelector('form')
      fireEvent.submit(form)

      expect(onSend).not.toHaveBeenCalled()
    })

    it('does not trigger onSend when Enter is pressed with purely whitespace input and no image', () => {
      const onSend = vi.fn()

      render(
        <ChatInputBar
          inputValue="    "
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
    })

    it('does not trigger onSend when Enter is pressed while IME composition is active (Android keyboard)', () => {
      const onSend = vi.fn()

      render(
        <ChatInputBar
          inputValue="Kopi"
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
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, keyCode: 229 })

      expect(onSend).not.toHaveBeenCalled()
    })
  })

  describe('useChatEngine Hook Send Resolution', () => {
    it('successfully sends message when handleSend() is invoked with zero arguments by falling back to inputValue', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Halo! Ada yang bisa saya bantu?',
      })

      let messages = []
      const setMessages = vi.fn((updater) => {
        if (typeof updater === 'function') {
          messages = updater(messages)
        } else {
          messages = updater
        }
      })
      const setInputValue = vi.fn()
      const setSelectedImage = vi.fn()

      const { result } = renderHook(() =>
        useChatEngine({
          locale: 'id',
          defaultCurrency: 'IDR',
          wallets: [],
          messages,
          setMessages,
          inputValue: 'Beli bensin 50rb',
          selectedImage: null,
          setInputValue,
          setSelectedImage,
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend()
      })

      // Must have invoked parseTransactionFromText with the inputValue content
      expect(parseSpy).toHaveBeenCalledWith(
        'Beli bensin 50rb',
        expect.objectContaining({
          locale: 'id',
          defaultCurrency: 'IDR',
          imageData: null,
        })
      )

      // Must have cleared the input bar state
      expect(setInputValue).toHaveBeenCalledWith('')
      expect(setSelectedImage).toHaveBeenCalledWith(null)

      // Must have pushed user message and AI response
      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage).toBeDefined()
      expect(userMessage.content).toBe('Beli bensin 50rb')

      const aiMessage = messages.find((m) => m.role === 'ai')
      expect(aiMessage).toBeDefined()
      expect(aiMessage.content).toBe('Halo! Ada yang bisa saya bantu?')
    })

    it('prefers explicit text argument over inputValue when provided', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Catatan pengeluaran tersimpan.',
      })

      let messages = []
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
          inputValue: 'Stale prompt in field',
          selectedImage: null,
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend('Catat Pengeluaran')
      })

      expect(parseSpy).toHaveBeenCalledWith(
        'Catat Pengeluaran',
        expect.objectContaining({
          locale: 'id',
          defaultCurrency: 'IDR',
        })
      )

      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage.content).toBe('Catat Pengeluaran')
    })

    it('does not send message if both text/inputValue and image/selectedImage are empty', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText')
      const setMessages = vi.fn()

      const { result } = renderHook(() =>
        useChatEngine({
          locale: 'id',
          defaultCurrency: 'IDR',
          wallets: [],
          messages: [],
          setMessages,
          inputValue: '   ',
          selectedImage: null,
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend()
      })

      expect(parseSpy).not.toHaveBeenCalled()
      expect(setMessages).not.toHaveBeenCalled()
    })

    it('sends attached image when handleSend() is called without explicit image argument', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Struk berhasil dibaca.',
      })

      let messages = []
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
          selectedImage: 'data:image/jpeg;base64,receipt_data',
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend()
      })

      expect(parseSpy).toHaveBeenCalledWith(
        'Lihat gambar struk ini',
        expect.objectContaining({
          imageData: 'data:image/jpeg;base64,receipt_data',
        })
      )

      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage.image).toBe('data:image/jpeg;base64,receipt_data')
    })

    it('attaches immutable timestamp numbers to both user and ai messages', async () => {
      vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Respon dengan timestamp',
      })

      let messages = []
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
          inputValue: 'Cek saldo',
          selectedImage: null,
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend()
      })

      const userMsg = messages.find((m) => m.role === 'user')
      expect(userMsg).toBeDefined()
      expect(typeof userMsg.timestamp).toBe('number')
      expect(userMsg.timestamp).toBeGreaterThan(0)

      const aiMsg = messages.find((m) => m.role === 'ai')
      expect(aiMsg).toBeDefined()
      expect(typeof aiMsg.timestamp).toBe('number')
      expect(aiMsg.timestamp).toBeGreaterThan(0)
    })

    it('ignores subsequent handleSend calls while a response is currently loading (concurrency lock)', async () => {
      let resolveCall
      const pendingPromise = new Promise((resolve) => {
        resolveCall = resolve
      })
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockReturnValue(pendingPromise)

      let messages = []
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
          inputValue: 'Pesan pertama',
          selectedImage: null,
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      // First send initiates loading
      let firstSendPromise
      act(() => {
        firstSendPromise = result.current.handleSend()
      })

      expect(result.current.isLoading).toBe(true)
      expect(parseSpy).toHaveBeenCalledTimes(1)

      // Second send attempted while first is still pending
      await act(async () => {
        await result.current.handleSend('Pesan kedua mendadak')
      })

      // Must NOT have called parseTransactionFromText a second time
      expect(parseSpy).toHaveBeenCalledTimes(1)

      // Now resolve the first call
      await act(async () => {
        resolveCall({ type: 'text', text: 'Respon pertama selesai' })
        await firstSendPromise
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('does not leak selectedImage when handleSend is called with explicit text-only prompt', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Analisis siap',
      })

      let messages = []
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
          selectedImage: 'data:image/jpeg;base64,stale_receipt_in_draft',
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend('Cek Budget')
      })

      // Image data must be null when an explicit chip prompt is clicked
      expect(parseSpy).toHaveBeenCalledWith(
        'Cek Budget',
        expect.objectContaining({
          imageData: null,
        })
      )

      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage.image).toBeNull()
    })

    it('does not leak selectedImage when handleSend is called with explicit image=null', async () => {
      const parseSpy = vi.spyOn(geminiModule, 'parseTransactionFromText').mockResolvedValue({
        type: 'text',
        text: 'Catatan dibuat',
      })

      let messages = []
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
          selectedImage: 'data:image/jpeg;base64,stale_receipt',
          setInputValue: vi.fn(),
          setSelectedImage: vi.fn(),
          setShowScanModePicker: vi.fn(),
        })
      )

      await act(async () => {
        await result.current.handleSend('Beli susu 20rb', null)
      })

      expect(parseSpy).toHaveBeenCalledWith(
        'Beli susu 20rb',
        expect.objectContaining({
          imageData: null,
        })
      )

      const userMessage = messages.find((m) => m.role === 'user')
      expect(userMessage.image).toBeNull()
    })
  })
})
