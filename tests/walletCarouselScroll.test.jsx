// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WalletCarousel from '../src/components/dashboard/WalletCarousel'

const mockWallets = [
  { id: 'w1', name: 'BCA Utama', currentBalance: 5000000, currency: 'IDR' },
  { id: 'w2', name: 'Dompet Tunai', currentBalance: 250000, currency: 'IDR' },
]

describe('WalletCarousel Slide Indicator and Scroll Synchronization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const getSlideButtons = () => {
    const slide0Buttons = screen.getAllByRole('button', { name: /remaining balance|sisa keuangan/i })
    const slide1Buttons = screen.getAllByRole('button', { name: /total balance|total saldo/i })
    return { slide0Buttons, slide1Buttons }
  }

  it('renders with slide 0 by default and activates slide 0 indicator', () => {
    render(
      <MemoryRouter>
        <WalletCarousel
          monthIncome={10000000}
          monthExpense={3000000}
          wallets={mockWallets}
          defaultCurrency="IDR"
        />
      </MemoryRouter>
    )

    const { slide0Buttons, slide1Buttons } = getSlideButtons()
    expect(slide0Buttons.length).toBeGreaterThan(0)
    expect(slide1Buttons.length).toBeGreaterThan(0)

    // Check indicator dot class on slide 0: should have wide pill (w-3.5)
    const slide0Dot = slide0Buttons[0].querySelector('span')
    const slide1Dot = slide1Buttons[0].querySelector('span')

    expect(slide0Dot.className).toContain('w-3.5')
    expect(slide1Dot.className).toContain('w-1.5')
  })

  it('restores slide 1 from storage and activates slide 1 indicator without freezing', () => {
    localStorage.setItem('dashboard_carousel_slide', '1')

    render(
      <MemoryRouter>
        <WalletCarousel
          monthIncome={10000000}
          monthExpense={3000000}
          wallets={mockWallets}
          defaultCurrency="IDR"
        />
      </MemoryRouter>
    )

    const { slide0Buttons, slide1Buttons } = getSlideButtons()
    const slide0Dot = slide0Buttons[0].querySelector('span')
    const slide1Dot = slide1Buttons[0].querySelector('span')

    // Since slide 1 was restored, slide 1 indicator should be active (w-3.5)
    expect(slide1Dot.className).toContain('w-3.5')
    expect(slide0Dot.className).toContain('w-1.5')
  })

  it('swipes to slide 0 when scrolled and updates the indicator dots dynamically', () => {
    localStorage.setItem('dashboard_carousel_slide', '1')

    const { container } = render(
      <MemoryRouter>
        <WalletCarousel
          monthIncome={10000000}
          monthExpense={3000000}
          wallets={mockWallets}
          defaultCurrency="IDR"
        />
      </MemoryRouter>
    )

    const scrollContainer = container.querySelector('.snap-x')
    expect(scrollContainer).not.toBeNull()

    // Mock children offsetLeft values
    const slides = scrollContainer.children
    Object.defineProperty(slides[0], 'offsetLeft', { value: 0, configurable: true })
    Object.defineProperty(slides[1], 'offsetLeft', { value: 400, configurable: true })

    // Simulate user swiping towards slide 0
    Object.defineProperty(scrollContainer, 'scrollLeft', { value: 20, configurable: true })

    act(() => {
      fireEvent.scroll(scrollContainer)
    })

    const { slide0Buttons, slide1Buttons } = getSlideButtons()
    const slide0Dot = slide0Buttons[0].querySelector('span')
    const slide1Dot = slide1Buttons[0].querySelector('span')

    expect(slide0Dot.className).toContain('w-3.5')
    expect(slide1Dot.className).toContain('w-1.5')
    expect(localStorage.getItem('dashboard_carousel_slide')).toBe('0')
    expect(sessionStorage.getItem('dashboard_carousel_slide')).toBe('0')

    // Simulate user swiping back to slide 1
    Object.defineProperty(scrollContainer, 'scrollLeft', { value: 390, configurable: true })

    act(() => {
      fireEvent.scroll(scrollContainer)
    })

    const updatedSlide0Dot = slide0Buttons[0].querySelector('span')
    const updatedSlide1Dot = slide1Buttons[0].querySelector('span')

    expect(updatedSlide1Dot.className).toContain('w-3.5')
    expect(updatedSlide0Dot.className).toContain('w-1.5')
    expect(localStorage.getItem('dashboard_carousel_slide')).toBe('1')
  })

  it('updates active slide and storage immediately when indicator dot is clicked', () => {
    render(
      <MemoryRouter>
        <WalletCarousel
          monthIncome={10000000}
          monthExpense={3000000}
          wallets={mockWallets}
          defaultCurrency="IDR"
        />
      </MemoryRouter>
    )

    const { slide0Buttons, slide1Buttons } = getSlideButtons()
    const slide1Button = slide1Buttons[0]

    act(() => {
      fireEvent.click(slide1Button)
    })

    expect(localStorage.getItem('dashboard_carousel_slide')).toBe('1')
    expect(sessionStorage.getItem('dashboard_carousel_slide')).toBe('1')

    const updatedSlide0Dot = slide0Buttons[0].querySelector('span')
    const updatedSlide1Dot = slide1Buttons[0].querySelector('span')

    expect(updatedSlide1Dot.className).toContain('w-3.5')
    expect(updatedSlide0Dot.className).toContain('w-1.5')
  })
})
