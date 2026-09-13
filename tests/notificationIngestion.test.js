import { describe, it, expect } from 'vitest'
import {
  parseWithBankRegex,
  parseWithTokenBoundary,
  parseFinancialNotification,
  isFinancialMutation,
  findBestMatchingWallet,
  correlateInternalTransfers,
  FinTrackNotificationPlugin,
} from '../src/lib/notificationIngestion'

describe('notificationIngestion - 3-Tier Parsing Cascade', () => {
  it('correctly parses Tier 1 BCA transfer and payment notifications', () => {
    // Expense
    const bcaExpense = parseWithBankRegex(
      'm-BCA',
      'm-Transfer Berhasil. Transfer Rp 50.000 ke 1234567890 Bpk Budi Santoso',
      'com.bca'
    )
    expect(bcaExpense).not.toBeNull()
    expect(bcaExpense.institution).toBe('BCA')
    expect(bcaExpense.amount).toBe(50000)
    expect(bcaExpense.type).toBe('expense')
    expect(bcaExpense.tier).toBe(1)

    // Income
    const bcaIncome = parseWithBankRegex(
      'myBCA',
      'Transfer Masuk Rp 1.500.000 dari PT ABC Sukses Makmur',
      'com.bca.mybca'
    )
    expect(bcaIncome).not.toBeNull()
    expect(bcaIncome.amount).toBe(1500000)
    expect(bcaIncome.type).toBe('income')
  })

  it('correctly parses Tier 1 Mandiri Livin notifications', () => {
    const mandiri = parseWithBankRegex(
      'Livin by Mandiri',
      'Pembayaran Berhasil Rp 45.000 di Kopi Kenangan',
      'id.co.bankmandiri.livin'
    )
    expect(mandiri).not.toBeNull()
    expect(mandiri.institution).toBe('Mandiri Livin')
    expect(mandiri.amount).toBe(45000)
    expect(mandiri.type).toBe('expense')
  })

  it('correctly parses Tier 1 GoPay and OVO notifications', () => {
    const gopay = parseWithBankRegex(
      'GoPay',
      'Pembayaran Rp35.000 ke Solaria berhasil',
      'com.gojek.app'
    )
    expect(gopay).not.toBeNull()
    expect(gopay.institution).toBe('GoPay')
    expect(gopay.amount).toBe(35000)
    expect(gopay.type).toBe('expense')

    const ovoIncome = parseWithBankRegex(
      'OVO',
      'Kamu menerima transfer dana Rp 100.000 dari Budi',
      'ovo.id'
    )
    expect(ovoIncome).not.toBeNull()
    expect(ovoIncome.institution).toBe('OVO')
    expect(ovoIncome.amount).toBe(100000)
    expect(ovoIncome.type).toBe('income')
  })

  it('falls back to Tier 2 Token Boundary Extractor for other banking notifications', () => {
    const customBank = parseWithTokenBoundary(
      'Notifikasi Bank Digital',
      'Transaksi sukses didebit sebesar IDR 75.500 di Tokopedia'
    )
    expect(customBank).not.toBeNull()
    expect(customBank.amount).toBe(75500)
    expect(customBank.type).toBe('expense')
    expect(customBank.tier).toBe(2)
  })

  it('formats full parsed notification with clean merchant and category', () => {
    const full = parseFinancialNotification({
      title: 'Livin by Mandiri',
      text: 'Pembayaran QRIS Rp 25.000 ke Kopi Fore Jakarta',
      packageName: 'id.co.bankmandiri.livin',
      timestamp: 1788076800000,
    })

    expect(full).not.toBeNull()
    expect(full.amount).toBe(25000)
    expect(full.type).toBe('expense')
    expect(full.category).toBe('makanMinum/kopi')
    expect(full.cleanMerchant).toContain('Kopi Fore')
  })
})

describe('notificationIngestion - Anti-Spam & Promo Guardrails', () => {
  it('rejects spam, promo, OTP, and non-financial notifications', () => {
    expect(isFinancialMutation('GoPay Promo', 'Cashback s.d 50% hingga Rp 20.000 untuk transaksi berikutnya', 'com.gojek.app')).toBe(false)
    expect(isFinancialMutation('myBCA Keamanan', 'Kode OTP Anda adalah 819201. Jangan berikan kode ini ke siapa pun', 'com.bca')).toBe(false)
    expect(isFinancialMutation('Shopee Diskon', 'Voucher diskon 99% berlaku hari ini s&k berlaku', 'com.shopee.id')).toBe(false)
    expect(isFinancialMutation('Info Login', 'Perangkat baru terdeteksi pada akun Anda', 'com.bca')).toBe(false)
  })

  it('accepts genuine financial mutation notifications', () => {
    expect(isFinancialMutation('DANA', 'Pembayaran berhasil Rp 40.000 ke Merchant Kopi', 'id.dana')).toBe(true)
    expect(isFinancialMutation('BCA', 'm-Transfer Berhasil. Transfer Rp 150.000 ke Rekening 88912', 'com.bca')).toBe(true)
  })
})

describe('notificationIngestion - Fuzzy Wallet Matching', () => {
  const wallets = [
    { id: 1, name: 'Dompet Tunai', institutionType: 'cash', balance: 50000 },
    { id: 2, name: 'Rekening BCA Utama', institutionType: 'bank', accountNumber: '1234567890', balance: 5000000 },
    { id: 3, name: 'DANA Pribadi', institutionType: 'ewallet', balance: 150000 },
  ]

  it('correctly matches DANA notification to existing DANA wallet without duplicates', () => {
    const result = findBestMatchingWallet('DANA', wallets, 'Pembayaran berhasil Rp 35.000 di Alfamart')
    expect(result.wallet).not.toBeNull()
    expect(result.wallet.id).toBe(3)
    expect(result.isAmbiguous).toBe(false)
  })

  it('correctly matches BCA via 4-digit account number', () => {
    const result = findBestMatchingWallet('BCA', wallets, 'Transfer berhasil Rp 100.000 ke Rekening xxx7890')
    expect(result.wallet).not.toBeNull()
    expect(result.wallet.id).toBe(2)
    expect(result.isAmbiguous).toBe(false)
  })

  it('detects ambiguity when multiple matching accounts exist', () => {
    const multiBcaWallets = [
      { id: 20, name: 'BCA Tabungan', institutionType: 'bank', balance: 1000000 },
      { id: 21, name: 'BCA Bisnis', institutionType: 'bank', balance: 50000000 },
    ]
    const result = findBestMatchingWallet('BCA', multiBcaWallets, 'Transfer masuk Rp 500.000')
    expect(result.wallet).toBeNull()
    expect(result.isAmbiguous).toBe(true)
    expect(result.matches.length).toBe(2)
  })
})

describe('notificationIngestion - Internal Transfer Correlation', () => {
  const wallets = [
    { id: 1, name: 'BCA Utama', institutionType: 'bank', balance: 1000000 },
    { id: 2, name: 'GoPay Saldo', institutionType: 'ewallet', balance: 50000 },
  ]

  it('correlates dual expense and income mutations within 120s into a single Transfer', () => {
    const now = Date.now()
    const rawMutations = [
      {
        institution: 'BCA',
        amount: 200000,
        type: 'expense',
        rawDescription: 'Transfer ke GoPay Rp 200.000',
        date: '2026-08-30',
        createdAt: new Date(now).toISOString(),
      },
      {
        institution: 'GoPay',
        amount: 200000,
        type: 'income',
        rawDescription: 'Top up saldo Rp 200.000 dari BCA',
        date: '2026-08-30',
        createdAt: new Date(now + 15000).toISOString(),
      },
    ]

    const { correlated, transfersCreated } = correlateInternalTransfers(rawMutations, wallets)
    expect(transfersCreated).toBe(1)
    expect(correlated.length).toBe(1)
    expect(correlated[0].type).toBe('transfer')
    expect(correlated[0].amount).toBe(200000)
    expect(correlated[0].walletId).toBe(1) // from BCA
    expect(correlated[0].targetWalletId).toBe(2) // to GoPay
  })

  it('FinTrackNotificationPlugin supports drainQueuedMutations', async () => {
    const res = await FinTrackNotificationPlugin.drainQueuedMutations()
    expect(res).toBeDefined()
    expect(Array.isArray(res.mutations)).toBe(true)
  })
})
