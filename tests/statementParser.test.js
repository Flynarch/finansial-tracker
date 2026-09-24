import { describe, it, expect } from 'vitest'
import {
  cleanMutationMerchant,
  matchCategoryFromDescription,
  detectBankPreset,
  parseBcaStatementLines,
  detectDuplicateTransactions,
  parseCsvStatement,
} from '../src/lib/statementParser'

describe('statementParser', () => {
  it('cleans cryptic bank transaction descriptions into clean merchant names', () => {
    const raw1 = 'TRSF E-BANKING DB 2808/FTSCY/WS95011 KOPI KENANGAN JAKARTA'
    expect(cleanMutationMerchant(raw1)).toBe('Kopi Kenangan Jakarta')

    const raw2 = 'QRIS PEMBAYARAN SPBU PERTAMINA 341234'
    expect(cleanMutationMerchant(raw2)).toBe('Spbu Pertamina 341234')

    const raw3 = 'TRANSFER KE REK 1234567890 Bpk Budi Santoso'
    expect(cleanMutationMerchant(raw3)).toBe('Bpk Budi Santoso')

    const raw4 = 'Pembayaran Berhasil Rp 45.000 di Kopi Kenangan'
    expect(cleanMutationMerchant(raw4)).toBe('Kopi Kenangan')

    const raw5 = 'Pembayaran Rp35.000 ke Solaria berhasil'
    expect(cleanMutationMerchant(raw5)).toBe('Solaria')

    const raw6 = 'Kamu menerima transfer dana Rp 100.000 dari Budi'
    expect(cleanMutationMerchant(raw6)).toBe('Budi')
  })

  it('matches category accurately from clean merchant description', () => {
    expect(matchCategoryFromDescription('Kopi Kenangan Grand Indonesia', 'expense')).toBe('makanan/kopi')
    expect(matchCategoryFromDescription('Restoran Padang Sederhana', 'expense')).toBe('makanan/makan_diluar')
    expect(matchCategoryFromDescription('McDonalds Sarinah Jakarta', 'expense')).toBe('makanan/makan_diluar')
    expect(matchCategoryFromDescription('Tagihan Listrik PLN Bulanan', 'expense')).toBe('tagihan/listrik')
    expect(matchCategoryFromDescription('Apotek Kimia Farma Tebet', 'expense')).toBe('kesehatan/obat')
    expect(matchCategoryFromDescription('Tiket Kereta KAI Gambir', 'expense')).toBe('transportasi/kereta')
    expect(matchCategoryFromDescription('Gaji Pokok Karyawan PT ABC', 'income')).toBe('gaji/gaji_pokok')
  })

  it('detects bank preset from raw text or headers', () => {
    expect(detectBankPreset('REKENING TAHAPAN BCA PT BANK CENTRAL ASIA')).toBe('bca')
    expect(detectBankPreset('LIVIN BY MANDIRI REKENING TABUNGAN')).toBe('mandiri')
    expect(detectBankPreset('JENIUS BTPN STATEMENT')).toBe('jenius')
    expect(detectBankPreset('UNKNOWN CSV DATA')).toBe('generic')
  })

  it('parses multi-line BCA statement lines accurately', () => {
    const lines = [
      '05/08 TRSF E-BANKING DB 2808/FTSCY 50,000.00 1,250,000.00',
      'KOPI KENANGAN GRAND INDONESIA',
      'JAKARTA PUSAT',
      '10/08 TRSF E-BANKING CR 1008/PAYROLL 15,000,000.00 16,250,000.00',
      'GAJI BULAN AGUSTUS 2026',
    ]

    const parsed = parseBcaStatementLines(lines, 2026)
    expect(parsed.length).toBe(2)

    // Transaction 1: Expense Kopi
    expect(parsed[0].date).toBe('2026-08-05')
    expect(parsed[0].type).toBe('expense')
    expect(parsed[0].amount).toBe(50000)
    expect(parsed[0].cleanMerchant).toContain('Kopi Kenangan')
    expect(parsed[0].category).toBe('makanan/kopi')

    // Transaction 2: Income Gaji
    expect(parsed[1].date).toBe('2026-08-10')
    expect(parsed[1].type).toBe('income')
    expect(parsed[1].amount).toBe(15000000)
    expect(parsed[1].category).toBe('gaji/gaji_pokok')
  })

  it('detects duplicate transactions against existing database records', () => {
    const existing = [
      { id: 101, date: '2026-08-05', amount: 50000, type: 'expense', notes: 'Kopi Kenangan Grand Indonesia' },
    ]

    const incoming = [
      { date: '2026-08-05', amount: 50000, type: 'expense', cleanMerchant: 'Kopi Kenangan Grand Indonesia' },
      { date: '2026-08-06', amount: 75000, type: 'expense', cleanMerchant: 'Makan Siang Resto Padang' },
    ]

    const results = detectDuplicateTransactions(incoming, existing)
    expect(results[0].isDuplicate).toBe(true)
    expect(results[0].selected).toBe(false) // Unchecked by default
    expect(results[1].isDuplicate).toBe(false)
    expect(results[1].selected).toBe(true)
  })

  it('parses CSV statements cleanly with PapaParse', async () => {
    const csv = `Date,Description,Amount,Type\n2026-08-01,Indomaret Belanja,35000,DB\n2026-08-02,Gaji Bonus,2000000,CR`
    const parsed = await parseCsvStatement(csv)
    expect(parsed.headers).toEqual(['Date', 'Description', 'Amount', 'Type'])
    expect(parsed.rows.length).toBe(2)
  })
})
