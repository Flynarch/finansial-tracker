import { create } from 'zustand'

const useBudgetStore = create((set) => ({
  budgets: [],
  goals: [],
  setBudgets: (budgets) => set({ budgets }),
  setGoals: (goals) => set({ goals }),
}))

export default useBudgetStore
