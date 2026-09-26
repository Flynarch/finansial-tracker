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
    },
  }
}

export async function importAllDataFromJsonPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('Format berkas cadangan tidak valid atau data kosong.')
  }
  const data = payload.data || {}

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

  // 1. Capture current device authentication & security state to prevent session loss or lockout
  const existingSettings = await db.settings.get('preferences').catch(() => null)

  // 2. Clear tables excluding db.settings to preserve active session while updating
  const tablesToClear = db.tables.filter((tbl) => tbl.name !== 'settings')

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(tablesToClear.map((table) => table.clear()))

    if (Array.isArray(data.transactions) && data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions)
    if (Array.isArray(data.investments) && data.investments.length > 0) await db.investments.bulkAdd(data.investments)
    if (Array.isArray(data.investmentOrders) && data.investmentOrders.length > 0) await db.investmentOrders.bulkAdd(data.investmentOrders)
    if (Array.isArray(data.budgets) && data.budgets.length > 0) await db.budgets.bulkAdd(data.budgets)
    if (Array.isArray(data.goals) && data.goals.length > 0) await db.goals.bulkAdd(data.goals)
    if (Array.isArray(data.goalLogs) && data.goalLogs.length > 0) await db.goalLogs.bulkAdd(data.goalLogs)
    if (Array.isArray(data.calendarEvents) && data.calendarEvents.length > 0) await db.calendarEvents.bulkAdd(data.calendarEvents)
    if (Array.isArray(data.recurringTransactions) && data.recurringTransactions.length > 0)
      await db.recurringTransactions.bulkAdd(data.recurringTransactions)
    if (Array.isArray(data.todos) && data.todos.length > 0) await db.todos.bulkAdd(data.todos)
    if (Array.isArray(data.sub_tasks) && data.sub_tasks.length > 0) await db.sub_tasks.bulkAdd(data.sub_tasks)
    if (Array.isArray(data.habits) && data.habits.length > 0) await db.habits.bulkAdd(data.habits)
    if (Array.isArray(data.habitLogs) && data.habitLogs.length > 0) await db.habitLogs.bulkAdd(data.habitLogs)
    if (Array.isArray(data.ideas) && data.ideas.length > 0) await db.ideas.bulkAdd(data.ideas)
    if (Array.isArray(data.board_links) && data.board_links.length > 0) await db.board_links.bulkAdd(data.board_links)
    if (Array.isArray(data.notifications) && data.notifications.length > 0) await db.notifications.bulkAdd(data.notifications)
    if (Array.isArray(data.wallets) && data.wallets.length > 0) await db.wallets.bulkAdd(data.wallets)
    if (Array.isArray(data.loans) && data.loans.length > 0) await db.loans.bulkAdd(data.loans)
    if (Array.isArray(data.loanPayments) && data.loanPayments.length > 0) await db.loanPayments.bulkAdd(data.loanPayments)

    // Merge settings: preserve active logged-in Google / Email user credentials and device lock
    if (Array.isArray(data.settings) && data.settings.length > 0) {
      const backupSetting = data.settings.find((s) => s.key === 'preferences') || data.settings.find((s) => s.key === 'fintrack_settings_v1') || data.settings[0]
      const merged = {
        ...backupSetting,
        key: 'preferences',
        // Preserve active session if currently signed in
        ...(existingSettings?.authUserId && existingSettings?.authProvider !== 'guest'
          ? {
              authProvider: existingSettings.authProvider,
              authUserEmail: existingSettings.authUserEmail,
              authUserId: existingSettings.authUserId,
              emailVerified: existingSettings.emailVerified,
            }
          : {}),
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
