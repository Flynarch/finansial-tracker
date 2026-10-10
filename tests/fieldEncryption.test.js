import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptField,
  decryptField,
  isFieldEncrypted,
  encryptSensitiveRecord,
  decryptSensitiveRecord,
  setSessionEncryptionKey,
  getSessionEncryptionKey,
  clearSessionEncryptionKey,
} from '../src/lib/fieldEncryption'

describe('fieldEncryption - Transparent IndexedDB Field Protection', () => {
  beforeEach(() => {
    clearSessionEncryptionKey()
  })

  it('correctly identifies encrypted fields by prefix', () => {
    expect(isFieldEncrypted('enc:v1:123456789012:abcdef')).toBe(true)
    expect(isFieldEncrypted('Catatan makan siang')).toBe(false)
    expect(isFieldEncrypted(100000)).toBe(false)
    expect(isFieldEncrypted(null)).toBe(false)
    expect(isFieldEncrypted(undefined)).toBe(false)
  })

  it('encrypts sensitive string field and decrypts back accurately', async () => {
    const rawNote = 'Pinjaman rahasia ke teman dekat untuk modal usaha'
    const encrypted = await encryptField(rawNote)

    expect(isFieldEncrypted(encrypted)).toBe(true)
    expect(encrypted).not.toContain(rawNote)

    const decrypted = await decryptField(encrypted)
    expect(decrypted).toBe(rawNote)
  })

  it('encrypts and decrypts with custom user PIN/passphrase', async () => {
    const sensitiveData = 'Gaji bersih bulanan Rp 25.000.000'
    const pin = '8899'

    const encrypted = await encryptField(sensitiveData, pin)
    expect(isFieldEncrypted(encrypted)).toBe(true)

    const decrypted = await decryptField(encrypted, pin)
    expect(decrypted).toBe(sensitiveData)
  })

  it('transparently returns unencrypted plaintext when decrypting legacy data', async () => {
    const legacyPlaintext = 'Catatan lama yang belum terenkripsi'
    const decrypted = await decryptField(legacyPlaintext)
    expect(decrypted).toBe(legacyPlaintext)
  })

  it('handles empty and null inputs safely without error', async () => {
    expect(await encryptField('')).toBe('')
    expect(await encryptField(null)).toBe('')
    expect(await encryptField(undefined)).toBe('')

    expect(await decryptField('')).toBe('')
    expect(await decryptField(null)).toBe('')
    expect(await decryptField(undefined)).toBe('')
  })

  it('encrypts and decrypts sensitive record fields seamlessly', async () => {
    const originalRecord = {
      id: 42,
      category: 'Makanan',
      amount: 75000,
      notes: 'Makan malam istimewa keluarga di restoran',
      secretNote: 'Bonus rahasia',
    }

    const encryptedRecord = await encryptSensitiveRecord(originalRecord, ['notes', 'secretNote'])
    expect(isFieldEncrypted(encryptedRecord.notes)).toBe(true)
    expect(isFieldEncrypted(encryptedRecord.secretNote)).toBe(true)
    expect(encryptedRecord.id).toBe(42)
    expect(encryptedRecord.amount).toBe(75000)

    const decryptedRecord = await decryptSensitiveRecord(encryptedRecord, ['notes', 'secretNote'])
    expect(decryptedRecord.notes).toBe(originalRecord.notes)
    expect(decryptedRecord.secretNote).toBe(originalRecord.secretNote)
    expect(decryptedRecord.id).toBe(42)
  })

  it('encrypts and decrypts sensitive fields inside splitItems array', async () => {
    const splitTx = {
      id: 99,
      isSplit: true,
      notes: 'Parent secret receipt',
      splitItems: [
        { category: 'makanan', amount: 50000, notes: 'Secret lunch' },
        { category: 'transport', amount: 20000, notes: 'Confidential taxi' },
      ],
    }

    const encrypted = await encryptSensitiveRecord(splitTx, ['notes'])
    expect(isFieldEncrypted(encrypted.notes)).toBe(true)
    expect(isFieldEncrypted(encrypted.splitItems[0].notes)).toBe(true)
    expect(isFieldEncrypted(encrypted.splitItems[1].notes)).toBe(true)

    const decrypted = await decryptSensitiveRecord(encrypted, ['notes'])
    expect(decrypted.notes).toBe('Parent secret receipt')
    expect(decrypted.splitItems[0].notes).toBe('Secret lunch')
    expect(decrypted.splitItems[1].notes).toBe('Confidential taxi')
  })

  it('manages in-memory session encryption key lifecycle', () => {
    expect(getSessionEncryptionKey()).toBeNull()
    const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM' } }
    setSessionEncryptionKey(mockKey)
    expect(getSessionEncryptionKey()).toBe(mockKey)
    clearSessionEncryptionKey()
    expect(getSessionEncryptionKey()).toBeNull()
  })
})
