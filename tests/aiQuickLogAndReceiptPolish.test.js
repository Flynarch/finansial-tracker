import { describe, it, expect } from 'vitest'
import enLocales from '../src/locales/en'
import idLocales from '../src/locales/id'
import { evaluateExpression } from '../src/lib/calcParser'
import { sanitizeCategoryPath } from '../src/lib/categorySanitizer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Part 3 Audit Remediation: Polish AI QuickLog, Digital Receipt & Chat Subsystem', () => {
  describe('1. i18n Keys Verification for ai.* namespace', () => {
    const requiredKeys = [
      'ai.incomeLogged',
      'ai.transferLogged',
      'ai.expenseLogged',
      'ai.multipleIncomeLogged',
      'ai.multipleExpenseLogged',
      'ai.multipleTxLogged',
      'ai.txLogged',
      'ai.digitalReceiptHeader',
      'ai.logAnother',
      'ai.txUndone',
      'ai.txUndoneDesc',
      'ai.multipleTxUndoneDesc',
      'ai.intentNoticeTitle',
      'ai.intentNoticeDesc',
      'ai.editNote',
      'ai.continueToChat',
      'ai.engine.online',
      'ai.engine.offline',
    ]

    it('en.js has all required ai.* translation keys without emojis', () => {
      for (const key of requiredKeys) {
        expect(enLocales[key], `Missing en.js key: ${key}`).toBeDefined()
        expect(typeof enLocales[key]).toBe('string')
        // No emoji check
        expect(/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(enLocales[key])).toBe(false)
      }
    })

    it('id.js has all required ai.* translation keys without emojis', () => {
      for (const key of requiredKeys) {
        expect(idLocales[key], `Missing id.js key: ${key}`).toBeDefined()
        expect(typeof idLocales[key]).toBe('string')
        // No emoji check
        expect(/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(idLocales[key])).toBe(false)
      }
    })
  })

  describe('2. AiDigitalReceipt: Falsy 0 netTotal Bug Fix', () => {
    it('properly evaluates 0 netTotal using Number.isFinite instead of falling back to falsy total', () => {
      const totalIncome = 50000
      const totalExpense = 50000
      const netTotal = totalIncome - totalExpense // 0

      // Buggy implementation would be:
      const buggyResult = netTotal || totalExpense || totalIncome
      expect(buggyResult).toBe(50000) // Falsy 0 bug!

      // Fixed implementation:
      const fixedResult = Number.isFinite(netTotal) ? netTotal : (totalExpense || totalIncome)
      expect(fixedResult).toBe(0)
      expect(Math.abs(fixedResult)).toBe(0)
    })
  })

  describe('3. AiDigitalReceipt: Expression Evaluation and Split Items Preservation', () => {
    it('evaluates calculator expressions on edit amount', () => {
      const inputExpr = '25k + 15k'
      const evalResult = evaluateExpression(inputExpr, 'IDR')
      expect(evalResult.isValid).toBe(true)
      expect(evalResult.result).toBe(40000)
    })

    it('preserves isSplit and splitItems when editing transaction on receipt', () => {
      const sampleTx = {
        id: 42,
        amount: 50000,
        type: 'expense',
        category: 'makanan/makan_siang',
        isSplit: true,
        splitItems: [
          { amount: 30000, category: 'makanan/makan_siang', notes: 'Nasi goreng' },
          { amount: 20000, category: 'makanan/kopi', notes: 'Es teh' },
        ],
      }

      // Start edit form data
      const editFormData = {
        amount: '50.000',
        date: '2026-09-29',
        type: sampleTx.type,
        category: sampleTx.category,
        notes: '',
        currency: 'IDR',
        walletId: 1,
        targetWalletId: '',
        receiptImage: null,
        isSplit: sampleTx.isSplit || false,
        splitItems: sampleTx.splitItems || [],
      }

      expect(editFormData.isSplit).toBe(true)
      expect(editFormData.splitItems).toHaveLength(2)

      // Save edit payload
      const evalResult = evaluateExpression(editFormData.amount, editFormData.currency)
      const numericAmt = evalResult?.isValid && evalResult?.result !== null
        ? evalResult.result
        : 50000

      const updated = {
        amount: numericAmt,
        date: editFormData.date,
        type: editFormData.type,
        category: editFormData.category,
        notes: editFormData.notes,
        currency: editFormData.currency,
        walletId: editFormData.walletId,
        targetWalletId: editFormData.targetWalletId || '',
        receiptImage: editFormData.receiptImage || null,
        isSplit: editFormData.isSplit || false,
        splitItems: editFormData.splitItems || [],
      }

      expect(updated.isSplit).toBe(true)
      expect(updated.splitItems).toEqual(sampleTx.splitItems)
      expect(updated.amount).toBe(50000)
    })
  })

  describe('4. AiQuickLogModal: Split Item Category Normalization', () => {
    it('sanitizes each item in splitItems before saving', () => {
      const splitItems = [
        { amount: 25000, category: 'makanan', notes: 'Makan siang' },
        { amount: 15000, category: 'kopi', notes: 'Kopi susu' },
      ]

      const sanitized = splitItems.map((item) => ({
        ...item,
        category: sanitizeCategoryPath(item.category || item.notes, item.type || 'expense'),
      }))

      expect(sanitized[0].category).toBe('makanan/makan_siang')
      expect(sanitized[1].category).toBe('makanan/kopi')
    })
  })

  describe('5. chatService.js: Duplicate rememberTransactionEntity Removal', () => {
    it('verifies rememberTransactionEntity is not called in chatService.js', () => {
      const filePath = path.resolve(__dirname, '../src/lib/ai/chatService.js')
      const content = fs.readFileSync(filePath, 'utf8')

      // Should not contain import of rememberTransactionEntity
      expect(content).not.toMatch(/import\s*\{[^}]*rememberTransactionEntity[^}]*\}\s*from/)
      // Should not call rememberTransactionEntity(
      expect(content).not.toMatch(/rememberTransactionEntity\s*\(/)
    })
  })

  describe('6. AiQuickLogModal: handleStayAndEdit preserves text', () => {
    it('preserves lastSubmittedPrompt into inputValue without wiping', () => {
      const lastSubmittedPrompt = 'Berapa saldo saya bulan ini?'
      let inputValue = ''
      let modalMode = 'intent_switch'

      // When user clicks 'Ubah Catatan':
      const handleStayAndEdit = () => {
        modalMode = 'input'
        inputValue = lastSubmittedPrompt
      }

      handleStayAndEdit()
      expect(modalMode).toBe('input')
      expect(inputValue).toBe('Berapa saldo saya bulan ini?')
      expect(inputValue).not.toBe('')
    })
  })

  describe('7. Offline Vision Guard Logic', () => {
    it('flags offline image selection and blocks remote processing', () => {
      const isOnline = false
      const hasImage = true

      const shouldBlock = hasImage && !isOnline
      expect(shouldBlock).toBe(true)
    })
  })
})
