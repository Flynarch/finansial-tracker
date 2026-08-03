import { format } from 'date-fns'
import { db } from './db'

export async function seedComprehensiveDebugData({ wallets = [], defaultCurrency = 'IDR' } = {}) {
  const currentMonthKey = format(new Date(), 'yyyy-MM')
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const defaultWalletId = wallets.length > 0 ? wallets[0].id : null

  let createdCount = {
    transactions: 0,
    budgets: 0,
    goals: 0,
    habits: 0,
    todos: 0,
    loans: 0,
  }

  // 1. Transactions Data
  const sampleTransactions = [
    {
      id: `seed_tx_${Date.now()}_1`,
      type: 'income',
      category: 'gaji/gaji_pokok',
      amount: 12500000,
      currency: defaultCurrency,
      date: `${currentMonthKey}-01`,
      time: '09:00',
      notes: 'Gaji Bulanan Utama',
      walletId: defaultWalletId,
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: `seed_tx_${Date.now()}_2`,
      type: 'expense',
      category: 'makanan_minuman/belanja_bulanan',
      amount: 850000,
      currency: defaultCurrency,
      date: `${currentMonthKey}-02`,
      time: '14:30',
      notes: 'Belanja Bulanan Supermarket',
      walletId: defaultWalletId,
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: `seed_tx_${Date.now()}_3`,
      type: 'expense',
      category: 'transportasi_dan_bensin/bensin',
      amount: 150000,
      currency: defaultCurrency,
      date: `${currentMonthKey}-03`,
      time: '17:15',
      notes: 'Bensin Pertamax Full Tank',
      walletId: defaultWalletId,
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: `seed_tx_${Date.now()}_4`,
      type: 'expense',
      category: 'makanan_minuman/restoran',
      amount: 175000,
      currency: defaultCurrency,
      date: `${currentMonthKey}-05`,
      time: '19:45',
      notes: 'Makan Malam Restoran Keluarga',
      walletId: defaultWalletId,
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: `seed_tx_${Date.now()}_5`,
      type: 'expense',
      category: 'tagihan_dan_utilitas/listrik',
      amount: 450000,
      currency: defaultCurrency,
      date: `${currentMonthKey}-07`,
      time: '10:00',
      notes: 'Tagihan Listrik & WiFi IndiHome',
      walletId: defaultWalletId,
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: `seed_tx_${Date.now()}_6`,
      type: 'expense',
      category: 'makanan_minuman/kafe',
      amount: 45000,
      currency: defaultCurrency,
      date: todayStr,
      time: '11:20',
      notes: 'Kopi Espresso & Pastry',
      walletId: defaultWalletId,
      createdAt: Date.now(),
    },
  ]

  for (const tx of sampleTransactions) {
    await db.transactions.put(tx)
    createdCount.transactions++
  }

  // 2. Budgets Data
  const sampleBudgets = [
    {
      id: `seed_bg_${currentMonthKey}_makanan`,
      category: 'makanan_minuman',
      limit: 2500000,
      month: currentMonthKey,
      createdAt: Date.now(),
    },
    {
      id: `seed_bg_${currentMonthKey}_transportasi`,
      category: 'transportasi_dan_bensin',
      limit: 1000000,
      month: currentMonthKey,
      createdAt: Date.now(),
    },
    {
      id: `seed_bg_${currentMonthKey}_tagihan`,
      category: 'tagihan_dan_utilitas',
      limit: 1500000,
      month: currentMonthKey,
      createdAt: Date.now(),
    },
    {
      id: `seed_bg_${currentMonthKey}_belanja`,
      category: 'belanja_dan_gaya_hidup',
      limit: 1200000,
      month: currentMonthKey,
      createdAt: Date.now(),
    },
  ]

  for (const b of sampleBudgets) {
    await db.budgets.put(b)
    createdCount.budgets++
  }

  // 3. Savings Goals Data
  const sampleGoals = [
    {
      id: `seed_goal_1`,
      name: 'Dana Darurat 6 Bulan',
      targetAmount: 15000000,
      currentAmount: 6500000,
      currency: defaultCurrency,
      targetDate: `${new Date().getFullYear()}-12-31`,
      category: 'Darurat',
      createdAt: Date.now(),
    },
    {
      id: `seed_goal_2`,
      name: 'Liburan Akhir Tahun',
      targetAmount: 5000000,
      currentAmount: 2200000,
      currency: defaultCurrency,
      targetDate: `${new Date().getFullYear()}-11-30`,
      category: 'Travel',
      createdAt: Date.now(),
    },
    {
      id: `seed_goal_3`,
      name: 'Upgrade Laptop M3',
      targetAmount: 18000000,
      currentAmount: 9000000,
      currency: defaultCurrency,
      targetDate: `${new Date().getFullYear() + 1}-03-31`,
      category: 'Elektronik',
      createdAt: Date.now(),
    },
  ]

  for (const g of sampleGoals) {
    await db.goals.put(g)
    createdCount.goals++
  }

  // 4. Habits Data
  const sampleHabits = [
    {
      id: `seed_habit_1`,
      title: 'Minum Air Putih 2L',
      category: 'Kesehatan',
      color: 'sky',
      frequencyType: 'daily',
      reminderTime: '08:00',
      createdAt: Date.now(),
    },
    {
      id: `seed_habit_2`,
      title: 'Olahraga / Gym 30 Menit',
      category: 'Kesehatan',
      color: 'emerald',
      frequencyType: 'daily',
      reminderTime: '17:00',
      createdAt: Date.now(),
    },
    {
      id: `seed_habit_3`,
      title: 'Membaca Buku Finansial',
      category: 'Pengembangan Diri',
      color: 'indigo',
      frequencyType: 'daily',
      reminderTime: '21:00',
      createdAt: Date.now(),
    },
  ]

  for (const h of sampleHabits) {
    await db.habits.put(h)
    createdCount.habits++
  }

  // 5. Todos Data
  const sampleTodos = [
    {
      id: `seed_todo_1`,
      title: 'Bayar Kartu Kredit & Tagihan Air',
      description: 'Cek rincian transaksi sebelum jatuh tempo pertengahan bulan.',
      category: 'tagihan',
      priority: 'high',
      dueDate: todayStr,
      reminderTime: '15:00',
      completed: 0,
      subTasks: ['Cek tagihan di m-Banking', 'Bayar via transfer', 'Simpan bukti bayar'],
      createdAt: Date.now(),
    },
    {
      id: `seed_todo_2`,
      title: 'Evaluasi Alokasi Gaji & Investasi',
      description: 'Review portofolio reksadana dan tabungan bulanan.',
      category: 'investasi',
      priority: 'medium',
      dueDate: todayStr,
      completed: 0,
      subTasks: ['Review saldo', 'Topup dana darurat'],
      createdAt: Date.now(),
    },
  ]

  for (const t of sampleTodos) {
    await db.todos.put(t)
    createdCount.todos++
  }

  // 6. Utang & Piutang Data (Loans)
  const sampleLoans = [
    {
      id: `seed_loan_1`,
      type: 'receivable',
      title: 'Piutang Pinjaman Budi',
      personName: 'Budi Santoso',
      totalAmount: 1500000,
      paidAmount: 500000,
      status: 'active',
      startDate: `${currentMonthKey}-01`,
      dueDate: `${currentMonthKey}-28`,
      notes: 'Pinjaman untuk modal usaha',
      walletId: defaultWalletId,
      createdAt: Date.now(),
    },
    {
      id: `seed_loan_2`,
      type: 'debt',
      title: 'Cicilan Pembelian Elektronik',
      personName: 'Toko Kencana',
      totalAmount: 3000000,
      paidAmount: 1000000,
      status: 'active',
      startDate: `${currentMonthKey}-02`,
      dueDate: `${currentMonthKey}-25`,
      notes: 'Cicilan 3 bulan tanpa bunga',
      walletId: defaultWalletId,
      createdAt: Date.now(),
    },
  ]

  for (const l of sampleLoans) {
    await db.loans.put(l)
    createdCount.loans++
  }

  return createdCount
}
