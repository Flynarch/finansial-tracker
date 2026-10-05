import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'

// 1. Facade and sub-module imports for NLP
import {
  parseIndonesianAmount,
  extractMonetaryAmountFromText,
  parseIndonesianFinancialText,
  parseMultiClauseTransactions,
  extractDateFromPhrase,
  normalizeIndonesianNlpText,
} from '../src/lib/ai/indonesianFinanceNlp'

import * as NlpSubmodule from '../src/lib/ai/nlp'

// 2. Facade and sub-module imports for Notification Ingestion
import {
  parseWithBankRegex,
  isFinancialMutation,
  findBestMatchingWallet,
  correlateInternalTransfers,
  extractTransactionRef,
} from '../src/lib/notificationIngestion'

import * as BankParsers from '../src/lib/notifications/parsers/bankParsers'
import * as AntiSpamGuard from '../src/lib/notifications/parsers/antiSpamGuard'
import * as WalletMatcher from '../src/lib/notifications/parsers/walletMatcher'

describe('Challenger M3_1: Adversarial Stress Test Suite', () => {
  const mockWallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'GoPay', currency: 'IDR' },
    { id: 3, name: 'DANA', currency: 'IDR' },
    { id: 4, name: 'Dompet Tunai', type: 'cash', currency: 'IDR' },
    { id: 5, name: 'Mandiri Tabungan', currency: 'IDR' },
  ]

  // Fixed reference date: Wednesday, 2026-10-07 15:30:00
  const refDateWednesday = new Date(2026, 9, 7, 15, 30, 0) // Month index 9 = October

  // =========================================================================
  // SECTION 1: Indonesian NLP - Slang Currency, Dates & Multi-Clause Splits
  // =========================================================================
  describe('1. Indonesian NLP Parsing Robustness', () => {
    describe('1.1 Slang Currency and Formatted Amount Handling', () => {
      it('correctly parses colloquial Indonesian slang numbers (parseIndonesianAmount)', () => {
        expect(parseIndonesianAmount('50rb')).toBe(50000)
        expect(parseIndonesianAmount('1,5jt')).toBe(1500000)
        expect(parseIndonesianAmount('1.5jt')).toBe(1500000)
        expect(parseIndonesianAmount('cepek')).toBe(100000)
        expect(parseIndonesianAmount('seceng')).toBe(1000)
        expect(parseIndonesianAmount('noceng')).toBe(2000)
        expect(parseIndonesianAmount('goceng')).toBe(5000)
        expect(parseIndonesianAmount('ceban')).toBe(10000)
        expect(parseIndonesianAmount('cenggo')).toBe(15000)
        expect(parseIndonesianAmount('nocenggo')).toBe(25000)
        expect(parseIndonesianAmount('gocap')).toBe(50000)
        expect(parseIndonesianAmount('pekgo')).toBe(150000)
        expect(parseIndonesianAmount('sejeti')).toBe(1000000)
        expect(parseIndonesianAmount('100k')).toBe(100000)
        expect(parseIndonesianAmount('2.5miliar')).toBe(2500000000)
        expect(parseIndonesianAmount('Rp 25.000,00')).toBe(25000)
      })

      it('extracts monetary amounts accurately from raw sentences (extractMonetaryAmountFromText)', () => {
        expect(extractMonetaryAmountFromText('beli kopi kenangan 50rb pakai gopay')).toBe(50000)
        expect(extractMonetaryAmountFromText('dapet bonus proyek 1,5jt barusan')).toBe(1500000)
        expect(extractMonetaryAmountFromText('keluar cepek buat bayar makan malam')).toBe(100000)
        expect(extractMonetaryAmountFromText('kemarin habis gocap buat bensin')).toBe(50000)
        expect(extractMonetaryAmountFromText('beli cemilan goceng di alfa')).toBe(5000)
        expect(extractMonetaryAmountFromText('jajan es krim 15k')).toBe(15000)
      })

      it('handles arithmetic and multiplier expressions in sentences', () => {
        // Multiplier: 3x 20rb = 60000
        expect(extractMonetaryAmountFromText('beli 3 porsi @ 20rb')).toBe(60000)
        expect(extractMonetaryAmountFromText('beli 2 cup per 15k')).toBe(30000)
        // Arithmetic: 35k + 5k = 40000
        expect(extractMonetaryAmountFromText('makan 35k + 5k')).toBe(40000)
      })

      it('protects against date numbers being falsely captured as monetary amounts', () => {
        // "tanggal 15 beli kopi 25k" -> amount should be 25000, NOT 15
        expect(extractMonetaryAmountFromText('tanggal 15 beli kopi 25k')).toBe(25000)
        // "9 september dapet 60k" -> amount should be 60000, NOT 9
        expect(extractMonetaryAmountFromText('9 september dapet 60k')).toBe(60000)
        // "2 hari lalu makan siang 35rb" -> amount should be 35000, NOT 2
        expect(extractMonetaryAmountFromText('2 hari lalu makan siang 35rb')).toBe(35000)
        // "12/09 jajan 10k" -> amount should be 10000, NOT 12 or 9
        expect(extractMonetaryAmountFromText('12/09 jajan 10k')).toBe(10000)
      })
    })

    describe('1.2 Date Shifts & Typos', () => {
      it('computes accurate relative dates from anchor Wednesday 2026-10-07', () => {
        // 'kemarin' -> 2026-10-06 (Tuesday)
        const kmrn = extractDateFromPhrase('kemarin beli martabak 30k', refDateWednesday)
        expect(kmrn?.dateStr).toBe('2026-10-06')

        // 'semalam' -> 2026-10-06
        const smlm = extractDateFromPhrase('semalam makan sate 40k', refDateWednesday)
        expect(smlm?.dateStr).toBe('2026-10-06')

        // 'kemarin lusa' -> 2026-10-05 (Monday)
        const kmrnLusa = extractDateFromPhrase('kemarin lusa beli bensin 25k', refDateWednesday)
        expect(kmrnLusa?.dateStr).toBe('2026-10-05')

        // '2 hari lalu' -> 2026-10-05
        const duaHariLalu = extractDateFromPhrase('2 hari lalu beli buku 100k', refDateWednesday)
        expect(duaHariLalu?.dateStr).toBe('2026-10-05')

        // 'besok' -> 2026-10-08 (Thursday)
        const bsk = extractDateFromPhrase('besok bayar kosan 1.5jt', refDateWednesday)
        expect(bsk?.dateStr).toBe('2026-10-08')

        // 'lusa' -> 2026-10-09 (Friday)
        const lusa = extractDateFromPhrase('lusa mau servis motor 150k', refDateWednesday)
        expect(lusa?.dateStr).toBe('2026-10-09')
      })

      it('resolves day of week names and typos correctly', () => {
        // On Wed 2026-10-07:
        // 'selasa' -> 2026-10-06 (1 day ago)
        const selasa = extractDateFromPhrase('hari selasa makan bakso 20k', refDateWednesday)
        expect(selasa?.dateStr).toBe('2026-10-06')

        // 'senin' -> 2026-10-05 (2 days ago)
        const senin = extractDateFromPhrase('hari senin beli pulsa 50k', refDateWednesday)
        expect(senin?.dateStr).toBe('2026-10-05')

        // Typo: 'jumwt' -> past Friday 2026-10-02 (5 days ago)
        const jumwt = extractDateFromPhrase('hari jumwt nonton bioskop 60k', refDateWednesday)
        expect(jumwt?.dateStr).toBe('2026-10-02')

        // Typo: 'senn' -> past Monday 2026-10-05
        const senn = extractDateFromPhrase('senn jajan kopi 25k', refDateWednesday)
        expect(senn?.dateStr).toBe('2026-10-05')

        // 'senin lalu' -> 7 days prior to last Monday = 2026-09-28
        const seninLalu = extractDateFromPhrase('senin lalu beli baju 200k', refDateWednesday)
        expect(seninLalu?.dateStr).toBe('2026-09-28')
      })

      it('resolves calendar dates with months', () => {
        const tgl = extractDateFromPhrase('9 september dapet bonus 1jt', refDateWednesday)
        expect(tgl?.dateStr).toBe('2026-09-09')

        const tglFull = extractDateFromPhrase('25 agustus 2026 bayar asuransi 500k', refDateWednesday)
        expect(tglFull?.dateStr).toBe('2026-08-25')
      })
    })

    describe('1.3 Multi-Clause Splits & Complex Sentences', () => {
      it('correctly parses multi-clause sentence with income and expense across dates', () => {
        const sentence = '9 september dapet uang saku 60k dan 12 sep 25k buat beli paketan (dana)'
        const result = parseIndonesianFinancialText(sentence, mockWallets, 'IDR', refDateWednesday)

        expect(result).not.toBeNull()
        expect(result.type).toBe('transactions')
        expect(result.action).toBe('create')
        expect(result.transactions).toHaveLength(2)

        const [tx1, tx2] = result.transactions

        // Transaction 1: 9 September, Income 60k
        expect(tx1.type).toBe('income')
        expect(tx1.amount).toBe(60000)
        expect(tx1.date).toBe('2026-09-09')

        // Transaction 2: 12 September, Expense 25k, DANA wallet
        expect(tx2.type).toBe('expense')
        expect(tx2.amount).toBe(25000)
        expect(tx2.date).toBe('2026-09-12')
        expect(tx2.walletId).toBe(3) // DANA wallet ID
      })

      it('splits multi-clause sentence separated by "lalu" with mixed wallet matching', () => {
        const sentence = 'kemarin dapet transferan 500rb di bca lalu beli bensin 50rb pakai tunai'
        const result = parseIndonesianFinancialText(sentence, mockWallets, 'IDR', refDateWednesday)

        expect(result).not.toBeNull()
        expect(result.type).toBe('transactions')
        expect(result.transactions).toHaveLength(2)

        const [txIncome, txExpense] = result.transactions
        expect(txIncome.type).toBe('income')
        expect(txIncome.amount).toBe(500000)
        expect(txIncome.date).toBe('2026-10-06')
        expect(txIncome.walletId).toBe(1) // BCA

        expect(txExpense.type).toBe('expense')
        expect(txExpense.amount).toBe(50000)
        expect(txExpense.date).toBe('2026-10-06') // inherits previous date
        expect(txExpense.walletId).toBe(4) // Dompet Tunai
      })

      it('splits 3-clause sentences separated by commas and conjunctions', () => {
        const sentence = 'kemarin dapet cuan 200k, beli kopi 25k, sama makan siang 40k'
        const result = parseIndonesianFinancialText(sentence, mockWallets, 'IDR', refDateWednesday)

        expect(result).not.toBeNull()
        expect(result.transactions).toHaveLength(3)

        expect(result.transactions[0].type).toBe('income')
        expect(result.transactions[0].amount).toBe(200000)

        expect(result.transactions[1].type).toBe('expense')
        expect(result.transactions[1].amount).toBe(25000)

        expect(result.transactions[2].type).toBe('expense')
        expect(result.transactions[2].amount).toBe(40000)
      })

      it('handles balance transfer heuristic (parseTransferTransaction)', () => {
        const sentence = 'transfer 100k dari bca ke gopay'
        const result = parseIndonesianFinancialText(sentence, mockWallets, 'IDR', refDateWednesday)

        expect(result).not.toBeNull()
        expect(result.transactions[0].type).toBe('transfer')
        expect(result.amount).toBe(100000)
        expect(result.sourceWalletId).toBe(1) // BCA
        expect(result.targetWalletId).toBe(2) // GoPay
      })
    })
  })

  // =========================================================================
  // SECTION 2: Bank & E-Wallet Notification Parsers
  // =========================================================================
  describe('2. Bank & E-Wallet Notification Parsers', () => {
    describe('2.1 BCA Parser', () => {
      it('parses BCA income (m-Transfer CR)', () => {
        const parsed = parseWithBankRegex(
          'm-BCA',
          'm-Transfer Berhasil. No Ref: 123456. Dari: BUDI SANTOSO CR Rp 500.000 ke Rek 1234567890',
          'com.bca'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('BCA')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(500000)
      })

      it('parses myBCA QRIS debit expense', () => {
        const parsed = parseWithBankRegex(
          'myBCA',
          'Transaksi QRIS di KOPI KENANGAN sebesar Rp 35.000 berhasil pada 04/10/2026',
          'com.bca'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('BCA')
        expect(parsed.type).toBe('expense')
        expect(parsed.amount).toBe(35000)
      })

      it('masks bank account numbers in description', () => {
        const parsed = parseWithBankRegex(
          'BCA',
          'Transfer ke Rek 0141234567 sebesar Rp 150.000 berhasil',
          'com.bca'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.rawDescription).toContain('***')
      })
    })

    describe('2.2 Mandiri Livin Parser', () => {
      it('parses Mandiri Livin incoming funds', () => {
        const parsed = parseWithBankRegex(
          'Livin by Mandiri',
          'Dana masuk Rp 1.500.000 dari PT SOLUSI TEKNOLOGI ke rekening Anda',
          'id.bmri.livin'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('Mandiri Livin')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(1500000)
      })

      it('parses Mandiri debit expense', () => {
        const parsed = parseWithBankRegex(
          'Bank Mandiri',
          'Debet rek 1400012345678 sebesar Rp 75.000 di INDOMARET berhasil.',
          'id.bmri.livin'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('Mandiri Livin')
        expect(parsed.type).toBe('expense')
        expect(parsed.amount).toBe(75000)
      })
    })

    describe('2.3 BRImo Parser', () => {
      it('parses BRImo incoming transfer/setoran', () => {
        const parsed = parseWithBankRegex(
          'BRImo',
          'Setoran/Transfer masuk sebesar Rp 250.000 telah dikreditkan ke rekening Anda.',
          'id.co.bri.brimo'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('BRImo')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(250000)
      })

      it('parses BRImo debit payment', () => {
        const parsed = parseWithBankRegex(
          'BRImo',
          'Transaksi sebesar Rp 50.000 di Alfamart berhasil didebet dari rekening Anda.',
          'id.co.bri.brimo'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('BRImo')
        expect(parsed.type).toBe('expense')
        expect(parsed.amount).toBe(50000)
      })
    })

    describe('2.4 GoPay Parser', () => {
      it('parses GoPay outgoing payment', () => {
        const parsed = parseWithBankRegex(
          'GoPay',
          'Pembayaran Rp35.000 ke Solaria berhasil',
          'com.gojek.app'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('GoPay')
        expect(parsed.type).toBe('expense')
        expect(parsed.amount).toBe(35000)
      })

      it('parses GoPay incoming transfer', () => {
        const parsed = parseWithBankRegex(
          'GoPay',
          'Kamu menerima transfer Rp100.000 dari Andi',
          'com.gojek.app'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('GoPay')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(100000)
      })

      it('parses GoPay cashback as income', () => {
        const parsed = parseWithBankRegex(
          'GoPay',
          'Selamat! Cashback Rp5.000 telah masuk ke saldo GoPay kamu.',
          'com.gojek.app'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('GoPay')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(5000)
      })
    })

    describe('2.5 OVO Parser', () => {
      it('parses OVO outgoing payment', () => {
        const parsed = parseWithBankRegex(
          'OVO',
          'Pembayaran sebesar Rp 45.000 di Starbucks berhasil.',
          'ovo.id'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('OVO')
        expect(parsed.type).toBe('expense')
        expect(parsed.amount).toBe(45000)
      })

      it('parses OVO top up as income', () => {
        const parsed = parseWithBankRegex(
          'OVO',
          'Top up Rp 200.000 via BCA OneKlik berhasil.',
          'ovo.id'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('OVO')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(200000)
      })
    })

    describe('2.6 ShopeePay Parser', () => {
      it('parses ShopeePay outgoing payment', () => {
        const parsed = parseWithBankRegex(
          'ShopeePay',
          'Pembayaran Rp 85.000 ke Kopi Janji Jiwa berhasil.',
          'com.shopee.id'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('ShopeePay')
        expect(parsed.type).toBe('expense')
        expect(parsed.amount).toBe(85000)
      })

      it('parses ShopeePay top up as income', () => {
        const parsed = parseWithBankRegex(
          'ShopeePay',
          'Isi saldo Rp 50.000 berhasil ditambahkan ke ShopeePay.',
          'com.shopee.id'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('ShopeePay')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(50000)
      })

      it('parses ShopeePay refund as income', () => {
        const parsed = parseWithBankRegex(
          'ShopeePay',
          'Pengembalian dana sebesar Rp 120.000 ke ShopeePay berhasil.',
          'com.shopee.id'
        )
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe('ShopeePay')
        expect(parsed.type).toBe('income')
        expect(parsed.amount).toBe(120000)
      })
    })
  })

  // =========================================================================
  // SECTION 3: Anti-Spam & Security Guardrail
  // =========================================================================
  describe('3. Anti-Spam Guardrail (isFinancialMutation)', () => {
    describe('3.1 OTP, 2FA & Security Codes (MUST BE BLOCKED)', () => {
      it('blocks OTP codes with high confidentiality warnings', () => {
        expect(
          isFinancialMutation(
            'BCA OTP',
            'JANGAN BERIKAN KEPADA SIAPAPUN. Kode OTP BCA Anda adalah 582910 untuk transaksi Rp 500.000',
            'com.bca'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'Livin Mandiri',
            'Kode verifikasi login Anda 91823. Rahasiakan kode ini demi keamanan Anda.',
            'id.bmri.livin'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'BRImo Security',
            'BRImo: Kode autentikasi Anda 481920 berlaku 5 menit. Jangan berikan kode ini.',
            'id.co.bri.brimo'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'DANA Security',
            'One Time Password (OTP) untuk transaksi di Merchant sebesar Rp 150.000 adalah 492019',
            'id.dana'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'Security Alert',
            'Peringatan keamanan: Perangkat baru terdeteksi mencoba login ke akun GoPay Anda.',
            'com.gojek.app'
          )
        ).toBe(false)
      })
    })

    describe('3.2 Phishing Keywords & Malicious Links (MUST BE BLOCKED)', () => {
      it('blocks phishing and suspicious link alerts', () => {
        expect(
          isFinancialMutation(
            'Peringatan Akun',
            'Akun Anda terblokir! Klik link http://bca-update.com/login untuk aktivasi kembali saldo Rp 5.000.000',
            'com.bca'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'Mandiri Promo',
            'Tautan berikut https://bankmandiri.phishing.cc untuk klaim hadiah Rp 1.000.000',
            'id.bmri.livin'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'DANA Kaget Palsu',
            'Klik di sini untuk klaim di sini voucher Rp 100.000',
            'id.dana'
          )
        ).toBe(false)
      })
    })

    describe('3.3 Non-Financial Promos & Marketing Clickbaits (MUST BE BLOCKED)', () => {
      it('blocks promo clickbaits, discounts, vouchers, and payday sales', () => {
        expect(
          isFinancialMutation(
            'Promo GoPay',
            'Dapatkan saldo gratis hingga Rp 100.000 khusus hari ini! Cek caranya di sini',
            'com.gojek.app'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'ShopeePay Promo',
            'Promo cashback s/d Rp 50.000 belanja di Tokopedia. Jangan lewatkan kesempatan emas!',
            'com.shopee.id'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'Flash Sale',
            'Flash sale Payday! Diskon hingga 90% + voucher belanja seru!',
            'com.shopee.id'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'Pinjaman Kilat',
            'Butuh dana tunai cepat? Ajukan pinjaman kilat bunga ringan s/d 20 juta sekarang!',
            'com.fintech'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'OVO Referral',
            'Mau hemat berkali-kali? Ajak teman dan raih bonus saldo!',
            'ovo.id'
          )
        ).toBe(false)

        // Marketing emojis
        expect(
          isFinancialMutation(
            'Spesial',
            '🔥 Raih bonus saldo Rp 50.000 sekarang juga! 👉 Buka di sini',
            'com.shopee.id'
          )
        ).toBe(false)

        // Shorthand promotional price
        expect(
          isFinancialMutation(
            'Makan Murah',
            'Promo makan kenyang cuma Rp 10k di outlet terdekat',
            'com.gojek.app'
          )
        ).toBe(false)

        // Question mark hook
        expect(
          isFinancialMutation(
            'Info Saldo',
            'Sudah cek saldo kamu hari ini? Dapatkan penawaran menarik!',
            'com.bca'
          )
        ).toBe(false)
      })
    })

    describe('3.4 Failed, Cancelled, Expired Transactions (MUST BE BLOCKED)', () => {
      it('blocks negative outcome transactions and unpaid bills', () => {
        expect(
          isFinancialMutation(
            'm-BCA',
            'Pembayaran Rp 50.000 di Alfamart GAGAL karena saldo tidak mencukupi.',
            'com.bca'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'GoPay',
            'Transaksi transfer Rp 100.000 dibatalkan oleh pengguna.',
            'com.gojek.app'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'Tagihan',
            'Tagihan listrik Rp 250.000 jatuh tempo hari ini. Segera bayar!',
            'id.dana'
          )
        ).toBe(false)

        expect(
          isFinancialMutation(
            'ShopeePay',
            'Pesanan Rp 75.000 kedaluwarsa karena belum diselesaikan pembayarannya.',
            'com.shopee.id'
          )
        ).toBe(false)
      })
    })

    describe('3.5 Genuine Financial Mutations (MUST BE ALLOWED)', () => {
      it('accurately identifies genuine financial ledger mutations', () => {
        expect(
          isFinancialMutation(
            'm-BCA',
            'm-Transfer: Transaksi Rp 150.000 ke REK 12345678 BERHASIL',
            'com.bca'
          )
        ).toBe(true)

        expect(
          isFinancialMutation(
            'GoPay',
            'Pembayaran Rp 25.000 ke Alfamart berhasil',
            'com.gojek.app'
          )
        ).toBe(true)

        expect(
          isFinancialMutation(
            'Mandiri Livin',
            'Dana masuk Rp 1.000.000 dari BUDI SANTOSO',
            'id.bmri.livin'
          )
        ).toBe(true)

        expect(
          isFinancialMutation(
            'BRImo',
            'Setoran sebesar Rp 500.000 telah dikreditkan ke rekening Anda',
            'id.co.bri.brimo'
          )
        ).toBe(true)

        expect(
          isFinancialMutation(
            'OVO',
            'Top up berhasil. Saldo sebesar Rp 100.000 telah ditambahkan.',
            'ovo.id'
          )
        ).toBe(true)

        expect(
          isFinancialMutation(
            'ShopeePay',
            'Pengembalian dana sebesar Rp 75.000 berhasil masuk ke ShopeePay kamu.',
            'com.shopee.id'
          )
        ).toBe(true)
      })
    })
  })

  // =========================================================================
  // SECTION 4: Submodule vs Facade Parity Check
  // =========================================================================
  describe('4. Architecture & Parity Verification', () => {
    it('verifies that submodules export identical implementations to facades', () => {
      expect(parseIndonesianAmount).toBe(NlpSubmodule.parseIndonesianAmount)
      expect(extractMonetaryAmountFromText).toBe(NlpSubmodule.extractMonetaryAmountFromText)
      expect(parseIndonesianFinancialText).toBe(NlpSubmodule.parseIndonesianFinancialText)
      expect(parseMultiClauseTransactions).toBe(NlpSubmodule.parseMultiClauseTransactions)
      expect(extractDateFromPhrase).toBe(NlpSubmodule.extractDateFromPhrase)
      expect(normalizeIndonesianNlpText).toBe(NlpSubmodule.normalizeIndonesianNlpText)

      expect(parseWithBankRegex).toBe(BankParsers.parseWithBankRegex)
      expect(isFinancialMutation).toBe(AntiSpamGuard.isFinancialMutation)
      expect(findBestMatchingWallet).toBe(WalletMatcher.findBestMatchingWallet)
      expect(correlateInternalTransfers).toBe(WalletMatcher.correlateInternalTransfers)
      expect(extractTransactionRef).toBe(BankParsers.extractTransactionRef)
    })
  })
})
