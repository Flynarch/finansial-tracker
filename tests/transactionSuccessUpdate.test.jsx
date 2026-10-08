// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TransactionSuccess from '../src/components/chat/TransactionSuccess'
import useSettingsStore from '../src/store/useSettingsStore'

describe('TransactionSuccess - Update vs Create Card State Verification', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'id', defaultCurrency: 'IDR' })
  })

  afterEach(() => {
    cleanup()
  })

  const sampleSingleTx = {
    id: 89,
    amount: 11303,
    type: 'expense',
    category: 'tagihan/langganan',
    notes: 'Gemini Pro',
    date: '2026-10-08',
    currency: 'IDR',
    walletId: 2,
    walletName: 'DANA',
  }

  const sampleMultiTxs = [
    {
      id: 90,
      amount: 14431,
      type: 'expense',
      category: 'tagihan/langganan',
      notes: 'Gemini Pro',
      date: '2026-10-08',
      currency: 'IDR',
      walletId: 2,
      walletName: 'DANA',
    },
    {
      id: 89,
      amount: 11303,
      type: 'expense',
      category: 'tagihan/langganan',
      notes: 'Gemini Pro',
      date: '2026-10-08',
      currency: 'IDR',
      walletId: 2,
      walletName: 'DANA',
    },
  ]

  it('renders "Transaksi Diperbarui" and "Diperbarui" badge in Indonesian when single transaction is updated', () => {
    useSettingsStore.setState({ locale: 'id' })
    render(
      <MemoryRouter>
        <TransactionSuccess data={sampleSingleTx} isUpdate={true} />
      </MemoryRouter>
    )

    expect(screen.getByText('Transaksi Diperbarui')).toBeDefined()
    expect(screen.getByText('Diperbarui')).toBeDefined()
    expect(screen.queryByText('Transaksi Berhasil Dicatat')).toBeNull()
    expect(screen.queryByText('Tersimpan')).toBeNull()
  })

  it('renders "2 Transaksi Diperbarui" and "Diperbarui" badge when batch transactions are updated', () => {
    useSettingsStore.setState({ locale: 'id' })
    render(
      <MemoryRouter>
        <TransactionSuccess data={sampleMultiTxs} isUpdate={true} />
      </MemoryRouter>
    )

    expect(screen.getByText('2 Transaksi Diperbarui')).toBeDefined()
    expect(screen.getByText('Diperbarui')).toBeDefined()
  })

  it('renders "Transaction Updated" and "Updated" when locale is en', () => {
    useSettingsStore.setState({ locale: 'en' })
    render(
      <MemoryRouter>
        <TransactionSuccess data={sampleSingleTx} isUpdate={true} />
      </MemoryRouter>
    )

    expect(screen.getByText('Transaction Updated')).toBeDefined()
    expect(screen.getByText('Updated')).toBeDefined()
  })

  it('renders "Transaksi Tercatat" and "Tersimpan" when creating a new transaction in Indonesian', () => {
    useSettingsStore.setState({ locale: 'id' })
    render(
      <MemoryRouter>
        <TransactionSuccess data={sampleSingleTx} isUpdate={false} />
      </MemoryRouter>
    )

    expect(screen.getByText(/Transaksi.*Dicatat|Transaksi.*Tercatat/)).toBeDefined()
    expect(screen.getByText('Tersimpan')).toBeDefined()
    expect(screen.queryByText('Transaksi Diperbarui')).toBeNull()
    expect(screen.queryByText('Diperbarui')).toBeNull()
  })
})
