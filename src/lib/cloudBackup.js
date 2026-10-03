import { getDownloadURL, ref as storageRef, uploadBytes, deleteObject, listAll } from 'firebase/storage'
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore'
import { getFirebaseDb, getFirebaseStorage } from './firebase'
import { firebaseErrorToI18nKey } from './firebaseErrors'

function latestBackupPath(uid) {
  return `fintrack-backups/${uid}/latest.json`
}

export function versionedBackupPath(uid, timestamp = Date.now()) {
  return `fintrack-backups/${uid}/backup_${timestamp}.json`
}

export async function deleteCloudBackup(uid) {
  if (!uid) return { storageDeleted: false, firestoreDeleted: false, errors: ['No UID provided'] }
  const storage = getFirebaseStorage()
  const db = getFirebaseDb()

  let storageDeleted = false
  let firestoreDeleted = false
  const errors = []

  try {
    if (storage) {
      try {
        const folderRef = storageRef(storage, `fintrack-backups/${uid}`)
        const listRes = await listAll(folderRef)
        if (listRes?.items?.length) {
          await Promise.all(listRes.items.map((itemRef) => deleteObject(itemRef)))
        }
      } catch (err){
        console.warn('[cloudBackup] list error:', err)
      }
      const fileRef = storageRef(storage, latestBackupPath(uid))
      await deleteObject(fileRef).catch((err) => {
        if (err.code !== 'storage/object-not-found') throw err
      })
      storageDeleted = true
    }
  } catch (err){
    console.warn('[cloudBackup] Storage delete error:', err)
    errors.push(err)
  }

  try {
    if (db) {
      await deleteDoc(doc(db, 'users', uid))
      firestoreDeleted = true
    }
  } catch (err){
    console.warn('[cloudBackup] Firestore delete error:', err)
    errors.push(err)
  }

  if (!storageDeleted && !firestoreDeleted && errors.length > 0) {
    throw new Error('Failed to delete user cloud data: ' + errors.map(e => e.message).join(', '))
  }

  return { storageDeleted, firestoreDeleted, errors }
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
    const timestamp = Date.now()
    const filePath = versionedBackupPath(uid, timestamp)
    const json = JSON.stringify(payload)
    const blob = new Blob([json], { type: 'application/json' })
    const fileRef = storageRef(storage, filePath)
    await uploadBytes(fileRef, blob, {
      contentType: 'application/json',
      customMetadata: {
        exportedAt: String(payload?.exportedAt || ''),
        isEncrypted: String(Boolean(isEncrypted)),
        app: 'FinTrack',
        backupTimestamp: String(timestamp),
      },
    })
    const url = await getDownloadURL(fileRef)

    if (db) {
      await setDoc(
        doc(db, 'users', uid),
        {
          lastBackupAt: serverTimestamp(),
          lastBackupExportedAt: payload?.exportedAt || null,
          lastBackupUrl: url,
          lastBackupPath: filePath,
          isEncrypted: Boolean(isEncrypted),
          app: 'FinTrack',
        },
        { merge: true },
      )
    }

    return { url, path: filePath }
  } catch (err) {
      console.warn('[cloudBackup]', err)
    if (err) {
      err.i18nKey = firebaseErrorToI18nKey(err)
    }
    throw err
  }
}

export async function getLatestBackupMeta(uid) {
  if (!uid) return null
  const db = getFirebaseDb()
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() || null
}

export async function downloadLatestBackupJson(uid) {
  if (!uid) return null
  try {
    const storage = getFirebaseStorage()
    if (!storage) return null

    let downloadUrl = null

    // 1. First check Firestore metadata for the latest backup pointer
    try {
      const meta = await getLatestBackupMeta(uid)
      if (meta?.lastBackupPath) {
        const fileRef = storageRef(storage, meta.lastBackupPath)
        downloadUrl = await getDownloadURL(fileRef).catch(() => null)
      }
      if (!downloadUrl && meta?.lastBackupUrl) {
        downloadUrl = meta.lastBackupUrl
      }
    } catch (err){
      console.warn('[cloudBackup]', err)
      // Ignore metadata read failure and try legacy path
    }

    // 2. Fallback: check storage folder directly for newest backup_<timestamp>.json
    if (!downloadUrl) {
      try {
        const folderRef = storageRef(storage, `fintrack-backups/${uid}`)
        const listRes = await listAll(folderRef)
        if (listRes?.items?.length) {
          const versionedItems = listRes.items
            .filter((item) => /backup_\d+\.json$/.test(item.name || item.fullPath || ''))
            .sort((a, b) => {
              const getTs = (ref) => {
                const match = (ref.name || ref.fullPath || '').match(/backup_(\d+)\.json/)
                return match ? Number(match[1]) : 0
              }
              return getTs(b) - getTs(a)
            })
          if (versionedItems.length > 0) {
            downloadUrl = await getDownloadURL(versionedItems[0]).catch(() => null)
          }
        }
      } catch (err){
      console.warn('[cloudBackup]', err)
        // Storage list failed, continue to legacy latest.json fallback
      }
    }

    // 3. Fallback to legacy latest.json if versioned path wasn't found
    if (!downloadUrl) {
      const legacyRef = storageRef(storage, latestBackupPath(uid))
      downloadUrl = await getDownloadURL(legacyRef).catch(() => null)
    }

    if (!downloadUrl) return null

    const res = await fetch(downloadUrl)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
      console.warn('[cloudBackup]', err)
    if (err) {
      err.i18nKey = firebaseErrorToI18nKey(err)
    }
    return null
  }
}
