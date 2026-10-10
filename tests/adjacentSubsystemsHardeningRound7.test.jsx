// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/lib/db'
import { importAllDataFromJsonPayload } from '../src/lib/backup'
import { deleteTransaction, updateTransaction } from '../src/services/transactionService'
import { generateCashFlowStatement } from '../src/lib/accountingEngine'
import { isFinancialMutation } from '../src/lib/notifications/parsers/antiSpamGuard'
import { parseWithBankRegex } from '../src/lib/notifications/parsers/bankParsers'
import { parseWithWalletRegex } from '../src/lib/notifications/parsers/walletParsers'
import { correlateInternalTransfers } from '../src/lib/notifications/parsers/walletMatcher'
import { formatMoneyInput, parseMoneyInput, formatMoneyValueForInput } from '../src/lib/utils'

describe('Adjacent Subsystems Hardening - Round 7', () => {
  beforeEach(async () => {
    await db.transactions.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.loanPayments.clear()
    await db.investments.clear()
    await db.investmentOrders.clear()
  })

  // F7-08: Encrypted backup rejected before table clear
  it('F7-08: rejects encrypted backup payload without clearing existing database tables', async () => {
    await db.wallets.add({ id: 1, name: 'Kas Pribadi', balance: 500000, currency: 'IDR' })
    await db.transactions.add({ id: 1, walletId: 1, amount: 25000, type: 'expense', date: '2026-03-01' })

    const encryptedPayload = {
      isEncrypted: true,
      ciphertext: 'U2FsdGVkX19abcdef123456',
      iv: '1234567890abcdef',
      salt: 'fedcba0987654321',
    }

    await expect(importAllDataFromJsonPayload(encryptedPayload)).rejects.toThrow(
      'Berkas ini merupakan cadangan terenkripsi. Gunakan menu Pulihkan Cadangan Terenkripsi.'
    )

    // Verify existing tables were NOT wiped
    const walletCount = await db.wallets.count()
    const txCount = await db.transactions.count()
    expect(walletCount).toBe(1)
    expect(txCount).toBe(1)
  })

  // F7-09: Remap orphaned transactions when creating fallback wallet
  it('F7-09: remaps orphaned transactions missing walletId to fallback Kas Utama wallet on restore', async () => {
    const legacyPayload = {
      data: {
        transactions: [
          { id: 101, amount: 15000, type: 'expense', walletId: null, date: '2026-01-01' },
          { id: 102, amount: 20000, type: 'income', walletId: null, date: '2026-01-02' },
        ],
        wallets: [],
      },
    }

    await importAllDataFromJsonPayload(legacyPayload)

    const wallets = await db.wallets.toArray()
    expect(wallets.length).toBe(1)
    expect(wallets[0].name).toBe('Kas Utama')

    const txs = await db.transactions.toArray()
    expect(txs.length).toBe(2)
    expect(txs[0].walletId).toBe(wallets[0].id)
    expect(txs[1].walletId).toBe(wallets[0].id)
  })

  // F7-04 & F7-05: Investment buy deletion recalculates holding purchasePrice
  it('F7-05: recalculates holding weighted average price when a buy order is deleted', async () => {
    const holdingId = await db.investments.add({
      name: 'BBCA',
      type: 'Saham',
      quantity: 200,
      purchasePrice: 9500,
      purchaseCurrency: 'IDR',
    })

    await db.investmentOrders.add({
      side: 'buy',
      name: 'BBCA',
      type: 'Saham',
      quantity: 100,
      unitPrice: 9000,
      totalAmount: 900000,
      currency: 'IDR',
    })

    const order2 = await db.investmentOrders.add({
      side: 'buy',
      name: 'BBCA',
      type: 'Saham',
      quantity: 100,
      unitPrice: 10000,
      totalAmount: 1000000,
      currency: 'IDR',
    })

    const tx2 = await db.transactions.add({
      type: 'expense',
      category: 'investasi/beli_saham',
      amount: 1000000,
      investmentId: holdingId,
      investmentOrderId: order2,
      date: '2026-03-02',
    })

    // Delete tx2 (order2 at 10000)
    await deleteTransaction(tx2)

    const updatedHolding = await db.investments.get(holdingId)
    expect(updatedHolding).toBeDefined()
    expect(updatedHolding.quantity).toBe(100)
    // Only order1 (price: 9000) remains, so purchasePrice must be updated to 9000
    expect(updatedHolding.purchasePrice).toBe(9000)
  })

  // F7-06: Satoshi precision threshold (1e-8) for crypto balances
  it('F7-06: preserves small crypto balances down to satoshi precision without accidental deletion', async () => {
    const cryptoHoldingId = await db.investments.add({
      name: 'BTC',
      type: 'Crypto',
      quantity: 0.000005, // 500 satoshis
      purchasePrice: 1000000000,
      purchaseCurrency: 'IDR',
    })

    const order = await db.investmentOrders.add({
      side: 'buy',
      name: 'BTC',
      type: 'Crypto',
      quantity: 0.000004, // 400 satoshis sold/adjusted
      unitPrice: 1000000000,
      totalAmount: 4000,
      currency: 'IDR',
    })

    const tx = await db.transactions.add({
      type: 'expense',
      category: 'investasi/kripto',
      amount: 4000,
      investmentId: cryptoHoldingId,
      investmentOrderId: order,
      date: '2026-03-01',
    })

    await deleteTransaction(tx)

    // 0.000005 - 0.000004 = 0.000001 BTC (100 satoshis), greater than 1e-8
    const holding = await db.investments.get(cryptoHoldingId)
    expect(holding).toBeDefined()
    expect(holding.quantity).toBeCloseTo(0.000001, 8)
  })

  // F7-14: Updating transaction amount updates investment valuation
  it('F7-14: synchronizes investment holding purchasePrice when updating buy transaction amount', async () => {
    const holdingId = await db.investments.add({
      name: 'TLKM',
      type: 'Saham',
      quantity: 100,
      purchasePrice: 3000,
      purchaseCurrency: 'IDR',
    })

    const orderId = await db.investmentOrders.add({
      side: 'buy',
      name: 'TLKM',
      type: 'Saham',
      quantity: 100,
      unitPrice: 3000,
      totalAmount: 300000,
      currency: 'IDR',
    })

    const txId = await db.transactions.add({
      type: 'expense',
      category: 'investasi/beli_saham',
      amount: 300000,
      investmentId: holdingId,
      investmentOrderId: orderId,
      date: '2026-03-01',
    })

    await updateTransaction(txId, {
      amount: 350000,
    })

    const updatedHolding = await db.investments.get(holdingId)
    expect(updatedHolding.purchasePrice).toBe(3500)

    const updatedOrder = await db.investmentOrders.get(orderId)
    expect(updatedOrder.totalAmount).toBe(350000)
    expect(updatedOrder.unitPrice).toBe(3500)
  })

  // F7-03: Talangan split bill transaction deletion guard
  it('F7-03: protects talangan transaction deletion while linked participant loans exist, and permits deletion once unlinked', async () => {
    const splitBillId = 'sb-test-123'
    const parentTxId = await db.transactions.add({
      type: 'expense',
      category: 'Talangan',
      isTalangan: true,
      amount: 150000,
      splitBillId,
      date: '2026-03-01',
    })

    const loanId = await db.loans.add({
      splitBillId,
      initialTransactionId: parentTxId,
      personName: 'Andi',
      totalAmount: 75000,
      remainingAmount: 0,
      status: 'paid',
    })

    // Strict guard: prevents deletion while participant loans exist
    await expect(deleteTransaction(parentTxId)).rejects.toThrow(
      /memiliki catatan pinjaman partisipan/i
    )

    // Once participant loans are removed/unlinked (e.g. deleted from Loan module)
    await db.loans.delete(loanId)
    await expect(deleteTransaction(parentTxId)).resolves.not.toThrow()

    // Transaction soft-deleted
    const deletedTx = await db.transactions.get(parentTxId)
    expect(deletedTx.deletedAt).toBeDefined()
  })

  // F7-13: Cash Flow Statement includes Investing & Financing with isExcludeAnalyticsTx
  it('F7-13: includes investing and financing cash flows in Cash Flow Statement even when isExcludeAnalyticsTx is true', () => {
    const transactions = [
      {
        id: 1,
        type: 'income',
        category: 'Gaji',
        amount: 10000000,
        currency: 'IDR',
        date: '2026-03-01',
        isExcludeAnalyticsTx: false,
      },
      {
        id: 2,
        type: 'expense',
        category: 'Investasi Saham',
        amount: 2000000,
        currency: 'IDR',
        date: '2026-03-02',
        isExcludeAnalyticsTx: true, // Marked to exclude from operating monthly charts
      },
      {
        id: 3,
        type: 'income',
        category: 'Pinjaman Diterima',
        amount: 5000000,
        currency: 'IDR',
        date: '2026-03-03',
        loanId: 10,
        isExcludeAnalyticsTx: true,
      },
    ]

    const cf = generateCashFlowStatement(transactions, {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      defaultCurrency: 'IDR',
      rates: {},
      includeNonAnalyticInCashFlow: true,
    })

    expect(cf.operatingActivities.inflow).toBe(10000000)
    expect(cf.investingActivities.outflow).toBe(2000000)
    expect(cf.investingActivities.net).toBe(-2000000)
    expect(cf.financingActivities.inflow).toBe(5000000)
    expect(cf.financingActivities.net).toBe(5000000)
    expect(cf.netChangeInCash).toBe(13000000) // 10M - 2M + 5M = 13M
  })

  // F7-10 & F7-11: Anti-Spam guardrails
  it('F7-10: recognizes banking DB/CR SMS formats without requiring explicit Rp token', () => {
    const bcaSms = 'm-BCA: 09/10 TRSF E-BANKING DB 50.000,00 1234567890 ANDI'
    expect(isFinancialMutation('SMS BCA', bcaSms, 'com.bca')).toBe(true)
  })

  it('F7-11: does not reject legitimate transaction receipts that include applied discount details', () => {
    const receiptNotification = 'Pembayaran sebesar Rp 45.000 berhasil di Kopi Kenangan. Diskon Rp 5.000 digunakan.'
    expect(isFinancialMutation('ShopeePay', receiptNotification, 'com.shopee.id')).toBe(true)
  })

  // F7-12: Incoming "Transfer ke rekening Anda" recognized as income
  it('F7-12: classifies "Transfer ke rekening Anda" as income across bank parsers', () => {
    const notifBca = 'BCA: Transfer ke rekening Anda sebesar Rp 250.000 dari BUDI WIJAYA'
    const parsedBca = parseWithBankRegex('BCA Mobile', notifBca, 'com.bca')
    expect(parsedBca).not.toBeNull()
    expect(parsedBca.type).toBe('income')
    expect(parsedBca.amount).toBe(250000)

    const notifMandiri = 'Livin by Mandiri: Transfer ke rekening Anda sebesar Rp 150.000 dari SITI'
    const parsedMandiri = parseWithBankRegex('Livin', notifMandiri, 'com.bankmandiri.mandirimai')
    expect(parsedMandiri).not.toBeNull()
    expect(parsedMandiri.type).toBe('income')
    expect(parsedMandiri.amount).toBe(150000)
  })

  // F7-16: IDR currency token matched across parsers
  it('F7-16: parses transaction amounts formatted with IDR currency token in bank & wallet parsers', () => {
    const gopayNotif = 'GoPay: Pembayaran IDR 35.000 di Alfamart berhasil'
    const parsedGopay = parseWithWalletRegex('GoPay', gopayNotif, 'com.gojek.app')
    expect(parsedGopay).not.toBeNull()
    expect(parsedGopay.amount).toBe(35000)

    const seabankNotif = 'SeaBank: Kamu menerima transfer IDR 120.000 dari Rian'
    const parsedSeabank = parseWithBankRegex('SeaBank', seabankNotif, 'com.seabank.id')
    expect(parsedSeabank).not.toBeNull()
    expect(parsedSeabank.amount).toBe(120000)
  })

  // F7-17: Correlate internal transfers cross-currency preserves targetAmount
  it('F7-17: preserves targetAmount on correlated internal transfers between different currencies', () => {
    const outgoing = {
      institution: 'Wise',
      amount: 100,
      currency: 'USD',
      type: 'expense',
      date: '2026-03-01',
      createdAt: 1000,
      sourceNotifId: 'notif-1',
    }
    const incoming = {
      institution: 'BCA',
      amount: 1600000,
      currency: 'IDR',
      type: 'income',
      date: '2026-03-01',
      createdAt: 1050,
      sourceNotifId: 'notif-2',
    }
    const wallets = [
      { id: 1, name: 'Wise USD', currency: 'USD' },
      { id: 2, name: 'BCA IDR', currency: 'IDR' },
    ]

    const { correlated, transfersCreated } = correlateInternalTransfers([outgoing, incoming], wallets, false)
    expect(transfersCreated).toBe(1)
    expect(correlated.length).toBe(1)
    expect(correlated[0].type).toBe('transfer')
    expect(correlated[0].amount).toBe(100)
    expect(correlated[0].currency).toBe('USD')
    expect(correlated[0].targetAmount).toBe(1600000)
    expect(correlated[0].targetCurrency).toBe('IDR')
  })

  // F7-18: Zero-decimal currencies in formatMoneyInput and parseMoneyInput
  it('F7-18: formats and parses zero-decimal currencies (JPY, KRW, VND) without decimal fractions', () => {
    // JPY
    expect(formatMoneyInput('1500', 'JPY')).toBe('1.500')
    expect(formatMoneyInput('1500.50', 'JPY')).toBe('150.050') // integers only
    expect(parseMoneyInput('1.500', 'JPY')).toBe(1500)
    expect(formatMoneyValueForInput(1500, 'JPY')).toBe('1.500')

    // KRW
    expect(formatMoneyInput('50000', 'KRW')).toBe('50.000')
    expect(parseMoneyInput('50.000', 'KRW')).toBe(50000)
    expect(formatMoneyValueForInput(50000, 'KRW')).toBe('50.000')

    // VND
    expect(formatMoneyInput('250000', 'VND')).toBe('250.000')
    expect(parseMoneyInput('250.000', 'VND')).toBe(250000)
    expect(formatMoneyValueForInput(250000, 'VND')).toBe('250.000')
  })
})
