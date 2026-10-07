import { useEffect, useCallback, useSyncExternalStore } from 'react'
import { getDecryptedNoteSync, decryptField, isFieldEncrypted } from '../lib/fieldEncryption'

/**
 * React hook to reactively resolve and decrypt an encrypted transaction or entity note.
 * Automatically subscribes to background decryption events ('ft-notes-decrypted')
 * and guarantees ciphertext strings starting with 'enc:v1:' NEVER leak to the UI.
 *
 * @param {string|null|undefined} note - Raw note from database record
 * @returns {string} Decrypted note text or empty string while pending/failed
 */
export function useDecryptedNote(note) {
  const subscribe = useCallback(
    (callback) => {
      if (typeof window === 'undefined') return () => {}
      const handleEvent = (e) => {
        if (!e?.detail?.note || e.detail.note === note) {
          callback()
        }
      }
      window.addEventListener('ft-notes-decrypted', handleEvent)
      return () => window.removeEventListener('ft-notes-decrypted', handleEvent)
    },
    [note]
  )

  const getSnapshot = useCallback(() => {
    if (!note || typeof note !== 'string') return ''
    if (!isFieldEncrypted(note)) return note
    const sync = getDecryptedNoteSync(note)
    return isFieldEncrypted(sync) ? '' : (sync || '')
  }, [note])

  useEffect(() => {
    if (note && typeof note === 'string' && isFieldEncrypted(note)) {
      decryptField(note).catch(() => {})
    }
  }, [note])

  const val = useSyncExternalStore(subscribe, getSnapshot, () => '')
  if (isFieldEncrypted(val)) {
    return ''
  }
  return val || ''
}

export default useDecryptedNote
