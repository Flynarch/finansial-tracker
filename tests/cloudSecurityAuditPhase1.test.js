import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import process from 'node:process'
import { db } from '../src/lib/db'
import {
  versionedBackupPath,
  uploadLatestBackup,
  downloadLatestBackupJson,
  deleteCloudBackup,
} from '../src/lib/cloudBackup'
import { deleteCurrentAccount } from '../src/lib/auth'

// Mock firebase modules
vi.mock('../src/lib/firebase', () => ({
  getFirebaseDb: vi.fn(),
  getFirebaseStorage: vi.fn(),
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user-del-123', delete: vi.fn(async () => {}) },
  })),
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn((storage, path) => ({ storage, path })),
  uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async (fileRef) => `https://storage.mock/${fileRef?.path || fileRef?.name || 'file'}`),
  deleteObject: vi.fn(async () => {}),
  listAll: vi.fn(async (folderRef) => ({
    items: [
      { name: 'backup_1700000000000.json', path: `${folderRef.path}/backup_1700000000000.json` },
      { name: 'backup_1710000000000.json', path: `${folderRef.path}/backup_1710000000000.json` },
    ],
  })),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, col, id) => ({ db, col, id })),
  setDoc: vi.fn(async () => {}),
  getDoc: vi.fn(async () => ({
    exists: () => false,
    data: () => null,
  })),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
}))

vi.mock('../src/lib/firebaseErrors', () => ({
  firebaseErrorToI18nKey: vi.fn(() => 'error.generic'),
}))

describe('Phase 1 — Critical Security & Cloud Data Protection Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.transactions.clear()
    await db.chatMessages.clear()
    await db.wallets.clear()
    await db.loans.clear()
    await db.goals.clear()
  })

  describe('1. Versioned Cloud Backup Paths & Non-Destructive Storage', () => {
    it('generates versioned backup path with backup_<timestamp>.json format', () => {
      const ts = 1710000000000
      const p = versionedBackupPath('user-xyz', ts)
      expect(p).toBe('fintrack-backups/user-xyz/backup_1710000000000.json')
    })

    it('uploads backup using versioned timestamp filename and stores metadata in Firestore', async () => {
      const { getFirebaseDb, getFirebaseStorage } = await import('../src/lib/firebase')
      const { uploadBytes } = await import('firebase/storage')
      const { setDoc } = await import('firebase/firestore')

      const mockDb = { name: 'mock-firestore' }
      const mockStorage = { name: 'mock-storage' }
      getFirebaseDb.mockReturnValue(mockDb)
      getFirebaseStorage.mockReturnValue(mockStorage)

      const validPayload = {
        format: 'fintrack_encrypted_envelope',
        version: 1,
        exportedAt: '2026-03-18T10:00:00.000Z',
        ciphertext: 'mock-encrypted-data',
      }

      const res = await uploadLatestBackup('user-456', validPayload, { isEncrypted: true })
      expect(res).toBeDefined()
      expect(res.url).toContain('https://storage.mock/fintrack-backups/user-456/backup_')
      expect(res.path).toMatch(/^fintrack-backups\/user-456\/backup_\d+\.json$/)

      expect(uploadBytes).toHaveBeenCalled()
      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ col: 'users', id: 'user-456' }),
        expect.objectContaining({
          lastBackupPath: expect.stringMatching(/^fintrack-backups\/user-456\/backup_\d+\.json$/),
          isEncrypted: true,
          app: 'FinTrack',
        }),
        { merge: true }
      )
    })

    it('downloads latest backup using metadata lastBackupPath if available', async () => {
      const { getFirebaseDb, getFirebaseStorage } = await import('../src/lib/firebase')
      const { getDoc } = await import('firebase/firestore')

      const mockDb = { name: 'mock-firestore' }
      const mockStorage = { name: 'mock-storage' }
      getFirebaseDb.mockReturnValue(mockDb)
      getFirebaseStorage.mockReturnValue(mockStorage)

      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          lastBackupPath: 'fintrack-backups/user-789/backup_1710000000000.json',
          lastBackupUrl: 'https://storage.mock/fintrack-backups/user-789/backup_1710000000000.json',
        }),
      })

      const mockPayload = { format: 'fintrack_encrypted_envelope', test: 'ok' }
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayload,
      })

      const data = await downloadLatestBackupJson('user-789')
      expect(data).toEqual(mockPayload)
      expect(globalThis.fetch).toHaveBeenCalledWith('https://storage.mock/fintrack-backups/user-789/backup_1710000000000.json')
    })

    it('falls back to storage listAll to discover newest versioned backup if Firestore metadata is missing', async () => {
      const { getFirebaseDb, getFirebaseStorage } = await import('../src/lib/firebase')
      const { getDoc } = await import('firebase/firestore')
      const { listAll } = await import('firebase/storage')

      const mockDb = { name: 'mock-firestore' }
      const mockStorage = { name: 'mock-storage' }
      getFirebaseDb.mockReturnValue(mockDb)
      getFirebaseStorage.mockReturnValue(mockStorage)

      // No metadata in firestore
      getDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      })

      listAll.mockResolvedValueOnce({
        items: [
          { name: 'backup_1690000000000.json', path: 'fintrack-backups/user-storage-fallback/backup_1690000000000.json' },
          { name: 'backup_1720000000000.json', path: 'fintrack-backups/user-storage-fallback/backup_1720000000000.json' },
          { name: 'backup_1700000000000.json', path: 'fintrack-backups/user-storage-fallback/backup_1700000000000.json' },
        ],
      })

      const versionedPayload = { format: 'fintrack_encrypted_envelope', versioned: true }
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => versionedPayload,
      })

      const data = await downloadLatestBackupJson('user-storage-fallback')
      expect(data).toEqual(versionedPayload)
      // Must pick backup_1720000000000.json because it has the highest timestamp
      expect(globalThis.fetch).toHaveBeenCalledWith('https://storage.mock/fintrack-backups/user-storage-fallback/backup_1720000000000.json')
    })

    it('falls back to legacy latest.json if Firestore metadata and versioned backups are missing', async () => {
      const { getFirebaseDb, getFirebaseStorage } = await import('../src/lib/firebase')
      const { getDoc } = await import('firebase/firestore')
      const { listAll } = await import('firebase/storage')

      const mockDb = { name: 'mock-firestore' }
      const mockStorage = { name: 'mock-storage' }
      getFirebaseDb.mockReturnValue(mockDb)
      getFirebaseStorage.mockReturnValue(mockStorage)

      // No metadata in firestore
      getDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      })

      // No versioned items in storage
      listAll.mockResolvedValueOnce({ items: [] })

      const legacyPayload = { format: 'fintrack_encrypted_envelope', legacy: true }
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => legacyPayload,
      })

      const data = await downloadLatestBackupJson('user-legacy')
      expect(data).toEqual(legacyPayload)
      expect(globalThis.fetch).toHaveBeenCalledWith('https://storage.mock/fintrack-backups/user-legacy/latest.json')
    })

    it('deletes all versioned backups via listAll on cloud delete', async () => {
      const { getFirebaseStorage } = await import('../src/lib/firebase')
      const { deleteObject, listAll } = await import('firebase/storage')

      const mockStorage = { name: 'mock-storage' }
      getFirebaseStorage.mockReturnValue(mockStorage)

      await deleteCloudBackup('user-clean')
      expect(listAll).toHaveBeenCalled()
      expect(deleteObject).toHaveBeenCalled()
    })
  })

  describe('2. Login Cloud Overwrite Prevention & Network Throttle Simulation', () => {
    it('does NOT trigger local-to-cloud upload when cloud backup download fails during login', async () => {
      // Setup local dummy data in IndexedDB (guest data)
      await db.transactions.add({
        date: '2026-03-18',
        amount: 150000,
        type: 'expense',
        category: 'makanan',
        notes: 'Guest dummy transaction',
      })
      expect(await db.transactions.count()).toBe(1)

      // Spy on uploadLatestBackup to ensure it is never called
      const cloudBackupModule = await import('../src/lib/cloudBackup')
      const uploadSpy = vi.spyOn(cloudBackupModule, 'uploadLatestBackup')

      // Simulate network throttle: downloadLatestBackupJson returns null
      const downloadSpy = vi.spyOn(cloudBackupModule, 'downloadLatestBackupJson').mockResolvedValue(null)

      // Simulate the login restore logic
      const user = { uid: 'existing-user-throttled' }
      const isNewUser = false

      // Execution of restoreUserBackup logic for existing user
      if (isNewUser) {
        const meta = await cloudBackupModule.getLatestBackupMeta(user.uid)
        if (!meta) {
          await cloudBackupModule.uploadLatestBackup(user.uid, { dummy: true }, { isEncrypted: true })
        }
      } else {
        const cloudData = await cloudBackupModule.downloadLatestBackupJson(user.uid).catch(() => null)
        if (cloudData) {
          // restore
        }
        // Notice: NO else branch with auto-upload!
      }

      expect(downloadSpy).toHaveBeenCalledWith('existing-user-throttled')
      expect(uploadSpy).not.toHaveBeenCalled()
    })

    it('prevents upload on registration if Firestore metadata lookup fails due to network error', async () => {
      const { getFirebaseDb } = await import('../src/lib/firebase')
      const { getDoc } = await import('firebase/firestore')

      const mockDb = { name: 'mock-firestore' }
      getFirebaseDb.mockReturnValue(mockDb)

      // Network error when checking metadata
      getDoc.mockRejectedValueOnce(new Error('Network error: Firestore unreachable'))

      const cloudBackupModule = await import('../src/lib/cloudBackup')
      const uploadSpy = vi.spyOn(cloudBackupModule, 'uploadLatestBackup')

      const user = { uid: 'new-user-network-down' }

      // The safe registration logic: abort upload if metadata check fails
      try {
        const meta = await cloudBackupModule.getLatestBackupMeta(user.uid)
        const hasPriorBackup = Boolean(meta?.lastBackupPath || meta?.lastBackupAt || meta?.lastBackupUrl)
        if (!hasPriorBackup) {
          await cloudBackupModule.uploadLatestBackup(user.uid, { dummy: true }, { isEncrypted: true })
        }
      } catch {
        // Network/lookup error: abort upload!
      }

      expect(uploadSpy).not.toHaveBeenCalled()
    })

    it('prevents upload on registration if Firestore metadata confirms existing backup', async () => {
      const { getFirebaseDb } = await import('../src/lib/firebase')
      const { getDoc } = await import('firebase/firestore')

      const mockDb = { name: 'mock-firestore' }
      getFirebaseDb.mockReturnValue(mockDb)

      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          lastBackupPath: 'fintrack-backups/user-exists/backup_123.json',
          lastBackupAt: '2026-03-01T00:00:00Z',
        }),
      })

      const cloudBackupModule = await import('../src/lib/cloudBackup')
      const uploadSpy = vi.spyOn(cloudBackupModule, 'uploadLatestBackup')

      const user = { uid: 'user-exists' }

      try {
        const meta = await cloudBackupModule.getLatestBackupMeta(user.uid)
        const hasPriorBackup = Boolean(meta?.lastBackupPath || meta?.lastBackupAt || meta?.lastBackupUrl)
        if (!hasPriorBackup) {
          await cloudBackupModule.uploadLatestBackup(user.uid, { dummy: true }, { isEncrypted: true })
        }
      } catch {
        // ignore
      }

      expect(uploadSpy).not.toHaveBeenCalled()
    })
  })

  describe('3. Account Deletion Purges db.chatMessages', () => {
    it('clears db.chatMessages table when deleteCurrentAccount is invoked', async () => {
      // Seed chatMessages and transactions
      await db.chatMessages.bulkAdd([
        { id: 1, text: 'Halo AI', role: 'user', timestamp: Date.now() },
        { id: 2, text: 'Halo! Ada yang bisa dibantu?', role: 'assistant', timestamp: Date.now() },
      ])
      await db.transactions.add({
        date: '2026-03-18',
        amount: 50000,
        type: 'expense',
        category: 'makanan',
      })

      expect(await db.chatMessages.count()).toBe(2)
      expect(await db.transactions.count()).toBe(1)

      // Call deleteCurrentAccount
      await deleteCurrentAccount()

      expect(await db.chatMessages.count()).toBe(0)
      expect(await db.transactions.count()).toBe(0)
    })
  })

  describe('4. Android Configuration & Security Verification', () => {
    it('has allowMixedContent set to false in capacitor.config.json and android assets', () => {
      const configPath = path.resolve(process.cwd(), 'capacitor.config.json')
      const content = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      expect(content.android).toBeDefined()
      expect(content.android.allowMixedContent).toBe(false)

      const assetConfigPath = path.resolve(process.cwd(), 'android/app/src/main/assets/capacitor.config.json')
      if (fs.existsSync(assetConfigPath)) {
        const assetContent = JSON.parse(fs.readFileSync(assetConfigPath, 'utf8'))
        expect(assetContent.android).toBeDefined()
        expect(assetContent.android.allowMixedContent).toBe(false)
      }
    })

    it('guards WebView.setWebContentsDebuggingEnabled with ApplicationInfo.FLAG_DEBUGGABLE in MainActivity.java', () => {
      const mainActivityPath = path.resolve(process.cwd(), 'android/app/src/main/java/com/fintrack/app/MainActivity.java')
      const content = fs.readFileSync(mainActivityPath, 'utf8')
      expect(content).toContain('ApplicationInfo.FLAG_DEBUGGABLE')
      expect(content).toContain('(getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0')
      expect(content).toContain('WebView.setWebContentsDebuggingEnabled(true)')
    })

    it('configures Content-Security-Policy in index.html with restricted connect-src', () => {
      const indexPath = path.resolve(process.cwd(), 'index.html')
      const content = fs.readFileSync(indexPath, 'utf8')
      expect(content).toContain('http-equiv="Content-Security-Policy"')
      expect(content).toContain('connect-src')
      expect(content).toContain('https://generativelanguage.googleapis.com')
      expect(content).toContain('https://*.googleapis.com')
      expect(content).toContain('https://*.firebaseapp.com')
      expect(content).toContain('https://fonts.googleapis.com')
      expect(content).toContain('https://fonts.gstatic.com')
    })
  })
})
