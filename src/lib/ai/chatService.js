/**
 * Main chat transaction parser, intent routing, and tool call orchestrator for FinTrack AI.
 */
import { format } from 'date-fns'
import { queryTransactions, getMonthSummaryForPrompt } from '../aiDatabaseQueries'
import { sanitizeCategoryPath } from '../categorySanitizer'
import { db } from '../db'
import { convertCurrency, formatCurrency, toSafeNumber, FALLBACK_EXCHANGE_RATES } from '../utils'
import { getCachedCurrencyRates } from '../api'
import useSettingsStore from '../../store/useSettingsStore'
import { extractMerchantAndCategory } from './indonesianFinanceNlp'
import { getTools } from './toolSchemas'
import { buildSystemPrompt } from './promptBuilder'
import { wrapUserTurn } from './sanitizer'
import { parseShortTransactionFast } from './fastNlp'
import { calculateDirectFinancialHealth } from './financialHealth'
import { callApiStreamWithFallback } from './client'

/**
 * Main chat extractor. Routes keyword shortcuts, offline checks, streaming Gemini model fallback,
 * and executes tool calls (record, update, query database, habits, loans, budgets, etc.).
 *
 * @param {string} userMessage - User message or question
 * @param {object} context - Context options
 * @returns {Promise<object>} Chat response object
 */
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
    const activeLoans = loans.filter((l) => !l.isArchived && l.status !== 'paid' && l.status !== 'forgiven' && toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount) > 0)
    const totalDebt = activeLoans
      .filter((l) => l.type === 'debt')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    const totalReceivable = activeLoans
      .filter((l) => l.type === 'receivable')
      .reduce((s, l) => s + convertCurrency(toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount), l.currency || defaultCurrency, defaultCurrency, rates), 0)
    const activeCount = activeLoans.length

    let textMsg = `Berikut ringkasan **Utang & Piutang** Anda saat ini:\n\n- **Total Piutang (Tagihan Anda)**: **${formatCurrency(totalReceivable, defaultCurrency)}**\n- **Total Hutang (Kewajiban Anda)**: **${formatCurrency(totalDebt, defaultCurrency)}**\n- **Pinjaman Aktif**: **${activeCount} item**`

    if (activeLoans.length > 0) {
      textMsg += '\n\nRincian Pinjaman Aktif:\n' + activeLoans.map((l) => {
        const loanCurrency = l.currency || defaultCurrency
        const remAmt = toSafeNumber(l.remainingAmount ?? l.totalAmount ?? l.amount)
        return `- ${l.type === 'debt' ? 'Hutang' : 'Piutang'}: **${l.title}** (${l.personName || '-'}) · Sisa **${formatCurrency(remAmt, loanCurrency)}**`
      }).join('\n')
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
      const totalTarget = activeGoals.reduce(
        (s, g) => s + convertCurrency(toSafeNumber(g.targetAmount), g.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
      const totalCurrent = activeGoals.reduce(
        (s, g) => s + convertCurrency(toSafeNumber(g.currentAmount), g.currency || defaultCurrency, defaultCurrency, rates),
        0
      )
      const pct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
      let textMsg = `Berikut progres **Target Tabungan** Anda:\n\n- **Total Terkumpul**: **${formatCurrency(totalCurrent, defaultCurrency)}** / ${formatCurrency(totalTarget, defaultCurrency)} (${pct}%)\n- **Jumlah Target**: **${activeGoals.length} tujuan**\n\nRincian Target Tabungan:\n`
      textMsg += activeGoals.map(g => {
        const goalCurrency = g.currency || defaultCurrency
        const p = g.targetAmount > 0 ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0
        const goalName = g.name || g.title || 'Tabungan'
        return `- **${goalName}**: **${formatCurrency(g.currentAmount || 0, goalCurrency)}** / ${formatCurrency(g.targetAmount || 0, goalCurrency)} (${p}%)`
      }).join('\n')
      return {
        type: 'text',
        text: textMsg,
        chips: [`Setor Tabungan: ${formatCurrency(50000, defaultCurrency)}`, 'Buat Target Baru: Dana Darurat', 'Analisis Keuangan']
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

  // Local validation: intercept missing nominal before making network request to save API quota and latency
  if (!imageData && userMessage) {
    const fastCheck = parseShortTransactionFast(userMessage, wallets, defaultCurrency)
    if (fastCheck?.error && fastCheck?.message && fastCheck.message.includes('Nominal')) {
      return fastCheck
    }
  }

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false

  // OFFLINE MODE: Local fast-path NLP heuristic only (never calls remote AI when offline)
  if (isOffline) {
    if (!imageData) {
      const fastTx = parseShortTransactionFast(userMessage, wallets, defaultCurrency)
      if (fastTx) {
        return fastTx
      }
    }
    return {
      error: true,
      message: 'Perangkat sedang offline. AI Gemini membutuhkan koneksi internet, dan format pesan belum dikenali oleh NLP lokal offline.',
    }
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

  const sysPrompt = buildSystemPrompt({
    todayStr: today,
    currentTime,
    currency: defaultCurrency,
    locale,
    wallets,
    monthSummary,
    recentTransactions: recentTxs,
  })

  let contents = []
  let lastRole = null

  previousMessages.slice(-6).forEach((msg) => {
    const role = msg.role === 'ai' ? 'model' : 'user'
    let text = msg.content

    // Fallbacks for non-text messages to keep context flow
    if (!text) {
      if (msg.type === 'success') text = 'Transaksi berhasil dicatat.'
      else if (msg.type === 'chart') text = 'Berikut grafiknya.'
      else text = '...'
    }

    if (role === lastRole && contents.length > 0) {
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
   - DILARANG KERAS mengambil nomor barcode, nomor transaksi, nomor izin usaha/NPWP, nomor struk, nomor meja, nomor telepon, atau kode pos sebagai nominal transaksi.

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
     * Toko ritel/supermarket/minimarket -> 'kebutuhan_harian/belanja_bulanan' atau 'kebutuhan_harian/kebutuhan_pokok'.
     * Restoran/kafe/makanan -> 'makanan/restoran' atau 'makanan/kopi'.
     * Bensin/SPBU -> 'transportasi/bensin'.
     * Apotek/obat -> 'kesehatan/obat'.
     * Elektronik/gadget -> 'elektronik/gadget'.
     * Pakaian -> 'pakaian/baju'.

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

  const rawUserPrompt = userMessage || (imageData ? 'Lihat dan proses gambar struk ini' : 'Halo FinTrack AI')
  const wrappedUserPrompt = wrapUserTurn(rawUserPrompt)
  const currentUserText = receiptVisionInstruction ? `${wrappedUserPrompt}${receiptVisionInstruction}` : wrappedUserPrompt
  if (lastRole === 'user' && contents.length > 0) {
    // Merge with previous user message
    const userParts = contents[contents.length - 1].parts
    userParts.push({ text: '\n' + currentUserText })
    if (imageData) {
      userParts.push({
        inlineData: {
          data: imageData.split(',')[1] || imageData,
          mimeType: imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg',
        },
      })
    }
  } else {
    // Create new user message
    const userParts = [{ text: currentUserText }]
    if (imageData) {
      userParts.push({
        inlineData: {
          data: imageData.split(',')[1] || imageData,
          mimeType: imageData.match(/data:(.*?);/)?.[1] || 'image/jpeg',
        },
      })
    }
    contents.push({ role: 'user', parts: userParts })
  }

  const callApi = (reqContents) => callApiStreamWithFallback(reqContents, {
    sysPrompt,
    tools: getTools(),
    onStream,
  })

  try {
    let response = await callApi(contents)

    if (response.functionCall) {
      const fnCall = response.functionCall

      if (fnCall.name === 'record_transactions') {
        const defaultWalletId = useSettingsStore.getState().defaultWalletId || wallets[0]?.id || 1
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
          engine: 'online_ai',
          engineLabel: 'AI Gemini (Online)',
          transactions: txs.map((t) => ({
            ...t,
            engine: 'online_ai',
            engineLabel: 'AI Gemini (Online)',
          })),
          merchant: extractedMerchant,
          currency: overallCurrency,
          text: fnCall.args.replyMessage || "Berhasil dicatat!",
          chips: fnCall.args.suggestedChips,
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
          chips: fnCall.args.suggestedChips,
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
          walletId: fnCall.args.walletId ? Number(fnCall.args.walletId) : undefined,
          text: fnCall.args.replyMessage || "Memproses catat pinjaman...",
          chips: fnCall.args.suggestedChips,
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
            chips: isIncome ? ["Apa pemasukan terbesarku?"] : ["Apa pengeluaran terbesarku?", "Bandingkan dengan bulan lalu"],
          }
        }

        contents.push({ role: 'model', parts: [{ functionCall: fnCall }] })
        contents.push({
          role: 'function',
          parts: [{ functionResponse: { name: fnCall.name, response: { content: dbResult } } }],
        })

        const secondRes = await callApi(contents)
        let textOutput = secondRes.text || "Maaf, tidak bisa merangkum data."
        let chips = ["Analisis pengeluaranku", "Gimana cara lebih hemat?"]
        const chipMatch = textOutput.match(/<chips>(.*?)<\/chips>/)
        if (chipMatch) {
          chips = chipMatch[1].split('|').map(c => c.trim())
          textOutput = textOutput.replace(/<chips>.*?<\/chips>/, '').trim()
        }
        return { type: 'text', text: textOutput, chips, engine: 'online_ai', engineLabel: 'AI Gemini (Online)' }
      }
    }

    let textOutput = response.text || 'Maaf, saya kurang mengerti maksud Anda. Bisa dijelaskan lebih detail?'
    let chips = ["Tampilkan grafik", "Ringkasan bulan ini"]
    const chipMatch = textOutput.match(/<chips>(.*?)<\/chips>/)
    if (chipMatch) {
      chips = chipMatch[1].split('|').map(c => c.trim())
      textOutput = textOutput.replace(/<chips>.*?<\/chips>/, '').trim()
    }
    return { type: 'text', text: textOutput, chips, engine: 'online_ai', engineLabel: 'AI Gemini (Online)' }
  } catch (err) {
    console.error(err)
    return { error: true, message: err.message || 'Terjadi kesalahan saat menghubungi AI.' }
  }
}
