/**
 * Receipt image OCR scanner service using Gemini Vision for FinTrack AI.
 */
import { format } from 'date-fns'
import { getEffectiveApiKey, callApiWithFallback, FAST_TRANSACTION_MODELS } from './client'
import { buildCategoryContext, buildReceiptOcrPrompt } from './promptBuilder'
import { sanitizeCategoryPath } from '../categorySanitizer'

/**
 * Scans a receipt image using Gemini Vision and extracts structured financial data.
 *
 * @param {string} base64Data - Base64 encoded image string (with or without data URI prefix)
 * @param {string} [mimeType='image/jpeg'] - Image mime type e.g. 'image/jpeg' or 'image/png'
 * @param {object} [options={}] - Options
 * @param {string} [options.defaultCurrency='IDR'] - Default active currency
 * @param {string} [options.locale='id'] - Locale ('id' or 'en')
 * @returns {Promise<object>} Extracted transaction data
 */
export async function scanReceiptImage(base64Data, mimeType = 'image/jpeg', { defaultCurrency = 'IDR', locale = 'id' } = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(locale === 'en'
      ? 'No internet connection. Scanning receipts with AI requires an active internet connection.'
      : 'Koneksi internet terputus. Pemindaian struk dengan AI membutuhkan koneksi internet.')
  }

  const apiKey = getEffectiveApiKey()
  if (!apiKey) {
    throw new Error('API Key Gemini belum diset. Silakan atur di menu Pengaturan > Integrasi Asisten AI.')
  }

  // Clean raw base64 if it has data url prefix
  let cleanBase64 = String(base64Data || '')
  if (cleanBase64.includes('base64,')) {
    const parts = cleanBase64.split('base64,')
    cleanBase64 = parts[1]
    const header = parts[0]
    if (header.includes(':') && header.includes(';')) {
      mimeType = header.split(':')[1].split(';')[0]
    }
  }

  const categoryContext = buildCategoryContext(locale)
  const sysInstruction = buildReceiptOcrPrompt({
    categoryContext,
    currentDate: format(new Date(), 'yyyy-MM-dd'),
    defaultCurrency,
  })

  try {
    const contents = [
      {
        role: 'user',
        parts: [
          { text: 'Analisis foto struk ini dan ekstrak seluruh datanya ke format JSON sesuai instruksi.' },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
        ],
      },
    ]
    const response = await callApiWithFallback(contents, {
      sysInstruction,
      models: FAST_TRANSACTION_MODELS,
      temperature: 0.1,
      responseMimeType: 'application/json',
      timeoutMs: 25000,
      defaultErrorMessage: 'Gagal mengekstrak data struk dengan AI.',
    })

    const rawText = response.text || '{}'
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    let parsed = {}
    try {
      parsed = JSON.parse(cleanJson)
    } catch {
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    }

    // Sanitize category
    let finalCategory = parsed.suggestedCategory || 'belanja/lainnya'
    try {
      finalCategory = sanitizeCategoryPath(finalCategory, 'expense')
    } catch {
      /* ignore */
    }

    return {
      success: true,
      merchantName: parsed.merchantName || 'Struk Belanja',
      date: parsed.date || format(new Date(), 'yyyy-MM-dd'),
      totalAmount: Number(parsed.totalAmount) || 0,
      currency: parsed.currency || defaultCurrency,
      suggestedCategory: finalCategory,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      subtotal: typeof parsed.subtotal === 'number' ? parsed.subtotal : undefined,
      tax: typeof parsed.tax === 'number' ? parsed.tax : undefined,
      discount: typeof parsed.discount === 'number' ? parsed.discount : undefined,
      paymentMethod: parsed.paymentMethod || undefined,
      notes: parsed.notes || parsed.merchantName || 'Struk Belanja',
    }
  } catch (err) {
    console.error('scanReceiptImage error:', err)
    throw err
  }
}
