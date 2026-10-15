// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import TransactionSearchAndBanner from '../src/components/transactions/TransactionSearchAndBanner'
import useSettingsStore from '../src/store/useSettingsStore'

describe('TransactionSearchAndBanner', () => {
  const mockT = (key, defaultText) => defaultText || key

  beforeEach(() => {
    useSettingsStore.setState({
      searchQuickChips: ['< 50rb', '50rb - 200rb', '> 100rb', '> 500rb'],
      defaultCurrency: 'IDR',
      locale: 'id-ID',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders search input and preset chips when isSearchOpen is true', () => {
    render(
      <TransactionSearchAndBanner
        isSearchOpen={true}
        searchQuery=""
        onSearchChange={vi.fn()}
        t={mockT}
      />
    )

    expect(screen.getByPlaceholderText(/Cari catatan, kategori, atau nominal/i)).toBeDefined()
    expect(screen.getByText('< 50rb')).toBeDefined()
    expect(screen.getByText('50rb - 200rb')).toBeDefined()
    expect(screen.getByText('> 100rb')).toBeDefined()
    expect(screen.getByText('> 500rb')).toBeDefined()
    expect(screen.getByText('Atur Chip')).toBeDefined()
  })

  it('calls onSearchChange when a quick chip is clicked', () => {
    const handleSearchChange = vi.fn()
    render(
      <TransactionSearchAndBanner
        isSearchOpen={true}
        searchQuery=""
        onSearchChange={handleSearchChange}
        t={mockT}
      />
    )

    fireEvent.click(screen.getByText('> 100rb'))
    expect(handleSearchChange).toHaveBeenCalledWith('> 100rb')
  })

  it('appends operator chip to existing text search query', () => {
    const handleSearchChange = vi.fn()
    render(
      <TransactionSearchAndBanner
        isSearchOpen={true}
        searchQuery="kopi"
        onSearchChange={handleSearchChange}
        t={mockT}
      />
    )

    fireEvent.click(screen.getByText('> 100rb'))
    expect(handleSearchChange).toHaveBeenCalledWith('kopi > 100rb')
  })

  it('toggles off active chip when clicked again', () => {
    const handleSearchChange = vi.fn()
    render(
      <TransactionSearchAndBanner
        isSearchOpen={true}
        searchQuery="kopi > 100rb"
        onSearchChange={handleSearchChange}
        t={mockT}
      />
    )

    fireEvent.click(screen.getByText('> 100rb'))
    expect(handleSearchChange).toHaveBeenCalledWith('kopi')
  })

  it('displays active amount condition badge and removes operator on clear click', () => {
    const handleSearchChange = vi.fn()
    render(
      <TransactionSearchAndBanner
        isSearchOpen={true}
        searchQuery="kopi > 50k"
        onSearchChange={handleSearchChange}
        t={mockT}
      />
    )

    expect(screen.getByText(/Filter Nominal/i)).toBeDefined()
    expect(screen.getByText(/>\s*Rp\s*50\.000/i)).toBeDefined()

    const clearFilterBtn = screen.getByLabelText(/Hapus filter nominal/i)
    fireEvent.click(clearFilterBtn)
    expect(handleSearchChange).toHaveBeenCalledWith('kopi')
  })

  it('opens customization modal when Atur Chip is clicked', () => {
    render(
      <TransactionSearchAndBanner
        isSearchOpen={true}
        searchQuery=""
        onSearchChange={vi.fn()}
        t={mockT}
      />
    )

    fireEvent.click(screen.getByText('Atur Chip'))
    expect(screen.getByText('Atur Chip Filter Cepat')).toBeDefined()
    expect(screen.getByPlaceholderText(/Contoh: > 1jt/i)).toBeDefined()
  })
})
