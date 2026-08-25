import { db } from '../lib/db'

/**
 * Creates a new wallet account in Dexie.
 *
 * @param {object} payload - Wallet data
 * @returns {Promise<number>} - ID of the created wallet
 */
export async function createWallet(payload) {
  const id = await db.wallets.add({
    ...payload,
    createdAt: payload.createdAt || Date.now(),
    balance: payload.balance || 0,
  })
  return id
}

/**
 * Updates an existing wallet by ID.
 *
 * @param {number} id - Wallet ID
 * @param {object} payload - Fields to update
 * @returns {Promise<number>}
 */
export async function updateWallet(id, payload) {
  const walletId = Number(id)
  return await db.wallets.update(walletId, payload)
}

/**
 * Deletes a wallet and cascades deletion to linked transactions.
 *
 * @param {number} id - Wallet ID
 * @returns {Promise<void>}
 */
export async function deleteWallet(id) {
  const walletId = Number(id)
  const txsToDelete = await db.transactions
    .filter((tx) => tx.walletId === walletId || tx.targetWalletId === walletId)
    .primaryKeys()

  await db.transaction('rw', db.transactions, db.wallets, async () => {
    if (txsToDelete.length > 0) {
      await db.transactions.bulkDelete(txsToDelete)
    }
    await db.wallets.delete(walletId)
  })
}

/**
 * Archives a wallet (soft delete).
 *
 * @param {number} id - Wallet ID
 * @returns {Promise<number>}
 */
export async function archiveWallet(id) {
  const walletId = Number(id)
  return await db.wallets.update(walletId, { isArchived: 1 })
}

/**
 * Unarchives a wallet.
 *
 * @param {number} id - Wallet ID
 * @returns {Promise<number>}
 */
export async function unarchiveWallet(id) {
  const walletId = Number(id)
  return await db.wallets.update(walletId, { isArchived: 0 })
}
