import { initializeApp, getApps } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function readFirebaseConfig() {
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    ...(measurementId ? { measurementId } : {}),
  }
  return cfg
}

export function getFirebaseApp({ requireConfig = true } = {}) {
  if (getApps().length) return getApps()[0]
  const cfg = readFirebaseConfig()
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) {
    if (!requireConfig) return null
    throw new Error(`Missing Firebase env: ${missing.join(', ')}`)
  }
  return initializeApp(cfg)
}

export function getFirebaseAuth() {
  const app = getFirebaseApp({ requireConfig: true })
  return getAuth(app)
}

export function getFirebaseDb() {
  const app = getFirebaseApp({ requireConfig: true })
  return getFirestore(app)
}

export function getFirebaseStorage() {
  const app = getFirebaseApp({ requireConfig: true })
  return getStorage(app)
}

/** Call once from the app entry (browser only). No-op if Analytics unsupported or measurementId unset. */
export async function initFirebaseAnalytics() {
  if (typeof window === 'undefined') return
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return
  const supported = await isSupported().catch(() => false)
  if (!supported) return
  try {
    const app = getFirebaseApp({ requireConfig: true })
    getAnalytics(app)
  } catch (err){
      console.warn('[firebase]', err)
    // Missing env or init failed — app can still run without Analytics
  }
}

