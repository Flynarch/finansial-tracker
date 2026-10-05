// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { canUseBiometric, authenticateBiometric } from '../src/lib/biometric'
import * as passkeysModule from '../src/lib/passkeys'

describe('biometric.js - Web Biometric Security Contracts', () => {
  const originalPublicKeyCredential = window.PublicKeyCredential

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    window.PublicKeyCredential = originalPublicKeyCredential
  })

  it('canUseBiometric returns false when window.PublicKeyCredential is not available', async () => {
    window.PublicKeyCredential = undefined
    const available = await canUseBiometric()
    expect(available).toBe(false)
  })

  it('canUseBiometric returns false when platform authenticator check throws or is false (no dev bypass)', async () => {
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(new Error('Device not supported')),
    }
    const availableOnError = await canUseBiometric()
    expect(availableOnError).toBe(false)

    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(false),
    }
    const availableOnFalse = await canUseBiometric()
    expect(availableOnFalse).toBe(false)
  })

  it('canUseBiometric returns true only when genuine platform authenticator is available', async () => {
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    }
    const available = await canUseBiometric()
    expect(available).toBe(true)
  })

  it('authenticateBiometric returns false on web when no registered passkeys exist (no instant dev auto-approval)', async () => {
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    }
    vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([])

    const result = await authenticateBiometric()
    expect(result).toBe(false)
  })

  it('authenticateBiometric delegates to authenticatePasskey when passkeys exist on web', async () => {
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    }
    vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
      { id: 'key-1', deviceName: 'Laptop' },
    ])
    vi.spyOn(passkeysModule, 'authenticatePasskey').mockResolvedValue({
      success: true,
      credentialId: 'key-1',
    })

    const result = await authenticateBiometric()
    expect(result).toBe(true)
  })

  it('authenticateBiometric returns false if authenticatePasskey rejects on web', async () => {
    window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    }
    vi.spyOn(passkeysModule, 'getStoredPasskeys').mockReturnValue([
      { id: 'key-1', deviceName: 'Laptop' },
    ])
    vi.spyOn(passkeysModule, 'authenticatePasskey').mockRejectedValue(new Error('User cancelled WebAuthn'))

    const result = await authenticateBiometric()
    expect(result).toBe(false)
  })
})
