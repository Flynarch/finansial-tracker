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
 * Clears the session encryption key on app lock / logout.
 */
export function clearSessionEncryptionKey() {
  _sessionEncryptionKey = null
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
 * Encrypts a sensitive string or primitive value using AES-GCM.
 * @param {string|number|null|undefined} value - Plaintext value to encrypt
 * @param {string} [passphrase] - Optional explicit passphrase/PIN
 * @returns {Promise<string>} Encrypted string with prefix enc:v1:
 */
export async function encryptField(value, passphrase = null) {
  if (value === null || value === undefined || value === '') return ''
  const strVal = String(value)
  if (isFieldEncrypted(strVal)) return strVal

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
    const ciphertext = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(strVal)
    )
    return `${ENCRYPTED_PREFIX}${bufferToHex(iv)}:${bufferToHex(ciphertext)}`
  }

  // Otherwise delegate to standard device-backed encryption
  return encryptSecret(strVal)
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
      return dec.decode(decrypted)
    } catch {
      // Fallback to standard decryptSecret
      return decryptSecret(ciphertext)
    }
  }

  return decryptSecret(ciphertext)
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
  return result
}
