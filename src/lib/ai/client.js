/**
 * Gemini API client, key management, models, and network transport for FinTrack AI.
 */
import useSettingsStore from '../../store/useSettingsStore'
import { processSseEventBlock } from './streamParsers'
import { withRetry, NonRetryableError, RetryableError } from './withRetry'
import { sanitizeGeminiContents } from './sanitizer'

export const FAST_TRANSACTION_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
]

export const CHAT_ADVISOR_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro',
]

export const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro',
]

/**
 * Resolves the currently active Gemini API key from store or environment variables.
 * @returns {string} Cleaned API key string or empty string
 */
export function getEffectiveApiKey() {
  try {
    const userKey = useSettingsStore.getState().geminiApiKey
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // ignore
  }
  const envKey = import.meta.env.VITE_GEMINI_API_KEY || ''
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

/**
 * Returns list of API keys to attempt in order (user key first, then fallback env key).
 * @returns {{ keysToTry: Array<{ key: string, isUserKey: boolean }>, hasUserKey: boolean }}
 */
export function getApiKeysToTry() {
  const userKey = (useSettingsStore.getState().geminiApiKey || '').trim().replace(/^["']|["']$/g, '')
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
  const keysToTry = []
  if (userKey && userKey.length > 5) {
    keysToTry.push({ key: userKey, isUserKey: true })
  }
  if (envKey && envKey.length > 5 && envKey !== userKey) {
    keysToTry.push({ key: envKey, isUserKey: false })
  }
  return { keysToTry, hasUserKey: Boolean(userKey && userKey.length > 5) }
}

/**
 * Translates raw API error text and HTTP statuses into friendly localized messages.
 * @param {string} errText - Raw error response body
 * @param {number} status - HTTP status code
 * @param {boolean} [isUserKey=true] - Whether request was made with user key
 * @returns {string} Localized error message
 */
export function parseApiErrorMessage(errText, status, isUserKey = true) {
  if (status === 429) {
    return isUserKey
      ? 'Batas kuota harian atau kecepatan API Key Anda tercapai (Rate Limit). Silakan tunggu beberapa saat lagi.'
      : 'Batas kuota harian AI bawaan sistem tercapai (Rate Limit). Silakan gunakan API Key pribadi di menu Pengaturan > Integrasi AI.'
  }
  if (status === 404) {
    return 'Model AI tidak ditemukan untuk versi API ini.'
  }
  if (!errText) return 'Terjadi kendala saat menghubungi server AI.'
  try {
    const parsed = JSON.parse(errText)
    if (parsed?.error?.message) {
      const msg = parsed.error.message
      if (
        msg.includes('API key not valid') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('API key expired') ||
        msg.includes('OAuth 2 access token') ||
        msg.includes('invalid authentication credentials')
      ) {
        return isUserKey
          ? 'Kredensial API Key tidak valid. Silakan periksa kembali API Key Anda di menu Pengaturan > Integrasi AI.'
          : 'Layanan AI bawaan sistem sedang mengalami kendala otentikasi. Silakan tambahkan API Key pribadi Anda di menu Pengaturan > Integrasi AI.'
      }
      return msg
    }
  } catch {
    // ignore
  }
  return errText
}

/**
 * Validates Gemini API Key connectivity by pinging Gemini models.
 * @param {string} [customKey] - Optional custom API key to test
 * @returns {Promise<{ ok: boolean, message: string, model?: string }>}
 */
export async function testGeminiApiKey(customKey) {
  if (customKey !== undefined && typeof customKey === 'string' && !customKey.trim()) {
    return { ok: false, message: 'API Key belum diisi.' }
  }

  const { keysToTry } = getApiKeysToTry()
  const cleanCustom = (customKey || '').trim().replace(/^["']|["']$/g, '')
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
  const userStoreKey = (useSettingsStore.getState().geminiApiKey || '').trim().replace(/^["']|["']$/g, '')

  const key = cleanCustom || keysToTry[0]?.key || ''
  const isUserKey = cleanCustom
    ? (cleanCustom === userStoreKey || cleanCustom !== envKey)
    : (keysToTry[0]?.isUserKey ?? false)

  if (!key) {
    return { ok: false, message: 'API Key belum diisi.' }
  }

  let lastErrorMsg = ''
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      const testCtrl = new AbortController()
      const testTimeoutId = setTimeout(() => testCtrl.abort(), 15000)
      let res
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key.trim(),
          },
          signal: testCtrl.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 5, temperature: 0.1 },
          }),
        })
      } finally {
        clearTimeout(testTimeoutId)
      }

      if (res.ok) {
        return { ok: true, model, message: `Koneksi Berhasil! Model ${model} aktif dan siap digunakan.` }
      }

      const errText = await res.text()
      const cleanMsg = parseApiErrorMessage(errText, res.status, isUserKey)
      lastErrorMsg = cleanMsg

      if (res.status === 429) {
        return { ok: false, message: 'Batas kuota/permintaan tercapai (Rate Limit HTTP 429). Tunggu beberapa saat atau periksa kuota Anda di Google AI Studio.' }
      }
      if (res.status >= 500) {
        return { ok: false, message: `Server Google Gemini mengalami kendala sementara (HTTP ${res.status}). Silakan coba beberapa saat lagi.` }
      }
      if (res.status === 400 || res.status === 401 || res.status === 403 || cleanMsg.includes('API Key') || cleanMsg.includes('otentikasi')) {
        return { ok: false, message: cleanMsg }
      }
    } catch (err) {
      console.warn('[gemini.testApiKey]', err)
      if (err?.name === 'AbortError') {
        return { ok: false, message: 'Koneksi ke Google Gemini timeout (waktu habis setelah 15 detik). Periksa koneksi internet Anda.' }
      }
      if (err?.name === 'TypeError' || err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        return { ok: false, message: 'Gagal terhubung ke server Google. Periksa koneksi internet Anda.' }
      }
      lastErrorMsg = err.message
    }
  }

  return { ok: false, message: lastErrorMsg || 'Gagal menghubungi server Gemini. Pastikan API Key valid dari Google AI Studio.' }
}

/**
 * Transport helper for streaming Gemini API requests with model fallback and SSE parsing.
 *
 * @param {Array<object>} reqContents - Chat contents payload
 * @param {object} [options={}] - Transport options
 * @param {string} [options.sysPrompt] - System instruction string
 * @param {Array<object>} [options.tools] - Tool definitions list
 * @param {Function} [options.onStream] - Streaming chunk callback
 * @param {Array<string>} [options.models=CHAT_ADVISOR_MODELS] - Models fallback tier
 * @param {number} [options.timeoutMs=20000] - Request timeout in ms
 * @returns {Promise<{ text: string, functionCall: object|null }>} Result accumulator
 */
export async function callApiStreamWithFallback(reqContents, {
  sysPrompt = null,
  tools = null,
  onStream = null,
  models = CHAT_ADVISOR_MODELS,
  timeoutMs = 20000,
  retryOptions = {},
} = {}) {
  const { keysToTry, hasUserKey } = getApiKeysToTry()
  if (keysToTry.length === 0) {
    throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
  }

  const sanitizedContents = sanitizeGeminiContents(reqContents)
  if (sanitizedContents.length === 0) {
    throw new NonRetryableError('Payload percakapan AI tidak valid atau kosong.')
  }

  let lastError = null
  let userKeyError = null

  for (const keyObj of keysToTry) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

        const streamResult = await withRetry(async () => {
          const streamCtrl = new AbortController()
          const streamTimeoutId = setTimeout(() => streamCtrl.abort(), timeoutMs)
          let res
          try {
            const bodyPayload = {
              contents: sanitizedContents,
              generationConfig: { temperature: 0.1 },
            }
            if (sysPrompt) {
              bodyPayload.systemInstruction = { parts: [{ text: sysPrompt }] }
            }
            if (tools) {
              bodyPayload.tools = tools
            }
            res = await fetch(url, {
              method: 'POST',
              signal: streamCtrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyObj.key.trim(),
              },
              body: JSON.stringify(bodyPayload),
            })
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
              throw new RetryableError('Timeout streaming Gemini.', { status: 408, cause: fetchErr })
            }
            throw new RetryableError(fetchErr.message, { cause: fetchErr })
          } finally {
            clearTimeout(streamTimeoutId)
          }

          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status, keyObj.isUserKey)
            if (res.status === 400 || res.status === 401 || res.status === 403) {
              throw new NonRetryableError(cleanMsg, { status: res.status })
            }
            if (res.status === 404) {
              throw new NonRetryableError(cleanMsg, { status: 404 })
            }
            if (res.status === 429) {
              throw new RetryableError(cleanMsg, { status: 429 })
            }
            if (res.status >= 500) {
              throw new RetryableError(cleanMsg, { status: res.status })
            }
            throw new NonRetryableError(cleanMsg, { status: res.status })
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder('utf-8')
          const streamState = { fullText: '', functionCall: null }
          let buffer = ''

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                buffer += decoder.decode()
                if (buffer.trim()) {
                  const remainingBlocks = buffer.split(/(?:\r?\n|\r){2,}/)
                  for (const block of remainingBlocks) {
                    processSseEventBlock(block, streamState, onStream)
                  }
                }
                break
              }

              buffer += decoder.decode(value, { stream: true })
              const blocks = buffer.split(/(?:\r?\n|\r){2,}/)
              buffer = blocks.pop() || ''

              for (const block of blocks) {
                processSseEventBlock(block, streamState, onStream)
              }
            }
          } catch (readErr) {
            if (streamState.fullText.length > 0) {
              throw new NonRetryableError(readErr.message, { cause: readErr })
            }
            throw new RetryableError(readErr.message, { cause: readErr })
          }

          return { text: streamState.fullText, functionCall: streamState.functionCall }
        }, retryOptions)

        return streamResult
      } catch (err) {
        lastError = err
        if (keyObj.isUserKey) {
          userKeyError = err
        }

        if (err.status === 404) {
          continue
        }

        if (err.status === 400 || err.status === 401 || err.status === 403 || (err instanceof NonRetryableError && err.status !== 404)) {
          break
        }

        if (err.status === 429 || (err.message && (err.message.includes('Rate limit') || err.message.includes('429')))) {
          console.warn(`[${model}] Rate Limit hit. Aborting fallback loop to prevent spam.`)
          break
        }
      }
    }
  }

  // If all keys and models failed
  throw (hasUserKey && userKeyError) || lastError || new Error('Gagal menghubungi asisten AI.')
}

/**
 * Transport helper for non-streaming Gemini API requests with model fallback.
 *
 * @param {Array<object>} reqContents - Request contents
 * @param {object} [options={}] - Transport options
 * @param {string} [options.sysInstruction] - System instruction string
 * @param {Array<string>} [options.models=CHAT_ADVISOR_MODELS] - Models fallback tier
 * @param {number} [options.temperature=0.2] - Sampling temperature
 * @param {string} [options.responseMimeType='application/json'] - Response MIME type
 * @param {number} [options.timeoutMs=15000] - Request timeout in ms
 * @param {string} [options.defaultErrorMessage='Gagal mendapatkan respon AI.'] - Fallback error message
 * @returns {Promise<{ text: string }>} Result text
 */
export async function callApiWithFallback(reqContents, {
  sysInstruction = null,
  models = CHAT_ADVISOR_MODELS,
  temperature = 0.2,
  responseMimeType = 'application/json',
  timeoutMs = 15000,
  defaultErrorMessage = 'Gagal mendapatkan respon AI.',
  retryOptions = {},
} = {}) {
  const { keysToTry, hasUserKey } = getApiKeysToTry()
  if (keysToTry.length === 0) {
    throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
  }

  const sanitizedContents = sanitizeGeminiContents(reqContents)
  if (sanitizedContents.length === 0) {
    throw new NonRetryableError('Payload permintaan AI tidak valid atau kosong.')
  }

  let lastError = null
  let userKeyError = null
  for (const keyObj of keysToTry) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        const result = await withRetry(async () => {
          const ctrl = new AbortController()
          const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
          let res
          try {
            const bodyPayload = {
              contents: sanitizedContents,
              generationConfig: { temperature, responseMimeType },
            }
            if (sysInstruction) {
              bodyPayload.systemInstruction = { parts: [{ text: sysInstruction }] }
            }
            res = await fetch(url, {
              method: 'POST',
              signal: ctrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyObj.key.trim(),
              },
              body: JSON.stringify(bodyPayload),
            })
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
              throw new RetryableError('Timeout menghubungi server Gemini.', { status: 408, cause: fetchErr })
            }
            throw new RetryableError(fetchErr.message, { cause: fetchErr })
          } finally {
            clearTimeout(timeoutId)
          }

          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status, keyObj.isUserKey)

            if (res.status === 400 || res.status === 401 || res.status === 403) {
              throw new NonRetryableError(cleanMsg, { status: res.status })
            }
            if (res.status === 404) {
              throw new NonRetryableError(cleanMsg, { status: 404 })
            }
            if (res.status === 429) {
              throw new RetryableError(cleanMsg, { status: 429 })
            }
            if (res.status >= 500) {
              throw new RetryableError(cleanMsg, { status: res.status })
            }
            throw new NonRetryableError(cleanMsg, { status: res.status })
          }

          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        }, retryOptions)

        return result
      } catch (err) {
        lastError = err
        if (keyObj.isUserKey) {
          userKeyError = err
        }

        if (err.status === 404) {
          continue
        }

        if (err.status === 400 || err.status === 401 || err.status === 403 || (err instanceof NonRetryableError && err.status !== 404)) {
          break
        }

        if (err.status === 429 || (err.message && (err.message.includes('Rate limit') || err.message.includes('429')))) {
          console.warn(`[${model}] Rate Limit hit. Aborting fallback loop to prevent spam.`)
          break
        }
      }
    }
  }

  throw (hasUserKey && userKeyError) || lastError || new Error(defaultErrorMessage)
}
