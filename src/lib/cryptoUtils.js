/**
 * Shared binary and cryptographic encoding utilities for FinTrack.
 * Provides conversions between ArrayBuffer / Uint8Array, Hexadecimal, and Base64URL.
 */

/**
 * Converts an ArrayBuffer or Uint8Array to a lowercase Hexadecimal string.
 *
 * @param {ArrayBuffer | Uint8Array | null | undefined} buffer
 * @returns {string} Hex string (empty string for null/empty inputs)
 */
export function bufferToHex(buffer) {
  if (!buffer) return ''
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Converts a Hexadecimal string to a Uint8Array (compatible with BufferSource and Web Crypto).
 * Automatically handles odd-length hex strings and empty inputs.
 *
 * @param {string | null | undefined} hex
 * @returns {Uint8Array}
 */
export function hexToBuffer(hex) {
  if (!hex || typeof hex !== 'string') return new Uint8Array(0)
  const trimmed = hex.trim()
  if (!trimmed) return new Uint8Array(0)
  const cleanHex = trimmed.length % 2 !== 0 ? '0' + trimmed : trimmed
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Converts an ArrayBuffer or Uint8Array to a URL-safe Base64 string without padding.
 *
 * @param {ArrayBuffer | Uint8Array | null | undefined} buffer
 * @returns {string} Base64URL string (RFC 4648 §5)
 */
export function bufferToBase64Url(buffer) {
  if (!buffer) return ''
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
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
 * Converts a URL-safe Base64 string to an ArrayBuffer.
 * Handles missing padding and replaces URL-safe characters with standard Base64 characters.
 *
 * @param {string | null | undefined} base64url
 * @returns {ArrayBuffer}
 */
export function base64UrlToBuffer(base64url) {
  if (!base64url || typeof base64url !== 'string') return new ArrayBuffer(0)
  const trimmed = base64url.trim()
  if (!trimmed) return new ArrayBuffer(0)
  let base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/')
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
