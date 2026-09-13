import { create } from 'zustand'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transactionService'

const useTransactionStore = create((set) => ({
  isQuickAddOpen: false,
  quickAddNonce: 0,
  openQuickAdd: () =>
    set((state) => ({ isQuickAddOpen: true, quickAddNonce: state.quickAddNonce + 1 })),
  closeQuickAdd: () => set({ isQuickAddOpen: false }),
  // Forwarded service mutations (Single Source of Truth)
  addTransaction: async (payload) => {
    return await createTransaction(payload)
  },
  updateTransaction: async (id, payload) => {
    return await updateTransaction(id, payload)
  },
  deleteTransaction: async (id) => {
    return await deleteTransaction(id)
  },
}))

export default useTransactionStore
