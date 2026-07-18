import { onAuthStateChanged, signOut } from 'firebase/auth'
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
  const auth = getFirebaseAuth()
  await signOut(auth)
}

