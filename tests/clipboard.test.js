// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyToClipboard } from '../src/lib/clipboard'

describe('copyToClipboard utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn() },
        writable: true,
        configurable: true,
      })
    }
  })

  it('returns false for null or undefined input', async () => {
    expect(await copyToClipboard(null)).toBe(false)
    expect(await copyToClipboard(undefined)).toBe(false)
  })

  it('returns false for empty string', async () => {
    expect(await copyToClipboard('')).toBe(false)
  })

  it('successfully copies using navigator.clipboard.writeText', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    const res = await copyToClipboard('Test text')
    expect(res).toBe(true)
    expect(writeTextSpy).toHaveBeenCalledWith('Test text')
  })

  it('falls back to document.execCommand when navigator.clipboard throws', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Permission denied'))
    document.execCommand = vi.fn().mockReturnValue(true)

    const res = await copyToClipboard('Fallback text')
    expect(res).toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('handles number values correctly', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    const res = await copyToClipboard(50000)
    expect(res).toBe(true)
    expect(writeTextSpy).toHaveBeenCalledWith('50000')
  })
})
