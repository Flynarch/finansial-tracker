import { describe, it, expect } from 'vitest'
import {
  cleanMutationMerchant,
  matchCategoryFromDescription,
  detectBankPreset,
  parseBcaStatementLines,
  detectDuplicateTransactions,
  parseCsvStatement,
  parseGenericCsvRows,
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

  it('parses generic CSV rows with dual-column Debit & Credit and thousand separators', () => {
    const rows = [
      { Tanggal: '2026-09-01', Uraian: 'Makan Siang', Debet: '50.000,00', Kredit: '' },
      { Tanggal: '2026-09-02', Uraian: 'Gaji Pokok', Debet: '', Kredit: '12.500.000,00' },
      { Tanggal: '2026-09-03', Uraian: 'Kopi Susu', Debet: '12.345,50', Kredit: '' },
    ]
    const mapping = {
      dateCol: 'Tanggal',
      descCol: 'Uraian',
      debitCol: 'Debet',
      creditCol: 'Kredit',
    }
    const results = parseGenericCsvRows(rows, mapping)
    expect(results.length).toBe(3)

    expect(results[0].amount).toBe(50000)
    expect(results[0].type).toBe('expense')
    expect(results[0].date).toBe('2026-09-01')

    expect(results[1].amount).toBe(12500000)
    expect(results[1].type).toBe('income')
    expect(results[1].date).toBe('2026-09-02')

    expect(results[2].amount).toBe(12345.5)
    expect(results[2].type).toBe('expense')
  })

  it('parses BCA statements with 4-digit and 2-digit years and hyphens', () => {
    const lines = [
      '05/08/2026 TRSF E-BANKING DB 2808/FTSCY 50,000.00 1,250,000.00',
      'KOPI KENANGAN',
      '10-08-26 TRSF E-BANKING CR 1008/PAYROLL 5,000,000.00 6,250,000.00',
      'BONUS PROYEK',
    ]
    const parsed = parseBcaStatementLines(lines, 2026)
    expect(parsed.length).toBe(2)
    expect(parsed[0].date).toBe('2026-08-05')
    expect(parsed[0].amount).toBe(50000)
    expect(parsed[1].date).toBe('2026-08-10')
    expect(parsed[1].amount).toBe(5000000)
  })

  it('filters duplicate detection by selectedWalletId and prevents empty description false matches', () => {
    const existing = [
      { id: 101, walletId: 1, date: '2026-08-05', amount: 50000, type: 'expense', notes: 'Kopi Kenangan' },
      { id: 102, walletId: 2, date: '2026-08-05', amount: 50000, type: 'expense', notes: 'Kopi Kenangan' },
      { id: 103, walletId: 1, date: '2026-08-07', amount: 25000, type: 'expense', notes: '' },
    ]

    const incoming = [
      // Matches wallet 1 only
      { date: '2026-08-05', amount: 50000, type: 'expense', cleanMerchant: 'Kopi Kenangan' },
      // Same amount & date as tx 103, but both have empty/generic descriptions - must NOT duplicate
      { date: '2026-08-07', amount: 25000, type: 'expense', cleanMerchant: '', rawDescription: '' },
    ]

    // With selectedWalletId = 1
    const resWallet1 = detectDuplicateTransactions(incoming, existing, 1)
    expect(resWallet1[0].isDuplicate).toBe(true)
    expect(resWallet1[0].duplicateMatch.id).toBe(101)
    expect(resWallet1[1].isDuplicate).toBe(false) // Empty description prevents false match

    // With selectedWalletId = 3 (different wallet)
    const resWallet3 = detectDuplicateTransactions(incoming, existing, 3)
    expect(resWallet3[0].isDuplicate).toBe(false)
  })

  it('parses BCA statements formatted with Indonesian decimal comma and dot thousands', () => {
    const lines = [
      '05/08/2026 TRSF E-BANKING DB 2808/FTSCY 50.000,00 1.250.000,00',
      'TRANSFER KE TOKO BUKU',
    ]
    const parsed = parseBcaStatementLines(lines, 2026)
    expect(parsed.length).toBe(1)
    expect(parsed[0].amount).toBe(50000)
    expect(parsed[0].type).toBe('expense')
    expect(parsed[0].rawDescription).toContain('TRANSFER KE TOKO BUKU')
  })

  it('does not split BCA rows prematurely when continuation lines contain code matching date-like numbers', () => {
    const lines = [
      '05/08/2026 TRSF E-BANKING DB 2808/FTSCY 50,000.00 1,250,000.00',
      '45/12 NOTA DEBET NO 9999',
    ]
    const parsed = parseBcaStatementLines(lines, 2026)
    expect(parsed.length).toBe(1)
    expect(parsed[0].amount).toBe(50000)
    expect(parsed[0].rawDescription).toContain('45/12 NOTA DEBET')
  })

  it('clears duplicateMatch and ignores soft-deleted transactions during deduplication', () => {
    const existing = [
      { id: 201, walletId: 1, date: '2026-09-01', amount: 75000, type: 'expense', notes: 'Makan Siang' },
      { id: 202, walletId: 1, date: '2026-09-02', amount: 30000, type: 'expense', notes: 'Kopi', deletedAt: '2026-09-03' },
    ]

    const incoming = [
      { date: '2026-09-01', amount: 75000, type: 'expense', cleanMerchant: 'Makan Siang' },
      // Same date & amount as tx 202, but tx 202 has deletedAt -> must NOT duplicate
      { date: '2026-09-02', amount: 30000, type: 'expense', cleanMerchant: 'Kopi' },
    ]

    const res1 = detectDuplicateTransactions(incoming, existing, 1)
    expect(res1[0].isDuplicate).toBe(true)
    expect(res1[0].duplicateMatch.id).toBe(201)
    expect(res1[1].isDuplicate).toBe(false) // Soft-deleted tx ignored

    // Re-check for wallet 2: previous match must be cleared to null
    const res2 = detectDuplicateTransactions(res1, existing, 2)
    expect(res2[0].isDuplicate).toBe(false)
    expect(res2[0].duplicateMatch).toBeNull()
  })

  it('skips summary and subtotal rows in generic CSV parsing', () => {
    const rows = [
      { Tanggal: '2026-09-01', Uraian: 'Makan Siang', Debet: '50.000,00', Kredit: '' },
      { Tanggal: '', Uraian: 'Total Pengeluaran', Debet: '50.000,00', Kredit: '' },
      { Tanggal: '2026-09-01', Uraian: 'Saldo Akhir', Debet: '', Kredit: '1.000.000,00' },
    ]
    const mapping = {
      dateCol: 'Tanggal',
      descCol: 'Uraian',
      debitCol: 'Debet',
      creditCol: 'Kredit',
    }
    const results = parseGenericCsvRows(rows, mapping)
    expect(results.length).toBe(1)
    expect(results[0].amount).toBe(50000)
    expect(results[0].cleanMerchant).toBe('Makan Siang')
  })
})
