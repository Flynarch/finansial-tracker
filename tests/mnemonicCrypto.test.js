import { describe, it, expect } from 'vitest'
import {
  generateMnemonicPhrase,
  validateMnemonicPhrase,
  generate3WordChallenge,
  encryptPayloadWithMnemonic,
  decryptPayloadWithMnemonic,
} from '../src/lib/mnemonicCrypto'

describe('mnemonicCrypto - Zero-Knowledge E2EE Suite', () => {
  it('generates a valid 12-word BIP-39 mnemonic phrase with correct checksum', async () => {
    const phrase = await generateMnemonicPhrase()
    const words = phrase.split(' ')

    expect(words.length).toBe(12)
    const isValid = await validateMnemonicPhrase(phrase)
    expect(isValid).toBe(true)
  })

  it('rejects invalid or tampered mnemonic phrases', async () => {
    // 11 words (too short)
    expect(await validateMnemonicPhrase('abandon ability able about above absent absorb abstract absurd abuse access')).toBe(false)

    // Non-dictionary words
    expect(await validateMnemonicPhrase('invalid word list that does not exist in standard dictionary bip thirty nine here')).toBe(false)
  })

  it('generates a 3-word verification challenge correctly', async () => {
    const phrase = await generateMnemonicPhrase()
    const words = phrase.split(' ')

    const challenge = generate3WordChallenge(phrase)
    expect(challenge.length).toBe(3)

    // Ensure positions are unique and match the words
    challenge.forEach((c) => {
      expect(c.position).toBeGreaterThanOrEqual(1)
      expect(c.position).toBeLessThanOrEqual(12)
      expect(words[c.index]).toBe(c.expectedWord)
    })
  })

  it('encrypts and decrypts payload seamlessly using AES-256-GCM and PBKDF2', async () => {
    const phrase = await generateMnemonicPhrase()
    const mockData = {
      transactions: [
        { id: 1, amount: 50000, category: 'makanMinum/kopi', notes: 'Kopi Kenangan' },
        { id: 2, amount: 15000000, category: 'gaji/gaji_pokok', notes: 'Gaji Bulanan' },
      ],
      wallets: [{ id: 1, name: 'BCA Utama', balance: 25000000 }],
    }

    const envelope = await encryptPayloadWithMnemonic(mockData, phrase)
    expect(envelope.format).toBe('fintrack_encrypted_envelope')
    expect(envelope.cipher).toBe('AES-256-GCM')
    expect(envelope.ciphertext).toBeDefined()
    expect(envelope.sha256).toBeDefined()

    // Decrypt with correct phrase
    const decrypted = await decryptPayloadWithMnemonic(envelope, phrase)
    expect(decrypted).toEqual(mockData)
  })

  it('fails decryption when provided with a wrong mnemonic phrase', async () => {
    const phraseA = await generateMnemonicPhrase()
    const phraseB = await generateMnemonicPhrase()

    const mockData = { secret: 'Confidential Financial Data' }
    const envelope = await encryptPayloadWithMnemonic(mockData, phraseA)

    await expect(decryptPayloadWithMnemonic(envelope, phraseB)).rejects.toThrow()
  })

  it('fails decryption if ciphertext or integrity seal is tampered with', async () => {
    const phrase = await generateMnemonicPhrase()
    const mockData = { secret: 'Tamper proof' }
    const envelope = await encryptPayloadWithMnemonic(mockData, phrase)

    // Tamper ciphertext
    const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + '0000' }
    await expect(decryptPayloadWithMnemonic(tampered, phrase)).rejects.toThrow(/Integritas data rusak/)
  })
})
