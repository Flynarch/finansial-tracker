// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TransactionSuccess from '../src/components/chat/TransactionSuccess'
import MessageContextMenu from '../src/components/chat/MessageContextMenu'
import useSettingsStore from '../src/store/useSettingsStore'

describe('N-Item Batch Editing, In-Card Edit & Context Menu Unpacking', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
  })

  afterEach(() => {
    cleanup()
  })

  const sampleWallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'DANA Digital', currency: 'IDR' },
  ]

  const multiTxs = [
    {
      id: 501,
      amount: 25000,
      type: 'expense',
      category: 'makanan/kopi',
      notes: 'Kopi Susu Gula Aren',
      date: '2026-10-08',
      time: '09:00',
      walletId: 1,
    },
    {
      id: 502,
      amount: 30000,
      type: 'expense',
      category: 'transportasi/bensin',
      notes: 'Pertalite Motor',
      date: '2026-10-08',
      time: '10:00',
      walletId: 2,
    },
    {
      id: 503,
      amount: 45000,
      type: 'expense',
      category: 'makanan/makan_siang',
      notes: 'Nasi Padang Komplit',
      date: '2026-10-08',
      time: '12:30',
      walletId: 1,
    },
  ]

  it('renders edit button on EVERY row (#1, #2, #3) in TransactionSuccess and triggers onEditItem', () => {
    const onEditMock = vi.fn()
    render(
      <MemoryRouter>
        <TransactionSuccess
          data={multiTxs}
          onEditItem={onEditMock}
          wallets={sampleWallets}
        />
      </MemoryRouter>
    )

    // Check item indicators
    expect(screen.getByText('#1')).toBeDefined()
    expect(screen.getByText('#2')).toBeDefined()
    expect(screen.getByText('#3')).toBeDefined()

    // Check 3-line visual hierarchy elements: Wallet names with bold contrast, and quoted notes
    expect(screen.getAllByText('BCA Utama').length).toBeGreaterThan(0)
    expect(screen.getByText('DANA Digital')).toBeDefined()
    expect(screen.getByText('"Kopi Susu Gula Aren"')).toBeDefined()
    expect(screen.getByText('"Pertalite Motor"')).toBeDefined()
    expect(screen.getByText('"Nasi Padang Komplit"')).toBeDefined()

    // Edit button on item #2
    const editBtn2 = screen.getByTitle('Edit #2')
    fireEvent.click(editBtn2)
    expect(onEditMock).toHaveBeenCalledWith(expect.objectContaining({ id: 502 }))

    // Edit button on item #3
    const editBtn3 = screen.getByTitle('Edit #3')
    fireEvent.click(editBtn3)
    expect(onEditMock).toHaveBeenCalledWith(expect.objectContaining({ id: 503 }))
  })

  it('renders edit button on single transaction hero card', () => {
    const onEditMock = vi.fn()
    render(
      <MemoryRouter>
        <TransactionSuccess
          data={multiTxs[0]}
          onEditItem={onEditMock}
          wallets={sampleWallets}
        />
      </MemoryRouter>
    )

    const editBtn = screen.getByRole('button', { name: /Edit/i })
    expect(editBtn).toBeDefined()
    fireEvent.click(editBtn)
    expect(onEditMock).toHaveBeenCalledWith(expect.objectContaining({ id: 501 }))
  })

  it('unpacks multi-item transactions into individual edit buttons in MessageContextMenu', () => {
    const onEditTxMock = vi.fn()
    render(
      <MessageContextMenu
        isOpen={true}
        onClose={vi.fn()}
        messageType="transaction"
        messageData={multiTxs}
        onEditTransaction={onEditTxMock}
      />
    )

    // Must show individual item buttons
    expect(screen.getByText(/#1: Kopi Susu Gula Aren/i)).toBeDefined()
    expect(screen.getByText(/#2: Pertalite Motor/i)).toBeDefined()
    expect(screen.getByText(/#3: Nasi Padang Komplit/i)).toBeDefined()

    // Clicking item #2 invokes onEditTransaction with item #2
    fireEvent.click(screen.getByText(/#2: Pertalite Motor/i))
    expect(onEditTxMock).toHaveBeenCalledWith(expect.objectContaining({ id: 502 }))
  })
})
