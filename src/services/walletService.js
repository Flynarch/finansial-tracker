import { db } from '../lib/db'
import { invalidateWalletBalance } from '../lib/balanceEngine'

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
  await invalidateWalletBalance([id])
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
  const res = await db.wallets.update(walletId, payload)
  await invalidateWalletBalance([walletId])
  return res
}

/**
 * Deletes a wallet and cascades deletion to linked transactions.
 *
 * @param {number} id - Wallet ID
 * @returns {Promise<void>}
 */
export async function deleteWallet(id) {
  // Soft-delete: archive the wallet instead of hard-deleting to preserve
  // transaction history and prevent counterparty wallet balance corruption.
  // Archived wallets are hidden from active lists while their balance and transactions remain intact.
  return archiveWallet(id)
}

/**
 * Archives a wallet (soft delete).
 *
 * @param {number} id - Wallet ID
 * @returns {Promise<number>}
 */
export async function archiveWallet(id) {
  const walletId = Number(id)
  const res = await db.wallets.update(walletId, { isArchived: 1 })
  await invalidateWalletBalance([walletId])

  try {
    const useSettingsStore = (await import('../store/useSettingsStore')).default
    const { defaultWalletId, setDefaultWalletId } = useSettingsStore.getState()
    if (Number(defaultWalletId) === walletId) {
      const remainingActive = await db.wallets.filter((w) => !w.isArchived && w.id !== walletId).first()
      await setDefaultWalletId(remainingActive ? remainingActive.id : null)
    }
  } catch (err) {
    console.warn('[walletService:archiveWallet]', err)
  }

  return res
}

/**
 * Unarchives a wallet.
 *
 * @param {number} id - Wallet ID
 * @returns {Promise<number>}
 */
export async function unarchiveWallet(id) {
  const walletId = Number(id)
  const res = await db.wallets.update(walletId, { isArchived: 0 })
  await invalidateWalletBalance([walletId])
  return res
}
