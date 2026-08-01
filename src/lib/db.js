import Dexie from 'dexie'

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
export function computeWalletBalance(wallet, transactions = []) {
  if (!wallet) return 0
  let bal = Number(wallet.balance) || 0
  const walletId = wallet.id

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0
    if (tx.walletId === walletId) {
      if (tx.type === 'income') bal += amount
      else if (tx.type === 'expense') bal -= amount
      else if (tx.type === 'transfer') bal -= amount
      else if (tx.type === 'balance_adjustment') bal += amount
    }
    if (tx.targetWalletId === walletId) {
      if (tx.type === 'transfer') bal += amount
    }
  }
  return bal
}

/**
 * Compute current balances for ALL wallets given wallet list and transaction list.
 * Returns a List of wallets with currentBalance property attached.
 */
export function computeAllWalletBalances(wallets = [], transactions = []) {
  const balanceMap = new Map()

  for (const w of wallets) {
    balanceMap.set(w.id, Number(w.balance) || 0)
  }

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0
    const wId = tx.walletId
    const tId = tx.targetWalletId

    if (wId && balanceMap.has(wId)) {
      if (tx.type === 'income') {
        balanceMap.set(wId, balanceMap.get(wId) + amount)
      } else if (tx.type === 'expense') {
        balanceMap.set(wId, balanceMap.get(wId) - amount)
      } else if (tx.type === 'transfer') {
        balanceMap.set(wId, balanceMap.get(wId) - amount)
      } else if (tx.type === 'balance_adjustment') {
        balanceMap.set(wId, balanceMap.get(wId) + amount)
      }
    }

    if (tId && balanceMap.has(tId)) {
      balanceMap.set(tId, balanceMap.get(tId) + amount)
    }
  }

  return wallets.map(w => ({
    ...w,
    currentBalance: balanceMap.get(w.id) ?? (Number(w.balance) || 0),
  }))
}

export async function getWalletCurrentBalance(walletId) {
  const wallet = await db.wallets.get(walletId)
  if (!wallet) return 0

  const allTxs = await db.transactions
    .where('walletId').equals(walletId)
    .or('targetWalletId').equals(walletId)
    .toArray()

  return computeWalletBalance(wallet, allTxs)
}

export async function getAllWalletBalances() {
  const wallets = await db.wallets.toArray()
  const allTxs = await db.transactions.toArray()
  return computeAllWalletBalances(wallets, allTxs)
}
