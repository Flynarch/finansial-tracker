import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  reload,
  deleteUser,
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import { deleteCloudBackup } from './cloudBackup'
import { db } from './db'
import useSettingsStore from '../store/useSettingsStore'
import { clearAppLocalStorage } from '../pages/settings/settingsConstants'

/**
 * Cleanly translate Firebase Auth error codes into human-friendly Indonesian messages.
 */
export function formatAuthError(error, fallbackMsg = 'Gagal memproses autentikasi.') {
  const code = String(error?.code || '')
  if (code === 'auth/email-already-in-use') {
    return 'Alamat email ini sudah terdaftar. Silakan gunakan menu Masuk.'
  }
  if (code === 'auth/invalid-email') {
    return 'Format alamat email tidak valid. Pastikan penulisan email benar.'
  }
  if (code === 'auth/weak-password') {
    return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter kombinasi huruf dan angka.'
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
    return 'Email atau kata sandi yang Anda masukkan salah.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa menit sebelum mencoba lagi.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi internet bermasalah. Periksa jaringan seluler atau WiFi Anda.'
  }
  if (code === 'auth/popup-blocked') {
    return 'Jendela popup diblokir oleh browser. Izinkan popup untuk melanjutkan.'
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Domain belum didaftarkan di Firebase Console > Authentication > Settings > Authorized Domains.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Metode login ini belum diaktifkan di Firebase Console > Authentication > Sign-in method.'
  }
  if (code === 'auth/configuration-not-found') {
    return 'Fitur Authentication belum aktif di Firebase Console. Buka Firebase Console > Build > Authentication > Sign-in method.'
  }
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
    return 'Tautan verifikasi/reset sudah kadaluarsa atau sudah pernah digunakan. Silakan minta tautan baru.'
  }
  if (code === 'auth/user-disabled') {
    return 'Akun ini telah dinonaktifkan oleh administrator.'
  }
  if (code === 'auth/requires-recent-login') {
    return 'Demi keamanan akun, silakan keluar dan masuk kembali sebelum menghapus akun.'
  }
  return error?.message || fallbackMsg
}

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
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut().catch(() => {})
    }
    const auth = getFirebaseAuth()
    if (auth) {
      await signOut(auth).catch(() => {})
    }
  } catch {
    // Graceful logout even if offline or Firebase unconfigured
  }
}

/**
 * Sign in with Google (Native Play Services on Android, Popup on Web)
 * Returns clean user details: { displayName, email, photoURL, uid, provider: 'google', emailVerified }
 */
export async function signInWithGoogle() {
  const isNative = Capacitor.isNativePlatform()

  // 1. NATIVE ANDROID / IOS FLOW
  if (isNative) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle()
      const u = result?.user
      if (u) {
        return {
          success: true,
          user: {
            uid: u.uid,
            displayName: u.displayName || '',
            email: u.email || '',
            photoURL: u.photoUrl || u.photoURL || '',
            provider: 'google',
            emailVerified: Boolean(u.emailVerified ?? true),
          },
        }
      }
    } catch (nativeError) {
      const msg = String(nativeError?.message || '')
      const code = String(nativeError?.code || '')
      const isCancelled =
        msg.toLowerCase().includes('cancel') ||
        code === 'auth/user-cancelled' ||
        code === '16' ||
        code === '12501'
      if (isCancelled) {
        return { success: false, cancelled: true, message: 'Login Google dibatalkan.' }
      }
      console.warn('Native Google Auth encountered error, trying web fallback:', nativeError)
    }
  }

  // 2. WEB / DEV ENVIRONMENT FLOW
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
        emailVerified: Boolean(u.emailVerified ?? true),
      },
    }
  } catch (error) {
    const code = error?.code || 'UNKNOWN_ERROR'
    const isCancelled =
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled'

    return {
      success: false,
      cancelled: isCancelled,
      code,
      message: formatAuthError(error, 'Gagal masuk dengan Google.'),
    }
  }
}

/**
 * Sign in with Email & Password
 */
export async function signInWithEmail(email, password) {
  const cleanEmail = String(email || '').trim()
  const cleanPassword = String(password || '')

  if (!cleanEmail || !cleanPassword) {
    return {
      success: false,
      message: 'Silakan masukkan email dan kata sandi Anda.',
    }
  }

  try {
    const auth = getFirebaseAuth()
    const result = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword)
    const u = result.user
    return {
      success: true,
      user: {
        uid: u.uid,
        displayName: u.displayName || cleanEmail.split('@')[0] || '',
        email: u.email || cleanEmail,
        photoURL: u.photoURL || '',
        provider: 'email',
        emailVerified: Boolean(u.emailVerified),
      },
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: formatAuthError(error, 'Gagal masuk dengan Email & Sandi.'),
    }
  }
}

/**
 * Register / Sign up with Email, Password, & Name
 */
export async function signUpWithEmail(email, password, displayName, sendVerification = true) {
  const cleanEmail = String(email || '').trim()
  const cleanPassword = String(password || '')
  const cleanName = String(displayName || '').trim()

  if (!cleanEmail || !cleanPassword) {
    return {
      success: false,
      message: 'Silakan isi email dan kata sandi untuk mendaftar.',
    }
  }

  if (cleanPassword.length < 6) {
    return {
      success: false,
      message: 'Kata sandi minimal terdiri dari 6 karakter.',
    }
  }

  try {
    const auth = getFirebaseAuth()
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword)
    const u = result.user

    const postTasks = []
    if (cleanName) {
      postTasks.push(updateProfile(u, { displayName: cleanName }).catch(() => {}))
    }

    let verificationSent = false
    if (sendVerification && u) {
      postTasks.push(
        sendEmailVerification(u)
          .then(() => {
            verificationSent = true
          })
          .catch((verifErr) => {
            console.warn('Auto sendEmailVerification failed:', verifErr)
          })
      )
    }

    if (postTasks.length > 0) {
      await Promise.allSettled(postTasks)
    }

    return {
      success: true,
      verificationSent,
      user: {
        uid: u.uid,
        displayName: cleanName || cleanEmail.split('@')[0] || '',
        email: u.email || cleanEmail,
        photoURL: u.photoURL || '',
        provider: 'email',
        emailVerified: Boolean(u.emailVerified),
      },
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: formatAuthError(error, 'Gagal mendaftarkan akun baru.'),
    }
  }
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordReset(email) {
  const cleanEmail = String(email || '').trim()
  if (!cleanEmail) {
    return { success: false, message: 'Silakan masukkan alamat email Anda.' }
  }

  try {
    const auth = getFirebaseAuth()
    await sendPasswordResetEmail(auth, cleanEmail)
    return {
      success: true,
      message: 'Email pemulihan kata sandi telah dikirim. Silakan periksa kotak masuk atau spam email Anda.',
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: formatAuthError(error, 'Gagal mengirim email reset kata sandi.'),
    }
  }
}

/**
 * Send Email Magic Link (Passwordless Sign-In)
 */
export async function sendEmailMagicLink(email) {
  const cleanEmail = String(email || '').trim()
  if (!cleanEmail) {
    return { success: false, message: 'Silakan masukkan alamat email Anda.' }
  }

  try {
    const auth = getFirebaseAuth()
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fintrack.web.app'

    const actionCodeSettings = {
      url: `${origin}/auth-callback`,
      handleCodeInApp: true,
      android: {
        packageName: 'com.hmias.fintrack',
        installApp: true,
        minimumVersion: '1',
      },
    }

    await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('emailForSignIn', cleanEmail)
    }

    return {
      success: true,
      message: 'Tautan masuk ajaib telah dikirim ke email Anda. Buka email di HP ini dan klik tautan untuk langsung masuk.',
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: formatAuthError(error, 'Gagal mengirim tautan masuk email.'),
    }
  }
}

/**
 * Complete Magic Link Sign-In
 */
export async function signInWithMagicLink(email, url) {
  try {
    const auth = getFirebaseAuth()
    const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    if (!isSignInWithEmailLink(auth, targetUrl)) {
      return { success: false, message: 'Tautan masuk tidak valid.' }
    }

    let targetEmail = String(email || '').trim()
    if (!targetEmail && typeof window !== 'undefined') {
      targetEmail = window.localStorage.getItem('emailForSignIn') || ''
    }

    if (!targetEmail) {
      return {
        success: false,
        requiresEmailPrompt: true,
        message: 'Silakan konfirmasi alamat email Anda untuk menyelesaikan proses masuk.',
      }
    }

    const result = await signInWithEmailLink(auth, targetEmail, targetUrl)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('emailForSignIn')
    }

    const u = result.user
    return {
      success: true,
      user: {
        uid: u.uid,
        displayName: u.displayName || targetEmail.split('@')[0] || '',
        email: u.email || targetEmail,
        photoURL: u.photoURL || '',
        provider: 'email',
        emailVerified: Boolean(u.emailVerified ?? true),
      },
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: formatAuthError(error, 'Gagal memverifikasi tautan masuk email.'),
    }
  }
}

/**
 * Send Email Verification link to currently signed in user
 */
export async function sendVerificationEmail() {
  try {
    const auth = getFirebaseAuth()
    const user = auth?.currentUser
    if (!user) {
      return { success: false, message: 'Tidak ada akun yang sedang aktif.' }
    }
    if (user.emailVerified) {
      return { success: true, alreadyVerified: true, message: 'Email Anda sudah terverifikasi.' }
    }
    await sendEmailVerification(user)
    return {
      success: true,
      message: 'Tautan verifikasi email telah dikirim. Silakan cek inbox atau spam email Anda.',
    }
  } catch (error) {
    return {
      success: false,
      code: error.code || 'UNKNOWN_ERROR',
      message: formatAuthError(error, 'Gagal mengirim email verifikasi.'),
    }
  }
}

/**
 * Reload Auth User & check emailVerified status
 */
export async function reloadAuthUser() {
  try {
    const auth = getFirebaseAuth()
    const user = auth?.currentUser
    if (!user) return null
    await reload(user)
    return {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      emailVerified: Boolean(user.emailVerified),
    }
  } catch {
    return null
  }
}

/**
 * Check if the currently active Firebase Auth user is Anonymous
 */
export function isCurrentUserAnonymous() {
  try {
    const auth = getFirebaseAuth()
    return Boolean(auth?.currentUser?.isAnonymous)
  } catch {
    return false
  }
}

/**
 * Sign In Anonymously (Firebase Anonymous Authentication)
 * Supports Native Android (@capacitor-firebase/authentication) and Web SDK with offline fallback.
 */
export async function signInAnonymousUser() {
  const isNative = Capacitor.isNativePlatform()

  // 1. Native Android Firebase Anonymous Auth
  if (isNative) {
    try {
      const result = await FirebaseAuthentication.signInAnonymously()
      const u = result?.user
      if (u) {
        return {
          success: true,
          user: {
            uid: u.uid,
            displayName: u.displayName || '',
            email: '',
            photoURL: '',
            provider: 'anonymous',
            isAnonymous: true,
            emailVerified: false,
          },
        }
      }
    } catch (nativeError) {
      console.warn('Native signInAnonymously encountered error, trying web fallback:', nativeError)
    }
  }

  // 2. Web Firebase SDK Anonymous Auth
  try {
    const auth = getFirebaseAuth()
    if (!auth) {
      return {
        success: true,
        user: {
          uid: `anon_${Date.now()}`,
          displayName: '',
          email: '',
          photoURL: '',
          provider: 'anonymous',
          isAnonymous: true,
          emailVerified: false,
        },
      }
    }

    const result = await signInAnonymously(auth)
    const u = result.user
    return {
      success: true,
      user: {
        uid: u.uid,
        displayName: u.displayName || '',
        email: '',
        photoURL: '',
        provider: 'anonymous',
        isAnonymous: true,
        emailVerified: false,
      },
    }
  } catch (error) {
    // If Firebase Anonymous is disabled in console or device is offline, gracefully return anonymous guest user
    return {
      success: true,
      fallback: true,
      user: {
        uid: `anon_${Date.now()}`,
        displayName: '',
        email: '',
        photoURL: '',
        provider: 'anonymous',
        isAnonymous: true,
        emailVerified: false,
      },
      message: formatAuthError(error, 'Masuk sebagai akun anonim lokal.'),
    }
  }
}

/**
 * Continue in Offline-First Guest Mode / Anonymous
 */
export async function signInAsGuest() {
  return await signInAnonymousUser()
}

/**
 * Permanently Delete Currently Signed In Account
 * 1. Purges Firestore & Cloud Storage backups.
 * 2. Deletes user identity from Firebase Auth (Native & Web).
 * 3. Wipes all local Dexie database tables.
 * 4. Clears local storage and resets settings to factory defaults.
 */
export async function deleteCurrentAccount() {
  const auth = getFirebaseAuth()
  const currentUser = auth?.currentUser

  if (currentUser) {
    const uid = currentUser.uid
    // 1. Purge cloud backup data
    await deleteCloudBackup(uid).catch(() => {})

    // 2. Delete user from Firebase Auth
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.deleteUser().catch(() => {})
      }
      await deleteUser(currentUser)
    } catch (error) {
      if (error?.code === 'auth/requires-recent-login') {
        return {
          success: false,
          requiresRecentLogin: true,
          code: error.code,
          message: formatAuthError(error, 'Demi keamanan akun, silakan keluar dan masuk kembali sebelum menghapus akun.'),
        }
      }
      // If error is other than requires-recent-login (e.g. user already deleted), proceed with local cleanup
      console.warn('Firebase deleteUser warning:', error)
    }
  }

  // 3. Purge all local database tables
  try {
    const dataTables = [
      db.transactions,
      db.budgets,
      db.goals,
      db.savings,
      db.loans,
      db.investments,
      db.investmentOrders,
      db.calendarEvents,
      db.recurringTransactions,
      db.todos,
      db.sub_tasks,
      db.habits,
      db.habitLogs,
      db.ideas,
      db.board_links,
      db.notifications,
      db.goalLogs,
      db.wallets,
    ]
    await Promise.all(dataTables.map((t) => t?.clear?.().catch(() => {})))
  } catch {
    /* ignore */
  }

  // 4. Reset local store and storage
  try {
    clearAppLocalStorage()
  } catch {
    /* ignore */
  }

  try {
    const resetOnboarding = useSettingsStore.getState().resetOnboarding
    if (resetOnboarding) await resetOnboarding().catch(() => {})

    const setAuthUser = useSettingsStore.getState().setAuthUser
    if (setAuthUser) {
      await setAuthUser({
        uid: '',
        email: '',
        displayName: '',
        photoURL: '',
        provider: 'guest',
        emailVerified: false,
      }).catch(() => {})
    }
  } catch {
    /* ignore */
  }

  return {
    success: true,
    message: 'Akun dan seluruh data Anda telah berhasil dihapus.',
  }
}

