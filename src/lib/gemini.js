import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'
import { queryTransactions, getMonthSummaryForPrompt } from './aiDatabaseQueries'
import { sanitizeCategoryPath } from './categorySanitizer'
import { db } from './db'
import useSettingsStore from '../store/useSettingsStore'

function getEffectiveApiKey() {
  try {
    const userKey = useSettingsStore.getState().geminiApiKey
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim()
    }
  } catch {
    // ignore
  }
  return import.meta.env.VITE_GEMINI_API_KEY || ''
}

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro'
]

export function buildCategoryContext(locale) {
  const expenseTree = getMergedExpenseTree()
  const incomeTree = getMergedIncomeTree()
  let context = 'KATEGORI PENGELUARAN (PENTING: Selalu gunakan format parentId/childId sebagai ID Kategori!):\n'
  expenseTree.forEach(p => {
    const pName = locale==='en'?(p.names?.en||p.names?.id):p.names?.id
    const childrenStr = (p.children || []).map(s => `${p.id}/${s.id}`).join(', ')
    context += `- ${pName}: ${childrenStr}\n`
  })
  context += '\nKATEGORI PEMASUKAN (Format: parentId/childId):\n'
  incomeTree.forEach(i => {
    const iName = locale==='en'?(i.names?.en||i.names?.id):i.names?.id
    const childrenStr = (i.children || []).map(s => `${i.id}/${s.id}`).join(', ')
    context += `- ${iName}: ${childrenStr}\n`
  })
  return context
}

const getTools = () => ([
  {
    functionDeclarations: [
      {
        name: "record_transactions",
        description: "Catat satu atau banyak transaksi baru ke database. Panggil ini JIKA user menyebutkan data pemasukan atau pengeluaran baru yang ingin dicatat (misal: 'beli kopi 20rb', 'dapat struk belanja', dll).",
        parameters: {
          type: "OBJECT",
          properties: {
            transactions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING", enum: ["income", "expense", "transfer"] },
                  category: { type: "STRING", description: "ID kategori dari daftar." },
                  amount: { type: "NUMBER" },
                  date: { type: "STRING", description: "YYYY-MM-DD" },
                  notes: { type: "STRING" },
                  merchant: { type: "STRING", description: "Nama toko/merchant jika ada (misal: Indomaret, Alfamart, Starbucks)." },
                  walletId: { type: "NUMBER", description: "ID dompet (wallet) yang digunakan." },
                  targetWalletId: { type: "NUMBER", description: "ID dompet tujuan JIKA type='transfer'." }
                },
                required: ["type", "category", "amount", "date", "notes"]
              }
            },
            merchantName: { type: "STRING", description: "Nama toko/merchant utama yang tertera pada struk." },
            replyMessage: { type: "STRING", description: "Pesan sukses ramah." },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!" }
          },
          required: ["transactions"]
        }
      },
      {
        name: "update_transaction",
        description: "Ubah transaksi masa lalu. Panggil ini JIKA user minta mengubah data (misal: 'ubah transaksi kopi tadi jadi 30rb').",
        parameters: {
          type: "OBJECT",
          properties: {
            searchQuery: { type: "STRING", description: "Kata kunci untuk mencari transaksi yang dimaksud (misal: 'kopi')." },
            updatedFields: {
              type: "OBJECT",
              properties: {
                amount: { type: "NUMBER" },
                category: { type: "STRING" },
                notes: { type: "STRING" },
                date: { type: "STRING" }
              }
            },
            replyMessage: { type: "STRING" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!" }
          },
          required: ["searchQuery", "updatedFields"]
        }
      },
      {
        name: "delete_transaction",
        description: "Hapus transaksi masa lalu. Panggil ini JIKA user minta menghapus data (misal: 'hapus transaksi makan siang kemarin').",
        parameters: {
          type: "OBJECT",
          properties: {
            searchQuery: { type: "STRING", description: "Kata kunci transaksi (misal: 'makan siang')." },
            date: { type: "STRING", description: "Tanggal transaksi jika disebutkan (YYYY-MM-DD)." },
            replyMessage: { type: "STRING" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!" }
          },
          required: ["searchQuery"]
        }
      },
      {
        name: "query_database",
        description: "Hitung, cari, atau ringkas data transaksi masa lalu. Panggil ini JIKA user bertanya (misal: 'Berapa total pengeluaranku bulan ini?', 'Tampilkan chart pengeluaran').",
        parameters: {
          type: "OBJECT",
          properties: {
            startDate: { type: "STRING", description: "YYYY-MM-DD" },
            endDate: { type: "STRING", description: "YYYY-MM-DD" },
            type: { type: "STRING", enum: ["income", "expense"] },
            category: { type: "STRING" },
            renderChart: { type: "BOOLEAN", description: "Set true jika user meminta visualisasi/grafik/chart." }
          }
        }
      },
      {
        name: "manage_habit",
        description: "Kelola (buat/centang) Habit/Kebiasaan pengguna. Jika user minta centang semua habit, gunakan action 'log_all'.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "log", "log_all"], description: "create untuk buat habit, log untuk centang 1 habit, log_all untuk centang SEMUA habit" },
            title: { type: "STRING", description: "Nama habit. Jika log_all, isi dengan 'semua'" },
            color: { type: "STRING", description: "Warna habit (misal: 'red', 'blue', 'indigo')" },
            frequencyType: { type: "STRING", enum: ["daily", "weekly", "monthly"], description: "Frekuensi habit" },
            reminderTime: { type: "STRING", description: "Waktu pengingat (format HH:mm, misal: '08:00')" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!" }
          },
          required: ["action", "title"]
        }
      },
      {
        name: "manage_todo",
        description: "Kelola (buat/selesaikan) To-Do List/Tugas pengguna. Saat membuat tugas baru, SELALU coba isi description, category, subTasks, dan priority agar tugas langsung lengkap dan terstruktur.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "complete"], description: "create untuk buat tugas baru, complete untuk menandai selesai" },
            title: { type: "STRING", description: "Nama tugas (misal: 'Bayar Listrik')" },
            description: { type: "STRING", description: "Deskripsi/catatan detail tugas. Isi dengan konteks tambahan, langkah-langkah, atau catatan penting terkait tugas ini. Boleh multi-baris." },
            category: { type: "STRING", enum: ["tagihan", "investasi", "belanja", "tabungan", "pekerjaan", "pribadi", "kesehatan", "pendidikan", "rumah", "transportasi", "lainnya"], description: "Kategori tugas. Pilih yang paling sesuai: tagihan (Bills), investasi (Investment), belanja (Shopping), tabungan (Savings), pekerjaan (Work), pribadi (Personal), kesehatan (Health), pendidikan (Education), rumah (Household), transportasi (Transport), lainnya (Other)." },
            dueDate: { type: "STRING", description: "Tenggat waktu (YYYY-MM-DD)" },
            reminderTime: { type: "STRING", description: "Waktu pengingat (format HH:mm, misal: '15:30')" },
            priority: { type: "STRING", enum: ["low", "medium", "high"], description: "Prioritas tugas" },
            subTasks: { type: "ARRAY", items: { type: "STRING" }, description: "Daftar sub-tugas/checklist. Pecah tugas besar menjadi langkah-langkah kecil agar mudah dieksekusi. Contoh: ['Cek tagihan', 'Siapkan dana', 'Bayar via app']" },
            replyMessage: { type: "STRING", description: "Pesan balasan meyakinkan." },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          },
          required: ["action", "title"]
        }
      },
      {
        name: "manage_budget",
        description: "Kelola (buat/update) Budget/Anggaran bulanan.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "update"], description: "create/update budget" },
            category: { type: "STRING", description: "Kategori budget (misal: 'Makanan')" },
            limit: { type: "NUMBER", description: "Batas nominal budget (angka)" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          },
          required: ["action", "category", "limit"]
        }
      },
      {
        name: "manage_savings",
        description: "Kelola tabungan/goals pengguna. Panggil ini untuk membuat target tabungan baru, atau menambahkan uang ke tabungan yang sudah ada (top up).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "add_funds"], description: "create untuk target baru, add_funds untuk mengisi tabungan/menambah saldo" },
            name: { type: "STRING", description: "Nama tabungan/goal (misal: 'Beli Laptop')" },
            amount: { type: "NUMBER", description: "Target dana (jika create) atau Jumlah uang yang ditambahkan (jika add_funds)" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          },
        }
      },
      {
        name: "manage_recurring",
        description: "Kelola (buat/ubah/hapus) Tagihan/Langganan berulang bulanan/tahunan (contoh: langganan Netflix).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "update", "delete"], description: "create untuk tambah baru, update untuk ubah nominal/frekuensi, delete untuk membatalkan/menghapus langganan" },
            title: { type: "STRING", description: "Nama tagihan/langganan (misal: 'Netflix')" },
            amount: { type: "NUMBER", description: "Nominal tagihan (angka) - opsional jika action=delete" },
            category: { type: "STRING", description: "Kategori (misal: 'Hiburan', 'Tagihan')" },
            frequency: { type: "STRING", enum: ["daily", "weekly", "monthly", "yearly"], description: "Frekuensi tagihan" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          },
          required: ["action", "title"]
        }
      },
      {
        name: "export_report",
        description: "Unduh/ekspor laporan keuangan user ke dalam format CSV/Excel.",
        parameters: {
          type: "OBJECT",
          properties: {
            month: { type: "STRING", description: "Bulan yang ingin diekspor (YYYY-MM). Kosongkan untuk semua data." },
            replyMessage: { type: "STRING", description: "Pesan balasan (contoh: 'Laporan sedang diunduh...')" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          }
        }
      },
      {
        name: "manage_wallet",
        description: "Kelola dompet/rekening pengguna (buat dompet baru atau transfer saldo antar dompet).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "transfer"], description: "create untuk dompet baru, transfer untuk memindahkan saldo" },
            name: { type: "STRING", description: "Nama dompet baru (misal: 'BCA', 'Gopay', 'Cash')" },
            walletType: { type: "STRING", enum: ["bank", "e-wallet", "cash", "credit_card", "investment", "other"], description: "Jenis dompet baru" },
            initialBalance: { type: "NUMBER", description: "Saldo awal dompet baru (jika action=create)" },
            fromWalletId: { type: "NUMBER", description: "ID dompet asal (jika action=transfer)" },
            toWalletId: { type: "NUMBER", description: "ID dompet tujuan (jika action=transfer)" },
            amount: { type: "NUMBER", description: "Nominal transfer (jika action=transfer)" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user. WAJIB DIISI!" }
          },
          required: ["action"]
        }
      },
      {
        name: "seed_debug_data",
        description: "GENERATE/POPULATE MOCK DATA UTK DEBUGGING. Panggil ini JIKA user meminta mengisi data dummy/sample/debug/testing data (misal: 'isi data dummy untuk debugging', 'generate test data', 'populate debug data', 'seed demo data'). Ini akan otomatis membuat transaksi, anggaran, tabungan, habit, todo, dan utang-piutang sekaligus secara instan.",
        parameters: {
          type: "OBJECT",
          properties: {
            replyMessage: { type: "STRING", description: "Pesan balasan ramah bahwa data dummy debugging telah berhasil dibuat." },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" } }
          }
        }
      },
      {
        name: "manage_loans",
        description: "Kelola catatan utang atau piutang pengguna (catat utang/piutang baru, bayar cicilan, tandai lunas, hapus, atau query ringkasan utang/piutang).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "pay", "mark_paid", "delete", "query"], description: "create (tambah baru), pay (bayar cicilan), mark_paid (tandai lunas), delete (hapus), query (ringkasan/tanya jawab saldo)" },
            loanType: { type: "STRING", enum: ["debt", "receivable"], description: "debt = hutang saya, receivable = piutang saya" },
            title: { type: "STRING", description: "Judul pinjaman (misal: 'Pinjaman Motor', 'Pinjam ke Andi')" },
            personName: { type: "STRING", description: "Nama pihak terkait (pemberi pinjaman / peminjam)" },
            amount: { type: "NUMBER", description: "Total nominal pinjaman (action=create) atau nominal bayar (action=pay)" },
            walletId: { type: "NUMBER", description: "ID dompet yang digunakan untuk transaksi ini." },
            dueDate: { type: "STRING", description: "Tanggal jatuh tempo (YYYY-MM-DD) - opsional" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user. WAJIB DIISI!" }
          },
          required: ["action"]
        }
      }
    ]
  }
])

export async function parseTransactionFromText(userMessage, context) {
  const { locale = 'id', defaultCurrency = 'IDR', previousMessages = [], imageData = null, wallets = [], onStream = null, scanMode = 'all' } = context

  const normUserText = String(userMessage || '').toLowerCase()
  if (
    normUserText.includes('data dummy') ||
    normUserText.includes('dummy data') ||
    normUserText.includes('seed data') ||
    normUserText.includes('data sample') ||
    normUserText.includes('data sampel') ||
    normUserText.includes('debug data') ||
    normUserText.includes('test data') ||
    normUserText.includes('isi data dummy')
  ) {
    return {
      type: 'seed_debug_data',
      text: 'Menyiapkan dan mengisi data dummy komprehensif (transaksi, anggaran, tabungan, habit, todo, dan utang-piutang) untuk debugging...',
      chips: ['Analisis Keuangan', 'Catat Pengeluaran', 'Target Tabungan']
    }
  }

  if (
    normUserText.includes('utang piutang') ||
    normUserText.includes('hutang piutang') ||
    normUserText.includes('siapa yang utang') ||
    normUserText.includes('siapa saja yang punya utang') ||
    normUserText.includes('siapa yang punya hutang') ||
    normUserText.includes('daftar utang') ||
    normUserText.includes('daftar piutang') ||
    normUserText.includes('sisa piutang') ||
    normUserText.includes('sisa utang') ||
    normUserText.includes('total utang') ||
    normUserText.includes('utang saya') ||
    normUserText.includes('piutang saya')
  ) {
    const loans = await db.loans.toArray()
    const activeLoans = loans.filter((l) => l.status !== 'paid' && (l.remainingAmount ?? l.totalAmount) > 0)
    const totalDebt = activeLoans.filter((l) => l.type === 'debt').reduce((s, l) => s + (l.remainingAmount ?? l.totalAmount), 0)
    const totalReceivable = activeLoans.filter((l) => l.type === 'receivable').reduce((s, l) => s + (l.remainingAmount ?? l.totalAmount), 0)
    const activeCount = activeLoans.length

    let textMsg = `Berikut ringkasan **Utang & Piutang** Anda saat ini:\n\n- **Total Piutang (Tagihan Anda)**: **Rp ${totalReceivable.toLocaleString('id-ID')}**\n- **Total Hutang (Kewajiban Anda)**: **Rp ${totalDebt.toLocaleString('id-ID')}**\n- **Pinjaman Aktif**: **${activeCount} item**`

    if (activeLoans.length > 0) {
      textMsg += '\n\nRincian Pinjaman Aktif:\n' + activeLoans.map((l) => `- ${l.type === 'debt' ? 'Hutang' : 'Piutang'}: **${l.title}** (${l.personName || '-'}) · Sisa **Rp ${(l.remainingAmount ?? l.totalAmount).toLocaleString('id-ID')}**`).join('\n')
    } else {
      textMsg += '\n\nSaat ini tidak ada catatan utang atau piutang yang aktif. Kondisi kewajiban Anda bersih!'
    }

    return {
      type: 'text',
      text: textMsg,
      chips: ['Catat Piutang Baru', 'Catat Hutang Baru', 'Bayar Cicilan', 'Analisis Keuangan'],
    }
  }

  if (
    normUserText.includes('target tabungan') ||
    normUserText.includes('progres tabungan') ||
    normUserText.includes('progres target tabungan') ||
    normUserText.includes('tabungan saya saat ini')
  ) {
    const goals = await db.goals.toArray()
    const activeGoals = goals.filter((g) => g.status !== 'archived')
    if (activeGoals.length > 0) {
      const totalTarget = activeGoals.reduce((s, g) => s + (g.targetAmount || 0), 0)
      const totalCurrent = activeGoals.reduce((s, g) => s + (g.currentAmount || 0), 0)
      const pct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
      let textMsg = `Berikut progres **Target Tabungan** Anda:\n\n- **Total Terkumpul**: **Rp ${totalCurrent.toLocaleString('id-ID')}** / Rp ${totalTarget.toLocaleString('id-ID')} (${pct}%)\n- **Jumlah Target**: **${activeGoals.length} tujuan**\n\nRincian Target Tabungan:\n`
      textMsg += activeGoals.map(g => {
        const p = g.targetAmount > 0 ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0
        return `- **${g.title}**: **Rp ${(g.currentAmount || 0).toLocaleString('id-ID')}** / Rp ${(g.targetAmount || 0).toLocaleString('id-ID')} (${p}%)`
      }).join('\n')
      return {
        type: 'text',
        text: textMsg,
        chips: ['Setor Tabungan: Rp 50.000', 'Buat Target Baru: Dana Darurat', 'Analisis Keuangan']
      }
    } else {
      return {
        type: 'text',
        text: 'Saat ini belum ada **Target Tabungan** yang dibuat. Menentukan target tabungan (seperti Dana Darurat, Liburan, atau Beli Gadget) sangat efektif untuk menjaga konsistensi keuangan Anda.\n\nMau saya bantu buatkan target tabungan baru sekarang?',
        chips: ['Buat Target: Dana Darurat 5 Juta', 'Buat Target: Liburan 3 Juta', 'Analisis Keuangan']
      }
    }
  }

  if (
    normUserText.includes('habit harian') ||
    normUserText.includes('status habit') ||
    normUserText.includes('kebiasaan hari ini') ||
    normUserText.includes('habit saya hari ini')
  ) {
    const habits = await db.habits.toArray()
    const activeHabits = habits.filter(h => !h.archived)
    if (activeHabits.length > 0) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const logs = await db.habitLogs.where('date').equals(todayStr).toArray()
      const completedIds = new Set(logs.filter(l => l.completed).map(l => l.habitId))
      const doneCount = activeHabits.filter(h => completedIds.has(h.id)).length
      let textMsg = `Berikut status **Habit Harian** Anda hari ini (${doneCount}/${activeHabits.length} selesai):\n\n`
      textMsg += activeHabits.map(h => {
        const isDone = completedIds.has(h.id)
        return `- [${isDone ? 'x' : ' '}] **${h.title}** ${isDone ? '(Selesai)' : '(Belum)'}`
      }).join('\n')
      return {
        type: 'text',
        text: textMsg,
        chips: ['Selesaikan Semua Habit', 'Buat Habit Baru', 'Analisis Keuangan']
      }
    } else {
      return {
        type: 'text',
        text: 'Saat ini belum ada **Habit Harian** yang aktif. Anda bisa membuat kebiasaan finansial atau produktif harian (seperti *Tidak beli kopi di luar*, *Catat pengeluaran harian*, atau *Menabung 10rb*).\n\nMau mulai buat habit baru?',
        chips: ['Buat Habit: Hemat Kopi', 'Buat Habit: Menabung Harian', 'Analisis Keuangan']
      }
    }
  }

  if (!navigator.onLine) {
    return { error: true, message: 'Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.' }
  }

  const apiKey = getEffectiveApiKey()
  if (!apiKey) return { error: true, message: 'API Key Gemini belum diset.' }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const currentTime = format(now, 'HH:mm')
  const monthSummary = await getMonthSummaryForPrompt()

  const sysPrompt = `Kamu adalah AI Financial Companion FinTrack yang sangat cerdas, responsif, dan empathic (Proactive Smart Advisor).
Hari ini adalah tanggal: ${today} dan waktu saat ini adalah jam ${currentTime} (Waktu Lokal).
Gunakan waktu ini sebagai acuan konteks (pagi/siang/malam/sarapan/makan siang/makan malam). Default currency: ${defaultCurrency}.

RINGKASAN REAL-TIME PENGGUNA SAAT INI:
${monthSummary}

DILARANG KERAS MENJALANKAN KODE PYTHON ATAU MENGGUNAKAN TOOL LAIN SELAIN YANG DISEDIAKAN.

PEDOMAN NLP, SLANG FINANSIAL & NOMINAL INDONESIA:
1. PENGENALAN SLANG ANGKA & NOMINAL:
   - "k", "rb", "ribu" = ribuan (misal: "25k" = 25000, "50rb" = 50000).
   - "jt", "juta", "m" = jutaan (misal: "2jt" = 2000000, "1.5jt" / "1,5 juta" = 1500000).
   - "perak", "rupiah" = nominal satuan (misal: "500 perak" = 500).
   - Bahasa gaul lokal:
     * "seceng" = 1000 | "noceng" = 2000 | "goceng" = 5000 | "ceban" = 10000
     * "gocap" = 50000 | "cepek" = 100000 | "pekgo" = 150000 | "sejeti" = 1000000
   - SELALU konversikan nominal ke angka bulat (integer) murni pada field 'amount' tanpa koma atau titik.

2. PENALARAN WAKTU & TANGGAL RELATIF (Acuan Hari Ini: ${today}):
   - "hari ini", "tadi pagi", "tadi siang", "barusan" = tanggal ${today}.
   - "kemarin", "semalam", "tadi malam" = 1 hari sebelum ${today}.
   - "kemarin lusa", "2 hari lalu" = 2 hari sebelum ${today}.
   - "lusa" = 2 hari setelah ${today}.
   - "3 hari lalu", "minggu lalu hari senin", dsb = hitung tanggal yang tepat relatif terhadap ${today}.
   - SELALU isi properti 'date' dalam format standar YYYY-MM-DD.

3. PENCATATAN TRANSAKSI (PEMASUKAN, PENGELUARAN, TRANSFER):
   - PEMASUKAN / INCOME (PENTING):
     * Kenali semua istilah: "gaji", "gajian", "salary", "uang saku", "sangu", "uang jajan", "dikasih ortu/pacar", "kiriman", "bonus", "THR", "hadiah", "kado", "cashback", "komisi", "affiliate", "hasil jualan", "penjualan", "freelance", "proyek", "adsense", "kembalian", "dividen", "bunga bank", "untung", "cuan", "pemasukan", "penghasilan", "income", "dapat uang 50k", dll.
     * SELALU gunakan type: "income" dan ID Kategori Pemasukan yang tepat (misal: "uang_jajan/uang_saku", "gaji/gaji_pokok", "gaji/lembur", "bonus/thr", "bonus/cashback", "bisnis/freelance", "bisnis/penjualan", "bisnis/content_creator", "kas_kecil/kembalian", "investasi/dividen", dll).
     * JIKA user TIDAK menyebutkan dompet untuk pemasukan: LANGSUNG gunakan dompet pertama (default) dari daftar dompet tanpa menolak atau bertanya ulang.
   - PENGELUARAN / EXPENSE:
     * Kenali semua istilah pengeluaran lokal: "beli kopi", "nongkrong/nongki", "starling", "nasgor", "seblak", "makan padang", "bensin/pertamax", "ojol/gojek/grab", "parkir", "e-toll", "listrik/token", "wifi", "pulsa/kuota", "langganan/netflix/spotify", "belanja bulanan/indomaret/alfamart", "baju/sepatu", "skincare", "obat/halodoc", "spp/kuliah", "cicilan kosan/kontrakan", dll.
     * Gunakan type: "expense" dan ID Kategori Pengeluaran yang paling spesifik.
     * JIKA user tidak menyebutkan dompet: Otomatis pilih dompet yang saldonya mencukupi atau dompet pertama.
   - TRANSFER ANTAR DOMPET:
     * Gunakan type: "transfer" dengan 'walletId' (sumber) dan 'targetWalletId' (tujuan) saat user memindahkan saldo (misal: "transfer 100rb dari BCA ke GoPay", "tarik tunai 50rb dari Mandiri").
   - MULTI-TRANSAKSI / KALIMAT MAJEMUK:
     * JIKA user menyebutkan BANYAK transaksi sekaligus dalam 1 pesan (misal: "Gaji 5jt BCA, bayar kosan 1.5jt Cash, sama jajan kopi 25rb GoPay"), PANGGIL 'record_transactions' dengan array 'transactions' berisi SEMUA items tersebut!
   - JIKA user menyebutkan transaksi TAPI TIDAK menyebutkan nominal harganya (misal: "Beli makan" atau "Dapat gaji"), JANGAN panggil fungsi! Tanyalah nominalnya dengan ramah: "Berapa nominalnya?".
   - Panggil 'record_transactions' LANGSUNG jika nama/kategori & nominal sudah ada!

4. INTENT TRIGGER QUICK CHIPS:
   - JIKA user mengirim kalimat intent umum seperti "Saya ingin mencatat pengeluaran baru" / "I want to record a new expense", JANGAN PANGGIL FUNGSI! Berikan balasan ramah menanyakan detail: "Pengeluaran apa yang ingin Anda catat? Sebutkan nama pengeluaran, nominal (contoh: **Rp 25.000**), dan dompet yang digunakan." Lalu WAJIB sertakan format: <chips>Beli kopi 25rb BCA|Makan siang 35rb Cash|Bensin 50rb Mandiri</chips>.
   - JIKA user mengirim "Saya ingin membuat tugas baru" / "I want to create a new task", JANGAN PANGGIL FUNGSI! Jawab: "Tugas apa yang ingin Anda buat? Sebutkan nama tugas, deskripsi, kategori, atau sub-tugasnya." Lalu WAJIB sertakan format: <chips>Belanja bulanan: susu, beras, minyak|Bayar listrik tagihan|Laporan kantor pekerjaan</chips>.
   - JIKA user mengirim "Saya ingin menganalisis keuangan" / "I want to analyze my finances", PANGGIL 'query_database' (renderChart: true) atau jawab ramah dengan format: <chips>Total pengeluaran bulan ini|Pengeluaran kategori terbesar|Sisa anggaran bulanan</chips>.
   - JIKA user mengirim "Saya ingin membuat target tabungan" / "I want to create a savings goal", JANGAN PANGGIL FUNGSI! Jawab: "Target tabungan apa yang ingin Anda wujudkan? Sebutkan nama tujuan dan target nominalnya." Lalu WAJIB sertakan format: <chips>Beli Laptop 10 juta|Dana darurat 5 juta|Liburan 3 juta</chips>.
   - JIKA user mengirim "Saya ingin membuat habit harian" / "I want to create a daily habit", JANGAN PANGGIL FUNGSI! Jawab: "Habit harian apa yang ingin Anda bangun? Sebutkan nama kebiasaan dan jadwal pengingatnya." Lalu WAJIB sertakan format: <chips>Lari pagi jam 06:00|Baca buku jam 21:00|Minum air 8 gelas</chips>.
   - JIKA user meminta mengisi data dummy / data sampel / data debugging / test data / seed data (misal: "Isi data dummy komprehensif untuk debugging dan testing fitur", "isi data dummy", "generate test data", "populate debug data"), LANGSUNG PANGGIL 'seed_debug_data' DENGAN SEGERA!

5. TO-DO, HABIT, & LANGGANAN BARU:
   - Jika membuat To-Do: pecah langkah-langkah besar ke array 'subTasks', tentukan priority (high/medium/low), dueDate, dan kategori yang pas.
   - Jika membuat Habit: tentukan frequencyType, color, dan reminderTime.
   - Jika membuat Tagihan Berulang: tentukan frequency (monthly/yearly/weekly), amount, dan category.
   - Jika informasi penting kurang, bertanyalah. Jika sudah lengkap, LANGSUNG panggil fungsi create!

5.B. UTANG & PIUTANG (WAJIB TERHUBUNG KE DOMPET/WALLET):
   - SETIAP UTANG (HUTANG) ATAU PIUTANG WAJIB TERHUBUNG KE DOMPET (WALLET). OPSI TANPA WALLET TELAH DIHAPUS.
   - PENCATATAN UTANG / PIUTANG BARU:
     * JIKA user ingin mencatat utang atau piutang baru (misal: "Catat utang ke Budi 500rb", "Pinjam uang ke Rina 200rb", "Pinjamkan uang 1jt ke Andi"):
       - JIKA user BELUM menyebutkan nama dompet yang digunakan (misal: "BCA", "Cash", "Mandiri"):
         JANGAN langsung buat tanpa dompet! Tanyakan dengan ramah:
         "Pinjaman ini ingin dicatat masuk/keluar dari dompet mana?"
         DAN WAJIB sertakan follow-up chips daftar dompet pengguna! Contoh: <chips>Pakai BCA|Pakai Cash|Pakai Mandiri</chips>.
       - JIKA user SUDAH menyebutkan dompet (atau memilih chip dompet):
         LANGSUNG panggil tool 'manage_loans' (action='create') dengan 'walletId' yang sesuai!
   - PEMBAYARAN CICILAN / PELUNASAN:
     * Saat user ingin bayar cicilan hutang atau terima pelunasan piutang:
       - Panggil 'manage_loans' (action='pay' atau action='mark_paid') dan tentukan 'walletId'.

6. DISKUSI, TANYA JAWAB, FINANCIAL ADVICE & PERBANDINGAN:
   - PERBANDINGAN BULANAN (misal: "Bandingkan dengan bulan lalu", "apakah bulan ini lebih hemat?"):
     * JANGAN panggil fungsi dengan renderChart: true kecuali user secara eksplisit meminta gambar grafik.
     * Gunakan data dari RINGKASAN REAL-TIME PENGGUNA di atas untuk menyajikan analisis perbandingan terstruktur:
       1) **Ringkasan Pengeluaran**: Sebutkan total pengeluaran bulan ini vs bulan lalu serta selisih nominal dan persentasenya.
       2) **Kategori Dominan**: Jelaskan kategori mana yang mengalami kenaikan atau penurunan terbesar.
       3) **Kesimpulan & Saran**: Berikan kesimpulan singkat apakah performa keuangan membaik atau perlu pengetatan anggaran.
     * WAJIB sertakan follow-up chips: <chips>Kategori pengeluaran terbesar|Tips hemat AI|Tampilkan grafik pengeluaran</chips>.
   - PERTANYAAN PENGELUARAN TERBESAR (misal: "Apa pengeluaran terbesarku?", "Kategori paling boros"):
     * Sebutkan rincian kategori pengeluaran terbesar bulan ini berdasarkan data riil beserta nominalnya (**Rp XX.XXX**).
     * WAJIB sertakan follow-up chips: <chips>Bandingkan dengan bulan lalu|Tips hemat AI|Tampilkan grafik pengeluaran</chips>.
   - PERTANYAAN ANALISIS / EVALUASI KEUANGAN UMUM:
     * Berikan evaluasi keuangan yang tajam, empati, dan berbasis angka riil pengguna.
     * Jika Anda hanya merespons dengan teks biasa (tanpa memanggil tool), WAJIB tambahkan rekomendasi aksi di akhir pesan menggunakan format: <chips>Rekomendasi 1|Rekomendasi 2</chips>.

PROACTIVE ADVISOR & GAYA KOMUNIKASI:
- Berikan peringatan halus jika pengeluaran tampak terburu-buru atau besar.
- Jawab langsung, jelas, dan solutif. Dilarang kata pembuka klise seperti "Tentu", "Baiklah", "Tentu saja".
- SELALU tebalkan nominal uang (contoh: **Rp 50.000** atau **$50**).
- Bila transaksi dicatat pada dompet tertentu, gunakan mata uang (currency) yang sesuai dengan dompet tersebut.

Daftar Dompet (Wallets):
${wallets.length > 0 ? wallets.map(w => `- ID: ${w.id} | Nama: ${w.name} | Mata Uang: ${w.currency || defaultCurrency} | Saldo: ${w.currentBalance}`).join('\n') : 'Belum ada dompet.'}

Daftar Kategori:
${buildCategoryContext(locale)}`

  let contents = [{ role: 'user', parts: [{ text: sysPrompt }] }, { role: 'model', parts: [{ text: 'Paham. Saya siap membantu FinTrack.' }] }]
  
  let lastRole = 'model'
  
  previousMessages.slice(-6).forEach(msg => {
    const role = msg.role === 'ai' ? 'model' : 'user'
    let text = msg.content
    
    // Fallbacks for non-text messages to keep context flow
    if (!text) {
       if (msg.type === 'success') text = 'Transaksi berhasil dicatat.'
       else if (msg.type === 'chart') text = 'Berikut grafiknya.'
       else text = '...'
    }
    
    if (role === lastRole) {
       // Merge consecutive messages of the same role
       contents[contents.length - 1].parts.push({ text: '\n' + text })
    } else {
       contents.push({ role, parts: [{ text }] })
       lastRole = role
    }
  })
  
  let receiptVisionInstruction = ''
  if (imageData) {
    if (scanMode === 'per_item') {
      receiptVisionInstruction = `\n[INSTRUKSI SCAN STRUK - MODE PER ITEM]:
1. Ekstrak SETIAP BARIS ITEM BELANJA secara terpisah dari gambar struk ini.
2. Untuk setiap item: tentukan nama barang spesifik di field 'notes', nominal harga riil per item di field 'amount', dan KATEGORISASIKAN SECARA MANDIRI ke ID kategori pengeluaran yang paling cocok dari daftar kategori.
3. Ekstrak nama toko/merchant dari struk (misal: 'Indomaret', 'Alfamart', 'Superindo', 'Starbucks', dll) dan isi di field 'merchantName' serta 'merchant' tiap item.
4. Panggil 'record_transactions' dengan array 'transactions' berisi SEMUA item tersebut secara rinci.`
    } else {
      receiptVisionInstruction = `\n[INSTRUKSI SCAN STRUK - MODE SEMUA (TOTAL)]:
1. Ambil TOTAL KESELURUHAN belanja (Grand Total / Total Akhir) dari gambar struk ini.
2. Catat sebagai 1 transaksi pengeluaran (type: 'expense') dengan total harga di 'amount', nama toko/merchant di field 'merchantName' & 'merchant', dan notes ringkasan belanja (contoh: 'Belanja di Indomaret').
3. Kategori harus dipilih sesuai jenis toko/merchant tersebut (misal: 'belanja_harian/supermarket' atau 'makanan_minuman/restoran').
4. Panggil 'record_transactions' dengan 1 transaksi total tersebut.`
    }
  }

  const currentUserText = (userMessage || (imageData ? 'Lihat dan proses gambar struk ini' : 'Halo FinTrack AI')) + receiptVisionInstruction
  if (lastRole === 'user') {
    // Merge with previous user message
    const userParts = contents[contents.length - 1].parts
    userParts.push({ text: '\n' + currentUserText })
    if (imageData) {
      userParts.push({
        inlineData: {
          data: imageData.split(',')[1] || imageData,
          mimeType: imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg'
        }
      })
    }
  } else {
    // Create new user message
    const userParts = [{ text: currentUserText }]
    if (imageData) {
      userParts.push({
        inlineData: {
          data: imageData.split(',')[1] || imageData,
          mimeType: imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg'
        }
      })
    }
    contents.push({ role: 'user', parts: userParts })
  }

  const callApiStreamWithFallback = async (reqContents) => {
    let lastError = null
    const apiKey = getEffectiveApiKey()

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`
        const res = await fetch(`${url}?key=${apiKey}&alt=sse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: reqContents, tools: getTools(), generationConfig: { temperature: 0.1 } })
        })
        
        if (!res.ok) {
          const errText = await res.text()
          console.warn(`[${model}] API Error:`, errText)
          throw new Error(res.status === 429 ? 'Rate limit' : 'API error: ' + errText)
        }
        
        const reader = res.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let fullText = ""
        let functionCall = null
        
        let buffer = ""
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ""
          
          for (let line of lines) {
            line = line.trim()
            if (!line.startsWith('data:')) continue
            
            const dataStr = line.slice(5).trim()
            if (dataStr === '[DONE]') continue
            
            try {
              const data = JSON.parse(dataStr)
              const parts = data.candidates?.[0]?.content?.parts || []
              for (const p of parts) {
                if (p.text) {
                  fullText += p.text
                  if (onStream) onStream(p.text)
                }
                if (p.functionCall) {
                  if (!functionCall) functionCall = { name: p.functionCall.name, args: {} }
                  if (p.functionCall.args) {
                    Object.assign(functionCall.args, p.functionCall.args)
                  }
                }
              }
            } catch {
              // ignore malformed SSE json chunk
            }
          }
        }
        
        return { text: fullText, functionCall }

      } catch (err) {
        lastError = err
        
        if (err.message && (err.message.includes('404') || err.message.includes('Rate limit') || err.message.includes('429'))) {
           if (err.message.includes('Rate limit') || err.message.includes('429')) {
             console.warn(`[${model}] Rate Limit hit. Aborting fallback loop to prevent spam.`)
             break
           }
        }
      }
    }
    
    // If all models failed or loop broken
    throw lastError
  }

  try {
    let response = await callApiStreamWithFallback(contents)
    
    if (response.functionCall) {
      const fnCall = response.functionCall
      
      if (fnCall.name === 'record_transactions') {
        const defaultWalletId = wallets[0]?.id || 1
        const extractedMerchant = fnCall.args.merchantName || fnCall.args.transactions?.[0]?.merchant || ''
        const txs = fnCall.args.transactions?.map(t => {
          let resolvedWalletId = t.walletId
          if (!resolvedWalletId || (wallets.length > 0 && !wallets.some(w => String(w.id) === String(resolvedWalletId)))) {
            resolvedWalletId = defaultWalletId
          }
          const resolvedWallet = wallets.find(w => String(w.id) === String(resolvedWalletId))
          const txCurrency = resolvedWallet?.currency || defaultCurrency
          return {
            ...t,
            category: sanitizeCategoryPath(t.category, t.type),
            currency: txCurrency,
            merchant: t.merchant || extractedMerchant || undefined,
            walletId: resolvedWalletId,
          }
        }) || []
        return {
          type: 'transactions',
          action: 'create',
          transactions: txs,
          merchant: extractedMerchant,
          text: fnCall.args.replyMessage || "Berhasil dicatat!",
          chips: fnCall.args.suggestedChips
        }
      }
      
      if (fnCall.name === 'update_transaction') {
         return { type: 'transactions', action: 'update', searchQuery: fnCall.args.searchQuery, updatedFields: fnCall.args.updatedFields, text: fnCall.args.replyMessage || "Siap mengubah transaksi.", chips: fnCall.args.suggestedChips }
      }
      
      if (fnCall.name === 'delete_transaction') {
         return { type: 'transactions', action: 'delete', searchQuery: fnCall.args.searchQuery, date: fnCall.args.date, text: fnCall.args.replyMessage || "Siap menghapus transaksi.", chips: fnCall.args.suggestedChips }
      }
      
      if (fnCall.name === 'manage_habit') {
        return { type: 'habit', action: fnCall.args.action, title: fnCall.args.title, color: fnCall.args.color, frequencyType: fnCall.args.frequencyType, reminderTime: fnCall.args.reminderTime, text: fnCall.args.replyMessage || "Memproses habit...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_todo') {
        return { type: 'todo', action: fnCall.args.action, title: fnCall.args.title, description: fnCall.args.description, category: fnCall.args.category, dueDate: fnCall.args.dueDate, priority: fnCall.args.priority, subTasks: fnCall.args.subTasks, reminderTime: fnCall.args.reminderTime, text: fnCall.args.replyMessage || "Memproses to-do...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_budget') {
        return { type: 'budget', action: fnCall.args.action, category: fnCall.args.category, limit: fnCall.args.limit, text: fnCall.args.replyMessage || "Memproses budget...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_savings') {
        return { type: 'savings', action: fnCall.args.action, name: fnCall.args.name, amount: fnCall.args.amount, text: fnCall.args.replyMessage || "Memproses tabungan...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'manage_recurring') {
        return { type: 'recurring', action: fnCall.args.action, title: fnCall.args.title, amount: fnCall.args.amount, category: fnCall.args.category, frequency: fnCall.args.frequency, text: fnCall.args.replyMessage || "Memproses langganan...", chips: fnCall.args.suggestedChips }
      }

      if (fnCall.name === 'export_report') {
        return { type: 'export', month: fnCall.args.month, text: fnCall.args.replyMessage || "Menyiapkan file laporan Anda...", chips: fnCall.args.suggestedChips }
      }
      
      if (fnCall.name === 'manage_wallet') {
        return { 
          type: 'wallet', 
          action: fnCall.args.action, 
          name: fnCall.args.name, 
          walletType: fnCall.args.walletType, 
          initialBalance: fnCall.args.initialBalance, 
          fromWalletId: fnCall.args.fromWalletId, 
          toWalletId: fnCall.args.toWalletId, 
          amount: fnCall.args.amount, 
          text: fnCall.args.replyMessage || "Memproses dompet...", 
          chips: fnCall.args.suggestedChips 
        }
      }

      if (fnCall.name === 'seed_debug_data') {
        return {
          type: 'seed_debug_data',
          text: fnCall.args.replyMessage || "Menyiapkan dan mengisi data dummy komprehensif untuk debugging...",
          chips: fnCall.args.suggestedChips || ['Analisis Keuangan', 'Catat Pengeluaran']
        }
      }

      if (fnCall.name === 'manage_loans') {
        return {
          type: 'loan',
          action: fnCall.args.action,
          loanType: fnCall.args.loanType || 'debt',
          title: fnCall.args.title,
          personName: fnCall.args.personName,
          amount: fnCall.args.amount,
          dueDate: fnCall.args.dueDate,
          text: fnCall.args.replyMessage || "Memproses catat pinjaman...",
          chips: fnCall.args.suggestedChips
        }
      }
      
      if (fnCall.name === 'query_database') {
        const dbResult = await queryTransactions(fnCall.args)
        
        // If renderChart is true, we return chart data immediately along with a generic text
        if (fnCall.args.renderChart) {
           const isIncome = fnCall.args.type === 'income'
           return { 
             type: 'chart',
             chartType: isIncome ? 'income' : 'expense',
             data: isIncome ? dbResult.incomeByCategory : dbResult.expenseByCategory, 
             text: isIncome ? "Berikut adalah grafik pemasukan Anda:" : "Berikut adalah grafik pengeluaran Anda:",
             chips: isIncome ? ["Apa pemasukan terbesarku?"] : ["Apa pengeluaran terbesarku?", "Bandingkan dengan bulan lalu"] 
           }
        }
        
        contents.push({ role: 'model', parts: [{ functionCall: fnCall }] })
        contents.push({
          role: 'function',
          parts: [{ functionResponse: { name: fnCall.name, response: dbResult } }]
        })
        
        const secondRes = await callApiStreamWithFallback(contents)
        let textOutput = secondRes.text || "Maaf, tidak bisa merangkum data."
        let chips = ["Analisis pengeluaranku", "Gimana cara lebih hemat?"]
        const chipMatch = textOutput.match(/<chips>(.*?)<\/chips>/)
        if (chipMatch) {
          chips = chipMatch[1].split('|').map(c => c.trim())
          textOutput = textOutput.replace(/<chips>.*?<\/chips>/, '').trim()
        }
        return { type: 'text', text: textOutput, chips }
      }
    }

    let textOutput = response.text || 'Maaf, saya kurang mengerti maksud Anda. Bisa dijelaskan lebih detail?'
    let chips = ["Tampilkan grafik", "Ringkasan bulan ini"]
    const chipMatch = textOutput.match(/<chips>(.*?)<\/chips>/)
    if (chipMatch) {
      chips = chipMatch[1].split('|').map(c => c.trim())
      textOutput = textOutput.replace(/<chips>.*?<\/chips>/, '').trim()
    }
    return { type: 'text', text: textOutput, chips }
    
  } catch (err) {
    console.error(err)
    return { error: true, message: err.message || 'Terjadi kesalahan saat menghubungi AI.' }
  }
}

export async function getFinancialAdvice(monthData, context = {}) {
  const { locale = 'id', profileName = '' } = context
  
  if (!navigator.onLine) {
    throw new Error('Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.')
  }
  const apiKey = getEffectiveApiKey()
  if (!apiKey) {
    throw new Error('API Key Gemini belum diset.')
  }

  // Summarize monthData
  let txSummary = ''
  if (!monthData || monthData.length === 0) {
    txSummary = 'Belum ada transaksi bulan ini.'
  } else {
    const expenses = monthData.filter(tx => tx.type === 'expense')
    const totalExpense = expenses.reduce((acc, tx) => acc + (tx.amount || 0), 0)
    const income = monthData.filter(tx => tx.type === 'income')
    const totalIncome = income.reduce((acc, tx) => acc + (tx.amount || 0), 0)
    
    txSummary = `Total Pemasukan: ${totalIncome}\nTotal Pengeluaran: ${totalExpense}\n`
    
    // Group by category
    const byCategory = {}
    expenses.forEach(tx => {
      byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount
    })
    
    txSummary += '\nRincian Pengeluaran berdasarkan kategori:\n'
    Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([cat, amt]) => {
        txSummary += `- ${cat}: ${amt}\n`
      })
  }

  const prompt = `
Anda adalah konsultan keuangan pribadi yang cerdas.
Nama pengguna: ${profileName || 'Pengguna'}
Bahasa: ${locale === 'en' ? 'Inggris (English)' : 'Indonesia (Bahasa Indonesia)'}

Data transaksi bulan ini:
${txSummary}

TUGAS ANDA:
Berikan analisis keuangan dalam format JSON murni TANPA markdown block. Format JSON harus sesuai persis seperti ini:
{
  "status": "sehat" | "boros" | "waspada",
  "summary": "1-2 kalimat ringkasan tentang kondisi keuangan bulan ini.",
  "topCategory": {
    "name": "Kategori Pengeluaran Terbesar",
    "message": "Komentar singkat tentang kategori ini."
  },
  "tips": [
    "Saran praktis 1...",
    "Saran praktis 2..."
  ]
}
`

  const callApiWithFallback = async (reqContents) => {
    let lastError = null
    const apiKey = getEffectiveApiKey()
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        const res = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: reqContents, 
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } 
          })
        })
        
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(res.status === 429 ? 'Rate limit' : 'API error: ' + errText)
        }
        
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        return { text }
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }

  try {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }]
    const response = await callApiWithFallback(contents)
    return response.text
  } catch (err) {
    console.error(err)
    throw err
  }
}

export async function getSavingsPrediction(goalData, { locale = 'id', profileName = '' } = {}) {
  const prompt = `
Anda adalah konsultan keuangan pribadi.
Nama pengguna: ${profileName || 'Pengguna'}
Bahasa: ${locale === 'en' ? 'Inggris (English)' : 'Indonesia (Bahasa Indonesia)'}

Data Target Tabungan Pengguna:
- Nama Target: ${goalData.name}
- Dana Terkumpul: Rp ${goalData.currentAmount}
- Target Dana: Rp ${goalData.targetAmount}
- Sisa Kebutuhan: Rp ${goalData.targetAmount - goalData.currentAmount}
- Rata-rata tabungan bulanan (estimasi): Rp ${goalData.avgSavings}
- Tenggat Waktu (Opsional): ${goalData.deadline || 'Tidak ada'}

TUGAS ANDA:
Berikan prediksi pencapaian tabungan dalam format JSON murni TANPA markdown block. Format JSON harus persis seperti ini:
{
  "predictedDate": "Bulan Tahun (contoh: Agustus 2026)",
  "isOnTrack": true | false,
  "summary": "1 kalimat ringkasan tentang progres",
  "tips": [
    "Saran akselerasi 1...",
    "Saran akselerasi 2..."
  ]
}
`
  const callApiWithFallback = async (reqContents) => {
    let lastError = null
    const apiKey = getEffectiveApiKey()
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        const res = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: reqContents, 
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } 
          })
        })
        
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(res.status === 429 ? 'Rate limit' : 'API error: ' + errText)
        }
        
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        return { text }
      } catch (err) {
        lastError = err
      }
    }
    throw lastError
  }

  try {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }]
    const response = await callApiWithFallback(contents)
    return response.text
  } catch (err) {
    console.error(err)
    throw err
  }
}

