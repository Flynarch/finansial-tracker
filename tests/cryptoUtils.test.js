import { describe, it, expect } from 'vitest'
import {
  bufferToHex,
  hexToBuffer,
  bufferToBase64Url,
  base64UrlToBuffer,
} from '../src/lib/cryptoUtils'

describe('cryptoUtils', () => {
  describe('bufferToHex', () => {
    it('returns empty string for null, undefined, or empty buffer', () => {
      expect(bufferToHex(null)).toBe('')
      expect(bufferToHex(undefined)).toBe('')
      expect(bufferToHex(new Uint8Array(0))).toBe('')
      expect(bufferToHex(new ArrayBuffer(0))).toBe('')
    })

    it('converts Uint8Array to hex correctly with zero-padding', () => {
      const input = new Uint8Array([0, 1, 15, 16, 255])
      expect(bufferToHex(input)).toBe('00010f10ff')
    })

    it('converts ArrayBuffer to hex correctly', () => {
      const input = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer
      expect(bufferToHex(input)).toBe('deadbeef')
    })
  })

  describe('hexToBuffer', () => {
    it('returns empty Uint8Array for null, undefined, or empty string', () => {
      expect(hexToBuffer(null)).toEqual(new Uint8Array(0))
      expect(hexToBuffer(undefined)).toEqual(new Uint8Array(0))
      expect(hexToBuffer('')).toEqual(new Uint8Array(0))
      expect(hexToBuffer('   ')).toEqual(new Uint8Array(0))
    })

    it('converts valid hex string to Uint8Array', () => {
      const result = hexToBuffer('00010f10ff')
      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result)).toEqual([0, 1, 15, 16, 255])
    })

    it('pads odd-length hex strings with a leading zero', () => {
      const result = hexToBuffer('f10') // becomes '0f10' -> [15, 16]
      expect(Array.from(result)).toEqual([15, 16])
    })

    it('round-trips hex -> buffer -> hex accurately', () => {
      const original = '0123456789abcdef'
      expect(bufferToHex(hexToBuffer(original))).toBe(original)
    })
  })

  describe('bufferToBase64Url', () => {
    it('returns empty string for null, undefined, or empty buffer', () => {
      expect(bufferToBase64Url(null)).toBe('')
      expect(bufferToBase64Url(undefined)).toBe('')
      expect(bufferToBase64Url(new Uint8Array(0))).toBe('')
      expect(bufferToBase64Url(new ArrayBuffer(0))).toBe('')
    })

    it('converts byte buffer to URL-safe unpadded base64', () => {
      const encoder = new TextEncoder()
      const buf = encoder.encode('Hello World')
      expect(bufferToBase64Url(buf)).toBe('SGVsbG8gV29ybGQ')
    })

    it('replaces + with - and / with _ and removes trailing =', () => {
      // 0xfb, 0xef, 0xff -> "+/==" -> "-_--"
      const buf = new Uint8Array([251, 239, 255])
      const b64url = bufferToBase64Url(buf)
      expect(b64url).not.toContain('+')
      expect(b64url).not.toContain('/')
      expect(b64url).not.toContain('=')
      expect(b64url).toBe('--__')
    })
  })

  describe('base64UrlToBuffer', () => {
    it('returns empty ArrayBuffer for null, undefined, or empty string', () => {
      expect(base64UrlToBuffer(null).byteLength).toBe(0)
      expect(base64UrlToBuffer(undefined).byteLength).toBe(0)
      expect(base64UrlToBuffer('').byteLength).toBe(0)
      expect(base64UrlToBuffer('  ').byteLength).toBe(0)
    })

    it('converts base64url string back to original ArrayBuffer', () => {
      const b64url = 'SGVsbG8gV29ybGQ'
      const buf = base64UrlToBuffer(b64url)
      expect(buf).toBeInstanceOf(ArrayBuffer)
      const decoder = new TextDecoder()
      expect(decoder.decode(buf)).toBe('Hello World')
    })

    it('round-trips base64url -> buffer -> base64url accurately', () => {
      const original = 'SGVsbG8tV29ybGQ_IQ'
      const buffer = base64UrlToBuffer(original)
      expect(bufferToBase64Url(buffer)).toBe(original)
    })
  })
})
