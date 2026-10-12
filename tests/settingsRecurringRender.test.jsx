// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsRecurring from '../src/pages/settings/SettingsRecurring'
import { db } from '../src/lib/db'

describe('SettingsRecurring Component Rendering', () => {
  beforeEach(async () => {
    await db.recurringTransactions.clear()
    await db.wallets.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders recurring transactions with localized due dates and un-truncated metadata', async () => {
    const walletId = await db.wallets.add({
      name: 'GoPay Primary',
      currency: 'IDR',
      balance: 500000,
    })

    await db.recurringTransactions.bulkAdd([
      {
        id: 1,
        title: 'Netflix Subscription',
        amount: 186000,
        currency: 'IDR',
        type: 'expense',
        category: 'tagihan/langganan',
        subcategory: 'Streaming',
        frequency: 'monthly',
        nextDate: '2026-10-10',
        walletId,
        autoExecute: true,
        enabled: 1,
      },
      {
        id: 2,
        title: 'Monthly Salary',
        amount: 15000000,
        currency: 'IDR',
        type: 'income',
        category: 'gaji/gaji_bulanan',
        frequency: 'monthly',
        nextDate: '2026-10-25',
        walletId,
        autoExecute: false,
        enabled: 1,
      },
    ])

    await act(async () => {
      render(
        <MemoryRouter>
          <SettingsRecurring />
        </MemoryRouter>,
      )
    })

    // Both items should be rendered by title
    expect(await screen.findByText('Netflix Subscription')).toBeTruthy()
    expect(await screen.findByText('Monthly Salary')).toBeTruthy()

    // Formatted dates should appear, not raw ISO or cut-off text
    // 2026-10-10 -> 10 Okt 2026 (or 10 Oct 2026 depending on active locale)
    const formattedDates = screen.getAllByText(/\d{1,2}\s+(Okt|Oct)\s+2026/)
    expect(formattedDates.length).toBeGreaterThanOrEqual(2)

    // Wallet name should be visible
    expect(screen.getAllByText('GoPay Primary').length).toBeGreaterThan(0)

    // Badges
    expect(screen.getByText('Auto-Debit')).toBeTruthy()
    expect(screen.getAllByText(/Pengingat|Reminder/).length).toBeGreaterThanOrEqual(1)
  })
})
