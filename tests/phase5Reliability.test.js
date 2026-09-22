import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, computeWalletBalance, computeAllWalletBalances } from '../src/lib/db'
import { roundCurrency } from '../src/lib/utils'
import { AppError, transformDbError } from '../src/lib/errors'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  purgeOldSoftDeletedTransactions,
} from '../src/services/transactionService'

describe('Fase 5 - Fondasi Reliabilitas & Integritas Ledger', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
    await db.budgets.clear()
    vi.restoreAllMocks()
  })

  describe('1. Floating-point precision with roundCurrency', () => {
    it('accurately resolves binary floating-point representation anomalies', () => {
      expect(0.1 + 0.2).not.toBe(0.3)
      expect(roundCurrency(0.1 + 0.2)).toBe(0.3)
      expect(roundCurrency(1.005)).toBe(1.01)
      expect(roundCurrency(12345.6789)).toBe(12345.68)
      expect(roundCurrency(100)).toBe(100)
    })

    it('handles negative numbers, zero, and edge cases safely', () => {
      expect(roundCurrency(-0.1 - 0.2)).toBe(-0.3)
      expect(roundCurrency(0)).toBe(0)
      expect(roundCurrency('50.755')).toBe(50.76)
      expect(roundCurrency(null)).toBe(0)
      expect(roundCurrency(undefined)).toBe(0)
      expect(roundCurrency(NaN)).toBe(0)
      expect(roundCurrency('invalid')).toBe(0)
    })
  })

  describe('2. Soft-Delete Mechanics & Ledger Integrity', () => {
    it('marks transactions with deletedAt timestamp on deleteTransaction instead of hard-deleting', async () => {
      const walletId = await db.wallets.add({
        name: 'Bank Utama',
        balance: 1000000,
        currency: 'IDR',
        isArchived: false,
      })

      const txId = await createTransaction({
        type: 'expense',
        amount: 250000,
        walletId,
        category: 'makanan',
        date: '2026-09-18',
        notes: 'Makan siang',
      })

      const initialCount = await db.transactions.count()
      expect(initialCount).toBe(1)

      // Execute soft-delete
      await deleteTransaction(txId)

      // Transaction still exists in Dexie table
      const remainingCount = await db.transactions.count()
      expect(remainingCount).toBe(1)

      const softDeletedTx = await db.transactions.get(txId)
      expect(softDeletedTx).toBeDefined()
      expect(softDeletedTx.deletedAt).toBeTypeOf('number')
      expect(softDeletedTx.deletedAt).toBeGreaterThan(0)
    })

    it('excludes soft-deleted transactions from wallet balance calculations', async () => {
      const wallet = {
        id: 1,
        name: 'Dompet Tunai',
        balance: 500000,
        currency: 'IDR',
      }

      const activeTx = {
        id: 101,
        type: 'expense',
        amount: 100000,
        walletId: 1,
        currency: 'IDR',
        date: '2026-09-18',
        deletedAt: null,
      }

      const deletedTx = {
        id: 102,
        type: 'expense',
        amount: 200000,
        walletId: 1,
        currency: 'IDR',
        date: '2026-09-18',
        deletedAt: Date.now(),
      }

      // Single wallet compute
      const balanceWithDeleted = computeWalletBalance(wallet, [activeTx, deletedTx])
      // Initial 500000 - 100000 (active) = 400000; 200000 deleted must be skipped
      expect(balanceWithDeleted).toBe(400000)

      // All wallets batch compute
      const computedList = computeAllWalletBalances([wallet], [activeTx, deletedTx])
      expect(computedList[0].currentBalance).toBe(400000)
    })

    it('purges soft-deleted transactions older than retention window while keeping recent soft-deleted rows', async () => {
      const now = Date.now()
      const ninetyFiveDaysAgo = now - 95 * 24 * 60 * 60 * 1000
      const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000

      const oldDeletedId = await db.transactions.add({
        type: 'expense',
        amount: 50000,
        walletId: 1,
        date: '2026-06-01',
        deletedAt: ninetyFiveDaysAgo,
      })

      const recentDeletedId = await db.transactions.add({
        type: 'expense',
        amount: 75000,
        walletId: 1,
        date: '2026-09-13',
        deletedAt: fiveDaysAgo,
      })

      const activeId = await db.transactions.add({
        type: 'income',
        amount: 1000000,
        walletId: 1,
        date: '2026-09-18',
      })

      const purgedCount = await purgeOldSoftDeletedTransactions(90)
      expect(purgedCount).toBe(1)

      const oldRecord = await db.transactions.get(oldDeletedId)
      expect(oldRecord).toBeUndefined()

      const recentRecord = await db.transactions.get(recentDeletedId)
      expect(recentRecord).toBeDefined()
      expect(recentRecord.deletedAt).toBe(fiveDaysAgo)

      const activeRecord = await db.transactions.get(activeId)
      expect(activeRecord).toBeDefined()
    })
  })

  describe('3. Standardized Error Layer (AppError & transformDbError)', () => {
    it('transforms QuotaExceededError with storage-specific code and user guidance', () => {
      const quotaErr = new Error('The quota has been exceeded.')
      quotaErr.name = 'QuotaExceededError'

      const appErr = transformDbError(quotaErr, 'insertTransaction')
      expect(appErr).toBeInstanceOf(AppError)
      expect(appErr.code).toBe('STORAGE_QUOTA_EXCEEDED')
      expect(appErr.statusCode).toBe(507)
      expect(appErr.operation).toBe('insertTransaction')
      expect(appErr.userMessage).toContain('penyimpanan')
    })

    it('transforms ConstraintError with validation details', () => {
      const constraintErr = new Error('Key already exists.')
      constraintErr.name = 'ConstraintError'

      const appErr = transformDbError(constraintErr, 'addWallet')
      expect(appErr.code).toBe('CONSTRAINT_VIOLATION')
      expect(appErr.statusCode).toBe(409)
      expect(appErr.operation).toBe('addWallet')
    })

    it('transforms DatabaseClosedError and TransactionInactiveError correctly', () => {
      const closedErr = new Error('Database is closed')
      closedErr.name = 'DatabaseClosedError'
      const appClosed = transformDbError(closedErr, 'readData')
      expect(appClosed.code).toBe('DATABASE_CLOSED')

      const inactiveErr = new Error('Transaction is inactive')
      inactiveErr.name = 'TransactionInactiveError'
      const appInactive = transformDbError(inactiveErr, 'commitBatch')
      expect(appInactive.code).toBe('TRANSACTION_ABORTED')
    })

    it('preserves existing AppError instances without wrapping twice', () => {
      const original = new AppError('Custom domain error', { code: 'CUSTOM_ERR', statusCode: 400 })
      const transformed = transformDbError(original, 'testOp')
      expect(transformed).toBe(original)
      expect(transformed.code).toBe('CUSTOM_ERR')
    })
  })

  describe('4. Atomic Writes & Transactions', () => {
    it('creates a transaction within a clean atomic Dexie transaction', async () => {
      const walletId = await db.wallets.add({
        name: 'Tabungan Mandiri',
        balance: 2000000,
        currency: 'IDR',
        isArchived: false,
      })

      const txId = await createTransaction({
        type: 'income',
        amount: 500000.456,
        walletId,
        category: 'gaji',
        date: '2026-09-18',
        notes: 'Bonus',
      })

      const created = await db.transactions.get(txId)
      expect(created).toBeDefined()
      // roundCurrency must round 500000.456 to 500000.46
      expect(created.amount).toBe(500000.46)
      expect(created.type).toBe('income')
    })

    it('rolls back database operations if atomic block throws during update', async () => {
      const walletId = await db.wallets.add({
        name: 'Gopay',
        balance: 100000,
        currency: 'IDR',
        isArchived: false,
      })

      const txId = await createTransaction({
        type: 'expense',
        amount: 50000,
        walletId,
        category: 'transportasi',
        date: '2026-09-18',
      })

      // Try to update with invalid transfer configuration (same src and target)
      await expect(
        updateTransaction(txId, {
          type: 'transfer',
          walletId,
          targetWalletId: walletId,
        }),
      ).rejects.toThrow()

      // The transaction record in database must remain intact with previous state
      const intactTx = await db.transactions.get(txId)
      expect(intactTx.type).toBe('expense')
      expect(intactTx.amount).toBe(50000)
    })
  })

  describe('5. Dexie Schema Version 22', () => {
    it('includes deletedAt index in transactions schema definition', () => {
      const schema = db.tables.find((t) => t.name === 'transactions')?.schema
      expect(schema).toBeDefined()
      const hasDeletedAtIndex = schema.indexes.some((idx) => idx.name === 'deletedAt')
      expect(hasDeletedAtIndex).toBe(true)
    })
  })
})
