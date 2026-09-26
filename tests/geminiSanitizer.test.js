import { describe, it, expect } from 'vitest'
import { sanitizeGeminiContents } from '../src/lib/ai/sanitizer'

describe('sanitizeGeminiContents', () => {
  it('returns empty array for empty or non-array inputs', () => {
    expect(sanitizeGeminiContents([])).toEqual([])
    expect(sanitizeGeminiContents(null)).toEqual([])
    expect(sanitizeGeminiContents(undefined)).toEqual([])
  })

  it('strips leading model turns from multiturn contents', () => {
    const raw = [
      { role: 'model', parts: [{ text: 'Halo! Ada yang bisa dibantu?' }] },
      { role: 'user', parts: [{ text: 'Beli kopi 20k' }] },
      { role: 'model', parts: [{ text: 'Kopi berhasil dicatat.' }] },
    ]
    const sanitized = sanitizeGeminiContents(raw)
    expect(sanitized.length).toBe(2)
    expect(sanitized[0].role).toBe('user')
    expect(sanitized[0].parts[0].text).toBe('Beli kopi 20k')
    expect(sanitized[1].role).toBe('model')
  })

  it('strips consecutive multiple leading model turns', () => {
    const raw = [
      { role: 'model', parts: [{ text: 'Welcome' }] },
      { role: 'model', parts: [{ text: 'How can I help?' }] },
      { role: 'user', parts: [{ text: 'Hello' }] },
    ]
    const sanitized = sanitizeGeminiContents(raw)
    expect(sanitized.length).toBe(1)
    expect(sanitized[0].role).toBe('user')
  })

  it('merges consecutive same-role turns into single turn with combined parts', () => {
    const raw = [
      { role: 'user', parts: [{ text: 'Part 1' }] },
      { role: 'user', parts: [{ text: 'Part 2' }] },
      { role: 'model', parts: [{ text: 'Response' }] },
    ]
    const sanitized = sanitizeGeminiContents(raw)
    expect(sanitized.length).toBe(2)
    expect(sanitized[0].role).toBe('user')
    expect(sanitized[0].parts.length).toBe(2)
    expect(sanitized[0].parts[0].text).toBe('Part 1')
    expect(sanitized[0].parts[1].text).toBe('Part 2')
  })

  it('filters out turns with empty or invalid parts', () => {
    const raw = [
      { role: 'user', parts: [] },
      { role: 'user', parts: [{ text: 'Valid user query' }] },
      { role: 'model', parts: [{}] }, // empty part object without text or functionCall
    ]
    const sanitized = sanitizeGeminiContents(raw)
    expect(sanitized.length).toBe(1)
    expect(sanitized[0].role).toBe('user')
    expect(sanitized[0].parts[0].text).toBe('Valid user query')
  })

  it('normalizes role: function to user and preserves functionResponse parts', () => {
    const raw = [
      { role: 'user', parts: [{ text: 'Berapa pengeluaran saya?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'query_database', args: {} } }] },
      {
        role: 'function',
        parts: [{ functionResponse: { name: 'query_database', response: { content: { total: 50000 } } } }],
      },
    ]
    const sanitized = sanitizeGeminiContents(raw)
    expect(sanitized.length).toBe(3)
    expect(sanitized[0].role).toBe('user')
    expect(sanitized[1].role).toBe('model')
    expect(sanitized[2].role).toBe('user')
    expect(sanitized[2].parts[0].functionResponse).toBeDefined()
    expect(sanitized[2].parts[0].functionResponse.name).toBe('query_database')
  })
})
