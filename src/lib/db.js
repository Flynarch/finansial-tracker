import Dexie from 'dexie'
import { convertCurrency } from './utils'

export const db = new Dexie('fintrackDB')

db.version(1).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  settings: 'key',
})

db.version(2).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
})

db.version(3).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
})

db.version(4).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, createdAt',
  sub_tasks: '++id, todoId, label, checked',
})

db.version(5).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, createdAt',
  habitLogs: '++id, habitId, date', // date as string YYYY-MM-DD
})

db.version(6).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, createdAt',
  habitLogs: '++id, habitId, date',
}).upgrade((trans) => {
  return trans.habits.toCollection().modify(habit => {
    if (!habit.frequencyType) habit.frequencyType = 'daily'
    if (!habit.frequencyValue) habit.frequencyValue = null
    if (!habit.category) habit.category = 'Lainnya'
  })
})

db.version(7).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, createdAt',
  habitLogs: '++id, habitId, date',
}).upgrade((trans) => {
  return trans.habits.toCollection().modify(habit => {
    if (habit.reminderEnabled === undefined) habit.reminderEnabled = false
    if (habit.reminderTime === undefined) habit.reminderTime = null
  })
})

db.version(9).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
})

db.version(10).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
}).upgrade((trans) => {
  return trans.todos.toCollection().modify(todo => {
    if (todo.reminderTime === undefined) todo.reminderTime = null
  })
})

db.version(11).stores({
  transactions: '++id, date, type, category, amount, currency, notes',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
  goalLogs: '++id, goalId, amount, date',
})

db.version(12).stores({
  transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
  goalLogs: '++id, goalId, amount, date',
  wallets: '++id, name, institutionType, logoUrl, currency, balance, createdAt',
})

// Version 13: added compound index [date+type] on transactions for efficient
// date-range queries filtered by type (income/expense) without full table scans.
db.version(13).stores({
  transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, [date+type], createdAt',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
  goalLogs: '++id, goalId, amount, date',
  wallets: '++id, name, institutionType, logoUrl, currency, balance, createdAt',
})

// Version 14: added isArchived index to wallets for wallet archiving support
db.version(14).stores({
  transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, [date+type], createdAt',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
  goalLogs: '++id, goalId, amount, date',
  wallets: '++id, name, institutionType, logoUrl, currency, balance, isArchived, createdAt',
})

// Version 15: added loans and loanPayments tables for Loans & Debts tracker
db.version(15).stores({
  transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, [date+type], createdAt',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
  goalLogs: '++id, goalId, amount, date',
  wallets: '++id, name, institutionType, logoUrl, currency, balance, isArchived, createdAt',
  loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, createdAt',
  loanPayments: '++id, loanId, amount, date, notes, createdAt',
})

// Version 16: added wallet linkage indices for loans, loanPayments, and transactions
db.version(16).stores({
  transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, [date+type], createdAt',
  investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
  investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
  budgets: '++id, category, limit, month',
  goals: '++id, name, targetAmount, currentAmount, deadline, currency',
  calendarEvents: '++id, date, title, type, color',
  recurringTransactions:
    '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled',
  settings: 'key',
  todos: '++id, title, category, dueDate, priority, completed, reminderTime, createdAt',
  sub_tasks: '++id, todoId, label, checked',
  habits: '++id, title, color, category, frequencyType, frequencyValue, reminderEnabled, reminderTime, notes, createdAt',
  habitLogs: '++id, habitId, date',
  ideas: '++id, type, content, color, x, y, createdAt',
  board_links: '++id, sourceId, targetId',
  notifications: '++id, type, title, message, read, relatedId, createdAt',
  goalLogs: '++id, goalId, amount, date',
  wallets: '++id, name, institutionType, logoUrl, currency, balance, isArchived, createdAt',
  loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, createdAt',
  loanPayments: '++id, loanId, amount, date, notes, transactionId, createdAt',
})

// Auto-migrate legacy wallet names (e.g. "Uang Tunai (Cash)" -> "Cash")
db.on('ready', async () => {
  try {
    const legacyCashWallets = await db.wallets.filter((w) => w.name === 'Uang Tunai (Cash)').toArray()
    for (const w of legacyCashWallets) {
      await db.wallets.update(w.id, { name: 'Cash' })
    }
  } catch {
    // Ignore error if database not ready
  }
})



/**
 * Compute the current balance of a wallet dynamically.
 *
 * wallet.balance = saldo awal (initial balance saat wallet dibuat).
 *
 * Current balance = saldo awal
 *   + SUM(income transactions where walletId = id)        -> +amount
 *   - SUM(expense transactions where walletId = id)       -> -amount
 *   + SUM(transfer-in: targetWalletId = id)               -> +amount
 *   - SUM(transfer-out: walletId = id AND type=transfer)  -> -amount
 *   + SUM(balance_adjustment where walletId = id)         -> +amount (already signed)
 */
/**
 * Compute the current balance of a single wallet given its initial balance and transaction list.
 * Single source of truth formula for computing a wallet's current balance.
 */
export function computeWalletBalance(wallet, transactions = [], rates = null) {
  if (!wallet) return 0
  let bal = Number(wallet.balance) || 0
  const walletIdStr = String(wallet.id)
  const walletCurrency = wallet.currency || 'IDR'

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0
    const txCurrency = tx.currency || walletCurrency
    const converted =
      txCurrency === walletCurrency
        ? amount
        : convertCurrency(amount, txCurrency, walletCurrency, rates || {})

    if (String(tx.walletId) === walletIdStr) {
      if (tx.type === 'income') bal += converted
      else if (tx.type === 'expense') bal -= converted
      else if (tx.type === 'transfer') bal -= converted
      else if (tx.type === 'balance_adjustment') bal += converted
    }
    if (String(tx.targetWalletId) === walletIdStr) {
      if (tx.type === 'transfer') {
        bal += converted
      }
    }
  }
  return bal
}

/**
 * Compute current balances for ALL wallets given wallet list and transaction list.
 * Returns a List of wallets with currentBalance property attached.
 */
export function computeAllWalletBalances(wallets = [], transactions = [], rates = null) {
  const balanceMap = new Map()
  const currencyMap = new Map()

  for (const w of wallets) {
    const idKey = String(w.id)
    balanceMap.set(idKey, Number(w.balance) || 0)
    currencyMap.set(idKey, w.currency || 'IDR')
  }

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0
    const wId = tx.walletId != null ? String(tx.walletId) : null
    const tId = tx.targetWalletId != null ? String(tx.targetWalletId) : null

    if (wId && balanceMap.has(wId)) {
      const sourceCurrency = currencyMap.get(wId) || 'IDR'
      const txCurrency = tx.currency || sourceCurrency
      const converted =
        txCurrency === sourceCurrency
          ? amount
          : convertCurrency(amount, txCurrency, sourceCurrency, rates || {})

      if (tx.type === 'income') {
        balanceMap.set(wId, balanceMap.get(wId) + converted)
      } else if (tx.type === 'expense') {
        balanceMap.set(wId, balanceMap.get(wId) - converted)
      } else if (tx.type === 'transfer') {
        balanceMap.set(wId, balanceMap.get(wId) - converted)
      } else if (tx.type === 'balance_adjustment') {
        balanceMap.set(wId, balanceMap.get(wId) + converted)
      }
    }

    if (tId && balanceMap.has(tId)) {
      const targetCurrency = currencyMap.get(tId) || 'IDR'
      const txCurrency = tx.currency || (wId ? currencyMap.get(wId) : targetCurrency) || targetCurrency
      const converted =
        txCurrency === targetCurrency
          ? amount
          : convertCurrency(amount, txCurrency, targetCurrency, rates || {})
      balanceMap.set(tId, balanceMap.get(tId) + converted)
    }
  }

  return wallets.map((w) => ({
    ...w,
    currentBalance: balanceMap.get(String(w.id)) ?? (Number(w.balance) || 0),
  }))
}

export async function getWalletCurrentBalance(walletId) {
  const wallet = await db.wallets.get(walletId)
  if (!wallet) return 0

  const [sourceTxs, targetTxs] = await Promise.all([
    db.transactions.where('walletId').equals(walletId).toArray(),
    db.transactions.where('targetWalletId').equals(walletId).toArray(),
  ])

  const txMap = new Map()
  sourceTxs.forEach((tx) => txMap.set(tx.id, tx))
  targetTxs.forEach((tx) => txMap.set(tx.id, tx))
  const allTxs = Array.from(txMap.values())

  return computeWalletBalance(wallet, allTxs)
}

export async function getAllWalletBalances() {
  const [wallets, allTxs] = await Promise.all([
    db.wallets.toArray(),
    db.transactions.toArray(),
  ])
  return computeAllWalletBalances(wallets, allTxs)
}
