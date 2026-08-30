import { useEffect, useRef } from 'react'
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
import useSettingsStore from '../../store/useSettingsStore'
import useChatStore from '../../store/useChatStore'
import LoadingScreen from '../ui/LoadingScreen'
import LockScreen from '../ui/LockScreen'
import OnboardingFlow from '../onboarding/OnboardingFlow'
import SpotlightTour from '../onboarding/SpotlightTour'
import BottomNav from './BottomNav'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import AiTriggerBar from '../chat/AiTriggerBar'
import AiQuickLogModal from '../chat/AiQuickLogModal'
import useNotificationEngine from '../../hooks/useNotificationEngine'
import InAppNotificationToast from '../notifications/InAppNotificationToast'
import useAuthDeepLink from '../../hooks/useAuthDeepLink'
import { primeThemeTransition } from '../../lib/themeTransition'
import AppBackground from './AppBackground'

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
    location.pathname === '/add-account' ||
    location.pathname === '/ai-chat' ||
    location.pathname === '/chat' ||
    location.pathname === '/ai-finance'

  // AI Quick Log states
  const isQuickLogOpen = useChatStore((state) => state.isQuickLogOpen)
  const openQuickLog = useChatStore((state) => state.openQuickLog)

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

  // Pure Android Hardware Back Button Polish
  useEffect(() => {
    const handleBackButton = async () => {
      // 1. Check LIFO overlay stack (modals, drawers, popovers, pickers)
      if (backButtonManager.handleBack()) {
        return
      }

      // 2. Hierarchical parent route navigation if on a sub-route
      const parentRoute = getParentRoute(location.pathname)
      if (parentRoute) {
        navigate(parentRoute)
        return
      }

      // 3. Root screen (/dashboard or /): 2-tap to exit
      const now = Date.now()
      if (now - lastBackPressRef.current < 2000) {
        await App.exitApp()
      } else {
        lastBackPressRef.current = now
        hapticImpact('light')
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: locale === 'en' ? 'Exit App' : 'Keluar Aplikasi',
              message: locale === 'en' ? 'Press back again to exit' : 'Tekan sekali lagi untuk keluar',
              type: 'info',
            },
          }),
        )
      }
    }

    const listenerPromise = App.addListener('backButton', handleBackButton)

    return () => {
      listenerPromise.then((l) => l.remove())
    }
  }, [location.pathname, navigate, locale])

  // Native Status Bar Dynamic Color & Contrast Syncing
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const isDark = theme !== 'light' && theme !== 'nordic-light'
    StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})
    StatusBar.setBackgroundColor({ color: isDark ? '#0b0f1a' : '#ffffff' }).catch(() => {})
  }, [theme])

  // Native Splash Screen Smooth Fade-Out once ready
  useEffect(() => {
    if (isLoaded && Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {})
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
    const runAutomation = async () => {
      try {
        await processRecurringTransactions()
        await notifyTodayEvents()
        await initNotificationChannels()
        const { dailyReminderEnabled, dailyReminderTime } = useSettingsStore.getState()
        if (dailyReminderEnabled) {
          await syncDailyReminderSchedule(true, dailyReminderTime)
        }
      } catch {
        // automation failure should not block app rendering
      }
    }
    runAutomation()
  }, [])

  useEffect(() => {
    const unregister = registerNotificationTapListener((route) => {
      if (route) navigate(route)
    })
    return () => {
      if (typeof unregister === 'function') unregister()
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
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    const appListenerPromise = App.addListener('appStateChange', handleAppStateChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      appListenerPromise.then((l) => l.remove?.())
    }
  }, [securityEnabled, autoLockTimeout, lock])

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
          <Outlet />
        ) : (
          <main
            className={`min-h-[calc(100dvh-64px)] flex-1 min-w-0 md:min-h-[calc(100vh-65px)] md:px-6 md:pb-6 md:pt-6 ${
              location.pathname.startsWith('/wallet/') ||
              location.pathname.startsWith('/todos/') ||
              location.pathname.startsWith('/savings/') ||
              location.pathname === '/add-account'
                ? 'px-0 pt-0 pb-12'
                : isDetailPage
                ? 'px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-12'
                : 'px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-[calc(10rem+env(safe-area-inset-bottom))]'
            }`}
          >
            <div key={location.pathname} className="ft-page-transition">
              <Outlet />
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

      <AiQuickLogModal />

      <InAppNotificationToast />
    </div>
  )
}

export default AppShell
