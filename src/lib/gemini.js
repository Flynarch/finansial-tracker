import { format } from 'date-fns'
import { queryTransactions, getMonthSummaryForPrompt } from './aiDatabaseQueries'
import { sanitizeCategoryPath } from './categorySanitizer'
import { db, computeAllWalletBalances } from './db'
import { convertCurrency, formatCurrency, isExcludeAnalyticsTx, toSafeNumber, FALLBACK_EXCHANGE_RATES } from './utils'
import { getCachedCurrencyRates } from './api'
import { getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from './budgetUtils'
import useSettingsStore from '../store/useSettingsStore'
import { parseIndonesianFinancialText, extractMerchantAndCategory } from './ai/indonesianFinanceNlp'
import { getTools } from './ai/toolSchemas'
import {
  buildCategoryContext,
  buildSystemPrompt,
  buildFinancialAdvicePrompt,
  buildGoalPredictionPrompt,
  buildReceiptOcrPrompt,
} from './ai/promptBuilder'

export {
  buildCategoryContext,
  buildSystemPrompt,
  buildFinancialAdvicePrompt,
  buildGoalPredictionPrompt,
  buildReceiptOcrPrompt,
}

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

function parseApiErrorMessage(errText, status, isUserKey = true) {
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
            generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
          })
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

      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429 || cleanMsg.includes('API Key') || cleanMsg.includes('otentikasi')) {
        return { ok: false, message: cleanMsg }
      }
    } catch (err) {
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        return { ok: false, message: 'Gagal terhubung ke server Google. Periksa koneksi internet Anda.' }
      }
      lastErrorMsg = err.message
    }
  }

  return { ok: false, message: lastErrorMsg || 'Gagal menghubungi server Gemini. Pastikan API Key valid dari Google AI Studio.' }
}



/**
 * Zero-latency Fast-Path NLP heuristic parser for short Indonesian / casual transactions.
 * Handles instant patterns like "bakso 20k", "kopi 25rb bca", "gaji 5jt", "bensin 30k" as well
 * as multi-day transactions ("sabtu dan jumwt masing-masing 10k buat maxim") in 0ms!
 */
export function parseShortTransactionFast(userText, wallets = [], defaultCurrency = 'IDR', referenceDate = new Date()) {
  const result = parseIndonesianFinancialText(userText, wallets, defaultCurrency, referenceDate)
  if (result && (result.type === 'transactions' || result.transactions)) {
    return {
      ...result,
      engine: 'offline_nlp',
      engineLabel: 'NLP Lokal (Offline)',
      transactions: (result.transactions || []).map((t) => ({
        ...t,
        engine: 'offline_nlp',
        engineLabel: 'NLP Lokal (Offline)',
      })),
    }
  }
  return result
}

export async function calculateDirectFinancialHealth({
  defaultCurrency = 'IDR',
  locale = 'id',
  rates = null,
  replyMessage = '',
  suggestedChips = null,
  referenceDate = null,
} = {}) {
  const activeRates = rates || getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
  const allWallets = await db.wallets.toArray()
  const txs = await db.transactions.toArray()
  const loans = await db.loans.toArray()

  const computedWallets = computeAllWalletBalances(allWallets, txs, activeRates)
  const totalCash = computedWallets
    .filter((w) => !w.isArchived)
    .reduce((acc, w) => {
      const bal = toSafeNumber(w.currentBalance ?? w.balance ?? 0)
      return acc + convertCurrency(bal, w.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const now = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const budgetCycleStartDay = useSettingsStore.getState().budgetCycleStartDay || 1
  const currentMonthKey = getCurrentBudgetMonthKey(now, budgetCycleStartDay)
  const period = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)

  let monthlyIncome = 0
  let monthlyExpense = 0

  txs.forEach((t) => {
    const txDate = (t?.date || '').slice(0, 10)
    if (!txDate || txDate < period.startDate || txDate > period.endDate) return

    if (t.isSplit && Array.isArray(t.splitItems) && t.splitItems.length > 0) {
      t.splitItems.forEach((si) => {
        const itemTx = {
          ...t,
          ...si,
          category: si.category || t.category,
          isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
          excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
        }
        if (isExcludeAnalyticsTx(itemTx)) return
        const amt = convertCurrency(toSafeNumber(si.amount), si.currency || t.currency || defaultCurrency, defaultCurrency, activeRates)
        const itemType = si.type || t.type
        if (itemType === 'income') monthlyIncome += amt
        if (itemType === 'expense') monthlyExpense += amt
      })
      return
    }

    if (isExcludeAnalyticsTx(t)) return
    const amt = convertCurrency(toSafeNumber(t.amount), t.currency || defaultCurrency, defaultCurrency, activeRates)
    if (t.type === 'income') monthlyIncome += amt
    if (t.type === 'expense') monthlyExpense += amt
  })

  const activeLoans = loans.filter((l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven')

  const totalDebt = activeLoans
    .filter((l) => l.type === 'debt')
    .reduce((acc, l) => {
      const raw = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return acc + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const totalReceivable = activeLoans
    .filter((l) => l.type === 'receivable')
    .reduce((acc, l) => {
      const raw = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return acc + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const rawSavingsRatio = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : (monthlyExpense > 0 ? -100 : 0)
  const savingsRatio = Math.max(0, rawSavingsRatio)
  const dti = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : (totalDebt > 0 ? 100 : 0)
  const emergencyMonths = monthlyExpense > 0 ? (totalCash / monthlyExpense) : (totalCash > 0 ? 12 : 0)

  let score = 50
  if (rawSavingsRatio >= 20) score += 20
  else if (rawSavingsRatio >= 10) score += 10
  else if (rawSavingsRatio < 0) score -= 20

  if (dti <= 30) score += 15
  else if (dti > 50) score -= 15

  if (emergencyMonths >= 6) score += 15
  else if (emergencyMonths >= 3) score += 10
  else if (emergencyMonths < 1) score -= 10

  score = Math.max(10, Math.min(100, Math.round(score)))

  const isEn = String(locale || '').toLowerCase().startsWith('en')
  let rating
  if (score >= 85) rating = isEn ? 'Excellent' : 'Sangat Sehat'
  else if (score >= 70) rating = isEn ? 'Healthy' : 'Sehat'
  else if (score >= 50) rating = isEn ? 'Fair' : 'Cukup'
  else if (score >= 35) rating = isEn ? 'Needs Attention' : 'Perlu Perhatian'
  else rating = isEn ? 'Critical' : 'Kritis'

  const defaultText = isEn
    ? `Here is your Financial Health Score evaluation: ${score}/100 (${rating}).`
    : `Berikut adalah evaluasi Skor Kesehatan Finansial Anda: ${score}/100 (${rating}).`
  const defaultChips = isEn
    ? ['How to improve score?', 'Analyze spending', 'Emergency fund advice']
    : ['Bagaimana cara menaikkan skor?', 'Analisis pengeluaranku', 'Rekomendasi dana darurat']

  return {
    type: 'financial_health',
    score,
    rating,
    metrics: {
      savingsRatio: Math.round(savingsRatio),
      dti: Math.round(dti),
      emergencyMonths: Number(emergencyMonths.toFixed(1)),
      totalCash,
      monthlyIncome,
      monthlyExpense,
      totalDebt,
      totalReceivable,
    },
    text: replyMessage || defaultText,
    chips: Array.isArray(suggestedChips) && suggestedChips.length > 0 ? suggestedChips : defaultChips,
  }
}

/**
 * Deep merges streaming functionCall arguments across multiple SSE chunks,
 * ensuring arrays and nested objects are properly accumulated without loss.
 */
export function mergeFunctionCallArgs(target, source) {
  if (!source || typeof source !== 'object') return target
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = target[key]
    if (Array.isArray(tgtVal) && Array.isArray(srcVal)) {
      const result = [...tgtVal]
      const matchedTgtIndices = new Set()
      for (const sItem of srcVal) {
        let matchIdx = -1
        for (let i = 0; i < tgtVal.length; i++) {
          if (!matchedTgtIndices.has(i) && JSON.stringify(tgtVal[i]) === JSON.stringify(sItem)) {
            matchIdx = i
            break
          }
        }
        if (matchIdx !== -1) {
          matchedTgtIndices.add(matchIdx)
          continue
        }
        const lastIdx = result.length - 1
        const lastItem = result[lastIdx]
        if (
          lastItem &&
          typeof lastItem === 'object' &&
          typeof sItem === 'object' &&
          lastItem !== null &&
          sItem !== null &&
          !Array.isArray(lastItem) &&
          !Array.isArray(sItem) &&
          JSON.stringify(lastItem) !== JSON.stringify(sItem)
        ) {
          const tKeys = Object.keys(lastItem)
          const hasCommonMismatch = tKeys.some((k) => {
            if (sItem[k] === undefined) return false
            const sVal = sItem[k]
            const tVal = lastItem[k]
            if (sVal && tVal && typeof sVal === 'object' && typeof tVal === 'object') {
              return false
            }
            return sVal !== tVal
          })
          if (!hasCommonMismatch) {
            result[lastIdx] = mergeFunctionCallArgs({ ...lastItem }, sItem)
            continue
          }
        }
        result.push(sItem)
      }
      target[key] = result
    } else if (
      srcVal &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      mergeFunctionCallArgs(tgtVal, srcVal)
    } else {
      target[key] = srcVal
    }
  }
  return target
}

/**
 * Distributes taxes, discounts, and item breakdowns across transactions for per_item mode,
 * ensuring sum(amounts) equals the actual grand total paid from user's wallet.
 */
export function distributeReceiptTransactions(transactions, resultMeta = {}, scanMode = 'all') {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return transactions
  }

  const zeroDecimalCurrencies = ['IDR', 'JPY', 'KRW', 'VND']
  const getCurrencyRounder = (currency) => {
    const cleanCur = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'IDR'
    const isZeroDec = zeroDecimalCurrencies.includes(cleanCur)
    return (val) => (isZeroDec ? Math.round(val) : Math.round(val * 100) / 100)
  }

  // Non per-item mode: reconcile single summary transaction's amount with grand total if tax/discount was omitted
  if (scanMode !== 'per_item') {
    if (transactions.length === 1) {
      const parent = transactions[0]
      const roundCurrency = getCurrencyRounder(parent.currency || resultMeta.currency)
      const parentTax = Number(parent.tax ?? resultMeta.tax) || 0
      const parentDiscount = Number(parent.discount ?? resultMeta.discount) || 0
      const parentAmount = Number(parent.amount) || 0
      const netAdjustment = parentTax - parentDiscount
      const itemsSum = Array.isArray(parent.items)
        ? parent.items.reduce((acc, it) => acc + (Number(it.price) || 0), 0)
        : 0
      const receiptGrandTotal = Number(resultMeta.total ?? resultMeta.grandTotal ?? parent.total ?? parent.grandTotal) || 0

      let grandTotal = parentAmount
      const parentSubtotal = Number(parent.subtotal ?? resultMeta.subtotal) || 0
      if (receiptGrandTotal > 0) {
        grandTotal = receiptGrandTotal
      } else if (netAdjustment !== 0) {
        if (parentSubtotal > 0 && Math.abs(parentAmount - (parentSubtotal + netAdjustment)) <= 0.01) {
          grandTotal = parentAmount
        } else if (parentSubtotal > 0 && Math.abs(parentAmount - parentSubtotal) <= 0.01) {
          grandTotal = Math.max(0, parentSubtotal + netAdjustment)
        } else if (itemsSum > 0) {
          if (Math.abs(parentAmount - (itemsSum + netAdjustment)) <= 0.01) {
            grandTotal = parentAmount
          } else if (Math.abs(parentAmount - itemsSum) <= 0.01) {
            grandTotal = Math.max(0, itemsSum + netAdjustment)
          }
        } else if (parentAmount > 0) {
          grandTotal = Math.max(0, parentAmount + netAdjustment)
        }
      }

      if (grandTotal > 0 && grandTotal !== parentAmount) {
        return [{
          ...parent,
          amount: roundCurrency(grandTotal),
        }]
      }
    }
    return transactions
  }

  // Case 1: 1 summary transaction containing items array -> unroll items into individual transactions
  if (transactions.length === 1 && Array.isArray(transactions[0]?.items) && transactions[0].items.length >= 1) {
    const parent = transactions[0]
    const roundCurrency = getCurrencyRounder(parent.currency || resultMeta.currency)
    const items = (parent.items || []).filter((it) => (Number(it.price) || 0) > 0)
    const itemsSum = items.reduce((acc, it) => acc + (Number(it.price) || 0), 0)
    const parentTax = Number(parent.tax ?? resultMeta.tax) || 0
    const parentDiscount = Number(parent.discount ?? resultMeta.discount) || 0
    const parentAmount = Number(parent.amount) || 0
    const netAdjustment = parentTax - parentDiscount
    const receiptGrandTotal = Number(resultMeta.total ?? resultMeta.grandTotal ?? resultMeta.amount ?? parent.total ?? parent.grandTotal) || 0
    const alreadyReflectsAdjustment =
      receiptGrandTotal > 0 && Math.abs(itemsSum - receiptGrandTotal) <= 0.01

    let grandTotal = parentAmount
    if (receiptGrandTotal > 0) {
      grandTotal = receiptGrandTotal
    } else if (grandTotal <= 0) {
      grandTotal = Math.max(0, itemsSum + netAdjustment)
    } else if (!alreadyReflectsAdjustment && netAdjustment !== 0 && grandTotal === itemsSum) {
      grandTotal = Math.max(0, itemsSum + netAdjustment)
    }

    let runningSum = 0
    const unrolled = items.map((it, idx) => {
      const rawPrice = Number(it.price) || 0
      let adjustedAmount = rawPrice
      if (grandTotal > 0 && itemsSum > 0) {
        if (idx === items.length - 1) {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal - runningSum))
        } else {
          const ratio = rawPrice / itemsSum
          adjustedAmount = Math.max(0, roundCurrency(grandTotal * ratio))
          runningSum += adjustedAmount
        }
      } else if (grandTotal > 0 && itemsSum === 0) {
        if (idx === items.length - 1) {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal - runningSum))
        } else {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal / items.length))
          runningSum += adjustedAmount
        }
      }
      return {
        type: 'expense',
        category: sanitizeCategoryPath(it.category || it.name, 'expense') || parent.category || 'kebutuhan_harian/belanja_bulanan',
        amount: adjustedAmount,
        notes: it.qty && it.qty > 1 ? `${it.name} (x${it.qty})` : it.name,
        date: parent.date,
        currency: parent.currency,
        merchant: parent.merchant || resultMeta.merchant,
        walletId: parent.walletId,
        paymentMethod: parent.paymentMethod,
        engine: parent.engine || resultMeta.engine,
        engineLabel: parent.engineLabel || resultMeta.engineLabel,
      }
    })
    return unrolled.filter((tx) => Number(tx.amount) > 0)
  }

  // Case 2: AI returned multiple transactions directly, but there is parentTax or parentDiscount to distribute
  if (transactions.length > 1) {
    const roundCurrency = getCurrencyRounder(transactions[0]?.currency || resultMeta.currency)
    const validTxs = transactions.filter((t) => (Number(t.amount) || 0) > 0)
    const totalItemAmount = validTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
    const netTax = Number(resultMeta.tax ?? transactions[0]?.tax) || 0
    const netDiscount = Number(resultMeta.discount ?? transactions[0]?.discount) || 0
    const netAdjustment = netTax - netDiscount

    const explicitGrandTotal = Number(resultMeta.total ?? resultMeta.grandTotal ?? transactions[0]?.total ?? transactions[0]?.grandTotal) || 0
    const explicitParentAmount = Number(resultMeta.amount ?? transactions[0]?.parentAmount) || 0
    const parentSubtotal = Number(resultMeta.subtotal ?? transactions[0]?.subtotal) || 0

    let grandTotal = totalItemAmount
    if (explicitGrandTotal > 0 && Math.abs(totalItemAmount - explicitGrandTotal) > 0.01) {
      grandTotal = explicitGrandTotal
    } else if (explicitParentAmount > 0 && Math.abs(explicitParentAmount - totalItemAmount) <= 0.01) {
      if (explicitGrandTotal > totalItemAmount + 0.01) {
        grandTotal = explicitGrandTotal
      } else {
        grandTotal = totalItemAmount
      }
    } else if (parentSubtotal > 0 && Math.abs(totalItemAmount - parentSubtotal) <= 0.01 && netAdjustment !== 0) {
      grandTotal = Math.max(0, totalItemAmount + netAdjustment)
    } else if (netAdjustment !== 0 && explicitGrandTotal === 0 && explicitParentAmount === 0) {
      grandTotal = Math.max(0, totalItemAmount + netAdjustment)
    }

    // If grandTotal differs from item sum, distribute grandTotal proportionally
    if (grandTotal > 0 && Math.abs(grandTotal - totalItemAmount) > 0.01 && totalItemAmount > 0 && validTxs.length > 0) {
      let runningSum = 0
      return validTxs.map((tx, idx) => {
        const rawAmt = Number(tx.amount) || 0
        let adjustedAmount
        if (idx === validTxs.length - 1) {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal - runningSum))
        } else {
          const ratio = rawAmt / totalItemAmount
          adjustedAmount = Math.max(0, roundCurrency(grandTotal * ratio))
          runningSum += adjustedAmount
        }
        return {
          ...tx,
          amount: adjustedAmount,
        }
      }).filter((tx) => Number(tx.amount) > 0)
    }
    return validTxs
  }

  return transactions.filter((tx) => Number(tx.amount) > 0)
}

/**
 * Sanitizes user input string from dangerous prompt injection delimiter sequences.
 * Employs a fixed-point loop to eliminate nested/recursive delimiter bypasses (e.g. </user_</user_turn>turn>)
 * and strips HTML entity encoded representations.
 */
export function sanitizeUserTurn(text) {
  if (typeof text !== 'string') return ''
  let sanitized = text
  let prev
  do {
    prev = sanitized
    sanitized = sanitized
      .replace(/<\/?user_turn(?:\s+[^>]*)?>/gi, '')
      .replace(/<\/?user_untrusted_transactions(?:\s+[^>]*)?>/gi, '')
      .replace(/&(?:lt|#60|#x3c);\/?user_turn(?:[\s\S]*?)&(?:gt|#62|#x3e);/gi, '')
      .replace(/&(?:lt|#60|#x3c);\/?user_untrusted_transactions(?:[\s\S]*?)&(?:gt|#62|#x3e);/gi, '')
  } while (sanitized !== prev)
  return sanitized.trim()
}

/**
 * Wraps user turn into explicit XML delineator tags.
 */
export function wrapUserTurn(userPrompt) {
  const sanitized = sanitizeUserTurn(userPrompt)
  return `<user_turn>\n${sanitized}\n</user_turn>`
}

/**
 * Processes a single complete SSE event block per W3C EventSource specifications.
 * Gathers all 'data:' lines, joins them with newline, handles '[DONE]', and parses JSON.
 */
export function processSseEventBlock(eventBlock, state, onStream) {
  if (!eventBlock || !eventBlock.trim()) return
  const lines = eventBlock.split(/\r?\n|\r/)
  const dataLines = []
  for (const rawLine of lines) {
    const line = rawLine.trimStart()
    if (line.startsWith('data:')) {
      const rest = line.slice(5)
      dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest)
    }
  }
  if (dataLines.length === 0) return

  const dataStr = dataLines.join('\n').trim()
  if (dataStr === '[DONE]' || !dataStr) return

  try {
    const data = JSON.parse(dataStr)
    const parts = data.candidates?.[0]?.content?.parts || []
    for (const p of parts) {
      if (p.text) {
        state.fullText = (state.fullText || '') + p.text
        if (onStream) onStream(p.text)
      }
      if (p.functionCall) {
        if (!state.functionCall) {
          state.functionCall = { name: p.functionCall.name || '', args: {} }
        } else if (p.functionCall.name && !state.functionCall.name) {
          state.functionCall.name = p.functionCall.name
        }
        if (p.functionCall.args) {
          mergeFunctionCallArgs(state.functionCall.args, p.functionCall.args)
        }
      }
    }
  } catch {
    // ignore malformed SSE json chunk
  }
}

export async function parseTransactionFromText(userMessage, context) {
  const {
    locale = 'id',
    defaultCurrency = 'IDR',
    previousMessages = [],
    imageData = null,
    wallets = [],
    onStream = null,
    scanMode = 'all',
    rates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES },
  } = context

  const normUserText = String(userMessage || '').toLowerCase()

  if (
    normUserText.includes('kesehatan keuangan') ||
    normUserText.includes('kesehatan finansial') ||
    normUserText.includes('skor keuangan') ||
    normUserText.includes('kondisi finansial') ||
    normUserText.includes('financial health') ||
    normUserText.includes('evaluasi keuangan')
  ) {
    return await calculateDirectFinancialHealth({ defaultCurrency, locale, rates })
  }

  if (
    normUserText.includes('utang piutang') ||
    normUserText.includes('hutang piutang') ||
    normUserText.includes('siapa yang utang') ||
    normUserText.includes('siapa saja yang punya utang') ||
    normUserText.includes('siapa yang punya hutang') ||
    normUserText.includes('daftar utang') ||
    normUserText.includes('daftar piutang') ||
    normUserText.includes('sisa piutang') ||
    normUserText.includes('sisa utang') ||
    normUserText.includes('total utang') ||
    normUserText.includes('utang saya') ||
    normUserText.includes('piutang saya')
  ) {
    const loans = await db.loans.toArray()
    const activeLoans = loans.filter((l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven' && toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount) > 0)
    const totalDebt = activeLoans
      .filter((l) => l.type === 'debt')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    const totalReceivable = activeLoans
      .filter((l) => l.type === 'receivable')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    const activeCount = activeLoans.length

    let textMsg = `Berikut ringkasan **Utang & Piutang** Anda saat ini:\n\n- **Total Piutang (Tagihan Anda)**: **${formatCurrency(totalReceivable, defaultCurrency)}**\n- **Total Hutang (Kewajiban Anda)**: **${formatCurrency(totalDebt, defaultCurrency)}**\n- **Pinjaman Aktif**: **${activeCount} item**`

    if (activeLoans.length > 0) {
      textMsg += '\n\nRincian Pinjaman Aktif:\n' + activeLoans.map((l) => {
        const loanCurrency = l.currency || defaultCurrency
        const remAmt = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount)
        return `- ${l.type === 'debt' ? 'Hutang' : 'Piutang'}: **${l.title}** (${l.personName || '-'}) · Sisa **${formatCurrency(remAmt, loanCurrency)}**`
      }).join('\n')
    } else {
      textMsg += '\n\nSaat ini tidak ada catatan utang atau piutang yang aktif. Kondisi kewajiban Anda bersih!'
    }

    return {
      type: 'text',
      text: textMsg,
      chips: ['Catat Piutang Baru', 'Catat Hutang Baru', 'Bayar Cicilan', 'Analisis Keuangan'],
    }
  }

  if (
    normUserText.includes('target tabungan') ||
    normUserText.includes('progres tabungan') ||
    normUserText.includes('progres target tabungan') ||
    normUserText.includes('tabungan saya saat ini')
  ) {
    const goals = await db.goals.toArray()
    const activeGoals = goals.filter((g) => !g.isArchived && !g.isCompleted && g.status !== 'archived')
    if (activeGoals.length > 0) {
      const totalTarget = activeGoals.reduce(
        (s, g) => s + convertCurrency(toSafeNumber(g.targetAmount), g.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
      const totalCurrent = activeGoals.reduce(
        (s, g) => s + convertCurrency(toSafeNumber(g.currentAmount), g.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
      const pct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
      let textMsg = `Berikut progres **Target Tabungan** Anda:\n\n- **Total Terkumpul**: **${formatCurrency(totalCurrent, defaultCurrency)}** / ${formatCurrency(totalTarget, defaultCurrency)} (${pct}%)\n- **Jumlah Target**: **${activeGoals.length} tujuan**\n\nRincian Target Tabungan:\n`
      textMsg += activeGoals.map(g => {
        const goalCurrency = g.currency || defaultCurrency
        const p = g.targetAmount > 0 ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0
        const goalName = g.name || g.title || 'Tabungan'
        return `- **${goalName}**: **${formatCurrency(g.currentAmount || 0, goalCurrency)}** / ${formatCurrency(g.targetAmount || 0, goalCurrency)} (${p}%)`
      }).join('\n')
      return {
        type: 'text',
        text: textMsg,
        chips: [`Setor Tabungan: ${formatCurrency(50000, defaultCurrency)}`, 'Buat Target Baru: Dana Darurat', 'Analisis Keuangan']
      }
    } else {
      return {
        type: 'text',
        text: 'Saat ini belum ada **Target Tabungan** yang dibuat. Menentukan target tabungan (seperti Dana Darurat, Liburan, atau Beli Gadget) sangat efektif untuk menjaga konsistensi keuangan Anda.\n\nMau saya bantu buatkan target tabungan baru sekarang?',
        chips: ['Buat Target: Dana Darurat 5 Juta', 'Buat Target: Liburan 3 Juta', 'Analisis Keuangan']
      }
    }
  }

  if (
    normUserText.includes('habit harian') ||
    normUserText.includes('status habit') ||
    normUserText.includes('kebiasaan hari ini') ||
    normUserText.includes('habit saya hari ini')
  ) {
    const habits = await db.habits.toArray()
    const activeHabits = habits.filter(h => !h.archived)
    if (activeHabits.length > 0) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const logs = await db.habitLogs.where('date').equals(todayStr).toArray()
      const completedIds = new Set(logs.filter(l => l.completed).map(l => l.habitId))
      const doneCount = activeHabits.filter(h => completedIds.has(h.id)).length
      let textMsg = `Berikut status **Habit Harian** Anda hari ini (${doneCount}/${activeHabits.length} selesai):\n\n`
      textMsg += activeHabits.map(h => {
        const isDone = completedIds.has(h.id)
        return `- [${isDone ? 'x' : ' '}] **${h.title}** ${isDone ? '(Selesai)' : '(Belum)'}`
      }).join('\n')
      return {
        type: 'text',
        text: textMsg,
        chips: ['Selesaikan Semua Habit', 'Buat Habit Baru', 'Analisis Keuangan']
      }
    } else {
      return {
        type: 'text',
        text: 'Saat ini belum ada **Habit Harian** yang aktif. Anda bisa membuat kebiasaan finansial atau produktif harian (seperti *Tidak beli kopi di luar*, *Catat pengeluaran harian*, atau *Menabung 10rb*).\n\nMau mulai buat habit baru?',
        chips: ['Buat Habit: Hemat Kopi', 'Buat Habit: Menabung Harian', 'Analisis Keuangan']
      }
    }
  }

  // Local validation: intercept missing nominal before making network request to save API quota and latency
  if (!imageData && userMessage) {
    const fastCheck = parseShortTransactionFast(userMessage, wallets, defaultCurrency)
    if (fastCheck?.error && fastCheck?.message && fastCheck.message.includes('Nominal')) {
      return fastCheck
    }
  }

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false

  // OFFLINE MODE: Local fast-path NLP heuristic only (never calls remote AI when offline)
  if (isOffline) {
    if (!imageData) {
      const fastTx = parseShortTransactionFast(userMessage, wallets, defaultCurrency)
      if (fastTx) {
        return fastTx
      }
    }
    return {
      error: true,
      message: 'Perangkat sedang offline. AI Gemini membutuhkan koneksi internet, dan format pesan belum dikenali oleh NLP lokal offline.',
    }
  }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const currentTime = format(now, 'HH:mm')
  const monthSummary = await getMonthSummaryForPrompt()

  const recentTxs = await db.transactions
    .orderBy('date')
    .reverse()
    .limit(15)
    .toArray()

  const sysPrompt = buildSystemPrompt({
    todayStr: today,
    currentTime,
    currency: defaultCurrency,
    locale,
    wallets,
    monthSummary,
    recentTransactions: recentTxs,
  })

  let contents = []
  let lastRole = null

  previousMessages.slice(-6).forEach((msg) => {
    const role = msg.role === 'ai' ? 'model' : 'user'
    let text = msg.content

    // Fallbacks for non-text messages to keep context flow
    if (!text) {
      if (msg.type === 'success') text = 'Transaksi berhasil dicatat.'
      else if (msg.type === 'chart') text = 'Berikut grafiknya.'
      else text = '...'
    }

    if (role === lastRole && contents.length > 0) {
      // Merge consecutive messages of the same role
      contents[contents.length - 1].parts.push({ text: '\n' + text })
    } else {
      contents.push({ role, parts: [{ text }] })
      lastRole = role
    }
  })
  
  let receiptVisionInstruction = ''
  if (imageData) {
    const isPerItem = scanMode === 'per_item'
    receiptVisionInstruction = `\n[PANDUAN LENGKAP ANALISIS STRUK BELANJA DENGAN GEMINI VISION]:
Gambar yang dilampirkan adalah foto fisik struk belanja, nota pembayaran, struk kasir toko/restoran, e-receipt, atau tagihan.
Ekstrak seluruh informasi secara komprehensif, teliti, dan presisi:

1. NAMA TOKO / MERCHANT ('merchantName' & 'merchant'):
   - Ambil nama merek/toko di bagian header struk (misal: 'Indomaret Point', 'Alfamart', 'Starbucks', 'Super Indo', 'Kopi Kenangan', "McDonald's", 'SPBU Pertamina', 'Apotek Century', 'Guardian', 'Uniqlo', 'Fore Coffee', 'FamilyMart', 'Lawson', 'Bakmi GM', 'Solaria', 'KFC', dsb).
   - Bersihkan dari nomor telepon, NPWP, atau alamat panjang. Cukup nama merek/toko yang bersih.

2. MATA UANG ('currency'):
   - Analisis simbol atau kode mata uang pada struk:
     * 'Rp', 'IDR', atau nominal ribuan standar Indonesia (contoh: 25.000, 78.500) -> 'IDR'.
     * '$', 'USD', 'US$' -> 'USD'.
     * 'S$', 'SGD' -> 'SGD'.
     * 'RM', 'MYR' -> 'MYR'.
     * '€', 'EUR' -> 'EUR'.
     * '¥', 'JPY' -> 'JPY'.
     * '£', 'GBP' -> 'GBP'.
     * Jika tidak ada indikasi eksplisit, gunakan '${defaultCurrency}'.
   - WAJIB isi properti 'currency' di setiap objek transaksi dan di level utama!

3. TANGGAL & WAKTU TRANSAKSI ('date'):
   - Cari tanggal transaksi yang tercetak di struk (format DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, dsb).
   - Konversikan ke format standar 'YYYY-MM-DD'. Jika tanggal di struk buram/tidak ditemukan, gunakan tanggal hari ini: '${today}'.

4. TOTAL NOMINAL AKHIR ('amount'):
   - Ambil TOTAL AKHIR (Grand Total / Total Akhir / Net Total / Total Bayar) yang benar-benar dibayar.
   - JANGAN tertukar dengan Subtotal, Diskon, Kembalian (Change), atau Uang Tunai yang diserahkan (Cash Tendered).
   - Pastikan nominal berupa angka murni tanpa titik pemisah ribuan.
    - DILARANG KERAS mengambil nomor barcode, nomor transaksi, nomor izin usaha/NPWP, nomor struk, nomor meja, nomor telepon, atau kode pos sebagai nominal transaksi.

5. RINCIAN ITEM BARANG ('items', 'subtotal', 'tax', 'discount'):
   - Ekstrak seluruh daftar barang yang dibeli ke array 'items':
     * name: Nama barang (bersihkan dari nomor barcode/kode internal).
     * price: Total harga baris item tersebut.
     * qty: Jumlah barang (angka, default: 1).
   - Ekstrak subtotal (sebelum pajak/diskon), nominal pajak/PPN/PB1 (tax), dan potongan harga/promo (discount) jika tertera pada struk.

6. METODE PEMBAYARAN & PENCOCOKAN DOMPET ('paymentMethod' & 'walletId'):
   - Cari metode pembayaran di struk (misal: 'BCA DEBIT', 'QRIS GOPAY', 'MANDIRI', 'SHOPEEPAY', 'DANA', 'OVO', 'TUNAI / CASH', 'CREDIT CARD').
   - Jika cocok dengan salah satu dompet pengguna (${wallets.map(w => `ID:${w.id} (${w.name})`).join(', ')}), pilih 'walletId' dompet tersebut.

7. KATEGORISASI PENGELUARAN ('category'):
   - Pilih ID kategori yang paling sesuai dari daftar kategori:
     * Toko ritel/supermarket/minimarket -> 'kebutuhan_harian/belanja_bulanan' atau 'kebutuhan_harian/kebutuhan_pokok'.
     * Restoran/kafe/makanan -> 'makanan/restoran' atau 'makanan/kopi'.
     * Bensin/SPBU -> 'transportasi/bensin'.
     * Apotek/obat -> 'kesehatan/obat'.
     * Elektronik/gadget -> 'elektronik/gadget'.
     * Pakaian -> 'pakaian/baju'.

8. MODE SCAN (${isPerItem ? 'PER ITEM (PECAH TRANSAKSI PER BARANG)' : 'TOTAL (1 TRANSAKSI RINGKASAN)'}):
   ${isPerItem
     ? `[ATURAN MUTLAK MODE PER ITEM]:
     * DILARANG KERAS menggabungkan seluruh belanjaan menjadi 1 transaksi!
     * PANGGIL tool 'record_transactions' dengan array 'transactions' yang berisi SATU OBJEK TRANSAKSI UNTUK SETIAP ITEM BARANG yang dibeli pada struk.
     * Untuk SETIAP item barang:
       - 'notes': Nama bersih barang yang dibeli (sertakan kuantitas jika > 1, misal: "Ultra Milk 250ml (x2)").
       - 'amount': Total harga untuk baris barang tersebut (angka murni).
       - 'category': Pilih ID KATEGORI SPESIFIK yang paling cocok untuk barang tersebut (contoh: susu/kopi/makanan -> 'makanan/kopi' atau 'makanan/jajan', sabun/shampoo/odol -> 'kebutuhan_harian/perlengkapan_mandi', obat/vitamin -> 'kesehatan/obat', pakaian -> 'pakaian/baju', sayur/beras/minyak -> 'kebutuhan_harian/belanja_bulanan'). JANGAN menyamakan semua barang ke 1 kategori generic!
       - 'merchant': Nama toko/merchant di struk
       - 'date': Tanggal struk (YYYY-MM-DD)
       - 'currency': Mata uang yang terdeteksi
       - 'walletId': ID dompet yang cocok`
     : `[ATURAN MODE TOTAL]:
     * Buat 1 objek transaksi utama di array 'transactions' dengan total belanja di 'amount', seluruh rincian barang di 'items', nama toko di 'merchant', subtotal, tax, discount, dan ringkasan di 'notes'.`
   }`
  }

  const rawUserPrompt = userMessage || (imageData ? 'Lihat dan proses gambar struk ini' : 'Halo FinTrack AI')
  const wrappedUserPrompt = wrapUserTurn(rawUserPrompt)
  const currentUserText = receiptVisionInstruction ? `${wrappedUserPrompt}${receiptVisionInstruction}` : wrappedUserPrompt
  if (lastRole === 'user' && contents.length > 0) {
    // Merge with previous user message
    const userParts = contents[contents.length - 1].parts
    userParts.push({ text: '\n' + currentUserText })
    if (imageData) {
      userParts.push({
        inlineData: {
          data: imageData.split(',')[1] || imageData,
          mimeType: imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg',
        },
      })
    }
  } else {
    // Create new user message
    const userParts = [{ text: currentUserText }]
    if (imageData) {
      userParts.push({
        inlineData: {
          data: imageData.split(',')[1] || imageData,
          mimeType: imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg',
        },
      })
    }
    contents.push({ role: 'user', parts: userParts })
  }

  const callApiStreamWithFallback = async (reqContents) => {
    const { keysToTry, hasUserKey } = getApiKeysToTry()
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    let userKeyError = null

    for (const keyObj of keysToTry) {
      for (const model of CHAT_ADVISOR_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`
          const streamCtrl = new AbortController()
          const streamTimeoutId = setTimeout(() => streamCtrl.abort(), 20000)
          let res
          try {
            res = await fetch(url, {
              method: 'POST',
              signal: streamCtrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyObj.key.trim(),
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: sysPrompt }] },
                contents: reqContents,
                tools: getTools(),
                generationConfig: { temperature: 0.1 },
              }),
            })
          } finally {
            clearTimeout(streamTimeoutId)
          }
          
          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status, keyObj.isUserKey)
            lastError = new Error(cleanMsg)
            if (keyObj.isUserKey) {
              userKeyError = lastError
            }
            if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
              break
            }
            continue
          }
          
          const reader = res.body.getReader()
          const decoder = new TextDecoder('utf-8')
          const streamState = { fullText: '', functionCall: null }
          let buffer = ''

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

          return { text: streamState.fullText, functionCall: streamState.functionCall }

      } catch (err) {
        lastError = err
        if (keyObj.isUserKey) {
          userKeyError = err
        }
        
        if (err.message && (err.message.includes('404') || err.message.includes('Rate limit') || err.message.includes('429'))) {
           if (err.message.includes('Rate limit') || err.message.includes('429')) {
             console.warn(`[${model}] Rate Limit hit. Aborting fallback loop to prevent spam.`)
             break
           }
        }
      }
    }
    }
    
    // If all keys and models failed
    throw (hasUserKey && userKeyError) || lastError || new Error('Gagal menghubungi asisten AI.')
  }

  try {
    let response = await callApiStreamWithFallback(contents)
    
    if (response.functionCall) {
      const fnCall = response.functionCall
      
      if (fnCall.name === 'record_transactions') {
        const defaultWalletId = useSettingsStore.getState().defaultWalletId || wallets[0]?.id || 1
        const userExtraction = extractMerchantAndCategory(userMessage || '')
        let extractedMerchant = fnCall.args.merchantName || fnCall.args.transactions?.[0]?.merchant || ''
        if (extractedMerchant) {
          const cleanExtraction = extractMerchantAndCategory(extractedMerchant)
          if (cleanExtraction.merchant) {
            extractedMerchant = cleanExtraction.merchant
          } else if (extractedMerchant.length > 25 || /\b(kemarin|hari|habisin|beli|buat|untuk|masing)\b/i.test(extractedMerchant)) {
            extractedMerchant = userExtraction.merchant || ''
          }
        } else if (userExtraction.merchant) {
          extractedMerchant = userExtraction.merchant
        }
        const overallCurrency = fnCall.args.currency
        
        const txs = fnCall.args.transactions?.map(t => {
          let resolvedWalletId = t.walletId
          
          // Smart wallet matching from paymentMethod or merchant if not explicitly valid
          if (!resolvedWalletId || (wallets.length > 0 && !wallets.some(w => String(w.id) === String(resolvedWalletId)))) {
            const searchTerms = [t.paymentMethod, t.merchant, extractedMerchant].filter(Boolean).map(s => String(s).toLowerCase())
            const matchedWallet = wallets.find(w => {
              const wName = String(w.name || '').toLowerCase()
              const wType = String(w.institutionType || w.type || '').toLowerCase()
              return searchTerms.some(term => 
                term.includes(wName) || 
                wName.includes(term) || 
                (term.includes('tunai') && (wType === 'cash' || wName.includes('cash'))) || 
                (term.includes('cash') && (wType === 'cash' || wName.includes('tunai')))
              )
            })
            resolvedWalletId = matchedWallet ? matchedWallet.id : defaultWalletId
          }
          
          const resolvedWallet = wallets.find(w => String(w.id) === String(resolvedWalletId))
          const detectedCurrency = t.currency || overallCurrency
          const txCurrency = detectedCurrency || resolvedWallet?.currency || defaultCurrency
          
          let itemMerchant = t.merchant || extractedMerchant || undefined
          if (itemMerchant) {
            const cleanExtraction = extractMerchantAndCategory(itemMerchant)
            if (cleanExtraction.merchant) {
              itemMerchant = cleanExtraction.merchant
            } else if (itemMerchant.length > 25 || /\b(kemarin|hari|habisin|beli|buat|untuk|masing)\b/i.test(itemMerchant)) {
              itemMerchant = extractedMerchant || userExtraction.merchant || undefined
            }
          }

          let cleanNotes = t.notes || itemMerchant || ''
          if (cleanNotes && (cleanNotes.length > 30 || /\b(kemarin|hari|habisin|masing)\b/i.test(cleanNotes))) {
            cleanNotes = itemMerchant || cleanNotes
          }

          let cleanCat = sanitizeCategoryPath(t.category, t.type)
          const combinedStr = `${t.notes || ''} ${itemMerchant || ''} ${t.category || ''} ${userMessage || ''}`.toLowerCase()
          if (/\b(maxim|gojek|grab|indrive|ojol|goride|gocar|grabbike|grabcar)\b/i.test(combinedStr)) {
            cleanCat = 'transportasi/ojol'
          }

          return {
            ...t,
            category: cleanCat,
            currency: txCurrency,
            merchant: itemMerchant,
            notes: cleanNotes,
            walletId: resolvedWalletId,
            items: Array.isArray(t.items) && t.items.length > 0 ? t.items : undefined,
            subtotal: typeof t.subtotal === 'number' ? t.subtotal : undefined,
            tax: typeof t.tax === 'number' ? t.tax : undefined,
            discount: typeof t.discount === 'number' ? t.discount : undefined,
            paymentMethod: t.paymentMethod || undefined,
          }
        }) || []
        return {
          type: 'transactions',
          action: 'create',
          engine: 'online_ai',
          engineLabel: 'AI Gemini (Online)',
          transactions: txs.map((t) => ({
            ...t,
            engine: 'online_ai',
            engineLabel: 'AI Gemini (Online)',
          })),
          merchant: extractedMerchant,
          currency: overallCurrency,
          text: fnCall.args.replyMessage || "Berhasil dicatat!",
          chips: fnCall.args.suggestedChips
        }
      }
      
      if (fnCall.name === 'update_transaction') {
         return {
           type: 'transactions',
           action: 'update',
           transactionId: fnCall.args.transactionId,
           searchQuery: fnCall.args.searchQuery,
           updatedFields: fnCall.args.updatedFields,
           text: fnCall.args.replyMessage || "Transaksi berhasil diperbarui.",
           chips: fnCall.args.suggestedChips,
         }
      }
      
      if (fnCall.name === 'delete_transaction') {
         return {
           type: 'transactions',
           action: 'delete',
           transactionId: fnCall.args.transactionId,
           searchQuery: fnCall.args.searchQuery,
           date: fnCall.args.date,
           text: fnCall.args.replyMessage || "Transaksi telah dihapus.",
           chips: fnCall.args.suggestedChips,
         }
      }
      
      if (fnCall.name === 'manage_habit') {
        return { type: 'habit', action: fnCall.args.action, title: fnCall.args.title, color: fnCall.args.color, frequencyType: fnCall.args.frequencyType, reminderTime: fnCall.args.reminderTime, text: fnCall.args.replyMessage || "Memproses habit...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_todo') {
        return { type: 'todo', action: fnCall.args.action, title: fnCall.args.title, description: fnCall.args.description, category: fnCall.args.category, dueDate: fnCall.args.dueDate, priority: fnCall.args.priority, subTasks: fnCall.args.subTasks, reminderTime: fnCall.args.reminderTime, text: fnCall.args.replyMessage || "Memproses to-do...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_budget') {
        return { type: 'budget', action: fnCall.args.action, category: fnCall.args.category, limit: fnCall.args.limit, text: fnCall.args.replyMessage || "Memproses budget...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_savings') {
        return { type: 'savings', action: fnCall.args.action, name: fnCall.args.name, amount: fnCall.args.amount, walletId: fnCall.args.walletId, text: fnCall.args.replyMessage || "Memproses tabungan...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_recurring') {
        return { type: 'recurring', action: fnCall.args.action, title: fnCall.args.title, amount: fnCall.args.amount, category: fnCall.args.category, frequency: fnCall.args.frequency, text: fnCall.args.replyMessage || "Memproses langganan...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'export_report') {
        return { type: 'export', month: fnCall.args.month, text: fnCall.args.replyMessage || "Menyiapkan file laporan Anda...", chips: fnCall.args.suggestedChips }
      }
      
      if (fnCall.name === 'manage_wallet') {
        return { 
          type: 'wallet', 
          action: fnCall.args.action, 
          name: fnCall.args.name, 
          walletType: fnCall.args.walletType, 
          initialBalance: fnCall.args.initialBalance, 
          fromWalletId: fnCall.args.fromWalletId, 
          toWalletId: fnCall.args.toWalletId, 
          amount: fnCall.args.amount, 
          text: fnCall.args.replyMessage || "Memproses dompet...", 
          chips: fnCall.args.suggestedChips 
        }
      }



      if (fnCall.name === 'manage_loans') {
        return {
          type: 'loan',
          action: fnCall.args.action,
          loanType: fnCall.args.loanType || 'debt',
          title: fnCall.args.title,
          personName: fnCall.args.personName,
          amount: fnCall.args.amount,
          dueDate: fnCall.args.dueDate,
          walletId: fnCall.args.walletId ? Number(fnCall.args.walletId) : undefined,
          text: fnCall.args.replyMessage || "Memproses catat pinjaman...",
          chips: fnCall.args.suggestedChips
        }
      }
      
      if (fnCall.name === 'calculate_financial_health') {
        return await calculateDirectFinancialHealth({
          defaultCurrency,
          locale,
          rates,
          replyMessage: fnCall.args?.replyMessage,
          suggestedChips: fnCall.args?.suggestedChips,
        })
      }
      
      if (fnCall.name === 'query_database') {
        const dbResult = await queryTransactions(fnCall.args)
        
        // If renderChart is true, we return chart data immediately along with a generic text
        if (fnCall.args.renderChart) {
           const isIncome = fnCall.args.type === 'income'
           return { 
             type: 'chart',
             chartType: isIncome ? 'income' : 'expense',
             data: isIncome ? dbResult.incomeByCategory : dbResult.expenseByCategory, 
             text: isIncome ? "Berikut adalah grafik pemasukan Anda:" : "Berikut adalah grafik pengeluaran Anda:",
             chips: isIncome ? ["Apa pemasukan terbesarku?"] : ["Apa pengeluaran terbesarku?", "Bandingkan dengan bulan lalu"] 
           }
        }
        
        contents.push({ role: 'model', parts: [{ functionCall: fnCall }] })
        contents.push({
          role: 'function',
          parts: [{ functionResponse: { name: fnCall.name, response: { content: dbResult } } }]
        })
        
        const secondRes = await callApiStreamWithFallback(contents)
        let textOutput = secondRes.text || "Maaf, tidak bisa merangkum data."
        let chips = ["Analisis pengeluaranku", "Gimana cara lebih hemat?"]
        const chipMatch = textOutput.match(/<chips>(.*?)<\/chips>/)
        if (chipMatch) {
          chips = chipMatch[1].split('|').map(c => c.trim())
          textOutput = textOutput.replace(/<chips>.*?<\/chips>/, '').trim()
        }
        return { type: 'text', text: textOutput, chips, engine: 'online_ai', engineLabel: 'AI Gemini (Online)' }
      }
    }

    let textOutput = response.text || 'Maaf, saya kurang mengerti maksud Anda. Bisa dijelaskan lebih detail?'
    let chips = ["Tampilkan grafik", "Ringkasan bulan ini"]
    const chipMatch = textOutput.match(/<chips>(.*?)<\/chips>/)
    if (chipMatch) {
      chips = chipMatch[1].split('|').map(c => c.trim())
      textOutput = textOutput.replace(/<chips>.*?<\/chips>/, '').trim()
    }
    return { type: 'text', text: textOutput, chips, engine: 'online_ai', engineLabel: 'AI Gemini (Online)' }
    
  } catch (err) {
    console.error(err)
    return { error: true, message: err.message || 'Terjadi kesalahan saat menghubungi AI.' }
  }
}

export async function getFinancialAdvice(monthData, context = {}) {
  const { locale = 'id', profileName = '' } = context
  
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(locale === 'en'
      ? 'No internet connection. AI requires an active internet connection.'
      : 'Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.')
  }
  const apiKey = getEffectiveApiKey()
  if (!apiKey) {
    throw new Error('API Key Gemini belum diset.')
  }

  const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
  const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

  // Summarize monthData, unpacking splits and excluding non-analytics transactions
  let txSummary = ''
  if (!monthData || monthData.length === 0) {
    txSummary = 'Belum ada transaksi bulan ini.'
  } else {
    const flattenedTxs = []
    monthData.forEach((tx) => {
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            amount: si.amount,
            type: si.type || tx.type,
            currency: si.currency || tx.currency || defaultCurrency,
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          }
          if (!isExcludeAnalyticsTx(itemTx)) {
            flattenedTxs.push(itemTx)
          }
        })
      } else {
        if (!isExcludeAnalyticsTx(tx)) {
          flattenedTxs.push(tx)
        }
      }
    })

    const expenses = flattenedTxs.filter((tx) => tx.type === 'expense')
    const totalExpense = expenses.reduce((acc, tx) => {
      const raw = toSafeNumber(tx.amount)
      return acc + convertCurrency(raw, tx.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)
    const income = flattenedTxs.filter((tx) => tx.type === 'income')
    const totalIncome = income.reduce((acc, tx) => {
      const raw = toSafeNumber(tx.amount)
      return acc + convertCurrency(raw, tx.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)
    
    txSummary = `Total Pemasukan: ${formatCurrency(totalIncome, defaultCurrency)}\nTotal Pengeluaran: ${formatCurrency(totalExpense, defaultCurrency)}\n`
    
    // Group by category
    const byCategory = {}
    expenses.forEach((tx) => {
      const raw = toSafeNumber(tx.amount)
      const amt = convertCurrency(raw, tx.currency || defaultCurrency, defaultCurrency, activeRates)
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amt
    })
    
    txSummary += '\nRincian Pengeluaran berdasarkan kategori:\n'
    Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([cat, amt]) => {
        txSummary += `- ${cat}: ${formatCurrency(amt, defaultCurrency)}\n`
      })
  }

  const sysInstruction = buildFinancialAdvicePrompt({ profileName, locale })

  const userPrompt = `Data transaksi bulan ini:\n${txSummary}\n\nBerikan analisis keuangan Anda.`

  const callApiWithFallback = async (reqContents) => {
    const { keysToTry, hasUserKey } = getApiKeysToTry()
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    let userKeyError = null
    for (const keyObj of keysToTry) {
      for (const model of CHAT_ADVISOR_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const adviceCtrl = new AbortController()
          const adviceTimeoutId = setTimeout(() => adviceCtrl.abort(), 15000)
          let res
          try {
            res = await fetch(url, {
              method: 'POST',
              signal: adviceCtrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyObj.key.trim(),
              },
              body: JSON.stringify({ 
                systemInstruction: { parts: [{ text: sysInstruction }] },
                contents: reqContents, 
                generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } 
              })
            })
          } finally {
            clearTimeout(adviceTimeoutId)
          }
          
          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status, keyObj.isUserKey)
            lastError = new Error(cleanMsg)
            if (keyObj.isUserKey) {
              userKeyError = lastError
            }
            if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
              break
            }
            continue
          }
          
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        } catch (err) {
          lastError = err
          if (keyObj.isUserKey) {
            userKeyError = err
          }
        }
      }
    }
    throw (hasUserKey && userKeyError) || lastError || new Error('Gagal mendapatkan respon AI.')
  }

  try {
    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }]
    const response = await callApiWithFallback(contents)
    return response.text
  } catch (err) {
    console.error(err)
    throw err
  }
}

export const getMonthlyFinancialInsight = getFinancialAdvice

export async function getSavingsPrediction(goalData, { locale = 'id', profileName = '' } = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(locale === 'en'
      ? 'No internet connection. AI requires an active internet connection.'
      : 'Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.')
  }

  const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
  const goalCurrency = goalData.currency || defaultCurrency
  const currentAmt = Number(goalData.currentAmount || 0)
  const targetAmt = Number(goalData.targetAmount || 0)
  const isGoalReached = currentAmt >= targetAmt
  const remainingNeeded = Math.max(0, targetAmt - currentAmt)
  const safeGoalName = String(goalData.name || '').replace(/[\r\n\t]+/g, ' ').replace(/[\\"`<>]/g, '').slice(0, 40)
  const avgSavings = Number(goalData.avgSavings || 0)

  const sysInstruction = buildGoalPredictionPrompt({ profileName, locale, isGoalReached })

  const userPrompt = `Data Target Tabungan Pengguna:
- Nama Target: ${safeGoalName}
- Dana Terkumpul: ${formatCurrency(currentAmt, goalCurrency)}
- Target Dana: ${formatCurrency(targetAmt, goalCurrency)}
- Sisa Kebutuhan: ${formatCurrency(remainingNeeded, goalCurrency)}
- Status Capaian: ${isGoalReached ? 'TARGET SUDAH 100% TERCAPAI' : 'Sedang Berjalan'}
- Rata-rata tabungan bulanan (estimasi): ${formatCurrency(avgSavings, goalCurrency)}
- Tenggat Waktu (Opsional): ${goalData.deadline || 'Tidak ada'}

Berikan prediksi pencapaian tabungan ini.`

  const callApiWithFallback = async (reqContents) => {
    const { keysToTry, hasUserKey } = getApiKeysToTry()
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    let userKeyError = null
    for (const keyObj of keysToTry) {
      for (const model of CHAT_ADVISOR_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const predCtrl = new AbortController()
          const predTimeoutId = setTimeout(() => predCtrl.abort(), 15000)
          let res
          try {
            res = await fetch(url, {
              method: 'POST',
              signal: predCtrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyObj.key.trim(),
              },
              body: JSON.stringify({ 
                systemInstruction: { parts: [{ text: sysInstruction }] },
                contents: reqContents, 
                generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } 
              })
            })
          } finally {
            clearTimeout(predTimeoutId)
          }
          
          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status, keyObj.isUserKey)
            lastError = new Error(cleanMsg)
            if (keyObj.isUserKey) {
              userKeyError = lastError
            }
            if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
              break
            }
            continue
          }
          
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        } catch (err) {
          lastError = err
          if (keyObj.isUserKey) {
            userKeyError = err
          }
        }
      }
    }
    throw (hasUserKey && userKeyError) || lastError || new Error('Gagal mendapatkan prediksi tabungan AI.')
  }

  try {
    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }]
    const response = await callApiWithFallback(contents)
    return response.text
  } catch (err) {
    console.error(err)
    throw err
  }
}

/**
 * Scans a receipt image using Gemini Vision and extracts structured financial data.
 * @param {string} base64Data - Base64 encoded image string (with or without data URI prefix)
 * @param {string} mimeType - Image mime type e.g. 'image/jpeg' or 'image/png'
 * @param {object} options - Options including defaultCurrency and locale
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

  const callApiWithFallback = async (reqContents) => {
    const { keysToTry, hasUserKey } = getApiKeysToTry()
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    let userKeyError = null
    for (const keyObj of keysToTry) {
      for (const model of FAST_TRANSACTION_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const scanCtrl = new AbortController()
          const scanTimeoutId = setTimeout(() => scanCtrl.abort(), 25000)
          let res
          try {
            res = await fetch(url, {
              method: 'POST',
              signal: scanCtrl.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyObj.key.trim(),
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: sysInstruction }] },
                contents: reqContents,
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                },
              }),
            })
          } finally {
            clearTimeout(scanTimeoutId)
          }

          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status, keyObj.isUserKey)
            lastError = new Error(cleanMsg)
            if (keyObj.isUserKey) {
              userKeyError = lastError
            }
            if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
              break
            }
            continue
          }

          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        } catch (err) {
          lastError = err
          if (keyObj.isUserKey) {
            userKeyError = err
          }
        }
      }
    }
    throw (hasUserKey && userKeyError) || lastError || new Error('Gagal mengekstrak data struk dengan AI.')
  }

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
    const response = await callApiWithFallback(contents)
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

