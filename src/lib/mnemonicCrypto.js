import { BIP39_WORDLIST } from './bip39Wordlist'
import { bufferToHex, hexToBuffer } from './cryptoUtils'

/**
 * Calculates SHA-256 hash using native Web Crypto API.
 */
async function sha256Hash(data) {
  const enc = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data)
  return bufferToHex(hashBuffer)
}

/**
 * Generates standard 12-word BIP-39 mnemonic phrase (128-bit entropy + 4-bit checksum).
 */
export async function generateMnemonicPhrase() {
  const entropy = new Uint8Array(16)
  crypto.getRandomValues(entropy)

  // Compute 4-bit checksum from SHA-256 of entropy
  const hashBuffer = await crypto.subtle.digest('SHA-256', entropy)
  const hashBytes = new Uint8Array(hashBuffer)
  const checksumBits = hashBytes[0] >> 4 // First 4 bits

  // Convert entropy bytes to bit array
  const bits = []
  for (let i = 0; i < entropy.length; i++) {
    for (let j = 7; j >= 0; j--) {
      bits.push((entropy[i] >> j) & 1)
    }
  }

  // Append 4-bit checksum -> Total 132 bits = 12 words * 11 bits
  for (let j = 3; j >= 0; j--) {
    bits.push((checksumBits >> j) & 1)
  }

  // Split into 12 chunks of 11 bits
  const words = []
  for (let i = 0; i < 12; i++) {
    let index = 0
    for (let j = 0; j < 11; j++) {
      index = (index << 1) | bits[i * 11 + j]
    }
    words.push(BIP39_WORDLIST[index])
  }

  return words.join(' ')
}

/**
 * Validates whether a 12-word phrase matches BIP-39 dictionary and checksum.
 */
export async function validateMnemonicPhrase(phrase = '') {
  const words = phrase.trim().toLowerCase().split(/\s+/)
  if (words.length !== 12) return false

  const bits = []
  for (const word of words) {
    const index = BIP39_WORDLIST.indexOf(word)
    if (index === -1) return false
    for (let j = 10; j >= 0; j--) {
      bits.push((index >> j) & 1)
    }
  }

  // Extract 128-bit entropy and 4-bit checksum
  const entropyBits = bits.slice(0, 128)
  const checksumBits = bits.slice(128)

  const entropy = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | entropyBits[i * 8 + j]
    }
    entropy[i] = byte
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', entropy)
  const hashBytes = new Uint8Array(hashBuffer)
  const expectedChecksumBits = hashBytes[0] >> 4

  let actualChecksum = 0
  for (let j = 0; j < 4; j++) {
    actualChecksum = (actualChecksum << 1) | checksumBits[j]
  }

  return actualChecksum === expectedChecksumBits
}

/**
 * Generates 3-word verification challenge (e.g. indices [2, 6, 10] for word #3, #7, #11).
 */
export function generate3WordChallenge(mnemonicPhrase = '') {
  const words = mnemonicPhrase.trim().toLowerCase().split(/\s+/)
  if (words.length !== 12) return []

  const indices = []
  while (indices.length < 3) {
    const rand = Math.floor(Math.random() * 12)
    if (!indices.includes(rand)) {
      indices.push(rand)
    }
  }
  indices.sort((a, b) => a - b)

  return indices.map((idx) => ({
    position: idx + 1, // 1-indexed for human display
    index: idx,
    expectedWord: words[idx],
  }))
}

/**
 * Derives a 256-bit AES-GCM CryptoKey using PBKDF2-HMAC-SHA256 (600,000 iterations).
 */
export async function deriveEncryptionKey(phrase = '', salt) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(phrase.trim().toLowerCase()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: typeof salt === 'string' ? hexToBuffer(salt) : salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  return derivedKey
}

/**
 * Encrypts a JavaScript object / payload using BIP-39 Mnemonic Phrase.
 * Produces a secure `.fintrack.enc` envelope.
 */
export async function encryptPayloadWithMnemonic(payload = {}, phrase = '') {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)

  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)

  const key = await deriveEncryptionKey(phrase, salt)
  const enc = new TextEncoder()
  const plaintextBytes = enc.encode(JSON.stringify(payload))

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    plaintextBytes
  )

  const ciphertextHex = bufferToHex(ciphertextBuffer)
  const saltHex = bufferToHex(salt)
  const ivHex = bufferToHex(iv)

  const integritySeal = await sha256Hash(`${saltHex}:${ivHex}:${ciphertextHex}`)

  return {
    format: 'fintrack_encrypted_envelope',
    version: 1,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-HMAC-SHA256-600K',
    salt: saltHex,
    iv: ivHex,
    ciphertext: ciphertextHex,
    sha256: integritySeal,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Decrypts a `.fintrack.enc` envelope using the BIP-39 Mnemonic Phrase.
 */
export async function decryptPayloadWithMnemonic(envelope = {}, phrase = '') {
  if (envelope.format !== 'fintrack_encrypted_envelope') {
    throw new Error('Format berkas terenkripsi tidak valid atau tidak dikenali.')
  }

  const { salt, iv, ciphertext, sha256 } = envelope

  // Verify SHA-256 integrity seal
  const computedSeal = await sha256Hash(`${salt}:${iv}:${ciphertext}`)
  if (computedSeal !== sha256) {
    throw new Error('Integritas data rusak atau berkas telah dimodifikasi (Checksum mismatch).')
  }

  const key = await deriveEncryptionKey(phrase, salt)
  const ivBytes = hexToBuffer(iv)
  const ciphertextBytes = hexToBuffer(ciphertext)

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128,
      },
      key,
      ciphertextBytes
    )

    const dec = new TextDecoder()
    const jsonString = dec.decode(decryptedBuffer)
    return JSON.parse(jsonString)
  } catch (err) {
    console.warn('[mnemonicCrypto]', err)
    throw new Error('Frasa pemulihan salah. Dekripsi data gagal.', { cause: err })
  }
}

let inMemorySessionPhrase = null

/**
 * Purges any plaintext 12-word recovery phrases from unencrypted localStorage.
 */
export function purgeLegacyMnemonicStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (window.localStorage.getItem('fintrack_e2ee_phrase')) {
        window.localStorage.removeItem('fintrack_e2ee_phrase')
      }
    }
  } catch (err){
      console.warn('[mnemonicCrypto]', err)
    // ignore
  }
}

/**
 * Sets the active in-memory recovery phrase for the current app session.
 * Never persists to plaintext localStorage.
 */
export function setSessionMnemonicPhrase(phrase) {
  purgeLegacyMnemonicStorage()
  if (typeof phrase === 'string' && phrase.trim().split(/\s+/).length === 12) {
    inMemorySessionPhrase = phrase.trim().toLowerCase()
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('fintrack_e2ee_phrase_session', inMemorySessionPhrase)
      }
    } catch (err){
      console.warn('[mnemonicCrypto]', err)
      // ignore
    }
  } else {
    inMemorySessionPhrase = null
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('fintrack_e2ee_phrase_session')
      }
    } catch (err){
      console.warn('[mnemonicCrypto]', err)
      // ignore
    }
  }
}

/**
 * Retrieves the in-memory recovery phrase for the current app session.
 * Cleans up legacy localStorage plaintext keys automatically.
 */
export function getSessionMnemonicPhrase() {
  purgeLegacyMnemonicStorage()

  if (inMemorySessionPhrase) return inMemorySessionPhrase

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sess = window.sessionStorage.getItem('fintrack_e2ee_phrase_session')
      if (sess && sess.trim().split(/\s+/).length === 12) {
        inMemorySessionPhrase = sess.trim().toLowerCase()
        return inMemorySessionPhrase
      }
    }
  } catch (err){
      console.warn('[mnemonicCrypto]', err)
    // ignore
  }

  return null
}

/**
 * Clears the in-memory recovery phrase and session storage.
 */
export function clearSessionMnemonicPhrase() {
  inMemorySessionPhrase = null
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('fintrack_e2ee_phrase_session')
    }
  } catch (err){
      console.warn('[mnemonicCrypto]', err)
    // ignore
  }
  purgeLegacyMnemonicStorage()
}

