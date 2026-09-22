import { describe, it, expect, vi } from 'vitest'
import {
  withRetry,
  calculateRetryDelay,
  isRetryableStatus,
  isRetryableError,
  NonRetryableError,
  RetryableError,
} from '../src/lib/ai/withRetry'
import {
  bufferToHex,
  hexToBuffer,
  bufferToBase64Url,
  base64UrlToBuffer,
} from '../src/lib/cryptoUtils'
import { parseCsvStatement } from '../src/lib/statementParser'

describe('Empirical Adversarial Suite: Milestone R1', () => {
  describe('1. AI Retry Resilience & Boundary Stress-Testing', () => {
    describe('isRetryableStatus and isRetryableError classifications', () => {
      it('classifies retryable HTTP statuses accurately', () => {
        expect(isRetryableStatus(429)).toBe(true)
        expect(isRetryableStatus(408)).toBe(true)
        expect(isRetryableStatus(500)).toBe(true)
        expect(isRetryableStatus(502)).toBe(true)
        expect(isRetryableStatus(503)).toBe(true)
        expect(isRetryableStatus(504)).toBe(true)
        expect(isRetryableStatus(599)).toBe(true)
      })

      it('classifies non-retryable HTTP statuses accurately', () => {
        expect(isRetryableStatus(200)).toBe(false)
        expect(isRetryableStatus(400)).toBe(false)
        expect(isRetryableStatus(401)).toBe(false)
        expect(isRetryableStatus(403)).toBe(false)
        expect(isRetryableStatus(404)).toBe(false)
        expect(isRetryableStatus(422)).toBe(false)
      })

      it('evaluates error types and properties correctly', () => {
        expect(isRetryableError(new RetryableError('Transient'))).toBe(true)
        expect(isRetryableError(new NonRetryableError('Permanent'))).toBe(false)
        expect(isRetryableError(null)).toBe(false)
        expect(isRetryableError(undefined)).toBe(false)
      })
    })
    describe('calculateRetryDelay boundary conditions', () => {
      it('attempt 0: nominal delay is baseDelayMs and stays within +/- 20% jitter bounds', () => {
        const baseDelayMs = 1000
        for (let i = 0; i < 100; i++) {
          const delay = calculateRetryDelay(0, { baseDelayMs, multiplier: 2, jitterFactor: 0.2 })
          expect(delay).toBeGreaterThanOrEqual(800)
          expect(delay).toBeLessThanOrEqual(1200)
        }
      })

      it('attempt 1: nominal delay is 2000ms and stays within +/- 20% jitter bounds', () => {
        const baseDelayMs = 1000
        for (let i = 0; i < 100; i++) {
          const delay = calculateRetryDelay(1, { baseDelayMs, multiplier: 2, jitterFactor: 0.2 })
          expect(delay).toBeGreaterThanOrEqual(1600)
          expect(delay).toBeLessThanOrEqual(2400)
        }
      })

      it('attempt 10: capped at maxDelayMs (30000ms nominal) and stays within jitter bounds', () => {
        const baseDelayMs = 1000
        const maxDelayMs = 30000
        for (let i = 0; i < 100; i++) {
          const delay = calculateRetryDelay(10, {
            baseDelayMs,
            multiplier: 2,
            maxDelayMs,
            jitterFactor: 0.2,
          })
          // nominal is 30000; with +/- 20%, bounds are [24000, 36000]
          expect(delay).toBeGreaterThanOrEqual(24000)
          expect(delay).toBeLessThanOrEqual(36000)
        }
      })

      it('strictly enforces maxDelay ceiling when jitterFactor is 0', () => {
        const ceilings = [500, 2500, 5000, 15000, 30000]
        for (const maxDelay of ceilings) {
          const delay = calculateRetryDelay(15, {
            baseDelayMs: 1000,
            multiplier: 2,
            maxDelayMs: maxDelay,
            jitterFactor: 0,
          })
          expect(delay).toBe(maxDelay)
        }
      })

      it('verifies non-zero jitter distribution and spread over 500 samples', () => {
        const samples = []
        for (let i = 0; i < 500; i++) {
          samples.push(calculateRetryDelay(0, { baseDelayMs: 1000, multiplier: 2, jitterFactor: 0.2 }))
        }

        const min = Math.min(...samples)
        const max = Math.max(...samples)
        const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length
        const variance = samples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / samples.length
        const stdDev = Math.sqrt(variance)

        // Ensure non-zero variance and realistic jitter distribution
        expect(variance).toBeGreaterThan(0)
        expect(stdDev).toBeGreaterThan(50)
        expect(min).toBeGreaterThanOrEqual(800)
        expect(min).toBeLessThan(900)
        expect(max).toBeGreaterThan(1100)
        expect(max).toBeLessThanOrEqual(1200)
        expect(mean).toBeGreaterThan(950)
        expect(mean).toBeLessThan(1050)
      })

      it('deterministic boundary checks with injected RNG', () => {
        const options = { baseDelayMs: 1000, multiplier: 2, jitterFactor: 0.2 }

        // rng = 0.0 -> lowest boundary (-20%): 800ms
        expect(calculateRetryDelay(0, { ...options, randomFn: () => 0.0 })).toBe(800)

        // rng = 1.0 -> highest boundary (+20%): 1200ms
        expect(calculateRetryDelay(0, { ...options, randomFn: () => 1.0 })).toBe(1200)

        // rng = 0.5 -> center point (0% jitter): 1000ms
        expect(calculateRetryDelay(0, { ...options, randomFn: () => 0.5 })).toBe(1000)
      })
    })

    describe('Immediate abort on HTTP 400, 401, 403, and invalid keys with 0 retries and 0ms sleep', () => {
      const nonRetryableScenarios = [
        { desc: 'HTTP 400 Bad Request', err: Object.assign(new Error('Bad Request'), { status: 400 }) },
        { desc: 'HTTP 401 Unauthorized', err: Object.assign(new Error('Unauthorized'), { status: 401 }) },
        { desc: 'HTTP 403 Forbidden', err: Object.assign(new Error('Forbidden'), { status: 403 }) },
        { desc: 'HTTP 404 Not Found', err: Object.assign(new Error('Not Found'), { status: 404 }) },
        { desc: 'API key not valid message', err: new Error('API key not valid. Please pass a valid API key.') },
        { desc: 'API_KEY_INVALID message', err: new Error('API_KEY_INVALID: Your key has expired') },
        { desc: 'API key expired message', err: new Error('Google Gemini API key expired') },
        { desc: 'OAuth 2 access token message', err: new Error('OAuth 2 access token has expired') },
        { desc: 'invalid authentication credentials message', err: new Error('Request has invalid authentication credentials') },
        { desc: 'Indonesian invalid key message', err: new Error('Kredensial API Key tidak valid') },
        { desc: 'Indonesian auth issue message', err: new Error('Terjadi kendala otentikasi saat memanggil AI') },
        { desc: 'Direct NonRetryableError instance', err: new NonRetryableError('Permanent client configuration error') },
      ]

      nonRetryableScenarios.forEach(({ desc, err }) => {
        it(`aborts immediately on ${desc}: 1 execution, 0 retries, 0ms sleep`, async () => {
          const fn = vi.fn().mockRejectedValue(err)
          const sleepFn = vi.fn().mockResolvedValue(undefined)
          const onRetry = vi.fn()

          await expect(
            withRetry(fn, {
              maxRetries: 2,
              sleepFn,
              onRetry,
            })
          ).rejects.toThrow()

          expect(fn).toHaveBeenCalledTimes(1)
          expect(sleepFn).not.toHaveBeenCalled()
          expect(onRetry).not.toHaveBeenCalled()
        })
      })

      it('aborts immediately when error has isRetryable: false explicit property', async () => {
        const customErr = new Error('Custom failure')
        customErr.isRetryable = false
        const fn = vi.fn().mockRejectedValue(customErr)
        const sleepFn = vi.fn().mockResolvedValue(undefined)

        await expect(withRetry(fn, { maxRetries: 2, sleepFn })).rejects.toThrow('Custom failure')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(sleepFn).not.toHaveBeenCalled()
      })
    })

    describe('Retryable error recognition across transient network/server conditions', () => {
      const retryableScenarios = [
        { desc: 'status 429', err: Object.assign(new Error('Rate Limit'), { status: 429 }) },
        { desc: 'status 408', err: Object.assign(new Error('Request Timeout'), { status: 408 }) },
        { desc: 'status 500', err: Object.assign(new Error('Internal Server Error'), { status: 500 }) },
        { desc: 'status 502', err: Object.assign(new Error('Bad Gateway'), { status: 502 }) },
        { desc: 'status 503', err: Object.assign(new Error('Service Unavailable'), { status: 503 }) },
        { desc: 'status 504', err: Object.assign(new Error('Gateway Timeout'), { status: 504 }) },
        { desc: 'AbortError', err: Object.assign(new Error('Aborted'), { name: 'AbortError' }) },
        { desc: 'RESOURCE_EXHAUSTED keyword', err: new Error('RESOURCE_EXHAUSTED: quota exceeded') },
        { desc: 'rate limit keyword', err: new Error('Rate limit exceeded for model') },
        { desc: 'failed to fetch keyword', err: new Error('TypeError: Failed to fetch') },
        { desc: 'NetworkError keyword', err: new Error('NetworkError when attempting to fetch resource.') },
        { desc: 'isRetryable: true flag', err: Object.assign(new Error('Custom transient error'), { isRetryable: true }) },
      ]

      retryableScenarios.forEach(({ desc, err }) => {
        it(`correctly retries on ${desc} and succeeds on attempt 2`, async () => {
          const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce('ok')
          const sleepFn = vi.fn().mockResolvedValue(undefined)

          const res = await withRetry(fn, { maxRetries: 2, sleepFn, jitterFactor: 0 })
          expect(res).toBe('ok')
          expect(fn).toHaveBeenCalledTimes(2)
          expect(sleepFn).toHaveBeenCalledTimes(1)
        })
      })
    })

    describe('HTTP 429 and transient error retry ceiling', () => {
      it('HTTP 429 retries at most 2 times (total 3 attempts) before failing', async () => {
        const err429 = Object.assign(new Error('Resource exhausted / Rate limit'), { status: 429 })
        const fn = vi.fn().mockRejectedValue(err429)
        const sleepCalls = []
        const sleepFn = vi.fn().mockImplementation((ms) => {
          sleepCalls.push(ms)
          return Promise.resolve()
        })
        const onRetryCalls = []
        const onRetry = vi.fn().mockImplementation((info) => {
          onRetryCalls.push(info)
        })

        await expect(
          withRetry(fn, {
            maxRetries: 2,
            baseDelayMs: 1000,
            multiplier: 2,
            jitterFactor: 0,
            sleepFn,
            onRetry,
          })
        ).rejects.toThrow('Resource exhausted / Rate limit')

        // Total 3 executions: attempt 0, attempt 1, attempt 2
        expect(fn).toHaveBeenCalledTimes(3)
        // Sleep called 2 times: after attempt 0 (1000ms), after attempt 1 (2000ms)
        expect(sleepFn).toHaveBeenCalledTimes(2)
        expect(sleepCalls).toEqual([1000, 2000])
        // onRetry callback invoked 2 times
        expect(onRetry).toHaveBeenCalledTimes(2)
        expect(onRetryCalls[0].attempt).toBe(1)
        expect(onRetryCalls[0].delayMs).toBe(1000)
        expect(onRetryCalls[1].attempt).toBe(2)
        expect(onRetryCalls[1].delayMs).toBe(2000)
      })

      it('recovers on 3rd attempt if HTTP 429 clears', async () => {
        const err429 = Object.assign(new Error('Rate limit'), { status: 429 })
        const fn = vi.fn()
          .mockRejectedValueOnce(err429)
          .mockRejectedValueOnce(err429)
          .mockResolvedValueOnce('success on attempt 3')

        const sleepFn = vi.fn().mockResolvedValue(undefined)

        const result = await withRetry(fn, {
          maxRetries: 2,
          sleepFn,
          jitterFactor: 0,
        })

        expect(result).toBe('success on attempt 3')
        expect(fn).toHaveBeenCalledTimes(3)
        expect(sleepFn).toHaveBeenCalledTimes(2)
      })

      it('respects custom maxRetries parameter', async () => {
        const err503 = Object.assign(new Error('Service Unavailable'), { status: 503 })
        const fn = vi.fn().mockRejectedValue(err503)
        const sleepFn = vi.fn().mockResolvedValue(undefined)

        // With maxRetries: 1 -> total 2 attempts
        await expect(
          withRetry(fn, { maxRetries: 1, sleepFn })
        ).rejects.toThrow()
        expect(fn).toHaveBeenCalledTimes(2)
        expect(sleepFn).toHaveBeenCalledTimes(1)

        // With maxRetries: 0 -> total 1 attempt, 0 retries
        fn.mockClear()
        sleepFn.mockClear()
        await expect(
          withRetry(fn, { maxRetries: 0, sleepFn })
        ).rejects.toThrow()
        expect(fn).toHaveBeenCalledTimes(1)
        expect(sleepFn).not.toHaveBeenCalled()
      })
    })
  })

  describe('2. CryptoUtils Binary & Encoding Stress-Testing', () => {
    describe('bufferToHex', () => {
      it('handles empty and nullish inputs gracefully without throwing', () => {
        expect(bufferToHex(null)).toBe('')
        expect(bufferToHex(undefined)).toBe('')
        expect(bufferToHex(new Uint8Array(0))).toBe('')
        expect(bufferToHex(new ArrayBuffer(0))).toBe('')
      })

      it('converts full byte range 0x00 to 0xFF with exact zero-padding', () => {
        const allBytes = new Uint8Array(256)
        for (let i = 0; i < 256; i++) {
          allBytes[i] = i
        }
        const hex = bufferToHex(allBytes)
        expect(hex.length).toBe(512)
        expect(hex.startsWith('00010203')).toBe(true)
        expect(hex.endsWith('fcfdfeff')).toBe(true)
      })

      it('handles large buffers (10,000 bytes)', () => {
        const large = new Uint8Array(10000).fill(0xab)
        const hex = bufferToHex(large)
        expect(hex.length).toBe(20000)
        expect(hex).toBe('ab'.repeat(10000))
      })
    })

    describe('hexToBuffer', () => {
      it('handles empty, whitespace, and nullish inputs gracefully', () => {
        expect(hexToBuffer(null)).toEqual(new Uint8Array(0))
        expect(hexToBuffer(undefined)).toEqual(new Uint8Array(0))
        expect(hexToBuffer('')).toEqual(new Uint8Array(0))
        expect(hexToBuffer('   \t\n  ')).toEqual(new Uint8Array(0))
      })

      it('correctly pads odd-length hex strings with leading zero', () => {
        // 'a' -> '0a' -> [10]
        expect(Array.from(hexToBuffer('a'))).toEqual([10])
        // 'f10' -> '0f10' -> [15, 16]
        expect(Array.from(hexToBuffer('f10'))).toEqual([15, 16])
        // '123' -> '0123' -> [1, 35]
        expect(Array.from(hexToBuffer('123'))).toEqual([1, 35])
        // '12345' -> '012345' -> [1, 35, 69]
        expect(Array.from(hexToBuffer('12345'))).toEqual([1, 35, 69])
      })

      it('handles mixed case and uppercase hex correctly', () => {
        const lower = hexToBuffer('deadbeef')
        const upper = hexToBuffer('DEADBEEF')
        const mixed = hexToBuffer('DeAdBeEf')
        expect(Array.from(lower)).toEqual([0xde, 0xad, 0xbe, 0xef])
        expect(Array.from(upper)).toEqual(Array.from(lower))
        expect(Array.from(mixed)).toEqual(Array.from(lower))
      })

      it('roundtrips buffer -> hex -> buffer across various buffer sizes', () => {
        const sizes = [1, 2, 3, 4, 7, 16, 32, 64, 128, 512]
        for (const size of sizes) {
          const original = new Uint8Array(size)
          for (let i = 0; i < size; i++) {
            original[i] = (i * 37 + 13) % 256
          }
          const hex = bufferToHex(original)
          const restored = hexToBuffer(hex)
          expect(Array.from(restored)).toEqual(Array.from(original))
        }
      })
    })

    describe('bufferToBase64Url & base64UrlToBuffer', () => {
      it('handles empty and nullish inputs gracefully', () => {
        expect(bufferToBase64Url(null)).toBe('')
        expect(bufferToBase64Url(undefined)).toBe('')
        expect(bufferToBase64Url(new Uint8Array(0))).toBe('')
        expect(bufferToBase64Url(new ArrayBuffer(0))).toBe('')

        expect(base64UrlToBuffer(null).byteLength).toBe(0)
        expect(base64UrlToBuffer(undefined).byteLength).toBe(0)
        expect(base64UrlToBuffer('').byteLength).toBe(0)
        expect(base64UrlToBuffer('   ').byteLength).toBe(0)
      })

      it('produces URL-safe characters without +, /, or = padding', () => {
        // Test bytes that in standard base64 yield +, /, and padding '='
        const testBytes = new Uint8Array([251, 239, 255, 0, 1, 2])
        const b64url = bufferToBase64Url(testBytes)
        expect(b64url).not.toContain('+')
        expect(b64url).not.toContain('/')
        expect(b64url).not.toContain('=')
      })

      it('correctly handles all modulo-4 padding lengths (lengths: 1, 2, 3)', () => {
        // Length 1 byte (base64 length 4 with 2 padding '=', base64url length 2)
        const buf1 = new Uint8Array([0x42])
        const b64url1 = bufferToBase64Url(buf1)
        expect(b64url1.length).toBe(2)
        expect(Array.from(new Uint8Array(base64UrlToBuffer(b64url1)))).toEqual([0x42])

        // Length 2 bytes (base64 length 4 with 1 padding '=', base64url length 3)
        const buf2 = new Uint8Array([0x42, 0x43])
        const b64url2 = bufferToBase64Url(buf2)
        expect(b64url2.length).toBe(3)
        expect(Array.from(new Uint8Array(base64UrlToBuffer(b64url2)))).toEqual([0x42, 0x43])

        // Length 3 bytes (base64 length 4 with 0 padding '=', base64url length 4)
        const buf3 = new Uint8Array([0x42, 0x43, 0x44])
        const b64url3 = bufferToBase64Url(buf3)
        expect(b64url3.length).toBe(4)
        expect(Array.from(new Uint8Array(base64UrlToBuffer(b64url3)))).toEqual([0x42, 0x43, 0x44])
      })

      it('roundtrips arbitrary binary data of variable lengths accurately', () => {
        for (let len = 1; len <= 100; len++) {
          const original = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            original[i] = (i * 79 + 17) % 256
          }
          const encoded = bufferToBase64Url(original)
          const decoded = new Uint8Array(base64UrlToBuffer(encoded))
          expect(Array.from(decoded)).toEqual(Array.from(original))
        }
      })

      it('roundtrips UTF-8 encoded text with special characters and symbols', () => {
        const text = 'FinTrack-Crypt0_Safety!@#$%^&*()_+-=[]{}|;:,.<>?/`~'
        const encodedBuf = new TextEncoder().encode(text)
        const b64url = bufferToBase64Url(encodedBuf)
        const decodedBuf = base64UrlToBuffer(b64url)
        const resultText = new TextDecoder().decode(decodedBuf)
        expect(resultText).toBe(text)
      })
    })
  })

  describe('3. Dynamic PapaParse Asynchronous & Malformed Input Handling', () => {
    it('returns a Promise resolving to { headers, rows } structure', async () => {
      const csv = 'Date,Merchant,Amount\n2026-09-01,Supermarket,150000'
      const promise = parseCsvStatement(csv)
      expect(promise).toBeInstanceOf(Promise)

      const result = await promise
      expect(result).toHaveProperty('headers')
      expect(result).toHaveProperty('rows')
      expect(result.headers).toEqual(['Date', 'Merchant', 'Amount'])
      expect(result.rows.length).toBe(1)
      expect(result.rows[0]).toEqual({
        Date: '2026-09-01',
        Merchant: 'Supermarket',
        Amount: '150000',
      })
    })

    it('handles empty CSV input cleanly without throwing', async () => {
      const emptyResult = await parseCsvStatement('')
      expect(emptyResult.headers).toEqual([])
      expect(emptyResult.rows).toEqual([])
    })

    it('handles whitespace-only CSV input without throwing or unhandled exceptions', async () => {
      const wsResult = await parseCsvStatement('   \n  \n  ')
      expect(Array.isArray(wsResult.headers)).toBe(true)
      expect(Array.isArray(wsResult.rows)).toBe(true)
      // Because skipEmptyLines is true (not 'greedy'), whitespace lines are retained
      expect(wsResult.headers).toEqual(['   '])
      expect(wsResult.rows.length).toBe(2)
    })

    it('handles CSV with quoted fields containing commas and linebreaks', async () => {
      const csv = 'Date,Description,Amount\n2026-09-01,"Coffee Shop, Jakarta\nBranch #2",45000\n2026-09-02,"Simple Store",12000'
      const result = await parseCsvStatement(csv)
      expect(result.rows.length).toBe(2)
      expect(result.rows[0].Description).toBe('Coffee Shop, Jakarta\nBranch #2')
      expect(result.rows[0].Amount).toBe('45000')
      expect(result.rows[1].Description).toBe('Simple Store')
    })

    it('handles malformed / jagged CSV gracefully without unhandled rejection', async () => {
      // Missing headers, uneven column counts, unclosed quotes
      const malformedCsv = 'Header1,Header2\nValue1\nValue2,Value3,ExtraValue4\n"Unclosed quote text,1234'
      const result = await parseCsvStatement(malformedCsv)
      expect(result).toBeDefined()
      expect(Array.isArray(result.headers)).toBe(true)
      expect(Array.isArray(result.rows)).toBe(true)
    })

    it('handles high volume CSV rows (1,000 rows) asynchronously without blocking', async () => {
      const rows = ['Date,Description,Amount,Type']
      for (let i = 0; i < 1000; i++) {
        rows.push(`2026-09-01,Transaction ${i},${1000 + i},DB`)
      }
      const largeCsv = rows.join('\n')

      const start = Date.now()
      const result = await parseCsvStatement(largeCsv)
      const duration = Date.now() - start

      expect(result.headers).toEqual(['Date', 'Description', 'Amount', 'Type'])
      expect(result.rows.length).toBe(1000)
      expect(duration).toBeLessThan(2000)
    })
  })
})
