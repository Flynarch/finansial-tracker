/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from '../src/components/ui/EmptyState'
import CurrencyPickerPage from '../src/components/currency/CurrencyPickerPage'

// Mock translation hook
vi.mock('../src/hooks/useTranslation', () => ({
  default: () => ({
    t: (key, fallback) => fallback || key,
    locale: 'id',
  }),
}))

// Mock back button
vi.mock('../src/hooks/useBackButton', () => ({
  default: vi.fn(),
}))

describe('Empty States Modernization Suite', () => {
  describe('EmptyState component with habits variant', () => {
    it('renders habits illustration and halo aura badge correctly', () => {
      const { container } = render(
        <EmptyState
          variant="habits"
          title="Belum Ada Kebiasaan"
          description="Mulai bangun rutinitas baikmu hari ini."
          action={<button type="button">Tambah Kebiasaan</button>}
        />
      )

      expect(screen.getByText('Belum Ada Kebiasaan')).toBeDefined()
      expect(screen.getByText('Mulai bangun rutinitas baikmu hari ini.')).toBeDefined()
      expect(screen.getByRole('button', { name: 'Tambah Kebiasaan' })).toBeDefined()

      const badgeHalo = container.querySelector('.ft-empty-badge-halo')
      expect(badgeHalo).not.toBeNull()
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
    })
  })

  describe('CurrencyPickerPage empty search state', () => {
    it('renders modern EmptyState with variant="search" when no currencies match query', () => {
      const { container } = render(
        <CurrencyPickerPage
          selectedCurrency="IDR"
          onSelect={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Find search input and type non-existent query
      const searchInput = screen.getByPlaceholderText(/cari kode/i)
      fireEvent.change(searchInput, { target: { value: 'XYZ123NONEXISTENT' } })

      expect(screen.getByText('Tidak ada mata uang yang cocok')).toBeDefined()
      expect(screen.getByText('Coba cari dengan kode mata uang atau nama negara lain.')).toBeDefined()

      // Verify EmptyState container classes exist
      const badgeHalo = container.querySelector('.ft-empty-badge-halo')
      expect(badgeHalo).not.toBeNull()
    })
  })
})
