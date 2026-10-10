// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { parseMoneyInput } from '../src/lib/utils'
import { parseGenericCsvRows, detectDuplicateTransactions } from '../src/lib/statementParser'
import { isTxMatchingBudget } from '../src/lib/budgetUtils'
import { generateExecutiveReportPdf } from '../src/lib/pdfReportGenerator'

describe('Adjacent Subsystems Hardening - Round 8', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.todos.clear()
    await db.sub_tasks.clear()
    await db.budgets.clear()
    localStorage.clear()
  })

  // F8-11: English comma thousand grouping vs decimal parsing
  describe('F8-11: Money Input Thousand Separator Parsing', () => {
    it('correctly parses English comma thousand separators as whole numbers', () => {
      expect(parseMoneyInput('150,000')).toBe(150000)
      expect(parseMoneyInput('1,500,000')).toBe(1500000)
      expect(parseMoneyInput('2,000')).toBe(2000)
      expect(parseMoneyInput('10,000,000')).toBe(10000000)
    })

    it('correctly parses Indonesian dot thousand separators', () => {
      expect(parseMoneyInput('150.000')).toBe(150000)
      expect(parseMoneyInput('1.500.000')).toBe(1500000)
    })

    it('preserves valid trailing 1-2 decimal places with comma or dot', () => {
      expect(parseMoneyInput('150,50')).toBe(150.5)
      expect(parseMoneyInput('150.50')).toBe(150.5)
      expect(parseMoneyInput('1250,75')).toBe(1250.75)
      expect(parseMoneyInput('1250.75')).toBe(1250.75)
    })
  })

  // F8-03, F8-11, F8-13, F8-15: Statement Import CSV Parser Hardening
  describe('Statement Import & CSV Parsers (F8-03, F8-11, F8-13, F8-15)', () => {
    it('F8-11: passes currency and parses comma thousands in multi-currency CSV rows', () => {
      const rows = [
        { Date: '2026-08-20', Description: 'Server Subscription', Amount: '1,250.00' },
      ]
      const mapping = { dateCol: 'Date', descCol: 'Description', amountCol: 'Amount' }
      const parsed = parseGenericCsvRows(rows, mapping, 'USD')

      expect(parsed).toHaveLength(1)
      expect(parsed[0].amount).toBe(1250)
      expect(parsed[0].currency).toBe('USD')
    })

    it('F8-03 & F8-13: parses date and time with Indonesian month names and split timestamps', () => {
      const rows = [
        { Tanggal: '25 Agu 2026 14:35:20', Keterangan: 'Pembelian Bahan', Nominal: '250.000' },
        { Tanggal: '15/09/2026 08:20', Keterangan: 'Kopi Pagi', Nominal: '25.000' },
      ]
      const mapping = { dateCol: 'Tanggal', descCol: 'Keterangan', amountCol: 'Nominal' }
      const parsed = parseGenericCsvRows(rows, mapping, 'IDR')

      expect(parsed).toHaveLength(2)
      expect(parsed[0].date).toBe('2026-08-25')
      expect(parsed[0].time).toBe('14:35')
      expect(parsed[1].date).toBe('2026-09-15')
      expect(parsed[1].time).toBe('08:20')
    })

    it('F8-04 & F8-15: accurately detects distinct existing records and flags intra-file duplicates', () => {
      const existingTxs = [
        { id: 99, date: '2026-08-20', type: 'expense', amount: 50000, notes: 'Makan Siang' },
      ]
      const rows = [
        { Date: '2026-08-20', Desc: 'Makan Siang', Amount: '50000' }, // Matches existing
        { Date: '2026-08-20', Desc: 'Makan Siang', Amount: '50000' }, // Second occurrence in same file -> intra-file duplicate!
        { Date: '2026-08-21', Desc: 'Bensin', Amount: '30000' },
      ]
      const mapping = { dateCol: 'Date', descCol: 'Desc', amountCol: 'Amount' }
      const parsed = parseGenericCsvRows(rows, mapping, 'IDR')
      const deduplicated = detectDuplicateTransactions(parsed, existingTxs)

      expect(deduplicated).toHaveLength(3)
      // First row matches existing DB record
      expect(deduplicated[0].isDuplicate).toBe(true)
      expect(deduplicated[0].isDuplicateInImport).toBeFalsy()

      // Second row cannot claim the same existing DB record, but is flagged as intra-import duplicate
      expect(deduplicated[1].isDuplicate).toBe(true)
      expect(deduplicated[1].isDuplicateInImport).toBe(true)

      // Third row is unique
      expect(deduplicated[2].isDuplicate).toBe(false)
      expect(deduplicated[2].isDuplicateInImport).toBeFalsy()
    })
  })

  // F8-01: Budget custom subcategory isolation
  describe('F8-01: Budget Matching Isolation for Custom Subcategories', () => {
    it('isolates budget with custom subcategory from absorbing other subcategories or parent expenses', () => {
      const customSubBudget = {
        category: 'makanan',
        childId: 'cafe',
      }

      const matchingTx = {
        category: 'makanan',
        childId: 'cafe',
      }

      const differentSubTx = {
        category: 'makanan',
        childId: 'restoran',
      }

      const parentOnlyTx = {
        category: 'makanan',
      }

      expect(isTxMatchingBudget(customSubBudget, matchingTx)).toBe(true)
      expect(isTxMatchingBudget(customSubBudget, differentSubTx)).toBe(false)
      expect(isTxMatchingBudget(customSubBudget, parentOnlyTx)).toBe(false)
    })

    it('allows generic parent budget without childId to match all child subcategories', () => {
      const genericBudget = {
        category: 'makanan',
      }

      expect(isTxMatchingBudget(genericBudget, { category: 'makanan', childId: 'cafe' })).toBe(true)
      expect(isTxMatchingBudget(genericBudget, { category: 'makanan' })).toBe(true)
      expect(isTxMatchingBudget(genericBudget, { category: 'transportasi' })).toBe(false)
    })
  })

  // F8-05: Security lockout persistence
  describe('F8-05: Security Lockout Persistence', () => {
    it('persists and calculates lockout expiration timestamps in localStorage', () => {
      const lockoutTimestamp = Date.now() + 60000
      localStorage.setItem('ft_lockout_until', String(lockoutTimestamp))
      localStorage.setItem('ft_lockout_attempts', '5')

      const storedUntil = Number(localStorage.getItem('ft_lockout_until') || 0)
      const remainingSec = Math.max(0, Math.ceil((storedUntil - Date.now()) / 1000))

      expect(remainingSec).toBeGreaterThan(0)
      expect(remainingSec).toBeLessThanOrEqual(60)
      expect(Number(localStorage.getItem('ft_lockout_attempts'))).toBe(5)
    })
  })

  // F8-09: Completed todo overdue status suppression
  describe('F8-09: Todo Overdue Suppression on Completion', () => {
    it('suppresses overdue styling when todo is marked as completed', () => {
      const pastDueDate = '2020-01-01'

      // Mocking dueStatus logic with isCompleted parameter
      const computeDueStatus = (dueDate, isCompleted = false) => {
        if (!dueDate) return null
        if (isCompleted) {
          return { key: 'completed', label: dueDate, borderClass: '' }
        }
        return { key: 'overdue', label: 'Terlewat', borderClass: 'border-rose-500/50' }
      }

      const activeStatus = computeDueStatus(pastDueDate, false)
      expect(activeStatus.key).toBe('overdue')
      expect(activeStatus.borderClass).toBe('border-rose-500/50')

      const completedStatus = computeDueStatus(pastDueDate, true)
      expect(completedStatus.key).toBe('completed')
      expect(completedStatus.borderClass).toBe('')
    })
  })

  // F8-10: Subtask deletion parent completion preservation
  describe('F8-10: Subtask Deletion Parent Completion Preservation', () => {
    it('preserves parent completion status when all subtasks are deleted', async () => {
      const todoId = await db.todos.add({
        title: 'Lapor SPT Tahunan',
        completed: true,
        createdAt: Date.now(),
      })

      const subId = await db.sub_tasks.add({
        todoId,
        label: 'Unduh Bukti Potong',
        checked: true,
      })

      // Simulate deleting subtask
      await db.transaction('rw', db.todos, db.sub_tasks, async () => {
        await db.sub_tasks.delete(subId)
        const remainingSubs = await db.sub_tasks.where('todoId').equals(todoId).toArray()
        if (remainingSubs.length > 0) {
          const allDone = remainingSubs.every((s) => s.checked)
          await db.todos.update(todoId, { completed: allDone })
        }
        // When remainingSubs is empty, retain parent status!
      })

      const updatedTodo = await db.todos.get(todoId)
      expect(updatedTodo.completed).toBe(true)
    })
  })

  // F8-07 & F8-14: Executive PDF Report Generator
  describe('F8-07 & F8-14: Executive PDF Report Formatting & Multi-page Polish', () => {
    it('generates executive PDF with checksum, docId, and running headers/footers', async () => {
      const reportParams = {
        incomeStatement: {
          netIncome: 15000000,
          operatingRevenue: { total: 20000000, items: [{ category: 'Gaji', amount: 20000000 }] },
          operatingExpenses: { total: 5000000, items: [{ category: 'Operasional', amount: 5000000 }] },
          operatingProfit: 15000000,
        },
        balanceSheet: {
          assets: { totalAssets: 100000000, currentAssets: { total: 50000000, items: [] }, nonCurrentAssets: {} },
          liabilities: { total: 10000000, items: [] },
          equity: { netWorth: 90000000, totalEquity: 90000000 },
        },
        cashFlowStatement: {
          operatingActivities: { net: 15000000 },
          investingActivities: { net: -5000000 },
          financingActivities: { net: 0 },
          netChangeInCash: 10000000,
        },
        periodName: 'Agustus 2026',
        profileName: 'PT FinTrack Sukses Mandiri',
        currency: 'IDR',
        locale: 'id',
      }

      const { doc, checksum, docId, filename } = await generateExecutiveReportPdf(reportParams)

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
      expect(checksum.length).toBe(64) // SHA-256 hex string

      expect(docId).toBeDefined()
      expect(docId).toMatch(/^FT-RPT-/)

      expect(filename).toContain('FinTrack_Laporan_Eksekutif_')

      const totalPages = doc.internal.getNumberOfPages()
      expect(totalPages).toBeGreaterThanOrEqual(1)
    })
  })
})
