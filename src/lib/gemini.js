import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'
import { queryTransactions } from './aiDatabaseQueries'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODELS = [
  'gemini-3.1-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
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

  const today = format(new Date(), 'yyyy-MM-dd')
  const sysPrompt = `Kamu adalah AI Asisten Finansial FinTrack yang sangat cerdas, minimalis, dan andal (Proactive Advisor). Hari ini adalah tanggal: ${today}. Default currency: ${defaultCurrency}.

DILARANG KERAS MENJALANKAN KODE PYTHON ATAU MENGGUNAKAN TOOL LAIN SELAIN YANG DISEDIAKAN.

ATURAN UTAMA:
1. PENCATATAN, UPDATE, DELETE TRANSAKSI:
   - Kamu HARUS mendeteksi niat user untuk mencatat, mengubah, atau menghapus transaksi.
   - Deteksi tanggal relatif dengan presisi tinggi ("Kemarin" -> 1 hari sebelum ${today}).
   - Pilih Kategori secara akurat (format "parent/child").
   - Jika mendeteksi gambar struk, ekstrak nama item dan harga, lalu panggil 'record_transactions'.
   
2. PERTANYAAN DATA & GRAFIK:
   - Jika user bertanya atau meminta laporan, panggil 'query_database'. Jika user minta "chart" atau "grafik", set renderChart: true.

3. PROACTIVE ADVISOR & GAYA KOMUNIKASI:
   - Berikan peringatan halus atau tips keuangan jika pengeluaran tampak impulsif.
   - Jawab langsung ke inti. Dilarang menggunakan "Tentu", "Baiklah".
   - Di akhir balasan teks biasa, berikan saran (suggested actions) 1-2 kalimat jika relevan.
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
        // Jika kena Rate Limit, langsung hentikan karena API Key yang dilimit, 
        // mencoba model lain secara instan malah akan dianggap spam oleh server Google.
        if (err.message.includes('Rate limit')) {
           throw err
        }
        // Try the next model
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
      
      if (fnCall.name === 'query_database') {
        const dbResult = await queryTransactions(fnCall.args)
        
        // If renderChart is true, we return chart data immediately along with a generic text
        if (fnCall.args.renderChart) {
           return { 
             type: 'chart', 
             data: dbResult.expenseByCategory, 
             text: "Berikut adalah grafik pengeluaran Anda:",
             chips: ["Apa pengeluaran terbesarku?", "Bandingkan dengan bulan lalu"] 
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

