import { getMergedExpenseTree, parseExpenseCategoryPath } from './expenseCategories'
import { getMergedIncomeCategories, parseIncomeCategoryPath } from './incomeCategories'

/**
 * Normalizes any category input (from AI, raw text, or legacy data) into a canonical
 * category path (e.g., 'makanan/makan_siang', 'transportasi/bensin', 'gaji/gaji_pokok').
 *
 * @param {string} input - The raw category string from AI or user
 * @param {'income'|'expense'|'transfer'} type - Transaction type
 * @returns {string} Canonical category path
 */
export function sanitizeCategoryPath(input, type = 'expense') {
  if (type === 'transfer') return 'transfer/umum'
  if (!input || typeof input !== 'string') {
    return type === 'income' ? 'gaji/gaji_pokok' : 'makanan/makan_siang'
  }

  const raw = input.trim()
  if (!raw) return type === 'income' ? 'gaji/gaji_pokok' : 'makanan/makan_siang'

  // 1. First check if it's already a valid path (e.g. 'makanan/makan_siang' or 'makanan')
  if (type === 'income') {
    const parsed = parseIncomeCategoryPath(raw)
    if (parsed) {
      return parsed.childId ? `${parsed.parentId}/${parsed.childId}` : `${parsed.parentId}/umum`
    }
  } else {
    const parsed = parseExpenseCategoryPath(raw)
    if (parsed) {
      return parsed.childId ? `${parsed.parentId}/${parsed.childId}` : `${parsed.parentId}/makan_siang`
    }
  }

  // 2. Fuzzy match against names and IDs in the category tree
  const lower = raw.toLowerCase().replace(/[_-\s]+/g, ' ')

  if (type === 'income') {
    const tree = getMergedIncomeCategories()
    for (const item of tree) {
      const idLower = item.id.toLowerCase().replace(/[_-\s]+/g, ' ')
      const nameIdLower = (item.names?.id || '').toLowerCase()
      const nameEnLower = (item.names?.en || '').toLowerCase()

      if (
        idLower === lower ||
        nameIdLower === lower ||
        nameEnLower === lower ||
        lower.includes(nameIdLower) ||
        (nameIdLower && nameIdLower.includes(lower))
      ) {
        return item.id.includes('/') ? item.id : `${item.id}/gaji_pokok`
      }
    }

    // Keyword mapping fallback for income
    if (lower.includes('gaji') || lower.includes('salary') || lower.includes('paycheck')) return 'gaji/gaji_pokok'
    if (lower.includes('bonus') || lower.includes('thr') || lower.includes('hadiah')) return 'bonus/thr'
    if (lower.includes('freelance') || lower.includes('proyek') || lower.includes('bisnis') || lower.includes('jasa')) return 'bisnis/freelance'
    if (lower.includes('invest') || lower.includes('dividen') || lower.includes('crypto') || lower.includes('saham')) return 'investasi/dividen'
    if (lower.includes('utang') || lower.includes('patungan') || lower.includes('kembalian')) return 'kas_kecil/bayar_utang'

    return 'gaji/gaji_pokok'
  }

  // Expense fuzzy matching using getMergedExpenseTree
  const expenseTree = getMergedExpenseTree()
  for (const parent of expenseTree) {
    const pIdLower = parent.id.toLowerCase()
    const pNameId = (parent.names?.id || '').toLowerCase()

    if (pIdLower === lower || pNameId === lower || lower.includes(pIdLower) || lower.includes(pNameId)) {
      const firstChildId = parent.children?.[0]?.id || 'umum'
      return `${parent.id}/${firstChildId}`
    }

    for (const child of parent.children || []) {
      const cIdLower = child.id.toLowerCase()
      const cNameId = (child.names?.id || '').toLowerCase()
      const cNameEn = (child.names?.en || '').toLowerCase()

      if (
        cIdLower === lower ||
        cNameId === lower ||
        cNameEn === lower ||
        lower.includes(cNameId) ||
        (cNameId && cNameId.includes(lower))
      ) {
        return `${parent.id}/${child.id}`
      }
    }
  }

  // Comprehensive keyword mapping for expense categories
  if (lower.includes('kopi') || lower.includes('coffee') || lower.includes('cafe') || lower.includes('kafe') || lower.includes('starbucks')) return 'makanan/kopi'
  if (lower.includes('siang') || lower.includes('lunch')) return 'makanan/makan_siang'
  if (lower.includes('malam') || lower.includes('dinner')) return 'makanan/makan_malam'
  if (lower.includes('makan') || lower.includes('food') || lower.includes('resto') || lower.includes('kuliner') || lower.includes('sate') || lower.includes('bakso') || lower.includes('nasi')) return 'makanan/makan_siang'
  if (lower.includes('bensin') || lower.includes('pertamax') || lower.includes('pertalite') || lower.includes('bbm') || lower.includes('shell') || lower.includes('fuel')) return 'transportasi/bensin'
  if (lower.includes('gojek') || lower.includes('grab') || lower.includes('ojol') || lower.includes('maxim')) return 'transportasi/ojol'
  if (lower.includes('parkir') || lower.includes('parking') || lower.includes('tol')) return 'transportasi/parkir'
  if (lower.includes('transport') || lower.includes('taksi') || lower.includes('kereta') || lower.includes('bus')) return 'transportasi/bensin'
  if (lower.includes('listrik') || lower.includes('pln') || lower.includes('token')) return 'tagihan/listrik'
  if (lower.includes('air') || lower.includes('pdam')) return 'tagihan/air'
  if (lower.includes('wifi') || lower.includes('indihome') || lower.includes('biznet') || lower.includes('internet')) return 'tagihan/internet'
  if (lower.includes('pulsa') || lower.includes('kuota') || lower.includes('paket data') || lower.includes('telkomsel') || lower.includes('indosat')) return 'tagihan/paket_data'
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('youtube') || lower.includes('langganan') || lower.includes('subscrip')) return 'tagihan/langganan'
  if (lower.includes('supermarket') || lower.includes('indomaret') || lower.includes('alfamart') || lower.includes('grocer') || lower.includes('sayur') || lower.includes('beras')) return 'kebutuhan_harian/belanja_bulanan'
  if (lower.includes('baju') || lower.includes('pakaian') || lower.includes('sepatu') || lower.includes('fashion') || lower.includes('shopping') || lower.includes('belanja')) return 'belanja/pakaian'
  if (lower.includes('elektronik') || lower.includes('hp') || lower.includes('gadget') || lower.includes('laptop')) return 'belanja/elektronik'
  if (lower.includes('nonton') || lower.includes('bioskop') || lower.includes('xxi') || lower.includes('game') || lower.includes('steam')) return 'hiburan/nonton'
  if (lower.includes('dokter') || lower.includes('obat') || lower.includes('apotek') || lower.includes('sehat') || lower.includes('klinik')) return 'kesehatan/obat'
  if (lower.includes('sekolah') || lower.includes('kursus') || lower.includes('buku') || lower.includes('kuliah')) return 'pendidikan/kursus'
  if (lower.includes('sedekah') || lower.includes('zakat') || lower.includes('donasi') || lower.includes('kado')) return 'hadiah/sedekah'

  return 'lainnya_kategori/umum'
}
