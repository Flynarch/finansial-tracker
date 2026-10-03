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

  it('supports legacy flat backups without .data wrapper and normalizes deletedAt to null', async () => {
    await db.transactions.clear()
    const legacyPayload = {
      transactions: [
        { id: 1, date: '2026-08-01', amount: 50000, type: 'expense' },
        { id: 2, date: '2026-08-02', amount: 100000, type: 'income', deletedAt: '2026-08-03' },
      ],
      wallets: [{ id: 1, name: 'Dompet Utama', balance: 50000 }],
    }

    await importAllDataFromJsonPayload(legacyPayload)

    const txs = await db.transactions.toArray()
    expect(txs.length).toBe(2)
    const tx1 = txs.find((t) => t.id === 1)
    const tx2 = txs.find((t) => t.id === 2)
    expect(tx1.deletedAt).toBeNull()
    expect(tx2.deletedAt).toBe('2026-08-03')
  })

  it('applies fallback defaults for habits, wallets, and loans during import with bulkPut', async () => {
    await db.habits.clear()
    await db.wallets.clear()
    await db.loans.clear()

    const payload = {
      data: {
        habits: [{ id: 1, name: 'Olahraga' }],
        wallets: [{ id: 1, name: 'Dompet Lama' }],
        loans: [{ id: 1, totalAmount: 500000 }],
        settings: [{ key: 'preferences' }],
      },
      categoryCustomizations: {
        expense: { custom_cat: { name: 'Kustom' } },
      },
    }

    await importAllDataFromJsonPayload(payload)

    const habit = await db.habits.get(1)
    expect(habit.frequencyType).toBe('daily')

    const wallet = await db.wallets.get(1)
    expect(wallet.isArchived).toBe(0)

    const loan = await db.loans.get(1)
    expect(loan.remainingAmount).toBe(500000)

    expect(globalThis.localStorage.getItem('ft_expense_category_custom_v1')).toContain('custom_cat')
  })

  it('handles duplicate primary keys across items cleanly using bulkPut without ConstraintError', async () => {
    await db.wallets.clear()
    await db.transactions.clear()

    const payload = {
      data: {
        wallets: [
          { id: 10, name: 'Wallet First Version', balance: 100000 },
          { id: 10, name: 'Wallet Overwrite Version', balance: 250000 },
        ],
        transactions: [
          { id: 50, amount: 10000, type: 'expense', category: 'Food', date: '2026-03-01' },
          { id: 50, amount: 20000, type: 'expense', category: 'Food Updated', date: '2026-03-01' },
        ],
        settings: [{ key: 'preferences' }],
      },
    }

    await expect(importAllDataFromJsonPayload(payload)).resolves.not.toThrow()

    const wallet = await db.wallets.get(10)
    expect(wallet.name).toBe('Wallet Overwrite Version')
    expect(wallet.balance).toBe(250000)

    const tx = await db.transactions.get(50)
    expect(tx.amount).toBe(20000)
    expect(tx.category).toBe('Food Updated')
  })

  it('rejects invalid or empty backup payloads with descriptive error', async () => {
    await expect(importAllDataFromJsonPayload(null)).rejects.toThrow('Format berkas cadangan tidak valid atau data kosong.')
    await expect(importAllDataFromJsonPayload('invalid string')).rejects.toThrow('Format berkas cadangan tidak valid atau data kosong.')
  })
})
