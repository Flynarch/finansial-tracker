/**
 * Resilient retry utility with exponential backoff and jitter for AI API requests.
 * Specifically handles Gemini HTTP 429 (rate limit) and transient HTTP 5xx errors,
 * while immediately failing on non-retryable 4xx / authentication errors.
 */

export class NonRetryableError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'NonRetryableError'
    this.status = options.status || null
    this.cause = options.cause || null
    this.isRetryable = false
  }
}

export class RetryableError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'RetryableError'
    this.status = options.status || null
    this.cause = options.cause || null
    this.isRetryable = true
  }
}

/**
 * Determines whether an HTTP status code qualifies for retry.
 * @param {number} status - HTTP status code
 * @returns {boolean}
 */
export function isRetryableStatus(status) {
  if (status === 429) return true // Rate limit / Quota burst
  if (status === 408) return true // Request Timeout
  if (status >= 500 && status <= 599) return true // 500, 502, 503, 504
  return false
}

/**
 * Evaluates whether an error object or response qualifies for retry.
 * @param {Error|object} error - Error object to inspect
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!error) return false

  // Explicit type checks
  if (error instanceof NonRetryableError || error.isRetryable === false) {
    return false
  }
  if (error instanceof RetryableError || error.isRetryable === true) {
    return true
  }

  // HTTP status property
  if (typeof error.status === 'number') {
    if (isRetryableStatus(error.status)) return true
    if (error.status >= 400 && error.status < 500) return false
  }

  // Network / timeout
  if (error.name === 'AbortError') {
    return true
  }

  const msg = String(error.message || '')

  // Immediate abort keywords (Auth, Permissions, Malformed client request)
  if (
    msg.includes('API key not valid') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key expired') ||
    msg.includes('OAuth 2 access token') ||
    msg.includes('invalid authentication credentials') ||
    msg.includes('Kredensial API Key tidak valid') ||
    msg.includes('kendala otentikasi')
  ) {
    return false
  }

  // Retryable keywords
  const lowerMsg = msg.toLowerCase()
  if (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    lowerMsg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('UNAVAILABLE') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('networkerror')
  ) {
    return true
  }

  return false
}

/**
 * Calculates exponential backoff delay with random jitter.
 *
 * @param {number} attempt - Zero-based retry attempt (0 = 1st retry, 1 = 2nd retry)
 * @param {object} [options={}]
 * @param {number} [options.baseDelayMs=1000] - Base delay in milliseconds
 * @param {number} [options.multiplier=2] - Exponential growth factor
 * @param {number} [options.maxDelayMs=30000] - Maximum allowable delay ceiling
 * @param {'percentage'|'additive'} [options.jitterMode='percentage'] - Jitter calculation strategy
 * @param {number} [options.jitterFactor=0.2] - Jitter factor for percentage mode (+/- 20%)
 * @param {number} [options.jitterMaxMs=500] - Max additive jitter in ms
 * @param {Function} [options.randomFn=Math.random] - RNG function for deterministic testing
 * @returns {number} Backoff delay in milliseconds
 */
export function calculateRetryDelay(attempt, {
  baseDelayMs = 1000,
  multiplier = 2,
  maxDelayMs = 30000,
  jitterMode = 'percentage',
  jitterFactor = 0.2,
  jitterMaxMs = 500,
  randomFn = Math.random,
} = {}) {
  const nominalDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(multiplier, attempt))

  if (jitterMode === 'additive') {
    const jitter = randomFn() * jitterMaxMs
    return Math.max(0, Math.round(nominalDelay + jitter))
  }

  if (!jitterFactor || jitterFactor <= 0) {
    return nominalDelay
  }

  // Uniform distribution in [-delta, +delta]
  const delta = nominalDelay * jitterFactor
  const jitter = (randomFn() * 2 - 1) * delta
  return Math.max(0, Math.round(nominalDelay + jitter))
}

/**
 * Executes an async task with automated exponential backoff and jitter retry.
 *
 * @template T
 * @param {(attempt: number) => Promise<T>} fn - Async task to execute receiving current attempt index
 * @param {object} [options={}]
 * @param {number} [options.maxRetries=2] - Max retries (default 2 retries = 3 total attempts)
 * @param {number} [options.baseDelayMs=1000] - Base delay in milliseconds
 * @param {number} [options.multiplier=2] - Multiplier factor
 * @param {number} [options.maxDelayMs=30000] - Maximum delay ceiling
 * @param {'percentage'|'additive'} [options.jitterMode='percentage'] - Jitter calculation mode
 * @param {number} [options.jitterFactor=0.2] - Jitter factor percentage
 * @param {number} [options.jitterMaxMs=500] - Additive jitter max ms
 * @param {Function} [options.sleepFn] - Sleep function (injectable for testing)
 * @param {Function} [options.randomFn=Math.random] - Random function
 * @param {Function} [options.isRetryable=isRetryableError] - Custom error inspector
 * @param {Function} [options.onRetry=null] - Retry event callback ({ attempt, maxRetries, delayMs, error })
 * @returns {Promise<T>}
 */
export async function withRetry(fn, {
  maxRetries = 2,
  baseDelayMs = 1000,
  multiplier = 2,
  maxDelayMs = 30000,
  jitterMode = 'percentage',
  jitterFactor = 0.2,
  jitterMaxMs = 500,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  randomFn = Math.random,
  isRetryable = isRetryableError,
  onRetry = null,
} = {}) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastError = err

      // Check retryability: abort immediately on non-retryable conditions
      if (!isRetryable(err)) {
        if (err instanceof NonRetryableError) {
          throw err
        }
        throw new NonRetryableError(err.message, {
          status: err.status,
          cause: err,
        })
      }

      // If attempts exhausted, rethrow
      if (attempt >= maxRetries) {
        throw err
      }

      // Calculate backoff delay with jitter
      const delayMs = calculateRetryDelay(attempt, {
        baseDelayMs,
        multiplier,
        maxDelayMs,
        jitterMode,
        jitterFactor,
        jitterMaxMs,
        randomFn,
      })

      if (typeof onRetry === 'function') {
        try {
          onRetry({
            attempt: attempt + 1,
            maxRetries,
            delayMs,
            error: err,
          })
        } catch {
          // Prevent listener exceptions from breaking retry cycle
        }
      }

      await sleepFn(delayMs)
    }
  }

  throw lastError
}
