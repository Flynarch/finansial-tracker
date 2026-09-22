/**
 * Dexie Schema Migrations & Upgrade Handlers (v1 through v22)
 * Extracted from db.js for modularity and maintainability.
 */

/**
 * Applies all schema versions, upgrades, and ready hooks to the provided Dexie instance.
 * @param {import('dexie').Dexie} db
 */
export function applyMigrations(db) {
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
  }).upgrade(async (trans) => {
    try {
      return await trans.habits.toCollection().modify((habit) => {
        if (!habit.frequencyType) habit.frequencyType = 'daily'
        if (!habit.frequencyValue) habit.frequencyValue = null
        if (!habit.category) habit.category = 'Lainnya'
      })
    } catch (err) {
      console.error('[Dexie DB Migration Error] Version 6 upgrade failed:', err)
      throw err
    }
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
  }).upgrade(async (trans) => {
    try {
      return await trans.habits.toCollection().modify((habit) => {
        if (habit.reminderEnabled === undefined) habit.reminderEnabled = false
        if (habit.reminderTime === undefined) habit.reminderTime = null
      })
    } catch (err) {
      console.error('[Dexie DB Migration Error] Version 7 upgrade failed:', err)
      throw err
    }
  })

  // Version 8 was intentionally skipped during initial development. Dexie supports non-consecutive version numbers.
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
  }).upgrade(async (trans) => {
    try {
      return await trans.todos.toCollection().modify((todo) => {
        if (todo.reminderTime === undefined) todo.reminderTime = null
      })
    } catch (err) {
      console.error('[Dexie DB Migration Error] Version 10 upgrade failed:', err)
      throw err
    }
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

  // Version 17: added tags, split transaction indices, and recurring wallet linkages
  db.version(17).stores({
    transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, isSplit, *tags, [date+type], createdAt',
    investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
    investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
    budgets: '++id, category, limit, month',
    goals: '++id, name, targetAmount, currentAmount, deadline, currency',
    calendarEvents: '++id, date, title, type, color',
    recurringTransactions:
      '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled, walletId, targetWalletId',
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
    loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, interestRate, tenorMonths, monthlyPayment, createdAt',
    loanPayments: '++id, loanId, amount, date, notes, transactionId, createdAt',
  })

  // Version 18: added wallet balance cache table, compound indexes, and splitBillId for Split Bill feature
  db.version(18).stores({
    transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, isSplit, *tags, [date+type], [walletId+date], createdAt',
    investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
    investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
    budgets: '++id, category, limit, month',
    goals: '++id, name, targetAmount, currentAmount, deadline, currency',
    calendarEvents: '++id, date, title, type, color',
    recurringTransactions:
      '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled, walletId, targetWalletId',
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
    loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, interestRate, tenorMonths, monthlyPayment, splitBillId, createdAt',
    loanPayments: '++id, loanId, amount, date, notes, transactionId, [loanId+date], createdAt',
    walletBalanceCache: 'walletId',
  })

  // Version 19: added splitBillId index to transactions table for Split Bill parent transaction lookup
  db.version(19).stores({
    transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, isSplit, *tags, splitBillId, [date+type], [walletId+date], createdAt',
    investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
    investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
    budgets: '++id, category, limit, month',
    goals: '++id, name, targetAmount, currentAmount, deadline, currency',
    calendarEvents: '++id, date, title, type, color',
    recurringTransactions:
      '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled, walletId, targetWalletId',
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
    loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, interestRate, tenorMonths, monthlyPayment, splitBillId, createdAt',
    loanPayments: '++id, loanId, amount, date, notes, transactionId, [loanId+date], createdAt',
    walletBalanceCache: 'walletId',
  })

  // Version 20: added goalId index to transactions table for optimized savings goal transactions lookup
  db.version(20).stores({
    transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, goalId, isSplit, *tags, splitBillId, [date+type], [walletId+date], createdAt',
    investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
    investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
    budgets: '++id, category, limit, month',
    goals: '++id, name, targetAmount, currentAmount, deadline, currency',
    calendarEvents: '++id, date, title, type, color',
    recurringTransactions:
      '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled, walletId, targetWalletId',
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
    loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, interestRate, tenorMonths, monthlyPayment, splitBillId, createdAt',
    loanPayments: '++id, loanId, amount, date, notes, transactionId, [loanId+date], createdAt',
    walletBalanceCache: 'walletId',
  })

  // Version 21: added chatMessages table for AI chat lifecycle retention and local history
  db.version(21).stores({
    transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, goalId, isSplit, *tags, splitBillId, [date+type], [walletId+date], createdAt',
    investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
    investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
    budgets: '++id, category, limit, month',
    goals: '++id, name, targetAmount, currentAmount, deadline, currency',
    calendarEvents: '++id, date, title, type, color',
    recurringTransactions:
      '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled, walletId, targetWalletId',
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
    loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, interestRate, tenorMonths, monthlyPayment, splitBillId, createdAt',
    loanPayments: '++id, loanId, amount, date, notes, transactionId, [loanId+date], createdAt',
    walletBalanceCache: 'walletId',
    chatMessages: '++id, timestamp, role',
  })

  // Version 22: added deletedAt index to transactions table for ledger soft-delete support
  db.version(22).stores({
    transactions: '++id, date, type, category, amount, currency, notes, walletId, targetWalletId, loanId, goalId, isSplit, *tags, splitBillId, deletedAt, [date+type], [walletId+date], createdAt',
    investments: '++id, name, type, quantity, purchasePrice, purchaseCurrency',
    investmentOrders: '++id, date, createdAt, name, type, quantity, unitPrice, totalAmount, currency, fundingSource',
    budgets: '++id, category, limit, month',
    goals: '++id, name, targetAmount, currentAmount, deadline, currency',
    calendarEvents: '++id, date, title, type, color',
    recurringTransactions:
      '++id, title, type, category, amount, currency, notes, frequency, nextDate, enabled, walletId, targetWalletId',
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
    loans: '++id, type, personName, title, totalAmount, remainingAmount, currency, dueDate, startDate, status, notes, walletId, initialTransactionId, paymentTransactionIds, interestRate, tenorMonths, monthlyPayment, splitBillId, createdAt',
    loanPayments: '++id, loanId, amount, date, notes, transactionId, [loanId+date], createdAt',
    walletBalanceCache: 'walletId',
    chatMessages: '++id, timestamp, role',
  }).upgrade(async (trans) => {
    try {
      return await trans.transactions.toCollection().modify((tx) => {
        if (tx.deletedAt === undefined) tx.deletedAt = null
      })
    } catch (err) {
      console.error('[Dexie DB Migration Error] Version 22 upgrade failed:', err)
      throw err
    }
  })

  // Auto-migrate legacy wallet names and auto-purge old soft-deleted transactions (> 90 days)
  db.on('ready', async () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('ft_pre_v22_tx_backup')
      }
    } catch {
      /* ignore */
    }
    try {
      const legacyCashWallets = await db.wallets.filter((w) => w.name === 'Uang Tunai (Cash)').toArray()
      for (const w of legacyCashWallets) {
        await db.wallets.update(w.id, { name: 'Cash' })
      }
    } catch (err) {
      console.error('[db.ready] Could not auto-migrate legacy wallet names:', err)
    }

    try {
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
      let candidates
      try {
        candidates = await db.transactions.where('deletedAt').between(1, cutoff, true, true).toArray()
      } catch (err) {
        console.error('[DB.purgeDeletedTransactions] Index query failed, using filter fallback:', err)
        candidates = await db.transactions.filter((tx) => tx.deletedAt && Number(tx.deletedAt) < cutoff).toArray()
      }
      if (candidates && candidates.length > 0) {
        await db.transactions.bulkDelete(candidates.map((tx) => tx.id))
      }
    } catch (err) {
      console.error('[db.ready] Auto-purge old soft-deleted transactions failed:', err)
    }
  })
}
