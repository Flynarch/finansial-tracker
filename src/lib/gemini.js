import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'
import { queryTransactions, getMonthSummaryForPrompt } from './aiDatabaseQueries'
import { sanitizeCategoryPath } from './categorySanitizer'
import { db, computeAllWalletBalances } from './db'
import { convertCurrency, isExcludeAnalyticsTx, toSafeNumber, FALLBACK_EXCHANGE_RATES } from './utils'
import { getCachedCurrencyRates } from './api'
import { getBudgetPeriodDateRange, getCurrentBudgetMonthKey } from './budgetUtils'
import useSettingsStore from '../store/useSettingsStore'
import { parseIndonesianFinancialText, extractMerchantAndCategory } from './ai/indonesianFinanceNlp'

export function getEffectiveApiKey() {
  try {
    const userKey = useSettingsStore.getState().geminiApiKey
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // ignore
  }
  const envKey = import.meta.env.VITE_GEMINI_API_KEY || ''
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

function parseApiErrorMessage(errText, status) {
  if (status === 429) {
    return 'Batas kuota harian atau kecepatan API tercapai (Rate Limit). Silakan tunggu beberapa saat lagi.'
  }
  if (status === 404) {
    return 'Model tidak ditemukan untuk versi API ini.'
  }
  if (!errText) return 'Terjadi kendala saat menghubungi server AI.'
  try {
    const parsed = JSON.parse(errText)
    if (parsed?.error?.message) {
      const msg = parsed.error.message
      if (
        msg.includes('API key not valid') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('API key expired') ||
        msg.includes('OAuth 2 access token') ||
        msg.includes('invalid authentication credentials')
      ) {
        return 'Kredensial API Key tidak valid. Silakan periksa kembali API Key Anda di menu Pengaturan > Integrasi AI.'
      }
      return msg
    }
  } catch {
    // ignore
  }
  return errText
}

export const FAST_TRANSACTION_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
]

export const CHAT_ADVISOR_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
]

export const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
]

export async function testGeminiApiKey(customKey) {
  const key = (customKey || getEffectiveApiKey() || '').trim().replace(/^["']|["']$/g, '')
  if (!key) {
    return { ok: false, message: 'API Key belum diisi.' }
  }

  let lastErrorMsg = ''
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key.trim(),
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
        })
      })

      if (res.ok) {
        return { ok: true, model, message: `Koneksi Berhasil! Model ${model} aktif dan siap digunakan.` }
      }

      const errText = await res.text()
      const cleanMsg = parseApiErrorMessage(errText, res.status)
      lastErrorMsg = cleanMsg

      if (res.status === 400 || res.status === 401 || res.status === 403 || cleanMsg.includes('API Key')) {
        return { ok: false, message: cleanMsg }
      }
    } catch (err) {
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        return { ok: false, message: 'Gagal terhubung ke server Google. Periksa koneksi internet Anda.' }
      }
      lastErrorMsg = err.message
    }
  }

  return { ok: false, message: lastErrorMsg || 'Gagal menghubungi server Gemini. Pastikan API Key valid dari Google AI Studio.' }
}

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
                  amount: { type: "NUMBER", description: "Nominal positif angka murni tanpa pemisah titik." },
                  currency: { type: "STRING", description: "Kode mata uang 3-huruf ISO (IDR, USD, SGD, MYR, EUR, JPY, GBP) yang terdeteksi pada transaksi atau struk." },
                  date: { type: "STRING", description: "YYYY-MM-DD" },
                  notes: { type: "STRING", description: "Deskripsi transaksi atau nama barang." },
                  merchant: { type: "STRING", description: "Nama toko/merchant jika ada (misal: Indomaret, Alfamart, Starbucks)." },
                  walletId: { type: "NUMBER", description: "ID dompet (wallet) yang digunakan." },
                  targetWalletId: { type: "NUMBER", description: "ID dompet tujuan JIKA type='transfer'." },
                  items: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING", description: "Nama barang/item." },
                        price: { type: "NUMBER", description: "Total harga item." },
                        qty: { type: "NUMBER", description: "Kuantitas/jumlah barang." }
                      }
                    },
                    description: "Daftar rincian item barang pada struk belanja."
                  },
                  subtotal: { type: "NUMBER", description: "Nominal subtotal sebelum pajak/diskon jika ada." },
                  tax: { type: "NUMBER", description: "Nominal pajak PPN/PB1 jika ada." },
                  discount: { type: "NUMBER", description: "Nominal potongan harga/diskon jika ada." },
                  paymentMethod: { type: "STRING", description: "Metode pembayaran pada struk (misal: BCA, GoPay, QRIS, Tunai)." }
                },
                required: ["type", "category", "amount", "date", "notes"]
              }
            },
            merchantName: { type: "STRING", description: "Nama toko/merchant utama yang tertera pada struk." },
            currency: { type: "STRING", description: "Mata uang utama yang tertera pada struk." },
            replyMessage: { type: "STRING", description: "Pesan sukses ramah." },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks (misal: 'Lihat laporan', 'Catat 10rb lagi'). WAJIB DIISI!" }
          },
          required: ["transactions"]
        }
      },
      {
        name: "update_transaction",
        description: "Ubah/edit transaksi masa lalu. Panggil ini JIKA user minta mengubah data transaksi (misal: 'ubah transaksi tadi yang ke dana kategorinya jadi makanan', 'ganti nominal kopi tadi jadi 30rb', 'pindahkan transaksi indomaret ke BCA').",
        parameters: {
          type: "OBJECT",
          properties: {
            transactionId: { type: "NUMBER", description: "ID transaksi dari daftar transaksi jika diketahui." },
            searchQuery: { type: "STRING", description: "Kata kunci untuk mencari transaksi yang dimaksud (misal: 'dana', 'kopi', 'terakhir')." },
            updatedFields: {
              type: "OBJECT",
              properties: {
                amount: { type: "NUMBER", description: "Nominal baru." },
                category: { type: "STRING", description: "ID Kategori baru (format parentId/childId)." },
                notes: { type: "STRING", description: "Catatan baru." },
                date: { type: "STRING", description: "Tanggal baru (YYYY-MM-DD)." },
                walletId: { type: "NUMBER", description: "ID Dompet baru jika ingin memindahkan dompet transaksi." },
                targetWalletId: { type: "NUMBER", description: "ID Dompet tujuan baru (untuk transfer)." },
                type: { type: "STRING", enum: ["income", "expense", "transfer"] }
              }
            },
            replyMessage: { type: "STRING", description: "Pesan konfirmasi perubahan yang ramah." },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          },
          required: ["updatedFields"]
        }
      },
      {
        name: "delete_transaction",
        description: "Hapus transaksi masa lalu. Panggil ini JIKA user minta menghapus data (misal: 'hapus transaksi makan siang tadi').",
        parameters: {
          type: "OBJECT",
          properties: {
            transactionId: { type: "NUMBER", description: "ID transaksi jika diketahui." },
            searchQuery: { type: "STRING", description: "Kata kunci transaksi (misal: 'makan siang', 'terakhir')." },
            date: { type: "STRING", description: "Tanggal transaksi jika disebutkan (YYYY-MM-DD)." },
            replyMessage: { type: "STRING" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          }
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
        description: "Kelola (buat/update/cek status) Budget/Anggaran bulanan. Panggil tool ini juga saat pengguna menanyakan status anggaran/apakah sudah limit/bagaimana budget saat ini.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "update", "status"], description: "create/update/status budget" },
            category: { type: "STRING", description: "Kategori budget (misal: 'Makanan', 'Transportasi', 'Semua')" },
            limit: { type: "NUMBER", description: "Batas nominal budget (angka). Jika action=status dan tidak diubah, isi 0." },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user berdasarkan konteks. WAJIB DIISI!" }
          },
          required: ["action", "category"]
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
            walletId: { type: "NUMBER", description: "ID dompet (wallet) sumber dana yang digunakan untuk setor tabungan (opsional)." },
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
      },
      {
        name: "calculate_financial_health",
        description: "Hitung dan evaluasi skor kesehatan finansial pengguna (financial health score) berdasarkan rasio tabungan, beban hutang (DTI), dana darurat, dan konsistensi pengeluaran.",
        parameters: {
          type: "OBJECT",
          properties: {
            focus: { type: "STRING", description: "Fokus evaluasi: all, savings, debt, spending" },
            replyMessage: { type: "STRING", description: "Pesan balasan pengantar evaluasi kesehatan finansial" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "2-4 rekomendasi pertanyaan/aksi berikutnya" }
          }
        }
      }
    ]
  }
])

/**
 * Zero-latency Fast-Path NLP heuristic parser for short Indonesian / casual transactions.
 * Handles instant patterns like "bakso 20k", "kopi 25rb bca", "gaji 5jt", "bensin 30k" as well
 * as multi-day transactions ("sabtu dan jumwt masing-masing 10k buat maxim") in 0ms!
 */
export function parseShortTransactionFast(userText, wallets = [], defaultCurrency = 'IDR', referenceDate = new Date()) {
  return parseIndonesianFinancialText(userText, wallets, defaultCurrency, referenceDate)
}

export async function calculateDirectFinancialHealth({
  defaultCurrency = 'IDR',
  locale = 'id',
  rates = null,
  replyMessage = '',
  suggestedChips = null,
  referenceDate = null,
} = {}) {
  const activeRates = rates || getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
  const allWallets = await db.wallets.toArray()
  const txs = await db.transactions.toArray()
  const loans = await db.loans.toArray()

  const computedWallets = computeAllWalletBalances(allWallets, txs, activeRates)
  const totalCash = computedWallets
    .filter((w) => !w.isArchived)
    .reduce((acc, w) => {
      const bal = toSafeNumber(w.currentBalance ?? w.balance ?? 0)
      return acc + convertCurrency(bal, w.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const now = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const budgetCycleStartDay = useSettingsStore.getState().budgetCycleStartDay || 1
  const currentMonthKey = getCurrentBudgetMonthKey(now, budgetCycleStartDay)
  const period = getBudgetPeriodDateRange(currentMonthKey, budgetCycleStartDay, locale)

  let monthlyIncome = 0
  let monthlyExpense = 0

  txs.forEach((t) => {
    const txDate = (t?.date || '').slice(0, 10)
    if (!txDate || txDate < period.startDate || txDate > period.endDate) return

    if (t.isSplit && Array.isArray(t.splitItems) && t.splitItems.length > 0) {
      t.splitItems.forEach((si) => {
        const itemTx = {
          ...t,
          ...si,
          category: si.category || t.category,
          isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
          excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          isExcludeAnalyticsTx: false,
        }
        if (isExcludeAnalyticsTx(itemTx)) return
        const amt = convertCurrency(toSafeNumber(si.amount), t.currency || defaultCurrency, defaultCurrency, activeRates)
        const itemType = si.type || t.type
        if (itemType === 'income') monthlyIncome += amt
        if (itemType === 'expense') monthlyExpense += amt
      })
      return
    }

    if (isExcludeAnalyticsTx(t)) return
    const amt = convertCurrency(toSafeNumber(t.amount), t.currency || defaultCurrency, defaultCurrency, activeRates)
    if (t.type === 'income') monthlyIncome += amt
    if (t.type === 'expense') monthlyExpense += amt
  })

  const activeLoans = loans.filter((l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven')

  const totalDebt = activeLoans
    .filter((l) => l.type === 'debt')
    .reduce((acc, l) => {
      const raw = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return acc + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const totalReceivable = activeLoans
    .filter((l) => l.type === 'receivable')
    .reduce((acc, l) => {
      const raw = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount ?? 0)
      return acc + convertCurrency(raw, l.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

  const savingsRatio = monthlyIncome > 0 ? Math.max(0, ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0
  const dti = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : (totalDebt > 0 ? 100 : 0)
  const emergencyMonths = monthlyExpense > 0 ? (totalCash / monthlyExpense) : (totalCash > 0 ? 12 : 0)

  let score = 50
  if (savingsRatio >= 20) score += 20
  else if (savingsRatio >= 10) score += 10
  else if (savingsRatio < 0) score -= 20

  if (dti <= 30) score += 15
  else if (dti > 50) score -= 15

  if (emergencyMonths >= 6) score += 15
  else if (emergencyMonths >= 3) score += 10
  else if (emergencyMonths < 1) score -= 10

  score = Math.max(10, Math.min(100, Math.round(score)))

  const isEn = String(locale || '').toLowerCase().startsWith('en')
  let rating
  if (score >= 85) rating = isEn ? 'Excellent' : 'Sangat Sehat'
  else if (score >= 70) rating = isEn ? 'Healthy' : 'Sehat'
  else if (score >= 50) rating = isEn ? 'Fair' : 'Cukup'
  else if (score >= 35) rating = isEn ? 'Needs Attention' : 'Perlu Perhatian'
  else rating = isEn ? 'Critical' : 'Kritis'

  const defaultText = isEn
    ? `Here is your Financial Health Score evaluation: ${score}/100 (${rating}).`
    : `Berikut adalah evaluasi Skor Kesehatan Finansial Anda: ${score}/100 (${rating}).`
  const defaultChips = isEn
    ? ['How to improve score?', 'Analyze spending', 'Emergency fund advice']
    : ['Bagaimana cara menaikkan skor?', 'Analisis pengeluaranku', 'Rekomendasi dana darurat']

  return {
    type: 'financial_health',
    score,
    rating,
    metrics: {
      savingsRatio: Math.round(savingsRatio),
      dti: Math.round(dti),
      emergencyMonths: Number(emergencyMonths.toFixed(1)),
      totalCash,
      monthlyIncome,
      monthlyExpense,
      totalDebt,
      totalReceivable,
    },
    text: replyMessage || defaultText,
    chips: Array.isArray(suggestedChips) && suggestedChips.length > 0 ? suggestedChips : defaultChips,
  }
}

export async function parseTransactionFromText(userMessage, context) {
  const {
    locale = 'id',
    defaultCurrency = 'IDR',
    previousMessages = [],
    imageData = null,
    wallets = [],
    onStream = null,
    scanMode = 'all',
    rates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES },
  } = context

  // Fast-Path NLP heuristic: instant match for simple text like "bakso 20k", "kopi 25rb", "gaji 5jt"
  // Also matches multi-day patterns instantly without network overhead even during active conversation
  if (!imageData) {
    const isMultiDay =
      /\b(masing-masing|tiap\s+hari|setiap\s+hari|per\s+hari)\b/i.test(userMessage) ||
      (/\b(sabtu|jumat|senin|selasa|rabu|kamis|minggu)\b/i.test(userMessage) &&
        /(\bdan\b|\bsama\b|\bserta\b|&|,)/.test(userMessage))
    if (!previousMessages || previousMessages.length === 0 || isMultiDay) {
      const fastTx = parseShortTransactionFast(userMessage, wallets, defaultCurrency)
      if (fastTx) {
        return fastTx
      }
    }
  }

  const normUserText = String(userMessage || '').toLowerCase()

  if (
    normUserText.includes('kesehatan keuangan') ||
    normUserText.includes('kesehatan finansial') ||
    normUserText.includes('skor keuangan') ||
    normUserText.includes('kondisi finansial') ||
    normUserText.includes('financial health') ||
    normUserText.includes('evaluasi keuangan')
  ) {
    return await calculateDirectFinancialHealth({ defaultCurrency, locale, rates })
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
    const activeLoans = loans.filter((l) => l.status !== 'paid' && l.status !== 'forgiven' && toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount) > 0)
    const totalDebt = activeLoans
      .filter((l) => l.type === 'debt')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    const totalReceivable = activeLoans
      .filter((l) => l.type === 'receivable')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
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
    const activeGoals = goals.filter((g) => !g.isArchived && !g.isCompleted && g.status !== 'archived')
    if (activeGoals.length > 0) {
      const totalTarget = activeGoals.reduce((s, g) => s + (g.targetAmount || 0), 0)
      const totalCurrent = activeGoals.reduce((s, g) => s + (g.currentAmount || 0), 0)
      const pct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
      let textMsg = `Berikut progres **Target Tabungan** Anda:\n\n- **Total Terkumpul**: **Rp ${totalCurrent.toLocaleString('id-ID')}** / Rp ${totalTarget.toLocaleString('id-ID')} (${pct}%)\n- **Jumlah Target**: **${activeGoals.length} tujuan**\n\nRincian Target Tabungan:\n`
      textMsg += activeGoals.map(g => {
        const p = g.targetAmount > 0 ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0
        const goalName = g.name || g.title || 'Tabungan'
        return `- **${goalName}**: **Rp ${(g.currentAmount || 0).toLocaleString('id-ID')}** / Rp ${(g.targetAmount || 0).toLocaleString('id-ID')} (${p}%)`
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

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const currentTime = format(now, 'HH:mm')
  const monthSummary = await getMonthSummaryForPrompt()

  const recentTxs = await db.transactions
    .orderBy('date')
    .reverse()
    .limit(15)
    .toArray()

  const walletMap = new Map(wallets.map((w) => [w.id, w.name]))
  const recentTxsContext = recentTxs
    .map((tx) => {
      const wName = walletMap.get(tx.walletId) || (tx.walletId ? `Wallet #${tx.walletId}` : 'Tanpa Dompet')
      const targetWName = tx.targetWalletId ? ` -> ${walletMap.get(tx.targetWalletId) || `Wallet #${tx.targetWalletId}`}` : ''
      return `- [ID: ${tx.id}] ${tx.date} | ${tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : 'Transfer'} ${tx.currency || defaultCurrency} ${Number(tx.amount || 0).toLocaleString('id-ID')} | Kategori: ${tx.category || 'Lainnya'} | Dompet: ${wName}${targetWName} | Catatan: "${tx.notes || '-'}"`
    })
    .join('\n')

  const sysPrompt = `Kamu adalah AI Financial Companion FinTrack yang sangat cerdas, responsif, dan empathic (Proactive Smart Advisor).
Hari ini adalah tanggal: ${today} dan waktu saat ini adalah jam ${currentTime} (Waktu Lokal).
Gunakan waktu ini sebagai acuan konteks (pagi/siang/malam/sarapan/makan siang/makan malam). Default currency: ${defaultCurrency}.

ATURAN EMAS (ZERO EMOJI RULE):
DILARANG KERAS MENGGUNAKAN EMOJI DALAM SEMUA BENTUK BALASAN, KATA, CHIPS, ATAU FIELD JSON. Gunakan teks bersih, rapi, dan profesional.
${locale === 'en' ? 'LANGUAGE: Respond strictly in English. All explanations, suggestions, and chips must be in English.' : 'BAHASA: Gunakan Bahasa Indonesia yang ramah, sopan, dan solutif.'}

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
   - Hari ini adalah tanggal: ${today}.
   - "hari ini", "tadi pagi", "tadi siang", "barusan" = tanggal ${today}.
   - "kemarin", "semalam", "tadi malam" = 1 hari sebelum ${today}.
   - "kemarin lusa", "2 hari lalu" = 2 hari sebelum ${today}.
   - "lusa" = 2 hari setelah ${today}.
   - "3 hari lalu", "minggu lalu hari senin", dsb = hitung tanggal yang tepat relatif terhadap ${today}.
   - PENGENALAN NAMA HARI LOKAL & TYPO TYPOGRAFI:
     * Kenali nama hari Indonesia & typo umum: "senin" / "senen", "selasa", "rabu", "kamis", "jumat" / "jum'at" / "jumwt" / "jmt", "sabtu" / "sbtu", "minggu" / "mnggu" / "ahad".
     * "hwri" / "hri" = typo dari kata "hari". "kmrn" / "kemaren" = kemarin.
     * SELALU hitung tanggal hari tersebut ke masa lalu terdekat relatif terhadap tanggal hari ini (${today})!
       Contoh: Jika hari ini adalah Senin 14 September 2026, maka "sabtu" adalah 12 September 2026, dan "jumat" / "jumwt" adalah 11 September 2026!
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
   - MULTI-HARI & MULTI-TRANSAKSI (ATURAN MUTLAK):
     * JIKA user menyebutkan pengeluaran untuk beberapa hari atau kata "masing-masing" / "tiap hari" (misal: "kemarin hari sabtu dan jumwt masing masing hwri habisin 10k buat maxim", "sabtu 20rb minggu 30rb buat bensin"):
       WAJIB pecah menjadi BEBERAPA OBJEK TRANSAKSI TERPISAH di dalam array 'transactions'!
       Contoh untuk input di atas dengan acuan Senin 14 September 2026:
       1) Transaksi 1: date = "2026-09-12" (Sabtu), amount = 10000, category = "transportasi/ojol", merchant = "Maxim", notes = "Maxim"
       2) Transaksi 2: date = "2026-09-11" (Jumat), amount = 10000, category = "transportasi/ojol", merchant = "Maxim", notes = "Maxim"
       DILARANG KERAS menggabungkannya menjadi 1 transaksi atau hanya mencatat 1 hari saja!
     * JIKA user menyebutkan BANYAK item sekaligus dalam 1 pesan (misal: "Gaji 5jt BCA, bayar kosan 1.5jt Cash, sama jajan kopi 25rb GoPay"), PANGGIL 'record_transactions' dengan array 'transactions' berisi SEMUA items tersebut!
   - EKSTRAKSI MERCHANT & KATEGORI LAYANAN RIDE-HAILING / OJOL:
     * Layanan ride-hailing / taksi online:
       - "maxim" -> merchant = "Maxim", category = "transportasi/ojol".
       - "gojek" / "goride" / "gocar" -> merchant = "Gojek", category = "transportasi/ojol".
       - "grab" / "grabbike" / "grabcar" -> merchant = "Grab", category = "transportasi/ojol".
       - "indrive" -> merchant = "inDrive", category = "transportasi/ojol".
       - "bluebird" -> merchant = "Bluebird", category = "transportasi/taksi".
     * DILARANG KERAS mengisi properti 'merchant' dengan kalimat mentah pengguna (seperti "Kemarin hari sabtu...")! Properti 'merchant' HANYA BOLEH diisi nama merek/toko bersih (misal: "Maxim", "Indomaret", "Starbucks").
    - POLA SINGKAT NAMA BARANG/MAKANAN + NOMINAL (CONTOH: "bakso 20k", "kopi 25rb", "nasgor 15k", "bensin 30k"):
      * INI ADALAH TRANSAKSI PENGELUARAN LENGKAP (EXPENSE).
      * WAJIB LANGSUNG PANGGIL 'record_transactions' dengan type: "expense", amount yang sesuai, dan kategori yang cocok.
      * DILARANG KERAS MEMBALAS DENGAN TEKS PERCAKAPAN BIASA ATAU BERTANYA ULANG!
    - JIKA user menyebutkan transaksi TAPI TIDAK menyebutkan nominal harganya (misal: "Beli makan" atau "Dapat gaji"), JANGAN panggil fungsi! Tanyalah nominalnya dengan ramah: "Berapa nominalnya?".
    - Panggil 'record_transactions' LANGSUNG jika nama/kategori & nominal sudah ada!

4. PENGELOLAAN & EDIT TRANSAKSI MASA LALU (update_transaction & delete_transaction):
   - JIKA user meminta mengedit, mengubah kategori, mengubah nominal, atau memindahkan dompet transaksi yang baru saja terjadi atau transaksi sebelumnya (misal: "transaksi tadi yang masuk ke dana tolong di edit kategori nya jadi makanan", "ubah transaksi kopi tadi jadi 30rb", "ganti dompet transaksi indomaret ke BCA"):
     * Temukan ID transaksi yang sesuai dari DAFTAR 15 TRANSAKSI TERAKHIR di bawah.
     * Panggil tool 'update_transaction' dengan 'transactionId' tersebut, serta isi 'updatedFields' yang diubah (seperti 'category', 'amount', 'walletId', 'notes', 'date').
   - JIKA user meminta menghapus transaksi (misal: "hapus transaksi makan siang tadi"), panggil 'delete_transaction' dengan 'transactionId' yang sesuai.

5. INTENT TRIGGER QUICK CHIPS:
   - JIKA user mengirim kalimat intent umum seperti "Saya ingin mencatat pengeluaran baru" / "I want to record a new expense", JANGAN PANGGIL FUNGSI! Berikan balasan ramah menanyakan detail: "Pengeluaran apa yang ingin Anda catat? Sebutkan nama pengeluaran, nominal (contoh: **Rp 25.000**), dan dompet yang digunakan." Lalu WAJIB sertakan format: <chips>Beli kopi 25rb BCA|Makan siang 35rb Cash|Bensin 50rb Mandiri</chips>.
   - JIKA user mengirim "Saya ingin membuat tugas baru" / "I want to create a new task", JANGAN PANGGIL FUNGSI! Jawab: "Tugas apa yang ingin Anda buat? Sebutkan nama tugas, deskripsi, kategori, atau sub-tugasnya." Lalu WAJIB sertakan format: <chips>Belanja bulanan: susu, beras, minyak|Bayar listrik tagihan|Laporan kantor pekerjaan</chips>.
   - JIKA user mengirim "Saya ingin menganalisis keuangan" / "I want to analyze my finances", PANGGIL 'query_database' (renderChart: true) atau jawab ramah dengan format: <chips>Total pengeluaran bulan ini|Pengeluaran kategori terbesar|Sisa anggaran bulanan</chips>.
   - JIKA user mengirim "Saya ingin membuat target tabungan" / "I want to create a savings goal", JANGAN PANGGIL FUNGSI! Jawab: "Target tabungan apa yang ingin Anda wujudkan? Sebutkan nama tujuan dan target nominalnya." Lalu WAJIB sertakan format: <chips>Beli Laptop 10 juta|Dana darurat 5 juta|Liburan 3 juta</chips>.
   - JIKA user mengirim "Saya ingin membuat habit harian" / "I want to create a daily habit", JANGAN PANGGIL FUNGSI! Jawab: "Habit harian apa yang ingin Anda bangun? Sebutkan nama kebiasaan dan jadwal pengingatnya." Lalu WAJIB sertakan format: <chips>Lari pagi jam 06:00|Baca buku jam 21:00|Minum air 8 gelas</chips>.

6. TO-DO, HABIT, & LANGGANAN BARU:
   - Jika membuat To-Do: pecah langkah-langkah besar ke array 'subTasks', tentukan priority (high/medium/low), dueDate, dan kategori yang pas.
   - Jika membuat Habit: tentukan frequencyType, color, dan reminderTime.
   - Jika membuat Tagihan Berulang: tentukan frequency (monthly/yearly/weekly), amount, dan category.
   - Jika informasi penting kurang, bertanyalah. Jika sudah lengkap, LANGSUNG panggil fungsi create!

7. UTANG & PIUTANG (WAJIB TERHUBUNG KE DOMPET/WALLET):
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

8. DISKUSI, TANYA JAWAB, FINANCIAL ADVICE & PERBANDINGAN:
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
${wallets.length > 0 ? wallets.map((w) => `- ID: ${w.id} | Nama: ${w.name} | Mata Uang: ${w.currency || defaultCurrency} | Saldo: ${w.currentBalance}`).join('\n') : 'Belum ada dompet.'}

DAFTAR 15 TRANSAKSI TERAKHIR PENGGUNA:
${recentTxsContext || 'Belum ada transaksi sebelumnya.'}

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
    const isPerItem = scanMode === 'per_item'
    receiptVisionInstruction = `\n[PANDUAN LENGKAP ANALISIS STRUK BELANJA DENGAN GEMINI VISION]:
Gambar yang dilampirkan adalah foto fisik struk belanja, nota pembayaran, struk kasir toko/restoran, e-receipt, atau tagihan.
Ekstrak seluruh informasi secara komprehensif, teliti, dan presisi:

1. NAMA TOKO / MERCHANT ('merchantName' & 'merchant'):
   - Ambil nama merek/toko di bagian header struk (misal: 'Indomaret Point', 'Alfamart', 'Starbucks', 'Super Indo', 'Kopi Kenangan', "McDonald's", 'SPBU Pertamina', 'Apotek Century', 'Guardian', 'Uniqlo', 'Fore Coffee', 'FamilyMart', 'Lawson', 'Bakmi GM', 'Solaria', 'KFC', dsb).
   - Bersihkan dari nomor telepon, NPWP, atau alamat panjang. Cukup nama merek/toko yang bersih.

2. MATA UANG ('currency'):
   - Analisis simbol atau kode mata uang pada struk:
     * 'Rp', 'IDR', atau nominal ribuan standar Indonesia (contoh: 25.000, 78.500) -> 'IDR'.
     * '$', 'USD', 'US$' -> 'USD'.
     * 'S$', 'SGD' -> 'SGD'.
     * 'RM', 'MYR' -> 'MYR'.
     * '€', 'EUR' -> 'EUR'.
     * '¥', 'JPY' -> 'JPY'.
     * '£', 'GBP' -> 'GBP'.
     * Jika tidak ada indikasi eksplisit, gunakan '${defaultCurrency}'.
   - WAJIB isi properti 'currency' di setiap objek transaksi dan di level utama!

3. TANGGAL & WAKTU TRANSAKSI ('date'):
   - Cari tanggal transaksi yang tercetak di struk (format DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, dsb).
   - Konversikan ke format standar 'YYYY-MM-DD'. Jika tanggal di struk buram/tidak ditemukan, gunakan tanggal hari ini: '${today}'.

4. TOTAL NOMINAL AKHIR ('amount'):
   - Ambil TOTAL AKHIR (Grand Total / Total Akhir / Net Total / Total Bayar) yang benar-benar dibayar.
   - JANGAN tertukar dengan Subtotal, Diskon, Kembalian (Change), atau Uang Tunai yang diserahkan (Cash Tendered).
   - Pastikan nominal berupa angka murni tanpa titik pemisah ribuan.

5. RINCIAN ITEM BARANG ('items', 'subtotal', 'tax', 'discount'):
   - Ekstrak seluruh daftar barang yang dibeli ke array 'items':
     * name: Nama barang (bersihkan dari nomor barcode/kode internal).
     * price: Total harga baris item tersebut.
     * qty: Jumlah barang (angka, default: 1).
   - Ekstrak subtotal (sebelum pajak/diskon), nominal pajak/PPN/PB1 (tax), dan potongan harga/promo (discount) jika tertera pada struk.

6. METODE PEMBAYARAN & PENCOCOKAN DOMPET ('paymentMethod' & 'walletId'):
   - Cari metode pembayaran di struk (misal: 'BCA DEBIT', 'QRIS GOPAY', 'MANDIRI', 'SHOPEEPAY', 'DANA', 'OVO', 'TUNAI / CASH', 'CREDIT CARD').
   - Jika cocok dengan salah satu dompet pengguna (${wallets.map(w => `ID:${w.id} (${w.name})`).join(', ')}), pilih 'walletId' dompet tersebut.

7. KATEGORISASI PENGELUARAN ('category'):
   - Pilih ID kategori yang paling sesuai dari daftar kategori:
     * Toko ritel/supermarket/minimarket -> 'belanja_harian/supermarket' atau 'belanja_harian/kebutuhan_pokok'.
     * Restoran/kafe/makanan -> 'makanan_minuman/restoran' atau 'makanan_minuman/kafe'.
     * Bensin/SPBU -> 'transportasi/bensin'.
     * Apotek/obat -> 'kesehatan/obat'.
     * Elektronik/gadget -> 'elektronik/gadget'.
     * Pakaian -> 'belanja_pribadi/pakaian'.

8. MODE SCAN (${isPerItem ? 'PER ITEM (PECAH TRANSAKSI PER BARANG)' : 'TOTAL (1 TRANSAKSI RINGKASAN)'}):
   ${isPerItem
     ? `[ATURAN MUTLAK MODE PER ITEM]:
     * DILARANG KERAS menggabungkan seluruh belanjaan menjadi 1 transaksi!
     * PANGGIL tool 'record_transactions' dengan array 'transactions' yang berisi SATU OBJEK TRANSAKSI UNTUK SETIAP ITEM BARANG yang dibeli pada struk.
     * Untuk SETIAP item barang:
       - 'notes': Nama bersih barang yang dibeli (sertakan kuantitas jika > 1, misal: "Ultra Milk 250ml (x2)").
       - 'amount': Total harga untuk baris barang tersebut (angka murni).
       - 'category': Pilih ID KATEGORI SPESIFIK yang paling cocok untuk barang tersebut (contoh: susu/kopi/makanan -> 'makanan/kopi' atau 'makanan/jajan', sabun/shampoo/odol -> 'kebutuhan_harian/perlengkapan_mandi', obat/vitamin -> 'kesehatan/obat', pakaian -> 'pakaian/baju', sayur/beras/minyak -> 'kebutuhan_harian/belanja_bulanan'). JANGAN menyamakan semua barang ke 1 kategori generic!
       - 'merchant': Nama toko/merchant di struk
       - 'date': Tanggal struk (YYYY-MM-DD)
       - 'currency': Mata uang yang terdeteksi
       - 'walletId': ID dompet yang cocok`
     : `[ATURAN MODE TOTAL]:
     * Buat 1 objek transaksi utama di array 'transactions' dengan total belanja di 'amount', seluruh rincian barang di 'items', nama toko di 'merchant', subtotal, tax, discount, dan ringkasan di 'notes'.`
   }`
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
    const userKey = (useSettingsStore.getState().geminiApiKey || '').trim().replace(/^["']|["']$/g, '')
    const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
    const keysToTry = []
    if (userKey && userKey.length > 5) keysToTry.push(userKey)
    if (envKey && envKey.length > 5 && !keysToTry.includes(envKey)) keysToTry.push(envKey)
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null

    for (const key of keysToTry) {
      for (const model of CHAT_ADVISOR_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key.trim(),
            },
            body: JSON.stringify({ contents: reqContents, tools: getTools(), generationConfig: { temperature: 0.1 } })
          })
          
          if (!res.ok) {
            const errText = await res.text()
            console.warn(`[${model}] API Error:`, errText)
            const cleanMsg = parseApiErrorMessage(errText, res.status)
            lastError = new Error(cleanMsg)
            continue
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
    }
    
    // If all keys and models failed
    throw lastError || new Error('Gagal menghubungi asisten AI.')
  }

  try {
    let response = await callApiStreamWithFallback(contents)
    
    if (response.functionCall) {
      const fnCall = response.functionCall
      
      if (fnCall.name === 'record_transactions') {
        const defaultWalletId = wallets[0]?.id || 1
        const userExtraction = extractMerchantAndCategory(userMessage || '')
        let extractedMerchant = fnCall.args.merchantName || fnCall.args.transactions?.[0]?.merchant || ''
        if (extractedMerchant) {
          const cleanExtraction = extractMerchantAndCategory(extractedMerchant)
          if (cleanExtraction.merchant) {
            extractedMerchant = cleanExtraction.merchant
          } else if (extractedMerchant.length > 25 || /\b(kemarin|hari|habisin|beli|buat|untuk|masing)\b/i.test(extractedMerchant)) {
            extractedMerchant = userExtraction.merchant || ''
          }
        } else if (userExtraction.merchant) {
          extractedMerchant = userExtraction.merchant
        }
        const overallCurrency = fnCall.args.currency
        
        const txs = fnCall.args.transactions?.map(t => {
          let resolvedWalletId = t.walletId
          
          // Smart wallet matching from paymentMethod or merchant if not explicitly valid
          if (!resolvedWalletId || (wallets.length > 0 && !wallets.some(w => String(w.id) === String(resolvedWalletId)))) {
            const searchTerms = [t.paymentMethod, t.merchant, extractedMerchant].filter(Boolean).map(s => String(s).toLowerCase())
            const matchedWallet = wallets.find(w => {
              const wName = String(w.name || '').toLowerCase()
              const wType = String(w.institutionType || w.type || '').toLowerCase()
              return searchTerms.some(term => 
                term.includes(wName) || 
                wName.includes(term) || 
                (term.includes('tunai') && (wType === 'cash' || wName.includes('cash'))) || 
                (term.includes('cash') && (wType === 'cash' || wName.includes('tunai')))
              )
            })
            resolvedWalletId = matchedWallet ? matchedWallet.id : defaultWalletId
          }
          
          const resolvedWallet = wallets.find(w => String(w.id) === String(resolvedWalletId))
          const detectedCurrency = t.currency || overallCurrency
          const txCurrency = detectedCurrency || resolvedWallet?.currency || defaultCurrency
          
          let itemMerchant = t.merchant || extractedMerchant || undefined
          if (itemMerchant) {
            const cleanExtraction = extractMerchantAndCategory(itemMerchant)
            if (cleanExtraction.merchant) {
              itemMerchant = cleanExtraction.merchant
            } else if (itemMerchant.length > 25 || /\b(kemarin|hari|habisin|beli|buat|untuk|masing)\b/i.test(itemMerchant)) {
              itemMerchant = extractedMerchant || userExtraction.merchant || undefined
            }
          }

          let cleanNotes = t.notes || itemMerchant || ''
          if (cleanNotes && (cleanNotes.length > 30 || /\b(kemarin|hari|habisin|masing)\b/i.test(cleanNotes))) {
            cleanNotes = itemMerchant || cleanNotes
          }

          let cleanCat = sanitizeCategoryPath(t.category, t.type)
          const combinedStr = `${t.notes || ''} ${itemMerchant || ''} ${t.category || ''} ${userMessage || ''}`.toLowerCase()
          if (/\b(maxim|gojek|grab|indrive|ojol|goride|gocar|grabbike|grabcar)\b/i.test(combinedStr)) {
            cleanCat = 'transportasi/ojol'
          }

          return {
            ...t,
            category: cleanCat,
            currency: txCurrency,
            merchant: itemMerchant,
            notes: cleanNotes,
            walletId: resolvedWalletId,
            items: Array.isArray(t.items) && t.items.length > 0 ? t.items : undefined,
            subtotal: typeof t.subtotal === 'number' ? t.subtotal : undefined,
            tax: typeof t.tax === 'number' ? t.tax : undefined,
            discount: typeof t.discount === 'number' ? t.discount : undefined,
            paymentMethod: t.paymentMethod || undefined,
          }
        }) || []
        return {
          type: 'transactions',
          action: 'create',
          transactions: txs,
          merchant: extractedMerchant,
          currency: overallCurrency,
          text: fnCall.args.replyMessage || "Berhasil dicatat!",
          chips: fnCall.args.suggestedChips
        }
      }
      
      if (fnCall.name === 'update_transaction') {
         return {
           type: 'transactions',
           action: 'update',
           transactionId: fnCall.args.transactionId,
           searchQuery: fnCall.args.searchQuery,
           updatedFields: fnCall.args.updatedFields,
           text: fnCall.args.replyMessage || "Transaksi berhasil diperbarui.",
           chips: fnCall.args.suggestedChips,
         }
      }
      
      if (fnCall.name === 'delete_transaction') {
         return {
           type: 'transactions',
           action: 'delete',
           transactionId: fnCall.args.transactionId,
           searchQuery: fnCall.args.searchQuery,
           date: fnCall.args.date,
           text: fnCall.args.replyMessage || "Transaksi telah dihapus.",
           chips: fnCall.args.suggestedChips,
         }
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
        return { type: 'savings', action: fnCall.args.action, name: fnCall.args.name, amount: fnCall.args.amount, walletId: fnCall.args.walletId, text: fnCall.args.replyMessage || "Memproses tabungan...", chips: fnCall.args.suggestedChips }
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
      
      if (fnCall.name === 'calculate_financial_health') {
        return await calculateDirectFinancialHealth({
          defaultCurrency,
          locale,
          rates,
          replyMessage: fnCall.args?.replyMessage,
          suggestedChips: fnCall.args?.suggestedChips,
        })
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
    const userKey = (useSettingsStore.getState().geminiApiKey || '').trim().replace(/^["']|["']$/g, '')
    const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
    const keysToTry = []
    if (userKey && userKey.length > 5) keysToTry.push(userKey)
    if (envKey && envKey.length > 5 && !keysToTry.includes(envKey)) keysToTry.push(envKey)
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    for (const key of keysToTry) {
      for (const model of CHAT_ADVISOR_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key.trim(),
            },
            body: JSON.stringify({ 
              contents: reqContents, 
              generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } 
            })
          })
          
          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status)
            lastError = new Error(cleanMsg)
            continue
          }
          
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        } catch (err) {
          lastError = err
        }
      }
    }
    throw lastError || new Error('Gagal mendapatkan respon AI.')
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
  const currentAmt = Number(goalData.currentAmount || 0)
  const targetAmt = Number(goalData.targetAmount || 0)
  const isGoalReached = currentAmt >= targetAmt
  const remainingNeeded = Math.max(0, targetAmt - currentAmt)

  const prompt = `
Anda adalah konsultan keuangan pribadi.
Nama pengguna: ${profileName || 'Pengguna'}
Bahasa: ${locale === 'en' ? 'Inggris (English)' : 'Indonesia (Bahasa Indonesia)'}

Data Target Tabungan Pengguna:
- Nama Target: ${goalData.name}
- Dana Terkumpul: Rp ${currentAmt.toLocaleString('id-ID')}
- Target Dana: Rp ${targetAmt.toLocaleString('id-ID')}
- Sisa Kebutuhan: Rp ${remainingNeeded.toLocaleString('id-ID')}
- Status Capaian: ${isGoalReached ? 'TARGET SUDAH 100% TERCAPAI' : 'Sedang Berjalan'}
- Rata-rata tabungan bulanan (estimasi): Rp ${Number(goalData.avgSavings || 0).toLocaleString('id-ID')}
- Tenggat Waktu (Opsional): ${goalData.deadline || 'Tidak ada'}

PANDUAN KHUSUS:
${
  isGoalReached
    ? '- KARENA TARGET SUDAH 100% TERCAPAI: Isi "predictedDate" dengan "Sudah Tercapai" (atau "Target Reached" jika bahasa Inggris), isi "isOnTrack": true, berikan 1 kalimat apresiasi & selamat di "summary", dan berikan 2 saran langkah finansial cerdas berikutnya (misal: mengamankan dana ke instrumen reksa dana/deposito, mengalokasikan ke pos dana darurat, atau merencanakan target tabungan baru) di "tips".'
    : '- Berikan estimasi realistis kapan target tercapai berdasarkan rata-rata tabungan bulanan dan sisa kebutuhan.'
}

TUGAS ANDA:
Berikan prediksi pencapaian tabungan dalam format JSON murni TANPA markdown block. Format JSON harus persis seperti ini:
{
  "predictedDate": "${isGoalReached ? 'Sudah Tercapai' : 'Bulan Tahun (contoh: Agustus 2026)'}",
  "isOnTrack": true,
  "summary": "1 kalimat ringkasan tentang progres",
  "tips": [
    "Saran praktis 1...",
    "Saran praktis 2..."
  ]
}
`
  const callApiWithFallback = async (reqContents) => {
    const userKey = (useSettingsStore.getState().geminiApiKey || '').trim().replace(/^["']|["']$/g, '')
    const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
    const keysToTry = []
    if (userKey && userKey.length > 5) keysToTry.push(userKey)
    if (envKey && envKey.length > 5 && !keysToTry.includes(envKey)) keysToTry.push(envKey)
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    for (const key of keysToTry) {
      for (const model of CHAT_ADVISOR_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key.trim(),
            },
            body: JSON.stringify({ 
              contents: reqContents, 
              generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } 
            })
          })
          
          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status)
            lastError = new Error(cleanMsg)
            continue
          }
          
          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        } catch (err) {
          lastError = err
        }
      }
    }
    throw lastError || new Error('Gagal mendapatkan prediksi tabungan AI.')
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

/**
 * Scans a receipt image using Gemini Vision and extracts structured financial data.
 * @param {string} base64Data - Base64 encoded image string (with or without data URI prefix)
 * @param {string} mimeType - Image mime type e.g. 'image/jpeg' or 'image/png'
 * @param {object} options - Options including defaultCurrency and locale
 * @returns {Promise<object>} Extracted transaction data
 */
export async function scanReceiptImage(base64Data, mimeType = 'image/jpeg', { defaultCurrency = 'IDR', locale = 'id' } = {}) {
  const apiKey = getEffectiveApiKey()
  if (!apiKey) {
    throw new Error('API Key Gemini belum diset. Silakan atur di menu Pengaturan > Integrasi Asisten AI.')
  }

  // Clean raw base64 if it has data url prefix
  let cleanBase64 = String(base64Data || '')
  if (cleanBase64.includes('base64,')) {
    const parts = cleanBase64.split('base64,')
    cleanBase64 = parts[1]
    const header = parts[0]
    if (header.includes(':') && header.includes(';')) {
      mimeType = header.split(':')[1].split(';')[0]
    }
  }

  const categoryContext = buildCategoryContext(locale)

  const prompt = `
Anda adalah sistem OCR cerdas pemindai struk belanja dan nota pembayaran untuk aplikasi keuangan FinTrack.
Tugas Anda: Analisis foto struk berikut secara teliti dan ekstrak seluruh informasinya dalam format JSON murni TANPA blok markdown.

DAFTAR KATEGORI YANG TERSEDIA DI FINTRACK:
${categoryContext}

PETUNJUK EKSTRAKSI:
1. "merchantName": Nama toko, resto, merchant, atau tempat pembayaran (misal: "Indomaret", "Alfamart", "Starbucks", "SPBU Pertamina", "Apotek Kimia Farma"). Jika tidak terbaca jelas, gunakan "Struk Belanja".
2. "date": Tanggal transaksi dalam format "YYYY-MM-DD" (contoh: "${format(new Date(), 'yyyy-MM-dd')}"). Jika tanggal di struk tidak jelas atau tidak ditemukan, gunakan "${format(new Date(), 'yyyy-MM-dd')}".
3. "totalAmount": Total nominal pembayaran akhir yang dibayar (angka positif tanpa titik/koma/simbol). Jangan ambil nominal diskon atau subtotal, tapi TOTAL AKHIR YANG DIBAYAR.
4. "currency": Mata uang struk. Deteksi dari simbol ('Rp'/'IDR' -> "IDR", '$' -> "USD", 'S$' -> "SGD", 'RM' -> "MYR", '€' -> "EUR", '¥' -> "JPY", '£' -> "GBP"). Jika tidak tertera, gunakan "${defaultCurrency}".
5. "suggestedCategory": Pilih salah satu ID kategori yang paling cocok dari daftar kategori di atas (format: "parentId/childId", contoh: "makanMinum/kopi", "makanMinum/restoran", "belanja/supermarket", "transportasi/bensin", "kesehatan/obat").
6. "items": Daftar barang yang dibeli jika ada rincian item, dengan properti: "name" (nama barang bersih), "price" (harga total item), "qty" (jumlah barang).
7. "subtotal": Nominal subtotal sebelum pajak/diskon (angka, atau null jika tidak ada).
8. "tax": Nominal pajak PPN/PB1 (angka, atau null jika tidak ada).
9. "discount": Nominal potongan harga/diskon (angka, atau null jika tidak ada).
10. "paymentMethod": Metode pembayaran yang tertera (misal: "BCA", "GoPay", "QRIS", "Tunai", atau null).
11. "notes": Ringkasan catatan transaksi (contoh: "Alfamart: Kopi Susu, Roti Tawar").

FORMAT OUTPUT HARUS PERSIS BERUPA JSON MURNI:
{
  "merchantName": "Nama Merchant",
  "date": "YYYY-MM-DD",
  "totalAmount": 50000,
  "currency": "IDR",
  "suggestedCategory": "belanja/supermarket",
  "items": [
    { "name": "Item 1", "price": 30000, "qty": 1 },
    { "name": "Item 2", "price": 20000, "qty": 1 }
  ],
  "subtotal": 50000,
  "tax": 5000,
  "discount": 5000,
  "paymentMethod": "BCA QRIS",
  "notes": "Nama Toko: Item 1, Item 2"
}
`

  const callApiWithFallback = async (reqContents) => {
    const userKey = (useSettingsStore.getState().geminiApiKey || '').trim().replace(/^["']|["']$/g, '')
    const envKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
    const keysToTry = []
    if (userKey && userKey.length > 5) keysToTry.push(userKey)
    if (envKey && envKey.length > 5 && !keysToTry.includes(envKey)) keysToTry.push(envKey)
    if (keysToTry.length === 0) {
      throw new Error('Kunci API Gemini belum diatur. Silakan tambahkan API key Anda di menu Pengaturan > Integrasi AI.')
    }

    let lastError = null
    for (const key of keysToTry) {
      for (const model of FAST_TRANSACTION_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key.trim(),
            },
            body: JSON.stringify({
              contents: reqContents,
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            }),
          })

          if (!res.ok) {
            const errText = await res.text()
            const cleanMsg = parseApiErrorMessage(errText, res.status)
            lastError = new Error(cleanMsg)
            continue
          }

          const data = await res.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return { text }
        } catch (err) {
          lastError = err
        }
      }
    }
    throw lastError || new Error('Gagal mengekstrak data struk dengan AI.')
  }

  try {
    const contents = [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
        ],
      },
    ]
    const response = await callApiWithFallback(contents)
    const rawText = response.text || '{}'
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    let parsed = {}
    try {
      parsed = JSON.parse(cleanJson)
    } catch {
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    }

    // Sanitize category
    let finalCategory = parsed.suggestedCategory || 'belanja/lainnya'
    try {
      finalCategory = sanitizeCategoryPath(finalCategory, 'expense')
    } catch {
      /* ignore */
    }

    return {
      success: true,
      merchantName: parsed.merchantName || 'Struk Belanja',
      date: parsed.date || format(new Date(), 'yyyy-MM-dd'),
      totalAmount: Number(parsed.totalAmount) || 0,
      currency: parsed.currency || defaultCurrency,
      suggestedCategory: finalCategory,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      subtotal: typeof parsed.subtotal === 'number' ? parsed.subtotal : undefined,
      tax: typeof parsed.tax === 'number' ? parsed.tax : undefined,
      discount: typeof parsed.discount === 'number' ? parsed.discount : undefined,
      paymentMethod: parsed.paymentMethod || undefined,
      notes: parsed.notes || parsed.merchantName || 'Struk Belanja',
    }
  } catch (err) {
    console.error('scanReceiptImage error:', err)
    throw err
  }
}

