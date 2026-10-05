/**
 * Self-Learning User Entity Memory Engine
 *
 * Automatically learns user's recurring transaction items, preferred categories,
 * typical amounts, and favorite wallets from the local ledger (Dexie.js).
 * Provides non-hardcoded fuzzy lookup, omission suggestions, and few-shot context.
 */
import { formatCurrency, toSafeNumber } from '../utils'
import { db as defaultDb } from '../db'
import { fuzzyFindBestMatch } from './semanticSlotFiller'
import { getDecryptedNoteSync, isFieldEncrypted } from '../fieldEncryption'

const ENTITY_MEMORY_KEY = 'ft_entity_memory_v1'

let entityCache = null
let isPreseeded = false

export function isEntityMemoryPreseeded() {
  return isPreseeded
}

/**
 * Normalizes an item or subject string into a canonical entity key.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeEntityKey(raw = '') {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .toLowerCase()
    .replace(/[()[\]{}"'.,:;!?_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Loads the in-memory entity cache from localStorage.
 * @returns {Map<string, object>}
 */
export function loadEntityCache() {
  if (entityCache !== null) return entityCache

  entityCache = new Map()
  if (typeof localStorage === 'undefined') return entityCache

  try {
    const raw = localStorage.getItem(ENTITY_MEMORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object') {
            entityCache.set(k, v)
          }
        }
      }
    }
  } catch (err) {
    console.warn('[entityMemory:loadEntityCache]', err)
  }

  return entityCache
}

export const MAX_ENTITY_CACHE_SIZE = 250

/**
 * Persists the in-memory cache to localStorage with LRU eviction.
 */
export function saveEntityCache() {
  if (!entityCache || typeof localStorage === 'undefined') return

  try {
    if (entityCache.size > MAX_ENTITY_CACHE_SIZE) {
      const sorted = [...entityCache.entries()].sort(
        (a, b) => (b[1]?.lastUsedAt || 0) - (a[1]?.lastUsedAt || 0)
      )
      entityCache = new Map(sorted.slice(0, MAX_ENTITY_CACHE_SIZE))
    }
    const obj = Object.fromEntries(entityCache.entries())
    localStorage.setItem(ENTITY_MEMORY_KEY, JSON.stringify(obj))
  } catch (err) {
    console.warn('[entityMemory:saveEntityCache]', err)
  }
}

/**
 * Clears the entity memory (used for tests and data wipe).
 */
export function clearEntityMemory() {
  entityCache = new Map()
  isPreseeded = false
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ENTITY_MEMORY_KEY)
  }
}

/**
 * Preseeds entity memory from the Dexie database (runs on app startup).
 *
 * @param {object} db - Dexie db instance
 * @returns {Promise<number>} Number of entities indexed
 */
export function preseedEntityMemoryFromDb(db = defaultDb) {
  if (!db?.transactions) return Promise.resolve(0)
  const cache = loadEntityCache()

  return db.transactions
    .filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1 && tx.type !== 'transfer' && Boolean(tx.notes || tx.merchant))
    .toArray()
    .then((allTxs) => {
      if (!allTxs || allTxs.length === 0) {
        isPreseeded = true
        return 0
      }

      // Cap to latest 300 transactions to prevent memory spikes
      const txs = allTxs
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 300)

      // Group by normalized entity key
      const groupings = new Map()

      for (const tx of txs) {
        const rawNote = tx.notes || ''
        const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
        const candidate = plainNote || tx.merchant || ''
        if (!candidate || isFieldEncrypted(candidate)) continue
        const key = normalizeEntityKey(candidate)
        if (!key || key.length < 2) continue

        if (!groupings.has(key)) {
          groupings.set(key, [])
        }
        groupings.get(key).push(tx)
      }

      for (const [key, group] of groupings.entries()) {
        const sorted = [...group].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        const latest = sorted[0]

        // Find most frequent category
        const catCounts = new Map()
        const walletCounts = new Map()
        let totalAmt = 0

        for (const t of group) {
          const cat = t.category || 'makanan/makan_siang'
          catCounts.set(cat, (catCounts.get(cat) || 0) + 1)

          if (t.walletId) {
            walletCounts.set(t.walletId, (walletCounts.get(t.walletId) || 0) + 1)
          }

          const amt = toSafeNumber(t.amount)
          totalAmt += amt
        }

        const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || latest.category
        const topWalletId = [...walletCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || latest.walletId
        const avgAmount = Math.round(totalAmt / group.length)

        const latestRawNote = latest.notes || ''
        const latestPlainNote = isFieldEncrypted(latestRawNote) ? getDecryptedNoteSync(latestRawNote) : latestRawNote
        const entityDisplayName = latestPlainNote || latest.merchant || key

        cache.set(key, {
          name: entityDisplayName,
          category: topCategory,
          lastAmount: toSafeNumber(latest.amount),
          avgAmount,
          walletId: topWalletId,
          merchant: latest.merchant || undefined,
          count: group.length,
          lastUsedAt: latest.createdAt || Date.now(),
        })
      }

      saveEntityCache()
      isPreseeded = true
      return cache.size
    })
    .catch((err) => {
      console.warn('[entityMemory:preseedEntityMemoryFromDb]', err)
      return 0
    })
}

/**
 * Updates or records an entity into the memory cache.
 *
 * @param {object} param
 * @param {string} param.notes
 * @param {string} param.category
 * @param {number} param.amount
 * @param {number|string} [param.walletId]
 * @param {string} [param.merchant]
 */
export function rememberTransactionEntity({ notes, category, amount, walletId, merchant }) {
  const candidate = notes || merchant || ''
  const key = normalizeEntityKey(candidate)
  if (!key || key.length < 2) return

  const cache = loadEntityCache()
  const existing = cache.get(key)
  const numAmt = toSafeNumber(amount)

  if (existing) {
    const newCount = (existing.count || 1) + 1
    const newAvg = Math.round(((existing.avgAmount || numAmt) * (newCount - 1) + numAmt) / newCount)
    cache.set(key, {
      ...existing,
      name: notes || existing.name,
      category: category || existing.category,
      lastAmount: numAmt > 0 ? numAmt : existing.lastAmount,
      avgAmount: numAmt > 0 ? newAvg : existing.avgAmount,
      walletId: walletId || existing.walletId,
      merchant: merchant || existing.merchant,
      count: newCount,
      lastUsedAt: Date.now(),
    })
  } else {
    cache.set(key, {
      name: candidate,
      category: category || 'makanan/makan_siang',
      lastAmount: numAmt,
      avgAmount: numAmt,
      walletId,
      merchant,
      count: 1,
      lastUsedAt: Date.now(),
    })
  }

  saveEntityCache()
}

/**
 * Fuzzy searches entity memory for a query string.
 *
 * @param {string} query
 * @param {number} [threshold=0.8]
 * @returns {object | null}
 */
export function findHistoricalEntity(query, threshold = 0.8) {
  if (!query || typeof query !== 'string') return null
  const cache = loadEntityCache()
  const clean = normalizeEntityKey(query)
  if (!clean) return null

  // 1. Direct exact match
  if (cache.has(clean)) {
    return cache.get(clean)
  }

  // 2. Substring matching
  for (const [k, v] of cache.entries()) {
    if (clean.includes(k) || k.includes(clean)) {
      return v
    }
  }

  // 3. Fuzzy Levenshtein match across keys
  const keys = Array.from(cache.keys())
  const best = fuzzyFindBestMatch(clean, keys, threshold)
  if (best && cache.has(best.match)) {
    return cache.get(best.match)
  }

  return null
}

/**
 * Predicts smart omission suggestion when user specifies item without amount.
 * Example: "tadi jam 5 beli matcha"
 *
 * @param {string} cleanItem
 * @param {Array} [wallets=[]]
 * @param {string} [defaultCurrency='IDR']
 * @param {string} [locale='id']
 * @returns {object} Suggestion payload
 */
export function predictOmissionSuggestion(cleanItem, wallets = [], defaultCurrency = 'IDR', locale = 'id') {
  const entity = findHistoricalEntity(cleanItem, 0.75)
  const isEn = locale === 'en'

  if (entity && entity.lastAmount > 0) {
    const matchedWallet = wallets.find((w) => String(w.id) === String(entity.walletId))
    const walletName = matchedWallet?.name || (isEn ? 'Primary Wallet' : 'Dompet Utama')
    const formattedLast = formatCurrency(entity.lastAmount, defaultCurrency)

    const text = isEn
      ? `What was the amount for **${entity.name}**? (Last recorded: ${formattedLast} via ${walletName}).`
      : `Berapa nominal **${entity.name}**? (Terakhir kali: ${formattedLast} via ${walletName}).`

    const lastAmt = entity.lastAmount
    const chipOptions = [
      formatCurrency(lastAmt, defaultCurrency),
      formatCurrency(Math.round(lastAmt * 1.2), defaultCurrency),
      formatCurrency(Math.round(lastAmt * 0.8), defaultCurrency),
      isEn ? 'Custom Amount' : 'Nominal Lain',
    ]

    return {
      found: true,
      entity,
      suggestedAmount: lastAmt,
      suggestedCategory: entity.category,
      suggestedWalletId: entity.walletId,
      message: text,
      chips: chipOptions,
    }
  }

  const text = isEn
    ? `Please specify the amount for **${cleanItem}** (e.g. "${cleanItem} 25k").`
    : `Berapa nominal untuk **${cleanItem}**? (Contoh: "${cleanItem} 25rb").`

  return {
    found: false,
    message: text,
    chips: [
      formatCurrency(15000, defaultCurrency),
      formatCurrency(25000, defaultCurrency),
      formatCurrency(50000, defaultCurrency),
      formatCurrency(100000, defaultCurrency),
    ],
  }
}

/**
 * Retrieves the user's top frequent entities for few-shot prompt injection.
 *
 * @param {number} [limit=5]
 * @returns {Array<object>}
 */
export function getFrequentUserEntities(limit = 5) {
  const cache = loadEntityCache()
  return Array.from(cache.values())
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, limit)
}

/**
 * Returns all memory entries as an array (mirroring getMerchantMemoryEntries).
 * @returns {Array<object>}
 */
export function getEntityMemoryEntries() {
  const cache = loadEntityCache()
  return Array.from(cache.values())
}

/**
 * Forgets or decrements an entity in the memory cache when a transaction is deleted.
 *
 * @param {string|object} candidateOrTx - Notes/merchant string or transaction object
 */
export function forgetTransactionEntity(candidateOrTx) {
  if (!candidateOrTx) return
  const candidate = typeof candidateOrTx === 'string'
    ? candidateOrTx
    : (candidateOrTx.notes || candidateOrTx.merchant || '')
  const key = normalizeEntityKey(candidate)
  if (!key || key.length < 2) return

  const cache = loadEntityCache()
  const existing = cache.get(key)
  if (existing) {
    if (existing.count > 1) {
      existing.count -= 1
      cache.set(key, existing)
    } else {
      cache.delete(key)
    }
    saveEntityCache()
  }
}

/**
 * Updates memory when a transaction is edited (replaces old entity weighting with new).
 *
 * @param {object} oldTx
 * @param {object} newTx
 */
export function updateEntityMemory(oldTx, newTx) {
  if (!oldTx && !newTx) return
  const oldCandidate = oldTx ? (oldTx.notes || oldTx.merchant || '') : ''
  const newCandidate = newTx ? (newTx.notes || newTx.merchant || '') : ''

  const oldKey = normalizeEntityKey(oldCandidate)
  const newKey = normalizeEntityKey(newCandidate)

  if (oldKey && oldKey === newKey && newTx) {
    const cache = loadEntityCache()
    const existing = cache.get(newKey)
    if (existing) {
      const numAmt = toSafeNumber(newTx.amount)
      cache.set(newKey, {
        ...existing,
        name: newTx.notes || existing.name,
        category: newTx.category || existing.category,
        lastAmount: numAmt > 0 ? numAmt : existing.lastAmount,
        walletId: newTx.walletId || existing.walletId,
        merchant: newTx.merchant || existing.merchant,
        lastUsedAt: Date.now(),
      })
      saveEntityCache()
      return
    }
  }

  if (oldCandidate) {
    forgetTransactionEntity(oldCandidate)
  }
  if (newTx) {
    rememberTransactionEntity(newTx)
  }
}
