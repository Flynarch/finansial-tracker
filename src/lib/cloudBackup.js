import { getDownloadURL, ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage'
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore'
import { getFirebaseDb, getFirebaseStorage } from './firebase'
import { firebaseErrorToI18nKey } from './firebaseErrors'

function latestBackupPath(uid) {
  return `fintrack-backups/${uid}/latest.json`
}

export async function deleteCloudBackup(uid) {
  if (!uid) return
  const storage = getFirebaseStorage()
  const db = getFirebaseDb()

  try {
    if (storage) {
      const fileRef = storageRef(storage, latestBackupPath(uid))
      await deleteObject(fileRef).catch(() => {})
    }
  } catch {
    /* ignore storage delete error */
  }

  try {
    if (db) {
      await deleteDoc(doc(db, 'users', uid)).catch(() => {})
    }
  } catch {
    /* ignore firestore delete error */
  }
}

export async function uploadLatestBackup(uid, payload, options = {}) {
  const { isEncrypted = false } = options
  if (!isEncrypted || payload?.format !== 'fintrack_encrypted_envelope') {
    console.error('Refusing to upload unencrypted backup data to cloud storage.')
    return null
  }
  const storage = getFirebaseStorage()
  const db = getFirebaseDb()

  try {
    const json = JSON.stringify(payload)
    const blob = new Blob([json], { type: 'application/json' })
    const fileRef = storageRef(storage, latestBackupPath(uid))
    await uploadBytes(fileRef, blob, {
      contentType: 'application/json',
      customMetadata: {
        exportedAt: String(payload?.exportedAt || ''),
        isEncrypted: String(Boolean(isEncrypted)),
        app: 'FinTrack',
      },
    })
    const url = await getDownloadURL(fileRef)

    await setDoc(
      doc(db, 'users', uid),
      {
        lastBackupAt: serverTimestamp(),
        lastBackupExportedAt: payload?.exportedAt || null,
        lastBackupUrl: url,
        isEncrypted: Boolean(isEncrypted),
        app: 'FinTrack',
      },
      { merge: true },
    )

    return { url }
  } catch (err) {
    if (err) {
      err.i18nKey = firebaseErrorToI18nKey(err)
    }
    throw err
  }
}

export async function getLatestBackupMeta(uid) {
  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() || null
}

export async function downloadLatestBackupJson(uid) {
  try {
    const storage = getFirebaseStorage()
    const fileRef = storageRef(storage, latestBackupPath(uid))
    const url = await getDownloadURL(fileRef)
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    if (err) {
      err.i18nKey = firebaseErrorToI18nKey(err)
    }
    return null
  }
}
