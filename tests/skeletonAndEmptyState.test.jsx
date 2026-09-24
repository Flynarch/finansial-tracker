// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import Skeleton from '../src/components/ui/Skeleton'
import PageSkeleton from '../src/components/ui/PageSkeleton'
import EmptyState from '../src/components/ui/EmptyState'

afterEach(() => {
  cleanup()
})

describe('Skeleton and EmptyState Quality Assurance Suite', () => {
  describe('Skeleton Component Primitives', () => {
    it('renders text variant with specified number of lines and aria-hidden', () => {
      const { container } = render(<Skeleton variant="text" lines={3} />)
      expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
      const bars = container.querySelectorAll('.ft-skeleton')
      expect(bars.length).toBe(3)
    })

    it('renders circle / avatar variant with rounded-full shape', () => {
      const { container } = render(<Skeleton variant="circle" />)
      const circle = container.querySelector('.ft-skeleton')
      expect(circle).not.toBeNull()
      expect(circle.className).toContain('!rounded-full')
    })

    it('renders card variant with financial stat card layout', () => {
      const { container } = render(<Skeleton variant="card" />)
      const card = container.querySelector('.ft-skeleton-card')
      expect(card).not.toBeNull()
      const shimmers = card.querySelectorAll('.ft-skeleton')
      expect(shimmers.length).toBeGreaterThanOrEqual(4)
    })

    it('renders chart variant with bar pillars', () => {
      const { container } = render(<Skeleton variant="chart" />)
      const chart = container.querySelector('.ft-skeleton-card')
      expect(chart).not.toBeNull()
      const pillars = chart.querySelectorAll('.ft-skeleton')
      expect(pillars.length).toBeGreaterThan(5)
    })

    it('renders list-item variant with icon box and amount placeholder', () => {
      const { container } = render(<Skeleton variant="list-item" />)
      const shimmers = container.querySelectorAll('.ft-skeleton')
      expect(shimmers.length).toBeGreaterThanOrEqual(3)
    })

    it('renders pill / badge variant', () => {
      const { container } = render(<Skeleton variant="pill" />)
      const pill = container.querySelector('.ft-skeleton')
      expect(pill.className).toContain('!rounded-full')
    })
  })

  describe('PageSkeleton Component All Variants', () => {
    const VARIANTS = [
      'dashboard',
      'transactions',
      'calendar',
      'budget',
      'reports',
      'loans',
      'savings',
      'savings-detail',
      'todo',
      'todo-detail',
      'profile',
      'wallet-detail',
      'settings',
      'chat',
      'add-account',
      'generic',
    ]

    VARIANTS.forEach((variant) => {
      it(`renders "${variant}" variant without throwing and has aria-busy=true`, () => {
        const { unmount } = render(<PageSkeleton variant={variant} />)
        const statusEl = screen.getByRole('status')
        expect(statusEl).toBeDefined()
        expect(statusEl.getAttribute('aria-busy')).toBe('true')
        unmount()
      })
    })

    it('falls back to GenericSkeleton on unknown variant', () => {
      render(<PageSkeleton variant="unknown-custom-variant" />)
      expect(screen.getByRole('status')).toBeDefined()
    })
  })

  describe('EmptyState Component Features', () => {
    it('renders title and default illustration with role=status', () => {
      render(<EmptyState title="Belum Ada Data" />)
      expect(screen.getByRole('status')).toBeDefined()
      expect(screen.getByText('Belum Ada Data')).toBeDefined()
    })

    it('renders contextual description and hint pill when provided', () => {
      render(
        <EmptyState
          title="Data Kosong"
          description="Tambahkan transaksi pertama Anda."
          hint="Tip: Gunakan tombol tambah cepat"
        />
      )
      expect(screen.getByText('Tambahkan transaksi pertama Anda.')).toBeDefined()
      expect(screen.getByText('Tip: Gunakan tombol tambah cepat')).toBeDefined()
    })

    it('renders interactive action button and triggers click callback', () => {
      const onActionClick = vi.fn()
      render(
        <EmptyState
          title="Kosong"
          action={
            <button type="button" onClick={onActionClick}>
              Tambah Data
            </button>
          }
        />
      )
      const btn = screen.getByRole('button', { name: 'Tambah Data' })
      expect(btn).toBeDefined()
      fireEvent.click(btn)
      expect(onActionClick).toHaveBeenCalledTimes(1)
    })

    it('renders custom icon override when passed', () => {
      render(
        <EmptyState
          title="Custom Icon State"
          icon={<span data-testid="custom-svg-icon">ICON</span>}
        />
      )
      expect(screen.getByTestId('custom-svg-icon')).toBeDefined()
    })

    const DOMAIN_VARIANTS = [
      'transactions',
      'budget',
      'savings',
      'loans',
      'todos',
      'calendar',
      'reports',
      'search',
      'generic',
    ]

    DOMAIN_VARIANTS.forEach((variant) => {
      it(`renders domain illustration variant "${variant}" cleanly`, () => {
        const { unmount, container } = render(
          <EmptyState variant={variant} title={`Empty ${variant}`} />
        )
        const svg = container.querySelector('svg')
        expect(svg).not.toBeNull()
        unmount()
      })
    })
  })
})
