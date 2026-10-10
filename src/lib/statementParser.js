import { format, isValid } from 'date-fns'
import { toSafeNumber, parseMoneyInput } from './utils'
import { cleanMutationMerchant, matchCategoryFromDescription } from './merchantUtils'
import { getRememberedCategory } from './ai/merchantCategorizer'
import { getDecryptedNoteSync } from './fieldEncryption'

/**
 * Configure PapaParse using dynamic import (offline capable)
 */
let papaLib = null
async function getPapa() {
  if (!papaLib) {
    const imported = await import('papaparse')
    papaLib = imported.default || imported
  }
  return papaLib
}

/**
 * Configure PDF.js worker using local bundled worker (offline capable)
 */
let pdfjsLib = null
async function getPdfJs() {
  if (!pdfjsLib) {
    const [pdfjsModule, workerUrlModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjsLib = pdfjsModule
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default
    }
  }
  return pdfjsLib
}

/**
 * Extracts raw lines of text from an in-memory PDF buffer, with password support.
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} password
 * @returns {Promise<{ pages: string[][], fullText: string, isEncrypted: boolean }>}
 */
export async function extractTextFromPdf(arrayBuffer, password = '') {
  const pdfjs = await getPdfJs()
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    password: password || undefined,
    useSystemFonts: true,
  })

  try {
    const pdfDoc = await loadingTask.promise
    const pages = []
    let fullText = ''

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      // Yield to main thread every 2 pages to prevent UI jank on long statements
      if (pageNum % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Group items by vertical position (Y coordinate) to preserve table rows
      const lineMap = new Map()
      textContent.items.forEach((item) => {
        if (!item.str || item.str.trim() === '') return
        // Round Y to nearest 3px to group on same line
        const y = Math.round(item.transform[5] / 3) * 3
        if (!lineMap.has(y)) {
          lineMap.set(y, [])
        }
        lineMap.get(y).push(item)
      })

      // Sort Y descending (PDF coordinates start from bottom)
      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a)
      const pageLines = sortedY.map((y) => {
        const items = lineMap.get(y)
        // Sort X ascending (left to right)
        items.sort((a, b) => a.transform[4] - b.transform[4])
        return items.map((i) => i.str.trim()).join(' ')
      })

      pages.push(pageLines)
      fullText += pageLines.join('\n') + '\n'
    }

    return { pages, fullText, isEncrypted: false }
  } catch (err) {
      console.warn('[statementParser]', err)
    if (err.name === 'PasswordException' || String(err.message).toLowerCase().includes('password')) {
      return { pages: [], fullText: '', isEncrypted: true, needsPassword: true }
    }
    throw err
  }
}

/**
 * Parses CSV or TSV string into raw rows using dynamically imported PapaParse.
 * @param {string} csvString
 * @returns {Promise<{ headers: string[], rows: object[] }>}
 */
export async function parseCsvStatement(csvString) {
  const Papa = await getPapa()
  const sepMatch = String(csvString || '').match(/^\uFEFF?sep=([^\r\n]+)[\r\n]+/i)
  const explicitSep = sepMatch ? sepMatch[1].trim() : undefined
  const cleanedString = String(csvString || '').replace(/^\uFEFF?sep=[^\r\n]*[\r\n]+/i, '')
  const parseOptions = {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  }
  if (explicitSep && explicitSep.length === 1) {
    parseOptions.delimiter = explicitSep
  }
  const result = Papa.parse(cleanedString, parseOptions)
  return {
    headers: result.meta.fields || [],
    rows: result.data || [],
  }
}

export { cleanMutationMerchant, matchCategoryFromDescription }

/**
 * Detects bank preset from full text content or CSV headers.
 */
export function detectBankPreset(textOrHeaders) {
  const norm = (typeof textOrHeaders === 'string' ? textOrHeaders : JSON.stringify(textOrHeaders)).toLowerCase()
  if (norm.includes('bank central asia') || norm.includes('tahapan bca') || norm.includes('bca')) return 'bca'
  if (norm.includes('bank mandiri') || norm.includes('mandiri')) return 'mandiri'
  if (norm.includes('bank rakyat indonesia') || norm.includes('bri')) return 'bri'
  if (norm.includes('bank negara indonesia') || norm.includes('bni')) return 'bni'
  if (norm.includes('jenius') || norm.includes('btpn')) return 'jenius'
  if (norm.includes('gopay')) return 'gopay'
  if (norm.includes('ovo')) return 'ovo'
  return 'generic'
}

/**
 * Parses BCA e-Statement text lines (multi-line table unravelling).
 */
export function parseBcaStatementLines(lines = [], defaultYear = new Date().getFullYear()) {
  const transactions = []
  let currentTx = null

  // Pattern: DD/MM, DD-MM, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY
  const dateRowRegex = /^(\d{2}[/-]\d{2}(?:[/-]\d{2,4})?)\s+(.+)$/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Skip headers/footers
    if (
      line.includes('TGL') ||
      line.includes('KETERANGAN') ||
      line.includes('SALDO AWAL') ||
      line.includes('SALDO AKHIR') ||
      line.includes('MUTASI') ||
      line.includes('HALAMAN')
    ) {
      continue
    }

    const match = line.match(dateRowRegex)
    if (match) {
      const rawDateStr = match[1]
      const restOfLine = match[2]

      // Format ISO Date: YYYY-MM-DD
      const parts = rawDateStr.split(/[/-]/)
      const d = parts[0]
      const m = parts[1]

      const dayNum = Number(d)
      const monthNum = Number(m)

      // Guard: day must be 1..31, month must be 1..12
      // If numbers are out of range (e.g. description starts with code like 45/12),
      // treat as continuation line instead of a new date row.
      if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        if (currentTx && !line.startsWith('BERSAMBUNG')) {
          currentTx.rawDescription += ' ' + line
        }
        continue
      }

      // If there was a pending transaction, flush it
      if (currentTx) {
        transactions.push(finalizeParsedTx(currentTx))
      }

      let txYear
      if (parts[2]) {
        const rawY = Number(parts[2])
        txYear = rawY < 100 ? 2000 + rawY : rawY
      } else {
        const txMonth = Number(m)
        const currentMonth = new Date().getMonth() + 1
        txYear = txMonth > currentMonth ? defaultYear - 1 : defaultYear
      }

      const isoDate = `${txYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

      // Check DB / CR indicator and Amount in restOfLine
      // Example restOfLine: "TRSF E-BANKING DB 2808/FTSCY 50,000.00 1,250,000.00"
      // or Indonesian format: "TRSF E-BANKING DB 2808/FTSCY 50.000,00 1.250.000,00"
      let type = 'expense'
      if (/\bCR\b/i.test(restOfLine) || /\b(bunga|setoran|transfer masuk)\b/i.test(restOfLine)) {
        type = 'income'
      }

      // First clean reference numbers from line before extracting numbers
      const sanitizedLine = restOfLine.replace(/\b\d{2,4}\/[A-Z0-9_\-/]+\b/gi, '')
      const moneyPattern = /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b|\b\d+(?:[.,]\d{2})\b/g
      const numMatches = Array.from(sanitizedLine.matchAll(moneyPattern)).map((m) => m[0])
      let amount = 0
      if (numMatches.length >= 1) {
        amount = parseMoneyInput(numMatches[0], 'IDR')
      } else {
        const generalNums = Array.from(sanitizedLine.matchAll(/([\d,.]+)/g)).map((m) => m[0])
        if (generalNums.length >= 1) {
          amount = parseMoneyInput(generalNums[0], 'IDR')
        }
      }

      // Extract raw description by removing numbers
      let desc = sanitizedLine.replace(moneyPattern, '').replace(/\b(DB|CR)\b/g, '').trim()

      currentTx = {
        date: isoDate,
        rawDescription: desc,
        amount,
        type,
      }
    } else if (currentTx) {
      // Continuation line for multi-line description
      // Make sure it's not a standalone page footer or numbers
      if (!/^\d+$/.test(line) && !line.startsWith('BERSAMBUNG')) {
        currentTx.rawDescription += ' ' + line
      }
    }
  }

  if (currentTx) {
    transactions.push(finalizeParsedTx(currentTx))
  }

  return transactions
}

/**
 * Parses generic CSV rows using interactive column mappings.
 */
export function parseGenericCsvRows(rows = [], mapping = {}, currency = 'IDR') {
  const { dateCol, descCol, amountCol, debitCol, creditCol, typeCol, incomeIndicator = 'CR' } = mapping
  const transactions = []

  rows.forEach((row) => {
    const rawDate = row[dateCol]
    const rawDesc = row[descCol]
    const rawType = row[typeCol]

    let amount = 0
    let type = 'expense'

    if (debitCol || creditCol) {
      const debitAmt = debitCol && row[debitCol] ? Math.abs(parseMoneyInput(row[debitCol], currency)) : 0
      const creditAmt = creditCol && row[creditCol] ? Math.abs(parseMoneyInput(row[creditCol], currency)) : 0
      if (creditAmt > 0) {
        amount = creditAmt
        type = 'income'
      } else if (debitAmt > 0) {
        amount = debitAmt
        type = 'expense'
      } else if (amountCol && row[amountCol]) {
        const parsedAmt = parseMoneyInput(row[amountCol], currency)
        if (parsedAmt < 0) {
          amount = Math.abs(parsedAmt)
          type = 'expense'
        } else {
          amount = parsedAmt
          if (rawType) {
            const typeStr = String(rawType).trim().toUpperCase()
            if (typeStr === incomeIndicator || typeStr === 'INCOME' || typeStr === 'KREDIT' || typeStr === 'CR' || typeStr === 'CREDIT' || typeStr === 'K') {
              type = 'income'
            }
          }
        }
      }
    } else if (amountCol && row[amountCol]) {
      const parsedAmt = parseMoneyInput(row[amountCol], currency)
      if (parsedAmt < 0) {
        amount = Math.abs(parsedAmt)
        type = 'expense'
      } else {
        amount = parsedAmt
        if (rawType) {
          const typeStr = String(rawType).trim().toUpperCase()
          if (typeStr === incomeIndicator || typeStr === 'INCOME' || typeStr === 'KREDIT' || typeStr === 'CR' || typeStr === 'CREDIT' || typeStr === 'K') {
            type = 'income'
          }
        }
      }
    }

    if (amount <= 0) return
    if (!rawDate && !rawDesc) return
    if (rawDesc && /^(total|saldo awal|saldo akhir|grand total|subtotal)\b/i.test(String(rawDesc).trim())) return

    // Date & Time normalization (timezone-safe without UTC midnight shift)
    let isoDate = format(new Date(), 'yyyy-MM-dd')
    let parsedTime = null
    try {
      const rawDateStr = String(rawDate || '').trim()
      // Extract time portion if present (HH:mm:ss or HH:mm)
      const timeMatch = rawDateStr.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
      if (timeMatch) {
        const timeParts = timeMatch[1].split(':')
        const hh = timeParts[0].padStart(2, '0')
        const mm = timeParts[1].padStart(2, '0')
        parsedTime = `${hh}:${mm}`
      }

      // Strip time portion to isolate clean date string
      const dateOnlyStr = rawDateStr.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/, '').trim().replace(/,/g, '')
      const ymdMatch = dateOnlyStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
      const dmyMatch = dateOnlyStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
      const textualMonthMatch = dateOnlyStr.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,})[-/ ](\d{2,4})/)

      if (ymdMatch) {
        const [, y, m, d] = ymdMatch
        isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      } else if (dmyMatch) {
        const [, d, m, y] = dmyMatch
        const fullY = y.length === 2 ? 2000 + Number(y) : Number(y)
        isoDate = `${fullY}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      } else if (textualMonthMatch) {
        const [, d, monStr, y] = textualMonthMatch
        const monthMap = {
          jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
          jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10', oct: '10',
          nop: '11', nov: '11', des: '12', dec: '12',
        }
        const monKey = monStr.toLowerCase().slice(0, 3)
        const m = monthMap[monKey] || '01'
        const fullY = y.length === 2 ? 2000 + Number(y) : Number(y)
        isoDate = `${fullY}-${m}-${d.padStart(2, '0')}`
      } else if (dateOnlyStr) {
        const parsed = new Date(dateOnlyStr)
        if (isValid(parsed)) {
          isoDate = format(parsed, 'yyyy-MM-dd')
        }
      }
    } catch (err){
      console.warn('[statementParser]', err)
      /* fallback */
    }

    transactions.push(
      finalizeParsedTx({
        date: isoDate,
        rawDescription: String(rawDesc || 'Mutasi'),
        amount,
        type,
        currency,
        time: parsedTime || undefined,
      })
    )
  })

  return transactions
}

function finalizeParsedTx(tx) {
  const cleanMerchant = cleanMutationMerchant(tx.rawDescription)
  const remembered = getRememberedCategory(cleanMerchant, tx.type)
  const category = remembered || matchCategoryFromDescription(cleanMerchant, tx.type)
  return {
    ...tx,
    cleanMerchant,
    category,
    notes: cleanMerchant,
    selected: true,
  }
}

/**
 * Deduplication Matcher: Compares parsed mutations against existing transactions.
 * Calculates similarity based on (Date + Amount + Type + Description Similarity >= 85%).
 */
export function detectDuplicateTransactions(parsedTransactions = [], existingTransactions = [], selectedWalletId = null) {
  const claimedExistingIds = new Set()
  const seenInBatch = new Map()

  return parsedTransactions.map((parsed) => {
    // 1. Check intra-file duplicate (same date, type, amount, description within the CSV batch)
    const batchKey = `${parsed.date}|${parsed.type}|${Number(parsed.amount).toFixed(2)}|${(parsed.cleanMerchant || parsed.rawDescription || parsed.notes || '').toLowerCase().trim()}`
    const batchCount = (seenInBatch.get(batchKey) || 0) + 1
    seenInBatch.set(batchKey, batchCount)

    // 2. Find matching existing transaction from database that has NOT been claimed yet
    const matchingCandidate = existingTransactions.find((existing) => {
      if (claimedExistingIds.has(existing.id)) return false
      // Ignore soft-deleted transactions
      if (existing.deletedAt) {
        return false
      }

      // Filter by wallet if selectedWalletId is provided
      if (selectedWalletId && Number(existing.walletId) !== Number(selectedWalletId)) {
        return false
      }

      // 1. Exact Date & Type Match
      if (existing.date !== parsed.date || existing.type !== parsed.type) {
        return false
      }

      // 2. Exact Amount Match
      const existingAmt = toSafeNumber(existing.amount)
      const parsedAmt = toSafeNumber(parsed.amount)
      if (Math.abs(existingAmt - parsedAmt) > 0.01) {
        return false
      }

      // 3. Text Similarity Check
      const rawExistingNote = existing.notes || ''
      const existingNote = getDecryptedNoteSync(rawExistingNote, rawExistingNote)
      const descA = (existing.cleanMerchant || existingNote || existing.category || '').toLowerCase().trim()
      const descB = (parsed.cleanMerchant || parsed.rawDescription || parsed.notes || '').toLowerCase().trim()

      const hasTextMatch = Boolean(descA && descB && (descA === descB || descA.includes(descB) || descB.includes(descA)))
      return hasTextMatch
    })

    if (matchingCandidate) {
      claimedExistingIds.add(matchingCandidate.id)
      return {
        ...parsed,
        isDuplicate: true,
        selected: false, // Uncheck duplicates by default for safety
        duplicateMatch: matchingCandidate,
      }
    }

    if (batchCount > 1) {
      // Intra-file duplicate within this CSV import
      return {
        ...parsed,
        isDuplicate: true,
        isDuplicateInImport: true,
        selected: false,
        duplicateMatch: { id: `batch-dup-${batchKey}`, date: parsed.date, notes: 'Duplikat dalam berkas rekening koran' },
      }
    }

    return {
      ...parsed,
      isDuplicate: false,
      selected: parsed.isDuplicate ? true : (parsed.selected !== undefined ? parsed.selected : true),
      duplicateMatch: null,
    }
  })
}
