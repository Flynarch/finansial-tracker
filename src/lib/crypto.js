/**
 * Security & cryptographic utility functions for FinTrack.
 * Uses native Web Crypto API for SHA-256 hashing.
 */

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2))
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

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
export async function verifyPin(enteredPin, storedSecret) {
  if (!storedSecret) return true
  const trimmedInput = String(enteredPin || '').trim()
  const trimmedStored = String(storedSecret).trim()

  // 1. PBKDF2 hash verification
  if (trimmedStored.startsWith('pbkdf2:')) {
    const parts = trimmedStored.split(':')
    if (parts.length === 3) {
      const [, saltHex] = parts
      const derived = await derivePbkdf2Pin(trimmedInput, saltHex)
      return derived === trimmedStored
    }
    return false
  }

  // 2. Legacy SHA-256 hash verification
  if (isPinHash(trimmedStored)) {
    const hashedInput = await hashPin(trimmedInput)
    return hashedInput === trimmedStored
  }

  // 3. Legacy plaintext fallback
  return trimmedInput === trimmedStored
}
