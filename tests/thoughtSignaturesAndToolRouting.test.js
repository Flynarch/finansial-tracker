// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { processSseEventBlock } from '../src/lib/ai/streamParsers'
import { sanitizeGeminiContents } from '../src/lib/ai/sanitizer'

describe('Gemini 3 Thought Signatures & Function Calling Protocol', () => {
  describe('streamParsers.processSseEventBlock', () => {
    it('captures thought_signature attached to a functionCall part', () => {
      const state = { fullText: '', functionCall: null }
      const mockEvent = `data: ${JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'default_api:query_database',
                    args: { type: 'expense' },
                  },
                  thought_signature: 'sig_test_12345',
                },
              ],
            },
          },
        ],
      })}\n\n`

      processSseEventBlock(mockEvent, state)

      expect(state.functionCall).not.toBeNull()
      expect(state.functionCall.name).toBe('default_api:query_database')
      expect(state.functionCall.args).toEqual({ type: 'expense' })
      expect(state.functionCall.thought_signature).toBe('sig_test_12345')
      expect(state.functionCall.thoughtSignature).toBe('sig_test_12345')
    })

    it('captures camelCase thoughtSignature', () => {
      const state = { fullText: '', functionCall: null }
      const mockEvent = `data: ${JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'record_transactions',
                    args: { amount: 50000 },
                  },
                  thoughtSignature: 'sig_camel_abc',
                },
              ],
            },
          },
        ],
      })}\n\n`

      processSseEventBlock(mockEvent, state)

      expect(state.functionCall).not.toBeNull()
      expect(state.functionCall.thought_signature).toBe('sig_camel_abc')
    })

    it('does not leak internal reasoning thoughts (thought: true) into state.fullText', () => {
      const state = { fullText: '', functionCall: null }
      const onStream = vi.fn()

      const thoughtEvent = `data: ${JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Thinking step by step: user wants to see expenses...',
                  thought: true,
                },
              ],
            },
          },
        ],
      })}\n\n`

      processSseEventBlock(thoughtEvent, state, onStream)

      expect(state.fullText).toBe('')
      expect(onStream).not.toHaveBeenCalled()

      const normalEvent = `data: ${JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Berikut adalah ringkasan pengeluaran Anda:',
                },
              ],
            },
          },
        ],
      })}\n\n`

      processSseEventBlock(normalEvent, state, onStream)

      expect(state.fullText).toBe('Berikut adalah ringkasan pengeluaran Anda:')
      expect(onStream).toHaveBeenCalledWith('Berikut adalah ringkasan pengeluaran Anda:')
    })
  })

  describe('sanitizer.sanitizeGeminiContents', () => {
    it('preserves existing thought_signature on model functionCall parts', () => {
      const rawContents = [
        { role: 'user', parts: [{ text: 'Berapa pengeluaranku?' }] },
        {
          role: 'model',
          parts: [
            {
              functionCall: { name: 'default_api:query_database', args: {} },
              thought_signature: 'genuine_model_sig_789',
            },
          ],
        },
      ]

      const sanitized = sanitizeGeminiContents(rawContents)
      expect(sanitized).toHaveLength(2)
      expect(sanitized[1].parts[0].thought_signature).toBe('genuine_model_sig_789')
    })

    it('attaches official skip validator fallback signature when thought_signature is missing on model functionCall part', () => {
      const rawContents = [
        { role: 'user', parts: [{ text: 'Analisis keuanganku' }] },
        {
          role: 'model',
          parts: [
            {
              functionCall: { name: 'query_database', args: {} },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: { name: 'query_database', response: { content: { total: 1000 } } },
            },
          ],
        },
      ]

      const sanitized = sanitizeGeminiContents(rawContents)
      expect(sanitized).toHaveLength(3)
      // Must not fail with missing thought_signature
      expect(sanitized[1].parts[0].thought_signature).toBe('context_engineering_is_the_way_to_go')
    })
  })

  describe('chatService tool name normalization', () => {
    it('normalizes namespaced tool names like default_api:query_database', () => {
      const rawFnName = 'default_api:query_database'
      const fnName = rawFnName.includes(':') ? rawFnName.split(':').pop() : rawFnName
      expect(fnName).toBe('query_database')
    })

    it('normalizes namespaced record_transactions', () => {
      const rawFnName = 'default_api:record_transactions'
      const fnName = rawFnName.includes(':') ? rawFnName.split(':').pop() : rawFnName
      expect(fnName).toBe('record_transactions')
    })

    it('leaves standard tool names untouched', () => {
      const rawFnName = 'manage_budget'
      const fnName = rawFnName.includes(':') ? rawFnName.split(':').pop() : rawFnName
      expect(fnName).toBe('manage_budget')
    })
  })
})
