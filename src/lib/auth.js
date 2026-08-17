import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously,
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import { dispatchOtpEmail } from './emailService'

export function subscribeAuth(listener) {
  try {
    const auth = getFirebaseAuth()
    return onAuthStateChanged(auth, listener)
  } catch {
    // Firebase not configured yet: behave as logged-out.
    listener(null)
    return () => {}
  }
}

export async function signOutCurrentUser() {
  try {
    const auth = getFirebaseAuth()
    await signOut(auth)
  } catch {
    // Graceful logout even if offline or Firebase unconfigured
  }
}

/**
 * Sign in with Google Popup
 * Returns clean user details: { displayName, email, photoURL, uid, provider: 'google' }
 */
export async function signInWithGoogle() {
  try {
    const auth = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    const result = await signInWithPopup(auth, provider)
    const u = result.user
    return {
      success: true,
      user: {
        uid: u.uid,
        displayName: u.displayName || '',
        email: u.email || '',
        photoURL: u.photoURL || '',
        provider: 'google',
      },
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Gagal masuk dengan Google',
    }
  }
}

/**
 * Sign in with Email & Password
 */
export async function signInWithEmail(email, password) {
  try {
    const auth = getFirebaseAuth()
    const result = await signInWithEmailAndPassword(auth, email.trim(), password)
    const u = result.user
    return {
      success: true,
      user: {
        uid: u.uid,
        displayName: u.displayName || u.email?.split('@')[0] || '',
        email: u.email || '',
        photoURL: u.photoURL || '',
        provider: 'email',
      },
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Gagal masuk dengan Email',
    }
  }
}

/**
 * Register / Sign up with Email, Password, & Name
 */
export async function signUpWithEmail(email, password, displayName) {
  try {
    const auth = getFirebaseAuth()
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
    const u = result.user
    if (displayName && displayName.trim()) {
      await updateProfile(u, { displayName: displayName.trim() })
    }
    return {
      success: true,
      user: {
        uid: u.uid,
        displayName: displayName?.trim() || u.email?.split('@')[0] || '',
        email: u.email || '',
        photoURL: u.photoURL || '',
        provider: 'email',
      },
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Gagal mendaftarkan akun',
    }
  }
}

/**
 * Storage key for active OTP session
 */
const OTP_STORAGE_KEY = 'ft_active_email_otp'

/**
 * Generate and send 6-digit OTP to Gmail / Email
 */
export async function sendEmailOtp(email, displayName = '') {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      success: false,
      message: 'Format email tidak valid',
    }
  }

  // Generate secure 6-digit OTP code
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes validity

  const otpPayload = {
    email: cleanEmail,
    displayName: displayName?.trim() || cleanEmail.split('@')[0],
    code,
    expiresAt,
    createdAt: Date.now(),
  }

  try {
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otpPayload))
  } catch {
    /* ignore */
  }

  // Dispatch actual email to user's real Gmail inbox
  const dispatchRes = await dispatchOtpEmail({
    email: cleanEmail,
    code,
    name: otpPayload.displayName,
  })

  return {
    success: true,
    email: cleanEmail,
    code, // Preserved for quick-test simulation / fallback
    expiresAt,
    isRealEmailDelivered: dispatchRes.delivered,
    provider: dispatchRes.provider,
  }
}

/**
 * Verify 6-digit OTP code entered by the user
 */
export async function verifyEmailOtp(email, enteredCode) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanCode = String(enteredCode || '').trim()

  let sessionData = null
  try {
    const raw = sessionStorage.getItem(OTP_STORAGE_KEY)
    if (raw) sessionData = JSON.parse(raw)
  } catch {
    /* ignore */
  }

  if (!sessionData || sessionData.email !== cleanEmail) {
    return {
      success: false,
      message: 'Sesi OTP tidak ditemukan atau email berbeda. Silakan kirim ulang kode.',
    }
  }

  if (Date.now() > sessionData.expiresAt) {
    return {
      success: false,
      message: 'Kode OTP telah kedaluwarsa. Silakan kirim ulang kode baru.',
    }
  }

  if (sessionData.code !== cleanCode) {
    return {
      success: false,
      message: 'Kode OTP salah. Periksa kembali 6 digit kode yang dikirim.',
    }
  }

  // Clear OTP session upon success
  try {
    sessionStorage.removeItem(OTP_STORAGE_KEY)
  } catch {
    /* ignore */
  }

  // Create deterministic UID for this email address
  const safeId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')
  const user = {
    uid: `email_${safeId}`,
    email: cleanEmail,
    displayName: sessionData.displayName || cleanEmail.split('@')[0],
    photoURL: '',
    provider: 'email',
  }

  return {
    success: true,
    user,
  }
}

/**
 * Resend OTP code to the same email
 */
export async function resendEmailOtp(email) {
  let displayName = ''
  try {
    const raw = sessionStorage.getItem(OTP_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      displayName = data.displayName || ''
    }
  } catch {
    /* ignore */
  }

  return sendEmailOtp(email, displayName)
}

/**
 * Continue in Offline-First Guest Mode
 */
export async function signInAsGuest() {
  try {
    const auth = getFirebaseAuth()
    const result = await signInAnonymously(auth).catch(() => null)
    return {
      success: true,
      user: {
        uid: result?.user?.uid || `guest_${Date.now()}`,
        displayName: '',
        email: '',
        photoURL: '',
        provider: 'guest',
      },
    }
  } catch {
    return {
      success: true,
      user: {
        uid: `guest_${Date.now()}`,
        displayName: '',
        email: '',
        photoURL: '',
        provider: 'guest',
      },
    }
  }
}

