/**
 * In-memory state cache and range preference helpers for Dashboard data.
 * Prevents skeleton flash and layout shifts on tab switching.
 */

export const getCompactItems = (locale = 'id') => [
  { id: '1d', label: locale === 'en' ? '1D' : '1H' },
  { id: '1w', label: locale === 'en' ? '1W' : '1M' },
  { id: '1m', label: locale === 'en' ? '1M' : '1B' },
  { id: '3m', label: locale === 'en' ? '3M' : '3B' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: locale === 'en' ? '1Y' : '1T' },
  { id: 'all', label: locale === 'en' ? 'ALL' : 'SEMUA' },
]

export const COMPACT_ITEMS = getCompactItems('id')

export const getSavedNetWorthRange = () => {
  try {
    const val = localStorage.getItem('ft_networth_range')
    if (val === 'today') return '1d'
    if (val === 'weekly') return '1w'
    if (val === 'monthly') return '1m'
    if (val === 'yearly') return '1y'
    return val || '1m'
  } catch (err) {
    console.error('[useDashboardData:getSavedNetWorthRange]', err)
    return '1m'
  }
}

// Module-level in-memory cache to eliminate skeleton flash and layout jump on tab switching
export const cachedDashboardState = {
  transactions: null,
  investments: null,
  budgets: null,
  goals: null,
  loans: null,
  wallets: null,
  walletsWithBalance: null,
  rawHabitLogs: null,
  rawHabits: null,
}

export function clearCachedDashboardState() {
  cachedDashboardState.transactions = null
  cachedDashboardState.investments = null
  cachedDashboardState.budgets = null
  cachedDashboardState.goals = null
  cachedDashboardState.loans = null
  cachedDashboardState.wallets = null
  cachedDashboardState.walletsWithBalance = null
  cachedDashboardState.rawHabitLogs = null
  cachedDashboardState.rawHabits = null
}

export function getCachedDashboardTransactions() {
  return cachedDashboardState.transactions
}

export function setCachedDashboardTransactions(transactions) {
  cachedDashboardState.transactions = transactions
}

export function getCachedDashboardWallets() {
  return cachedDashboardState.wallets
}

export function setCachedDashboardWallets(wallets) {
  cachedDashboardState.wallets = wallets
}
