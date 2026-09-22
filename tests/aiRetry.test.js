import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withRetry,
  calculateRetryDelay,
  isRetryableStatus,
  isRetryableError,
  NonRetryableError,
  RetryableError,
} from '../src/lib/ai/withRetry'
import { callApiWithFallback, callApiStreamWithFallback } from '../src/lib/ai/client'
import useSettingsStore from '../src/store/useSettingsStore'

describe('AI Retry Utilities (src/lib/ai/withRetry.js)', () => {
  describe('calculateRetryDelay', () => {
    it('calculates exact exponential progression without jitter', () => {
      const options = { baseDelayMs: 1000, multiplier: 2, jitterFactor: 0 }
      expect(calculateRetryDelay(0, options)).toBe(1000)
      expect(calculateRetryDelay(1, options)).toBe(2000)
      expect(calculateRetryDelay(2, options)).toBe(4000)
    })

    it('respects percentage jitter bounds (+/- 20%)', () => {
      for (let i = 0; i < 20; i++) {
        const delay0 = calculateRetryDelay(0, { baseDelayMs: 1000, multiplier: 2, jitterFactor: 0.2 })
        expect(delay0).toBeGreaterThanOrEqual(800)
        expect(delay0).toBeLessThanOrEqual(1200)

        const delay1 = calculateRetryDelay(1, { baseDelayMs: 1000, multiplier: 2, jitterFactor: 0.2 })
        expect(delay1).toBeGreaterThanOrEqual(1600)
        expect(delay1).toBeLessThanOrEqual(2400)
      }
    })

    it('respects additive jitter bounds (0-500ms)', () => {
      for (let i = 0; i < 20; i++) {
        const delay0 = calculateRetryDelay(0, {
          baseDelayMs: 1000,
          multiplier: 2,
          jitterMode: 'additive',
          jitterMaxMs: 500,
        })
        expect(delay0).toBeGreaterThanOrEqual(1000)
        expect(delay0).toBeLessThanOrEqual(1500)

        const delay1 = calculateRetryDelay(1, {
          baseDelayMs: 1000,
          multiplier: 2,
          jitterMode: 'additive',
          jitterMaxMs: 500,
        })
        expect(delay1).toBeGreaterThanOrEqual(2000)
        expect(delay1).toBeLessThanOrEqual(2500)
      }
    })

    it('enforces maximum delay ceiling', () => {
      const delay = calculateRetryDelay(10, { baseDelayMs: 1000, multiplier: 2, maxDelayMs: 5000, jitterFactor: 0 })
      expect(delay).toBe(5000)
    })

    it('supports deterministic random injection', () => {
      // randomFn returning 1.0 (max positive jitter +20%)
      const delayMax = calculateRetryDelay(0, {
        baseDelayMs: 1000,
        multiplier: 2,
        jitterFactor: 0.2,
        randomFn: () => 1,
      })
      expect(delayMax).toBe(1200)

      // randomFn returning 0.0 (max negative jitter -20%)
      const delayMin = calculateRetryDelay(0, {
        baseDelayMs: 1000,
        multiplier: 2,
        jitterFactor: 0.2,
        randomFn: () => 0,
      })
      expect(delayMin).toBe(800)

      // randomFn returning 0.5 (neutral jitter 0%)
      const delayMid = calculateRetryDelay(0, {
        baseDelayMs: 1000,
        multiplier: 2,
        jitterFactor: 0.2,
        randomFn: () => 0.5,
      })
      expect(delayMid).toBe(1000)
    })
  })

  describe('isRetryableStatus', () => {
    it('classifies 429, 408, and 5xx as retryable', () => {
      expect(isRetryableStatus(429)).toBe(true)
      expect(isRetryableStatus(408)).toBe(true)
      expect(isRetryableStatus(500)).toBe(true)
      expect(isRetryableStatus(502)).toBe(true)
      expect(isRetryableStatus(503)).toBe(true)
      expect(isRetryableStatus(504)).toBe(true)
    })

    it('classifies non-retryable statuses as false', () => {
      expect(isRetryableStatus(200)).toBe(false)
      expect(isRetryableStatus(400)).toBe(false)
      expect(isRetryableStatus(401)).toBe(false)
      expect(isRetryableStatus(403)).toBe(false)
      expect(isRetryableStatus(404)).toBe(false)
    })
  })

  describe('isRetryableError', () => {
    it('returns false for NonRetryableError and true for RetryableError', () => {
      expect(isRetryableError(new NonRetryableError('Permanent failure'))).toBe(false)
      expect(isRetryableError(new RetryableError('Transient failure'))).toBe(true)
    })

    it('returns true for HTTP status 429 and 503', () => {
      const err429 = new Error('Too many requests')
      err429.status = 429
      expect(isRetryableError(err429)).toBe(true)

      const err503 = new Error('Service unavailable')
      err503.status = 503
      expect(isRetryableError(err503)).toBe(true)
    })

    it('returns false for HTTP 400, 401, 403, 404', () => {
      const err401 = new Error('Unauthorized')
      err401.status = 401
      expect(isRetryableError(err401)).toBe(false)

      const err400 = new Error('Bad request')
      err400.status = 400
      expect(isRetryableError(err400)).toBe(false)

      const err404 = new Error('Not found')
      err404.status = 404
      expect(isRetryableError(err404)).toBe(false)
    })

    it('returns true for AbortError and network errors', () => {
      const abortErr = new Error('The user aborted a request.')
      abortErr.name = 'AbortError'
      expect(isRetryableError(abortErr)).toBe(true)

      expect(isRetryableError(new Error('Failed to fetch'))).toBe(true)
      expect(isRetryableError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true)
    })

    it('returns false for API key authentication errors', () => {
      expect(isRetryableError(new Error('API key not valid. Please pass a valid API key.'))).toBe(false)
      expect(isRetryableError(new Error('API_KEY_INVALID: expired token'))).toBe(false)
      expect(isRetryableError(new Error('Kredensial API Key tidak valid'))).toBe(false)
      expect(isRetryableError(new Error('kendala otentikasi'))).toBe(false)
    })

    it('returns false for null, undefined, or generic unclassified errors', () => {
      expect(isRetryableError(null)).toBe(false)
      expect(isRetryableError(undefined)).toBe(false)
      expect(isRetryableError(new Error('Some generic logic error'))).toBe(false)
    })
  })

  describe('withRetry core runner', () => {
    it('returns immediately when first attempt succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const sleepFn = vi.fn().mockResolvedValue(undefined)

      const result = await withRetry(fn, { maxRetries: 2, sleepFn })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(sleepFn).not.toHaveBeenCalled()
    })

    it('retries on retryable error and succeeds on second attempt', async () => {
      const err = new RetryableError('Rate limit', { status: 429 })
      const fn = vi.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce('recovered')
      const sleepFn = vi.fn().mockResolvedValue(undefined)

      const result = await withRetry(fn, { maxRetries: 2, sleepFn, jitterFactor: 0 })
      expect(result).toBe('recovered')
      expect(fn).toHaveBeenCalledTimes(2)
      expect(sleepFn).toHaveBeenCalledTimes(1)
      expect(sleepFn).toHaveBeenCalledWith(1000)
    })

    it('retries up to maxRetries (total 3 attempts) before throwing', async () => {
      const err = new RetryableError('Persistent 503', { status: 503 })
      const fn = vi.fn().mockRejectedValue(err)
      const sleepFn = vi.fn().mockResolvedValue(undefined)

      await expect(withRetry(fn, { maxRetries: 2, sleepFn, jitterFactor: 0 })).rejects.toThrow('Persistent 503')
      expect(fn).toHaveBeenCalledTimes(3) // attempt 0, attempt 1, attempt 2
      expect(sleepFn).toHaveBeenCalledTimes(2) // between attempt 0-1 and 1-2
      expect(sleepFn).toHaveBeenNthCalledWith(1, 1000)
      expect(sleepFn).toHaveBeenNthCalledWith(2, 2000)
    })

    it('aborts immediately with 0 retries and 0 sleep on NonRetryableError', async () => {
      const err = new NonRetryableError('Invalid key', { status: 401 })
      const fn = vi.fn().mockRejectedValue(err)
      const sleepFn = vi.fn().mockResolvedValue(undefined)

      await expect(withRetry(fn, { maxRetries: 2, sleepFn })).rejects.toThrow('Invalid key')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(sleepFn).not.toHaveBeenCalled()
    })

    it('aborts immediately on 400 Bad Request error', async () => {
      const err = new Error('Bad request syntax')
      err.status = 400
      const fn = vi.fn().mockRejectedValue(err)
      const sleepFn = vi.fn().mockResolvedValue(undefined)

      await expect(withRetry(fn, { maxRetries: 2, sleepFn })).rejects.toThrow('Bad request syntax')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(sleepFn).not.toHaveBeenCalled()
    })

    it('invokes onRetry callback with attempt details', async () => {
      const err = new RetryableError('Rate limit', { status: 429 })
      const fn = vi.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce('ok')
      const sleepFn = vi.fn().mockResolvedValue(undefined)
      const onRetry = vi.fn()

      await withRetry(fn, { maxRetries: 2, sleepFn, onRetry, jitterFactor: 0 })
      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith({
        attempt: 1,
        maxRetries: 2,
        delayMs: 1000,
        error: err,
      })
    })
  })

  describe('Integration with client.js', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
      const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim()
      useSettingsStore.setState({ geminiApiKey: envKey || 'AIzaSyFakeKeyForTestingPurposes123456' })
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('callApiWithFallback retries on HTTP 429 and succeeds on next attempt', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined)

      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ error: { message: 'Resource exhausted' } }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Berhasil setelah retry' }] } }],
          }),
        }
      })

      const res = await callApiWithFallback([{ role: 'user', parts: [{ text: 'Halo' }] }], {
        models: ['gemini-3.8-flash'],
        retryOptions: { sleepFn: mockSleep },
      })

      expect(res.text).toBe('Berhasil setelah retry')
      expect(callCount).toBe(2)
      expect(mockSleep).toHaveBeenCalledTimes(1)
    })

    it('callApiWithFallback aborts immediately on 401 without retry', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined)

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'API key not valid' } }),
      })

      await expect(callApiWithFallback([{ role: 'user', parts: [{ text: 'Halo' }] }], {
        models: ['gemini-3.8-flash'],
        retryOptions: { sleepFn: mockSleep },
      })).rejects.toThrow()

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(mockSleep).not.toHaveBeenCalled()
    })

    it('callApiStreamWithFallback retries connection on 429 before stream starts', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined)

      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Rate limit exceeded',
          }
        }
        // Mock readable stream for SSE
        const sseContent = 'data: {"candidates":[{"content":{"parts":[{"text":"Streamed response"}]}}]}\n\n'
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sseContent))
            controller.close()
          },
        })
        return {
          ok: true,
          status: 200,
          body: stream,
        }
      })

      const res = await callApiStreamWithFallback([{ role: 'user', parts: [{ text: 'Halo' }] }], {
        models: ['gemini-3.8-flash'],
        retryOptions: { sleepFn: mockSleep },
      })

      expect(res.text).toBe('Streamed response')
      expect(callCount).toBe(2)
      expect(mockSleep).toHaveBeenCalledTimes(1)
    })

    it('callApiStreamWithFallback does NOT retry if error occurs mid-stream after text emitted', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined)

      const sseContent = 'data: {"candidates":[{"content":{"parts":[{"text":"Partial data"}]}}]}\n\n'
      const encoder = new TextEncoder()
      let streamReadCount = 0

      const stream = new ReadableStream({
        pull(controller) {
          streamReadCount++
          if (streamReadCount === 1) {
            controller.enqueue(encoder.encode(sseContent))
          } else {
            controller.error(new Error('Network disconnected mid-stream'))
          }
        },
      })

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      })

      await expect(callApiStreamWithFallback([{ role: 'user', parts: [{ text: 'Halo' }] }], {
        models: ['gemini-3.8-flash'],
        retryOptions: { sleepFn: mockSleep },
      })).rejects.toThrow('Network disconnected mid-stream')

      // Since text was already emitted, it should NOT retry
      expect(mockSleep).not.toHaveBeenCalled()
    })
  })
})
