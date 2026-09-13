import { db, computeWalletBalance, computeAllWalletBalances } from './db'

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
export async function recomputeAndCacheWalletBalance(walletId, rates = null, allWallets = null) {
  const cleanId = Number(walletId)
  if (!cleanId) return 0

  const wallet = await db.wallets.get(cleanId)
  if (!wallet) return 0

  const [srcTxsNum, srcTxsStr, tgtTxsNum, tgtTxsStr] = await Promise.all([
    db.transactions.where('walletId').equals(cleanId).toArray(),
    db.transactions.where('walletId').equals(String(cleanId)).toArray(),
    db.transactions.where('targetWalletId').equals(cleanId).toArray(),
    db.transactions.where('targetWalletId').equals(String(cleanId)).toArray(),
  ])
  const txMap = new Map()
  for (const tx of [...srcTxsNum, ...srcTxsStr, ...tgtTxsNum, ...tgtTxsStr]) {
    if (tx && tx.id != null) {
      txMap.set(tx.id, tx)
    }
  }
  const transactions = Array.from(txMap.values())

  const walletsList = allWallets || (await db.wallets.toArray())
  const computed = computeWalletBalance(wallet, transactions, rates, walletsList)

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
  if (!walletIds || (Array.isArray(walletIds) && walletIds.length === 0)) {
    return await invalidateAllBalances()
  }

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

/**
 * Gets current balances for all given wallets using cached values when available.
 *
 * @param {Array} wallets - Array of wallet objects from db.wallets
 * @param {object} [rates] - Exchange rates map
 * @returns {Promise<Array>} - Array of wallets with currentBalance property attached
 */
export async function getAllWalletBalances(wallets = [], rates = null) {
  if (!Array.isArray(wallets) || wallets.length === 0) return []

  const results = new Map()
  const uncachedWallets = []

  // 1. Check in-memory cache
  for (const w of wallets) {
    const cleanId = Number(w.id)
    if (cleanId && memoryBalanceCache.has(cleanId)) {
      results.set(cleanId, memoryBalanceCache.get(cleanId))
    } else {
      uncachedWallets.push(w)
    }
  }

  // 2. Check IndexedDB cache for uncached wallets
  if (uncachedWallets.length > 0 && db.walletBalanceCache) {
    const stillUncached = []
    await Promise.all(
      uncachedWallets.map(async (w) => {
        const cleanId = Number(w.id)
        try {
          const cachedRow = await db.walletBalanceCache.get(cleanId)
          if (cachedRow && Number.isFinite(cachedRow.balance)) {
            memoryBalanceCache.set(cleanId, cachedRow.balance)
            results.set(cleanId, cachedRow.balance)
            return
          }
        } catch {
          // Ignore cache query failure
        }
        stillUncached.push(w)
      })
    )
    uncachedWallets.length = 0
    uncachedWallets.push(...stillUncached)
  }

  // 3. Batch recompute for remaining uncached wallets
  if (uncachedWallets.length === 1) {
    const w = uncachedWallets[0]
    const bal = await recomputeAndCacheWalletBalance(w.id, rates, wallets)
    results.set(Number(w.id), bal)
  } else if (uncachedWallets.length > 1) {
    const allTxs = await db.transactions.toArray()
    const computedWallets = computeAllWalletBalances(wallets, allTxs, rates)
    const cacheRows = []

    for (const cw of computedWallets) {
      const cleanId = Number(cw.id)
      const bal = Number(cw.currentBalance) || 0
      results.set(cleanId, bal)
      memoryBalanceCache.set(cleanId, bal)
      cacheRows.push({ walletId: cleanId, balance: bal, updatedAt: Date.now() })
    }

    try {
      if (db.walletBalanceCache && cacheRows.length > 0) {
        await db.walletBalanceCache.bulkPut(cacheRows)
      }
    } catch {
      // Ignore cache write failures
    }
  }

  return wallets.map((w) => ({
    ...w,
    currentBalance: results.get(Number(w.id)) ?? (Number(w.balance) || 0),
  }))
}
