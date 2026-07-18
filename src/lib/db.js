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
