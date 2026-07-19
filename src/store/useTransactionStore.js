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
    
    // Auto-check budget for new expenses
    if (payload.type === 'expense' && payload.amount > 0 && payload.date) {
      try {
        const txMonth = String(payload.date).substring(0, 7) // "YYYY-MM"
        const txCategory = String(payload.category || '')
        const parentCategory = txCategory.includes('/') ? txCategory.split('/')[0] : txCategory
        
        const budgets = await db.budgets.where({ month: txMonth }).toArray()
        const matchingBudgets = budgets.filter(b => b.category === txCategory || b.category === parentCategory)
        
        if (matchingBudgets.length > 0) {
          const monthTxs = await db.transactions.filter(t => typeof t.date === 'string' && t.date.startsWith(txMonth) && t.type === 'expense').toArray()
          
          for (const b of matchingBudgets) {
            let spent = 0
            for (const t of monthTxs) {
              const tCat = String(t.category || '')
              const tParent = tCat.includes('/') ? tCat.split('/')[0] : tCat
              if (b.category === tCat || b.category === tParent) {
                spent += Number(t.amount || 0)
              }
            }
            
            const limit = Number(b.limit || 0)
            if (limit > 0) {
              const pct = (spent / limit) * 100
              if (pct >= 80) {
                 const isDanger = pct >= 100
                 const title = isDanger ? 'Budget Jebol!' : 'Peringatan Budget'
                 const message = isDanger 
                   ? `Pengeluaran kategori ${b.category} melebihi batas anggaran (${Math.round(pct)}%).`
                   : `Pengeluaran kategori ${b.category} hampir habis (${Math.round(pct)}%).`
                 
                 const recentNotifs = await db.notifications
                    .orderBy('createdAt')
                    .reverse()
                    .limit(10)
                    .toArray()
                 
                 const alreadyNotified = recentNotifs.some(n => n.title === title && n.message === message && (Date.now() - n.createdAt < 24 * 3600 * 1000))
                 
                 if (!alreadyNotified) {
                   await db.notifications.add({
                     title,
                     message,
                     type: isDanger ? 'alert' : 'warning',
                     isRead: 0,
                     createdAt: Date.now()
                   })
                 }
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to check budget:', e)
      }
    }
  },
  updateTransaction: async (id, payload) => {
    await db.transactions.update(id, payload)
  },
  deleteTransaction: async (id) => {
    await db.transactions.delete(id)
  },
}))

export default useTransactionStore
