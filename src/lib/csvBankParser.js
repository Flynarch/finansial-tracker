import { parse, format } from 'date-fns'

/**
 * Parses raw CSV text into rows of columns.
 *
 * @param {string} csvText
 * @returns {string[][]}
 */
export function parseCsvRows(csvText) {
  if (!csvText || typeof csvText !== 'string') return []

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
    // Basic CSV parser handling quoted comma values
    const row = []
    let inQuotes = false
    let currentCell = ''

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if ((char === ',' || char === ';') && !inQuotes) {
        row.push(currentCell.trim().replace(/^"(.*)"$/, '$1'))
        currentCell = ''
      } else {
        currentCell += char
      }
    }
    row.push(currentCell.trim().replace(/^"(.*)"$/, '$1'))
    return row
  })
}

/**
 * Auto-detects bank format from CSV header.
 *
 * @param {string[]} headerRow
 * @returns {'bca' | 'mandiri' | 'jenius' | 'gopay' | 'generic'}
 */
export function detectBankFormat(headerRow = []) {
  const headerStr = headerRow.join(' ').toLowerCase()

  if (headerStr.includes('keterangan') && (headerStr.includes('db/cr') || headerStr.includes('mutasi'))) {
    return 'bca'
  }
  if (headerStr.includes('debet') && headerStr.includes('kredit')) {
    return 'mandiri'
  }
  if (headerStr.includes('jenius') || (headerStr.includes('transaction date') && headerStr.includes('note'))) {
    return 'jenius'
  }
  if (headerStr.includes('gopay') || (headerStr.includes('tipe transaksi') && headerStr.includes('status'))) {
    return 'gopay'
  }
  return 'generic'
}

/**
 * Normalizes parsed rows into FinTrack transaction structures.
 *
 * @param {string[][]} rows
 * @param {object} columnMapping
 * @returns {Array<{ date: string, amount: number, type: 'expense'|'income', notes: string, rawRow: string[] }>}
 */
export function normalizeBankRows(rows, columnMapping) {
  if (!rows || rows.length <= 1) return []

  const dataRows = rows.slice(1)
  const results = []

  for (const row of dataRows) {
    if (!row || row.length === 0) continue

    const rawDate = row[columnMapping.dateIndex] || ''
    const rawNotes = row[columnMapping.notesIndex] || 'Bank Transaction'
    let rawAmount = row[columnMapping.amountIndex] || '0'
    let txType = 'expense'

    // Clean numeric string (handle Indonesian dot/comma thousand/decimal formatting)
    const cleanAmountStr = String(rawAmount)
      .replace(/[^0-9.,-]/g, '')
      .replace(/\.(?=\d{3})/g, '') // remove thousand dots
      .replace(',', '.') // replace decimal comma

    let amount = Math.abs(parseFloat(cleanAmountStr) || 0)
    if (amount <= 0) continue

    // Determine type (DB vs CR / positive vs negative)
    if (columnMapping.typeIndex !== undefined && row[columnMapping.typeIndex]) {
      const typeStr = String(row[columnMapping.typeIndex]).toLowerCase()
      if (typeStr.includes('cr') || typeStr.includes('kredit') || typeStr.includes('masuk') || typeStr.includes('income')) {
        txType = 'income'
      } else {
        txType = 'expense'
      }
    } else if (cleanAmountStr.startsWith('-')) {
      txType = 'expense'
    }

    // Try parsing date formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
    let parsedDate = format(new Date(), 'yyyy-MM-dd')
    try {
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/')
        if (parts[0].length === 4) {
          parsedDate = rawDate.replace(/\//g, '-')
        } else {
          // DD/MM/YYYY
          const d = parse(rawDate, 'dd/MM/yyyy', new Date())
          if (!Number.isNaN(d.getTime())) parsedDate = format(d, 'yyyy-MM-dd')
        }
      } else if (rawDate.includes('-')) {
        const parts = rawDate.split('-')
        if (parts[0].length === 4) {
          parsedDate = rawDate
        } else {
          // DD-MM-YYYY
          const d = parse(rawDate, 'dd-MM-yyyy', new Date())
          if (!Number.isNaN(d.getTime())) parsedDate = format(d, 'yyyy-MM-dd')
        }
      }
    } catch {
      parsedDate = format(new Date(), 'yyyy-MM-dd')
    }

    results.push({
      date: parsedDate,
      amount,
      type: txType,
      notes: rawNotes,
      category: txType === 'income' ? 'pendapatan/lainnya' : 'lainnya',
      rawRow: row,
    })
  }

  return results
}
