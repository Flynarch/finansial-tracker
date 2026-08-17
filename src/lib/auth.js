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

