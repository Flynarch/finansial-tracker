// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import QuickLogInputSection from '../src/components/chat/quicklog/QuickLogInputSection'

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('../src/lib/ai/entityMemory', () => ({
  getFrequentUserEntities: vi.fn().mockReturnValue([
    { name: 'Kopi Kenangan', lastAmount: 25000, category: 'makanan/kopi', walletId: 1 },
  ]),
}))

describe('QuickLogInputSection Compact Slide-Up Mode', () => {
  const defaultProps = {
    locale: 'id',
    t: (k, fallback) => fallback,
    inputValue: '',
    setInputValue: vi.fn(),
    inputPlaceholder: 'Tulis transaksi Anda...',
    inputRef: { current: null },
    isRecording: false,
    handleStopRecording: vi.fn(),
    handleCancelRecording: vi.fn(),
    toggleRecording: vi.fn(),
    selectedImage: null,
    setSelectedImage: vi.fn(),
    setShowMediaSourcePicker: vi.fn(),
    handleSubmit: vi.fn(),
    sampleChips: ['Beli bensin 20k', 'Makan siang 35k'],
    wallets: [{ id: 1, name: 'BCA' }],
    defaultCurrency: 'IDR',
    omissionData: null,
    setOmissionData: vi.fn(),
    isInputFocused: false,
    setIsInputFocused: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all sections in full non-focused state', () => {
    const { container } = render(<QuickLogInputSection {...defaultProps} isInputFocused={false} />)

    // Greeting text is visible
    expect(screen.getByText('Mau catat apa hari ini?')).toBeTruthy()

    // Frequent cards are visible
    expect(screen.getByText('Sering Dicatat')).toBeTruthy()
    expect(screen.getByText('Kopi Kenangan')).toBeTruthy()

    // Sample chips are visible
    expect(screen.getByText('Coba Catat Cepat')).toBeTruthy()
    expect(screen.getByText('Beli bensin 20k')).toBeTruthy()

    // Connected accounts are visible
    expect(screen.getByText(/Akun terhubung:/)).toBeTruthy()

    // Non-focused classes
    const greetingContainer = container.querySelector('[data-testid="quicklog-greeting"]')
    expect(greetingContainer?.className).toContain('opacity-100')
  })

  it('applies compact collapse styling to non-essential sections when isInputFocused is true', () => {
    const { container } = render(<QuickLogInputSection {...defaultProps} isInputFocused={true} />)

    const greetingContainer = container.querySelector('[data-testid="quicklog-greeting"]')
    expect(greetingContainer?.className).toContain('max-h-0')
    expect(greetingContainer?.className).toContain('opacity-0')

    const frequentContainer = container.querySelector('[data-testid="quicklog-frequent-cards"]')
    expect(frequentContainer?.className).toContain('max-h-0')
    expect(frequentContainer?.className).toContain('opacity-0')

    const sampleChipsContainer = container.querySelector('[data-testid="quicklog-sample-chips"]')
    expect(sampleChipsContainer?.className).toContain('max-h-0')
    expect(sampleChipsContainer?.className).toContain('opacity-0')

    const accountsContainer = container.querySelector('[data-testid="quicklog-connected-accounts"]')
    expect(accountsContainer?.className).toContain('max-h-0')
    expect(accountsContainer?.className).toContain('opacity-0')
  })

  it('triggers setIsInputFocused(true) on textarea focus', () => {
    const setIsInputFocused = vi.fn()
    render(<QuickLogInputSection {...defaultProps} setIsInputFocused={setIsInputFocused} />)

    const textarea = screen.getByPlaceholderText('Tulis transaksi Anda...')
    fireEvent.focus(textarea)

    expect(setIsInputFocused).toHaveBeenCalledWith(true)
  })

  it('triggers setIsInputFocused(false) on textarea blur after timeout when clicking outside', async () => {
    const setIsInputFocused = vi.fn()
    render(<QuickLogInputSection {...defaultProps} isInputFocused={true} setIsInputFocused={setIsInputFocused} />)

    const textarea = screen.getByPlaceholderText('Tulis transaksi Anda...')
    fireEvent.blur(textarea, { relatedTarget: document.body })

    await waitFor(() => {
      expect(setIsInputFocused).toHaveBeenCalledWith(false)
    }, { timeout: 300 })
  })

  it('does not reset focus if blur relatedTarget has keep-focus attribute', async () => {
    const setIsInputFocused = vi.fn()
    render(
      <div data-quicklog-keep-focus="true">
        <button data-testid="internal-btn">Test Button</button>
        <QuickLogInputSection {...defaultProps} isInputFocused={true} setIsInputFocused={setIsInputFocused} />
      </div>
    )

    const textarea = screen.getByPlaceholderText('Tulis transaksi Anda...')
    const internalBtn = screen.getByTestId('internal-btn')

    fireEvent.blur(textarea, { relatedTarget: internalBtn })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(setIsInputFocused).not.toHaveBeenCalledWith(false)
  })
})
