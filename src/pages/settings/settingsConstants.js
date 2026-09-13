export const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

export const APP_LOCAL_STORAGE_KEYS = [
  'ft_onboarding_seen_v1',
  'ft_onboarding_progress',
  'ft_expense_category_custom_v1',
  'ft_income_category_custom_v1',
  'gold_price_history',
  'gold_history_migrated',
  'gold-spot-samples-v2',
  'gold-spot-1g-idr',
  'usd-idr-fallback-v1',
]

import { clearCachedDashboardState } from '../../hooks/useDashboardData'

/**
 * Clear only financial caches without wiping user authentication, onboarding, or profile state
 */
export function clearFinancialLocalStorage() {
  clearCachedDashboardState()
  if (typeof window === 'undefined') return
  try {
    const keysToRemove = [
      'gold_price_history',
      'gold_history_migrated',
      'gold-spot-samples-v2',
      'gold-spot-1g-idr',
      'usd-idr-fallback-v1',
      'ft_expense_category_custom_v1',
      'ft_income_category_custom_v1',
    ]
    keysToRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    })
  } catch {
    // Ignore localStorage errors during reset.
  }
}

export function clearAppLocalStorage() {
  clearCachedDashboardState()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.clear()
    if (window.sessionStorage) window.sessionStorage.clear()
  } catch {
    // Ignore localStorage errors during reset.
  }
}
