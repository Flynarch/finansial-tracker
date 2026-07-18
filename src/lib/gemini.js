import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'
import { parseOffline } from './offlineParser'
import { queryTransactions } from './aiDatabaseQueries'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

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
        description: "Catat satu atau banyak transaksi ke database. Panggil ini JIKA user menyebutkan data pemasukan atau pengeluaran yang ingin dicatat (misal: 'beli kopi 20rb dan makan 30rb').",
        parameters: {
          type: "OBJECT",
          properties: {
            transactions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING", enum: ["income", "expense"] },
                  category: { type: "STRING", description: "ID kategori. Gunakan format parent/child dari daftar." },
                  amount: { type: "NUMBER" },
                  date: { type: "STRING", description: "YYYY-MM-DD" },
                  notes: { type: "STRING" }
                },
                required: ["type", "category", "amount", "date", "notes"]
              }
            },
            replyMessage: { type: "STRING", description: "Pesan sukses untuk user, gunakan bahasa yang ramah (misal: 'Berhasil mencatat 2 transaksi!')" }
          },
          required: ["transactions"]
        }
      },
      {
        name: "query_database",
        description: "Hitung, cari, atau ringkas data transaksi masa lalu. Panggil ini JIKA user bertanya (misal: 'Berapa total pengeluaranku bulan ini?', 'Uangku habis ke mana saja minggu ini?').",
        parameters: {
          type: "OBJECT",
          properties: {
            startDate: { type: "STRING", description: "YYYY-MM-DD" },
            endDate: { type: "STRING", description: "YYYY-MM-DD" },
            type: { type: "STRING", enum: ["income", "expense"] },
            category: { type: "STRING" }
          }
        }
      }
    ]
  }
])

export async function parseTransactionFromText(userMessage, context) {
  const { locale = 'id', defaultCurrency = 'IDR', previousMessages = [] } = context

  if (!navigator.onLine) {
    const fallback = parseOffline(userMessage, defaultCurrency)
    return { type: fallback.transactions.length ? 'transactions' : 'text', transactions: fallback.transactions, text: fallback.message }
  }

  if (!GEMINI_API_KEY) return { error: true, message: 'API Key Gemini belum diset.' }

  const today = format(new Date(), 'yyyy-MM-dd')
  const sysPrompt = `Kamu adalah AI asisten keuangan FinTrack. Hari ini: ${today}. Default currency: ${defaultCurrency}.
TUGAS UTAMA:
1. Jika user mencatat pengeluaran/pemasukan, panggil tool 'record_transactions'. Tebak kategorinya berdasarkan daftar ini:
${buildCategoryContext(locale)}
2. Jika user bertanya tentang data keuangan, panggil tool 'query_database'. Setelah data dikembalikan, jawab pertanyaan user menggunakan format Markdown (cetak tebal, list poin-poin) agar mudah dibaca.`

  let contents = [{ role: 'user', parts: [{ text: sysPrompt }] }, { role: 'model', parts: [{ text: 'Paham.' }] }]
  
  previousMessages.slice(-6).forEach(msg => {
    if (msg.type !== 'text') return
    contents.push({ role: msg.role === 'ai' ? 'model' : 'user', parts: [{ text: msg.content }] })
  })
  
  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const callApi = async (reqContents) => {
    const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: reqContents, tools: getTools(), generationConfig: { temperature: 0.1 } })
    })
    if (!res.ok) throw new Error(res.status === 429 ? 'Rate limit' : 'API error')
    return res.json()
  }

  try {
    let response = await callApi(contents)
    let parts = response.candidates?.[0]?.content?.parts || []
    
    // Check if tool was called
    const fnCall = parts.find(p => p.functionCall)?.functionCall
    if (fnCall) {
      if (fnCall.name === 'record_transactions') {
        const txs = fnCall.args.transactions.map(t => ({ ...t, currency: defaultCurrency }))
        return { type: 'transactions', transactions: txs, text: fnCall.args.replyMessage || "Berhasil dicatat!" }
      } 
      
      if (fnCall.name === 'query_database') {
        // Execute local query
        const dbResult = await queryTransactions(fnCall.args)
        
        // Append model's functionCall request
        contents.push({ role: 'model', parts: [{ functionCall: fnCall }] })
        // Append functionResponse from DB
        contents.push({
          role: 'function',
          parts: [{ functionResponse: { name: fnCall.name, response: dbResult } }]
        })
        
        // Make second API call to get natural language reply
        const secondRes = await callApi(contents)
        const textReply = secondRes.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, tidak bisa merangkum data."
        return { type: 'text', text: textReply }
      }
    }

    // Default text response
    return { type: 'text', text: parts[0]?.text || 'Respon kosong.' }
    
  } catch (err) {
    console.error(err)
    const fallback = parseOffline(userMessage, defaultCurrency)
    if (fallback.transactions.length) return { type: 'transactions', transactions: fallback.transactions, text: fallback.message }
    return { error: true, message: err.message }
  }
}
