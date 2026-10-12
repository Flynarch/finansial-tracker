// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CategoryItemRow } from '../src/components/settings/categories/CategoryItemRow'
import { CategoryFeedList } from '../src/components/settings/categories/CategoryFeedList'
import { SettingsCategoriesSkeleton } from '../src/components/settings/categories/SettingsCategoriesSkeleton'

describe('Settings Categories Feed and Accordion UI', () => {
  const dummyT = (key, fallback) => fallback || key

  const mockExpenseCategory = {
    id: 'food',
    color: 'emerald',
    icon: 'utensils',
    names: { id: 'Makanan & Minuman', en: 'Food & Drinks' },
    children: [
      { id: 'resto', names: { id: 'Restoran', en: 'Restaurant' } },
      { id: 'kopi', names: { id: 'Kopi', en: 'Coffee' } },
    ],
  }

  const mockCustomCategory = {
    id: 'p_hobby_123',
    color: 'purple',
    icon: 'gamepad-2',
    names: { id: 'Hobi & Game', en: 'Hobbies & Games' },
    children: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('CategoryItemRow', () => {
    it('renders category name, tone, and subcategory count badge', () => {
      render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={false}
          onToggleExpand={vi.fn()}
        />
      )

      expect(screen.getByText('Makanan & Minuman')).toBeTruthy()
      expect(screen.getByText('2 subkategori')).toBeTruthy()
      expect(screen.queryByText('Kustom')).toBeNull()
    })

    it('renders Kustom badge when isCustom is true', () => {
      render(
        <CategoryItemRow
          cat={mockCustomCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={false}
          isCustom={true}
          onToggleExpand={vi.fn()}
        />
      )

      expect(screen.getByText('Hobi & Game')).toBeTruthy()
      expect(screen.getByText('Kustom')).toBeTruthy()
      expect(screen.getByText('0 subkategori')).toBeTruthy()
    })

    it('triggers onToggleExpand when tapping the category card', () => {
      const handleToggle = vi.fn()
      render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={false}
          onToggleExpand={handleToggle}
        />
      )

      const card = screen.getByText('Makanan & Minuman').closest('article')
      fireEvent.click(card)
      expect(handleToggle).toHaveBeenCalledWith('food')
    })

    it('reveals subcategory list and controls when isExpanded is true', () => {
      const handleAddSub = vi.fn()
      const handleEditSub = vi.fn()
      const handleDeleteSub = vi.fn()

      render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={true}
          onToggleExpand={vi.fn()}
          onAddSub={handleAddSub}
          onEditSub={handleEditSub}
          onDeleteSub={handleDeleteSub}
        />
      )

      expect(screen.getByText('Restoran')).toBeTruthy()
      expect(screen.getByText('Kopi')).toBeTruthy()

      // Click on subcategory name to edit
      fireEvent.click(screen.getByText('Restoran'))
      expect(handleEditSub).toHaveBeenCalledWith(
        'food',
        mockExpenseCategory.children[0],
        'Makanan & Minuman'
      )
    })

    it('renders empty subcategory state with add now button when children is empty and expanded', () => {
      const handleAddSub = vi.fn()
      render(
        <CategoryItemRow
          cat={mockCustomCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={true}
          onToggleExpand={vi.fn()}
          onAddSub={handleAddSub}
        />
      )

      expect(screen.getByText('Belum ada subkategori.')).toBeTruthy()
      const addNowBtn = screen.getByText('Tambah sekarang')
      fireEvent.click(addNowBtn)
      expect(handleAddSub).toHaveBeenCalledWith(mockCustomCategory)
    })

    it('stops propagation when clicking avatar edit button', () => {
      const handleToggle = vi.fn()
      const handleEditParent = vi.fn()

      render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={false}
          onToggleExpand={handleToggle}
          onEditParent={handleEditParent}
        />
      )

      const editBtn = screen.getByTitle('Edit Kategori')
      fireEvent.click(editBtn)
      expect(handleEditParent).toHaveBeenCalledWith(mockExpenseCategory)
      expect(handleToggle).not.toHaveBeenCalled()
    })

    it('does not render + Sub button on collapsed card header and renders Tambah Subkategori inside expanded drawer', () => {
      const handleAddSub = vi.fn()
      const { rerender } = render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={false}
          onToggleExpand={vi.fn()}
          onAddSub={handleAddSub}
        />
      )

      const cardHeader = screen.getByText('Makanan & Minuman').closest('article')
      expect(cardHeader.querySelector('button[title="Tambah Subkategori"]')).toBeNull()

      rerender(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={true}
          onToggleExpand={vi.fn()}
          onAddSub={handleAddSub}
        />
      )

      const addSubBtn = screen.getByTitle('Tambah Subkategori')
      expect(addSubBtn).toBeTruthy()
      expect(addSubBtn.textContent).toContain('Tambah Subkategori')
      fireEvent.click(addSubBtn)
      expect(handleAddSub).toHaveBeenCalledWith(mockExpenseCategory)
    })

    it('isolates swipe background with pointer-events-none so it cannot block accordion buttons', () => {
      const { container } = render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={true}
          onToggleExpand={vi.fn()}
        />
      )

      const swipeBg = container.querySelector('[aria-hidden="true"]')
      expect(swipeBg).not.toBeNull()
      expect(swipeBg.className).toContain('pointer-events-none')

      const accordion = container.querySelector('.grid-rows-\\[1fr\\]')
      expect(accordion).not.toBeNull()
      expect(accordion.className).toContain('relative')
      expect(accordion.className).toContain('z-10')
      expect(accordion.className).toContain('pointer-events-auto')
    })

    it('triggers onDeleteSub when clicking trash icon on subcategory item', () => {
      const handleDeleteSub = vi.fn()
      render(
        <CategoryItemRow
          cat={mockExpenseCategory}
          activeTab="expense"
          locale="id"
          t={dummyT}
          isExpanded={true}
          onToggleExpand={vi.fn()}
          onDeleteSub={handleDeleteSub}
        />
      )

      const deleteBtns = screen.getAllByTitle('Hapus Subkategori')
      expect(deleteBtns.length).toBe(2)
      fireEvent.click(deleteBtns[0])
      expect(handleDeleteSub).toHaveBeenCalledWith('food', mockExpenseCategory.children[0])
    })
  })

  describe('CategoryFeedList', () => {
    it('renders connected group card with divide-y structure', () => {
      const categories = [mockExpenseCategory, mockCustomCategory]
      const { container } = render(
        <CategoryFeedList
          categories={categories}
          activeTab="expense"
          locale="id"
          t={dummyT}
          expandedCatIds={new Set()}
          onToggleExpand={vi.fn()}
        />
      )

      const groupCard = container.querySelector('.divide-y')
      expect(groupCard).not.toBeNull()
      expect(groupCard.className).toContain('rounded-2xl')
      expect(groupCard.className).toContain('border')
      expect(screen.getByText('Makanan & Minuman')).toBeTruthy()
      expect(screen.getByText('Hobi & Game')).toBeTruthy()
    })

    it('auto-expands all items when searchQuery is active', () => {
      const categories = [mockExpenseCategory]
      render(
        <CategoryFeedList
          categories={categories}
          activeTab="expense"
          locale="id"
          t={dummyT}
          searchQuery="kopi"
          expandedCatIds={new Set()}
          onToggleExpand={vi.fn()}
        />
      )

      expect(screen.getByText('Kopi')).toBeTruthy()
      expect(screen.getByText('Restoran')).toBeTruthy()
    })

    it('renders empty search state with clear button', () => {
      const handleClear = vi.fn()
      render(
        <CategoryFeedList
          categories={[]}
          activeTab="expense"
          locale="id"
          t={dummyT}
          searchQuery="nonexistent"
          onClearSearch={handleClear}
        />
      )

      expect(screen.getByText('Tidak ada kategori yang cocok dengan pencarian')).toBeTruthy()
      const clearBtn = screen.getByText('Hapus Pencarian')
      fireEvent.click(clearBtn)
      expect(handleClear).toHaveBeenCalled()
    })
  })

  describe('SettingsCategoriesSkeleton', () => {
    it('renders shimmer skeleton matching the connected card layout without redundant overview card', () => {
      const { container } = render(<SettingsCategoriesSkeleton />)
      expect(container.querySelector('.ft-skeleton-enter')).not.toBeNull()
      expect(container.querySelector('.divide-y')).not.toBeNull()
      // Redundant bulky overview card is removed
      expect(container.querySelector('.shadow-card')).toBeNull()
    })
  })
})
