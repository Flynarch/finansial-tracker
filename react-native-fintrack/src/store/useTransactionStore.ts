import { create } from 'zustand';
import { TransactionEntity, TransactionRepository } from '../db/repositories/transactionRepository';

interface TransactionState {
  transactions: TransactionEntity[];
  monthIncome: number;
  monthExpense: number;
  isLoading: boolean;

  loadTransactions: () => Promise<void>;
  addTransaction: (tx: Omit<TransactionEntity, 'created_at' | 'updated_at'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  monthIncome: 0,
  monthExpense: 0,
  isLoading: false,

  loadTransactions: async () => {
    set({ isLoading: true });
    try {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const allTx = await TransactionRepository.getAll(200);
      const monthlyTx = allTx.filter((tx) => tx.date.startsWith(currentYearMonth));

      let income = 0;
      let expense = 0;

      monthlyTx.forEach((tx) => {
        if (tx.is_exclude_analytics) return;
        if (tx.type === 'income') income += Number(tx.amount);
        if (tx.type === 'expense') expense += Number(tx.amount);
      });

      set({
        transactions: allTx,
        monthIncome: income,
        monthExpense: expense,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  addTransaction: async (tx) => {
    await TransactionRepository.insert(tx);
    await get().loadTransactions();
  },

  deleteTransaction: async (id) => {
    await TransactionRepository.delete(id);
    await get().loadTransactions();
  },
}));
