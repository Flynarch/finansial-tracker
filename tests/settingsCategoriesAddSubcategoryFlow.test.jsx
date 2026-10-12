// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsCategories from '../src/pages/settings/SettingsCategories'
import {
  getMergedExpenseTree,
  resetExpenseCategoryCustomizations,
} from '../src/lib/expenseCategories'

import useSettingsStore from '../src/store/useSettingsStore'

describe('SettingsCategories Add Subcategory Flow', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'id' })
    resetExpenseCategoryCustomizations()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    resetExpenseCategoryCustomizations()
  })

  it('allows clicking Tambah Subkategori in expanded accordion, opening modal and adding subcategory', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SettingsCategories />
        </MemoryRouter>
      )
    })

    // Find "Makanan" category row
    const foodRow = screen.getByText('Makanan').closest('article')
    expect(foodRow).toBeTruthy()

    // Click card to expand accordion
    await act(async () => {
      fireEvent.click(foodRow)
    })

    // Subcategory accordion is now expanded and Tambah Subkategori button is visible
    const addSubBtns = screen.getAllByRole('button', { name: /Tambah Subkategori/i })
    expect(addSubBtns.length).toBeGreaterThan(0)
    const addSubBtn = addSubBtns[0]

    // Click "+ Tambah Subkategori"
    await act(async () => {
      fireEvent.click(addSubBtn)
    })

    // Modal should now be open with title including parent category
    expect(screen.getByText(/Tambah Subkategori.*Makanan/i)).toBeTruthy()

    // Subcategory input fields
    const nameIdInput = screen.getByPlaceholderText(/Contoh: Kopi Kekinian/i)
    expect(nameIdInput).toBeTruthy()
    expect(nameIdInput.value).toBe('')

    // Type new subcategory name
    await act(async () => {
      fireEvent.change(nameIdInput, { target: { value: 'Kopi Artisanal' } })
    })
    expect(nameIdInput.value).toBe('Kopi Artisanal')

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Simpan/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    // Modal closes and new subcategory is in tree
    const tree = getMergedExpenseTree()
    const foodCat = tree.find((c) => c.id === 'makanan')
    expect(foodCat.children.some((c) => (c.names?.id || c.id) === 'Kopi Artisanal')).toBe(true)
  }, 15000)

  it('allows clicking Tambah sekarang in empty subcategory state and adding subcategory', async () => {
    // Add a custom category with no children first
    const { addExpenseParentCategory } = await import('../src/lib/expenseCategories')
    const customId = addExpenseParentCategory('Kamera & Lensa', 'Cameras & Lenses')
    expect(customId).toBeTruthy()

    await act(async () => {
      render(
        <MemoryRouter>
          <SettingsCategories />
        </MemoryRouter>
      )
    })

    const customRow = screen.getByText('Kamera & Lensa').closest('article')
    expect(customRow).toBeTruthy()

    await act(async () => {
      fireEvent.click(customRow)
    })

    const addNowBtn = screen.getByRole('button', { name: /Tambah sekarang/i })
    expect(addNowBtn).toBeTruthy()

    await act(async () => {
      fireEvent.click(addNowBtn)
    })

    expect(screen.getByText(/Tambah Subkategori.*Kamera & Lensa/i)).toBeTruthy()

    const nameIdInput = screen.getByPlaceholderText(/Contoh: Kopi Kekinian/i)
    await act(async () => {
      fireEvent.change(nameIdInput, { target: { value: 'Lensa Prime' } })
    })

    const saveBtn = screen.getByRole('button', { name: /Simpan/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    const tree = getMergedExpenseTree()
    const customCat = tree.find((c) => c.id === customId)
    expect(customCat.children.some((c) => (c.names?.id || c.id) === 'Lensa Prime')).toBe(true)
  }, 15000)
})
