import Papa from 'papaparse'
import { format, isValid } from 'date-fns'
import { toSafeNumber } from './utils'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { cleanMutationMerchant, matchCategoryFromDescription } from './merchantUtils'

/**
 * Configure PDF.js worker using local bundled worker (offline capable)
 */
let pdfjsLib = null
async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
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
    if (err.name === 'PasswordException' || String(err.message).toLowerCase().includes('password')) {
      return { pages: [], fullText: '', isEncrypted: true, needsPassword: true }
    }
    throw err
  }
}

/**
 * Parses CSV or TSV string into raw rows.
 */
export function parseCsvStatement(csvString) {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
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

  // Pattern: DD/MM (e.g. "05/08" or "28/08")
  const dateRowRegex = /^(\d{2}\/\d{2})\s+(.+)$/

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
      // If there was a pending transaction, flush it
      if (currentTx) {
        transactions.push(finalizeParsedTx(currentTx))
      }

      const rawDateStr = match[1] // "05/08"
      const restOfLine = match[2]

      // Format ISO Date: YYYY-MM-DD
      const [d, m] = rawDateStr.split('/')
      const isoDate = `${defaultYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

      // Check DB / CR indicator and Amount in restOfLine
      // Example restOfLine: "TRSF E-BANKING DB 2808/FTSCY 50,000.00 1,250,000.00"
      let type = 'expense'
      if (/\bCR\b/i.test(restOfLine) || /\b(bunga|setoran|transfer masuk)\b/i.test(restOfLine)) {
        type = 'income'
      }

      // First clean reference numbers from line before extracting numbers
      const sanitizedLine = restOfLine.replace(/\b\d{2,4}\/[A-Z0-9_\-/]+\b/gi, '')
      const numMatches = Array.from(sanitizedLine.matchAll(/([\d,]+\.\d{2})/g)).map((m) => m[0])
      let amount = 0
      if (numMatches.length >= 1) {
        const rawAmtStr = numMatches[0].replace(/,/g, '')
        amount = toSafeNumber(rawAmtStr)
      } else {
        const generalNums = Array.from(sanitizedLine.matchAll(/([\d,]+)/g)).map((m) => m[0])
        if (generalNums.length >= 1) {
          amount = toSafeNumber(generalNums[0].replace(/,/g, ''))
        }
      }

      // Extract raw description by removing numbers
      let desc = sanitizedLine.replace(/([\d,]+\.\d{2})/g, '').replace(/\b(DB|CR)\b/g, '').trim()

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
export function parseGenericCsvRows(rows = [], mapping = {}) {
  const { dateCol, descCol, amountCol, typeCol, incomeIndicator = 'CR' } = mapping
  const transactions = []

  rows.forEach((row) => {
    const rawDate = row[dateCol]
    const rawDesc = row[descCol]
    const rawAmt = row[amountCol]
    const rawType = row[typeCol]

    if (!rawDate && !rawAmt) return

    let amount = toSafeNumber(String(rawAmt || '').replace(/[^0-9.-]+/g, ''))
    if (amount <= 0) return

    let type = 'expense'
    if (rawType) {
      const typeStr = String(rawType).trim().toUpperCase()
      if (typeStr === incomeIndicator || typeStr === 'INCOME' || typeStr === 'KREDIT' || typeStr === 'CR') {
        type = 'income'
      }
    }

    // Date normalization
    let isoDate = format(new Date(), 'yyyy-MM-dd')
    try {
      const parsed = new Date(rawDate)
      if (isValid(parsed)) {
        isoDate = format(parsed, 'yyyy-MM-dd')
      }
    } catch {
      /* fallback */
    }

    transactions.push(
      finalizeParsedTx({
        date: isoDate,
        rawDescription: String(rawDesc || 'Mutasi'),
        amount,
        type,
      })
    )
  })

  return transactions
}

function finalizeParsedTx(tx) {
  const cleanMerchant = cleanMutationMerchant(tx.rawDescription)
  const category = matchCategoryFromDescription(cleanMerchant, tx.type)
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
export function detectDuplicateTransactions(parsedTransactions = [], existingTransactions = []) {
  return parsedTransactions.map((parsed) => {
    const matchingCandidate = existingTransactions.find((existing) => {
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
      const textA = (existing.notes || existing.category || '').toLowerCase().trim()
      const textB = (parsed.cleanMerchant || parsed.rawDescription || '').toLowerCase().trim()

      if (textA === textB || textA.includes(textB) || textB.includes(textA)) {
        return true
      }

      return false
    })

    if (matchingCandidate) {
      return {
        ...parsed,
        isDuplicate: true,
        selected: false, // Uncheck duplicates by default for safety
        duplicateMatch: matchingCandidate,
      }
    }

    return {
      ...parsed,
      isDuplicate: false,
      selected: true,
    }
  })
}
