/**
 * Security & cryptographic utility functions for FinTrack.
 * Uses native Web Crypto API for SHA-256 hashing.
 */

import { bufferToHex, hexToBuffer } from './cryptoUtils'

export { bufferToHex, hexToBuffer }

/**
 * Checks if a string is a 64-character SHA-256 hex digest or a PBKDF2 formatted hash.
 *
 * @param {string} str
 * @returns {boolean}
 */
export function isPinHash(str) {
  if (typeof str !== 'string') return false
  const trimmed = str.trim()
  return /^[0-9a-f]{64}$/i.test(trimmed) || /^pbkdf2:[0-9a-f]+:[0-9a-f]+$/i.test(trimmed)
}

/**
 * Derives a PBKDF2 hash from a PIN with a random (or specified) salt.
 * Uses 100,000 iterations of SHA-256 with Web Crypto API.
 *
 * @param {string} pin - Plaintext PIN string
 * @param {string} [customSaltHex] - Optional existing salt hex for verification
 * @returns {Promise<string>} Format: "pbkdf2:{saltHex}:{hashHex}"
 */
export async function derivePbkdf2Pin(pin, customSaltHex = null) {
  if (!pin) return ''
  const trimmed = String(pin).trim()
  const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
  if (!cryptoObj?.subtle) {
    return trimmed
  }

  let saltBytes
  let saltHex
  if (customSaltHex) {
    saltBytes = hexToBuffer(customSaltHex)
    saltHex = customSaltHex
  } else {
    saltBytes = cryptoObj.getRandomValues(new Uint8Array(16))
    saltHex = bufferToHex(saltBytes)
  }

  const enc = new TextEncoder()
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode(trimmed),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  return `pbkdf2:${saltHex}:${bufferToHex(derivedBits)}`
}

/**
 * Hashes a PIN string using SHA-256 with a domain-specific salt prefix.
 *
 * @param {string} pin - Plaintext PIN string
 * @returns {Promise<string>} 64-character hex hash
 */
export async function hashPin(pin) {
  if (!pin) return ''
  const trimmed = String(pin).trim()
  const enc = new TextEncoder()
  const data = enc.encode(`ft_pin_${trimmed}`)
  const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
  if (!cryptoObj?.subtle) {
    return trimmed
  }
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data)
  return bufferToHex(hashBuffer)
}

/**
 * Verifies an entered PIN against a stored secret.
 * Transparently supports PBKDF2 hashes, SHA-256 hashes, and legacy plaintext secrets.
 *
 * @param {string} enteredPin - The user-entered PIN
 * @param {string} storedSecret - The stored secret (PBKDF2, SHA-256, or legacy plaintext)
 * @returns {Promise<boolean>}
 */
export function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function verifyPin(enteredPin, storedSecret) {
  if (!storedSecret) return false
  const trimmedInput = String(enteredPin || '').trim()
  const trimmedStored = String(storedSecret).trim()

  // 1. PBKDF2 hash verification
  if (trimmedStored.startsWith('pbkdf2:')) {
    const parts = trimmedStored.split(':')
    if (parts.length === 3) {
      const [, saltHex] = parts
      const derived = await derivePbkdf2Pin(trimmedInput, saltHex)
      return constantTimeCompare(derived, trimmedStored)
    }
    return false
  }

  // 2. Legacy SHA-256 hash verification
  if (isPinHash(trimmedStored)) {
    const hashedInput = await hashPin(trimmedInput)
    return constantTimeCompare(hashedInput, trimmedStored)
  }

  // 3. Legacy plaintext fallback
  return constantTimeCompare(trimmedInput, trimmedStored)
}

export const verifyPattern = verifyPin

const ENCRYPTED_PREFIX = 'enc:v1:'

async function getSecretKey(useLegacy = false) {
  const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
  if (!cryptoObj?.subtle) return null
  const enc = new TextEncoder()
  
  let salt = 'fintrack_local_key_salt';
  if (!useLegacy && typeof window !== 'undefined' && window.localStorage) {
    let clientSalt = window.localStorage.getItem('ft_client_salt_v2');
    if (!clientSalt) {
      const arr = new Uint8Array(16);
      cryptoObj.getRandomValues(arr);
      clientSalt = bufferToHex(arr);
      window.localStorage.setItem('ft_client_salt_v2', clientSalt);
    }
    salt = clientSalt;
  }

  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode('ft_sec_byok_at_rest_salt_v1'),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypts a sensitive plaintext string (such as BYOK Gemini API key) using AES-GCM.
 * @param {string} plaintext
 * @returns {Promise<string>} Format: "enc:v1:{ivHex}:{cipherHex}"
 */
export async function encryptSecret(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return ''
  // If it's already encrypted with the new format (which is the same prefix), we would need a way to know,
  // but we can't easily. The easiest is to just re-encrypt if it's not starting with ENCRYPTED_PREFIX.
  // Wait, if it IS starting with ENCRYPTED_PREFIX, we could theoretically decrypt and re-encrypt, but then we might loop.
  // We will just leave it if it's already encrypted, or always re-encrypt?
  // Let's just follow the original logic: if it starts with ENCRYPTED_PREFIX, return it. 
  // Wait, "if an existing encrypted key cannot be decrypted with the new key, attempt decryption with legacy static salt and seamlessly re-encrypt with the new key."
  // This means the seamless re-encryption should probably happen inside decryptSecret if it notices it was legacy? No, decryptSecret returns string.
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext
  const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
  if (!cryptoObj?.subtle) {
    throw new Error('Web Crypto API tidak didukung di lingkungan ini.')
  }
  try {
    const key = await getSecretKey(false)
    if (!key) throw new Error('Gagal menurunkan kunci enkripsi.')
    const iv = cryptoObj.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const ciphertext = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    )
    return `${ENCRYPTED_PREFIX}${bufferToHex(iv)}:${bufferToHex(ciphertext)}`
  } catch (err) {
    console.error('[crypto.encryptSecret]', err)
    throw err
  }
}

/**
 * Decrypts an AES-GCM encrypted secret string. Transparently supports legacy plaintext strings.
 * @param {string} ciphertext
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptSecret(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ''
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext // Already plaintext (legacy)
  const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
  if (!cryptoObj?.subtle) return ciphertext
  
  const parts = ciphertext.slice(ENCRYPTED_PREFIX.length).split(':')
  if (parts.length !== 2) return ciphertext
  const [ivHex, cipherHex] = parts
  const iv = hexToBuffer(ivHex)
  const data = hexToBuffer(cipherHex)

  try {
    const key = await getSecretKey(false)
    if (!key) return ciphertext
    const decrypted = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )
    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch {
    // Attempt fallback with legacy static salt
    try {
      const legacyKey = await getSecretKey(true)
      if (!legacyKey) return ciphertext
      const decryptedFallback = await cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv },
        legacyKey,
        data
      )
      const dec = new TextDecoder()
      return dec.decode(decryptedFallback)
    } catch {
      return ciphertext
    }
  }
}

/**
 * Checks if a ciphertext needs migration from legacy static salt to new client salt.
 * @param {string} ciphertext
 * @returns {Promise<string|null>} New ciphertext if migrated, null if no migration needed
 */
export async function migrateSecretIfNeeded(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith(ENCRYPTED_PREFIX)) return null
  const cryptoObj = globalThis.crypto || (typeof window !== 'undefined' ? window.crypto : null)
  if (!cryptoObj?.subtle) return null

  const parts = ciphertext.slice(ENCRYPTED_PREFIX.length).split(':')
  if (parts.length !== 2) return null
  const [ivHex, cipherHex] = parts
  const iv = hexToBuffer(ivHex)
  const data = hexToBuffer(cipherHex)

  try {
    const key = await getSecretKey(false)
    if (!key) return null
    // Test decryption with new key
    await cryptoObj.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return null // Success with new key, no migration needed
  } catch {
    // Failed with new key, check if legacy key works
    try {
      const legacyKey = await getSecretKey(true)
      if (!legacyKey) return null
      const decryptedFallback = await cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv },
        legacyKey,
        data
      )
      const dec = new TextDecoder()
      const plaintext = dec.decode(decryptedFallback)
      // Re-encrypt with new key
      return await encryptSecret(plaintext)
    } catch {
      return null
    }
  }
}

