// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, renderHook, act } from '@testing-library/react'
import WelcomeHero from '../src/components/chat/WelcomeHero'
import ChatHeaderToolbar from '../src/components/chat/ChatHeaderToolbar'
import { useChatScroll } from '../src/components/chat/hooks/useChatScroll'
import useSettingsStore from '../src/store/useSettingsStore'

describe('AI Chat Clean & Spacious UI Refactor', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      locale: 'id',
      defaultCurrency: 'IDR',
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('WelcomeHero clean minimalist typography', () => {
    it('renders unified title "Asisten Finansial FinTrack" and clean subtitle without technical 3.8 pill in Indonesian', () => {
      render(
        <WelcomeHero
          onSelectPrompt={vi.fn()}
          todayExpense={0}
          todayCurrency="IDR"
          isOnline={true}
        />,
      )

      expect(screen.getByRole('heading', { level: 2, name: 'Asisten Finansial FinTrack' })).toBeDefined()
      expect(screen.getByText(/Pencatatan cerdas offline/i)).toBeDefined()
      expect(screen.queryByText(/Gemini 3.8 Flash/i)).toBeNull()
    })

    it('renders unified title "FinTrack AI Assistant" and clean subtitle without technical 3.8 pill in English', () => {
      useSettingsStore.setState({ locale: 'en' })
      render(
        <WelcomeHero
          onSelectPrompt={vi.fn()}
          todayExpense={0}
          todayCurrency="USD"
          isOnline={false}
        />,
      )

      expect(screen.getByRole('heading', { level: 2, name: 'FinTrack AI Assistant' })).toBeDefined()
      expect(screen.getByText(/Smart offline recording/i)).toBeDefined()
      expect(screen.queryByText(/Gemini 3.8 Flash/i)).toBeNull()
    })
  })

  describe('ChatHeaderToolbar dynamic transparent header & 3-dots menu', () => {
    it('renders transparent background and hides center title when hasActiveChat is false', () => {
      const { container } = render(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={false}
          hasMessages={false}
          backgroundTexture="paper"
          setBackgroundTexture={vi.fn()}
          onOpenClearConfirm={vi.fn()}
        />,
      )

      const header = container.querySelector('header')
      expect(header.className).toContain('bg-transparent')
      expect(header.className).toContain('border-none')
      expect(header.className).toContain('shadow-none')

      // Center title container has opacity-0 pointer-events-none and centered positioning
      const centerTitleContainer = container.querySelector('.opacity-0')
      expect(centerTitleContainer).toBeDefined()
      expect(centerTitleContainer.className).toContain('pointer-events-none')
      expect(centerTitleContainer.className).toContain('left-1/2')
    })

    it('renders frosted panel and shows center title when hasActiveChat is true', () => {
      const { container } = render(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={true}
          hasMessages={true}
          backgroundTexture="paper"
          setBackgroundTexture={vi.fn()}
          onOpenClearConfirm={vi.fn()}
        />,
      )

      const header = container.querySelector('header')
      expect(header.className).toContain('backdrop-blur-xl')
      expect(header.className).toContain('bg-[var(--panel-strong)]/85')

      expect(screen.getByRole('heading', { level: 1, name: 'Asisten Finansial FinTrack' })).toBeDefined()
    })

    it('renders 100% transparent header when isScrolled is false even when hasActiveChat is true', () => {
      const { container } = render(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={true}
          hasMessages={true}
          isScrolled={false}
          backgroundTexture="paper"
          setBackgroundTexture={vi.fn()}
          onOpenClearConfirm={vi.fn()}
        />,
      )

      const header = container.querySelector('header')
      expect(header.className).toContain('bg-transparent')
      expect(header.className).toContain('border-none')
      expect(header.className).toContain('shadow-none')
      expect(header.className).not.toContain('backdrop-blur-xl')
      // No status indicator dots cluttering header outside options menu
      expect(header.querySelector('.bg-emerald-500, .bg-amber-500')).toBeNull()
    })

    it('renders frosted blur when isScrolled is true with zero border or shadow lines', () => {
      const { container } = render(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={true}
          hasMessages={true}
          isScrolled={true}
          backgroundTexture="paper"
          setBackgroundTexture={vi.fn()}
          onOpenClearConfirm={vi.fn()}
        />,
      )

      const header = container.querySelector('header')
      expect(header.className).toContain('backdrop-blur-xl')
      expect(header.className).toContain('border-none')
      expect(header.className).toContain('shadow-none')
      expect(header.className).not.toContain('shadow-2xs')
    })

    it('renders single 3-dots menu button and opens options dropdown with model info and texture options', () => {
      const setBackgroundTexture = vi.fn()
      const onOpenClearConfirm = vi.fn()
      const setShowOptionsMenu = vi.fn()

      const { rerender } = render(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={false}
          hasMessages={false}
          showOptionsMenu={false}
          setShowOptionsMenu={setShowOptionsMenu}
          backgroundTexture="paper"
          setBackgroundTexture={setBackgroundTexture}
          onOpenClearConfirm={onOpenClearConfirm}
        />,
      )

      const optionsBtn = screen.getByRole('button', { name: 'Opsi Obrolan' })
      expect(optionsBtn).toBeDefined()

      fireEvent.click(optionsBtn)
      expect(setShowOptionsMenu).toHaveBeenCalled()

      // Re-render with showOptionsMenu = true
      rerender(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={false}
          hasMessages={false}
          showOptionsMenu={true}
          setShowOptionsMenu={setShowOptionsMenu}
          backgroundTexture="paper"
          setBackgroundTexture={setBackgroundTexture}
          onOpenClearConfirm={onOpenClearConfirm}
        />,
      )

      // Dropdown contains model info
      expect(screen.getByText('Status Model')).toBeDefined()
      expect(screen.getAllByText('Gemini 3.8 Flash').length).toBeGreaterThanOrEqual(1)

      // Dropdown contains texture options
      expect(screen.getByText('Kertas Jurnal')).toBeDefined()
      expect(screen.getByText('Ledger Grid')).toBeDefined()

      // Since hasMessages is false, clear conversation should not appear
      expect(screen.queryByText('Hapus Percakapan')).toBeNull()
    })

    it('shows Clear Conversation option in 3-dots menu when hasMessages is true', () => {
      const onOpenClearConfirm = vi.fn()

      render(
        <ChatHeaderToolbar
          onBack={vi.fn()}
          isOnline={true}
          locale="id"
          hasActiveChat={true}
          hasMessages={true}
          showOptionsMenu={true}
          setShowOptionsMenu={vi.fn()}
          backgroundTexture="paper"
          setBackgroundTexture={vi.fn()}
          onOpenClearConfirm={onOpenClearConfirm}
        />,
      )

      const clearBtn = screen.getByText('Hapus Percakapan')
      expect(clearBtn).toBeDefined()

      fireEvent.click(clearBtn)
      expect(onOpenClearConfirm).toHaveBeenCalled()
    })
  })

  describe('useChatScroll isScrolled tracking', () => {
    it('sets isScrolled to true when scroll exceeds 15px', () => {
      const mockContainer = {
        scrollHeight: 1000,
        scrollTop: 0,
        clientHeight: 400,
      }
      const ref = { current: mockContainer }

      const { result } = renderHook(() =>
        useChatScroll({
          messages: [],
          isLoading: false,
          chatScrollContainerRef: ref,
        }),
      )

      expect(result.current.isScrolled).toBe(false)

      act(() => {
        mockContainer.scrollTop = 30
        result.current.handleScroll()
      })

      expect(result.current.isScrolled).toBe(true)

      act(() => {
        mockContainer.scrollTop = 5
        result.current.handleScroll()
      })

      expect(result.current.isScrolled).toBe(false)
    })

    it('does not scroll to bottom on welcome screen even if content height exceeds container', () => {
      const mockScrollIntoView = vi.fn()
      const mockContainer = {
        scrollHeight: 800,
        scrollTop: 0,
        clientHeight: 500,
      }
      const ref = { current: mockContainer }

      const { result } = renderHook(() =>
        useChatScroll({
          messages: [{ type: 'welcome', id: 'w1' }],
          isLoading: false,
          chatScrollContainerRef: ref,
        }),
      )

      result.current.messagesEndRef.current = {
        scrollIntoView: mockScrollIntoView,
      }

      expect(mockContainer.scrollTop).toBe(0)
      expect(mockScrollIntoView).not.toHaveBeenCalled()
    })
  })
})
