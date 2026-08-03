import { format, subMonths } from 'date-fns'
import { db } from './db'

export async function seedComprehensiveDebugData({ wallets = [], defaultCurrency = 'IDR' } = {}) {
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const currentMonthKey = format(now, 'yyyy-MM')

  let createdCount = {
    transactions: 0,
    budgets: 0,
    goals: 0,
    habits: 0,
    todos: 0,
    loans: 0,
  }

  // 0. Ensure sample wallets exist
  let activeWallets = [...wallets]
  if (activeWallets.length === 0) {
    try {
      const existingInDb = await db.wallets.toArray()
      if (existingInDb.length > 0) {
        activeWallets = existingInDb
      } else {
        const w1 = await db.wallets.add({
          name: 'Bank BCA',
          walletType: 'bank',
          balance: 15500000,
          currency: defaultCurrency,
          createdAt: Date.now(),
        })
        const w2 = await db.wallets.add({
          name: 'Dompet Cash',
          walletType: 'cash',
          balance: 1200000,
          currency: defaultCurrency,
          createdAt: Date.now(),
        })
        const w3 = await db.wallets.add({
          name: 'GoPay',
          walletType: 'e-wallet',
          balance: 850000,
          currency: defaultCurrency,
          createdAt: Date.now(),
        })
        activeWallets = [
          { id: w1, name: 'Bank BCA' },
          { id: w2, name: 'Dompet Cash' },
          { id: w3, name: 'GoPay' },
        ]
      }
    } catch {
      // Fallback
    }
  }

  const bcaId = activeWallets[0]?.id || null
  const cashId = activeWallets[1]?.id || bcaId
  const gopayId = activeWallets[2]?.id || bcaId

  // 1. Generate 4 Months of Realistic Transactions (Current month M, M-1, M-2, M-3)
  const monthOffsets = [3, 2, 1, 0] // 3 months ago to current month

  for (const offset of monthOffsets) {
    const targetDateObj = subMonths(now, offset)
    const yearMonth = format(targetDateObj, 'yyyy-MM')

    const monthTransactions = [
      // Income 1: Main Salary
      {
        type: 'income',
        category: 'gaji/gaji_pokok',
        amount: 12500000,
        currency: defaultCurrency,
        date: `${yearMonth}-01`,
        time: '09:00',
        notes: 'Gaji Bulanan Utama',
        walletId: bcaId,
      },
      // Income 2: Side Freelance
      {
        type: 'income',
        category: 'bisnis/freelance',
        amount: offset === 1 ? 4500000 : 2500000, // Extra in M-1
        currency: defaultCurrency,
        date: `${yearMonth}-15`,
        time: '14:00',
        notes: 'Proyek Freelance UI/UX',
        walletId: gopayId,
      },
      // Expense 1: Groceries
      {
        type: 'expense',
        category: 'kebutuhan_harian/belanja_bulanan',
        amount: 1150000,
        currency: defaultCurrency,
        date: `${yearMonth}-02`,
        time: '11:30',
        notes: 'Belanja Bulanan Supermarket',
        walletId: bcaId,
      },
      // Expense 2: Fuel
      {
        type: 'expense',
        category: 'transportasi/bensin',
        amount: 150000,
        currency: defaultCurrency,
        date: `${yearMonth}-04`,
        time: '17:10',
        notes: 'Bensin Pertamax Full Tank',
        walletId: cashId,
      },
      // Expense 3: Dinner Out
      {
        type: 'expense',
        category: 'makanan/makan_malam',
        amount: 235000,
        currency: defaultCurrency,
        date: `${yearMonth}-06`,
        time: '19:45',
        notes: 'Makan Malam Restoran',
        walletId: gopayId,
      },
      // Expense 4: Electricity Bill
      {
        type: 'expense',
        category: 'tagihan/listrik',
        amount: 450000,
        currency: defaultCurrency,
        date: `${yearMonth}-08`,
        time: '10:00',
        notes: 'Token Listrik PLN',
        walletId: bcaId,
      },
      // Expense 5: WiFi Internet
      {
        type: 'expense',
        category: 'tagihan/internet',
        amount: 380000,
        currency: defaultCurrency,
        date: `${yearMonth}-09`,
        time: '10:15',
        notes: 'Tagihan IndiHome WiFi 50Mbps',
        walletId: bcaId,
      },
      // Expense 6: Coffee & Snacks
      {
        type: 'expense',
        category: 'makanan/kopi',
        amount: 48000,
        currency: defaultCurrency,
        date: `${yearMonth}-11`,
        time: '15:20',
        notes: 'Es Kopi Susu & Croissant',
        walletId: gopayId,
      },
      // Expense 7: Lunch
      {
        type: 'expense',
        category: 'makanan/makan_siang',
        amount: 35000,
        currency: defaultCurrency,
        date: `${yearMonth}-13`,
        time: '12:30',
        notes: 'Makan Siang Nasi Padang',
        walletId: cashId,
      },
      // Expense 8: Subscriptions
      {
        type: 'expense',
        category: 'tagihan/langganan',
        amount: 186000,
        currency: defaultCurrency,
        date: `${yearMonth}-16`,
        time: '08:00',
        notes: 'Langganan Netflix Premium & Spotify',
        walletId: bcaId,
      },
      // Expense 9: Second Fuel
      {
        type: 'expense',
        category: 'transportasi/bensin',
        amount: 150000,
        currency: defaultCurrency,
        date: `${yearMonth}-18`,
        time: '18:00',
        notes: 'Bensin Pertamax',
        walletId: cashId,
      },
      // Expense 10: Cinema / Entertainment
      {
        type: 'expense',
        category: 'hiburan/nonton',
        amount: 130000,
        currency: defaultCurrency,
        date: `${yearMonth}-21`,
        time: '20:15',
        notes: 'Tiket Bioskop XXI & Popcorn',
        walletId: gopayId,
      },
      // Expense 11: Medicine / Health
      {
        type: 'expense',
        category: 'kesehatan/obat',
        amount: 95000,
        currency: defaultCurrency,
        date: `${yearMonth}-24`,
        time: '16:00',
        notes: 'Vitamin C & Obat Apotek',
        walletId: cashId,
      },
      // Expense 12: Clothing / Fashion
      {
        type: 'expense',
        category: 'belanja/pakaian',
        amount: 480000,
        currency: defaultCurrency,
        date: `${yearMonth}-26`,
        time: '15:30',
        notes: 'Baju Kerja Kemeja Uniqlo',
        walletId: bcaId,
      },
    ]

    // Special bonus in month -1
    if (offset === 1) {
      monthTransactions.push({
        type: 'income',
        category: 'bonus/thr',
        amount: 6000000,
        currency: defaultCurrency,
        date: `${yearMonth}-10`,
        time: '10:00',
        notes: 'Bonus Performa Kinerja',
        walletId: bcaId,
      })
    }

    for (let i = 0; i < monthTransactions.length; i++) {
      const tx = monthTransactions[i]
      const txId = `seed_tx_${yearMonth}_${i + 1}`
      await db.transactions.put({
        ...tx,
        id: txId,
        createdAt: Date.now() - offset * 30 * 86400000 + i * 1000,
      })
      createdCount.transactions++
    }
  }

  // 2. Budgets Data (Current & Previous Months)
  const sampleBudgets = [
    { id: `seed_bg_${currentMonthKey}_makanan`, category: 'makanan', limit: 3000000, month: currentMonthKey, createdAt: Date.now() },
    { id: `seed_bg_${currentMonthKey}_transportasi`, category: 'transportasi', limit: 1200000, month: currentMonthKey, createdAt: Date.now() },
    { id: `seed_bg_${currentMonthKey}_tagihan`, category: 'tagihan', limit: 1800000, month: currentMonthKey, createdAt: Date.now() },
    { id: `seed_bg_${currentMonthKey}_kebutuhan_harian`, category: 'kebutuhan_harian', limit: 2000000, month: currentMonthKey, createdAt: Date.now() },
    { id: `seed_bg_${currentMonthKey}_belanja`, category: 'belanja', limit: 1500000, month: currentMonthKey, createdAt: Date.now() },
  ]

  for (const b of sampleBudgets) {
    await db.budgets.put(b)
    createdCount.budgets++
  }

  // 3. Savings Goals Data
  const sampleGoals = [
    {
      id: 'seed_goal_1',
      name: 'Dana Darurat 6 Bulan',
      targetAmount: 15000000,
      currentAmount: 9500000,
      currency: defaultCurrency,
      targetDate: `${now.getFullYear()}-12-31`,
      category: 'Darurat',
      createdAt: Date.now(),
    },
    {
      id: 'seed_goal_2',
      name: 'Liburan Akhir Tahun',
      targetAmount: 5000000,
      currentAmount: 2800000,
      currency: defaultCurrency,
      targetDate: `${now.getFullYear()}-11-30`,
      category: 'Travel',
      createdAt: Date.now(),
    },
    {
      id: 'seed_goal_3',
      name: 'Upgrade Laptop M3',
      targetAmount: 18000000,
      currentAmount: 11000000,
      currency: defaultCurrency,
      targetDate: `${now.getFullYear() + 1}-03-31`,
      category: 'Elektronik',
      createdAt: Date.now(),
    },
  ]

  for (const g of sampleGoals) {
    await db.goals.put(g)
    createdCount.goals++
  }

  // 4. Habits & Habit Logs Data
  const sampleHabits = [
    {
      id: 'seed_habit_1',
      title: 'Minum Air Putih 2L',
      category: 'Kesehatan',
      color: 'sky',
      frequencyType: 'daily',
      reminderTime: '08:00',
      createdAt: Date.now(),
    },
    {
      id: 'seed_habit_2',
      title: 'Olahraga / Gym 30 Menit',
      category: 'Kesehatan',
      color: 'emerald',
      frequencyType: 'daily',
      reminderTime: '17:00',
      createdAt: Date.now(),
    },
    {
      id: 'seed_habit_3',
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

  // Add recent habit log entries for active streak
  try {
    for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
      const logDateStr = format(new Date(Date.now() - dayOffset * 86400000), 'yyyy-MM-dd')
      await db.habitLogs.put({ id: `seed_hlog_1_${logDateStr}`, habitId: 'seed_habit_1', date: logDateStr })
      if (dayOffset % 2 === 0) {
        await db.habitLogs.put({ id: `seed_hlog_2_${logDateStr}`, habitId: 'seed_habit_2', date: logDateStr })
      }
    }
  } catch {
    // Ignore log errors
  }

  // 5. Todos Data
  const sampleTodos = [
    {
      id: 'seed_todo_1',
      title: 'Bayar Kartu Kredit & Tagihan Air',
      description: 'Cek rincian transaksi sebelum jatuh tempo pertengahan bulan.',
      category: 'tagihan',
      priority: 'high',
      dueDate: todayStr,
      reminderTime: '15:00',
      completed: 0,
      subTasks: ['Cek tagihan di m-Banking', 'Bayar via transfer BCA', 'Simpan bukti bayar'],
      createdAt: Date.now(),
    },
    {
      id: 'seed_todo_2',
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
      id: 'seed_loan_1',
      type: 'receivable',
      title: 'Piutang Pinjaman Budi',
      personName: 'Budi Santoso',
      totalAmount: 2000000,
      paidAmount: 1000000,
      status: 'active',
      startDate: `${currentMonthKey}-01`,
      dueDate: `${currentMonthKey}-28`,
      notes: 'Pinjaman untuk modal usaha',
      walletId: bcaId,
      createdAt: Date.now(),
    },
    {
      id: 'seed_loan_2',
      type: 'debt',
      title: 'Cicilan Pembelian Toko Kencana',
      personName: 'Toko Kencana',
      totalAmount: 3600000,
      paidAmount: 1200000,
      status: 'active',
      startDate: `${currentMonthKey}-02`,
      dueDate: `${currentMonthKey}-25`,
      notes: 'Cicilan 3 bulan tanpa bunga',
      walletId: bcaId,
      createdAt: Date.now(),
    },
  ]

  for (const l of sampleLoans) {
    await db.loans.put(l)
    createdCount.loans++
  }

  return createdCount
}
