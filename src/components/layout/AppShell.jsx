import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { App } from '@capacitor/app'
import { backButtonManager } from '../../lib/backButtonManager'
import { notifyTodayEvents, processRecurringTransactions } from '../../lib/automation'
import useSettingsStore from '../../store/useSettingsStore'
import LockScreen from '../ui/LockScreen'
import OnboardingFlow from '../onboarding/OnboardingFlow'
import BottomNav from './BottomNav'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import AiTriggerBar from '../chat/AiTriggerBar'
import AiChatSheet from '../chat/AiChatSheet'

function AppShell() {
  const theme = useSettingsStore((state) => state.theme)
  const locale = useSettingsStore((state) => state.locale)
  const motionPreference = useSettingsStore((state) => state.motionPreference)
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion)
  const isLoaded = useSettingsStore((state) => state.isLoaded)
  const isUnlocked = useSettingsStore((state) => state.isUnlocked)
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const securityMethod = useSettingsStore((state) => state.securityMethod)
  const lockSecret = useSettingsStore((state) => state.lockSecret)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const unlock = useSettingsStore((state) => state.unlock)
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()

  const historyStack = useRef([])
  
  // AI Chat states
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])

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
      const index = historyStack.current.findIndex(item => item.key === currentKey)
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

  useEffect(() => {
    const handleBackButton = async () => {
      // 1. Check LIFO overlay stack
      if (backButtonManager.handleBack()) {
        return
      }

      // 2. Check if we can go back in React Router history
      const canGoBack = historyStack.current.length > 1
      if (canGoBack) {
        navigate(-1)
        return
      }

      // 3. Check if on home/dashboard to exit or redirect
      const currentPath = location.pathname
      if (currentPath === '/dashboard' || currentPath === '/') {
        await App.exitApp()
      } else if (currentPath.startsWith('/settings/')) {
        navigate('/settings')
      } else {
        navigate('/dashboard')
      }
    }

    const listenerPromise = App.addListener('backButton', handleBackButton)

    return () => {
      listenerPromise.then(l => l.remove())
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    loadSettings()
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
      } catch {
        // automation failure should not block app rendering
      }
    }
    runAutomation()
  }, [])

  useEffect(() => {
    // Reset scroll position ke paling atas setiap ganti route/tab apa pun.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div className="ft-app-shell min-h-screen text-[var(--fg)]">
      <Navbar />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar />
        <main className="min-h-[calc(100dvh-64px)] flex-1 min-w-0 px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-4 md:min-h-[calc(100vh-65px)] md:px-6 md:pb-6 md:pt-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <OnboardingFlow />
      {isLoaded && securityEnabled && !isUnlocked ? (
        <LockScreen method={securityMethod} secret={lockSecret} onUnlock={unlock} />
      ) : null}
      
      <AiTriggerBar 
        isVisible={!isChatOpen} 
        onOpen={() => setIsChatOpen(true)} 
      />
      
      <AiChatSheet 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        setMessages={setChatMessages}
      />
    </div>
  )
}

export default AppShell
