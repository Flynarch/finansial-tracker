import { describe, it, expect } from 'vitest'
import { hashPin, verifyPin, isPinHash, derivePbkdf2Pin } from '../src/lib/crypto'

describe('Crypto & PIN Hashing Utilities', () => {
  it('identifies valid and invalid SHA-256 hashes', () => {
    expect(isPinHash('a'.repeat(64))).toBe(true)
    expect(isPinHash('1234')).toBe(false)
    expect(isPinHash('')).toBe(false)
    expect(isPinHash(null)).toBe(false)
    expect(isPinHash('pbkdf2:abcdef0123456789:abcdef0123456789')).toBe(true)
  })

  it('hashes a 4-digit PIN to a 64-char hex string', async () => {
    const hash = await hashPin('1234')
    expect(hash).toHaveLength(64)
    expect(isPinHash(hash)).toBe(true)
  })

  it('generates consistent hashes for identical inputs', async () => {
    const hash1 = await hashPin('4321')
    const hash2 = await hashPin('4321')
    expect(hash1).toBe(hash2)
  })

  it('generates different hashes for different inputs', async () => {
    const hash1 = await hashPin('1234')
    const hash2 = await hashPin('5678')
    expect(hash1).not.toBe(hash2)
  })

  it('verifies correctly against a hashed secret', async () => {
    const hash = await hashPin('9876')
    expect(await verifyPin('9876', hash)).toBe(true)
    expect(await verifyPin('1111', hash)).toBe(false)
  })

  it('verifies correctly against legacy plaintext PIN', async () => {
    expect(await verifyPin('1234', '1234')).toBe(true)
    expect(await verifyPin('0000', '1234')).toBe(false)
  })

  it('returns true if no stored secret exists', async () => {
    expect(await verifyPin('1234', '')).toBe(true)
    expect(await verifyPin('1234', null)).toBe(true)
  })

  it('derives and verifies PBKDF2 PIN hashes with unique salts', async () => {
    const pbkdf2Hash = await derivePbkdf2Pin('5678')
    expect(pbkdf2Hash).toMatch(/^pbkdf2:[0-9a-f]{32}:[0-9a-f]{64}$/i)
    expect(isPinHash(pbkdf2Hash)).toBe(true)

    // Verify correct PIN
    const isValid = await verifyPin('5678', pbkdf2Hash)
    expect(isValid).toBe(true)

    // Verify incorrect PIN
    const isInvalid = await verifyPin('9999', pbkdf2Hash)
    expect(isInvalid).toBe(false)
  })
})
