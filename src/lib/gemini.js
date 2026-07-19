import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'
import { queryTransactions } from './aiDatabaseQueries'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro'
]

export function buildCategoryContext(locale) {
  const expenseTree = getMergedExpenseTree()
  const incomeTree = getMergedIncomeTree()
  let context = 'KATEGORI PENGELUARAN:\n'
  expenseTree.forEach(p => (p.children || []).forEach(s => context += `- ${p.id}/${s.id} - ${locale==='en'?(s.names?.en||s.names?.id):s.names?.id}\n`))
  context += '\nKATEGORI PEMASUKAN:\n'
  incomeTree.forEach(i => context += `- ${i.id} - ${locale==='en'?(i.names?.en||i.names?.id):i.names?.id}\n`)
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
                  type: { type: "STRING", enum: ["income", "expense"] },
                  category: { type: "STRING", description: "ID kategori dari daftar." },
                  amount: { type: "NUMBER" },
                  date: { type: "STRING", description: "YYYY-MM-DD" },
                  notes: { type: "STRING" }
                },
                required: ["type", "category", "amount", "date", "notes"]
              }
            },
            replyMessage: { type: "STRING", description: "Pesan sukses ramah." }
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
            replyMessage: { type: "STRING" }
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
            replyMessage: { type: "STRING" }
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
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" }
          },
          required: ["action", "title"]
        }
      },
      {
        name: "manage_todo",
        description: "Kelola (buat/selesaikan) To-Do List/Tugas pengguna.",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", enum: ["create", "complete"], description: "create untuk buat tugas baru, complete untuk menandai selesai" },
            title: { type: "STRING", description: "Nama tugas (misal: 'Bayar Listrik')" },
            dueDate: { type: "STRING", description: "Tenggat waktu (YYYY-MM-DD)" },
            reminderTime: { type: "STRING", description: "Waktu pengingat (format HH:mm, misal: '15:30')" },
            priority: { type: "STRING", enum: ["low", "medium", "high"], description: "Prioritas tugas" },
            subTasks: { type: "ARRAY", items: { type: "STRING" }, description: "Daftar sub-tugas" },
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" }
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
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" }
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
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" }
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
            replyMessage: { type: "STRING", description: "Pesan balasan untuk user" }
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
            replyMessage: { type: "STRING", description: "Pesan balasan (contoh: 'Laporan sedang diunduh...')" }
          }
        }
      }
    ]
  }
])

export async function parseTransactionFromText(userMessage, context) {
  const { locale = 'id', defaultCurrency = 'IDR', previousMessages = [], imageData = null, onStream = null } = context

  if (!navigator.onLine) {
    return { error: true, message: 'Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.' }
  }

  if (!GEMINI_API_KEY) return { error: true, message: 'API Key Gemini belum diset.' }

  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const currentTime = format(now, 'HH:mm')
  const sysPrompt = `Kamu adalah AI Asisten Finansial FinTrack yang sangat cerdas, minimalis, dan andal (Proactive Advisor). Hari ini adalah tanggal: ${today} dan waktu saat ini adalah jam ${currentTime} waktu lokal. Gunakan waktu ini sebagai acuan untuk mendeteksi transaksi (misal: membedakan antara sarapan, makan siang, atau makan malam). Default currency: ${defaultCurrency}.

DILARANG KERAS MENJALANKAN KODE PYTHON ATAU MENGGUNAKAN TOOL LAIN SELAIN YANG DISEDIAKAN.

ATURAN UTAMA:
1. TRANSAKSI & LANGGANAN: 
   - Transaksi biasa: Panggil 'record_transactions'.
   - Langganan/Tagihan Rutin (Netflix bulanan, dll): Panggil 'manage_recurring'.
2. TO-DO, HABIT, & LANGGANAN BARU (PENTING!): Jika user ingin membuat hal baru dan **ADALAH INFORMASI PENTING YANG KURANG**, JANGAN LANGSUNG PANGGIL FUNGSI! Bertanyalah dulu:
   - To-Do kurang jelas: "Kapan tenggat waktunya? Mau diingatkan jam berapa?"
   - Habit kurang jelas: "Mau warna apa? Seberapa sering?"
   - Langganan kurang jelas: "Berapa harganya? Bayar bulanan atau tahunan?"
   TAPI JIKA user SUDAH memberikan informasi tersebut secara lengkap di awal (misal: "Catat langganan Spotify 50rb tiap bulan"), LANGSUNG panggil fungsi create tanpa perlu bertanya lagi!
3. HABIT LOG & TODO COMPLETE: Jika user bilang "Aku sudah lari pagi" atau "Tugas bayar listrik sudah beres", langsung panggil fungsi tanpa banyak tanya.
4. EKSPOR LAPORAN: Jika user minta unduh/ekspor laporan atau data ke CSV/Excel/PDF, panggil 'export_report'.

PROACTIVE ADVISOR & GAYA KOMUNIKASI:
- Berikan peringatan halus atau tips keuangan jika pengeluaran tampak impulsif.
- Jawab langsung ke inti. Dilarang menggunakan "Tentu", "Baiklah".
- Tebalkan nominal uang (contoh: **Rp 50.000**).

Daftar Kategori:
${buildCategoryContext(locale)}`

  let contents = [{ role: 'user', parts: [{ text: sysPrompt }] }, { role: 'model', parts: [{ text: 'Paham.' }] }]
  
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

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`
        const res = await fetch(`${url}?key=${GEMINI_API_KEY}&alt=sse`, {
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
            } catch (e) {}
          }
        }
        
        return { text: fullText, functionCall }

      } catch (err) {
        lastError = err
        // Let it fall through to try the next model even if it's a Rate Limit, 
        // because different models might have separate quota buckets on the free tier.
      }
    }
    
    // If all models failed
    throw lastError
  }

  try {
    let response = await callApiStreamWithFallback(contents)
    
    if (response.functionCall) {
      const fnCall = response.functionCall
      
      if (fnCall.name === 'record_transactions') {
        const txs = fnCall.args.transactions?.map(t => ({ ...t, currency: defaultCurrency })) || []
        return { type: 'transactions', action: 'create', transactions: txs, text: fnCall.args.replyMessage || "Berhasil dicatat!" }
      }
      
      if (fnCall.name === 'update_transaction') {
         return { type: 'transactions', action: 'update', searchQuery: fnCall.args.searchQuery, updatedFields: fnCall.args.updatedFields, text: fnCall.args.replyMessage || "Siap mengubah transaksi." }
      }
      
      if (fnCall.name === 'delete_transaction') {
         return { type: 'transactions', action: 'delete', searchQuery: fnCall.args.searchQuery, date: fnCall.args.date, text: fnCall.args.replyMessage || "Siap menghapus transaksi." }
      }
      
      if (fnCall.name === 'manage_habit') {
        return { type: 'habit', action: fnCall.args.action, title: fnCall.args.title, color: fnCall.args.color, frequencyType: fnCall.args.frequencyType, reminderTime: fnCall.args.reminderTime, text: fnCall.args.replyMessage || "Memproses habit..." }
      }

      if (fnCall.name === 'manage_todo') {
        return { type: 'todo', action: fnCall.args.action, title: fnCall.args.title, dueDate: fnCall.args.dueDate, priority: fnCall.args.priority, subTasks: fnCall.args.subTasks, reminderTime: fnCall.args.reminderTime, text: fnCall.args.replyMessage || "Memproses to-do..." }
      }

      if (fnCall.name === 'manage_budget') {
        return { type: 'budget', action: fnCall.args.action, category: fnCall.args.category, limit: fnCall.args.limit, text: fnCall.args.replyMessage || "Memproses budget..." }
      }

      if (fnCall.name === 'manage_savings') {
        return { type: 'savings', action: fnCall.args.action, name: fnCall.args.name, amount: fnCall.args.amount, text: fnCall.args.replyMessage || "Memproses tabungan..." }
      }

      if (fnCall.name === 'manage_recurring') {
        return { type: 'recurring', action: fnCall.args.action, title: fnCall.args.title, amount: fnCall.args.amount, category: fnCall.args.category, frequency: fnCall.args.frequency, text: fnCall.args.replyMessage || "Memproses langganan..." }
      }

      if (fnCall.name === 'export_report') {
        return { type: 'export', month: fnCall.args.month, text: fnCall.args.replyMessage || "Menyiapkan file laporan Anda..." }
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
        // Generate dynamic chips heuristically
        const chips = ["Analisis pengeluaranku", "Gimana cara lebih hemat?"]
        return { type: 'text', text: secondRes.text || "Maaf, tidak bisa merangkum data.", chips }
      }
    }

    const chips = ["Tampilkan grafik", "Ringkasan bulan ini"]
    return { type: 'text', text: response.text || 'Respon kosong.', chips }
    
  } catch (err) {
    console.error(err)
    return { error: true, message: err.message || 'Terjadi kesalahan saat menghubungi AI.' }
  }
}

