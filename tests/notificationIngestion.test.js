import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import {
  parseWithBankRegex,
  parseWithTokenBoundary,
  parseFinancialNotification,
  isFinancialMutation,
  findBestMatchingWallet,
  correlateInternalTransfers,
  FinTrackNotificationPlugin,
  scanSuspectPromoTransactions,
  cleanSuspectPromoTransactions,
  parseAmountFromRegexMatch,
} from '../src/lib/notificationIngestion'
import { db } from '../src/lib/db'

describe('notificationIngestion - 3-Tier Parsing Cascade', () => {
  it('correctly handles decimal sen (,00 or .00) in bank notifications without 100x multiplication error', () => {
    expect(parseAmountFromRegexMatch('50.000,00')).toBe(50000)
    expect(parseAmountFromRegexMatch('1.500.000,00')).toBe(1500000)
    expect(parseAmountFromRegexMatch('25000.00')).toBe(25000)

    const bcaWithSen = parseWithBankRegex(
      'm-BCA',
      'm-Transfer Berhasil. Transfer Rp 75.000,00 ke 1234567890 Bpk Budi',
      'com.bca'
    )
    expect(bcaWithSen).not.toBeNull()
    expect(bcaWithSen.amount).toBe(75000)

    const mandiriWithSen = parseWithBankRegex(
      'Livin by Mandiri',
      'Pembayaran Berhasil Rp 120.000,00 di Supermarket',
      'id.co.bankmandiri.livin'
    )
    expect(mandiriWithSen).not.toBeNull()
    expect(mandiriWithSen.amount).toBe(120000)

    const tokenBoundaryWithSen = parseWithTokenBoundary(
      'Bank Digital',
      'Transaksi sukses didebit IDR 30.000,00 di Merchant'
    )
    expect(tokenBoundaryWithSen).not.toBeNull()
    expect(tokenBoundaryWithSen.amount).toBe(30000)
  })

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
    expect(full.category).toBe('makanan/kopi')
    expect(full.cleanMerchant).toContain('Kopi Fore')
  })

  it('correctly parses Tier 1 Seabank, Bank Jago, Blu, Jenius, BSI, CIMB Niaga, and LINE Bank notifications', () => {
    // Seabank
    const seabankIncome = parseWithBankRegex(
      'SeaBank',
      'Transfer Masuk Berhasil. Transfer Rp 150.000 dari BCA',
      'com.seabank.id'
    )
    expect(seabankIncome).not.toBeNull()
    expect(seabankIncome.institution).toBe('Seabank')
    expect(seabankIncome.amount).toBe(150000)
    expect(seabankIncome.type).toBe('income')

    const seabankExpense = parseWithBankRegex(
      'SeaBank',
      'Transfer Keluar Berhasil Rp 50.000 ke DANA',
      'com.seabank.id'
    )
    expect(seabankExpense).not.toBeNull()
    expect(seabankExpense.amount).toBe(50000)
    expect(seabankExpense.type).toBe('expense')

    // Bank Jago
    const jagoIncome = parseWithBankRegex(
      'Bank Jago',
      'Uang Masuk: Rp 250.000 dari Tokopedia',
      'com.jago.bank'
    )
    expect(jagoIncome).not.toBeNull()
    expect(jagoIncome.institution).toBe('Bank Jago')
    expect(jagoIncome.amount).toBe(250000)
    expect(jagoIncome.type).toBe('income')

    const jagoExpense = parseWithBankRegex(
      'Bank Jago',
      'Uang Keluar: Rp 35.000 di Kopi Kenangan',
      'com.jago.bank'
    )
    expect(jagoExpense).not.toBeNull()
    expect(jagoExpense.amount).toBe(35000)
    expect(jagoExpense.type).toBe('expense')

    // Blu by BCA Digital
    const bluExpense = parseWithBankRegex(
      'blu',
      'Pembayaran QRIS Berhasil Rp 20.000 di Indomaret',
      'com.bca.blu'
    )
    expect(bluExpense).not.toBeNull()
    expect(bluExpense.institution).toBe('Blu')
    expect(bluExpense.amount).toBe(20000)
    expect(bluExpense.type).toBe('expense')

    // Jenius
    const jeniusIncome = parseWithBankRegex(
      'Jenius',
      'Uang masuk: Rp 500.000 dari PT Maju Jaya',
      'com.btpn.jenius'
    )
    expect(jeniusIncome).not.toBeNull()
    expect(jeniusIncome.institution).toBe('Jenius')
    expect(jeniusIncome.amount).toBe(500000)
    expect(jeniusIncome.type).toBe('income')

    // BSI
    const bsiExpense = parseWithBankRegex(
      'BSI Mobile',
      'Pembayaran QRIS Rp 25.000 berhasil di Kopi Kenangan',
      'com.bsi.mobile'
    )
    expect(bsiExpense).not.toBeNull()
    expect(bsiExpense.institution).toBe('BSI')
    expect(bsiExpense.amount).toBe(25000)
    expect(bsiExpense.type).toBe('expense')

    // CIMB Niaga OCTO Mobile
    const cimbExpense = parseWithBankRegex(
      'OCTO Mobile',
      'Pembayaran QRIS Rp 45.000 di Solaria',
      'id.co.cimbniaga.octomobile'
    )
    expect(cimbExpense).not.toBeNull()
    expect(cimbExpense.institution).toBe('CIMB Niaga')
    expect(cimbExpense.amount).toBe(45000)
    expect(cimbExpense.type).toBe('expense')

    // LINE Bank
    const lineExpense = parseWithBankRegex(
      'LINE Bank',
      'Pembayaran QRIS Rp 30.000 berhasil di Mixue',
      'com.linecorp.linebank.id'
    )
    expect(lineExpense).not.toBeNull()
    expect(lineExpense.institution).toBe('LINE Bank')
    expect(lineExpense.amount).toBe(30000)
    expect(lineExpense.type).toBe('expense')
  })
})

describe('notificationIngestion - Anti-Spam & Promo Guardrails', () => {
  it('rejects spam, promo, OTP, and non-financial notifications', () => {
    expect(isFinancialMutation('GoPay Promo', 'Cashback s.d 50% hingga Rp 20.000 untuk transaksi berikutnya', 'com.gojek.app')).toBe(false)
    expect(isFinancialMutation('myBCA Keamanan', 'Kode OTP Anda adalah 819201. Jangan berikan kode ini ke siapa pun', 'com.bca')).toBe(false)
    expect(isFinancialMutation('Shopee Diskon', 'Voucher diskon 99% berlaku hari ini s&k berlaku', 'com.shopee.id')).toBe(false)
    expect(isFinancialMutation('Info Login', 'Perangkat baru terdeteksi pada akun Anda', 'com.bca')).toBe(false)
  })

  it('rejects user-reported marketing push notifications and clickbaits', () => {
    // Exact user screenshot 1: ShopeePay promo about free Seabank balance
    expect(
      isFinancialMutation(
        'ShopeePay',
        'Terima Saldo Gratis Rp200.000-nya, Kak Ricopratama112 Bisa Terima Saldo Rp200.000 Gratis Dari Seabank di Sini \u{1F449}',
        'com.shopee.id'
      )
    ).toBe(false)

    // Exact user screenshot 2: DANA marketing notification with question mark & CTA
    expect(
      isFinancialMutation(
        'DANA',
        'Dana \u{1F525}mau Hemat Berkali-kali S/d Rp1 0rb Transfer ke Bank? Cek Caranya Yuk!',
        'id.dana'
      )
    ).toBe(false)

    // Marketing question hooks and CTAs
    expect(isFinancialMutation('DANA Promo', 'Mau Saldo Gratis Rp 50.000? Cek di sini!', 'id.dana')).toBe(false)
    expect(isFinancialMutation('ShopeePay', 'Klaim Saldo Gratis Rp 100.000 Buruan klik sekarang', 'com.shopee.id')).toBe(false)
    expect(isFinancialMutation('GoPay', 'Ajak teman dan dapatkan saldo Rp25.000 sekarang juga!', 'com.gojek.app')).toBe(false)
  })

  it('rejects failed, cancelled, expired, or unpaid reminder notifications', () => {
    expect(isFinancialMutation('BCA', 'Pembayaran QRIS sebesar Rp 50.000 GAGAL', 'com.bca')).toBe(false)
    expect(isFinancialMutation('Mandiri', 'Transfer Rp 100.000 tidak berhasil', 'id.co.bankmandiri.livin')).toBe(false)
    expect(isFinancialMutation('DANA', 'Transaksi dibatalkan Rp 25.000', 'id.dana')).toBe(false)
    expect(isFinancialMutation('Shopee', 'Pesanan menunggu pembayaran sebesar Rp 75.000', 'com.shopee.id')).toBe(false)
    expect(isFinancialMutation('PLN', 'Tagihan telah terbit sebesar Rp 250.000 jatuh tempo besok', 'com.pln')).toBe(false)
  })

  it('accepts genuine financial mutation notifications', () => {
    expect(isFinancialMutation('DANA', 'Pembayaran berhasil Rp 40.000 ke Merchant Kopi', 'id.dana')).toBe(true)
    expect(isFinancialMutation('BCA', 'm-Transfer Berhasil. Transfer Rp 150.000 ke Rekening 88912', 'com.bca')).toBe(true)
    expect(isFinancialMutation('ShopeePay', 'Pembayaran sebesar Rp 75.000 ke Solaria berhasil', 'com.shopee.id')).toBe(true)
    expect(isFinancialMutation('SeaBank', 'Transfer Masuk Berhasil Rp 500.000 dari BCA', 'com.seabank.id')).toBe(true)
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

  it('does NOT match ShopeePay notification to DANA wallet just because both are e-wallets', () => {
    // User does NOT have a ShopeePay wallet. It must NOT silently match DANA!
    const result = findBestMatchingWallet('ShopeePay', wallets, 'Pembayaran berhasil Rp 50.000')
    expect(result.wallet).toBeNull()
    expect(result.matches.length).toBe(0)
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
    expect(correlated[0].cleanMerchant).toContain('Pindah Dana')
    // By default without auto-approve: requires manual review
    expect(correlated[0].isPendingReview).toBe(true)

    // With notificationAutoApprove enabled: auto-approves unambiguous matches
    const { correlated: autoAppr } = correlateInternalTransfers(rawMutations, wallets, { notificationAutoApprove: true })
    expect(autoAppr[0].isPendingReview).toBe(false)
  })

  it('correlates internal transfers when timestamps are numeric strings (e.g. from JSON)', () => {
    const baseMs = 1727050000000
    const rawMutations = [
      {
        institution: 'BCA',
        amount: 150000,
        type: 'expense',
        rawDescription: 'Transfer ke GoPay Rp 150.000',
        date: '2026-08-30',
        createdAt: String(baseMs),
      },
      {
        institution: 'GoPay',
        amount: 150000,
        type: 'income',
        rawDescription: 'Top up saldo Rp 150.000 dari BCA',
        date: '2026-08-30',
        createdAt: String(baseMs + 10000),
      },
    ]

    const { correlated, transfersCreated } = correlateInternalTransfers(rawMutations, wallets)
    expect(transfersCreated).toBe(1)
    expect(correlated.length).toBe(1)
    expect(correlated[0].type).toBe('transfer')
    expect(correlated[0].amount).toBe(150000)
  })

  it('requires manual review (isPendingReview: true) when both ends match the same wallet even if auto-approve is enabled', () => {
    // Single generic wallet
    const singleWallet = [{ id: 1, name: 'Rekening Bank', institutionType: 'bank', balance: 500000 }]
    const rawMutations = [
      {
        institution: 'BCA',
        amount: 100000,
        type: 'expense',
        rawDescription: 'Transfer Rp 100.000',
        date: '2026-08-30',
        createdAt: Date.now(),
      },
      {
        institution: 'BCA',
        amount: 100000,
        type: 'income',
        rawDescription: 'Transfer Masuk Rp 100.000',
        date: '2026-08-30',
        createdAt: Date.now() + 5000,
      },
    ]

    const { correlated } = correlateInternalTransfers(rawMutations, singleWallet, { notificationAutoApprove: true })
    expect(correlated[0].type).toBe('transfer')
    expect(correlated[0].isPendingReview).toBe(true)
  })

  it('safely parses amounts with trailing sen and punctuation via parseAmountFromRegexMatch', () => {
    expect(parseAmountFromRegexMatch('50.000,00')).toBe(50000)
    expect(parseAmountFromRegexMatch('50.000,00.')).toBe(50000)
    expect(parseAmountFromRegexMatch('50.000,00.-')).toBe(50000)
    expect(parseAmountFromRegexMatch('1.500.000,00')).toBe(1500000)
    expect(parseAmountFromRegexMatch('25000.00')).toBe(25000)
    expect(parseAmountFromRegexMatch('')).toBe(0)
  })

  it('FinTrackNotificationPlugin supports drainQueuedMutations', async () => {
    const res = await FinTrackNotificationPlugin.drainQueuedMutations()
    expect(res).toBeDefined()
    expect(Array.isArray(res.mutations)).toBe(true)
  })
})

describe('notificationIngestion - Promo Scanner & Bulk Cleanup', () => {
  it('identifies and cleans suspect promo transactions from the ledger', async () => {
    // Insert mock suspect promo transactions into dexie
    const tx1Id = await db.transactions.add({
      date: '2026-09-18',
      type: 'expense',
      amount: 200000,
      currency: 'IDR',
      notes: '[Auto: ShopeePay] Terima Saldo Gratis Rp200.000-nya, Kak Ricopratama112 Bisa Terima Saldo Rp200.000 Gratis Dari Seabank di Sini \u{1F449}',
      source: 'notification_listener',
      category: 'lainnya_kategori/umum',
    })

    const tx2Id = await db.transactions.add({
      date: '2026-09-21',
      type: 'expense',
      amount: 10,
      currency: 'IDR',
      notes: '[Auto: DANA] Dana \u{1F525}mau Hemat Berkali-kali S/d Rp1 0rb Transfer ke Bank? Cek Caranya Yuk!',
      source: 'notification_listener',
      category: 'lainnya_kategori/umum',
    })

    // Legitimate transaction should NOT be identified as suspect promo
    const txValidId = await db.transactions.add({
      date: '2026-09-21',
      type: 'expense',
      amount: 45000,
      currency: 'IDR',
      notes: '[Auto: DANA] Pembayaran Berhasil ke Solaria',
      source: 'notification_listener',
      category: 'makanMinum/restoran',
    })

    // 1. Scan
    const suspect = await scanSuspectPromoTransactions()
    const suspectIds = suspect.map((t) => t.id)
    expect(suspectIds).toContain(tx1Id)
    expect(suspectIds).toContain(tx2Id)
    expect(suspectIds).not.toContain(txValidId)

    // 2. Clean suspect transactions
    const cleanResult = await cleanSuspectPromoTransactions([tx1Id, tx2Id])
    expect(cleanResult.deletedCount).toBe(2)

    // 3. Confirm soft-deletion
    const after1 = await db.transactions.get(tx1Id)
    const after2 = await db.transactions.get(tx2Id)
    const afterValid = await db.transactions.get(txValidId)

    expect(after1.deletedAt).toBeDefined()
    expect(after2.deletedAt).toBeDefined()
    expect(afterValid.deletedAt).toBeUndefined()

    // Cleanup valid test tx
    await db.transactions.delete(txValidId)
    await db.transactions.delete(tx1Id)
    await db.transactions.delete(tx2Id)
  })
})

describe('notificationIngestion - DANA Mutation Ingestion & Classification', () => {
  it('correctly parses outgoing payment with celebratory emoji and di sini receipt confirmation as expense', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Kirim Uang Berhasil \u{1F389}! Kamu telah membayar Rp 50.000 ke Budi Santoso. Uang masuk ke saldo penerima. Cek detail transaksi di sini.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(50000)
    expect(parsed.type).toBe('expense')
  })

  it('correctly parses outgoing payment with IDR format as expense', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Kamu telah membayar IDR 35.000 di Kopi Kenangan. Cek detail transaksi di sini.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(35000)
    expect(parsed.type).toBe('expense')
  })

  it('correctly parses top up and balance increase (isi saldo) as income', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Isi Saldo Berhasil! Saldo bertambah Rp 100.000 via BCA Virtual Account. Cek detail transaksi di sini.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(100000)
    expect(parsed.type).toBe('income')
  })

  it('correctly parses incoming transfer (kirim uang diterima) as income', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Kirim Uang Diterima! Kamu menerima uang sebesar Rp 75.000 dari Siska. Cek detail transaksi di sini.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(75000)
    expect(parsed.type).toBe('income')
  })

  it('correctly parses incoming gift transfer (dapat kiriman) as income with IDR amount', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Dapat kiriman uang! Kiriman uang sebesar IDR 250.000 dari Ahmad telah masuk ke saldo.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(250000)
    expect(parsed.type).toBe('income')
  })

  it('correctly parses completed transaction (transaksi selesai) as expense', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Transaksi Selesai! Kamu telah membayar Rp 120.000 ke Solaria. Cek detail transaksi di sini.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(120000)
    expect(parsed.type).toBe('expense')
  })

  it('rejects marketing promos containing click here or claim phrases', () => {
    expect(
      isFinancialMutation(
        'DANA Promo',
        'Klaim Saldo DANA Gratis Rp 50.000! Klik di sini sekarang',
        'id.dana'
      )
    ).toBe(false)

    expect(
      isFinancialMutation(
        'DANA',
        'Promo di sini! Dapatkan voucher diskon hingga Rp 25.000',
        'id.dana'
      )
    ).toBe(false)
  })

  it('correctly parses outgoing transfer (berhasil dikirim ke) as expense', () => {
    const rawNotif = {
      title: 'DANA',
      text: 'Berhasil dikirim Rp 80.000 ke rekening BNI. Uang masuk ke rekening tujuan. Cek detail transaksi di sini.',
      packageName: 'id.dana',
      timestamp: Date.now(),
    }

    expect(isFinancialMutation(rawNotif.title, rawNotif.text, rawNotif.packageName)).toBe(true)

    const parsed = parseFinancialNotification(rawNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.institution).toBe('DANA')
    expect(parsed.amount).toBe(80000)
    expect(parsed.type).toBe('expense')
  })

  it('permits authentic DANA receipts containing celebratory emojis', () => {
    // 1. Transfer receipt with money-with-wings (\u{1F4B8})
    const transferNotif = {
      title: 'Kirim Uang Berhasil! \u{1F4B8}',
      text: 'Kamu berhasil kirim Rp 50.000 ke Budi. Cek detail transaksi di sini.',
      packageName: 'id.dana',
    }
    expect(isFinancialMutation(transferNotif.title, transferNotif.text, transferNotif.packageName)).toBe(true)
    const parsedTransfer = parseFinancialNotification(transferNotif)
    expect(parsedTransfer).not.toBeNull()
    expect(parsedTransfer.amount).toBe(50000)
    expect(parsedTransfer.type).toBe('expense')

    // 2. QRIS payment receipt with sparkles (\u{2728})
    const qrisNotif = {
      title: 'Pembayaran Berhasil \u{2728}',
      text: 'Pembayaran sebesar Rp 35.000 ke Fore Coffee berhasil.',
      packageName: 'id.dana',
    }
    expect(isFinancialMutation(qrisNotif.title, qrisNotif.text, qrisNotif.packageName)).toBe(true)
    const parsedQris = parseFinancialNotification(qrisNotif)
    expect(parsedQris).not.toBeNull()
    expect(parsedQris.amount).toBe(35000)
    expect(parsedQris.type).toBe('expense')

    // 3. Top-up receipt with party popper (\u{1F389})
    const topupNotif = {
      title: 'Isi Saldo Berhasil! \u{1F389}',
      text: 'Saldo DANA kamu bertambah Rp 100.000 dari BCA',
      packageName: 'id.dana',
    }
    expect(isFinancialMutation(topupNotif.title, topupNotif.text, topupNotif.packageName)).toBe(true)
    const parsedTopup = parseFinancialNotification(topupNotif)
    expect(parsedTopup).not.toBeNull()
    expect(parsedTopup.amount).toBe(100000)
    expect(parsedTopup.type).toBe('income')
  })

  it('correctly handles DANA Kaget notifications as income', () => {
    const kagetNotif = {
      title: 'DANA',
      text: 'Kamu dapat DANA Kaget Rp 10.000 dari Sarah!',
      packageName: 'id.dana',
    }
    expect(isFinancialMutation(kagetNotif.title, kagetNotif.text, kagetNotif.packageName)).toBe(true)
    const parsed = parseFinancialNotification(kagetNotif)
    expect(parsed).not.toBeNull()
    expect(parsed.amount).toBe(10000)
    expect(parsed.type).toBe('income')
  })
})
