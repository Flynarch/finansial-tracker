/**
 * Hybrid 3-Tier Intelligent Merchant Categorizer
 *
 * Tier 1: User Historical Memory Cache (0ms, LocalStorage & In-Memory Map)
 * Tier 2: Fast-Path Rule & Slang Dictionary (0ms, Offline Fallback)
 * Tier 3: Asynchronous Gemini AI Categorizer (Gemini Flash Lite, JSON Structured Output)
 */
import { db } from '../db'
import { matchCategoryFromDescription } from '../merchantUtils'
import { sanitizeCategoryPath } from '../categorySanitizer'
import { getApiKeysToTry, FAST_TRANSACTION_MODELS } from './client'

const MEMORY_STORAGE_KEY = 'ft_merchant_category_memory_v1'

// In-memory Map for O(1) synchronous lookup
let memoryCache = null
let isPreseeded = false

/**
 * Normalizes raw merchant names or notes into a consistent lookup key.
 * Strips branch indicators, transaction prefixes, digits, and excess whitespace.
 *
 * Example:
 * "TRSF E-BANKING DB KOPI KENANGAN GRAND INDONESIA" -> "kopi kenangan"
 * "[Auto: ShopeePay] Mie Gacoan Cabang 05" -> "mie gacoan"
 *
 * @param {string} rawName
 * @returns {string}
 */
export function normalizeMerchantKey(rawName = '') {
  if (!rawName || typeof rawName !== 'string') return ''

  return rawName
    .toLowerCase()
    .replace(/^(?:\[[^\]]+\]\s*)+/, '')
    .replace(/\[kategori diprediksi ai\]/gi, '')
    .replace(/^(?:pindah\s+dana:?|bayar\s+qris|bayar\b|pembayaran\s+qris|pembayaran\b|transfer\s+ke\s+rek|transfer\s+ke\b|transfer\b|trsf\b|qris\b|terima\b|kirim\b|topup\b|isi\s+saldo\b|toko\b|merchant:?\b)\s*(?:ke|di|dari)?\s*/i, '')
    .replace(/\b(?:pt|cv|tbk)\b/gi, '')
    .replace(/\b(?:cabang|outlet|store|mall|plaza|blok|no\.?|lt\.?)(?:\s+[a-z0-9\-.]+)?\b/gi, '')
    .replace(/\b(?:jakarta|bandung|surabaya|semarang|yogyakarta|bali|medan|bekasi|tangerang|depok|bogor)\b/gi, '')
    .replace(/\b(?:utara|selatan|timur|barat|pusat)\b/gi, '')
    .replace(/\b(?:sudirman|thamrin|kuningan)\b/gi, '')
    .replace(/\b(?:inv|order|ref|trx|tx)[a-z0-9/_.-]*\b/gi, '')
    .replace(/#[a-z0-9_-]+/gi, '')
    .replace(/\b(?:\d{4}[/-]\d{2}[/-]\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b/g, '')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Loads the merchant category memory cache from localStorage.
 * @returns {Map<string, string>}
 */
function loadMemoryCache() {
  if (memoryCache !== null) return memoryCache

  memoryCache = new Map()
  if (typeof localStorage === 'undefined') return memoryCache

  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') memoryCache.set(k, v)
        }
      }
    }
  } catch (err) {
    console.warn('[merchantCategorizer:loadMemoryCache]', err)
  }

  return memoryCache
}

/**
 * Saves the in-memory cache to localStorage.
 */
function saveMemoryCache() {
  if (!memoryCache || typeof localStorage === 'undefined') return

  try {
    const obj = Object.fromEntries(memoryCache.entries())
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(obj))
  } catch (err) {
    console.warn('[merchantCategorizer:saveMemoryCache]', err)
  }
}

/**
 * Clears the memory cache (used for unit tests and settings reset).
 */
export function clearMerchantMemory() {
  memoryCache = new Map()
  isPreseeded = false
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(MEMORY_STORAGE_KEY)
  }
}

/**
 * Returns all learned merchant-category entries.
 * @returns {Record<string, string>}
 */
export function getMerchantMemoryEntries() {
  const cache = loadMemoryCache()
  return Object.fromEntries(cache.entries())
}

function matchesWordBoundary(text = '', query = '') {
  if (!text || !query) return false
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i').test(text)
}

/**
 * Tier 1 Lookup: Checks if a merchant category has been remembered.
 *
 * @param {string} merchantName
 * @param {'expense'|'income'} [type='expense']
 * @returns {string|null}
 */
export function getRememberedCategory(merchantName = '', type = 'expense') {
  const key = normalizeMerchantKey(merchantName)
  if (!key || key.length < 2) return null

  const cache = loadMemoryCache()
  const compositeKey = `${type}:${key}`

  if (cache.has(compositeKey)) {
    return cache.get(compositeKey)
  }

  // Fallback to plain key if type matches
  if (cache.has(key)) {
    return cache.get(key)
  }

  // Word boundary / token matching across remembered merchants of same type
  // Prefer longest matching merchant key
  const prefix = `${type}:`
  let bestMatch = null
  let bestMatchLen = 0
  const keyTokens = key.split(' ').filter((w) => w.length >= 3)

  for (const [k, v] of cache.entries()) {
    if (k.startsWith(prefix)) {
      const storedKey = k.slice(prefix.length)
      if (storedKey.length >= 3) {
        const isWordBoundaryMatch = matchesWordBoundary(key, storedKey) || matchesWordBoundary(storedKey, key)
        if (isWordBoundaryMatch) {
          const matchLen = Math.min(key.length, storedKey.length)
          if (matchLen > bestMatchLen) {
            bestMatch = v
            bestMatchLen = matchLen
          }
        } else if (keyTokens.length > 0) {
          const storedTokens = storedKey.split(' ').filter((w) => w.length >= 3)
          const sharedTokens = keyTokens.filter((t) => storedTokens.includes(t))
          if (sharedTokens.length >= 2) {
            const overlapLen = sharedTokens.reduce((acc, t) => acc + t.length, 0)
            if (overlapLen > bestMatchLen) {
              bestMatch = v
              bestMatchLen = overlapLen
            }
          }
        }
      }
    }
  }

  if (bestMatch) return bestMatch

  return null
}

/**
 * Remembers a merchant -> category mapping in persistent local memory.
 *
 * @param {string} merchantName
 * @param {string} categoryId
 * @param {'expense'|'income'} [type='expense']
 */
export function rememberMerchantCategory(merchantName = '', categoryId = '', type = 'expense') {
  if (!merchantName || !categoryId) return
  if (categoryId === 'lainnya_kategori/umum' || categoryId === 'lainnya/umum' || categoryId === 'Lainnya') {
    return // Do not remember generic fallback categories
  }

  const key = normalizeMerchantKey(merchantName)
  if (!key || key.length < 2) return

  const cache = loadMemoryCache()
  const compositeKey = `${type}:${key}`
  cache.set(compositeKey, categoryId)
  saveMemoryCache()
}

/**
 * Tier 2 Lookup: Pure synchronous rule & slang dictionary matching.
 *
 * @param {string} merchantName
 * @param {'expense'|'income'} [type='expense']
 * @returns {string|null}
 */
export function classifyMerchantWithRules(merchantName = '', type = 'expense') {
  const matched = matchCategoryFromDescription(merchantName, type)
  if (!matched || matched === 'lainnya_kategori/umum' || matched === 'lainnya/umum') {
    return null
  }
  return matched
}

/**
 * Pre-seeds the memory cache from user's existing historical transactions in Dexie.
 * Runs once per session at app startup to ensure instant familiarity.
 */
export async function preseedMerchantMemoryFromDb() {
  if (isPreseeded) return
  isPreseeded = true

  try {
    const recentTxs = await db.transactions
      .orderBy('date')
      .reverse()
      .limit(300)
      .toArray()

    const cache = loadMemoryCache()
    let newEntries = 0

    for (const tx of recentTxs) {
      if (!tx || tx.deletedAt || tx.isPendingReview === true || tx.isPendingReview === 1) continue
      const cat = tx.category
      if (!cat || cat === 'lainnya_kategori/umum' || cat === 'lainnya/umum' || cat === 'Lainnya') continue

      const merchant = tx.cleanMerchant || tx.merchant || tx.description || tx.notes || ''
      const key = normalizeMerchantKey(merchant)
      if (!key || key.length < 3) continue

      const type = tx.type === 'income' ? 'income' : 'expense'
      const compositeKey = `${type}:${key}`

      if (!cache.has(compositeKey)) {
        cache.set(compositeKey, cat)
        newEntries++
      }
    }

    if (newEntries > 0) {
      saveMemoryCache()
    }
  } catch (err) {
    console.warn('[merchantCategorizer:preseedMerchantMemoryFromDb]', err)
  }
}

/**
 * Tier 3: Classifies an unknown merchant using Gemini Flash AI.
 * Automatically saves the result to Tier 1 Memory Cache on success.
 *
 * @param {string} merchantName
 * @param {'expense'|'income'} [type='expense']
 * @param {object} [options={}]
 * @returns {Promise<string|null>}
 */
export async function classifyMerchantWithAi(merchantName = '', type = 'expense', options = {}) {
  if (!merchantName || merchantName.trim().length < 2) return null

  // Fast offline check
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null
  }

  const prompt = `Anda adalah sistem kategorisasi transaksi keuangan cerdas di Indonesia.
Tugas Anda: Klasifikasikan nama merchant/toko/pembayaran ini ke salah satu kategori resmi FinTrack.

NAMA MERCHANT: "${merchantName.trim()}"
JENIS TRANSAKSI: "${type === 'income' ? 'Pemasukan (income)' : 'Pengeluaran (expense)'}"

KATEGORI PENGELUARAN YANG VALID:
- makanan/kopi (Kopi, Kafe, Minuman Boba/Teh)
- makanan/makan_diluar (Restoran, Rumah Makan, Warung, Fastfood, GoFood, GrabFood)
- makanan/makan_siang, makanan/makan_malam, makanan/sarapan, makanan/jajan
- kebutuhan_harian/belanja_bulanan (Supermarket, Minimarket, Alfamart, Indomaret, Sayur, Pasar, Toko Sembako)
- kebutuhan_harian/laundry (Cuci baju, Dry clean)
- tagihan/listrik (PLN, Token Listrik)
- tagihan/air (PDAM)
- tagihan/internet (WiFi, Indihome, Biznet, First Media)
- tagihan/paket_data (Pulsa, Kuota Internet, Telkomsel, Indosat, XL, Tri, By.U)
- tagihan/langganan (Netflix, Spotify, YouTube Premium, iCloud, ChatGPT)
- tagihan/cicilan (Paylater, KPR, Sewa Kost, Pinjaman)
- tagihan/asuransi (BPJS, Asuransi Jiwa/Kesehatan)
- transportasi/bensin (SPBU, Pertamina, Shell, BP AKR)
- transportasi/ojol (Gojek, Grab, Maxim, Ojek Online)
- transportasi/taksi (Bluebird, Taksi)
- transportasi/parkir, transportasi/tol (E-toll)
- transportasi/kereta (KAI, KRL Commuter, MRT, LRT)
- transportasi/bis (TransJakarta, Bus Antarkota, Tiket Bus)
- kultur/bioskop (XXI, CGV, Cinepolis, Nonton Film)
- kultur/games (Steam, PlayStation, Google Play Games, Top Up Game)
- kesehatan/obat (Apotek, Kimia Farma, Guardian, Watsons, Halodoc, Beli Obat)
- kesehatan/dokter (Klinik, Rumah Sakit, Dokter Gigi, Laboratorium Medis)
- pakaian/baju (Toko Baju, Sepatu, Celana, Fashion, Butik)
- kecantikan/skincare (Skincare, Salon, Barbershop, Pangkas Rambut, Perawatan)
- kehidupan_sosial/amal_donasi (Sedekah, Zakat, Infaq, Kitabisa, Donasi)
- lainnya_kategori/pajak (Pajak, Biaya Admin Bank)
- lainnya_kategori/umum (Jika benar-benar tidak teridentifikasi)

KATEGORI PEMASUKAN YANG VALID:
- gaji/gaji_pokok (Gaji Bulanan, Payroll, Salary, Upah)
- gaji/lembur, gaji/tunjangan
- bonus/thr (THR Lebaran/Natal, Bonus Tahunan)
- bonus/cashback (Cashback belanja, Pengembalian dana, Refund)
- bonus/hadiah (Kado, Hadiah uang)
- bisnis/penjualan (Hasil jual barang, Omset toko)
- bisnis/freelance (Honor proyek, Desain, Konsultasi, Jasa)
- bisnis/komisi (Affiliate, Fee perantara)
- investasi/bunga_bank (Bunga tabungan/deposito)
- investasi/dividen (Dividen saham/reksadana)
- lainnya/umum (Pemasukan umum lainnya)

OUTPUT HARUS PERSIS FORMAT JSON MURNI:
{
  "category": "parentId/childId",
  "confidence": 0.95
}`

  if (options.apiKey !== undefined && (!options.apiKey || !options.apiKey.trim())) {
    return null
  }
  const keys = options.apiKey !== undefined
    ? [{ key: options.apiKey.trim(), isUserKey: true }]
    : getApiKeysToTry().keysToTry

  if (!keys || keys.length === 0) return null

  for (const keyObj of keys) {
    for (const model of FAST_TRANSACTION_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 6000)

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': keyObj.key.trim(),
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 150,
              responseMimeType: 'application/json',
            },
          }),
          signal: ctrl.signal,
        })

        clearTimeout(timer)

        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {
            continue
          }
          break
        }

        const data = await response.json()
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!content) continue

        const parsedJson = JSON.parse(content)
        const rawCategory = parsedJson?.category
        if (!rawCategory) continue

        const sanitized = sanitizeCategoryPath(rawCategory, type)
        if (sanitized && sanitized !== 'lainnya_kategori/umum' && sanitized !== 'lainnya/umum') {
          rememberMerchantCategory(merchantName, sanitized, type)
          return sanitized
        }
      } catch (err) {
        console.warn('[merchantCategorizer:classifyMerchantWithAi]', err.message || err)
        break
      }
    }
  }

  return null
}

/**
 * 3-Tier Hybrid Classification Pipeline.
 *
 * @param {string} merchantName - Clean or raw merchant name
 * @param {'expense'|'income'} [type='expense'] - Transaction type
 * @param {object} [options={}]
 * @param {boolean} [options.allowAi=false] - Whether to call Gemini AI synchronously if Tier 1 & 2 miss
 * @returns {Promise<{ category: string, source: 'memory'|'rule'|'ai'|'fallback', confidence: number }>}
 */
export async function classifyMerchantHybrid(merchantName = '', type = 'expense', options = {}) {
  const allowAi = options.allowAi ?? options.enableAi ?? false
  const defaultFallback = type === 'income' ? 'lainnya/umum' : 'lainnya_kategori/umum'

  if (!merchantName) {
    return { category: defaultFallback, source: 'fallback', confidence: 0.2 }
  }

  // Tier 1: User Historical Memory Cache
  const remembered = getRememberedCategory(merchantName, type)
  if (remembered) {
    return { category: remembered, source: 'memory', confidence: 0.95 }
  }

  // Tier 2: Fast-Path Rule & Slang Dictionary
  const ruleCategory = matchCategoryFromDescription(merchantName, type)
  if (ruleCategory && ruleCategory !== 'lainnya_kategori/umum' && ruleCategory !== 'lainnya/umum') {
    rememberMerchantCategory(merchantName, ruleCategory, type)
    return { category: ruleCategory, source: 'rule', confidence: 0.85 }
  }

  // Tier 3: Asynchronous Gemini AI Categorizer (if explicitly allowed)
  if (allowAi) {
    const aiCategory = await classifyMerchantWithAi(merchantName, type, options)
    if (aiCategory) {
      return { category: aiCategory, source: 'ai', confidence: 0.92 }
    }
  }

  return { category: defaultFallback, source: 'fallback', confidence: 0.2 }
}

/**
 * Background AI enrichment worker for newly inserted transactions with generic fallback categories.
 * Enriches pending transactions asynchronously in batches of 3 without blocking notification ingestion.
 *
 * @param {Array<number|string>} transactionIds - Newly inserted transaction IDs
 * @param {object} [options={}]
 */
export async function enrichPendingMutationsWithAi(transactionIds = [], options = {}) {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) return

  // Fast offline check
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  const { keysToTry } = getApiKeysToTry()
  const apiKey = options.apiKey || (keysToTry && keysToTry[0]?.key)
  if (!apiKey) return

  try {
    const candidates = await db.transactions
      .where('id')
      .anyOf(transactionIds.map(Number))
      .toArray()

    const unclassified = candidates.filter((tx) => {
      return (
        !tx.deletedAt &&
        (tx.category === 'lainnya_kategori/umum' ||
          tx.category === 'lainnya/umum' ||
          tx.category === 'Lainnya' ||
          !tx.category)
      )
    })

    if (unclassified.length === 0) return

    let updatedCount = 0

    // Process up to 5 items to preserve quota and speed
    const batch = unclassified.slice(0, 5)

    for (const tx of batch) {
      const merchant = tx.cleanMerchant || tx.merchant || tx.description || tx.notes || ''
      if (!merchant || merchant.length < 3) continue

      const type = tx.type === 'income' ? 'income' : 'expense'
      const aiCategory = await classifyMerchantWithAi(merchant, type, { ...options, apiKey })

      if (aiCategory && aiCategory !== 'lainnya_kategori/umum' && aiCategory !== 'lainnya/umum') {
        const existingNotes = tx.notes || ''
        const updatedNotes = existingNotes.toLowerCase().includes('[kategori diprediksi ai]')
          ? existingNotes
          : `${existingNotes ? `${existingNotes} ` : ''}[Kategori diprediksi AI]`.trim()
        await db.transactions.update(tx.id, {
          category: aiCategory,
          notes: updatedNotes,
        })
        updatedCount++
      }
    }

    if (updatedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ft-mutations-categorized', { detail: { updatedCount } })
      )
    }
  } catch (err) {
    console.warn('[merchantCategorizer:enrichPendingMutationsWithAi]', err)
  }
}
