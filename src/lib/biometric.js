import { Capacitor } from '@capacitor/core'
import { BiometricAuth, AndroidBiometryStrength } from '@aparajita/capacitor-biometric-auth'
import { getStoredPasskeys, authenticatePasskey } from './passkeys'
import useSettingsStore from '../store/useSettingsStore'

export async function canUseBiometric() {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await BiometricAuth.checkBiometry()
      // Device can authenticate if biometric hardware is enrolled OR phone has a PIN/Pattern/Password screen lock
      return Boolean(result?.isAvailable || result?.deviceIsSecure)
    } catch (err) {
      console.warn('[BiometricAuth] checkBiometry error:', err)
      return false
    }
  }

  // Web / Desktop platform support (Windows Hello / Mac Touch ID / WebAuthn)
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
      return Boolean(available)
    } catch (err){
      console.warn('[biometric]', err)
      return false
    }
  }

  return false
}

export async function authenticateBiometric() {
  if (typeof window !== 'undefined') {
    window.__ft_isAuthPromptActive = true
    window.dispatchEvent(new CustomEvent('ft-auth-prompt-active', { detail: true }))
  }

  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const locale = useSettingsStore.getState().locale || 'id'
        const isEn = locale === 'en'

        // In @aparajita/capacitor-biometric-auth:
        // authenticate() returns Promise<void>. If successful, it resolves (returns undefined).
        // If failed or cancelled, it rejects/throws BiometryError.
        await BiometricAuth.authenticate({
          reason: isEn
            ? 'Verify fingerprint, Face ID, or device passcode to unlock FinTrack'
            : 'Verifikasi sidik jari, Face ID, atau sandi HP untuk membuka FinTrack',
          cancelTitle: isEn ? 'Cancel' : 'Batal',
          allowDeviceCredential: true, // Allows falling back to phone PIN/Pattern/Password
          androidTitle: isEn ? 'FinTrack Locked' : 'FinTrack Terkunci',
          androidSubtitle: isEn
            ? 'Use your fingerprint or device screen lock'
            : 'Gunakan sidik jari atau kunci layar HP Anda',
          androidBiometryStrength: AndroidBiometryStrength.weak,
        })
        // If we reach this line without throwing, authentication succeeded!
        return true
      } catch (err) {
        console.warn('[BiometricAuth] authenticate error:', err)
        return false
      }
    }

    // On Web / Browser: attempt passkey authentication if registered, otherwise return false
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      try {
        const passkeys = getStoredPasskeys()
        if (passkeys.length > 0) {
          const result = await authenticatePasskey()
          return Boolean(result?.success)
        }
      } catch (err) {
        console.warn('[BiometricAuth] web passkey error:', err)
        return false
      }
    }

    return false
  } finally {
    if (typeof window !== 'undefined') {
      window.__ft_isAuthPromptActive = false
      window.dispatchEvent(new CustomEvent('ft-auth-prompt-active', { detail: false }))
    }
  }
}
