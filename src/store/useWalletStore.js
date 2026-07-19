import { create } from 'zustand'
import { db } from '../lib/db'

const useWalletStore = create((set, get) => ({
  wallets: [],
  isLoading: false,
  
  loadWallets: async () => {
    set({ isLoading: true })
    try {
      const wallets = await db.wallets.toArray()
      set({ wallets, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      console.error('Failed to load wallets:', error)
      throw error
    }
  },

  createWallet: async (payload) => {
    try {
      const id = await db.wallets.add({
        ...payload,
        createdAt: payload.createdAt || Date.now(),
        balance: payload.balance || 0,
      })
      await get().loadWallets()
      return id
    } catch (error) {
      console.error('Failed to create wallet:', error)
      throw error
    }
  },

  updateWallet: async (id, payload) => {
    try {
      await db.wallets.update(id, payload)
      await get().loadWallets()
    } catch (error) {
      console.error('Failed to update wallet:', error)
      throw error
    }
  },

  deleteWallet: async (id) => {
    try {
      await db.wallets.delete(id)
      await get().loadWallets()
    } catch (error) {
      console.error('Failed to delete wallet:', error)
      throw error
    }
  },
}))

export default useWalletStore
