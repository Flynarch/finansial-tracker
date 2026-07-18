import { db } from './db'

export async function exportAllDataAsJson() {
  const [
    transactions,
    investments,
    investmentOrders,
    budgets,
    goals,
    calendarEvents,
    recurringTransactions,
    settings,
    todos,
    subTasks,
    habits,
    habitLogs,
    ideas,
    boardLinks,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.investments.toArray(),
    db.investmentOrders.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.calendarEvents.toArray(),
    db.recurringTransactions.toArray(),
    db.settings.toArray(),
    db.todos.toArray(),
    db.sub_tasks.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.ideas.toArray(),
    db.board_links.toArray(),
  ])

  return {
    exportedAt: new Date().toISOString(),
    app: 'FinTrack',
    version: 2,
    data: {
      transactions,
      investments,
      investmentOrders,
      budgets,
      goals,
      calendarEvents,
      recurringTransactions,
      settings,
      todos,
      sub_tasks: subTasks,
      habits,
      habitLogs,
      ideas,
      board_links: boardLinks,
    },
  }
}

export async function importAllDataFromJsonPayload(payload) {
  const parsed = payload && typeof payload === 'object' ? payload : {}
  const data = parsed.data || {}

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))

    if (Array.isArray(data.transactions) && data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions)
    if (Array.isArray(data.investments) && data.investments.length > 0) await db.investments.bulkAdd(data.investments)
    if (Array.isArray(data.investmentOrders) && data.investmentOrders.length > 0) await db.investmentOrders.bulkAdd(data.investmentOrders)
    if (Array.isArray(data.budgets) && data.budgets.length > 0) await db.budgets.bulkAdd(data.budgets)
    if (Array.isArray(data.goals) && data.goals.length > 0) await db.goals.bulkAdd(data.goals)
    if (Array.isArray(data.calendarEvents) && data.calendarEvents.length > 0) await db.calendarEvents.bulkAdd(data.calendarEvents)
    if (Array.isArray(data.recurringTransactions) && data.recurringTransactions.length > 0)
      await db.recurringTransactions.bulkAdd(data.recurringTransactions)
    if (Array.isArray(data.settings) && data.settings.length > 0) await db.settings.bulkPut(data.settings)
    if (Array.isArray(data.todos) && data.todos.length > 0) await db.todos.bulkAdd(data.todos)
    if (Array.isArray(data.sub_tasks) && data.sub_tasks.length > 0) await db.sub_tasks.bulkAdd(data.sub_tasks)
    if (Array.isArray(data.habits) && data.habits.length > 0) await db.habits.bulkAdd(data.habits)
    if (Array.isArray(data.habitLogs) && data.habitLogs.length > 0) await db.habitLogs.bulkAdd(data.habitLogs)
    if (Array.isArray(data.ideas) && data.ideas.length > 0) await db.ideas.bulkAdd(data.ideas)
    if (Array.isArray(data.board_links) && data.board_links.length > 0) await db.board_links.bulkAdd(data.board_links)
  })
}

export async function isLocalDataEmpty() {
  const counts = await Promise.all(db.tables.map((table) => table.count()))
  return counts.reduce((acc, c) => acc + c, 0) === 0
}

