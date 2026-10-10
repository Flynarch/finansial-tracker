/**
 * Transparent Field-Level Encryption for Sensitive IndexedDB Records.
 * Encrypts fields such as `notes`, `amount`, `balance` using AES-GCM 256-bit keys
 * derived via PBKDF2 from user PIN or hardware biometric session.
 */

import { bufferToHex, hexToBuffer } from './cryptoUtils'
import { decryptSecret, encryptSecret } from './crypto'

const ENCRYPTED_PREFIX = 'enc:v1:'

// In-memory session key cache (cleared when app is locked)
let _sessionEncryptionKey = null

// In-memory plaintext cache for decrypted fields (cleared when app is locked)
const _notePlaintextCache = new Map()

/**
 * Sets the active session encryption key derived from user authentication.
 * @param {CryptoKey|null} key
 */
export function setSessionEncryptionKey(key) {
  _sessionEncryptionKey = key
}

/**
 * Gets the current active session encryption key.
 * @returns {CryptoKey|null}
 */
export function getSessionEncryptionKey() {
  return _sessionEncryptionKey
}

/**
 * Clears the session encryption key and note plaintext cache on app lock / logout.
 */
export function clearSessionEncryptionKey() {
  _sessionEncryptionKey = null
  _notePlaintextCache.clear()
}

/**
 * Gets current size of the in-memory note decryption cache.
 * @returns {number}
 */
export function getDecryptionCacheSize() {
  return _notePlaintextCache.size
}

/**
 * Checks whether a given value is already encrypted with the standard format.
 * @param {any} val
 * @returns {boolean}
 */
export function isFieldEncrypted(val) {
  return typeof val === 'string' && val.startsWith(ENCRYPTED_PREFIX)
}

/**
 * Synchronously retrieves decrypted note text from the memory cache if available.
 * If not yet in cache, triggers an asynchronous background decrypt so subsequent renders resolve cleanly.
 * Returns fallback (default empty string) on cache miss for encrypted fields to avoid leaking ciphertext.
 * @param {string|null|undefined} note
 * @param {string} [fallback='']
 * @returns {string} Plaintext note if available or unencrypted; returns fallback while decrypting.
 */
export function getDecryptedNoteSync(note, fallback = '') {
  if (!note || typeof note !== 'string') return note || ''
  if (!isFieldEncrypted(note)) return note
  if (_notePlaintextCache.has(note)) {
    const cached = _notePlaintextCache.get(note)
    if (cached && !isFieldEncrypted(cached)) {
      return cached
    }
    _notePlaintextCache.delete(note)
  }
  // Schedule non-blocking async decryption to warm up cache for subsequent renders
  decryptField(note)
    .then((plain) => {
      if (plain && !isFieldEncrypted(plain)) {
        _notePlaintextCache.set(note, plain)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ft-notes-decrypted', { detail: { note, plain } }))
        }
      }
    })
    .catch(() => {})
  return isFieldEncrypted(fallback) ? '' : fallback
}

/**
 * Eagerly decrypts and warms up the cache for a list of transactions or objects with encrypted notes.
 * @param {Array<Object>|Object} records
 * @returns {Promise<void>}
 */
export async function warmupDecryptionCache(records) {
  if (!records) return
  const list = Array.isArray(records) ? records : [records]
  const notesToDecrypt = new Set()

  for (const item of list) {
    if (!item) continue
    if (typeof item.notes === 'string' && isFieldEncrypted(item.notes) && !_notePlaintextCache.has(item.notes)) {
      notesToDecrypt.add(item.notes)
    }
    if (Array.isArray(item.splitItems)) {
      for (const si of item.splitItems) {
        if (typeof si?.notes === 'string' && isFieldEncrypted(si.notes) && !_notePlaintextCache.has(si.notes)) {
          notesToDecrypt.add(si.notes)
        }
      }
    }
  }

  if (notesToDecrypt.size === 0) return

  let addedCount = 0
  await Promise.allSettled(
    Array.from(notesToDecrypt).map(async (cipher) => {
      try {
        const plain = await decryptField(cipher)
        if (plain) {
          _notePlaintextCache.set(cipher, plain)
          addedCount++
        }
      } catch {
        /* ignore background decryption errors */
      }
    })
  )

  if (addedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ft-notes-decrypted', { detail: { count: addedCount } }))
  }
}

/**
 * Encrypts a sensitive string or primitive value using AES-GCM.
 * @param {string|number|null|undefined} value - Plaintext value to encrypt
 * @param {string} [passphrase] - Optional explicit passphrase/PIN
 * @returns {Promise<string>} Encrypted string with prefix enc:v1:
 */
export async function encryptField(value, passphrase = null) {
  if (value === null || value === undefined || value === '') return ''
  const strVal = String(value)
  if (isFieldEncrypted(strVal)) return strVal

  let ciphertext
  // If a custom passphrase is provided, encrypt using PBKDF2 key with passphrase
  if (passphrase) {
    const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
    if (!cryptoObj?.subtle) {
      throw new Error('Web Crypto API tidak didukung di lingkungan ini.')
    }
    const enc = new TextEncoder()
    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )
    const key = await cryptoObj.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode('fintrack_field_salt_v1'),
        iterations: 50000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    )
    const iv = cryptoObj.getRandomValues(new Uint8Array(12))
    const encryptedBuf = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(strVal)
    )
    ciphertext = `${ENCRYPTED_PREFIX}${bufferToHex(iv)}:${bufferToHex(encryptedBuf)}`
  } else {
    // Otherwise delegate to standard device-backed encryption
    ciphertext = await encryptSecret(strVal)
  }

  if (ciphertext) {
    _notePlaintextCache.set(ciphertext, strVal)
  }
  return ciphertext
}

/**
 * Decrypts an encrypted field string back to its original value.
 * If the value is not encrypted, returns it unchanged for seamless backward compatibility.
 * @param {string} ciphertext - Encrypted string
 * @param {string} [passphrase] - Optional explicit passphrase/PIN
 * @returns {Promise<string>} Decrypted plaintext string
 */
export async function decryptField(ciphertext, passphrase = null) {
  if (!ciphertext || typeof ciphertext !== 'string' || !isFieldEncrypted(ciphertext)) {
    return ciphertext || ''
  }

  if (_notePlaintextCache.has(ciphertext)) {
    return _notePlaintextCache.get(ciphertext)
  }

  let plain
  if (passphrase) {
    const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
    if (!cryptoObj?.subtle) return ciphertext
    try {
      const enc = new TextEncoder()
      const keyMaterial = await cryptoObj.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )
      const key = await cryptoObj.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode('fintrack_field_salt_v1'),
          iterations: 50000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )
      const parts = ciphertext.slice(ENCRYPTED_PREFIX.length).split(':')
      if (parts.length !== 2) return ciphertext
      const [ivHex, cipherHex] = parts
      const iv = hexToBuffer(ivHex)
      const data = hexToBuffer(cipherHex)
      const decrypted = await cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      )
      const dec = new TextDecoder()
      plain = dec.decode(decrypted)
    } catch {
      // Fallback to standard decryptSecret
      plain = await decryptSecret(ciphertext)
    }
  } else {
    plain = await decryptSecret(ciphertext)
  }

  if (plain) {
    if (!isFieldEncrypted(plain)) {
      _notePlaintextCache.set(ciphertext, plain)
    }
    return plain
  }
  return ''
}

/**
 * Encrypts specified sensitive fields on an object before persisting to IndexedDB.
 * @param {Object} record - The database record
 * @param {string[]} fieldNames - Array of field keys to encrypt (e.g. ['notes', 'remainingAmount'])
 * @param {string} [passphrase] - Optional user passphrase/PIN
 * @returns {Promise<Object>} Cloned record with encrypted fields
 */
export async function encryptSensitiveRecord(record, fieldNames = ['notes'], passphrase = null) {
  if (!record || typeof record !== 'object') return record
  const result = { ...record }
  for (const field of fieldNames) {
    if (result[field] != null && result[field] !== '') {
      result[field] = await encryptField(result[field], passphrase)
    }
  }
  if (Array.isArray(result.splitItems)) {
    result.splitItems = await Promise.all(
      result.splitItems.map(async (item) => {
        if (!item || typeof item !== 'object') return item
        const itemClone = { ...item }
        for (const field of fieldNames) {
          if (itemClone[field] != null && itemClone[field] !== '') {
            itemClone[field] = await encryptField(itemClone[field], passphrase)
          }
        }
        return itemClone
      })
    )
  }
  return result
}

/**
 * Decrypts specified sensitive fields on an object retrieved from IndexedDB.
 * @param {Object} record - The database record
 * @param {string[]} fieldNames - Array of field keys to decrypt
 * @param {string} [passphrase] - Optional user passphrase/PIN
 * @returns {Promise<Object>} Cloned record with decrypted fields
 */
export async function decryptSensitiveRecord(record, fieldNames = ['notes'], passphrase = null) {
  if (!record || typeof record !== 'object') return record
  const result = { ...record }
  for (const field of fieldNames) {
    if (result[field] != null && typeof result[field] === 'string' && isFieldEncrypted(result[field])) {
      result[field] = await decryptField(result[field], passphrase)
    }
  }
  if (Array.isArray(result.splitItems)) {
    result.splitItems = await Promise.all(
      result.splitItems.map(async (item) => {
        if (!item || typeof item !== 'object') return item
        const itemClone = { ...item }
        for (const field of fieldNames) {
          if (itemClone[field] != null && typeof itemClone[field] === 'string' && isFieldEncrypted(itemClone[field])) {
            itemClone[field] = await decryptField(itemClone[field], passphrase)
          }
        }
        return itemClone
      })
    )
  }
  return result
}

export { useDecryptedNote } from '../hooks/useDecryptedNote'
