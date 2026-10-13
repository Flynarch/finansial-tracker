import { db } from './db'
import { invalidateWalletBalance } from './balanceEngine'
import { clearCachedDashboardState } from '../hooks/useDashboardData'
import { scheduleNativeWidgetSync } from './nativeWidgetSync'

export async function exportAllDataAsJson() {
  const tableDataMap = {}
  if (Array.isArray(db.tables)) {
    for (const table of db.tables) {
      if (table.name === 'walletBalanceCache') continue
      try {
        tableDataMap[table.name] = await table.toArray()
      } catch (err) {
        console.warn(`[backup] Error reading table ${table.name}:`, err)
        tableDataMap[table.name] = []
      }
    }
  }

  let expenseCustom = null
  let incomeCustom = null
  let entityMemory = null
  let merchantMemory = null
  let passkeys = null
  let appPreferences = null

  try {
    if (typeof localStorage !== 'undefined') {
      const rawExp = localStorage.getItem('ft_expense_category_custom_v1')
      if (rawExp) expenseCustom = JSON.parse(rawExp)

      const rawInc = localStorage.getItem('ft_income_category_custom_v1')
      if (rawInc) incomeCustom = JSON.parse(rawInc)

      const rawEntity = localStorage.getItem('ft_entity_memory_v1')
      if (rawEntity) entityMemory = JSON.parse(rawEntity)

      const rawMerchant = localStorage.getItem('ft_merchant_memory_v1')
      if (rawMerchant) merchantMemory = JSON.parse(rawMerchant)

      const rawPasskeys = localStorage.getItem('ft_passkeys_v1')
      if (rawPasskeys) passkeys = JSON.parse(rawPasskeys)

      appPreferences = {
        defaultCurrency: localStorage.getItem('ft_default_currency') || 'IDR',
        todoSortPref: localStorage.getItem('todo_sort_pref') || 'latest',
        chatBgTexture: localStorage.getItem('ft_chat_bg_texture') || '',
        networthRange: localStorage.getItem('ft_networth_range') || 'all',
      }
    }
  } catch (err) {
    console.warn('[backup] LocalStorage read warning:', err)
  }

  const rawSettings = tableDataMap.settings || []
  const sanitizedSettings = rawSettings.map((s) => {
    const copy = { ...s }
    if (copy.lockSecret) {
      delete copy.lockSecret
    }
    if (copy.geminiApiKey) {
      delete copy.geminiApiKey
    }
    return copy
  })

  // Ensure all canonical and aliased table keys exist for maximum backward compatibility
  const subTasksData = tableDataMap.sub_tasks || []
  const boardLinksData = tableDataMap.board_links || []

  const data = {
    ...tableDataMap,
    transactions: tableDataMap.transactions || [],
    investments: tableDataMap.investments || [],
    investmentOrders: tableDataMap.investmentOrders || [],
    budgets: tableDataMap.budgets || [],
    goals: tableDataMap.goals || [],
    goalLogs: tableDataMap.goalLogs || [],
    calendarEvents: tableDataMap.calendarEvents || [],
    recurringTransactions: tableDataMap.recurringTransactions || [],
    settings: sanitizedSettings,
    todos: tableDataMap.todos || [],
    sub_tasks: subTasksData,
    subTasks: subTasksData,
    habits: tableDataMap.habits || [],
    habitLogs: tableDataMap.habitLogs || [],
    ideas: tableDataMap.ideas || [],
    board_links: boardLinksData,
    boardLinks: boardLinksData,
    notifications: tableDataMap.notifications || [],
    wallets: tableDataMap.wallets || [],
    loans: tableDataMap.loans || [],
    loanPayments: tableDataMap.loanPayments || [],
    chatMessages: tableDataMap.chatMessages || [],
  }

  return {
    exportedAt: new Date().toISOString(),
    app: 'FinTrack',
    version: 4,
    categoryCustomizations: {
      expense: expenseCustom,
      income: incomeCustom,
    },
    entityMemory,
    merchantMemory,
    passkeys,
    appPreferences,
    data,
  }
}

export async function importAllDataFromJsonPayload(payload) {
  const data = (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object')
    ? payload.data
    : (payload && typeof payload === 'object' ? payload : null)
  if (!data || typeof data !== 'object') {
    throw new Error('Format berkas cadangan tidak valid atau data kosong.')
  }

  // Pre-validation: Prevent accidental database wipe if user provides an encrypted backup
  if (
    payload.isEncrypted ||
    payload.ciphertext ||
    payload.iv ||
    payload.salt ||
    (payload.data && (payload.data.ciphertext || typeof payload.data === 'string')) ||
    (data && (data.ciphertext || data.isEncrypted))
  ) {
    throw new Error('Berkas ini merupakan cadangan terenkripsi. Gunakan menu Pulihkan Cadangan Terenkripsi.')
  }

  // Ensure the payload contains at least some recognized database entities before wiping tables
  const hasRecognizedData = [
    data.transactions,
    data.wallets,
    data.categories,
    data.budgets,
    data.goals,
    data.loans,
    data.habits,
    data.todos,
    data.investments,
    data.settings,
    data.preferences,
    data.categoryCustomizations,
    payload.settings,
    payload.preferences,
    payload.categoryCustomizations,
  ].some((item) => (Array.isArray(item) && item.length > 0) || (item && typeof item === 'object' && Object.keys(item).length > 0))

  if (!hasRecognizedData) {
    throw new Error('Berkas cadangan tidak memuat data transaksi atau dompet yang valid.')
  }

  // 1. Capture current device authentication & security state to prevent session loss or lockout
  const existingSettings = await db.settings.get('preferences').catch(() => null)

  // 2. Clear tables excluding db.settings to preserve active session while updating
  const tablesToClear = db.tables.filter((tbl) => tbl.name !== 'settings')

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(tablesToClear.map((table) => table.clear()))
    await restoreEntityTables(data)
    await restoreSettingsTable(data, existingSettings)
  })

  // Apply custom category customizations to localStorage ONLY after Dexie transaction succeeds
  const expCustom = payload.categoryCustomizations?.expense || data.categoryCustomizations?.expense
  if (expCustom) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_expense_category_custom_v1', JSON.stringify(expCustom))
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ft-expense-category-custom-changed'))
        window.dispatchEvent(new CustomEvent('ft_expense_category_custom_changed'))
      }
    } catch (err){
      console.warn('[backup]', err)
    }
  }

  const incCustom = payload.categoryCustomizations?.income || data.categoryCustomizations?.income
  if (incCustom) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_income_category_custom_v1', JSON.stringify(incCustom))
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ft-income-category-custom-changed'))
        window.dispatchEvent(new CustomEvent('ft_income_category_custom_changed'))
      }
    } catch (err){
      console.warn('[backup]', err)
    }
  }

  // Restore AI Entity Memory
  const entityMemory = payload.entityMemory || data.entityMemory
  if (entityMemory && typeof entityMemory === 'object') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_entity_memory_v1', JSON.stringify(entityMemory))
      }
    } catch (err) {
      console.warn('[backup]', err)
    }
  }

  // Restore AI Merchant Memory
  const merchantMemory = payload.merchantMemory || data.merchantMemory
  if (merchantMemory && typeof merchantMemory === 'object') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_merchant_memory_v1', JSON.stringify(merchantMemory))
      }
    } catch (err) {
      console.warn('[backup]', err)
    }
  }

  // Restore Passkeys
  const passkeys = payload.passkeys || data.passkeys
  if (passkeys && Array.isArray(passkeys)) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ft_passkeys_v1', JSON.stringify(passkeys))
      }
    } catch (err) {
      console.warn('[backup]', err)
    }
  }

  // Restore App Preferences
  const appPreferences = payload.appPreferences || data.appPreferences
  if (appPreferences && typeof appPreferences === 'object') {
    try {
      if (typeof localStorage !== 'undefined') {
        if (appPreferences.defaultCurrency) {
          localStorage.setItem('ft_default_currency', appPreferences.defaultCurrency)
        }
        if (appPreferences.todoSortPref) {
          localStorage.setItem('todo_sort_pref', appPreferences.todoSortPref)
        }
        if (appPreferences.chatBgTexture !== undefined) {
          localStorage.setItem('ft_chat_bg_texture', appPreferences.chatBgTexture)
        }
        if (appPreferences.networthRange) {
          localStorage.setItem('ft_networth_range', appPreferences.networthRange)
        }
      }
    } catch (err) {
      console.warn('[backup]', err)
    }
  }

  // Ensure at least one wallet exists if none were in the backup
  const walletCount = await db.wallets.count()
  if (walletCount === 0) {
    const defaultCurrency =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('ft_default_currency') || 'IDR'
        : 'IDR'
    const fallbackWalletId = await db.wallets.add({
      name: 'Kas Utama',
      institutionType: 'cash',
      logoUrl: '/logos/wallets/cash.svg',
      currency: defaultCurrency,
      balance: 0,
      createdAt: Date.now(),
    })

    // Remap any transactions with missing/orphaned walletId to this fallback wallet
    const orphanedTxs = await db.transactions.filter((tx) => !tx.walletId).toArray()
    if (orphanedTxs.length > 0) {
      await db.transactions.bulkPut(
        orphanedTxs.map((tx) => ({
          ...tx,
          walletId: fallbackWalletId,
        }))
      )
    }
  }

  // Clear in-memory caches and invalidate balance engine
  clearCachedDashboardState()
  await invalidateWalletBalance()
  scheduleNativeWidgetSync()

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

async function restoreEntityTables(data) {
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
  const subTasksList = Array.isArray(data.sub_tasks) && data.sub_tasks.length > 0
    ? data.sub_tasks
    : Array.isArray(data.subTasks) && data.subTasks.length > 0
    ? data.subTasks
    : []
  if (subTasksList.length > 0) await db.sub_tasks.bulkPut(subTasksList)

  if (Array.isArray(data.habits) && data.habits.length > 0) {
    const normalizedHabits = data.habits.map((h) => ({
      ...h,
      frequencyType: h.frequencyType || 'daily',
    }))
    await db.habits.bulkPut(normalizedHabits)
  }
  if (Array.isArray(data.habitLogs) && data.habitLogs.length > 0) await db.habitLogs.bulkPut(data.habitLogs)
  if (Array.isArray(data.ideas) && data.ideas.length > 0) await db.ideas.bulkPut(data.ideas)

  const boardLinksList = Array.isArray(data.board_links) && data.board_links.length > 0
    ? data.board_links
    : Array.isArray(data.boardLinks) && data.boardLinks.length > 0
    ? data.boardLinks
    : []
  if (boardLinksList.length > 0) await db.board_links.bulkPut(boardLinksList)

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

  // Dynamically restore any other registered tables in db
  const handledTables = new Set([
    'transactions', 'investments', 'investmentOrders', 'budgets', 'goals', 'goalLogs',
    'calendarEvents', 'recurringTransactions', 'todos', 'sub_tasks', 'habits', 'habitLogs',
    'ideas', 'board_links', 'notifications', 'wallets', 'loans', 'loanPayments',
    'chatMessages', 'settings', 'walletBalanceCache'
  ])
  for (const tbl of db.tables) {
    if (!handledTables.has(tbl.name)) {
      const rows = data[tbl.name]
      if (Array.isArray(rows) && rows.length > 0) {
        await tbl.bulkPut(rows)
      }
    }
  }
}

async function restoreSettingsTable(data, existingSettings) {
  if (!Array.isArray(data.settings) || data.settings.length === 0) return

  const backupSetting = data.settings.find((s) => s.key === 'preferences') || data.settings.find((s) => s.key === 'fintrack_settings_v1') || data.settings[0]
  const merged = {
    ...backupSetting,
    key: 'preferences',
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
