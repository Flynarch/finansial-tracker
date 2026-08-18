import { create } from 'zustand'
import { db } from '../lib/db'

const SETTINGS_KEY = 'preferences'

function detectSystemLocale() {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('en')) return 'en'
  }
  return 'id'
}

const useSettingsStore = create((set, get) => ({
  theme: 'light',
  locale: detectSystemLocale(),
  defaultCurrency: 'IDR',
  defaultWalletId: null,
  motionPreference: 'system',
  reduceMotion: false,
  profileName: '',
  profilePhoto: '',
  authProvider: 'guest', // 'google' | 'guest'
  authUserEmail: '',
  authUserId: '',
  initialBalance: 0,
  hasCompletedOnboarding: false,
  hasCompletedSpotlightTour: false,
  isSpotlightTourActive: false,
  securityEnabled: false,
  securityMethod: 'pin',
  lockSecret: '',
  autoLockTimeout: 0, // 0 = immediately on background, 60 = 1 min, 300 = 5 min
  geminiApiKey: '',
  emailVerified: false,
  emailVerificationDismissed: false,
  isUnlocked: true,
  isLoaded: false,
  persist: async (updates) => {
    const next = { ...get(), ...updates }
    await db.settings.put({
      key: SETTINGS_KEY,
      theme: next.theme,
      locale: next.locale,
      defaultCurrency: next.defaultCurrency,
      defaultWalletId: next.defaultWalletId,
      motionPreference: next.motionPreference,
      profileName: next.profileName,
      profilePhoto: next.profilePhoto || '',
      authProvider: next.authProvider || 'guest',
      authUserEmail: next.authUserEmail || '',
      authUserId: next.authUserId || '',
      emailVerified: Boolean(next.emailVerified),
      initialBalance: next.initialBalance,
      hasCompletedOnboarding: next.hasCompletedOnboarding,
      hasCompletedSpotlightTour: next.hasCompletedSpotlightTour,
      securityEnabled: next.securityEnabled,
      securityMethod: next.securityMethod,
      lockSecret: next.lockSecret,
      autoLockTimeout: next.autoLockTimeout,
      geminiApiKey: next.geminiApiKey,
    })
  },
  setTheme: async (theme) => {
    set({ theme })
    await get().persist({ theme })
  },
  setDefaultCurrency: async (defaultCurrency) => {
    set({ defaultCurrency })
    await get().persist({ defaultCurrency })
  },
  setDefaultWalletId: async (defaultWalletId) => {
    const next = defaultWalletId ? Number(defaultWalletId) : null
    set({ defaultWalletId: next })
    await get().persist({ defaultWalletId: next })
  },
  setLocale: async (locale) => {
    const next = locale === 'en' ? 'en' : 'id'
    set({ locale: next })
    await get().persist({ locale: next })
  },
  setMotionPreference: async (motionPreference) => {
    const next = ['system', 'reduce', 'full'].includes(motionPreference) ? motionPreference : 'system'
    set({ motionPreference: next })
    await get().persist({ motionPreference: next })
  },
  setProfileName: async (profileName) => {
    const next = String(profileName || '').trim()
    set({ profileName: next })
    await get().persist({ profileName: next })
  },
  setProfilePhoto: async (profilePhoto) => {
    const next = String(profilePhoto || '').trim()
    set({ profilePhoto: next })
    await get().persist({ profilePhoto: next })
  },
  setAuthUser: async ({ uid = '', email = '', displayName = '', photoURL = '', provider = 'guest', emailVerified = false, isAnonymous = false }) => {
    const calculatedProvider = isAnonymous ? 'anonymous' : (provider || 'guest')
    const updates = {
      authUserId: uid,
      authUserEmail: email,
      authProvider: calculatedProvider,
      emailVerified: Boolean(emailVerified),
      ...(displayName ? { profileName: displayName } : {}),
      ...(photoURL ? { profilePhoto: photoURL } : {}),
    }
    set(updates)
    await get().persist(updates)
  },
  setEmailVerified: async (emailVerified) => {
    const next = Boolean(emailVerified)
    set({ emailVerified: next })
    await get().persist({ emailVerified: next })
  },
  dismissEmailVerificationBanner: () => {
    set({ emailVerificationDismissed: true })
  },
  setInitialBalance: async (initialBalance) => {
    set({ initialBalance: Number(initialBalance) || 0 })
    await get().persist({ initialBalance: Number(initialBalance) || 0 })
  },
  setGeminiApiKey: async (geminiApiKey) => {
    const next = String(geminiApiKey || '').trim()
    set({ geminiApiKey: next })
    await get().persist({ geminiApiKey: next })
  },
  setReduceMotion: (reduceMotion) => {
    set({ reduceMotion: Boolean(reduceMotion) })
  },
  setSecurity: async ({ securityEnabled, securityMethod, lockSecret, autoLockTimeout }) => {
    set({
      securityEnabled: securityEnabled ?? get().securityEnabled,
      securityMethod: securityMethod ?? get().securityMethod,
      lockSecret: lockSecret ?? get().lockSecret,
      autoLockTimeout: autoLockTimeout !== undefined ? Number(autoLockTimeout) : get().autoLockTimeout,
    })
    await get().persist({ securityEnabled, securityMethod, lockSecret, autoLockTimeout })
  },
  unlock: () => set({ isUnlocked: true }),
  lock: () => set({ isUnlocked: false }),
  completeOnboarding: async () => {
    set({ hasCompletedOnboarding: true })
    await get().persist({ hasCompletedOnboarding: true })
  },
  resetOnboarding: async () => {
    set({
      hasCompletedOnboarding: false,
      hasCompletedSpotlightTour: false,
      isSpotlightTourActive: false,
      authProvider: 'guest',
      authUserEmail: '',
      authUserId: '',
      profileName: '',
      profilePhoto: '',
    })
    await get().persist({
      hasCompletedOnboarding: false,
      hasCompletedSpotlightTour: false,
      authProvider: 'guest',
      authUserEmail: '',
      authUserId: '',
      profileName: '',
      profilePhoto: '',
    })
  },
  startSpotlightTour: () => {
    set({ isSpotlightTourActive: true })
  },
  completeSpotlightTour: async () => {
    set({ hasCompletedSpotlightTour: true, isSpotlightTourActive: false })
    await get().persist({ hasCompletedSpotlightTour: true })
  },
  resetSpotlightTour: async () => {
    set({ hasCompletedSpotlightTour: false, isSpotlightTourActive: true })
    await get().persist({ hasCompletedSpotlightTour: false })
  },
  loadSettings: async () => {
    const record = await db.settings.get(SETTINGS_KEY)
    // Check old onboarding localStorage flag for migration
    const oldOnboardingSeen = typeof window !== 'undefined' && window.localStorage.getItem('ft_onboarding_seen_v1') === '1'
    if (!record) {
      // No settings record: new user OR user who saw old onboarding but never changed settings
      const detectedLocale = detectSystemLocale()
      set({
        isLoaded: true,
        isUnlocked: true,
        locale: detectedLocale,
        hasCompletedOnboarding: oldOnboardingSeen,
        hasCompletedSpotlightTour: oldOnboardingSeen,
      })
      return
    }
    const securityEnabled = Boolean(record.securityEnabled)
    // Migration: existing users with a settings record but no hasCompletedOnboarding
    // should have onboarding auto-completed (they're already using the app)
    const onboardingDone = record.hasCompletedOnboarding !== undefined
      ? Boolean(record.hasCompletedOnboarding)
      : true // existing user → skip onboarding
    const tourDone = record.hasCompletedSpotlightTour !== undefined
      ? Boolean(record.hasCompletedSpotlightTour)
      : onboardingDone
    set({
      theme: record.theme || 'light',
      locale: record.locale ? (record.locale === 'en' ? 'en' : 'id') : detectSystemLocale(),
      defaultCurrency: record.defaultCurrency || 'IDR',
      defaultWalletId: record.defaultWalletId ? Number(record.defaultWalletId) : null,
      motionPreference: ['system', 'reduce', 'full'].includes(record.motionPreference)
        ? record.motionPreference
        : 'system',
      profileName: record.profileName || '',
      profilePhoto: record.profilePhoto || '',
      authProvider: record.authProvider || 'guest',
      authUserEmail: record.authUserEmail || '',
      authUserId: record.authUserId || '',
      emailVerified: Boolean(record.emailVerified),
      initialBalance: Number(record.initialBalance) || 0,
      hasCompletedOnboarding: onboardingDone,
      hasCompletedSpotlightTour: tourDone,
      securityEnabled,
      securityMethod: record.securityMethod || 'pin',
      lockSecret: record.lockSecret || '',
      autoLockTimeout: record.autoLockTimeout !== undefined ? Number(record.autoLockTimeout) : 0,
      geminiApiKey: record.geminiApiKey || '',
      isUnlocked: !securityEnabled,
      isLoaded: true,
    })
  },
}))

export default useSettingsStore
