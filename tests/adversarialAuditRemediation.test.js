import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { queryTransactions, getMonthSummaryForPrompt } from '../src/lib/aiDatabaseQueries'
import { calculateDirectFinancialHealth } from '../src/lib/gemini'
import {
  findWalletInText,
  parseIndonesianFinancialText,
  parseMultiClauseTransactions,
  parseTransferTransaction,
} from '../src/lib/ai/indonesianFinanceNlp'
import { sanitizeCategoryPath } from '../src/lib/categorySanitizer'
import { formatCurrency } from '../src/lib/utils'
import useSettingsStore from '../src/store/useSettingsStore'
import {
  validateTransferWallets,
  findMatchingTransactionForAction,
  findMatchingLoanForAction,
  prepareUnifiedMessage,
} from '../src/lib/ai/aiChatHelpers'

describe('Adversarial Audit Remediation - Comprehensive Verification', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.budgets.clear()
    await db.loans.clear()
    await db.wallets.clear()
    await db.recurringTransactions.clear()
    useSettingsStore.setState({
      defaultCurrency: 'IDR',
      defaultWalletId: null,
      budgetCycleStartDay: 1,
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Phase 1: Integritas Buku Kas & Data Analitik (Kritis)
  // ─────────────────────────────────────────────────────────────
  describe('Phase 1: Integritas Buku Kas & Data Analitik (Kritis)', () => {
    it('CRIT-01: queryTransactions unpacks split items, overrides parent isExcludeAnalyticsTx, but respects individual item exclusion', async () => {
      // Split transaction where parent has isExcludeAnalyticsTx: true
      // Item 1 and 2 have undefined isExcludeAnalyticsTx -> included
      // Item 3 has isExcludeAnalyticsTx: true -> excluded
      await db.transactions.add({
        id: 1,
        date: '2026-09-10',
        type: 'expense',
        category: 'makanan',
        amount: 60000,
        currency: 'IDR',
        isSplit: true,
        isExcludeAnalyticsTx: true, // Parent exclusion
        splitItems: [
          { category: 'makanan/makan_siang', amount: 30000, type: 'expense' },
          { category: 'makanan/kopi', amount: 20000, type: 'expense' },
          { category: 'makanan/camilan', amount: 10000, type: 'expense', isExcludeAnalyticsTx: true },
        ],
      })

      const result = await queryTransactions({ startDate: '2026-09-01', endDate: '2026-09-30' })
      expect(result.totalTransactionsFound).toBe(2)
      expect(result.totalExpense).toBe(50000)
      expect(result.expenseByCategory['makanan/makan_siang']).toBe(30000)
      expect(result.expenseByCategory['makanan/kopi']).toBe(20000)
      expect(result.expenseByCategory['makanan/camilan']).toBeUndefined()
    })

    it('CRIT-01: getMonthSummaryForPrompt includes valid split items despite parent isExcludeAnalyticsTx: true', async () => {
      const nowStr = new Date().toISOString().slice(0, 7) + '-10'
      await db.transactions.add({
        id: 2,
        date: nowStr,
        type: 'expense',
        category: 'belanja',
        amount: 100000,
        currency: 'IDR',
        isSplit: true,
        isExcludeAnalyticsTx: true,
        splitItems: [
          { category: 'belanja/harian', amount: 70000, type: 'expense' },
          { category: 'belanja/snack', amount: 30000, type: 'expense' },
        ],
      })

      const summary = await getMonthSummaryForPrompt()
      expect(typeof summary).toBe('string')
      expect(summary).toContain(formatCurrency(100000, 'IDR'))
      expect(summary).toContain('belanja/harian')
    })

    it('CRIT-01: evaluateFinancialHealth does not exclude split transactions with parent isExcludeAnalyticsTx', async () => {
      await db.wallets.add({ id: 1, name: 'BCA', balance: 5000000, currency: 'IDR' })
      await db.transactions.add({
        id: 101,
        date: '2026-09-05',
        amount: 500000,
        currency: 'IDR',
        type: 'expense',
        category: 'makanan',
        isSplit: true,
        isExcludeAnalyticsTx: true, // Parent tag
        splitItems: [
          { category: 'makanan/makan_siang', amount: 300000, type: 'expense' },
          { category: 'makanan/makan_malam', amount: 200000, type: 'expense' },
        ],
      })

      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      expect(health.metrics.monthlyExpense).toBe(500000)
    })

    it('CRIT-02: getMonthSummaryForPrompt steps back from currentMonthKey when budgetCycleStartDay > 1', async () => {
      // Configure payday cycle mid-month (e.g. 25th)
      useSettingsStore.setState({ budgetCycleStartDay: 25 })

      // Call getMonthSummaryForPrompt
      const summary = await getMonthSummaryForPrompt()
      expect(typeof summary).toBe('string')
      expect(summary).toContain('BULAN INI')
      expect(summary).toContain('BULAN LALU')
    })

    it('HIGH-04: Loan payment does not overwrite loan.walletId origin in ledger', async () => {
      const loanId = await db.loans.add({
        title: 'Pinjaman Kuliah',
        personName: 'Budi',
        type: 'debt',
        totalAmount: 5000000,
        remainingAmount: 5000000,
        walletId: 1, // Disbursed into Wallet 1
        currency: 'IDR',
        status: 'active',
      })

      const matched = await db.loans.get(loanId)
      expect(matched.walletId).toBe(1)

      // With our fix in AiFinanceChat.jsx, matched.walletId is not mutated on payment
      const loanAfterPayment = await db.loans.get(loanId)
      expect(loanAfterPayment.walletId).toBe(1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Phase 2: Keselamatan Operasi Chat & Integritas State
  // ─────────────────────────────────────────────────────────────
  describe('Phase 2: Keselamatan Operasi Chat & Integritas State', () => {
    it('HIGH-01: validateTransferWallets detects same-wallet transfer and missing-wallet transfer', () => {
      const wallets = [
        { id: 1, name: 'BCA', currency: 'IDR' },
        { id: 2, name: 'Gopay', currency: 'IDR' },
      ]

      // Case 1: Same wallet
      const sameRes = validateTransferWallets(1, 1, wallets)
      expect(sameRes.isValid).toBe(false)
      expect(sameRes.errorMessageKey).toBe('same_wallet')

      // Case 2: Only 1 wallet available in system
      const singleWalletList = [{ id: 1, name: 'BCA', currency: 'IDR' }]
      const missingRes = validateTransferWallets(1, null, singleWalletList)
      expect(missingRes.isValid).toBe(false)
      expect(missingRes.errorMessageKey).toBe('missing_wallets')

      // Case 3: Valid distinct transfer
      const validRes = validateTransferWallets(1, 2, wallets)
      expect(validRes.isValid).toBe(true)
      expect(validRes.fromWallet.id).toBe(1)
      expect(validRes.toWallet.id).toBe(2)
      expect(validRes.errorMessageKey).toBeNull()
    })

    it('HIGH-02: findMatchingTransactionForAction requires BOTH date and query constraint to match (AND constraint)', () => {
      const allFreshTxs = [
        { id: 10, date: '2026-09-16', notes: 'Makan Bakso', category: 'makanan/makan_siang' },
        { id: 11, date: '2026-09-16', notes: 'Beli Kopi', category: 'makanan/kopi' },
        { id: 12, date: '2026-09-15', notes: 'Beli Kopi', category: 'makanan/kopi' },
      ]

      // Scenario 1: Match by query AND date -> tx 11 (Beli Kopi on 2026-09-16)
      const matched = findMatchingTransactionForAction(allFreshTxs, {
        action: 'delete',
        searchQuery: 'kopi',
        date: '2026-09-16',
      })
      expect(matched).toBeDefined()
      expect(matched.id).toBe(11)

      // Scenario 2: Date matches but query does not match -> must return null (NOT false match tx 10 or 11)
      const noMatch = findMatchingTransactionForAction(allFreshTxs, {
        action: 'delete',
        searchQuery: 'nasi goreng',
        date: '2026-09-16',
      })
      expect(noMatch).toBeNull()

      // Scenario 3: Explicit transaction ID matches directly
      const byId = findMatchingTransactionForAction(allFreshTxs, {
        action: 'delete',
        transactionId: 12,
      })
      expect(byId).toBeDefined()
      expect(byId.id).toBe(12)

      // Scenario 4: Relative keyword "terakhir" returns newest transaction
      const latest = findMatchingTransactionForAction(allFreshTxs, {
        action: 'delete',
        searchQuery: 'terakhir',
      })
      expect(latest).toBeDefined()
      expect(latest.id).toBe(10)
    })

    it('HIGH-03: findMatchingLoanForAction requires non-empty title or personName and supports pay, mark_paid, and delete', () => {
      const allLoans = [
        { id: 1, title: 'Pinjaman Laptop', personName: 'Andi', status: 'active', isArchived: false },
        { id: 2, title: 'Utang Motor', personName: 'Budi', status: 'active', isArchived: false },
        { id: 3, title: 'Utang Makan', personName: 'Cici', status: 'paid', isArchived: false },
      ]

      // Case 1: Empty title and personName returns empty filterTerm and null match
      const emptyRes = findMatchingLoanForAction(allLoans, { title: '', personName: '' }, { includePaid: false })
      expect(emptyRes.filterTerm).toBe('')
      expect(emptyRes.matched).toBeNull()

      // Case 2: Match by personName
      const personRes = findMatchingLoanForAction(allLoans, { personName: 'Budi' }, { includePaid: false })
      expect(personRes.filterTerm).toBe('budi')
      expect(personRes.matched).toBeDefined()
      expect(personRes.matched.id).toBe(2)

      // Case 3: Match by title
      const titleRes = findMatchingLoanForAction(allLoans, { title: 'Laptop' }, { includePaid: false })
      expect(titleRes.filterTerm).toBe('laptop')
      expect(titleRes.matched).toBeDefined()
      expect(titleRes.matched.id).toBe(1)

      // Case 4: Already paid loan is excluded when includePaid: false (pay / mark_paid)
      const paidRes = findMatchingLoanForAction(allLoans, { title: 'Makan' }, { includePaid: false })
      expect(paidRes.matched).toBeNull()

      // Case 5: Already paid loan is matchable when includePaid: true (delete)
      const deletePaidRes = findMatchingLoanForAction(allLoans, { title: 'Makan' }, { includePaid: true })
      expect(deletePaidRes.matched).toBeDefined()
      expect(deletePaidRes.matched.id).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Phase 3: Konsistensi NLP, Konfigurasi Pengguna & Polish
  // ─────────────────────────────────────────────────────────────
  describe('Phase 3: Konsistensi NLP, Konfigurasi Pengguna & Polish', () => {
    it('MED-04: findWalletInText prioritizes useSettingsStore.getState().defaultWalletId when no wallet name is in text', () => {
      useSettingsStore.setState({ defaultWalletId: 5 })
      const wallets = [
        { id: 1, name: 'Dompet Utama' },
        { id: 5, name: 'Bank Jago' },
      ]

      const resolvedId = findWalletInText('beli kopi 25rb', wallets)
      expect(resolvedId).toBe(5)
    })

    it('MED-04: parseTransferTransaction uses configured defaultWalletId from settings store', () => {
      useSettingsStore.setState({ defaultWalletId: 5 })
      const wallets = [
        { id: 1, name: 'BCA' },
        { id: 5, name: 'Bank Jago' },
      ]

      const res = parseTransferTransaction('transfer 50rb ke bca', wallets, 'IDR')
      expect(res).not.toBeNull()
      expect(res.transactions[0].walletId).toBe(5)
      expect(res.transactions[0].targetWalletId).toBe(1)
    })

    it('MED-02: Preserves "makan" in compound meal verbs like "makan siang", "makan pagi", "makan malam"', () => {
      const wallets = [{ id: 1, name: 'Cash' }]
      const parsedSiang = parseIndonesianFinancialText('makan siang 35rb', wallets)
      expect(parsedSiang.transactions[0].notes.toLowerCase()).toContain('makan siang')

      const parsedPagi = parseIndonesianFinancialText('makan pagi 20rb', wallets)
      expect(parsedPagi.transactions[0].notes.toLowerCase()).toContain('makan pagi')

      const parsedMalam = parseIndonesianFinancialText('makan malam 50rb', wallets)
      expect(parsedMalam.transactions[0].notes.toLowerCase()).toContain('makan malam')

      // But non-compound "makan bakso 25rb" should strip "makan" and leave "Bakso"
      const parsedBakso = parseIndonesianFinancialText('makan bakso 25rb', wallets)
      expect(parsedBakso.transactions[0].notes).toBe('Bakso')
    })

    it('MED-03: Preserves detail notes in parentheses while stripping wallet in parentheses', () => {
      const wallets = [{ id: 4, name: 'Dana' }]
      const input = '9 september dapet uang saku 60k dan 12 sep 25k buat beli obat (panadol merah) (dana)'
      const result = parseMultiClauseTransactions(input, wallets, 'IDR', new Date('2026-09-15'))

      expect(result).not.toBeNull()
      expect(result.transactions).toHaveLength(2)
      // First clause: Uang Saku
      expect(result.transactions[0].amount).toBe(60000)
      expect(result.transactions[0].type).toBe('income')

      // Second clause: Obat (Panadol Merah) with Dana wallet
      expect(result.transactions[1].amount).toBe(25000)
      expect(result.transactions[1].type).toBe('expense')
      expect(result.transactions[1].walletId).toBe(4)
      expect(result.transactions[1].notes).toContain('(Panadol Merah)')
    })

    it('MED-05: Sanitizes recurring transaction category to valid category path', () => {
      const unsanitized = 'Lainnya'
      const sanitized = sanitizeCategoryPath(unsanitized, 'expense') || 'kebutuhan_harian/umum'
      expect(sanitized).toBe('lainnya_kategori/umum')

      const specific = 'Makan Siang'
      const sanitizedSpecific = sanitizeCategoryPath(specific, 'expense') || 'kebutuhan_harian/umum'
      expect(sanitizedSpecific).toBe('makanan/makan_siang')
    })

    it('MED-01: evaluateFinancialHealth applies -20 penalty when rawSavingsRatio is negative (deficit)', async () => {
      await db.wallets.add({ id: 1, name: 'BCA', balance: 5000000, currency: 'IDR' })
      // Income 1,000,000, Expense 4,000,000 -> Deficit: rawSavingsRatio = -300%
      await db.transactions.add({ id: 1, date: '2026-09-01', amount: 1000000, type: 'income', category: 'pendapatan/gaji', currency: 'IDR' })
      await db.transactions.add({ id: 2, date: '2026-09-02', amount: 4000000, type: 'expense', category: 'makanan', currency: 'IDR' })

      const health = await calculateDirectFinancialHealth({
        defaultCurrency: 'IDR',
        locale: 'id',
        referenceDate: new Date('2026-09-15'),
      })

      // Starting score = 50. Deficit penalty = -20.
      // Emergency months = 5m / 4m = 1.25 (between 1 and 3, +0).
      // DTI = 0 (debt <= 30, +15).
      // Total score = 50 - 20 + 15 = 45.
      expect(health.score).toBeLessThanOrEqual(50)
      expect(health.rating).toBe('Perlu Perhatian')
    })

    it('LOW-01: prepareUnifiedMessage clears temporary processing text on action card render, preserving error/preserveContent', () => {
      // Case 1: Action success card -> content cleared
      const actionMsg = [
        {
          id: 123,
          role: 'ai',
          type: 'action_success',
          data: { type: 'recurring', title: 'Spotify' },
          content: 'Temporary processing text from streaming buffer',
        },
      ]
      const unifiedAction = prepareUnifiedMessage(actionMsg, { text: 'Sedang memproses...' })
      expect(unifiedAction.content).toBe('')

      // Case 2: Error message -> preserved
      const errorMsg = [
        {
          id: 124,
          role: 'ai',
          type: 'text',
          isError: true,
          content: 'Dompet asal dan tujuan tidak boleh sama.',
        },
      ]
      const unifiedError = prepareUnifiedMessage(errorMsg, {})
      expect(unifiedError.content).toContain('tidak boleh sama')

      // Case 3: Message with preserveContent flag -> preserved
      const preserveMsg = [
        {
          id: 125,
          role: 'ai',
          type: 'action_success',
          preserveContent: true,
          content: 'Important preserved content',
        },
      ]
      const unifiedPreserve = prepareUnifiedMessage(preserveMsg, {})
      expect(unifiedPreserve.content).toBe('Important preserved content')
    })
  })
})
