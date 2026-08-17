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
    if (!auth) {
      return {
        success: false,
        code: 'auth/no-auth-instance',
        message: 'Konfigurasi Firebase belum terpasang di file .env aplikasi.',
      }
    }
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
    const code = error?.code || 'UNKNOWN_ERROR'
    const isCancelled =
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled'

    let message = 'Gagal masuk dengan Google: ' + (error?.message || code)
    if (code === 'auth/popup-blocked') {
      message = 'Jendela popup diblokir oleh browser. Izinkan popup pada browser Anda untuk melanjutkan.'
    } else if (code === 'auth/unauthorized-domain') {
      message = 'Domain (localhost / hosting) belum didaftarkan di Firebase Console > Authentication > Settings > Authorized Domains.'
    } else if (code === 'auth/network-request-failed') {
      message = 'Gagal terhubung ke Google. Periksa koneksi internet Anda.'
    } else if (code === 'auth/operation-not-allowed') {
      message = 'Metode login Google belum diaktifkan di Firebase Console > Authentication > Sign-in method.'
    } else if (code === 'auth/invalid-action-code') {
      message = 'Tindakan tidak valid. Pastikan Project Support Email sudah diisi di Firebase Console > Sign-in method > Google.'
    } else if (code === 'auth/configuration-not-found') {
      message = 'Konfigurasi Authentication belum aktif di Firebase Console.'
    }

    return {
      success: false,
      cancelled: isCancelled,
      code,
      message,
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

