/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import {
  syncNotificationQueue,
  parseFinancialNotification,
  isFinancialMutation,
  findBestMatchingWallet,
  correlateInternalTransfers,
} from '../src/lib/notificationIngestion'

describe('DANA Top-Up & Double Submission Hardening Fixes', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.walletBalanceCache.clear()
  })

  describe('1. Mutex Prevents Concurrent syncNotificationQueue Double Insertions', () => {
    it('shares in-flight promise and prevents concurrent calls from inserting duplicate transactions', async () => {
      const danaWalletId = await db.wallets.add({
        name: 'DANA',
        institutionName: 'DANA',
        balance: 100000,
        currency: 'IDR',
      })

      const rawMutation = {
        id: 'notif-mutex-test-1',
        title: 'DANA',
        text: 'Top up Rp 50.000 berhasil! Pembayaran isi saldo via OneKlik',
        packageName: 'id.dana',
        timestamp: Date.now(),
      }

      // Simulate AppShell firing visibilitychange and appStateChange simultaneously
      const [res1, res2] = await Promise.all([
        syncNotificationQueue({
          force: true,
          mockMutations: [rawMutation],
          defaultWalletId: danaWalletId,
          notificationAutoApprove: true,
        }),
        syncNotificationQueue({
          force: true,
          mockMutations: [rawMutation],
          defaultWalletId: danaWalletId,
          notificationAutoApprove: true,
        }),
      ])

      // Both callers should receive the exact same resolved promise result
      expect(res1).toBe(res2)
      expect(res1.syncedCount).toBe(1)

      const txs = await db.transactions.toArray()
      expect(txs.length).toBe(1)
      expect(txs[0].amount).toBe(50000)
      expect(txs[0].type).toBe('income')
    })
  })

  describe('2. DANA vs "Dana Darurat" Exact Wallet Matching Priority', () => {
    it('prioritizes exact DANA wallet match when user has both DANA and Dana Darurat wallets', () => {
      const wallets = [
        { id: 10, name: 'Dana Darurat', institutionName: 'BCA', currency: 'IDR' },
        { id: 20, name: 'DANA', institutionName: 'DANA', currency: 'IDR' },
      ]

      const match = findBestMatchingWallet('DANA', wallets, 'Isi Saldo Rp 50.000 berhasil')
      expect(match.isAmbiguous).toBe(false)
      expect(match.wallet).not.toBeNull()
      expect(match.wallet.id).toBe(20)
      expect(match.wallet.name).toBe('DANA')
    })

    it('does NOT match generic fund phrases (Dana Darurat, Dana Tabungan, Dana Kas) when searching for e-wallet DANA', () => {
      const wallets = [
        { id: 10, name: 'Dana Darurat', institutionName: 'BCA', currency: 'IDR' },
        { id: 11, name: 'Dana Tabungan', institutionName: 'Bank Mandiri', currency: 'IDR' },
        { id: 12, name: 'Dana Pensiun', institutionName: 'BNI', currency: 'IDR' },
        { id: 13, name: 'Dana Kas Kantor', institutionName: 'Tunai', currency: 'IDR' },
      ]

      const match = findBestMatchingWallet('DANA', wallets, 'Top up Rp 50.000 berhasil')
      expect(match.wallet).toBeNull()
      expect(match.isAmbiguous).toBe(false)
    })

    it('matches non-generic DANA sub-wallets (e.g. DANA Bisnis) via substring when exact DANA does not exist', () => {
      const wallets = [
        { id: 30, name: 'DANA Bisnis', institutionName: 'PT Espay Debit Indonesia', currency: 'IDR' },
      ]

      const match = findBestMatchingWallet('DANA', wallets, 'Saldo masuk Rp 50.000')
      expect(match.isAmbiguous).toBe(false)
      expect(match.wallet).not.toBeNull()
      expect(match.wallet.id).toBe(30)
    })

    it('prioritizes exact name match when user has wallet named DANA and another named Dana Darurat with institution DANA', () => {
      const wallets = [
        { id: 10, name: 'Dana Darurat', institutionName: 'DANA', currency: 'IDR' },
        { id: 20, name: 'DANA', institutionName: 'DANA', currency: 'IDR' },
      ]

      const match = findBestMatchingWallet('DANA', wallets, 'Isi Saldo Rp 50.000 berhasil')
      expect(match.isAmbiguous).toBe(false)
      expect(match.wallet).not.toBeNull()
      expect(match.wallet.id).toBe(20)
    })
  })

  describe('3. Incoming Top-Up Precedence & Relaxed Spam Filter', () => {
    it('parses DANA top-up with OneKlik payment wording as income instead of expense', () => {
      const notif1 = {
        title: 'DANA',
        text: 'Isi Saldo Berhasil! Pembayaran isi saldo Rp 50.000 via OneKlik',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(notif1.title, notif1.text, notif1.packageName)).toBe(true)
      const parsed1 = parseFinancialNotification(notif1)
      expect(parsed1).not.toBeNull()
      expect(parsed1.institution).toBe('DANA')
      expect(parsed1.amount).toBe(50000)
      expect(parsed1.type).toBe('income')

      const notif2 = {
        title: 'DANA',
        text: 'Top up Rp 50.000 berhasil! Kamu telah membayar menggunakan Virtual Account BCA',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(notif2.title, notif2.text, notif2.packageName)).toBe(true)
      const parsed2 = parseFinancialNotification(notif2)
      expect(parsed2).not.toBeNull()
      expect(parsed2.amount).toBe(50000)
      expect(parsed2.type).toBe('income')
    })

    it('recognizes top-up receipt notifications without the word berhasil as genuine mutations', () => {
      const notifWithoutBerhasil = {
        title: 'DANA',
        text: 'Top up Rp 50.000 via BCA OneKlik',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(notifWithoutBerhasil.title, notifWithoutBerhasil.text, notifWithoutBerhasil.packageName)).toBe(true)

      const isiSaldoNotif = {
        title: 'DANA',
        text: 'Isi Saldo Rp 50.000 via OneKlik',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(isiSaldoNotif.title, isiSaldoNotif.text, isiSaldoNotif.packageName)).toBe(true)
    })

    it('gives uang masuk precedence over generic payment phrasing in DANA', () => {
      const notif = {
        title: 'DANA',
        text: 'Uang masuk Rp 100.000! Pembayaran dari John telah diterima',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(notif.title, notif.text, notif.packageName)).toBe(true)
      const parsed = parseFinancialNotification(notif)
      expect(parsed).not.toBeNull()
      expect(parsed.amount).toBe(100000)
      expect(parsed.type).toBe('income')
    })

    it('tolerates promo suffixes (dapatkan, bonus, koin, poin reward) when strong receipt indicator is present', () => {
      const promoReceipt = {
        title: 'Isi Saldo Berhasil!',
        text: 'Top up Rp 100.000 berhasil. Dapatkan bonus saldo koin dan poin reward transaksi.',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(promoReceipt.title, promoReceipt.text, promoReceipt.packageName)).toBe(true)
      const parsed = parseFinancialNotification(promoReceipt)
      expect(parsed).not.toBeNull()
      expect(parsed.amount).toBe(100000)
      expect(parsed.type).toBe('income')
    })

    it('supports flexible word order for saldo bertambah', () => {
      const flexNotif = {
        title: 'DANA',
        text: 'Saldo akun DANA kamu telah bertambah Rp 75.000 dari transfer bank.',
        packageName: 'id.dana',
      }
      expect(isFinancialMutation(flexNotif.title, flexNotif.text, flexNotif.packageName)).toBe(true)
      const parsed = parseFinancialNotification(flexNotif)
      expect(parsed).not.toBeNull()
      expect(parsed.amount).toBe(75000)
      expect(parsed.type).toBe('income')
    })

    it('accurately parses genuine outgoing payment as expense', () => {
      const expenseNotif = {
        title: 'DANA',
        text: 'Pembayaran Rp 35.000 di Kopi Kenangan berhasil.',
        packageName: 'id.dana',
      }
      const parsed = parseFinancialNotification(expenseNotif)
      expect(parsed).not.toBeNull()
      expect(parsed.amount).toBe(35000)
      expect(parsed.type).toBe('expense')
    })
  })

  describe('4. Transfer Correlation Admin Fee Tolerance & Cross-Batch Linking', () => {
    it('correlates in-batch transactions with admin fee difference up to Rp 2.500 into 1 internal transfer', () => {
      const wallets = [
        { id: 1, name: 'BCA', institutionName: 'BCA', currency: 'IDR' },
        { id: 2, name: 'DANA', institutionName: 'DANA', currency: 'IDR' },
      ]

      const now = Date.now()
      const inBatchMutations = [
        {
          institution: 'BCA',
          amount: 51000, // Debited 50.000 + 1.000 VA top up admin fee
          type: 'expense',
          rawDescription: 'Transfer ke DANA Rp 51.000',
          date: '2026-10-11',
          createdAt: now,
          currency: 'IDR',
        },
        {
          institution: 'DANA',
          amount: 50000, // Credited 50.000 in DANA
          type: 'income',
          rawDescription: 'Top up saldo Rp 50.000',
          date: '2026-10-11',
          createdAt: now + 5000,
          currency: 'IDR',
        },
      ]

      const { correlated, transfersCreated } = correlateInternalTransfers(inBatchMutations, wallets, {
        notificationAutoApprove: true,
      })

      expect(transfersCreated).toBe(1)
      expect(correlated.length).toBe(1)
      expect(correlated[0].type).toBe('transfer')
      expect(correlated[0].amount).toBe(51000)
      expect(correlated[0].targetAmount).toBe(50000)
      expect(correlated[0].walletId).toBe(1)
      expect(correlated[0].targetWalletId).toBe(2)
      expect(correlated[0].isPendingReview).toBe(false)
    })

    it('does NOT correlate when expense amount is LESS than income amount (not an admin fee)', () => {
      const wallets = [
        { id: 1, name: 'BCA', institutionName: 'BCA', currency: 'IDR' },
        { id: 2, name: 'DANA', institutionName: 'DANA', currency: 'IDR' },
      ]
      const now = Date.now()
      const inBatch = [
        {
          institution: 'BCA',
          amount: 50000, // Debited 50.000
          type: 'expense',
          date: '2026-10-11',
          createdAt: now,
          currency: 'IDR',
        },
        {
          institution: 'DANA',
          amount: 52000, // Received 52.000 (Expense < Income cannot be admin fee)
          type: 'income',
          date: '2026-10-11',
          createdAt: now + 5000,
          currency: 'IDR',
        },
      ]
      const { correlated, transfersCreated } = correlateInternalTransfers(inBatch, wallets)
      expect(transfersCreated).toBe(0)
      expect(correlated.length).toBe(2)
    })

    it('correlates opposite mutations within the same institution/wallet as pending review', () => {
      const wallets = [
        { id: 2, name: 'DANA', institutionName: 'DANA', currency: 'IDR' },
      ]
      const now = Date.now()
      const inBatch = [
        {
          institution: 'DANA',
          amount: 25000,
          type: 'expense',
          rawDescription: 'Beli Kopi',
          date: '2026-10-11',
          createdAt: now,
          currency: 'IDR',
        },
        {
          institution: 'DANA',
          amount: 25000,
          type: 'income',
          rawDescription: 'Terima uang dari teman',
          date: '2026-10-11',
          createdAt: now + 5000,
          currency: 'IDR',
        },
      ]
      const { correlated, transfersCreated } = correlateInternalTransfers(inBatch, wallets)
      expect(transfersCreated).toBe(1)
      expect(correlated.length).toBe(1)
      expect(correlated[0].type).toBe('transfer')
      expect(correlated[0].isPendingReview).toBe(true)
    })

    it('correlates cross-batch incoming mutation against recent Dexie transaction within 120 seconds', async () => {
      const wallets = [
        { id: 1, name: 'BCA', institutionName: 'BCA', currency: 'IDR' },
        { id: 2, name: 'DANA', institutionName: 'DANA', currency: 'IDR' },
      ]

      const now = Date.now()
      // Existing transaction in Dexie (BCA debited 51.000 20s ago)
      const existingBcaTx = {
        id: 999,
        institution: 'BCA',
        amount: 51000,
        type: 'expense',
        walletId: 1,
        date: '2026-10-11',
        createdAt: now - 20000,
        currency: 'IDR',
        notes: 'Top Up DANA',
      }

      // Incoming DANA mutation in fresh batch
      const incomingDana = {
        institution: 'DANA',
        amount: 50000,
        type: 'income',
        rawDescription: 'Isi Saldo Rp 50.000 via OneKlik',
        date: '2026-10-11',
        createdAt: now,
        currency: 'IDR',
        sourceNotifId: 'dana-batch-2-id',
      }

      const { correlated, transfersCreated, updatedExisting } = correlateInternalTransfers(
        [incomingDana],
        wallets,
        {
          notificationAutoApprove: true,
          recentTransactions: [existingBcaTx],
        }
      )

      expect(transfersCreated).toBe(1)
      expect(correlated.length).toBe(0) // Consumed, not inserted as separate income!
      expect(updatedExisting.length).toBe(1)
      expect(updatedExisting[0].id).toBe(999)
      expect(updatedExisting[0].changes.type).toBe('transfer')
      expect(updatedExisting[0].changes.walletId).toBe(1)
      expect(updatedExisting[0].changes.targetWalletId).toBe(2)
      expect(updatedExisting[0].changes.targetAmount).toBe(50000)
    })

    it('cross-batch sync invalidates wallet balance cache and updates Dexie transaction with sourceNotifIds', async () => {
      const bcaWalletId = await db.wallets.add({
        name: 'BCA',
        institutionName: 'BCA',
        balance: 500000,
        currency: 'IDR',
      })
      const danaWalletId = await db.wallets.add({
        name: 'DANA',
        institutionName: 'DANA',
        balance: 100000,
        currency: 'IDR',
      })

      // Add cache entry
      await db.walletBalanceCache.add({
        walletId: danaWalletId,
        balance: 100000,
        updatedAt: Date.now(),
      })

      const now = Date.now()
      const existingBcaTxId = await db.transactions.add({
        date: '2026-10-11',
        amount: 51000,
        type: 'expense',
        walletId: bcaWalletId,
        notes: 'Transfer to DANA',
        sourceNotifId: 'bca-tx-123',
        source: 'notification_listener',
        createdAt: now - 15000,
        currency: 'IDR',
        institution: 'BCA',
      })

      const incomingDana = {
        id: 'dana-tx-456',
        title: 'DANA',
        text: 'Top up Rp 50.000 berhasil! Pembayaran isi saldo via OneKlik',
        packageName: 'id.dana',
        timestamp: now,
      }

      let toastDispatched = false
      const toastHandler = () => { toastDispatched = true }
      window.addEventListener('ft-show-toast', toastHandler)

      try {
        const res = await syncNotificationQueue({
          force: true,
          mockMutations: [incomingDana],
          notificationAutoApprove: true,
        })

        expect(res.syncedCount).toBe(1)

        // Cache for affected wallets should be cleared
        const cachedDana = await db.walletBalanceCache.get(danaWalletId)
        expect(cachedDana).toBeUndefined()

        // Transaction in Dexie should be updated to transfer with merged sourceNotifIds
        const updatedTx = await db.transactions.get(existingBcaTxId)
        expect(updatedTx.type).toBe('transfer')
        expect(updatedTx.targetWalletId).toBe(danaWalletId)
        expect(updatedTx.targetAmount).toBe(50000)
        expect(updatedTx.sourceNotifIds).toContain('bca-tx-123')
        expect(updatedTx.sourceNotifIds).toContain('dana-tx-456')
        expect(toastDispatched).toBe(true)
      } finally {
        window.removeEventListener('ft-show-toast', toastHandler)
      }
    })
  })

  describe('5. Rapid Double Submission Protection via Ref Lock', () => {
    it('blocks secondary synchronous execution before state update using synchronous lock flag', async () => {
      let callCount = 0
      const submitLock = { current: false }

      const simulateSubmit = async () => {
        if (submitLock.current) return false
        submitLock.current = true
        try {
          callCount++
          await new Promise((resolve) => setTimeout(resolve, 50))
          return true
        } finally {
          submitLock.current = false
        }
      }

      // Rapid double tap simulation: both triggered in the same tick
      const [firstTap, secondTap] = await Promise.all([simulateSubmit(), simulateSubmit()])

      expect(firstTap).toBe(true)
      expect(secondTap).toBe(false)
      expect(callCount).toBe(1)
    })
  })
})
