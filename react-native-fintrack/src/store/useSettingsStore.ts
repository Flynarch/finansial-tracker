import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SupportedCurrency = 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR' | 'JPY' | 'GBP';
export type AppTheme = 'midnight_sapphire' | 'matte_dark' | 'light' | 'system';
export type LocaleType = 'id' | 'en';

interface SettingsState {
  defaultCurrency: SupportedCurrency;
  locale: LocaleType;
  theme: AppTheme;
  securityEnabled: boolean;
  securityMethod: 'biometric' | 'pin';
  lockSecret: string;
  autoLockTimeout: number;
  isUnlocked: boolean;
  profileName: string;
  profilePhoto: string;
  authUserId: string;
  authUserEmail: string;
  authProvider: 'google' | 'email' | 'anonymous' | 'guest';
  emailVerified: boolean;
  geminiApiKey: string;
  hasCompletedOnboarding: boolean;
  hasCompletedSpotlightTour: boolean;

  setDefaultCurrency: (currency: SupportedCurrency) => Promise<void>;
  setLocale: (locale: LocaleType) => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  setSecurity: (params: { enabled: boolean; method: 'biometric' | 'pin'; secret?: string; timeout?: number }) => Promise<void>;
  unlock: () => void;
  lock: () => void;
  setProfile: (name: string, photo?: string) => Promise<void>;
  setAuthUser: (params: { uid: string; email: string; provider: 'google' | 'email' | 'anonymous' | 'guest'; verified?: boolean }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  defaultCurrency: 'IDR',
  locale: 'id',
  theme: 'matte_dark',
  securityEnabled: false,
  securityMethod: 'biometric',
  lockSecret: '',
  autoLockTimeout: 0,
  isUnlocked: true,
  profileName: '',
  profilePhoto: '',
  authUserId: '',
  authUserEmail: '',
  authProvider: 'guest',
  emailVerified: false,
  geminiApiKey: '',
  hasCompletedOnboarding: true,
  hasCompletedSpotlightTour: true,

  setDefaultCurrency: async (defaultCurrency) => {
    set({ defaultCurrency });
    await AsyncStorage.setItem('ft_currency', defaultCurrency);
  },

  setLocale: async (locale) => {
    set({ locale });
    await AsyncStorage.setItem('ft_locale', locale);
  },

  setTheme: async (theme) => {
    set({ theme });
    await AsyncStorage.setItem('ft_theme', theme);
  },

  setSecurity: async ({ enabled, method, secret, timeout }) => {
    set({
      securityEnabled: enabled,
      securityMethod: method,
      ...(secret !== undefined ? { lockSecret: secret } : {}),
      ...(timeout !== undefined ? { autoLockTimeout: timeout } : {}),
    });
    await AsyncStorage.setItem('ft_security_enabled', String(enabled));
  },

  unlock: () => set({ isUnlocked: true }),
  lock: () => set({ isUnlocked: false }),

  setProfile: async (profileName, profilePhoto) => {
    set({ profileName, ...(profilePhoto ? { profilePhoto } : {}) });
    await AsyncStorage.setItem('ft_profile_name', profileName);
  },

  setAuthUser: async ({ uid, email, provider, verified }) => {
    set({
      authUserId: uid,
      authUserEmail: email,
      authProvider: provider,
      emailVerified: Boolean(verified),
    });
  },

  completeOnboarding: async () => {
    set({ hasCompletedOnboarding: true });
    await AsyncStorage.setItem('ft_onboarding_done', 'true');
  },

  loadSettings: async () => {
    try {
      const [curr, loc, thm, sec] = await Promise.all([
        AsyncStorage.getItem('ft_currency'),
        AsyncStorage.getItem('ft_locale'),
        AsyncStorage.getItem('ft_theme'),
        AsyncStorage.getItem('ft_security_enabled'),
      ]);
      set({
        defaultCurrency: (curr as SupportedCurrency) || 'IDR',
        locale: (loc as LocaleType) || 'id',
        theme: (thm as AppTheme) || 'matte_dark',
        securityEnabled: sec === 'true',
      });
    } catch {
      // fallback to initial state
    }
  },
}));
