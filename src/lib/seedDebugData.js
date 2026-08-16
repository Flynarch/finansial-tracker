import { format, subMonths, subDays, addDays } from 'date-fns'
import { db } from './db'

/**
 * High-volume stress test & demo data generator.
 * Seeds 500+ realistic Indonesian transactions (strictly up to today, never in the future),
 * 8 wallets, 10 budgets, 8 savings goals, 8 loans with payment history,
 * 6 habits with 90-day logs, and 5 investment assets.
 */
export async function seedMassiveStressTestData({ defaultCurrency = 'IDR' } = {}) {
  const now = new Date()
  const todayDate = now.getDate()
  const todayHour = now.getHours()
  const todayMinute = now.getMinutes()
  const todayStr = format(now, 'yyyy-MM-dd')
  const currentMonthKey = format(now, 'yyyy-MM')

  const createdCount = {
    wallets: 0,
    transactions: 0,
    budgets: 0,
    goals: 0,
    habits: 0,
    habitLogs: 0,
    todos: 0,
    loans: 0,
    loanPayments: 0,
    investments: 0,
  }

  // 0. Remove any accidental future transactions from previous mock runs
  const futureTxs = await db.transactions.where('date').above(todayStr).toArray()
  if (futureTxs.length > 0) {
    const futureIds = futureTxs.map((t) => t.id).filter(Boolean)
    if (futureIds.length > 0) {
      await db.transactions.bulkDelete(futureIds)
    }
  }

  // 1. Seed 8 Wallets / Accounts
  const walletDefs = [
    { name: 'Bank BCA', walletType: 'bank', balance: 45850000, currency: defaultCurrency, isArchived: false },
    { name: 'Bank Mandiri', walletType: 'bank', balance: 32400000, currency: defaultCurrency, isArchived: false },
    { name: 'Bank Jago', walletType: 'bank', balance: 8750000, currency: defaultCurrency, isArchived: false },
    { name: 'Dompet Tunai', walletType: 'cash', balance: 1500000, currency: defaultCurrency, isArchived: false },
    { name: 'GoPay', walletType: 'e-wallet', balance: 650000, currency: defaultCurrency, isArchived: false },
    { name: 'OVO', walletType: 'e-wallet', balance: 420000, currency: defaultCurrency, isArchived: false },
    { name: 'Rekening USD', walletType: 'bank', balance: 2500, currency: 'USD', isArchived: false },
    { name: 'Bibit Reksadana', walletType: 'investment', balance: 25000000, currency: defaultCurrency, isArchived: false },
  ]

  const walletIds = []
  for (const w of walletDefs) {
    const existing = await db.wallets.where('name').equals(w.name).first()
    if (existing) {
      walletIds.push(existing.id)
    } else {
      const id = await db.wallets.add({ ...w, createdAt: Date.now() })
      walletIds.push(id)
      createdCount.wallets++
    }
  }

  const [bcaId, mandiriId, jagoId, cashId, gopayId, ovoId] = walletIds

  // 2. Generate 12 Months of Rich Indonesian Transactions strictly up to TODAY
  const expenseTemplates = [
    { category: 'makanan/makan_siang', notes: 'Makan Siang Kantor', min: 25000, max: 65000, wallet: cashId },
    { category: 'makanan/kopi', notes: 'Kopi Kenangan / Janji Jiwa', min: 18000, max: 42000, wallet: gopayId },
    { category: 'makanan/makan_malam', notes: 'Makan Malam Kuliner', min: 45000, max: 150000, wallet: ovoId },
    { category: 'makanan/jajan', notes: 'Camilan Minimarket', min: 15000, max: 35000, wallet: cashId },
    { category: 'kebutuhan_harian/belanja_bulanan', notes: 'Belanja Supermarket Bulanan', min: 450000, max: 1200000, wallet: bcaId },
    { category: 'transportasi/bensin', notes: 'Bensin Pertamax Full Tank', min: 100000, max: 250000, wallet: mandiriId },
    { category: 'transportasi/ojol', notes: 'Gojek / Grab ke Stasiun', min: 14000, max: 35000, wallet: gopayId },
    { category: 'transportasi/parkir', notes: 'Parkir Mall & Kantor', min: 5000, max: 20000, wallet: cashId },
    { category: 'transportasi/tol', notes: 'Topup e-Toll', min: 100000, max: 200000, wallet: mandiriId },
    { category: 'tagihan/listrik', notes: 'Token Listrik PLN', min: 350000, max: 600000, wallet: bcaId },
    { category: 'tagihan/internet', notes: 'IndiHome Fiber 50Mbps', min: 380000, max: 450000, wallet: bcaId },
    { category: 'tagihan/air', notes: 'Tagihan PDAM', min: 85000, max: 150000, wallet: mandiriId },
    { category: 'tagihan/paket_data', notes: 'Paket Data Telkomsel 50GB', min: 120000, max: 180000, wallet: gopayId },
    { category: 'tagihan/langganan', notes: 'Langganan Netflix & Spotify Premium', min: 186000, max: 186000, wallet: jagoId },
    { category: 'kultur/bioskop', notes: 'Nonton XXI Cinema', min: 90000, max: 200000, wallet: ovoId },
    { category: 'kesehatan/obat', notes: 'Apotek K-24 Vitamin & Suplemen', min: 65000, max: 180000, wallet: cashId },
    { category: 'kesehatan/gym', notes: 'Iuran Gym Bulanan', min: 350000, max: 500000, wallet: bcaId },
    { category: 'pakaian/baju', notes: 'Beli Kaos & Celana Uniqlo', min: 299000, max: 799000, wallet: bcaId },
    { category: 'kecantikan/skincare', notes: 'Skincare & Perawatan Diri', min: 150000, max: 450000, wallet: ovoId },
    { category: 'kehidupan_sosial/amal_donasi', notes: 'Infaq & Zakat Sedekah', min: 50000, max: 250000, wallet: cashId },
    { category: 'kehidupan_sosial/kumpul_teman', notes: 'Nongkrong Bareng Teman', min: 75000, max: 220000, wallet: gopayId },
  ]

  const transactionsToInsert = []

  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    const monthDate = subMonths(now, monthOffset)
    const yMonth = format(monthDate, 'yyyy-MM')
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const maxDay = (monthOffset === 0) ? todayDate : daysInMonth

    // 1. Income entries per month (strictly capped to maxDay)
    if (maxDay >= 1) {
      const txDate = `${yMonth}-01`
      const txTime = '09:00'
      const txCreatedAt = new Date(`${txDate}T${txTime}:00`).getTime()
      transactionsToInsert.push({
        type: 'income',
        category: 'gaji/gaji_pokok',
        amount: 16500000,
        currency: defaultCurrency,
        date: txDate,
        time: txTime,
        notes: 'Gaji Bulanan PT Maju Bersama',
        walletId: bcaId,
        createdAt: txCreatedAt,
      })
    }

    if (maxDay >= 15 && monthOffset % 2 === 0) {
      const txDate = `${yMonth}-15`
      const txTime = '14:30'
      const txCreatedAt = new Date(`${txDate}T${txTime}:00`).getTime()
      transactionsToInsert.push({
        type: 'income',
        category: 'bisnis/freelance',
        amount: 4250000,
        currency: defaultCurrency,
        date: txDate,
        time: txTime,
        notes: 'Honor Desain UI/UX & Konsultasi Web',
        walletId: mandiriId,
        createdAt: txCreatedAt,
      })
    }

    if (maxDay >= 20 && monthOffset % 3 === 0) {
      const txDate = `${yMonth}-20`
      const txTime = '11:00'
      const txCreatedAt = new Date(`${txDate}T${txTime}:00`).getTime()
      transactionsToInsert.push({
        type: 'income',
        category: 'investasi/dividen',
        amount: 1850000,
        currency: defaultCurrency,
        date: txDate,
        time: txTime,
        notes: 'Dividen Saham BBCA & Reksadana',
        walletId: bcaId,
        createdAt: txCreatedAt,
      })
    }

    // 2. Generate realistic expense transactions scattered throughout past days up to maxDay
    for (let day = 1; day <= maxDay; day++) {
      const isToday = (monthOffset === 0 && day === todayDate)
      const expensesCount = isToday ? 1 : (day % 3 === 0) ? 2 : (day % 5 === 0) ? 3 : 1

      for (let i = 0; i < expensesCount; i++) {
        const templateIdx = (day * 7 + i * 11 + monthOffset * 3) % expenseTemplates.length
        const tmpl = expenseTemplates[templateIdx]
        const range = tmpl.max - tmpl.min
        const amt = Math.round((tmpl.min + (Math.sin(day * 13 + i * 17) * 0.5 + 0.5) * range) / 1000) * 1000

        let hourNum = 8 + ((day * 3 + i * 4) % 14)
        let minuteNum = (day * 17 + i * 23) % 60

        // If today, ensure hour/minute does not exceed current local time
        if (isToday) {
          hourNum = Math.max(7, Math.min(todayHour, hourNum))
          if (hourNum === todayHour) {
            minuteNum = Math.max(0, Math.min(todayMinute - 5, minuteNum))
          }
        }

        const hour = String(hourNum).padStart(2, '0')
        const minute = String(minuteNum).padStart(2, '0')
        const dayStr = String(day).padStart(2, '0')
        const txDate = `${yMonth}-${dayStr}`
        const txTime = `${hour}:${minute}`
        const txCreatedAt = new Date(`${txDate}T${txTime}:00`).getTime()

        transactionsToInsert.push({
          type: 'expense',
          category: tmpl.category,
          amount: Math.max(tmpl.min, amt),
          currency: defaultCurrency,
          date: txDate,
          time: txTime,
          notes: tmpl.notes,
          walletId: tmpl.wallet || bcaId,
          createdAt: txCreatedAt,
        })
      }
    }
  }

  // Batch insert transactions
  for (const tx of transactionsToInsert) {
    await db.transactions.add(tx)
    createdCount.transactions++
  }

  // 3. Budgets (10 comprehensive categories for current month)
  const budgetDefs = [
    { category: 'makanan', categoryPath: 'makanan', limit: 3500000, month: currentMonthKey },
    { category: 'transportasi', categoryPath: 'transportasi', limit: 1800000, month: currentMonthKey },
    { category: 'kebutuhan_harian', categoryPath: 'kebutuhan_harian', limit: 2500000, month: currentMonthKey },
    { category: 'tagihan', categoryPath: 'tagihan', limit: 2000000, month: currentMonthKey },
    { category: 'kultur', categoryPath: 'kultur', limit: 1000000, month: currentMonthKey },
    { category: 'pakaian', categoryPath: 'pakaian', limit: 1500000, month: currentMonthKey },
    { category: 'kesehatan', categoryPath: 'kesehatan', limit: 1200000, month: currentMonthKey },
    { category: 'pendidikan', categoryPath: 'pendidikan', limit: 800000, month: currentMonthKey },
    { category: 'kehidupan_sosial', categoryPath: 'kehidupan_sosial', limit: 1000000, month: currentMonthKey },
    { category: 'kecantikan', categoryPath: 'kecantikan', limit: 800000, month: currentMonthKey },
  ]

  for (const b of budgetDefs) {
    const existing = await db.budgets.where({ category: b.category, month: b.month }).first()
    if (!existing) {
      await db.budgets.add({ ...b, createdAt: Date.now() })
      createdCount.budgets++
    }
  }

  // 4. Savings Goals (8 rich goals with varied progress)
  const goalDefs = [
    {
      name: 'Dana Darurat 6 Bulan',
      target: 60000000,
      targetAmount: 60000000,
      current: 60000000,
      currentAmount: 60000000,
      currency: defaultCurrency,
      deadline: `${currentMonthKey}-01`,
      targetDate: `${currentMonthKey}-01`,
      isArchived: true,
      notes: 'Dana siaga 6x pengeluaran bulanan tersimpan aman',
    },
    {
      name: 'Beli MacBook Pro M3',
      target: 28000000,
      targetAmount: 28000000,
      current: 28000000,
      currentAmount: 28000000,
      currency: defaultCurrency,
      deadline: `${currentMonthKey}-15`,
      targetDate: `${currentMonthKey}-15`,
      isArchived: false,
      notes: 'Laptop kerja baru untuk coding & produktivitas',
    },
    {
      name: 'Liburan Jepang Musim Semi 2027',
      target: 35000000,
      targetAmount: 35000000,
      current: 18500000,
      currentAmount: 18500000,
      currency: defaultCurrency,
      deadline: '2027-04-10',
      targetDate: '2027-04-10',
      isArchived: false,
      notes: 'Tiket pesawat, akomodasi Tokyo & Kyoto, JR Pass',
    },
    {
      name: 'Renovasi Rumah & Kamar',
      target: 50000000,
      targetAmount: 50000000,
      current: 12000000,
      currentAmount: 12000000,
      currency: defaultCurrency,
      deadline: '2027-08-30',
      targetDate: '2027-08-30',
      isArchived: false,
      notes: 'Renovasi dapur dan ruang kerja minimalis',
    },
    {
      name: 'DP Mobil Baru',
      target: 100000000,
      targetAmount: 100000000,
      current: 45000000,
      currentAmount: 45000000,
      currency: defaultCurrency,
      deadline: '2028-01-01',
      targetDate: '2028-01-01',
      isArchived: false,
      notes: 'Down payment mobil keluarga impian',
    },
    {
      name: 'Tabungan Umroh',
      target: 40000000,
      targetAmount: 40000000,
      current: 15000000,
      currentAmount: 15000000,
      currency: defaultCurrency,
      deadline: '2027-11-20',
      targetDate: '2027-11-20',
      isArchived: false,
      notes: 'Paket Umroh 12 hari bersama keluarga',
    },
    {
      name: 'Upgrade iPhone 16 Pro',
      target: 20000000,
      targetAmount: 20000000,
      current: 4000000,
      currentAmount: 4000000,
      currency: defaultCurrency,
      deadline: '2026-12-25',
      targetDate: '2026-12-25',
      isArchived: false,
      notes: 'Ganti HP utama untuk keperluan konten',
    },
    {
      name: 'Tabungan Logam Mulia 50gr',
      target: 65000000,
      targetAmount: 65000000,
      current: 2500000,
      currentAmount: 2500000,
      currency: defaultCurrency,
      deadline: '2028-06-30',
      targetDate: '2028-06-30',
      isArchived: false,
      notes: 'Investasi emas fisik jangka panjang',
    },
  ]

  for (const g of goalDefs) {
    const existing = await db.goals.where('name').equals(g.name).first()
    if (!existing) {
      await db.goals.add({ ...g, createdAt: Date.now() })
      createdCount.goals++
    }
  }

  // 5. Loans & Receivables (8 rich loans with payment history)
  const loanDefs = [
    {
      type: 'debt',
      title: 'Cicilan Motor Honda PCX',
      personName: 'Adira Finance',
      totalAmount: 24000000,
      remainingAmount: 8000000,
      startDate: format(subMonths(now, 16), 'yyyy-MM-dd'),
      dueDate: format(addDays(now, 15), 'yyyy-MM-dd'),
      notes: 'Cicilan ke-16 dari 24 bulan (Rp 1.000.000/bln)',
      walletId: bcaId,
      currency: defaultCurrency,
      payments: [
        { amount: 1000000, date: format(subMonths(now, 1), 'yyyy-MM-10'), notes: 'Cicilan Bulan Lalu' },
        { amount: 1000000, date: format(subMonths(now, 2), 'yyyy-MM-10'), notes: 'Cicilan 2 Bulan Lalu' },
      ],
    },
    {
      type: 'debt',
      title: 'KTA Renovasi Rumah',
      personName: 'Bank BCA KTA',
      totalAmount: 15000000,
      remainingAmount: 5000000,
      startDate: format(subMonths(now, 10), 'yyyy-MM-dd'),
      dueDate: format(addDays(now, 5), 'yyyy-MM-dd'),
      notes: 'Jatuh tempo 5 hari lagi, cicilan Rp 1.000.000/bln',
      walletId: bcaId,
      currency: defaultCurrency,
      payments: [
        { amount: 1000000, date: format(subMonths(now, 1), 'yyyy-MM-05'), notes: 'Cicilan KTA ke-9' },
      ],
    },
    {
      type: 'debt',
      title: 'Pinjam Dana Talangan Budi',
      personName: 'Budi Santoso',
      totalAmount: 2000000,
      remainingAmount: 2000000,
      startDate: format(subDays(now, 12), 'yyyy-MM-dd'),
      dueDate: format(addDays(now, 20), 'yyyy-MM-dd'),
      notes: 'Pinjaman memo tanpa bunga untuk DP proyek',
      walletId: null,
      currency: defaultCurrency,
    },
    {
      type: 'receivable',
      title: 'Piutang Pinjaman Modal Andi',
      personName: 'Andi Pratama',
      totalAmount: 5000000,
      remainingAmount: 2500000,
      startDate: format(subMonths(now, 3), 'yyyy-MM-dd'),
      dueDate: format(addDays(now, 25), 'yyyy-MM-dd'),
      notes: 'Modal usaha distro, dicicil 2x',
      walletId: mandiriId,
      currency: defaultCurrency,
      payments: [
        { amount: 2500000, date: format(subMonths(now, 1), 'yyyy-MM-25'), notes: 'Cicilan pertama dari Andi' },
      ],
    },
    {
      type: 'receivable',
      title: 'Talangan Reimburse Kantor',
      personName: 'Finance Kantor',
      totalAmount: 3500000,
      remainingAmount: 3500000,
      startDate: format(subDays(now, 8), 'yyyy-MM-dd'),
      dueDate: format(addDays(now, 14), 'yyyy-MM-dd'),
      notes: 'Klaim hotel & tiket pesawat dinas luar kota',
      walletId: bcaId,
      currency: defaultCurrency,
    },
    {
      type: 'receivable',
      title: 'Pinjam Uang Rina',
      personName: 'Rina Kusuma',
      totalAmount: 1000000,
      remainingAmount: 0,
      startDate: format(subMonths(now, 2), 'yyyy-MM-dd'),
      dueDate: format(subDays(now, 5), 'yyyy-MM-dd'),
      notes: 'Pinjaman belanja, sudah lunas ditransfer',
      walletId: gopayId,
      currency: defaultCurrency,
      payments: [
        { amount: 1000000, date: format(subDays(now, 5), 'yyyy-MM-dd'), notes: 'Pelunasan dari Rina via GoPay' },
      ],
    },
    {
      type: 'receivable',
      title: 'Piutang Invoice Desain Web',
      personName: 'PT Kreatif Nusantara',
      totalAmount: 8000000,
      remainingAmount: 4000000,
      startDate: format(subMonths(now, 1), 'yyyy-MM-dd'),
      dueDate: format(addDays(now, 10), 'yyyy-MM-dd'),
      notes: 'Termin ke-2 pelunasan website e-commerce',
      walletId: bcaId,
      currency: defaultCurrency,
      payments: [
        { amount: 4000000, date: format(subMonths(now, 1), 'yyyy-MM-15'), notes: 'DP 50% Project Website' },
      ],
    },
    {
      type: 'debt',
      title: 'Cicilan Kamera Sony Alpha',
      personName: 'Toko Kamera Elektronik',
      totalAmount: 4500000,
      remainingAmount: 0,
      startDate: format(subMonths(now, 6), 'yyyy-MM-dd'),
      dueDate: format(subMonths(now, 1), 'yyyy-MM-dd'),
      notes: 'Lunas 6x cicilan 0%',
      walletId: bcaId,
      currency: defaultCurrency,
      payments: [
        { amount: 4500000, date: format(subMonths(now, 1), 'yyyy-MM-01'), notes: 'Pelunasan cicilan kamera terakhir' },
      ],
    },
  ]

  for (const l of loanDefs) {
    const existing = await db.loans.where('title').equals(l.title).first()
    if (!existing) {
      const { payments, ...loanData } = l
      const loanId = await db.loans.add({ ...loanData, createdAt: Date.now() })
      createdCount.loans++

      if (payments && payments.length > 0) {
        for (const p of payments) {
          await db.loanPayments.add({
            loanId,
            amount: p.amount,
            date: p.date,
            notes: p.notes,
            createdAt: Date.now(),
          })
          createdCount.loanPayments++
        }
      }
    }
  }

  // 6. Habits & 90 Days of Logs
  const habitDefs = [
    { title: 'Olahraga Pagi 30 Menit', color: 'emerald', category: 'Kesehatan', frequencyType: 'daily', frequencyValue: 5 },
    { title: 'Baca Buku 20 Halaman', color: 'sky', category: 'Pengembangan Diri', frequencyType: 'daily', frequencyValue: 7 },
    { title: 'Minum Air 2.5 Liter', color: 'cyan', category: 'Kesehatan', frequencyType: 'daily', frequencyValue: 7 },
    { title: 'No Spend Day (Hemat)', color: 'amber', category: 'Keuangan', frequencyType: 'daily', frequencyValue: 3 },
    { title: 'Belajar Coding / AI', color: 'purple', category: 'Pengembangan Diri', frequencyType: 'daily', frequencyValue: 6 },
    { title: 'Tidur Sebelum Jam 23:00', color: 'rose', category: 'Kesehatan', frequencyType: 'daily', frequencyValue: 7 },
  ]

  for (const h of habitDefs) {
    let habit = await db.habits.where('title').equals(h.title).first()
    let habitId = habit?.id
    if (!habit) {
      habitId = await db.habits.add({ ...h, reminderEnabled: false, reminderTime: null, createdAt: Date.now() })
      createdCount.habits++
    }

    for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
      const logDateStr = format(subDays(now, dayOffset), 'yyyy-MM-dd')
      const isCompleted = (dayOffset % 7 !== 0) || (h.frequencyValue === 7 && dayOffset % 11 !== 0)
      if (isCompleted) {
        const existingLog = await db.habitLogs.where({ habitId, date: logDateStr }).first()
        if (!existingLog) {
          await db.habitLogs.add({
            habitId,
            date: logDateStr,
            createdAt: Date.now(),
          })
          createdCount.habitLogs++
        }
      }
    }
  }

  // 7. Investments (5 Assets)
  const investmentDefs = [
    { name: 'Emas Antam Logam Mulia', type: 'Emas', quantity: 25, purchasePrice: 1150000, currentPrice: 1300000, purchaseCurrency: 'IDR' },
    { name: 'Bitcoin (BTC)', type: 'Crypto', quantity: 0.018, purchasePrice: 950000000, currentPrice: 1120000000, purchaseCurrency: 'IDR' },
    { name: 'Ethereum (ETH)', type: 'Crypto', quantity: 0.5, purchasePrice: 42000000, currentPrice: 52000000, purchaseCurrency: 'IDR' },
    { name: 'Bank Central Asia (BBCA)', type: 'Saham', quantity: 20, purchasePrice: 9200, currentPrice: 10100, purchaseCurrency: 'IDR' },
    { name: 'Bank Rakyat Indonesia (BBRI)', type: 'Saham', quantity: 30, purchasePrice: 5100, currentPrice: 5500, purchaseCurrency: 'IDR' },
  ]

  for (const inv of investmentDefs) {
    const existing = await db.investments.where('name').equals(inv.name).first()
    if (!existing) {
      await db.investments.add({
        ...inv,
        date: todayStr,
        createdAt: Date.now(),
      })
      createdCount.investments++
    }
  }

  return createdCount
}

export const seedComprehensiveDebugData = seedMassiveStressTestData
