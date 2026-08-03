import { getExpenseCategoryColor, parseExpenseCategoryPath } from './expenseCategories'
import { getIncomeCategoryColor, normalizeIncomeCategoryId, parseIncomeCategoryPath } from './incomeCategories'

const EXPENSE_ICON_BY_PARENT = {
  makanan: 'food',
  makanan_minuman: 'food',
  tagihan: 'home',
  tagihan_utilitas: 'home',
  kehidupan_sosial: 'people',
  transportasi: 'transport',
  kultur: 'culture',
  hiburan: 'culture',
  kebutuhan_harian: 'home',
  pakaian: 'clothing',
  belanja: 'clothing',
  kecantikan: 'beauty',
  pendidikan: 'education',
  kesehatan: 'health',
  investasi_pengeluaran: 'investment',
  hadiah: 'gift',
  hilang: 'unknown',
  lainnya_kategori: 'other',
}

const INCOME_ICON_BY_ID = {
  gaji: 'salary',
  uang_jajan: 'wallet',
  bonus: 'bonus',
  bisnis: 'cash',
  kas_kecil: 'repayment',
  investasi: 'investment',
  lainnya: 'income',
}

export function resolveExpenseParentIconKey(parentId) {
  const pid = String(parentId || '').toLowerCase()
  return EXPENSE_ICON_BY_PARENT[pid] || 'food'
}

export function resolveIncomeParentIconKey(parentId) {
  const [pid] = String(parentId || '').split('/')
  return INCOME_ICON_BY_ID[pid] || 'income'
}

export function resolveIncomeCategoryIconKey(categoryId) {
  const normalized = normalizeIncomeCategoryId(categoryId)
  const [pid] = String(normalized || '').split('/')
  return INCOME_ICON_BY_ID[pid] || 'income'
}

export function resolveTransactionIconKey(category, type) {
  let catStr = category
  let typeStr = type
  if (category && typeof category === 'object') {
    catStr = category.category
    typeStr = category.type || type
  }

  if (typeStr === 'income') {
    return resolveIncomeCategoryIconKey(catStr)
  }

  const parsed = parseExpenseCategoryPath(catStr)
  if (parsed?.parentId) {
    const parentIcon = EXPENSE_ICON_BY_PARENT[parsed.parentId.toLowerCase()]
    if (parentIcon) return parentIcon
  }

  const raw = String(catStr || '').toLowerCase()
  if (EXPENSE_ICON_BY_PARENT[raw]) return EXPENSE_ICON_BY_PARENT[raw]

  const firstPart = raw.split('/')[0]
  if (EXPENSE_ICON_BY_PARENT[firstPart]) return EXPENSE_ICON_BY_PARENT[firstPart]

  if (raw.includes('food') || raw.includes('makan') || raw.includes('kopi') || raw.includes('minum') || raw.includes('resto')) return 'food'
  if (raw.includes('transport') || raw.includes('ojek') || raw.includes('bensin') || raw.includes('parkir') || raw.includes('travel')) return 'transport'
  if (raw.includes('tagihan') || raw.includes('bill') || raw.includes('listrik') || raw.includes('pulsa') || raw.includes('wifi')) return 'home'
  if (raw.includes('belanja') || raw.includes('pakaian') || raw.includes('baju') || raw.includes('sepatu')) return 'clothing'
  if (raw.includes('invest')) return 'investment'
  if (raw.includes('health') || raw.includes('obat') || raw.includes('sehat') || raw.includes('dokter')) return 'health'
  if (raw.includes('pendidikan') || raw.includes('sekolah') || raw.includes('kursus') || raw.includes('buku')) return 'education'
  if (raw.includes('hiburan') || raw.includes('nonton') || raw.includes('game') || raw.includes('sosial')) return 'culture'
  if (raw.includes('hadiah') || raw.includes('kado') || raw.includes('donasi')) return 'gift'

  return 'food'
}

export function getCategoryToneClass(tone) {
  switch (tone) {
    case 'amber':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
    case 'sky':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25'
    case 'indigo':
      return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25'
    case 'purple':
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25'
    case 'rose':
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
    case 'teal':
      return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25'
    case 'slate':
      return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25'
    case 'orange':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25'
    case 'pink':
      return 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/25'
    case 'yellow':
      return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25'
    default:
      return null
  }
}

export function getEffectiveCategoryTone(categoryId) {
  if (!categoryId) return 'orange'
  const custom = getExpenseCategoryColor(categoryId)
  if (custom) return custom

  const iconKey = resolveExpenseParentIconKey(categoryId)
  switch (iconKey) {
    case 'food':
      return 'amber'
    case 'transport':
      return 'sky'
    case 'people':
    case 'culture':
      return 'purple'
    case 'home':
      return 'teal'
    case 'clothing':
    case 'beauty':
      return 'pink'
    case 'education':
    case 'health':
      return 'indigo'
    case 'investment':
      return 'yellow'
    case 'gift':
    case 'bonus':
      return 'orange'
    case 'wallet':
    case 'cash':
      return 'emerald'
    case 'repayment':
      return 'sky'
    default:
      return 'orange'
  }
}

export function getEffectiveIncomeCategoryTone(categoryId) {
  if (!categoryId) return 'emerald'
  const custom = getIncomeCategoryColor(categoryId)
  if (custom) return custom
  const iconKey = resolveIncomeParentIconKey(categoryId)
  switch (iconKey) {
    case 'salary':
    case 'income':
      return 'emerald'
    case 'wallet':
    case 'cash':
      return 'teal'
    case 'bonus':
      return 'orange'
    case 'repayment':
      return 'sky'
    case 'investment':
      return 'yellow'
    default:
      return 'emerald'
  }
}

export function getCategoryColorClass(iconKey, type = 'expense', categoryId) {
  let realCategory = categoryId
  let realIconKey = iconKey
  let realType = type

  if (!categoryId && iconKey && typeof iconKey === 'string') {
    realCategory = iconKey
    realIconKey = resolveTransactionIconKey(iconKey, type)
  }

  if (realCategory) {
    const customColor = realType === 'expense' ? getExpenseCategoryColor(realCategory) : getIncomeCategoryColor(realCategory)
    if (customColor) {
      const toneClass = getCategoryToneClass(customColor)
      if (toneClass) return toneClass
    }
  }

  switch (realIconKey) {
    case 'food':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
    case 'transport':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25'
    case 'people':
    case 'culture':
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25'
    case 'home':
      return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25'
    case 'clothing':
    case 'beauty':
      return 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/25'
    case 'education':
    case 'health':
      return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25'
    case 'investment':
      return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25'
    case 'gift':
    case 'bonus':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25'
    case 'salary':
    case 'income':
      return 'ft-income-soft border border-[var(--status-income)]/25'
    case 'wallet':
    case 'cash':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
    case 'repayment':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
    default:
      if (realType === 'income') return 'ft-income-soft border border-[var(--status-income)]/25'
      if (realType === 'transfer') return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25'
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
  }
}

export function getTransactionCategoryLabels(rawCategory, txType, locale = 'id') {
  const lang = locale === 'en' ? 'en' : 'id'
  
  const formatFallback = (str) => {
    if (!str) return ''
    return String(str).replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (txType === 'expense') {
    const parsed = parseExpenseCategoryPath(rawCategory)
    if (parsed) {
      return {
        main: parsed.parent?.names?.[lang] || parsed.parent?.id || formatFallback(rawCategory),
        sub: parsed.child?.names?.[lang] || parsed.child?.id || null,
      }
    }
    
    // Fallback for missing/custom categories
    const parts = String(rawCategory || '').split('/')
    return { 
      main: formatFallback(parts[0]) || rawCategory, 
      sub: parts.length > 1 ? formatFallback(parts[1]) : null 
    }
  }

  if (txType === 'income') {
    const parsed = parseIncomeCategoryPath(rawCategory)
    if (parsed) {
      return {
        main: parsed.parent?.names?.[lang] || parsed.parent?.id || formatFallback(rawCategory),
        sub: parsed.child?.names?.[lang] || parsed.child?.id || null,
      }
    }

    if (typeof rawCategory === 'string' && rawCategory.startsWith('investasi/')) {
      const sub = rawCategory.split('/')[1] || 'investasi_lain'
      const subLabelMap = {
        emas: locale === 'en' ? 'Gold' : 'Emas',
        crypto: 'Crypto',
        saham: locale === 'en' ? 'Stock' : 'Saham',
        investasi_lain: locale === 'en' ? 'Other' : 'Lainnya',
      }
      return {
        main: locale === 'en' ? 'Investment' : 'Investasi',
        sub: subLabelMap[sub] || subLabelMap.investasi_lain,
      }
    }

    const parts = String(rawCategory || '').split('/')
    return { 
      main: formatFallback(parts[0]) || rawCategory, 
      sub: parts.length > 1 ? formatFallback(parts[1]) : null 
    }
  }

  // Fallback for transfer or other types
  const parts = String(rawCategory || '').split('/')
  return { 
    main: formatFallback(parts[0]) || rawCategory, 
    sub: parts.length > 1 ? formatFallback(parts[1]) : null 
  }
}

export function formatCategoryName(rawCategory, locale = 'id') {
  if (!rawCategory) return ''
  const lang = locale === 'en' ? 'en' : 'id'
  const parentId = String(rawCategory).split('/')[0].trim()
  
  const expenseParsed = parseExpenseCategoryPath(parentId)
  if (expenseParsed?.parent?.names?.[lang]) {
    return expenseParsed.parent.names[lang]
  }
  const incomeParsed = parseIncomeCategoryPath(parentId)
  if (incomeParsed?.parent?.names?.[lang]) {
    return incomeParsed.parent.names[lang]
  }

  return parentId
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}
