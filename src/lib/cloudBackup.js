import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFirebaseDb, getFirebaseStorage } from './firebase'

function latestBackupPath(uid) {
  return `fintrack-backups/${uid}/latest.json`
}

export async function uploadLatestBackup(uid, payload) {
  const storage = getFirebaseStorage()
  const db = getFirebaseDb()

  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const fileRef = storageRef(storage, latestBackupPath(uid))
  await uploadBytes(fileRef, blob, {
    contentType: 'application/json',
    customMetadata: {
      exportedAt: String(payload?.exportedAt || ''),
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
      app: 'FinTrack',
    },
    { merge: true },
  )

  return { url }
}

export async function getLatestBackupMeta(uid) {
  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() || null
}

export async function downloadLatestBackupJson(uid) {
  const storage = getFirebaseStorage()
  const fileRef = storageRef(storage, latestBackupPath(uid))
  const url = await getDownloadURL(fileRef)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed downloading backup')
  return await res.json()
}

export async function uploadToDropbox(accessToken, jsonString) {
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: '/fintrack-backup.json',
        mode: 'overwrite',
        mute: true,
      }),
    },
    body: jsonString,
  })
  if (!response.ok) throw new Error('Dropbox upload failed')
  return response.json()
}

export async function downloadFromDropbox(accessToken) {
  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: '/fintrack-backup.json',
      }),
    },
  })
  if (!response.ok) throw new Error('Dropbox download failed')
  return response.json()
}
