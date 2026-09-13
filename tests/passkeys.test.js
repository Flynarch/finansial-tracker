import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStoredPasskeys,
  deletePasskey,
  isPasskeySupported,
} from '../src/lib/passkeys'

describe('passkeys - FIDO2 / WebAuthn Suite', () => {
  const store = new Map()

  beforeEach(() => {
    store.clear()
    globalThis.localStorage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    }
  })

  it('manages stored passkeys and deletion accurately', () => {
    expect(getStoredPasskeys()).toEqual([])

    const mockPasskey = {
      id: 'cred-123',
      rawId: 'cred-123',
      deviceName: 'Pixel 8 Pro',
      createdAt: new Date().toISOString(),
      type: 'public-key',
    }

    globalThis.localStorage.setItem('fintrack_passkeys_v1', JSON.stringify([mockPasskey]))
    expect(getStoredPasskeys().length).toBe(1)
    expect(getStoredPasskeys()[0].deviceName).toBe('Pixel 8 Pro')

    deletePasskey('cred-123')
    expect(getStoredPasskeys().length).toBe(0)
  })

  it('handles platform authenticator detection gracefully', async () => {
    const isSupported = await isPasskeySupported()
    expect(typeof isSupported).toBe('boolean')
  })
})
