// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PullToRefresh from '../src/components/ui/PullToRefresh'
import { SettingsSegmentControl } from '../src/pages/settings/settingsComponents'
import BottomNav from '../src/components/layout/BottomNav'

// Mock haptics
vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PullToRefresh and Animated Sliding Tabs Suite', () => {
  describe('PullToRefresh Component', () => {
    it('renders children and initial indicator state with zero opacity', () => {
      const { container } = render(
        <PullToRefresh onRefresh={vi.fn()}>
          <div data-testid="content">Test Content</div>
        </PullToRefresh>
      )

      expect(screen.getByTestId('content')).toBeDefined()
      const indicator = container.querySelector('[aria-hidden="true"]')
      expect(indicator).toBeDefined()
      expect(indicator?.style.opacity).toBe('0')
    })

    it('triggers touch gesture, updates distance and calls onRefresh on threshold pass', async () => {
      const onRefreshMock = vi.fn().mockResolvedValue(true)
      const { container } = render(
        <PullToRefresh onRefresh={onRefreshMock} pullDownThreshold={60}>
          <div data-testid="scrollable" style={{ height: '300px' }}>
            Inner Content
          </div>
        </PullToRefresh>
      )

      const wrapper = container.firstChild

      // Touch start at scrollTop = 0
      fireEvent.touchStart(wrapper, {
        touches: [{ clientY: 100 }],
      })

      // Pull down 150px (rawDelta = 150)
      fireEvent.touchMove(wrapper, {
        touches: [{ clientY: 250 }],
        cancelable: true,
      })

      // Indicator should now be visible
      const indicator = container.querySelector('[aria-hidden="true"]')
      expect(indicator?.style.opacity).toBe('1')

      // Release touch
      await act(async () => {
        fireEvent.touchEnd(wrapper)
      })

      expect(onRefreshMock).toHaveBeenCalledTimes(1)
    })

    it('does not trigger pull when disabled is true', () => {
      const onRefreshMock = vi.fn()
      const { container } = render(
        <PullToRefresh onRefresh={onRefreshMock} disabled={true}>
          <div data-testid="content">Disabled Content</div>
        </PullToRefresh>
      )

      const wrapper = container.firstChild
      fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(wrapper, { touches: [{ clientY: 250 }] })
      fireEvent.touchEnd(wrapper)

      expect(onRefreshMock).not.toHaveBeenCalled()
      const indicator = container.querySelector('[aria-hidden="true"]')
      expect(indicator?.style.opacity).toBe('0')
    })

    it('supports external scrollContainerRef and prevents pull when scrollTop > 1', () => {
      const onRefreshMock = vi.fn()
      const scrollEl = document.createElement('div')
      Object.defineProperty(scrollEl, 'scrollTop', { value: 100, writable: true })
      const scrollRef = { current: scrollEl }

      render(
        <PullToRefresh onRefresh={onRefreshMock} scrollContainerRef={scrollRef}>
          <div data-testid="content">List Content</div>
        </PullToRefresh>
      )

      fireEvent.touchStart(scrollEl, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(scrollEl, { touches: [{ clientY: 250 }] })
      fireEvent.touchEnd(scrollEl)

      expect(onRefreshMock).not.toHaveBeenCalled()
    })

    it('prevents pull when window.scrollY > 1 and scrollContainerRef is omitted', () => {
      const onRefreshMock = vi.fn()
      // Simulate scrolled window
      const origScrollY = window.scrollY
      Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true })

      const { container } = render(
        <PullToRefresh onRefresh={onRefreshMock}>
          <div data-testid="content">Dashboard Content</div>
        </PullToRefresh>
      )

      const wrapper = container.firstChild
      fireEvent.touchStart(wrapper, { touches: [{ clientY: 100 }] })
      fireEvent.touchMove(wrapper, { touches: [{ clientY: 250 }] })
      fireEvent.touchEnd(wrapper)

      expect(onRefreshMock).not.toHaveBeenCalled()

      // Restore scrollY
      Object.defineProperty(window, 'scrollY', { value: origScrollY, writable: true, configurable: true })
    })

    it('centers the indicator track horizontally with inset-x-0 and justify-center', () => {
      const { container } = render(
        <PullToRefresh onRefresh={vi.fn()}>
          <div data-testid="content">Centered Content</div>
        </PullToRefresh>
      )

      const indicatorTrack = container.querySelector('[aria-hidden="true"]')
      expect(indicatorTrack).toBeDefined()
      expect(indicatorTrack?.className).toContain('inset-x-0')
      expect(indicatorTrack?.className).toContain('justify-center')

      // Verify the native RotateCw icon is rendered inside
      const rotateIcon = indicatorTrack?.querySelector('.lucide-rotate-cw')
      expect(rotateIcon).toBeDefined()
    })
  })

  describe('SettingsSegmentControl Component (Fluid Sliding Pill)', () => {
    const options = [
      { value: 'all', label: 'Semua' },
      { value: 'expense', label: 'Pengeluaran' },
      { value: 'income', label: 'Pemasukan' },
    ]

    it('renders all option buttons with radio role and aria-checked', () => {
      render(
        <SettingsSegmentControl
          options={options}
          value="expense"
          onChange={vi.fn()}
          ariaLabel="Tipe Kategori"
        />
      )

      const radios = screen.getAllByRole('radio')
      expect(radios.length).toBe(3)
      expect(radios[0].getAttribute('aria-checked')).toBe('false')
      expect(radios[1].getAttribute('aria-checked')).toBe('true')
      expect(radios[2].getAttribute('aria-checked')).toBe('false')
    })

    it('positions sliding pill according to activeIndex', () => {
      const { container } = render(
        <SettingsSegmentControl
          options={options}
          value="expense"
          onChange={vi.fn()}
          ariaLabel="Tipe Kategori"
        />
      )

      const pill = container.querySelector('[aria-hidden="true"]')
      expect(pill).toBeDefined()
      // activeIndex for 'expense' is 1
      expect(pill?.style.transform).toContain('translateX(calc(1 * (100% + 4px)))')
    })

    it('calls onChange when clicking an option button', () => {
      const onChangeMock = vi.fn()
      render(
        <SettingsSegmentControl
          options={options}
          value="all"
          onChange={onChangeMock}
          ariaLabel="Tipe Kategori"
        />
      )

      const incomeButton = screen.getByText('Pemasukan')
      fireEvent.click(incomeButton)
      expect(onChangeMock).toHaveBeenCalledWith('income')
    })
  })

  describe('BottomNav Component (Fluid Sliding Active Pill)', () => {
    it('renders sliding pill with active transform for /dashboard', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <BottomNav />
        </MemoryRouter>
      )

      const pill = container.querySelector('.relative.z-10 > [aria-hidden="true"]')
      expect(pill).toBeDefined()
      expect(pill?.style.opacity).toBe('1')
      expect(pill?.style.transform).toContain('translate3d(calc(0 * (100% + 4px)), 0, 0)')
    })

    it('renders sliding pill with active transform for /transactions', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/transactions']}>
          <BottomNav />
        </MemoryRouter>
      )

      const pill = container.querySelector('.relative.z-10 > [aria-hidden="true"]')
      expect(pill).toBeDefined()
      expect(pill?.style.opacity).toBe('1')
      expect(pill?.style.transform).toContain('translate3d(calc(1 * (100% + 4px)), 0, 0)')
    })

    it('hides sliding pill (opacity 0) on secondary routes like /settings', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/settings']}>
          <BottomNav />
        </MemoryRouter>
      )

      const pill = container.querySelector('.relative.z-10 > [aria-hidden="true"]')
      expect(pill).toBeDefined()
      expect(pill?.style.opacity).toBe('0')
    })
  })
})
