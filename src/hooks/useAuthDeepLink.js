import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { signInWithMagicLink } from '../lib/auth'
import { exportAllDataAsJson, importAllDataFromJsonPayload } from '../lib/backup'
import { uploadLatestBackup, downloadLatestBackupJson } from '../lib/cloudBackup'
import useSettingsStore from '../store/useSettingsStore'

export function useAuthDeepLink() {
  const setAuthUser = useSettingsStore((s) => s.setAuthUser)

  useEffect(() => {
    const handleAuthUrl = async (url) => {
      if (!url) return

      // Quick check if this is an auth deep link
      const isAuthLink =
        url.includes('apiKey=') ||
        url.includes('mode=signIn') ||
        url.includes('mode=verifyEmail') ||
        url.includes('mode=resetPassword') ||
        url.includes('auth-callback')

      if (!isAuthLink) return

      try {
        const storedEmail = typeof window !== 'undefined' ? window.localStorage.getItem('emailForSignIn') : ''
        const res = await signInWithMagicLink(storedEmail, url)
        if (res.success && res.user) {
          await setAuthUser(res.user)

          // Restore cloud or local backup
          try {
            const userBackupKey = `ft_user_backup_${res.user.uid}`
            const rawLocal = localStorage.getItem(userBackupKey)
            if (rawLocal) {
              await importAllDataFromJsonPayload(JSON.parse(rawLocal))
            } else {
              const cloudData = await downloadLatestBackupJson(res.user.uid)
              if (cloudData) {
                await importAllDataFromJsonPayload(cloudData)
              } else {
                const backup = await exportAllDataAsJson()
                localStorage.setItem(userBackupKey, JSON.stringify(backup))
                await uploadLatestBackup(res.user.uid, backup).catch(() => {})
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
  }, [setAuthUser])
}

export default useAuthDeepLink
