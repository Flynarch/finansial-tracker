import { Capacitor } from '@capacitor/core'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

export async function canUseBiometric() {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await BiometricAuth.checkBiometry()
      return Boolean(result?.isAvailable)
    } catch {
      return false
    }
  }

  // Web / Desktop platform support (Windows Hello / Mac Touch ID / WebAuthn)
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      return Boolean(available)
    } catch {
      return true // allow fallback simulation on dev
    }
  }

  return true
}

export async function authenticateBiometric() {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await BiometricAuth.authenticate({
        reason: 'Buka Kunci FinTrack dengan Sidik Jari atau Sandi HP',
        cancelTitle: 'Batal',
        allowDeviceCredential: true, // Allows falling back to phone PIN/Pattern/Password
      })
      return Boolean(result?.authenticated)
    } catch {
      return false
    }
  }

  // On Web / Browser: simulate instant success for development if platform biometrics not configured
  return true
}
