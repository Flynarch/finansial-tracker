import { create } from 'zustand'
import { db } from '../lib/db'
import { derivePbkdf2Pin, isPinHash, encryptSecret, decryptSecret, migrateSecretIfNeeded } from '../lib/crypto'
import { clearSessionEncryptionKey } from '../lib/fieldEncryption'
import { triggerHaptic } from '../lib/haptics'

const SETTINGS_KEY = 'preferences'

function detectSystemLocale() {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith('en')) return 'en'
  }
  return 'id'
}

function getInitialTheme() {
  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage?.getItem?.('ft_theme')
      if (cached && ['light', 'dark', 'midnight'].includes(cached)) return cached
    } catch (err) {
      console.error('[useSettingsStore:getInitialTheme]', err)
    }
  }
  return 'light'
}

const useSettingsStore = create((set, get) => ({
  theme: getInitialTheme(),
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
  securityMethod: 'none',
  lockSecret: '',
  biometricEnabled: true,
  autoLockTimeout: 0, // 0 = immediately on background, 60 = 1 min, 300 = 5 min
  geminiApiKey: '',
  dailyReminderEnabled: true,
  dailyReminderTime: '20:00',
  budgetAlertsEnabled: true,
  budgetCycleStartDay: 1,
  widgetRange: '7d', // '7d' | 'month'
  notificationAutoApprove: false,
  emailVerified: false,
  emailVerificationDismissed: false,
  hideBalance: typeof window !== 'undefined' ? window.localStorage.getItem('ft_hide_balance') === '1' : false,
  isUnlocked: true,
  isLoaded: false,
  unviewedMutationsCount: 0,
  incrementUnviewedMutations: (count = 1) =>
    set((s) => ({ unviewedMutationsCount: s.unviewedMutationsCount + count })),
  clearUnviewedMutations: () => set({ unviewedMutationsCount: 0 }),
  persist: async (updates) => {
    const next = { ...get(), ...updates }
    const persistedApiKey = next.geminiApiKey ? await encryptSecret(next.geminiApiKey) : ''
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
      biometricEnabled: next.biometricEnabled !== undefined ? Boolean(next.biometricEnabled) : true,
      autoLockTimeout: next.autoLockTimeout,
      geminiApiKey: persistedApiKey,
      dailyReminderEnabled: next.dailyReminderEnabled !== undefined ? Boolean(next.dailyReminderEnabled) : true,
      dailyReminderTime: next.dailyReminderTime || '20:00',
      budgetAlertsEnabled: next.budgetAlertsEnabled !== undefined ? Boolean(next.budgetAlertsEnabled) : true,
      budgetCycleStartDay: next.budgetCycleStartDay !== undefined ? Math.min(31, Math.max(1, Math.floor(Number(next.budgetCycleStartDay) || 1))) : 1,
      widgetRange: next.widgetRange === 'month' ? 'month' : '7d',
      notificationAutoApprove: Boolean(next.notificationAutoApprove),
      hideBalance: Boolean(next.hideBalance),
    })
  },
  toggleHideBalance: () => {
    const next = !get().hideBalance
    set({ hideBalance: next })
    triggerHaptic('selection')
    try {
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem?.('ft_hide_balance', next ? '1' : '0')
      }
    } catch (err) {
      console.error('[useSettingsStore:toggleHideBalance]', err)
    }
    get().persist({ hideBalance: next }).catch((err) => console.error('[useSettingsStore:persistHideBalance]', err))
  },
  setTheme: (theme) => {
    set({ theme })
    try {
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem?.('ft_theme', theme)
        document.documentElement.setAttribute('data-theme', theme)
      }
    } catch (err) {
      console.error('[useSettingsStore:setTheme]', err)
    }
    get().persist({ theme }).catch((err) => console.error('[useSettingsStore:persistTheme]', err))
  },
  setDefaultCurrency: async (defaultCurrency) => {
    set({ defaultCurrency })
    await get().persist({ defaultCurrency })
    try {
      const { clearCachedDashboardState } = await import('../hooks/dashboard/dashboardCache')
      clearCachedDashboardState()
    } catch (err) {
      console.error('[useSettingsStore:clearDashboardCache]', err)
    }
    try {
      const { scheduleNativeWidgetSync } = await import('../lib/nativeWidgetSync')
      scheduleNativeWidgetSync(100)
    } catch (err) {
      console.error('[useSettingsStore:setDefaultCurrencySync]', err)
    }
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
    try {
      const { initNotificationChannels, syncDailyReminderSchedule } = await import('../lib/smartNotifications')
      await initNotificationChannels()
      const { dailyReminderEnabled, dailyReminderTime } = get()
      if (dailyReminderEnabled) {
        await syncDailyReminderSchedule(true, dailyReminderTime)
      }
    } catch (err) {
      console.error('[useSettingsStore:setLocaleSync]', err)
    }
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
  setDailyReminderEnabled: async (dailyReminderEnabled) => {
    const next = Boolean(dailyReminderEnabled)
    set({ dailyReminderEnabled: next })
    await get().persist({ dailyReminderEnabled: next })
  },
  setDailyReminderTime: async (dailyReminderTime) => {
    const next = String(dailyReminderTime || '20:00').trim()
    set({ dailyReminderTime: next })
    await get().persist({ dailyReminderTime: next })
  },
  setBudgetAlertsEnabled: async (budgetAlertsEnabled) => {
    const next = Boolean(budgetAlertsEnabled)
    set({ budgetAlertsEnabled: next })
    await get().persist({ budgetAlertsEnabled: next })
  },
  setBudgetCycleStartDay: async (budgetCycleStartDay) => {
    const next = Math.min(31, Math.max(1, Math.floor(Number(budgetCycleStartDay) || 1)))
    set({ budgetCycleStartDay: next })
    await get().persist({ budgetCycleStartDay: next })
    try {
      const { clearCachedDashboardState } = await import('../hooks/dashboard/dashboardCache')
      clearCachedDashboardState()
    } catch (err) {
      console.error('[useSettingsStore:setBudgetCycleStartDay:clearCachedDashboardState]', err)
    }
    try {
      const { scheduleNativeWidgetSync } = await import('../lib/nativeWidgetSync')
      scheduleNativeWidgetSync(100)
    } catch (err) {
      console.error('[useSettingsStore:setBudgetCycleStartDay:widgetSync]', err)
    }
  },
  setWidgetRange: async (widgetRange) => {
    const next = widgetRange === 'month' ? 'month' : '7d'
    set({ widgetRange: next })
    await get().persist({ widgetRange: next })
    try {
      const { scheduleNativeWidgetSync } = await import('../lib/nativeWidgetSync')
      scheduleNativeWidgetSync(100)
    } catch (err) {
      console.error('[useSettingsStore:setWidgetRange]', err)
    }
  },
  setNotificationAutoApprove: async (notificationAutoApprove) => {
    const next = Boolean(notificationAutoApprove)
    set({ notificationAutoApprove: next })
    await get().persist({ notificationAutoApprove: next })
  },
  setReduceMotion: (reduceMotion) => {
    set({ reduceMotion: Boolean(reduceMotion) })
  },
  setSecurity: async ({ securityEnabled, securityMethod, lockSecret, autoLockTimeout, biometricEnabled }) => {
    const nextMethod = securityMethod ?? get().securityMethod
    const nextEnabled = securityEnabled ?? get().securityEnabled
    const nextBiometricEnabled = biometricEnabled !== undefined
      ? Boolean(biometricEnabled)
      : (get().biometricEnabled ?? true)

    let finalSecret = lockSecret !== undefined ? lockSecret : get().lockSecret
    if ((nextMethod === 'pin' || nextMethod === 'pattern') && finalSecret && !isPinHash(finalSecret)) {
      finalSecret = await derivePbkdf2Pin(finalSecret)
    }

    const updates = {
      securityEnabled: nextEnabled,
      securityMethod: nextMethod,
      lockSecret: finalSecret,
      autoLockTimeout: autoLockTimeout !== undefined ? Number(autoLockTimeout) : get().autoLockTimeout,
      biometricEnabled: nextBiometricEnabled,
    }
    set(updates)
    await get().persist(updates)
    try {
      const { initNotificationChannels } = await import('../lib/smartNotifications')
      await initNotificationChannels()
    } catch (err) {
      console.error('[useSettingsStore:initNotificationChannels]', err)
    }
  },
  unlock: () => set({ isUnlocked: true }),
  lock: () => {
    clearSessionEncryptionKey()
    set({ isUnlocked: false })
  },
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
    const oldOnboardingSeen = typeof window !== 'undefined' && window.localStorage?.getItem?.('ft_onboarding_seen_v1') === '1'
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
    const loadedTheme = record.theme || 'light'
    try {
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem?.('ft_theme', loadedTheme)
      }
      if (typeof document !== 'undefined') {
        document.documentElement?.setAttribute?.('data-theme', loadedTheme)
      }
    } catch (err) {
      console.warn('[useSettingsStore]', err)
      /* ignore */
    }
    let initialLockSecret = record.lockSecret || ''
    if ((record.securityMethod === 'pin' || record.securityMethod === 'pattern') && initialLockSecret && !isPinHash(initialLockSecret)) {
      initialLockSecret = await derivePbkdf2Pin(initialLockSecret)
      void db.settings.update(SETTINGS_KEY, { lockSecret: initialLockSecret }).catch((err) => console.warn('[useSettingsStore]', err))
    }

    let decryptedApiKey = ''
    if (record.geminiApiKey) {
      const migrated = await migrateSecretIfNeeded(record.geminiApiKey)
      if (migrated) {
        void db.settings.update(SETTINGS_KEY, { geminiApiKey: migrated }).catch((err) => console.warn('[useSettingsStore]', err))
        decryptedApiKey = await decryptSecret(migrated)
      } else {
        decryptedApiKey = await decryptSecret(record.geminiApiKey)
      }
    }

    set({
      theme: loadedTheme,
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
      securityMethod: record.securityMethod || 'none',
      lockSecret: initialLockSecret,
      biometricEnabled: record.biometricEnabled !== undefined ? Boolean(record.biometricEnabled) : true,
      autoLockTimeout: record.autoLockTimeout !== undefined ? Number(record.autoLockTimeout) : 0,
      geminiApiKey: decryptedApiKey,
      dailyReminderEnabled: record.dailyReminderEnabled !== undefined ? Boolean(record.dailyReminderEnabled) : true,
      dailyReminderTime: record.dailyReminderTime || '20:00',
      budgetAlertsEnabled: record.budgetAlertsEnabled !== undefined ? Boolean(record.budgetAlertsEnabled) : true,
      budgetCycleStartDay: record.budgetCycleStartDay !== undefined ? Math.min(31, Math.max(1, Math.floor(Number(record.budgetCycleStartDay) || 1))) : 1,
      widgetRange: record.widgetRange === 'month' ? 'month' : '7d',
      notificationAutoApprove: Boolean(record.notificationAutoApprove),
      hideBalance: record.hideBalance !== undefined
        ? Boolean(record.hideBalance)
        : (typeof window !== 'undefined' ? window.localStorage?.getItem?.('ft_hide_balance') === '1' : false),
      isUnlocked: !securityEnabled,
      isLoaded: true,
    })
  },
}))

export default useSettingsStore
