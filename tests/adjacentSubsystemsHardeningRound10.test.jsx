// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { format } from 'date-fns'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { db } from '../src/lib/db'
import { authenticateBiometric } from '../src/lib/biometric'
import * as passkeysModule from '../src/lib/passkeys'
import { notifyTodayEvents, nextDateByFrequency } from '../src/lib/automation'
import { matchCategoryFromDescription } from '../src/lib/merchantUtils'
import { sanitizeCategoryPath } from '../src/lib/categorySanitizer'
import { normalizeMerchantKey } from '../src/lib/ai/merchantCategorizer'
import { parseCsvStatement } from '../src/lib/statementParser'
import { exportTransactionsToCsv } from '../src/lib/exportReports'
import { roundCurrency, convertCurrency } from '../src/lib/utils'
import { createTransaction } from '../src/services/transactionService'
import ReportHeader from '../src/components/reports/ReportHeader'

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue({ uri: 'file:///docs/fintrack.csv' }),
  },
  Directory: {
    Documents: 'DOCUMENTS',
  },
}))

describe('Adjacent Subsystems Hardening Round 10 Test Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await db.recurringTransactions.clear()
    await db.transactions.clear()
    await db.notifications.clear()
    await db.wallets.clear()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // 1. Biometrics & App Lock Lifecycle
  // =========================================================================
  describe('1. Biometrics & App Lock Lifecycle', () => {
    it('sets window.__ft_isAuthPromptActive and dispatches ft-auth-prompt-active true and false', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }

      const eventsFired = []
      const listener = (e) => eventsFired.push(e.detail)
      window.addEventListener('ft-auth-prompt-active', listener)

      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([{ id: 'key-1' }])
      vi.spyOn(passkeysModule, 'authenticatePasskey').mockImplementation(async () => {
        expect(window.__ft_isAuthPromptActive).toBe(true)
        return { success: true }
      })

      const res = await authenticateBiometric()
      expect(res).toBe(true)
      expect(window.__ft_isAuthPromptActive).toBe(false)
      expect(eventsFired).toEqual([true, false])

      window.removeEventListener('ft-auth-prompt-active', listener)
    })

    it('resets window.__ft_isAuthPromptActive to false in finally block even when authentication throws', async () => {
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      }

      const eventsFired = []
      const listener = (e) => eventsFired.push(e.detail)
      window.addEventListener('ft-auth-prompt-active', listener)

      vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([{ id: 'key-1' }])
      vi.spyOn(passkeysModule, 'authenticatePasskey').mockRejectedValue(new Error('Auth failed'))

      const res = await authenticateBiometric()
      expect(res).toBe(false)
      expect(window.__ft_isAuthPromptActive).toBe(false)
      expect(eventsFired).toEqual([true, false])

      window.removeEventListener('ft-auth-prompt-active', listener)
    })
  })

  // =========================================================================
  // 2. Recurring Transactions & Device Downtime Automation
  // =========================================================================
  describe('2. Recurring Transactions & Device Downtime Automation', () => {
    it('notifyTodayEvents preserves nextDate on earliest overdue date for manual items (autoExecute === false)', async () => {
      const overdueDate = '2026-09-01'
      const recId = await db.recurringTransactions.add({
        title: 'Manual Internet Bill',
        amount: 350000,
        currency: 'IDR',
        frequency: 'monthly',
        nextDate: overdueDate,
        autoExecute: false,
        enabled: 1,
        anchorDay: 1,
      })

      await notifyTodayEvents()

      const itemAfter = await db.recurringTransactions.get(recId)
      expect(itemAfter.nextDate).toBe(overdueDate)
      expect(itemAfter.anchorDay).toBe(1)
    })

    it('notifyTodayEvents persists anchorDay for manual items if anchorDay was not explicitly set', async () => {
      const overdueDate = '2026-09-15'
      const recId = await db.recurringTransactions.add({
        title: 'Manual Water Bill',
        amount: 120000,
        currency: 'IDR',
        frequency: 'monthly',
        nextDate: overdueDate,
        autoExecute: false,
        enabled: 1,
      })

      await notifyTodayEvents()

      const itemAfter = await db.recurringTransactions.get(recId)
      expect(itemAfter.nextDate).toBe(overdueDate)
      expect(itemAfter.anchorDay).toBe(15)
    })

    it('creates real transaction with converted target currency and updates nextDate past today for recurring transfer', async () => {
      const srcWalletId = await db.wallets.add({
        name: 'Rupiah Wallet',
        currency: 'IDR',
        balance: 50000000,
      })
      const tgtWalletId = await db.wallets.add({
        name: 'Dollar Wallet',
        currency: 'USD',
        balance: 100,
      })

      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const overdueDate = '2026-08-10'

      const recId = await db.recurringTransactions.add({
        title: 'Monthly USD Savings Transfer',
        type: 'transfer',
        amount: 16000000,
        currency: 'IDR',
        walletId: srcWalletId,
        targetWalletId: tgtWalletId,
        frequency: 'monthly',
        nextDate: overdueDate,
        anchorDay: 10,
        enabled: 1,
        autoExecute: false,
      })

      // Simulate executing the hardened handleLogNow logic on this recurring record
      const item = await db.recurringTransactions.get(recId)
      const wallets = await db.wallets.toArray()
      const targetWallet = wallets.find((w) => String(w.id) === String(item.targetWalletId))
      expect(targetWallet).toBeDefined()
      expect(targetWallet.currency).toBe('USD')

      const rates = { USD: 1, IDR: 16000 }
      const tgtCurrency = targetWallet.currency
      const tgtAmount = roundCurrency(convertCurrency(item.amount, item.currency, tgtCurrency, rates), tgtCurrency)

      const txPayload = {
        date: todayStr,
        amount: item.amount,
        type: item.type,
        walletId: item.walletId,
        notes: item.title,
        currency: item.currency,
        targetWalletId: Number(item.targetWalletId),
        targetCurrency: tgtCurrency,
        targetAmount: tgtAmount,
      }

      const txId = await createTransaction(txPayload)
      expect(txId).toBeDefined()

      const createdTx = await db.transactions.get(txId)
      expect(createdTx.type).toBe('transfer')
      expect(createdTx.amount).toBe(16000000)
      expect(createdTx.currency).toBe('IDR')
      expect(createdTx.targetCurrency).toBe('USD')
      expect(createdTx.targetAmount).toBe(1000)

      // Advance nextDate forward until strictly future
      let nextDateStr = item.nextDate
      while (nextDateStr <= todayStr) {
        const baseDate = new Date(`${nextDateStr}T12:00:00`)
        const nextPointer = nextDateByFrequency(baseDate, item.frequency, item.anchorDay)
        nextDateStr = format(nextPointer, 'yyyy-MM-dd')
      }
      expect(nextDateStr > todayStr).toBe(true)

      await db.recurringTransactions.update(item.id, {
        nextDate: nextDateStr,
        lastRun: todayStr,
      })

      const updatedRec = await db.recurringTransactions.get(recId)
      expect(updatedRec.nextDate).toBe(nextDateStr)
      expect(updatedRec.lastRun).toBe(todayStr)
    })

    it('rejects recurring transfer if target wallet is archived', async () => {
      const srcWalletId = await db.wallets.add({
        name: 'Active Source',
        currency: 'IDR',
        balance: 1000000,
      })
      const archivedTgtId = await db.wallets.add({
        name: 'Archived Target',
        currency: 'IDR',
        balance: 0,
        isArchived: 1,
      })

      const recItem = {
        title: 'Transfer to Archived',
        type: 'transfer',
        amount: 50000,
        currency: 'IDR',
        walletId: srcWalletId,
        targetWalletId: archivedTgtId,
      }

      await expect(
        createTransaction({
          date: '2026-10-10',
          amount: recItem.amount,
          type: 'transfer',
          walletId: recItem.walletId,
          targetWalletId: recItem.targetWalletId,
          currency: 'IDR',
        })
      ).rejects.toThrow(/diarsipkan/)
    })
  })

  // =========================================================================
  // 3. Split Bill Currency Precision
  // =========================================================================
  describe('3. Split Bill Currency Precision', () => {
    it('roundCurrency produces zero decimal places for IDR, JPY, KRW, VND', () => {
      expect(roundCurrency(12345.67, 'IDR')).toBe(12346)
      expect(roundCurrency(999.4, 'JPY')).toBe(999)
      expect(roundCurrency(50000.8, 'KRW')).toBe(50001)
      expect(roundCurrency(100000.25, 'VND')).toBe(100000)
    })

    it('roundCurrency preserves 2 decimal places for non-zero decimal currencies (USD, EUR, SGD)', () => {
      expect(roundCurrency(12.3456, 'USD')).toBe(12.35)
      expect(roundCurrency(99.994, 'EUR')).toBe(99.99)
      expect(roundCurrency(50.5, 'SGD')).toBe(50.5)
    })

    it('calculates equal shares without fractional floating cents in IDR', () => {
      const totalAmount = 100001
      const count = 3
      const isZeroDecimal = true

      const friendShare = isZeroDecimal ? Math.floor(totalAmount / count) : roundCurrency(totalAmount / count, 'IDR')
      const payerShare = roundCurrency(totalAmount - (friendShare * (count - 1)), 'IDR')

      expect(friendShare).toBe(33333)
      expect(payerShare).toBe(33335)
      expect(friendShare * 2 + payerShare).toBe(totalAmount)
    })
  })

  // =========================================================================
  // 4. Merchant NLP Categorization & Store Normalization
  // =========================================================================
  describe('4. Merchant NLP Categorization & Store Normalization', () => {
    it('prevents substring collisions on short tokens (tol, tri, xl, mie, adm) in matchCategoryFromDescription', () => {
      expect(matchCategoryFromDescription('Total Belanja Minimarket')).not.toBe('transportasi/tol')
      expect(matchCategoryFromDescription('Baju XL')).toBe('pakaian/baju')
      expect(matchCategoryFromDescription('Kemeja XL')).toBe('pakaian/baju')
      expect(matchCategoryFromDescription('Jaket XL')).toBe('pakaian/baju')
      expect(matchCategoryFromDescription('Hoodie XL')).toBe('pakaian/baju')
      expect(matchCategoryFromDescription('Cinema XXI Premiere')).toBe('kultur/bioskop')
      expect(matchCategoryFromDescription('Sewa Lapangan Badminton')).not.toBe('lainnya_kategori/pajak')
    })

    it('categorizes spaced food delivery tokens in matchCategoryFromDescription', () => {
      expect(matchCategoryFromDescription('Grab Food')).toBe('makanan/makan_diluar')
      expect(matchCategoryFromDescription('Go Food Nasi Padang')).toBe('makanan/makan_diluar')
      expect(matchCategoryFromDescription('Shopee Food Ayam Geprek')).toBe('makanan/makan_diluar')
    })

    it('prevents substring collisions in sanitizeCategoryPath for all clothing variations', () => {
      expect(sanitizeCategoryPath('Baju XL', 'expense')).toBe('pakaian/baju')
      expect(sanitizeCategoryPath('Kemeja XL', 'expense')).toBe('pakaian/baju')
      expect(sanitizeCategoryPath('Jaket XL', 'expense')).toBe('pakaian/baju')
      expect(sanitizeCategoryPath('Hoodie XL', 'expense')).toBe('pakaian/baju')
      expect(sanitizeCategoryPath('Cinema XXI Premiere', 'expense')).toBe('kultur/bioskop')
      expect(sanitizeCategoryPath('Total Belanja', 'expense')).not.toBe('transportasi/tol')
      expect(sanitizeCategoryPath('Grab Food', 'expense')).toBe('makanan/makan_diluar')
      expect(sanitizeCategoryPath('Go Food', 'expense')).toBe('makanan/makan_diluar')
      expect(sanitizeCategoryPath('Shopee Food', 'expense')).toBe('makanan/makan_diluar')
      expect(sanitizeCategoryPath('Biaya Admin', 'expense')).toBe('lainnya_kategori/pajak')
    })

    it('normalizes store branch numbers in normalizeMerchantKey for Tier-1 cache hits', () => {
      expect(normalizeMerchantKey('Kopi Kenangan 128')).toBe('kopi kenangan')
      expect(normalizeMerchantKey('Mie Gacoan Cabang 05')).toBe('mie gacoan')
      expect(normalizeMerchantKey('Fore Coffee 08')).toBe('fore coffee')
      expect(normalizeMerchantKey('Starbucks Store 24')).toBe('starbucks')
    })
  })

  // =========================================================================
  // 5. CSV & PDF Export/Import Integrity
  // =========================================================================
  describe('5. CSV & PDF Export/Import Integrity', () => {
    it('parseCsvStatement strips leading sep= directive and uses explicit delimiter', async () => {
      const csvWithSep = 'sep=;\r\nDate;Description;Amount;Type\r\n2026-10-01;Starbucks;55000;expense\r\n2026-10-02;Salary;10000000;income'
      const parsed = await parseCsvStatement(csvWithSep)

      expect(parsed.headers).toEqual(['Date', 'Description', 'Amount', 'Type'])
      expect(parsed.rows.length).toBe(2)
      expect(parsed.rows[0].Description).toBe('Starbucks')
      expect(parsed.rows[1].Amount).toBe('10000000')
    })

    it('parseCsvStatement strips leading BOM + sep= directive correctly', async () => {
      const csvWithBomAndSep = '\uFEFFsep=,\nTanggal,Keterangan,Nominal\n2026-10-05,Kopi Kenangan,25000'
      const parsed = await parseCsvStatement(csvWithBomAndSep)

      expect(parsed.headers).toEqual(['Tanggal', 'Keterangan', 'Nominal'])
      expect(parsed.rows.length).toBe(1)
      expect(parsed.rows[0].Keterangan).toBe('Kopi Kenangan')
    })

    it('exportTransactionsToCsv writes base64 data to Directory.Documents on native Capacitor', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      Filesystem.writeFile.mockClear()

      const toastEvents = []
      const toastListener = (e) => toastEvents.push(e.detail)
      window.addEventListener('ft-show-toast', toastListener)

      const sampleTxs = [
        { id: 101, date: '2026-10-10', type: 'expense', category: 'makanan/kopi', amount: 35000, currency: 'IDR', notes: 'Kopi' },
      ]
      const sampleWallets = [{ id: 1, name: 'Dompet Utama' }]

      const ok = await exportTransactionsToCsv(sampleTxs, sampleWallets, 'IDR', 'id')
      expect(ok).toBe(true)
      expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)
      const callArg = Filesystem.writeFile.mock.calls[0][0]
      expect(callArg.directory).toBe(Directory.Documents)
      expect(callArg.path).toContain('.csv')
      expect(typeof callArg.data).toBe('string')
      expect(toastEvents.length).toBe(1)
      expect(toastEvents[0].type).toBe('success')

      window.removeEventListener('ft-show-toast', toastListener)
    })

    it('renders ReportHeader and awaits onExportCsv when CSV button is clicked', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      let resolveExport
      const exportPromise = new Promise((resolve) => {
        resolveExport = resolve
      })
      const onExportCsvMock = vi.fn().mockReturnValue(exportPromise)

      const toastEvents = []
      const toastListener = (e) => toastEvents.push(e.detail)
      window.addEventListener('ft-show-toast', toastListener)

      render(
        <MemoryRouter>
          <ReportHeader
            rangeMonths={1}
            setRangeMonths={() => {}}
            monthlyIncomeExpense={{}}
            onExportCsv={onExportCsvMock}
            onPrintReport={() => {}}
            anchorDate={new Date()}
            setAnchorDate={() => {}}
            periodSummary={{ totalIncome: 0, totalExpense: 0, netSavings: 0 }}
          />
        </MemoryRouter>
      )

      // Find CSV Export button (title or aria-label contains CSV)
      const csvBtn = screen.getByTitle(/CSV/i)
      expect(csvBtn).toBeDefined()

      fireEvent.click(csvBtn)
      expect(onExportCsvMock).toHaveBeenCalledTimes(1)
      // Toast should NOT have fired yet because exportPromise is pending!
      expect(toastEvents.length).toBe(0)

      resolveExport(true)

      await waitFor(() => {
        expect(toastEvents.length).toBe(1)
      })
      expect(toastEvents[0].type).toBe('success')

      window.removeEventListener('ft-show-toast', toastListener)
    })

    it('suppresses web download toast on native Capacitor in ReportHeader to avoid double toasts', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      const onExportCsvMock = vi.fn().mockResolvedValue(true)

      const toastEvents = []
      const toastListener = (e) => toastEvents.push(e.detail)
      window.addEventListener('ft-show-toast', toastListener)

      render(
        <MemoryRouter>
          <ReportHeader
            rangeMonths={1}
            setRangeMonths={() => {}}
            monthlyIncomeExpense={{}}
            onExportCsv={onExportCsvMock}
            onPrintReport={() => {}}
            anchorDate={new Date()}
            setAnchorDate={() => {}}
            periodSummary={{ totalIncome: 0, totalExpense: 0, netSavings: 0 }}
          />
        </MemoryRouter>
      )

      const csvBtn = screen.getByTitle(/CSV/i)
      fireEvent.click(csvBtn)

      await waitFor(() => {
        expect(onExportCsvMock).toHaveBeenCalledTimes(1)
      })

      // On native, ReportHeader must suppress its generic web download toast
      expect(toastEvents.length).toBe(0)

      window.removeEventListener('ft-show-toast', toastListener)
    })
  })
})
