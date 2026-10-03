import { db } from './db'
import { invalidateWalletBalance } from './balanceEngine'
import { clearCachedDashboardState } from '../hooks/useDashboardData'

export async function exportAllDataAsJson() {
  const [
    transactions,
    investments,
    investmentOrders,
    budgets,
    goals,
    goalLogs,
    calendarEvents,
    recurringTransactions,
    settings,
    todos,
    subTasks,
    habits,
    habitLogs,
    notifications,
    wallets,
    loans,
    loanPayments,
    ideas,
    boardLinks,
    chatMessages,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.investments.toArray(),
    db.investmentOrders.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.goalLogs.toArray(),
    db.calendarEvents.toArray(),
    db.recurringTransactions.toArray(),
    db.settings.toArray(),
    db.todos.toArray(),
    db.sub_tasks.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.notifications.toArray(),
    db.wallets.toArray(),
    db.loans.toArray(),
    db.loanPayments.toArray(),
    db.ideas.toArray(),
    db.board_links.toArray(),
    db.chatMessages ? db.chatMessages.toArray().catch(() => []) : Promise.resolve([]),
  ])

  let expenseCustom = null
  let incomeCustom = null
  try {
    if (typeof localStorage !== 'undefined') {
      const rawExp = localStorage.getItem('ft_expense_category_custom_v1')
      if (rawExp) expenseCustom = JSON.parse(rawExp)
      const rawInc = localStorage.getItem('ft_income_category_custom_v1')
      if (rawInc) incomeCustom = JSON.parse(rawInc)
    }
  } catch (err){
      console.warn('[backup]', err)
    /* ignore */
  }

  const sanitizedSettings = (settings || []).map((s) => {
    const copy = { ...s }
    if (copy.lockSecret) {
      delete copy.lockSecret
    }
    if (copy.geminiApiKey) {
      delete copy.geminiApiKey
    }
    return copy
  })

  return {
    exportedAt: new Date().toISOString(),
    app: 'FinTrack',
    version: 3,
    categoryCustomizations: {
      expense: expenseCustom,
      income: incomeCustom,
    },
    data: {
      transactions,
      investments,
      investmentOrders,
      budgets,
      goals,
      goalLogs,
      calendarEvents,
      recurringTransactions,
      settings: sanitizedSettings,
      todos,
      sub_tasks: subTasks,
      habits,
      habitLogs,
      ideas,
      board_links: boardLinks,
      notifications,
      wallets,
      loans,
      loanPayments,
      chatMessages: chatMessages || [],
    },
  }
}

export async function importAllDataFromJsonPayload(payload) {
  const data = (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object')
    ? payload.data
    : (payload && typeof payload === 'object' ? payload : null)
  if (!data || typeof data !== 'object') {
    throw new Error('Format berkas cadangan tidak valid atau data kosong.')
  }

  // 1. Capture current device authentication & security state to prevent session loss or lockout
  const existingSettings = await db.settings.get('preferences').catch(() => null)

  // 2. Clear tables excluding db.settings to preserve active session while updating
  const tablesToClear = db.tables.filter((tbl) => tbl.name !== 'settings')

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(tablesToClear.map((table) => table.clear()))

    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
      const normalizedTxs = data.transactions.map((tx) => ({
        ...tx,
        deletedAt: tx.deletedAt !== undefined ? tx.deletedAt : null,
      }))
      await db.transactions.bulkPut(normalizedTxs)
    }
    if (Array.isArray(data.investments) && data.investments.length > 0) await db.investments.bulkPut(data.investments)
    if (Array.isArray(data.investmentOrders) && data.investmentOrders.length > 0) await db.investmentOrders.bulkPut(data.investmentOrders)
    if (Array.isArray(data.budgets) && data.budgets.length > 0) await db.budgets.bulkPut(data.budgets)
    if (Array.isArray(data.goals) && data.goals.length > 0) await db.goals.bulkPut(data.goals)
    if (Array.isArray(data.goalLogs) && data.goalLogs.length > 0) await db.goalLogs.bulkPut(data.goalLogs)
    if (Array.isArray(data.calendarEvents) && data.calendarEvents.length > 0) await db.calendarEvents.bulkPut(data.calendarEvents)
    if (Array.isArray(data.recurringTransactions) && data.recurringTransactions.length > 0)
      await db.recurringTransactions.bulkPut(data.recurringTransactions)
    if (Array.isArray(data.todos) && data.todos.length > 0) await db.todos.bulkPut(data.todos)
    if (Array.isArray(data.sub_tasks) && data.sub_tasks.length > 0) await db.sub_tasks.bulkPut(data.sub_tasks)
    if (Array.isArray(data.habits) && data.habits.length > 0) {
      const normalizedHabits = data.habits.map((h) => ({
        ...h,
        frequencyType: h.frequencyType || 'daily',
      }))
      await db.habits.bulkPut(normalizedHabits)
    }
    if (Array.isArray(data.habitLogs) && data.habitLogs.length > 0) await db.habitLogs.bulkPut(data.habitLogs)
    if (Array.isArray(data.ideas) && data.ideas.length > 0) await db.ideas.bulkPut(data.ideas)
    if (Array.isArray(data.board_links) && data.board_links.length > 0) await db.board_links.bulkPut(data.board_links)
    if (Array.isArray(data.notifications) && data.notifications.length > 0) await db.notifications.bulkPut(data.notifications)
    if (Array.isArray(data.wallets) && data.wallets.length > 0) {
      const normalizedWallets = data.wallets.map((w) => ({
        ...w,
        isArchived: w.isArchived ? 1 : 0,
      }))
      await db.wallets.bulkPut(normalizedWallets)
    }
    if (Array.isArray(data.loans) && data.loans.length > 0) {
      const normalizedLoans = data.loans.map((l) => ({
        ...l,
        remainingAmount: l.remainingAmount ?? l.totalAmount,
      }))
      await db.loans.bulkPut(normalizedLoans)
    }
    if (Array.isArray(data.loanPayments) && data.loanPayments.length > 0) await db.loanPayments.bulkPut(data.loanPayments)
    if (Array.isArray(data.chatMessages) && data.chatMessages.length > 0 && db.chatMessages) await db.chatMessages.bulkPut(data.chatMessages)

    // Merge settings: preserve active logged-in Google / Email user credentials and device lock
    if (Array.isArray(data.settings) && data.settings.length > 0) {
      const backupSetting = data.settings.find((s) => s.key === 'preferences') || data.settings.find((s) => s.key === 'fintrack_settings_v1') || data.settings[0]
      const merged = {
        ...backupSetting,
        key: 'preferences',
        // Preserve active session if currently signed in, or preserve guest session if currently guest
        authProvider: existingSettings?.authUserId && existingSettings?.authProvider !== 'guest'
          ? existingSettings.authProvider
          : 'guest',
        authUserEmail: existingSettings?.authUserId && existingSettings?.authProvider !== 'guest'
          ? existingSettings.authUserEmail
          : '',
        authUserId: existingSettings?.authUserId && existingSettings?.authProvider !== 'guest'
          ? existingSettings.authUserId
          : '',
        emailVerified: existingSettings?.authUserId && existingSettings?.authProvider !== 'guest'
          ? Boolean(existingSettings.emailVerified)
          : false,
        // Preserve device security configuration if currently enabled
        ...(existingSettings?.securityEnabled && existingSettings?.lockSecret
          ? {
              securityEnabled: existingSettings.securityEnabled,
              securityMethod: existingSettings.securityMethod,
              lockSecret: existingSettings.lockSecret,
              autoLockTimeout: existingSettings.autoLockTimeout,
            }
          : {}),
      }
      await db.settings.put(merged)
    }
  })

  // Apply custom category customizations to localStorage ONLY after Dexie transaction succeeds
  if (payload.categoryCustomizations?.expense) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_expense_category_custom_v1', JSON.stringify(payload.categoryCustomizations.expense))
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ft-expense-category-custom-changed'))
        window.dispatchEvent(new CustomEvent('ft_expense_category_custom_changed'))
      }
    } catch (err){
      console.warn('[backup]', err)
      /* ignore */
    }
  }
  if (payload.categoryCustomizations?.income) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_income_category_custom_v1', JSON.stringify(payload.categoryCustomizations.income))
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ft-income-category-custom-changed'))
        window.dispatchEvent(new CustomEvent('ft_income_category_custom_changed'))
      }
    } catch (err){
      console.warn('[backup]', err)
      /* ignore */
    }
  }

  // Ensure at least one wallet exists if none were in the backup
  const walletCount = await db.wallets.count()
  if (walletCount === 0) {
    const defaultCurrency =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('ft_default_currency') || 'IDR'
        : 'IDR'
    await db.wallets.add({
      name: 'Kas Utama',
      institutionType: 'cash',
      logoUrl: '/logos/wallets/cash.svg',
      currency: defaultCurrency,
      balance: 0,
      createdAt: Date.now(),
    })
  }

  // Clear in-memory caches and invalidate balance engine
  clearCachedDashboardState()
  await invalidateWalletBalance()

  // Dynamically reload store if useSettingsStore is loaded
  try {
    const useSettingsStore = (await import('../store/useSettingsStore')).default
    await useSettingsStore.getState().loadSettings?.()
  } catch (err){
      console.warn('[backup]', err)
    /* ignore */
  }

  // Notify UI of complete restoration
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ft-data-restored'))
    window.dispatchEvent(new CustomEvent('ft_data_restored'))
  }
}

export async function isLocalDataEmpty() {
  const [txCount, walletCount, loanCount, goalCount, budgetCount, invCount] = await Promise.all([
    db.transactions.count().catch(() => 0),
    db.wallets.count().catch(() => 0),
    db.loans.count().catch(() => 0),
    db.goals.count().catch(() => 0),
    db.budgets.count().catch(() => 0),
    db.investments.count().catch(() => 0),
  ])
  if (txCount > 0 || loanCount > 0 || goalCount > 0 || budgetCount > 0 || invCount > 0) {
    return false
  }
  return walletCount <= 1
}

/**
 * Exports all database records into an AES-256-GCM encrypted envelope (.fintrack.enc).
 */
export async function exportAllDataAsEncryptedEnvelope(phrase = '') {
  const cleanPhrase = String(phrase || '').trim()
  if (!cleanPhrase) {
    throw new Error('Frasa pemulihan 12-kata diperlukan untuk mengenkripsi berkas cadangan.')
  }
  const { encryptPayloadWithMnemonic } = await import('./mnemonicCrypto')
  const rawPayload = await exportAllDataAsJson()
  return await encryptPayloadWithMnemonic(rawPayload, cleanPhrase)
}

/**
 * Decrypts and imports an encrypted envelope (.fintrack.enc) into Dexie database.
 */
export async function importAllDataFromEncryptedEnvelope(envelope = {}, phrase = '') {
  const cleanPhrase = String(phrase || '').trim()
  if (!cleanPhrase) {
    throw new Error('Frasa pemulihan 12-kata diperlukan untuk mendekripsi berkas cadangan.')
  }
  const { decryptPayloadWithMnemonic } = await import('./mnemonicCrypto')
  const decryptedPayload = await decryptPayloadWithMnemonic(envelope, cleanPhrase)
  await importAllDataFromJsonPayload(decryptedPayload)
  return decryptedPayload
}
