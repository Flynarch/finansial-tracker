/**
 * Converts ArrayBuffer to Base64URL
 */
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Converts Base64URL to ArrayBuffer
 */
function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

const STORAGE_KEY = 'fintrack_passkeys_v1'

/**
 * Checks if Passkeys (WebAuthn / Platform Authenticator) are supported.
 */
export async function isPasskeySupported() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false
  }
  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
    return Boolean(available)
  } catch {
    return false
  }
}

/**
 * Retrieves list of stored registered passkeys.
 */
export function getStoredPasskeys() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw)
    }
    return []
  } catch {
    return []
  }
}

/**
 * Saves a registered passkey to local storage.
 */
function savePasskey(passkey) {
  const current = getStoredPasskeys()
  const filtered = current.filter((p) => p.id !== passkey.id)
  filtered.push(passkey)
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  }
  return filtered
}

/**
 * Deletes a registered passkey by ID.
 */
export function deletePasskey(passkeyId) {
  const current = getStoredPasskeys()
  const filtered = current.filter((p) => p.id !== passkeyId)
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  }
  return filtered
}

/**
 * Registers a new Passkey with Platform Authenticator (Fingerprint, Face Unlock, Windows Hello).
 */
export async function registerPasskey(deviceName = 'Perangkat Ini', userEmail = 'user@fintrack.app') {
  if (typeof window === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn tidak didukung pada platform ini.')
  }

  // Generate random challenge and user ID
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const userId = new Uint8Array(16)
  crypto.getRandomValues(userId)

  const rpConfig = {
    name: 'FinTrack',
  }
  const hostname = window.location.hostname
  if (hostname && hostname !== 'localhost' && !hostname.includes(':') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    rpConfig.id = hostname
  }

  const publicKeyCredentialCreationOptions = {
    challenge: challenge.buffer,
    rp: rpConfig,
    user: {
      id: userId.buffer,
      name: userEmail,
      displayName: userEmail.split('@')[0] || 'FinTrack User',
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  }

  let credential
  try {
    credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      throw new Error('Pendaftaran Passkey dibatalkan oleh pengguna.', { cause: err })
    }
    if (err.name === 'NotSupportedError' || err.name === 'SecurityError') {
      throw new Error('Autentikasi Passkey / WebAuthn tidak didukung pada browser atau jaringan ini.', { cause: err })
    }
    throw err
  }

  if (!credential) {
    throw new Error('Gagal mendaftarkan Passkey.')
  }

  const passkeyRecord = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    deviceName: deviceName.trim() || 'Perangkat FinTrack',
    createdAt: new Date().toISOString(),
    type: credential.type,
  }

  savePasskey(passkeyRecord)
  return passkeyRecord
}

/**
 * Authenticates the user using an existing registered Passkey.
 */
export async function authenticatePasskey() {
  if (typeof window === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn tidak didukung.')
  }

  const passkeys = getStoredPasskeys()
  if (passkeys.length === 0) {
    throw new Error('Belum ada Passkey yang terdaftar.')
  }

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const allowCredentials = passkeys.map((p) => ({
    id: base64UrlToBuffer(p.rawId || p.id),
    type: 'public-key',
    transports: ['internal'],
  }))

  const publicKeyCredentialRequestOptions = {
    challenge: challenge.buffer,
    rpId: window.location.hostname || 'localhost',
    allowCredentials,
    userVerification: 'required',
    timeout: 60000,
  }

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })

  if (!assertion) {
    throw new Error('Autentikasi Passkey dibatalkan.')
  }

  return {
    success: true,
    credentialId: assertion.id,
  }
}
