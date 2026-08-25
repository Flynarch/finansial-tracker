import { create } from 'zustand'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transactionService'

export const defaultCategories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Salary',
  'Other',
]

const initialFilters = {
  search: '',
  type: 'all',
  category: 'all',
  startDate: '',
  endDate: '',
}

const useTransactionStore = create((set) => ({
  filters: initialFilters,
  categories: defaultCategories,
  isLoading: false,
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: initialFilters }),
  addCategory: (categoryName) =>
    set((state) => {
      const normalized = categoryName.trim()
      if (!normalized || state.categories.includes(normalized)) {
        return state
      }
      return { categories: [...state.categories, normalized] }
    }),
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
