import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseWithBankRegex,
  isFinancialMutation,
  findBestMatchingWallet,
  parseFinancialNotification,
  syncHistoricalSms,
} from '../src/lib/notificationIngestion'
import { maskFinancialAccountNumbers, cleanMutationMerchant } from '../src/lib/merchantUtils'
import { db } from '../src/lib/db'
import useSettingsStore from '../src/store/useSettingsStore'

describe('smsIngestionParser - Android SMS Financial Ingestion Engine Suite', () => {
  describe('Deterministic Multi-layer Anti-OTP & Anti-Spam Guard', () => {
    it('instantly rejects OTP and verification code SMS', () => {
      const otpSmsList = [
        {
          title: 'BANK BCA',
          text: 'JANGAN BERIKAN KEPADA SIAPAPUN! Kode OTP m-BCA Anda adalah 849201 untuk login ke perangkat baru.',
        },
        {
          title: 'Mandiri',
          text: 'Kode OTP Livin Anda adalah 593120 berlaku 5 menit. Hati-hati penipuan!',
        },
        {
          title: 'BRI-INFO',
          text: 'Kode verifikasi BRImo Anda: 418290. Rahasiakan kode ini dari pihak manapun termasuk petugas Bank BRI.',
        },
        {
          title: 'BNI',
          text: 'Kode rahasia transaksi Anda adalah 192837. Jangan pernah membagikan kode rahasia ini.',
        },
        {
          title: 'CIMB NIAGA',
          text: 'One Time Password (OTP) transaksi OCTO Mobile Anda 908123. Berlaku 3 menit.',
        },
      ]

      for (const item of otpSmsList) {
        expect(isFinancialMutation(item.title, item.text, 'com.google.android.apps.messaging')).toBe(false)
      }
    })

    it('instantly rejects loans, KTA, marketing spam, and links', () => {
      const spamList = [
        {
          title: 'Bank Mandiri',
          text: 'Butuh dana cepat? Dapatkan penawaran KTA kilat hingga Rp 100.000.000 dengan bunga ringan klik link https://mandiri.co.id/promo',
        },
        {
          title: 'BCA Promo',
          text: 'Khusus hari ini! Diskon s/d 50% di merchant favorit dengan QRIS BCA. Cek caranya di sini!',
        },
        {
          title: 'BRI INFO',
          text: 'Ajukan pinjaman kilat tanpa jaminan sekarang juga. Klik tautan berikut.',
        },
      ]

      for (const item of spamList) {
        expect(isFinancialMutation(item.title, item.text, 'com.google.android.apps.messaging')).toBe(false)
      }
    })
  })

  describe('Bank-Specific SMS Parsing & Expense/Income Accuracy', () => {
    it('correctly parses BCA Credit Card & Debit SMS alerts', () => {
      // 1. Credit Card SMS
      const bcaCc = parseWithBankRegex(
        'BANK BCA',
        'BCA: Transaksi Rp 350.000 dengan Kartu Kredit BCA 1234 di STARBUCKS JAKARTA pada 27/09',
        'com.google.android.apps.messaging'
      )
      expect(bcaCc).not.toBeNull()
      expect(bcaCc.institution).toBe('BCA')
      expect(bcaCc.amount).toBe(350000)
      expect(bcaCc.type).toBe('expense')
      expect(cleanMutationMerchant(bcaCc.rawDescription)).toContain('Starbucks Jakarta')

      // 2. Debit Mutasi SMS
      const bcaDb = parseWithBankRegex(
        'BCA',
        '27/09 18:30 D-BCA DB 9876543210 Rp 75.000,00 di INDOMARET TANGERANG',
        'com.samsung.android.messaging'
      )
      expect(bcaDb).not.toBeNull()
      expect(bcaDb.amount).toBe(75000)
      expect(bcaDb.type).toBe('expense')

      // 3. Inflow / Salary SMS
      const bcaIn = parseWithBankRegex(
        'BANK BCA',
        '27/09 09:15 CR 9876543210 Rp 7.500.000,00 GAJI PT TEKNOLOGI NUSANTARA',
        'android.provider.Telephony.SMS_RECEIVED'
      )
      expect(bcaIn).not.toBeNull()
      expect(bcaIn.amount).toBe(7500000)
      expect(bcaIn.type).toBe('income')
    })

    it('correctly parses Mandiri SMS alerts', () => {
      // Debit SMS
      const mandiriDb = parseWithBankRegex(
        'Mandiri',
        'Trx Kartu Mandiri berakhir 4321 sebesar IDR 125.000 di SUPERINDO pada 27/09',
        'com.google.android.apps.messaging'
      )
      expect(mandiriDb).not.toBeNull()
      expect(mandiriDb.institution).toBe('Mandiri Livin')
      expect(mandiriDb.amount).toBe(125000)
      expect(mandiriDb.type).toBe('expense')
      expect(cleanMutationMerchant(mandiriDb.rawDescription)).toContain('Superindo')

      // Inflow SMS
      const mandiriIn = parseWithBankRegex(
        'BANK MANDIRI',
        'Kredit Rek. 1230009876543 sebesar IDR 1.200.000 dari PT ABC pada 27/09',
        'com.google.android.apps.messaging'
      )
      expect(mandiriIn).not.toBeNull()
      expect(mandiriIn.amount).toBe(1200000)
      expect(mandiriIn.type).toBe('income')
    })

    it('correctly parses BRI SMS alerts', () => {
      const briDb = parseWithBankRegex(
        'BRI-INFO',
        'Trx Rekening 1234567890 : Rp 80.000 di ALFAMART Tgl 27/09/26 14:20 Saldo Akhir Rp 2.500.000',
        'com.android.mms'
      )
      expect(briDb).not.toBeNull()
      expect(briDb.institution).toBe('BRImo')
      expect(briDb.amount).toBe(80000)
      expect(briDb.type).toBe('expense')
      expect(cleanMutationMerchant(briDb.rawDescription)).toContain('Alfamart')

      const briIn = parseWithBankRegex(
        'BRI',
        'Rekening 1234567890 Anda telah dikreditkan sebesar Rp 2.000.000 pada 27/09/26',
        'com.google.android.apps.messaging'
      )
      expect(briIn).not.toBeNull()
      expect(briIn.amount).toBe(2000000)
      expect(briIn.type).toBe('income')
    })

    it('correctly parses BNI SMS alerts', () => {
      const bniDb = parseWithBankRegex(
        'BNI',
        'BNI Notifikasi: Rek 1234567890 telah di-Debet sebesar Rp 165.000 pada 27/09 13:00 untuk Transaksi di KFC',
        'com.google.android.apps.messaging'
      )
      expect(bniDb).not.toBeNull()
      expect(bniDb.institution).toBe('BNI')
      expect(bniDb.amount).toBe(165000)
      expect(bniDb.type).toBe('expense')
      expect(cleanMutationMerchant(bniDb.rawDescription)).toContain('Kfc')

      const bniIn = parseWithBankRegex(
        'BNI',
        'BNI Notifikasi: Rek 1234567890 telah di-Kredit sebesar Rp 500.000 pada 27/09 10:00',
        'com.google.android.apps.messaging'
      )
      expect(bniIn).not.toBeNull()
      expect(bniIn.amount).toBe(500000)
      expect(bniIn.type).toBe('income')
    })

    it('correctly parses CIMB Niaga, Permata, Danamon, and Bank Mega SMS', () => {
      // CIMB Niaga
      const cimb = parseWithBankRegex(
        'CIMB NIAGA',
        'Transaksi OCTO Card Rp 220.000 di PIZZA HUT tgl 27/09 berhasil',
        'com.google.android.apps.messaging'
      )
      expect(cimb).not.toBeNull()
      expect(cimb.institution).toBe('CIMB Niaga')
      expect(cimb.amount).toBe(220000)
      expect(cimb.type).toBe('expense')

      // Permata
      const permata = parseWithBankRegex(
        'PermataBank',
        'Transaksi Kartu 1234 sebesar IDR 90.000 di XXI CINEMA telah berhasil',
        'com.google.android.apps.messaging'
      )
      expect(permata).not.toBeNull()
      expect(permata.institution).toBe('Permata')
      expect(permata.amount).toBe(90000)
      expect(permata.type).toBe('expense')

      // Danamon
      const danamon = parseWithBankRegex(
        'Danamon',
        'Debit rekening 123456 sebesar IDR 450.000 tgl 27/09 di TOKOPEDIA',
        'com.google.android.apps.messaging'
      )
      expect(danamon).not.toBeNull()
      expect(danamon.institution).toBe('Danamon')
      expect(danamon.amount).toBe(450000)
      expect(danamon.type).toBe('expense')

      // Bank Mega
      const mega = parseWithBankRegex(
        'BANK MEGA',
        'Transaksi Kartu Kredit Mega Rp 310.000 di CARREFOUR tgl 27/09',
        'com.google.android.apps.messaging'
      )
      expect(mega).not.toBeNull()
      expect(mega.institution).toBe('Bank Mega')
      expect(mega.amount).toBe(310000)
      expect(mega.type).toBe('expense')
    })
  })

  describe('Zero-Knowledge Account & Card Number Masking', () => {
    it('masks 16-digit credit cards and long bank accounts', () => {
      const rawCc = 'Transaksi kartu 4111 2222 3333 4444 Rp 100.000'
      const maskedCc = maskFinancialAccountNumbers(rawCc)
      expect(maskedCc).toContain('****-****-****-4444')
      expect(maskedCc).not.toContain('4111 2222 3333')

      const rawRek = 'Debit Rek. 1234567890123 Rp 50.000'
      const maskedRek = maskFinancialAccountNumbers(rawRek)
      expect(maskedRek).toContain('****0123')
      expect(maskedRek).not.toContain('1234567890123')
    })

    it('ensures parsed rawDescription has numbers masked', () => {
      const parsed = parseWithBankRegex(
        'BANK BCA',
        '27/09 D-BCA DB 987654321012 Rp 50.000 di Kopi Kenangan',
        'com.google.android.apps.messaging'
      )
      expect(parsed).not.toBeNull()
      expect(parsed.rawDescription).not.toContain('987654321012')
      expect(parsed.rawDescription).toContain('****1012')
    })
  })

  describe('Fuzzy & Card Suffix Wallet Matcher', () => {
    const wallets = [
      { id: 1, name: 'BCA Tahapan', institutionName: 'BCA', accountNumber: '1234567890' },
      { id: 2, name: 'Mandiri Tabungan', institutionName: 'Mandiri', accountNumber: '9876544321' },
      { id: 3, name: 'Permata ME', institutionName: 'Permata', accountNumber: '55554321' },
    ]

    it('matches wallet by 4-digit card/account suffix present in SMS', () => {
      const matchBca = findBestMatchingWallet('BCA', wallets, 'Debit Rek 7890 Rp 50.000')
      expect(matchBca.wallet).not.toBeNull()
      expect(matchBca.wallet.id).toBe(1)

      const matchMandiri = findBestMatchingWallet('Mandiri Livin', wallets, 'Trx Kartu Mandiri berakhir 4321')
      // Note: both Mandiri and Permata end in 4321, but institutionName matches Mandiri
      expect(matchMandiri.wallet).not.toBeNull()
      expect(matchMandiri.wallet.id).toBe(2)
    })
  })

  describe('Full Pipeline parseFinancialNotification & Positive Receipt Confirmation', () => {
    it('passes and correctly formats salary and income confirmation keywords', () => {
      const incomeSmsList = [
        {
          title: '69888',
          text: '27/09 09:15 CR 9876543210 Rp 7.500.000,00 GAJI PT TEKNOLOGI NUSANTARA',
          packageName: 'com.google.android.apps.messaging',
          expectedInstitution: 'BCA',
          expectedAmount: 7500000,
          expectedCategory: 'gaji/gaji_pokok',
        },
        {
          title: 'BCA',
          text: '27/09 18:30 D-BCA CR 9876543210 Rp 1.500.000,00 SETORAN TUNAI',
          packageName: 'android.provider.Telephony.SMS_RECEIVED',
          expectedInstitution: 'BCA',
          expectedAmount: 1500000,
          expectedCategory: 'lainnya/umum',
        },
        {
          title: '83355',
          text: 'Kredit Rek. 1230009876543 sebesar IDR 1.200.000 dari PT ABC pada 27/09',
          packageName: 'com.google.android.apps.messaging',
          expectedInstitution: 'Mandiri Livin',
          expectedAmount: 1200000,
          expectedCategory: 'lainnya/umum',
        },
        {
          title: '3355',
          text: 'Rekening 1234567890 Anda telah dikreditkan sebesar Rp 2.000.000 pada 27/09/26',
          packageName: 'com.google.android.apps.messaging',
          expectedInstitution: 'BRImo',
          expectedAmount: 2000000,
          expectedCategory: 'lainnya/umum',
        },
      ]

      for (const item of incomeSmsList) {
        expect(isFinancialMutation(item.title, item.text, item.packageName)).toBe(true)
        const parsed = parseFinancialNotification(item)
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe(item.expectedInstitution)
        expect(parsed.amount).toBe(item.expectedAmount)
        expect(parsed.type).toBe('income')
        expect(parsed.category).toBe(item.expectedCategory)
        expect(parsed.date).toBeDefined()
        expect(parsed.cleanMerchant).toBeDefined()
      }
    })
  })

  describe('Official Indonesian Banking Shortcode Senders', () => {
    it('correctly maps all 8 official banking SMS shortcodes to their institutions', () => {
      const shortcodes = [
        { code: '69888', text: '27/09 18:30 D-BCA DB 1234567890 Rp 50.000 di Alfamart', inst: 'BCA', type: 'expense' },
        { code: '83355', text: 'Trx Kartu Mandiri berakhir 1234 sebesar IDR 75.000 di Starbucks', inst: 'Mandiri Livin', type: 'expense' },
        { code: '3355', text: 'Trx Rekening 1234567890 : Rp 80.000 di Indomaret', inst: 'BRImo', type: 'expense' },
        { code: '3300', text: 'BNI Notifikasi: Rek 1234567890 telah di-Debet sebesar Rp 90.000 pada 27/09 untuk Transaksi di KFC', inst: 'BNI', type: 'expense' },
        { code: '3346', text: 'Transaksi OCTO Card Rp 110.000 di HokBen berhasil', inst: 'CIMB Niaga', type: 'expense' },
        { code: '1418', text: 'Transaksi Kartu 1234 sebesar IDR 60.000 di XXI telah berhasil', inst: 'Permata', type: 'expense' },
        { code: '3399', text: 'Debit rekening 123456 sebesar IDR 45.000 tgl 27/09 di Tokopedia', inst: 'Danamon', type: 'expense' },
        { code: '3377', text: 'Transaksi Kartu Kredit Mega Rp 150.000 di Carrefour tgl 27/09', inst: 'Bank Mega', type: 'expense' },
      ]

      for (const sc of shortcodes) {
        const notif = {
          title: sc.code,
          text: sc.text,
          packageName: 'com.google.android.apps.messaging',
        }
        const parsed = parseFinancialNotification(notif)
        expect(parsed).not.toBeNull()
        expect(parsed.institution).toBe(sc.inst)
        expect(parsed.type).toBe(sc.type)
      }
    })
  })

  describe('Comprehensive Expense/Income Inversion Guard Across All 9 Banks', () => {
    it('verifies Bank Jago income is not inverted by transfer keywords', () => {
      const jagoIn = parseWithBankRegex('Bank Jago', 'Uang masuk Rp 350.000 dari Toko ABC', 'com.jago.bank')
      expect(jagoIn).not.toBeNull()
      expect(jagoIn.type).toBe('income')

      const jagoTransferIn = parseWithBankRegex('Bank Jago', 'Kamu menerima transfer Rp 150.000 dari Budi', 'com.jago.bank')
      expect(jagoTransferIn).not.toBeNull()
      expect(jagoTransferIn.type).toBe('income')

      const jagoOut = parseWithBankRegex('Bank Jago', 'Transfer ke Rek BCA 123456 sebesar Rp 100.000 berhasil', 'com.jago.bank')
      expect(jagoOut).not.toBeNull()
      expect(jagoOut.type).toBe('expense')
    })

    it('verifies BSI income is not inverted by kirim keyword', () => {
      const bsiIn = parseWithBankRegex('BSI', 'Kirim uang diterima Rp 500.000 dari Bpk Joko', 'com.bsi.mobile')
      expect(bsiIn).not.toBeNull()
      expect(bsiIn.type).toBe('income')

      const bsiOut = parseWithBankRegex('BSI', 'Kirim uang Rp 250.000 ke rekening 9876543210 berhasil', 'com.bsi.mobile')
      expect(bsiOut).not.toBeNull()
      expect(bsiOut.type).toBe('expense')
    })

    it('verifies Permata, Danamon, Mega, Citibank, and HSBC income is not inverted by trx/transaksi keyword', () => {
      // Permata
      const permataIn = parseWithBankRegex('Permata', 'Transaksi Kredit Rek. 123456 sebesar IDR 2.000.000', 'com.google.android.apps.messaging')
      expect(permataIn).not.toBeNull()
      expect(permataIn.type).toBe('income')

      // Danamon
      const danamonIn = parseWithBankRegex('Danamon', 'Transaksi Kredit IDR 800.000', 'com.google.android.apps.messaging')
      expect(danamonIn).not.toBeNull()
      expect(danamonIn.type).toBe('income')

      // Bank Mega
      const megaIn = parseWithBankRegex('Bank Mega', 'Transaksi Kredit Rek. 9876 sebesar IDR 1.500.000', 'com.google.android.apps.messaging')
      expect(megaIn).not.toBeNull()
      expect(megaIn.type).toBe('income')

      // Citibank
      const citiIn = parseWithBankRegex('Citibank', 'Transaksi Kredit IDR 1.000.000', 'com.google.android.apps.messaging')
      expect(citiIn).not.toBeNull()
      expect(citiIn.type).toBe('income')

      // HSBC
      const hsbcIn = parseWithBankRegex('HSBC', 'Transaksi Kredit IDR 1.200.000', 'com.google.android.apps.messaging')
      expect(hsbcIn).not.toBeNull()
      expect(hsbcIn.type).toBe('income')
    })
  })

  describe('Merchant Name Extraction & Polish', () => {
    it('strips leading timestamps, d-bca prefixes, and trailing balance info', () => {
      const raw1 = '27/09 18:30 D-bca Db 9876543210 Rp 75.000,00 Di Indomaret Tangerang'
      expect(cleanMutationMerchant(raw1)).toBe('Indomaret Tangerang')

      const raw2 = 'Trx Rekening 1234567890 : Rp 80.000 di ALFAMART Tgl 27/09/26 14:20 Saldo Akhir Rp 2.500.000'
      expect(cleanMutationMerchant(raw2)).toBe('Alfamart')

      const raw3 = '27/09 09:15 CR 9876543210 Rp 7.500.000,00 GAJI PT TEKNOLOGI NUSANTARA'
      expect(cleanMutationMerchant(raw3)).toBe('Gaji Pt Teknologi Nusantara')
    })
  })

  describe('Historical SMS Ingestion (syncHistoricalSms) & Staging Review Schema', () => {
    beforeEach(async () => {
      await db.transactions.clear()
      await db.wallets.clear()
      await db.wallets.bulkAdd([
        { id: 1, name: 'BCA Tahapan', institutionName: 'BCA', accountNumber: '9876543210' },
        { id: 2, name: 'Mandiri Tabungan', institutionName: 'Mandiri', accountNumber: '1230009876543' },
      ])
      useSettingsStore.getState().clearUnviewedMutations()
    })

    it('syncs SMS mutations into db.transactions with exact Staging Review schema and increments counter', async () => {
      const mockMutations = [
        {
          title: '69888',
          text: '27/09 18:30 D-BCA DB 9876543210 Rp 75.000,00 di INDOMARET TANGERANG',
          packageName: 'com.google.android.apps.messaging',
          timestamp: Date.now(),
        },
        {
          title: '83355',
          text: 'Kredit Rek. 1230009876543 sebesar IDR 1.200.000 dari PT ABC pada 27/09',
          packageName: 'com.google.android.apps.messaging',
          timestamp: Date.now(),
        },
      ]

      const res = await syncHistoricalSms({ days: 30, mockMutations, force: true })
      expect(res.syncedCount).toBe(2)
      expect(res.skippedDuplicates).toBe(0)

      const storedTxs = await db.transactions.toArray()
      expect(storedTxs.length).toBe(2)

      const bcaTx = storedTxs.find((tx) => tx.suggestedInstitution === 'BCA')
      expect(bcaTx).toBeDefined()
      expect(bcaTx.isPendingReview).toBe(true)
      expect(bcaTx.source).toBe('sms_history')
      expect(bcaTx.amount).toBe(75000)
      expect(bcaTx.walletId).toBe(1)
      expect(bcaTx.notes).toContain('[SMS: BCA]')
      expect(bcaTx.cleanMerchant).toContain('Indomaret Tangerang')

      const mandiriTx = storedTxs.find((tx) => tx.suggestedInstitution === 'Mandiri Livin')
      expect(mandiriTx).toBeDefined()
      expect(mandiriTx.isPendingReview).toBe(true)
      expect(mandiriTx.source).toBe('sms_history')
      expect(mandiriTx.amount).toBe(1200000)
      expect(mandiriTx.type).toBe('income')
      expect(mandiriTx.walletId).toBe(2)

      // Verifies unviewed mutations count in store was incremented
      expect(useSettingsStore.getState().unviewedMutationsCount).toBe(2)
    })

    it('correctly deduplicates against existing transactions with mixed ISO/Date formats', async () => {
      const todayStr = new Date().toISOString().slice(0, 10)
      // Existing transaction with ISO date string format
      await db.transactions.add({
        date: `${todayStr}T14:30:00.000Z`,
        type: 'expense',
        amount: 75000,
        walletId: 1,
        source: 'manual',
      })

      const mockMutations = [
        {
          title: '69888',
          text: '27/09 18:30 D-BCA DB 9876543210 Rp 75.000,00 di INDOMARET TANGERANG',
          packageName: 'com.google.android.apps.messaging',
          timestamp: Date.now(),
        },
      ]

      const res = await syncHistoricalSms({ days: 30, mockMutations, force: true })
      expect(res.syncedCount).toBe(0)
      expect(res.skippedDuplicates).toBe(1)
    })
  })
})
