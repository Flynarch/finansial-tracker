// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AiBubble, AiAvatarBadge, UserBubble } from '../src/components/chat/ChatBubble'
import ChatInputBar from '../src/components/chat/ChatInputBar'
import TransactionSuccess from '../src/components/chat/TransactionSuccess'
import WelcomeHero from '../src/components/chat/WelcomeHero'
import useSettingsStore from '../src/store/useSettingsStore'
import * as haptics from '../src/lib/haptics'

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

describe('AI Chat Editorial Flow & Seamless Edge Dock Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      locale: 'id',
      defaultCurrency: 'IDR',
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('ChatBubble: Editorial Flow & Modern Badges', () => {
    it('renders AiBubble with ft-ai-editorial-flow and borderless aesthetic', () => {
      const { container } = render(
        <AiBubble
          content="Total pengeluaran Anda bulan ini adalah Rp 1.500.000."
          timestamp={Date.now()}
          isStreaming={false}
        />
      )

      const editorialWrapper = container.querySelector('.ft-ai-editorial-flow')
      expect(editorialWrapper).toBeDefined()
      expect(screen.getByText(/Total pengeluaran Anda/i)).toBeDefined()
    })

    it('renders AiBubble with ft-stream-fade animation class when streaming', () => {
      const { container } = render(
        <AiBubble
          content="Menghitung transaksi harian..."
          timestamp={Date.now()}
          isStreaming={true}
        />
      )

      const streamFadeEl = container.querySelector('.ft-stream-fade')
      expect(streamFadeEl).toBeDefined()
    })

    it('renders AiAvatarBadge with pulsing ring when thinking', () => {
      const { container } = render(<AiAvatarBadge isThinking={true} />)
      const badge = container.firstChild
      expect(badge.className).toContain('animate-pulse')
      expect(badge.className).toContain('ring-2')
    })

    it('renders UserBubble with timestamp and check icon', () => {
      render(
        <UserBubble
          content="Halo asisten finansial"
          timestamp={1700000000000}
          status="confirmed"
        />
      )

      expect(screen.getByText('Halo asisten finansial')).toBeDefined()
    })
  })

  describe('ChatInputBar: Seamless Edge Dock & Haptic Pill Capsule', () => {
    it('renders seamless pill capsule input form and triggers send with haptic', () => {
      const onSend = vi.fn()
      const setInputValue = vi.fn()
      const inputRef = { current: null }

      const { container } = render(
        <ChatInputBar
          inputValue="Catat makan siang 35000"
          setInputValue={setInputValue}
          inputRef={inputRef}
          isRecording={false}
          isLoading={false}
          selectedImage={null}
          onSend={onSend}
          onToggleRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onCancelRecording={vi.fn()}
          onOpenMediaPicker={vi.fn()}
          locale="id"
        />
      )

      const form = container.querySelector('form')
      expect(form.className).toContain('rounded-full')
      expect(form.className).toContain('backdrop-blur-xl')

      fireEvent.submit(form)
      expect(onSend).toHaveBeenCalledWith('Catat makan siang 35000', null)
      expect(haptics.triggerHaptic).toHaveBeenCalledWith('light')
    })

    it('triggers media picker and haptic feedback when camera button is clicked', () => {
      const onOpenMediaPicker = vi.fn()

      render(
        <ChatInputBar
          inputValue=""
          setInputValue={vi.fn()}
          inputRef={{ current: null }}
          isRecording={false}
          isLoading={false}
          selectedImage={null}
          onSend={vi.fn()}
          onToggleRecording={vi.fn()}
          onStopRecording={vi.fn()}
          onCancelRecording={vi.fn()}
          onOpenMediaPicker={onOpenMediaPicker}
          locale="id"
        />
      )

      const mediaBtn = screen.getByRole('button', { name: /Lampirkan Foto atau Struk/i })
      fireEvent.click(mediaBtn)

      expect(onOpenMediaPicker).toHaveBeenCalled()
      expect(haptics.triggerHaptic).toHaveBeenCalledWith('light')
    })
  })

  describe('TransactionSuccess: Sleek Bento Micro-Receipt', () => {
    it('renders clean micro-receipt with category, wallet, amount, and undo bar', () => {
      const mockTx = {
        id: 'tx-123',
        type: 'expense',
        amount: 45000,
        category: 'food',
        walletId: 1,
        walletName: 'BCA Utama',
        date: '2026-10-11',
        time: '12:30',
        note: 'Makan siang ayam geprek',
      }
      const onUndo = vi.fn()

      render(
        <TransactionSuccess
          data={mockTx}
          onUndo={onUndo}
          isUpdate={false}
          wallets={[{ id: 1, name: 'BCA Utama' }]}
        />
      )

      expect(screen.getByRole('button', { name: /batalkan/i })).toBeDefined()

      // Verify AI Gemini / NLP Lokal pill badge is removed from card
      expect(screen.queryByText('AI Gemini')).toBeNull()
      expect(screen.queryByText('NLP Lokal')).toBeNull()

      // Click undo button
      const undoBtn = screen.getByRole('button', { name: /batalkan/i })
      fireEvent.click(undoBtn)
      expect(onUndo).toHaveBeenCalled()
      expect(haptics.triggerHaptic).toHaveBeenCalledWith('medium')
    })

    it('renders directly as Tersimpan without undo countdown when isSaved is true', () => {
      const mockTx = {
        id: 'tx-456',
        type: 'expense',
        amount: 25000,
        category: 'snack',
        walletId: 1,
        walletName: 'BCA Utama',
        date: '2026-10-11',
      }
      render(
        <TransactionSuccess
          data={mockTx}
          onUndo={vi.fn()}
          isSaved={true}
          wallets={[{ id: 1, name: 'BCA Utama' }]}
        />
      )

      expect(screen.queryByRole('button', { name: /batalkan/i })).toBeNull()
      expect(screen.getByText('Tersimpan')).toBeDefined()
    })

    it('renders directly as Tersimpan when timestamp is older than 5 seconds (persisted saved state on reopen)', () => {
      const mockTx = {
        id: 'tx-789',
        type: 'expense',
        amount: 15000,
        category: 'drinks',
        walletId: 1,
        walletName: 'BCA Utama',
        date: '2026-10-11',
      }
      render(
        <TransactionSuccess
          data={mockTx}
          onUndo={vi.fn()}
          timestamp={Date.now() - 15000}
          wallets={[{ id: 1, name: 'BCA Utama' }]}
        />
      )

      expect(screen.queryByRole('button', { name: /batalkan/i })).toBeNull()
      expect(screen.getByText('Tersimpan')).toBeDefined()
    })
  })

  describe('WelcomeHero: Modern Bento Glass Intent Cards', () => {
    it('renders modern intent cards and invokes stage prompt with haptics on click', () => {
      const onSelectPrompt = vi.fn()

      render(
        <WelcomeHero
          onSelectPrompt={onSelectPrompt}
          todayExpense={50000}
          todayCurrency="IDR"
          isOnline={true}
        />
      )

      const recordCard = screen.getByRole('button', { name: /Catat Transaksi/i })
      expect(recordCard).toBeDefined()
      expect(recordCard.className).toContain('backdrop-blur-xs')
      expect(recordCard.className).toContain('rounded-2xl')

      fireEvent.click(recordCard)
      expect(onSelectPrompt).toHaveBeenCalledWith('Aku mau catat transaksi')
      expect(haptics.triggerHaptic).toHaveBeenCalledWith('light')
    })
  })
})
