import { db, computeWalletBalance } from './db'

/**
 * In-memory balance cache to avoid redundant recalculation
 */
const memoryBalanceCache = new Map()

/**
 * Gets the current dynamic balance of a single wallet, using cache when available.
 *
 * @param {number|string} walletId - ID of the wallet
 * @param {object} [rates] - Exchange rates map
 * @returns {Promise<number>} - Computed balance
 */
export async function getWalletBalance(walletId, rates = null) {
  const cleanId = Number(walletId)
  if (!cleanId) return 0

  // 1. Check in-memory cache
  if (memoryBalanceCache.has(cleanId)) {
    return memoryBalanceCache.get(cleanId)
  }

  // 2. Check IndexedDB cache table
  try {
    const cachedRow = await db.walletBalanceCache?.get(cleanId)
    if (cachedRow && Number.isFinite(cachedRow.balance)) {
      memoryBalanceCache.set(cleanId, cachedRow.balance)
      return cachedRow.balance
    }
  } catch {
    // Cache table might not exist yet or query failed
  }

  // 3. Cache miss: recompute from source transactions
  return await recomputeAndCacheWalletBalance(cleanId, rates)
}

/**
 * Recomputes balance from all transactions and writes to cache.
 *
 * @param {number} walletId
 * @param {object} [rates]
 * @returns {Promise<number>}
 */
export async function recomputeAndCacheWalletBalance(walletId, rates = null) {
  const cleanId = Number(walletId)
  if (!cleanId) return 0

  const wallet = await db.wallets.get(cleanId)
  if (!wallet) return 0

  const transactions = await db.transactions
    .filter((tx) => tx.walletId === cleanId || tx.targetWalletId === cleanId)
    .toArray()

  const computed = computeWalletBalance(wallet, transactions, rates)

  // Update in-memory cache
  memoryBalanceCache.set(cleanId, computed)

  // Update DB cache
  try {
    if (db.walletBalanceCache) {
      await db.walletBalanceCache.put({
        walletId: cleanId,
        balance: computed,
        updatedAt: Date.now(),
      })
    }
  } catch {
    // Ignore cache write failures
  }

  return computed
}

/**
 * Invalidates cache for a specific wallet or multiple wallets.
 *
 * @param {number|number[]} walletIds
 */
export async function invalidateWalletBalance(walletIds) {
  const ids = Array.isArray(walletIds) ? walletIds : [walletIds]

  for (const rawId of ids) {
    const cleanId = Number(rawId)
    if (!cleanId) continue

    memoryBalanceCache.delete(cleanId)
    try {
      if (db.walletBalanceCache) {
        await db.walletBalanceCache.delete(cleanId)
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Invalidates all wallet balances (e.g. after CSV import or data restore).
 */
export async function invalidateAllBalances() {
  memoryBalanceCache.clear()
  try {
    if (db.walletBalanceCache) {
      await db.walletBalanceCache.clear()
    }
  } catch {
    // Ignore
  }
}
