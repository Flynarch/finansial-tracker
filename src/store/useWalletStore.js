import { create } from 'zustand'
import {
  createWallet,
  updateWallet,
  deleteWallet,
  archiveWallet,
  unarchiveWallet,
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

  archiveWallet: async (id) => {
    return await archiveWallet(id)
  },

  unarchiveWallet: async (id) => {
    return await unarchiveWallet(id)
  },
}))

export default useWalletStore
