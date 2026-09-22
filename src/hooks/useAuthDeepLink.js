import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { signInWithMagicLink, reloadAuthUser } from '../lib/auth'
import {
  importAllDataFromJsonPayload,
  importAllDataFromEncryptedEnvelope,
} from '../lib/backup'
import { downloadLatestBackupJson } from '../lib/cloudBackup'
import { getSessionMnemonicPhrase } from '../lib/mnemonicCrypto'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore from '../store/useTransactionStore'

export function useAuthDeepLink() {
  const setAuthUser = useSettingsStore((s) => s.setAuthUser)
  const setEmailVerified = useSettingsStore((s) => s.setEmailVerified)

  useEffect(() => {
    const handleAuthUrl = async (url) => {
      if (!url) return

      // Handle Quick-Add deep link (from Android widget or notification action)
      if (url.includes('quick-add')) {
        useTransactionStore.getState().openQuickAdd()
        return
      }

      // Quick check if this is an auth deep link
      const isAuthLink =
        url.includes('apiKey=') ||
        url.includes('mode=signIn') ||
        url.includes('mode=verifyEmail') ||
        url.includes('mode=resetPassword') ||
        url.includes('auth-callback')

      if (!isAuthLink) return

      try {
        // If it's an email verification link
        if (url.includes('mode=verifyEmail')) {
          await setEmailVerified(true)
          const reloaded = await reloadAuthUser()
          if (reloaded) {
            await setAuthUser({
              ...reloaded,
              provider: 'email',
              emailVerified: true,
            })
          }
        }

        const storedEmail = typeof window !== 'undefined' ? window.localStorage.getItem('emailForSignIn') : ''
        const res = await signInWithMagicLink(storedEmail, url)
        if (res.success && res.user) {
          await setAuthUser(res.user)

          // Restore cloud or local backup
          try {
            const cloudData = await downloadLatestBackupJson(res.user.uid)
            if (cloudData) {
              if (cloudData.format === 'fintrack_encrypted_envelope') {
                const e2eePhrase = getSessionMnemonicPhrase()
                if (e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12) {
                  try {
                    await importAllDataFromEncryptedEnvelope(cloudData, e2eePhrase.trim())
                  } catch (err){
      console.warn('[useAuthDeepLink]', err)
                    /* stored phrase mismatch or invalid */
                  }
                }
              } else {
                await importAllDataFromJsonPayload(cloudData)
              }
            }
          } catch (err){
      console.warn('[useAuthDeepLink]', err)
            /* ignore backup error */
          }
        }
      } catch (err) {
        console.warn('Failed to process deep link auth:', err)
      }
    }

    // 1. Capacitor Native Android Deep Link Listener
    let nativeListener = null
    if (Capacitor.isNativePlatform()) {
      App.getLaunchUrl()
        .then((launchUrl) => {
          if (launchUrl?.url) {
            handleAuthUrl(launchUrl.url)
          }
        })
        .catch((err) => console.warn('[useAuthDeepLink]', err))

      nativeListener = App.addListener('appUrlOpen', (data) => {
        if (data?.url) {
          handleAuthUrl(data.url)
        }
      })
    }

    // 2. Web / Browser URL check on mount
    if (typeof window !== 'undefined' && window.location.href) {
      handleAuthUrl(window.location.href)
    }

    return () => {
      nativeListener?.then?.((handler) => handler?.remove?.()).catch(() => {})
    }
  }, [setAuthUser, setEmailVerified])
}

export default useAuthDeepLink
