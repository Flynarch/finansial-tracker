import { Capacitor } from '@capacitor/core'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

export async function canUseBiometric() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const result = await BiometricAuth.checkBiometry()
    return Boolean(result?.isAvailable)
  } catch {
    return false
  }
}

export async function authenticateBiometric() {
  if (!Capacitor.isNativePlatform()) return false
  const available = await canUseBiometric()
  if (!available) return false

  try {
    const result = await BiometricAuth.authenticate({
      reason: 'Unlock FinTrack',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
    })
    return Boolean(result?.authenticated)
  } catch {
    return false
  }
}
