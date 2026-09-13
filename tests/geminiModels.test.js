import { describe, it, expect } from 'vitest'
import { FAST_TRANSACTION_MODELS, CHAT_ADVISOR_MODELS, GEMINI_MODELS } from '../src/lib/gemini'

describe('Gemini Model Arrays', () => {
  it('should configure FAST_TRANSACTION_MODELS with Gemini 3.x series', () => {
    expect(FAST_TRANSACTION_MODELS).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
    ])
  })

  it('should configure CHAT_ADVISOR_MODELS with Gemini 3.x series', () => {
    expect(CHAT_ADVISOR_MODELS).toEqual([
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ])
  })

  it('should configure GEMINI_MODELS with Gemini 3.x series', () => {
    expect(GEMINI_MODELS).toEqual([
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ])
  })
})
