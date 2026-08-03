import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'
import { queryTransactions, getMonthSummaryForPrompt } from './aiDatabaseQueries'
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
                  walletId: { type: "NUMBER", description: "ID dompet (wallet) yang digunakan." },
                  targetWalletId: { type: "NUMBER", description: "ID dompet tujuan JIKA type='transfer'." }
                },
                required: ["type", "category", "amount", "date", "notes"]
              }
            },
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
        name: "manage_loans",
        description: "Kelola catatan utang atau piutang pengguna (catat utang/piutang baru atau bayar cicilan).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "pay"], description: "create untuk pinjaman baru, pay untuk bayar cicilan" },
            loanType: { type: "STRING", enum: ["debt", "receivable"], description: "debt = hutang saya, receivable = piutang saya" },
            title: { type: "STRING", description: "Judul pinjaman (misal: 'Pinjaman Motor', 'Pinjam ke Andi')" },
            personName: { type: "STRING", description: "Nama pihak terkait (pemberi pinjaman / peminjam)" },
            amount: { type: "NUMBER", description: "Total nominal pinjaman (action=create) atau nominal bayar (action=pay)" },
            dueDate: { type: "STRING", description: "Tanggal jatuh tempo (YYYY-MM-DD) - opsional" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" },
            suggestedChips: { type: "ARRAY", items: { type: "STRING" }, description: "Berikan 2-4 rekomendasi aksi/pertanyaan selanjutnya untuk user. WAJIB DIISI!" }
          },
          required: ["action", "title", "amount"]
        }
      }
    ]
  }
])

export async function parseTransactionFromText(userMessage, context) {
  const { locale = 'id', defaultCurrency = 'IDR', previousMessages = [], imageData = null, wallets = [], onStream = null } = context

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

ATURAN UTAMA:
0. INTENT TRIGGER QUICK CHIPS (SANGAT PENTING):
   - JIKA user mengirim kalimat intent umum seperti "Saya ingin mencatat pengeluaran baru" / "I want to record a new expense", JANGAN PANGGIL FUNGSI! Berikan balasan ramah menanyakan detail: "Pengeluaran apa yang ingin Anda catat? Sebutkan nama pengeluaran, nominal (contoh: **Rp 25.000**), dan dompet yang digunakan." Lalu WAJIB sertakan format: <chips>Beli kopi 25rb BCA|Makan siang 35rb Cash|Bensin 50rb Mandiri</chips>.
   - JIKA user mengirim "Saya ingin membuat tugas baru" / "I want to create a new task", JANGAN PANGGIL FUNGSI! Jawab: "Tugas apa yang ingin Anda buat? Sebutkan nama tugas, deskripsi, kategori, atau sub-tugasnya." Lalu WAJIB sertakan format: <chips>Belanja bulanan: susu, beras, minyak|Bayar listrik tagihan|Laporan kantor pekerjaan</chips>.
   - JIKA user mengirim "Saya ingin menganalisis keuangan" / "I want to analyze my finances", PANGGIL 'query_database' (renderChart: true) atau jawab ramah dengan format: <chips>Total pengeluaran bulan ini|Pengeluaran kategori terbesar|Sisa anggaran bulanan</chips>.
   - JIKA user mengirim "Saya ingin membuat target tabungan" / "I want to create a savings goal", JANGAN PANGGIL FUNGSI! Jawab: "Target tabungan apa yang ingin Anda wujudkan? Sebutkan nama tujuan dan target nominalnya." Lalu WAJIB sertakan format: <chips>Beli Laptop 10 juta|Dana darurat 5 juta|Liburan 3 juta</chips>.
   - JIKA user mengirim "Saya ingin membuat habit harian" / "I want to create a daily habit", JANGAN PANGGIL FUNGSI! Jawab: "Habit harian apa yang ingin Anda bangun? Sebutkan nama kebiasaan dan jadwal pengingatnya." Lalu WAJIB sertakan format: <chips>Lari pagi jam 06:00|Baca buku jam 21:00|Minum air 8 gelas</chips>.

1. TRANSAKSI (PENTING & DETAIL):
   - JIKA user menyebutkan pengeluaran/pemasukan TAPI TIDAK menyebutkan nominal harganya (misal: "Beli makan"), JANGAN panggil fungsi! Tanyalah harganya dengan ramah: "Berapa harga makannya?".
   - Jika user menyebutkan BANYAK transaksi sekaligus (misal: "beli kopi 25rb dan bensin 50rb"), PANGGIL 'record_transactions' dengan array 'transactions' berisi SEMUA items tersebut!
   - Jika kategori tidak ditemukan, gunakan "Lainnya" atau kategori induk terdekat.
   - Panggil 'record_transactions' HANYA jika data sudah lengkap (nama & harga).
   - JIKA user menyebutkan dompet/akun (contoh: "pakai BCA", "dari cash", "ke Gopay"), isi 'walletId' (dan 'targetWalletId' jika transfer) menggunakan ID dari Daftar Dompet di bawah.
   - ATURAN PEMILIHAN DOMPET JIKA JUMLAH DOMPET > 1:
     a. Jika mencatat PENGELUARAN dan TIDAK menyebutkan dompet: Cek saldo tiap dompet. Jika HANYA 1 dompet yang saldonya cukup (>= harga), LANGSUNG gunakan dompet tersebut. Jika >1 dompet cukup (atau semua kurang), JANGAN panggil fungsi! Tanyalah: "Dompet mana yang mau dipakai? [Sebutkan opsi yang cukup]".
     b. Jika mencatat PEMASUKAN dan TIDAK menyebutkan dompet: JANGAN panggil fungsi! Tanyalah: "Masuk ke dompet mana?".
     c. Pengecualian: Jika total dompet hanya 1, langsung gunakan dompet tersebut tanpa bertanya.

2. TO-DO, HABIT, & LANGGANAN BARU: Jika user ingin membuat hal baru dan **ADALAH INFORMASI PENTING YANG KURANG**, JANGAN LANGSUNG PANGGIL FUNGSI! Bertanyalah dulu:
   - To-Do kurang jelas: "Kapan tenggat waktunya? Mau diingatkan jam berapa?"
   - Habit kurang jelas: "Mau warna apa? Seberapa sering?"
   - Langganan kurang jelas: "Berapa harganya? Bayar bulanan atau tahunan?"
   TAPI JIKA user SUDAH memberikan informasi tersebut secara lengkap di awal (misal: "Catat langganan Spotify 50rb tiap bulan"), LANGSUNG panggil fungsi create tanpa perlu bertanya lagi!

3. HABIT LOG & TODO COMPLETE: Jika user bilang "Aku sudah lari pagi" atau "Tugas bayar listrik sudah beres", langsung panggil fungsi tanpa banyak tanya.

4. EKSPOR LAPORAN: Jika user minta unduh/ekspor laporan atau data ke CSV/Excel/PDF, panggil 'export_report'.

5. DISKUSI, TANYA JAWAB & ADVICE: 
   - Jika user hanya menyapa ("Halo") atau membahas [KONTEKS SISTEM], JAWAB LANGSUNG DENGAN TEKS ramah & kontekstual jam (pagi/siang/malam).
   - JIKA user meminta evaluasi keuangannya atau nasihat pengeluaran pribadinya (misal: "aku kurangi apa biar ga boros?", "cek pengeluaranku", "analisa keuanganku"), PANGGIL 'query_database' (set renderChart: false jika user tidak minta grafik) agar kamu bisa memberikan nasihat spesifik berdasarkan data riil pengguna! JANGAN hanya memberi saran umum.
   - Jika Anda hanya merespons dengan teks biasa (tidak memanggil fungsi/tool), WAJIB tambahkan rekomendasi aksi/pertanyaan di akhir pesan menggunakan format: <chips>Rekomendasi 1|Rekomendasi 2</chips>.

PROACTIVE ADVISOR & GAYA KOMUNIKASI:
- Berikan peringatan halus jika pengeluaran tampak terburu-buru atau besar.
- Jawab langsung, jelas, dan solutif. Dilarang kata pembuka klise seperti "Tentu", "Baiklah", "Tentu saja".
- SELALU tebalkan nominal uang (contoh: **Rp 50.000**).

Daftar Dompet (Wallets):
${wallets.length > 0 ? wallets.map(w => `- ID: ${w.id} | Nama: ${w.name} | Saldo: ${w.currentBalance}`).join('\n') : 'Belum ada dompet.'}

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
  
  const currentUserText = userMessage || "Lihat gambar struk ini"
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
        const txs = fnCall.args.transactions?.map(t => ({ ...t, currency: defaultCurrency })) || []
        return { type: 'transactions', action: 'create', transactions: txs, text: fnCall.args.replyMessage || "Berhasil dicatat!", chips: fnCall.args.suggestedChips }
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

