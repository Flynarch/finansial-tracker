import { format } from 'date-fns'
import { getMergedExpenseTree } from './expenseCategories'
import { getMergedIncomeTree } from './incomeCategories'

/**
 * Fallback regex-based parser for when Gemini API is unavailable.
 * @param {string} text - User input
 * @param {string} defaultCurrency - Default currency (e.g. 'IDR')
 * @returns {object} { transactions: [], message: string, isOffline: true }
 */
export function parseOffline(text, defaultCurrency = 'IDR') {
  const lowerText = text.toLowerCase()
  
  // 1. Extract Amount
  // Matches: 35rb, 5jt, 50k, 100.000, 100000
  let amount = 0
  let matchedAmountStr = ''
  
  const amountRegex = /(\d+(?:\.\d+)?)\s*(rb|ribu|jt|juta|k)\b/i
  const amountMatch = lowerText.match(amountRegex)
  
  if (amountMatch) {
    const num = parseFloat(amountMatch[1].replace(/\./g, ''))
    const suffix = amountMatch[2].toLowerCase()
    matchedAmountStr = amountMatch[0]
    if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') amount = num * 1000
    else if (suffix === 'jt' || suffix === 'juta') amount = num * 1000000
  } else {
    // Try exact numbers with optional dots
    const exactNumRegex = /\b(\d{1,3}(?:\.\d{3})+|\d{4,})\b/
    const exactMatch = lowerText.match(exactNumRegex)
    if (exactMatch) {
      amount = parseInt(exactMatch[1].replace(/\./g, ''), 10)
      matchedAmountStr = exactMatch[0]
    }
  }
  
  if (amount <= 0) {
    return {
      transactions: [],
      message: 'Maaf, aku tidak menemukan jumlah uang yang valid.',
      isOffline: true
    }
  }

  // 2. Extract Type (Income vs Expense)
  const incomeKeywords = ['gaji', 'gajian', 'bonus', 'dikasih', 'thr', 'transfer masuk']
  const isIncome = incomeKeywords.some(kw => lowerText.includes(kw))
  const type = isIncome ? 'income' : 'expense'

  // 3. Extract Date
  let date = format(new Date(), 'yyyy-MM-dd')
  if (lowerText.includes('kemarin')) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    date = format(yesterday, 'yyyy-MM-dd')
  }

  // 4. Extract Category
  let category = isIncome ? 'lainnya' : 'lainnya_kategori/umum' // default
  
  if (isIncome) {
    const incomeTree = getMergedIncomeTree()
    if (lowerText.includes('gaji')) category = 'gaji'
    else if (lowerText.includes('bonus')) category = 'bonus'
    else if (lowerText.includes('bisnis')) category = 'bisnis'
    else if (lowerText.includes('investasi')) category = 'investasi'
    
    // Ensure category exists
    if (!incomeTree.find(c => c.id === category)) {
       category = incomeTree[0]?.id || 'lainnya'
    }
  } else {
    // Expense mapping heuristics
    const expenseMapping = {
      'makan': 'makanan/makan_siang',
      'kopi': 'makanan/minuman',
      'sarapan': 'makanan/makan_siang', // Close enough for offline
      'bensin': 'transportasi/ojol', // Assuming general transport
      'gojek': 'transportasi/ojol',
      'grab': 'transportasi/ojol',
      'belanja': 'kebutuhan_harian/dapur',
      'pulsa': 'kebutuhan_harian/elektronik',
      'listrik': 'kebutuhan_harian/peralatan',
      'obat': 'kesehatan/obat',
      'dokter': 'kesehatan/dokter',
      'nonton': 'kultur/film',
      'buku': 'kultur/buku',
    }
    
    for (const [kw, catPath] of Object.entries(expenseMapping)) {
      if (lowerText.includes(kw)) {
        category = catPath
        break
      }
    }
    
    // Validate if it exists in tree
    const tree = getMergedExpenseTree()
    const [parentId, childId] = category.split('/')
    const parent = tree.find(p => p.id === parentId)
    if (!parent || (childId && !(parent.children || []).find(s => s.id === childId))) {
       category = `${tree[0]?.id}/${tree[0]?.children?.[0]?.id}` // Fallback to first available
    }
  }

  // 5. Extract Notes
  // Remove the amount string from text to form the note
  let notes = text.replace(new RegExp(matchedAmountStr, 'i'), '').trim()
  // Clean up extra spaces
  notes = notes.replace(/\s+/g, ' ')
  
  if (!notes) {
    notes = isIncome ? 'Pemasukan' : 'Pengeluaran'
  }

  // Capitalize first letter
  notes = notes.charAt(0).toUpperCase() + notes.slice(1)

  return {
    transactions: [{
      type,
      category,
      amount,
      date,
      notes,
      currency: defaultCurrency
    }],
    message: '',
    isOffline: true
  }
}
