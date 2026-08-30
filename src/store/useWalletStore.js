import { create } from 'zustand'
import {
  createWallet,
  updateWallet,
  deleteWallet,
} from '../services/walletService'

const useWalletStore = create(() => ({
  isLoading: false,

  createWallet: async (payload) => {
    return await createWallet(payload)
  },

  updateWallet: async (id, payload) => {
    return await updateWallet(id, payload)
  },

  deleteWallet: async (id) => {
    return await deleteWallet(id)
  },
}))

export default useWalletStore
