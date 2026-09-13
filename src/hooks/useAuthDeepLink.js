import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { signInWithMagicLink, reloadAuthUser } from '../lib/auth'
import {
  importAllDataFromJsonPayload,
  exportAllDataAsEncryptedEnvelope,
  importAllDataFromEncryptedEnvelope,
} from '../lib/backup'
import { uploadLatestBackup, downloadLatestBackupJson } from '../lib/cloudBackup'
import { db } from '../lib/db'
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
                const e2eePhrase = typeof window !== 'undefined' ? localStorage.getItem('fintrack_e2ee_phrase') : null
                if (e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12) {
                  try {
                    await importAllDataFromEncryptedEnvelope(cloudData, e2eePhrase.trim())
                  } catch {
                    /* stored phrase mismatch or invalid */
                  }
                }
              } else {
                await importAllDataFromJsonPayload(cloudData)
              }
            } else {
              const txCount = await db.transactions.count().catch(() => 0)
              const loanCount = await db.loans.count().catch(() => 0)
              const goalCount = await db.goals.count().catch(() => 0)
              if (txCount > 0 || loanCount > 0 || goalCount > 0) {
                const e2eePhrase = typeof window !== 'undefined' ? localStorage.getItem('fintrack_e2ee_phrase') : null
                const isE2eeActive = Boolean(e2eePhrase && e2eePhrase.trim().split(/\s+/).length === 12)
                if (!isE2eeActive) {
                  // Abort cloud upload if E2EE is not active to protect privacy
                  return
                }
                let uploadPayload
                try {
                  uploadPayload = await exportAllDataAsEncryptedEnvelope(e2eePhrase.trim())
                } catch (err) {
                  console.error('Failed to encrypt backup envelope for E2EE cloud backup, aborting upload to protect privacy:', err)
                  const isEn = useSettingsStore.getState?.()?.locale === 'en'
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('ft-show-toast', {
                        detail: {
                          title: isEn ? 'Encryption Failed' : 'Enkripsi Gagal',
                          message: isEn
                            ? 'Failed to encrypt E2EE backup data. Cloud upload was aborted to protect your privacy.'
                            : 'Gagal mengenkripsi data cadangan E2EE. Unggahan ke cloud dibatalkan untuk menjaga keamanan.',
                          type: 'danger',
                        },
                      })
                    )
                  }
                  return
                }
                await uploadLatestBackup(res.user.uid, uploadPayload, { isEncrypted: true }).catch(() => {})
              }
            }
          } catch {
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
        .catch(() => {})

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
