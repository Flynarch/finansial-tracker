import { create } from 'zustand';
import { WalletEntity, WalletRepository } from '../db/repositories/walletRepository';

interface WalletState {
  wallets: WalletEntity[];
  isLoading: boolean;
  rates: Record<string, number>;
  defaultWalletId: string | null;

  loadWallets: () => Promise<void>;
  addWallet: (wallet: Omit<WalletEntity, 'created_at' | 'updated_at'>) => Promise<void>;
  updateBalance: (id: string, newBalance: number) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
  getTotalBalance: (defaultCurrency: string) => number;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: [],
  isLoading: false,
  rates: {
    IDR: 1,
    USD: 16200,
    EUR: 17500,
    SGD: 12100,
    MYR: 3550,
    JPY: 108,
    GBP: 20500,
  },
  defaultWalletId: null,

  loadWallets: async () => {
    set({ isLoading: true });
    try {
      const wallets = await WalletRepository.getAll();
      set({ wallets, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addWallet: async (wallet) => {
    await WalletRepository.insert(wallet);
    await get().loadWallets();
  },

  updateBalance: async (id, newBalance) => {
    await WalletRepository.updateBalance(id, newBalance);
    await get().loadWallets();
  },

  deleteWallet: async (id) => {
    await WalletRepository.delete(id);
    await get().loadWallets();
  },

  getTotalBalance: (defaultCurrency) => {
    const { wallets, rates } = get();
    return wallets.reduce((sum, w) => {
      const rateFrom = rates[w.currency] || 1;
      const rateTo = rates[defaultCurrency] || 1;
      const converted = (Number(w.balance) * rateFrom) / rateTo;
      return sum + converted;
    }, 0);
  },
}));
