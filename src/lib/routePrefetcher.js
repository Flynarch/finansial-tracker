/**
 * Route Pre-fetcher Module
 * Leverages requestIdleCallback / setTimeout to preload lazy chunk modules
 * during idle moments without degrading initial render performance.
 */

const PREFETCH_MODULES = [
  () => import('../pages/Budget'),
  () => import('../pages/Savings'),
  () => import('../pages/Loans'),
  () => import('../pages/Calendar'),
  () => import('../pages/Reports'),
  () => import('../pages/settings/SettingsLayout'),
  () => import('../pages/settings/SettingsHome'),
  () => import('../pages/settings/SettingsSecurity'),
  () => import('../pages/settings/SettingsCategories'),
  () => import('../pages/settings/SettingsNotifications'),
  () => import('../pages/settings/SettingsData'),
  () => import('../pages/AiFinanceChat'),
]

let isPrefetchingInitiated = false

export function prefetchCriticalRoutes() {
  if (isPrefetchingInitiated) return
  if (typeof window === 'undefined') return

  isPrefetchingInitiated = true

  const runPrefetch = () => {
    let index = 0

    function loadNext() {
      if (index >= PREFETCH_MODULES.length) return

      const loadModule = PREFETCH_MODULES[index]
      index++

      loadModule()
        .then(() => {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(loadNext, { timeout: 2000 })
          } else {
            setTimeout(loadNext, 100)
          }
        })
        .catch(() => {
          // Pre-fetch failure is non-blocking
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(loadNext, { timeout: 2000 })
          } else {
            setTimeout(loadNext, 100)
          }
        })
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadNext, { timeout: 2000 })
    } else {
      setTimeout(loadNext, 300)
    }
  }

  // Start prefetch promptly during browser/WebView idle moments
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(runPrefetch, { timeout: 1500 })
  } else {
    setTimeout(runPrefetch, 400)
  }
}
