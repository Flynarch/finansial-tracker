import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'
import { hapticImpact } from '../../lib/haptics'
import { backButtonManager } from '../../lib/backButtonManager'
import { getParentRoute } from '../../lib/navigationHierarchy'
import { notifyTodayEvents, processRecurringTransactions } from '../../lib/automation'
import {
  initNotificationChannels,
  syncDailyReminderSchedule,
  registerNotificationTapListener,
} from '../../lib/smartNotifications'
import { syncNotificationQueue } from '../../lib/notificationIngestion'
import { preseedMerchantMemoryFromDb } from '../../lib/ai/merchantCategorizer'
import { prefetchCriticalRoutes } from '../../lib/routePrefetcher'
import { scheduleNativeWidgetSync } from '../../lib/nativeWidgetSync'
import useSettingsStore from '../../store/useSettingsStore'
import useChatStore from '../../store/useChatStore'
import LoadingScreen from '../ui/LoadingScreen'
import LockScreen from '../ui/LockScreen'
import ErrorBoundary from '../ui/ErrorBoundary'
import OnboardingFlow from '../onboarding/OnboardingFlow'
import SpotlightTour from '../onboarding/SpotlightTour'
import BottomNav from './BottomNav'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import AiTriggerBar from '../chat/AiTriggerBar'
import PageSkeleton from '../ui/PageSkeleton'
import useNotificationEngine from '../../hooks/useNotificationEngine'
import InAppNotificationToast from '../notifications/InAppNotificationToast'
import useTransactionStore from '../../store/useTransactionStore'
import useAuthDeepLink from '../../hooks/useAuthDeepLink'

const AiQuickLogModal = lazy(() => import('../chat/AiQuickLogModal'))
const QuickAddTransactionModal = lazy(() => import('../transactions/QuickAddTransactionModal'))
import { primeThemeTransition } from '../../lib/themeTransition'
import { ensureFirebaseAuthSynced } from '../../lib/auth'
import { uploadLatestBackup } from '../../lib/cloudBackup'
import { exportAllDataAsJson, exportAllDataAsEncryptedEnvelope } from '../../lib/backup'
import { getSessionMnemonicPhrase, purgeLegacyMnemonicStorage } from '../../lib/mnemonicCrypto'
import AppBackground from './AppBackground'

/** Resolves a route pathname to the appropriate PageSkeleton variant. */
function getSkeletonVariant(pathname) {
  if (pathname === '/dashboard' || pathname === '/') return 'dashboard'
  if (pathname === '/transactions') return 'transactions'
  if (pathname === '/calendar') return 'calendar'
  if (pathname === '/budget') return 'budget'
  if (pathname === '/reports') return 'reports'
  if (pathname === '/loans') return 'loans'
  if (pathname === '/savings') return 'savings'
  if (pathname.startsWith('/savings/')) return 'savings-detail'
  if (pathname === '/todos') return 'todo'
  if (pathname.startsWith('/todos/')) return 'todo-detail'
  if (pathname === '/profile') return 'profile'
  if (pathname.startsWith('/wallet/')) return 'wallet-detail'
  if (pathname === '/add-account') return 'add-account'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname === '/ai-chat' || pathname === '/chat' || pathname === '/ai-finance') return 'chat'
  return 'generic'
}

function AppShell() {
  useNotificationEngine()
  useAuthDeepLink()
  const theme = useSettingsStore((state) => state.theme)
  const locale = useSettingsStore((state) => state.locale)
  const motionPreference = useSettingsStore((state) => state.motionPreference)
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion)
  const isLoaded = useSettingsStore((state) => state.isLoaded)
  const isUnlocked = useSettingsStore((state) => state.isUnlocked)
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const autoLockTimeout = useSettingsStore((state) => state.autoLockTimeout)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const unlock = useSettingsStore((state) => state.unlock)
  const lock = useSettingsStore((state) => state.lock)
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()

  const historyStack = useRef([])
  const backgroundTimeRef = useRef(null)
  const lastBackPressRef = useRef(0)

  // Hide global navigation & AI trigger bar on dedicated sub-detail pages
  const isDetailPage =
    location.pathname.startsWith('/todos/') ||
    location.pathname.startsWith('/wallet/') ||
    location.pathname.startsWith('/wallets/') ||
    location.pathname.startsWith('/savings/') ||
    location.pathname.startsWith('/settings/') ||
    location.pathname === '/add-account' ||
    location.pathname === '/ai-chat' ||
    location.pathname === '/chat' ||
    location.pathname === '/ai-finance'

  // AI Quick Log states
  const isQuickLogOpen = useChatStore((state) => state.isQuickLogOpen)
  const openQuickLog = useChatStore((state) => state.openQuickLog)

  // Quick Add Transaction states (for widget & deep-link)
  const isQuickAddOpen = useTransactionStore((state) => state.isQuickAddOpen)
  const quickAddNonce = useTransactionStore((state) => state.quickAddNonce)
  const closeQuickAdd = useTransactionStore((state) => state.closeQuickAdd)

  const [hasOpenedQuickLog, setHasOpenedQuickLog] = useState(false)
  const [hasOpenedQuickAdd, setHasOpenedQuickAdd] = useState(false)

  if (isQuickLogOpen && !hasOpenedQuickLog) {
    setHasOpenedQuickLog(true)
  }
  if (isQuickAddOpen && !hasOpenedQuickAdd) {
    setHasOpenedQuickAdd(true)
  }

  useEffect(() => {
    const currentPath = location.pathname
    const currentKey = location.key || 'initial'

    if (navigationType === 'PUSH') {
      historyStack.current.push({ path: currentPath, key: currentKey })
    } else if (navigationType === 'REPLACE') {
      if (historyStack.current.length > 0) {
        historyStack.current[historyStack.current.length - 1] = { path: currentPath, key: currentKey }
      } else {
        historyStack.current.push({ path: currentPath, key: currentKey })
      }
    } else if (navigationType === 'POP') {
      const index = historyStack.current.findIndex((item) => item.key === currentKey)
      if (index !== -1) {
        historyStack.current = historyStack.current.slice(0, index + 1)
      } else {
        historyStack.current = [{ path: currentPath, key: currentKey }]
      }
    } else {
      if (historyStack.current.length === 0) {
        historyStack.current.push({ path: currentPath, key: currentKey })
      }
    }
  }, [location.pathname, location.key, navigationType])

  const pathnameRef = useRef(location.pathname)
  const localeRef = useRef(locale)
  const navigateRef = useRef(navigate)

  useEffect(() => {
    pathnameRef.current = location.pathname
    localeRef.current = locale
    navigateRef.current = navigate
  }, [location.pathname, locale, navigate])

  // Pure Android Hardware Back Button Polish - Registered once without route listener churn
  useEffect(() => {
    const handleBackButton = async () => {
      // 0. Security Guard: If app is locked, prevent underlying route navigation
      const currentSettings = useSettingsStore.getState()
      if (currentSettings.securityEnabled && !currentSettings.isUnlocked) {
        const now = Date.now()
        if (now - lastBackPressRef.current < 2000) {
          await App.exitApp()
        } else {
          lastBackPressRef.current = now
          hapticImpact('light')
          const currentLocale = localeRef.current
          window.dispatchEvent(
            new CustomEvent('ft-show-toast', {
              detail: {
                title: currentLocale === 'en' ? 'Exit App' : 'Keluar Aplikasi',
                message: currentLocale === 'en' ? 'Press back again to exit' : 'Tekan sekali lagi untuk keluar',
                type: 'info',
              },
            }),
          )
        }
        return
      }

      // 1. Check LIFO overlay stack (modals, drawers, popovers, pickers)
      if (backButtonManager.handleBack()) {
        return
      }

      // 2. Hierarchical parent route navigation if on a sub-route
      const currentPath = pathnameRef.current
      const parentRoute = getParentRoute(currentPath)
      if (parentRoute) {
        navigateRef.current(parentRoute)
        return
      }

      // 3. Root screen (/dashboard or /): 2-tap to exit
      const now = Date.now()
      if (now - lastBackPressRef.current < 2000) {
        await App.exitApp()
      } else {
        lastBackPressRef.current = now
        hapticImpact('light')
        const currentLocale = localeRef.current
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: currentLocale === 'en' ? 'Exit App' : 'Keluar Aplikasi',
              message: currentLocale === 'en' ? 'Press back again to exit' : 'Tekan sekali lagi untuk keluar',
              type: 'info',
            },
          }),
        )
      }
    }

    const listenerPromise = App.addListener('backButton', handleBackButton)

    return () => {
      listenerPromise.then((l) => l.remove?.())
    }
  }, [])

  // Native Status Bar Dynamic Color & Contrast Syncing
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const isDark = theme !== 'light' && theme !== 'nordic-light'
    StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch((err) => console.warn('[AppShell]', err))
    StatusBar.setBackgroundColor({ color: isDark ? '#0b0f1a' : '#ffffff' }).catch((err) => console.warn('[AppShell]', err))
  }, [theme])

  // Native Splash Screen Smooth Fade-Out once ready
  useEffect(() => {
    if (isLoaded && Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch((err) => console.warn('[AppShell]', err))
    }
  }, [isLoaded])

  // Anti-Web Context Menu Suppression (Except editable fields)
  useEffect(() => {
    const handleContextMenu = (e) => {
      const tag = e.target?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable
      if (!isInput) {
        e.preventDefault()
      }
    }
    window.addEventListener('contextmenu', handleContextMenu)
    return () => window.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  useEffect(() => {
    loadSettings()
    purgeLegacyMnemonicStorage()
    primeThemeTransition()
  }, [loadSettings])

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'id'
  }, [locale])

  useEffect(() => {
    // Apply theme tokens to the whole document (body uses CSS vars too).
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      const fromSystem = mediaQuery.matches
      const nextReduce = motionPreference === 'reduce' ? true : motionPreference === 'full' ? false : fromSystem
      setReduceMotion(nextReduce)

      if (motionPreference === 'system') {
        document.documentElement.removeAttribute('data-motion')
      } else {
        document.documentElement.setAttribute('data-motion', motionPreference)
      }
    }

    syncMotion()
    const listener = () => syncMotion()
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [motionPreference, setReduceMotion])

  useEffect(() => {
    prefetchCriticalRoutes()
  }, [])

  useEffect(() => {
    const runAutomation = async () => {
      try {
        await processRecurringTransactions()
        await notifyTodayEvents()
        await initNotificationChannels()
        const { dailyReminderEnabled, dailyReminderTime, defaultCurrency, defaultWalletId, notificationAutoApprove } = useSettingsStore.getState()
        if (dailyReminderEnabled) {
          await syncDailyReminderSchedule(true, dailyReminderTime)
        }
        await syncNotificationQueue({ defaultCurrency, defaultWalletId, notificationAutoApprove })
        await preseedMerchantMemoryFromDb().catch(() => {})
      } catch (err){
      console.warn('[AppShell]', err)
        // automation failure should not block app rendering
      }
    }
    runAutomation()
  }, [])

  useEffect(() => {
    scheduleNativeWidgetSync(150)
    let appStateListener = null
    if (Capacitor.isNativePlatform()) {
      appStateListener = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          scheduleNativeWidgetSync(150)
        }
      })
    }
    return () => {
      appStateListener?.then?.((h) => h?.remove?.()).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const unregister = registerNotificationTapListener((route, actionId) => {
      const cleanRoute = route && typeof route === 'string'
        ? (route.startsWith('fintrack://') ? route.replace(/^fintrack:\/\//, '/') : route)
        : null

      if (actionId === 'quick_add' || cleanRoute === '/quick-add' || route === 'fintrack://quick-add') {
        useTransactionStore.getState().openQuickAdd()
      } else if (actionId === 'view_budget' || cleanRoute === '/budget') {
        navigate('/budget')
      } else if (actionId === 'mark_paid') {
        if (cleanRoute) navigate(cleanRoute)
      } else if (cleanRoute) {
        navigate(cleanRoute)
      }
    })
    return () => {
      if (typeof unregister === 'function') unregister()
    }
  }, [navigate])

  // Native Android External Deep Link Listener (Widget clicks, Cold-start shortcuts)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let lastHandledUrl = ''
    let lastHandledTime = 0

    const handleDeepLink = (rawUrl) => {
      if (!rawUrl || typeof rawUrl !== 'string') return
      const now = Date.now()
      if (lastHandledUrl === rawUrl && now - lastHandledTime < 1500) {
        return
      }
      lastHandledUrl = rawUrl
      lastHandledTime = now

      // Auth magic links handled in useAuthDeepLink
      if (rawUrl.includes('apiKey=') || rawUrl.includes('mode=') || rawUrl.includes('auth-callback')) {
        return
      }

      if (rawUrl.includes('quick-add')) {
        useTransactionStore.getState().openQuickAdd()
        return
      }

      const cleanPath = rawUrl.replace(/^fintrack:\/\//, '/')
      if (cleanPath && cleanPath !== rawUrl) {
        navigate(cleanPath)
      }
    }

    App.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) handleDeepLink(launch.url)
      })
      .catch((err) => console.warn('[AppShell]', err))

    const listenerPromise = App.addListener('appUrlOpen', (data) => {
      if (data?.url) handleDeepLink(data.url)
    })

    return () => {
      listenerPromise.then((l) => l.remove?.()).catch((err) => console.warn('[AppShell]', err))
    }
  }, [navigate])

  useEffect(() => {
    // Clear any residual overflow or touchAction locks from unmounted modals/sheets on route change
    if (typeof document !== 'undefined') {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      document.body.style.overscrollBehavior = 'none'
      document.documentElement.style.overflow = ''
      document.documentElement.style.overscrollBehavior = 'none'
    }
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Background auto-lock when security is enabled
  useEffect(() => {
    if (!securityEnabled) return undefined

    const checkAndLock = () => {
      if (backgroundTimeRef.current) {
        const elapsedSec = (Date.now() - backgroundTimeRef.current) / 1000
        if (elapsedSec >= (autoLockTimeout || 0)) {
          lock()
        }
      }
      backgroundTimeRef.current = null
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundTimeRef.current = Date.now()
      } else if (document.visibilityState === 'visible') {
        checkAndLock()
      }
    }

    const handleAppStateChange = (state) => {
      if (!state.isActive) {
        backgroundTimeRef.current = Date.now()
      } else {
        checkAndLock()
        const currentSettings = useSettingsStore.getState()
        syncNotificationQueue({
          defaultCurrency: currentSettings.defaultCurrency,
          defaultWalletId: currentSettings.defaultWalletId,
          notificationAutoApprove: currentSettings.notificationAutoApprove,
        }).catch((err) => console.warn('[AppShell]', err))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    const appListenerPromise = App.addListener('appStateChange', handleAppStateChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      appListenerPromise.then((l) => l.remove?.())
    }
  }, [securityEnabled, autoLockTimeout, lock])

  // Ensure native and web Firebase SDK authentication sessions are aligned on startup
  useEffect(() => {
    ensureFirebaseAuthSynced().catch((err) => console.warn('[AppShell]', err))
  }, [])

  // Auto-sync cloud backup when app transitions to background for authenticated users
  useEffect(() => {
    let isBackingUp = false

    // Scrub legacy plaintext backup caches from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToScrub = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key && (key.startsWith('ft_cloud_backup_cache_') || key.startsWith('ft_user_backup_'))) {
            keysToScrub.push(key)
          }
        }
        keysToScrub.forEach((k) => window.localStorage.removeItem(k))
      }
    } catch (err){
      console.warn('[AppShell]', err)
      /* ignore storage scrub error */
    }

    const handleBackgroundBackup = async () => {
      const state = useSettingsStore.getState()
      if (!state.authUserId || state.authProvider === 'guest' || isBackingUp) return

      try {
        isBackingUp = true
        const backup = await exportAllDataAsJson().catch(() => null)
        if (!backup) return

        const hasData =
          (backup.transactions && backup.transactions.length > 0) ||
          (backup.wallets && backup.wallets.length > 0)
        if (!hasData) return

        const e2eePhrase = getSessionMnemonicPhrase()
        const isE2eeActive = Boolean(e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12)

        if (!isE2eeActive) {
          // Never upload unencrypted data to cloud storage in background auto-backup
          return
        }

        let uploadPayload
        try {
          uploadPayload = await exportAllDataAsEncryptedEnvelope(e2eePhrase.trim())
        } catch (err) {
          console.error('Failed to encrypt backup envelope for E2EE cloud backup, aborting upload to protect privacy:', err)
          return
        }

        await uploadLatestBackup(state.authUserId, uploadPayload, { isEncrypted: true })
      } catch (err){
      console.warn('[AppShell]', err)
        /* ignore background sync network error */
      } finally {
        isBackingUp = false
      }
    }

    const handleAppStateChange = (state) => {
      if (!state.isActive) {
        handleBackgroundBackup().catch((err) => console.warn('[AppShell]', err))
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBackgroundBackup().catch((err) => console.warn('[AppShell]', err))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    const appListenerPromise = App.addListener('appStateChange', handleAppStateChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      appListenerPromise.then((l) => l.remove?.())
    }
  }, [])

  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding)

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (!hasCompletedOnboarding) {
    return (
      <div className="ft-app-shell min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <AppBackground />
        <OnboardingFlow />
      </div>
    )
  }

  return (
    <div className="ft-app-shell min-h-screen text-[var(--fg)]">
      <AppBackground />
      {(location.pathname === '/dashboard' || location.pathname === '/') && <Navbar />}
      <div className="mx-auto flex max-w-7xl">
        <Sidebar />
        {location.pathname === '/ai-chat' || location.pathname === '/chat' || location.pathname === '/ai-finance' ? (
          <Suspense
            fallback={<PageSkeleton variant="chat" />}
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </Suspense>
        ) : (
          <main
            className={`min-h-[calc(100dvh-64px)] flex-1 min-w-0 md:min-h-[calc(100vh-65px)] md:px-6 md:pb-6 md:pt-6 ${
              location.pathname.startsWith('/wallet/') ||
              location.pathname.startsWith('/todos/') ||
              location.pathname.startsWith('/savings/') ||
              location.pathname === '/add-account'
                ? 'px-0 pt-0 pb-12'
                : location.pathname === '/dashboard' || location.pathname === '/'
                ? 'px-4 pt-1 pb-[calc(10rem+env(safe-area-inset-bottom))]'
                : isDetailPage
                ? 'px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-12'
                : 'px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-[calc(10rem+env(safe-area-inset-bottom))]'
            }`}
          >
            <div key={location.pathname} className="ft-page-transition">
              <Suspense
                fallback={<PageSkeleton variant={getSkeletonVariant(location.pathname)} />}
              >
                <ErrorBoundary>
                  <Outlet />
                </ErrorBoundary>
              </Suspense>
            </div>
          </main>
        )}
      </div>
      {!isDetailPage && <BottomNav />}
      <SpotlightTour />
      {securityEnabled && !isUnlocked ? (
        <LockScreen onUnlock={unlock} />
      ) : null}

      <AiTriggerBar
        isVisible={!isDetailPage && !isQuickLogOpen}
        onOpen={openQuickLog}
      />

      <InAppNotificationToast />

      <Suspense fallback={null}>
        {hasOpenedQuickLog && <AiQuickLogModal />}
        {hasOpenedQuickAdd && (
          <QuickAddTransactionModal
            nonce={quickAddNonce}
            isOpen={isQuickAddOpen}
            onClose={closeQuickAdd}
          />
        )}
      </Suspense>
    </div>
  )
}

export default AppShell
