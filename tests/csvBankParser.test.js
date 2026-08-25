import { describe, it, expect } from 'vitest'
import { parseCsvRows, detectBankFormat, normalizeBankRows } from '../src/lib/csvBankParser'

describe('csvBankParser', () => {
  it('parses CSV rows handling quoted commas', () => {
    const csv = 'Tanggal,Keterangan,Jumlah\n2026-08-01,"Beli Kopi, Roti",35000\n2026-08-02,Gaji,5000000'
    const rows = parseCsvRows(csv)
    expect(rows.length).toBe(3)
    expect(rows[1][1]).toBe('Beli Kopi, Roti')
    expect(rows[2][2]).toBe('5000000')
  })

  it('detects bank formats based on header names', () => {
    expect(detectBankFormat(['Tanggal', 'Keterangan', 'Mutasi', 'DB/CR'])).toBe('bca')
    expect(detectBankFormat(['Tanggal', 'Keterangan', 'Debet', 'Kredit', 'Saldo'])).toBe('mandiri')
    expect(detectBankFormat(['Transaction Date', 'Note', 'Amount', 'Jenius'])).toBe('jenius')
    expect(detectBankFormat(['Tanggal', 'Tipe Transaksi', 'Status', 'Gopay'])).toBe('gopay')
    expect(detectBankFormat(['Col1', 'Col2', 'Col3'])).toBe('generic')
  })

  it('normalizes parsed rows into transaction objects', () => {
    const rows = [
      ['Date', 'Desc', 'Amount', 'Type'],
      ['2026-08-10', 'Supermarket', '150.000', 'DB'],
      ['2026-08-11', 'Bonus', '500.000', 'CR'],
    ]

    const mapping = {
      dateIndex: 0,
      notesIndex: 1,
      amountIndex: 2,
      typeIndex: 3,
    }

    const txs = normalizeBankRows(rows, mapping)
    expect(txs.length).toBe(2)
    expect(txs[0].amount).toBe(150000)
    expect(txs[0].type).toBe('expense')
    expect(txs[1].amount).toBe(500000)
    expect(txs[1].type).toBe('income')
  })
})
