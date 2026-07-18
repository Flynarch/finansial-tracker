import { create } from 'zustand'
import { db } from '../lib/db'

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
  transactions: [],
  categories: defaultCategories,
  filters: initialFilters,
  isLoading: false,
  setTransactions: (transactions) => set({ transactions }),
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
  loadTransactions: async () => {
    set({ isLoading: true })
    try {
      const transactions = await db.transactions.orderBy('date').reverse().toArray()
      set({ transactions, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
  addTransaction: async (payload) => {
    await db.transactions.add({
      ...payload,
      createdAt: Number.isFinite(Number(payload?.createdAt)) ? Number(payload.createdAt) : Date.now(),
    })
  },
  updateTransaction: async (id, payload) => {
    await db.transactions.update(id, payload)
  },
  deleteTransaction: async (id) => {
    await db.transactions.delete(id)
  },
}))

export default useTransactionStore
