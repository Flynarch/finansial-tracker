import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../src/lib/db'
import { importAllDataFromJsonPayload, exportAllDataAsJson } from '../src/lib/backup'

// Mock browser APIs not available in Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    _store: {},
    getItem(key) { return this._store[key] ?? null },
    setItem(key, val) { this._store[key] = String(val) },
    removeItem(key) { delete this._store[key] },
    clear() { this._store = {} },
  }
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { dispatchEvent: vi.fn(), CustomEvent: class CustomEvent {}, localStorage: globalThis.localStorage }
} else {
  if (!globalThis.window.dispatchEvent) {
    globalThis.window.dispatchEvent = vi.fn()
  }
  if (!globalThis.window.localStorage) {
    globalThis.window.localStorage = globalThis.localStorage
  }
}

describe('backup - importAllDataFromJsonPayload settings restoration', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.wallets.clear()
  })

  it('restores settings with preferences key', async () => {
    const payload = {
      data: {
        settings: [
          {
            key: 'preferences',
            theme: 'dark',
            locale: 'id',
            defaultCurrency: 'USD',
          },
        ],
      },
    }

    await importAllDataFromJsonPayload(payload)

    const saved = await db.settings.get('preferences')
    expect(saved).toBeDefined()
    expect(saved.key).toBe('preferences')
    expect(saved.theme).toBe('dark')
    expect(saved.defaultCurrency).toBe('USD')
  })

  it('restores settings from old backup with fintrack_settings_v1 key to preferences', async () => {
    const payload = {
      data: {
        settings: [
          {
            key: 'fintrack_settings_v1',
            theme: 'midnight',
            locale: 'en',
            defaultCurrency: 'EUR',
          },
        ],
      },
    }

    await importAllDataFromJsonPayload(payload)

    const saved = await db.settings.get('preferences')
    expect(saved).toBeDefined()
    expect(saved.key).toBe('preferences')
    expect(saved.theme).toBe('midnight')
    expect(saved.defaultCurrency).toBe('EUR')
  })

  it('preserves existing auth and security state during import', async () => {
    const existingLockSecret = 'pbkdf2:c3c4a072d05d23d46b3f2530474eb253:06018b0a83eb9009b097c8960bce946c3bb2d6929398b5d79d2c642602635548'
    await db.settings.put({
      key: 'preferences',
      authUserId: 'user-123',
      authProvider: 'google',
      authUserEmail: 'user@example.com',
      emailVerified: true,
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: existingLockSecret,
      autoLockTimeout: 60,
    })

    const payload = {
      data: {
        settings: [
          {
            key: 'preferences',
            theme: 'dark',
            authUserId: 'other-user',
            securityEnabled: false,
          },
        ],
      },
    }

    await importAllDataFromJsonPayload(payload)

    const saved = await db.settings.get('preferences')
    expect(saved).toBeDefined()
    expect(saved.key).toBe('preferences')
    expect(saved.theme).toBe('dark')
    expect(saved.authUserId).toBe('user-123')
    expect(saved.authUserEmail).toBe('user@example.com')
    expect(saved.securityEnabled).toBe(true)
    expect(saved.lockSecret).toBe(existingLockSecret)
  })

  it('exportAllDataAsJson redacts lockSecret from settings', async () => {
    await db.settings.put({
      key: 'preferences',
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: 'super-secret-pin-hash',
    })

    const backup = await exportAllDataAsJson()
    expect(backup.data.settings).toBeDefined()
    expect(backup.data.settings.length).toBeGreaterThan(0)
    const exportedPref = backup.data.settings.find((s) => s.key === 'preferences')
    expect(exportedPref).toBeDefined()
    expect(exportedPref.lockSecret).toBeUndefined()
  })
})
