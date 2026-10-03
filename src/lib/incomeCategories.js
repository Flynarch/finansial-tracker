/**
 * Hierarchical income categories (parent / sub). Stored on transactions as `parentId/childId`.
 * User can hide built-in subs or add custom subs per parent; persisted in localStorage.
 */

const STORAGE_KEY = 'ft_income_category_custom_v1'

export const INCOME_TREE = [
  {
    id: 'gaji',
    icon: 'salary',
    names: { id: 'Gaji', en: 'Salary' },
    children: [
      { id: 'gaji_pokok', names: { id: 'Gaji Pokok', en: 'Basic Salary' } },
      { id: 'lembur', names: { id: 'Lembur', en: 'Overtime' } },
      { id: 'tunjangan', names: { id: 'Tunjangan', en: 'Allowance' } },
    ],
  },
  {
    id: 'uang_jajan',
    icon: 'wallet',
    names: { id: 'Uang Jajan', en: 'Pocket Money' },
    children: [
      { id: 'uang_saku', names: { id: 'Uang Saku', en: 'Allowance' } },
      { id: 'dikasih_orang', names: { id: 'Dikasih Orang', en: 'Given by someone' } },
    ],
  },
  {
    id: 'bonus',
    icon: 'bonus',
    names: { id: 'Bonus & THR', en: 'Bonus & THR' },
    children: [
      { id: 'thr', names: { id: 'THR', en: 'Holiday Allowance' } },
      { id: 'bonus_tahunan', names: { id: 'Bonus Tahunan', en: 'Annual Bonus' } },
      { id: 'hadiah', names: { id: 'Hadiah / Kado', en: 'Gift' } },
      { id: 'cashback', names: { id: 'Cashback', en: 'Cashback' } },
    ],
  },
  {
    id: 'bisnis',
    icon: 'briefcase',
    names: { id: 'Bisnis & Usaha', en: 'Business' },
    children: [
      { id: 'penjualan', names: { id: 'Penjualan', en: 'Sales' } },
      { id: 'freelance', names: { id: 'Freelance / Jasa', en: 'Freelance / Services' } },
      { id: 'komisi', names: { id: 'Komisi', en: 'Commission' } },
      { id: 'content_creator', names: { id: 'Content Creator', en: 'Content Creator' } },
    ],
  },
  {
    id: 'kas_kecil',
    icon: 'transfer',
    names: { id: 'Kas Kecil & Piutang', en: 'Petty Cash & Debt' },
    children: [
      { id: 'bayar_utang', names: { id: 'Dibayar Utang (Piutang)', en: 'Debt Repayment' } },
      { id: 'kembalian', names: { id: 'Kembalian', en: 'Change' } },
      { id: 'patungan', names: { id: 'Uang Patungan', en: 'Split bill' } },
    ],
  },
  {
    id: 'investasi',
    icon: 'crypto',
    names: { id: 'Investasi', en: 'Investment' },
    children: [
      { id: 'dividen', names: { id: 'Dividen', en: 'Dividend' } },
      { id: 'bunga_bank', names: { id: 'Bunga Bank / Deposito', en: 'Bank Interest' } },
      { id: 'cair_reksadana', names: { id: 'Pencairan Reksadana', en: 'Mutual Fund' } },
      { id: 'jual_saham', names: { id: 'Keuntungan Saham', en: 'Stock Profit' } },
      { id: 'jual_crypto', names: { id: 'Keuntungan Crypto', en: 'Crypto Profit' } },
    ],
  },
  {
    id: 'lainnya',
    icon: 'gift',
    names: { id: 'Lainnya', en: 'Other' },
    children: [
      { id: 'umum', names: { id: 'Umum', en: 'General' } },
      { id: 'menang_undian', names: { id: 'Menang Undian / Lomba', en: 'Lottery / Prize' } },
      { id: 'nemu_uang', names: { id: 'Nemu Uang', en: 'Found Money' } },
    ],
  },
]

export const INCOME_DEFAULTS = INCOME_TREE.map((p) => ({ id: p.id, names: p.names }))

const LEGACY_LABEL_TO_ID = {
  Salary: 'gaji',
  Investment: 'investasi',
  Other: 'lainnya',
}

export const INCOME_CATEGORY_CUSTOM_CHANGED_EVENT = 'ft-income-category-custom-changed'

let cachedCustom = null

if (typeof window !== 'undefined') {
  window.addEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, () => {
    cachedCustom = null
  })
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) cachedCustom = null
  })
}

function notifyChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT))
  }
}

function loadCustom() {
  if (cachedCustom !== null) return cachedCustom
  if (typeof localStorage === 'undefined') return { hidden: {}, extras: {}, colors: {}, parents: [], names: {}, icons: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedCustom = { hidden: {}, extras: {}, colors: {}, parents: [], names: {}, icons: {} }
      return cachedCustom
    }
    const data = JSON.parse(raw)
    cachedCustom = {
      hidden: data.hidden && !Array.isArray(data.hidden) && typeof data.hidden === 'object' ? data.hidden : {},
      extras: data.extras && !Array.isArray(data.extras) && typeof data.extras === 'object' ? data.extras : {},
      colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
      parents: Array.isArray(data.parents) ? data.parents : [],
      names: data.names && typeof data.names === 'object' ? data.names : {},
      icons: data.icons && typeof data.icons === 'object' ? data.icons : {},
    }
    return cachedCustom
  } catch (err){
      console.warn('[incomeCategories]', err)
    cachedCustom = { hidden: {}, extras: {}, colors: {}, parents: [], names: {}, icons: {} }
    return cachedCustom
  }
}

function saveCustom(data) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  cachedCustom = null
  notifyChanged()
}

export function resetIncomeCategoryCustomizations() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  cachedCustom = null
  notifyChanged()
}

const DEFAULT_INCOME_COLORS = {
  gaji: 'emerald',
  uang_jajan: 'amber',
  bonus: 'purple',
  bisnis: 'indigo',
  kas_kecil: 'teal',
  investasi: 'sky',
  lainnya: 'rose',
}

export function getMergedIncomeTree() {
  const { hidden = {}, extras = {}, colors = {}, parents = [], names = {}, icons = {} } = loadCustom()
  const baseTree = [...INCOME_TREE, ...parents]
  return baseTree
    .filter((parent) => parent.id !== 'investasi_pemasukan')
    .map((parent) => {
      const parentName = names[parent.id] || parent.names
      const parentIcon = icons[parent.id] || parent.icon || null
      const defaultColor = DEFAULT_INCOME_COLORS[parent.id] || 'emerald'
      const parentColor = colors[parent.id] || defaultColor
      const children = [
        ...(parent.children || []).filter((c) => !(hidden[parent.id] || []).includes(c.id)),
        ...(extras[parent.id] || []),
      ].map((child) => {
        const childName = names[`${parent.id}/${child.id}`] || child.names
        return {
          ...child,
          names: childName,
          color: colors[`${parent.id}/${child.id}`] || parentColor,
        }
      })
      return {
        ...parent,
        names: parentName,
        color: parentColor,
        icon: parentIcon,
        children,
      }
    })
}

export function getMergedIncomeCategories() {
  const tree = getMergedIncomeTree()
  const list = []
  for (const parent of tree) {
    list.push({ id: parent.id, names: parent.names })
    for (const child of parent.children || []) {
      list.push({ id: `${parent.id}/${child.id}`, names: child.names, color: child.color })
    }
  }
  return list
}

export function isBuiltinIncomeCategory(id) {
  return INCOME_TREE.some((c) => c.id === id) || INCOME_DEFAULTS.some((c) => c.id === id)
}

function parseIncomeCategoryPathWithTree(value, tree) {
  if (!value || typeof value !== 'string') return null
  if (!value.includes('/')) {
    const parent = tree.find((p) => p.id === value)
    if (!parent) {
      for (const p of tree) {
        const child = p.children?.find((c) => c.id === value)
        if (child) return { parentId: p.id, childId: child.id, parent: p, child }
      }
      return null
    }
    return { parentId: parent.id, childId: null, parent, child: null }
  }
  const [parentId, childId] = value.split('/')
  if (!parentId) return null
  const parent = tree.find((p) => p.id === parentId)
  if (!parent) return null
  if (!childId) return { parentId: parent.id, childId: null, parent, child: null }
  const child = parent.children.find((c) => c.id === childId)
  if (!child) return null
  return { parentId, childId: child.id, parent, child }
}

export function parseIncomeCategoryPath(value) {
  let parsed = parseIncomeCategoryPathWithTree(value, getMergedIncomeTree())
  if (!parsed) parsed = parseIncomeCategoryPathWithTree(value, INCOME_TREE)
  return parsed
}

export function normalizeIncomeCategoryId(stored) {
  if (!stored || typeof stored !== 'string' || !stored.trim()) return ''
  const parsed = parseIncomeCategoryPath(stored)
  if (parsed) {
    return parsed.childId ? `${parsed.parentId}/${parsed.childId}` : parsed.parentId
  }
  if (LEGACY_LABEL_TO_ID[stored]) return LEGACY_LABEL_TO_ID[stored]
  const lower = stored.toLowerCase()
  const hit = Object.entries(LEGACY_LABEL_TO_ID).find(([k]) => k.toLowerCase() === lower)
  if (hit) return hit[1]
  return stored
}

export function formatIncomeCategory(value, locale) {
  if (!value) return ''
  if (typeof value === 'string' && value.startsWith('investasi/')) {
    const sub = value.split('/')[1] || 'investasi_lain'
    const lang = locale === 'en' ? 'en' : 'id'
    const labelMap = {
      emas: { id: 'Investasi · Emas', en: 'Investment · Gold' },
      crypto: { id: 'Investasi · Crypto', en: 'Investment · Crypto' },
      saham: { id: 'Investasi · Saham', en: 'Investment · Stock' },
      investasi_lain: { id: 'Investasi · Lainnya', en: 'Investment · Other' },
    }
    return (labelMap[sub] || labelMap.investasi_lain)[lang]
  }
  const parsed = parseIncomeCategoryPath(value)
  if (!parsed) {
    return String(value)
      .split('/')
      .map((part) =>
        part
          .replace(/[_-]/g, ' ')
          .trim()
          .replace(/\b\w/g, (l) => l.toUpperCase())
      )
      .join(' · ')
  }
  const lang = locale === 'en' ? 'en' : 'id'
  const parentName = parsed.parent?.names?.[lang] || parsed.parent?.id || ''
  if (!parsed.child) {
    return parentName
  }
  const childName = parsed.child?.names?.[lang] || parsed.child?.id || ''
  return `${parentName} · ${childName}`
}

export function getDefaultIncomeCategoryId() {
  const tree = getMergedIncomeTree()
  for (const p of tree) {
    if (p.children?.length) return `${p.id}/${p.children[0].id}`
  }
  const fallback = INCOME_TREE.find((x) => x.children?.length)
  if (fallback) return `${fallback.id}/${fallback.children[0].id}`
  return 'gaji/gaji_bulanan'
}

export const getDefaultIncomeCategoryPath = getDefaultIncomeCategoryId

export function isValidIncomeCategoryPath(value) {
  return parseIncomeCategoryPathWithTree(value, getMergedIncomeTree()) !== null
}

export function getIncomeCategoryColor(categoryId) {
  if (!categoryId) return null
  const custom = loadCustom()
  if (custom.colors[categoryId]) return custom.colors[categoryId]
  const [pid] = String(categoryId).split('/')
  return custom.colors[pid] || DEFAULT_INCOME_COLORS[pid] || null
}

export function setIncomeCategoryColor(categoryId, colorKey) {
  if (!categoryId) return
  const custom = loadCustom()
  if (!colorKey) {
    delete custom.colors[categoryId]
  } else {
    custom.colors[categoryId] = colorKey
  }
  saveCustom(custom)
}

export function getIncomeCategoryIcon(categoryId) {
  if (!categoryId) return null
  const custom = loadCustom()
  if (custom.icons[categoryId]) return custom.icons[categoryId]
  const [pid] = String(categoryId).split('/')
  return custom.icons[pid] || null
}

export function setIncomeCategoryIcon(categoryId, iconKey) {
  if (!categoryId) return
  const custom = loadCustom()
  if (!iconKey) {
    delete custom.icons[categoryId]
  } else {
    custom.icons[categoryId] = iconKey
  }
  saveCustom(custom)
}

export function updateIncomeCategoryName(parentId, childId, nameId, nameEn) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return
  const en = String(nameEn || trimmed).trim() || trimmed
  const custom = loadCustom()
  const key = childId ? `${parentId}/${childId}` : parentId
  custom.names[key] = { id: trimmed, en }
  saveCustom(custom)
}

export function addIncomeParentCategory(nameId, nameEn, colorKey, iconKey) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return null
  const en = String(nameEn || trimmed).trim() || trimmed
  const tree = getMergedIncomeTree()
  const exists = tree.some((p) => {
    const pIdName = (p.names?.id || p.id || '').trim().toLowerCase()
    const pEnName = (p.names?.en || p.id || '').trim().toLowerCase()
    return pIdName === trimmed.toLowerCase() || pEnName === en.toLowerCase()
  })
  if (exists) return null

  const custom = loadCustom()
  const id = `ip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  custom.parents.push({ id, names: { id: trimmed, en }, children: [] })
  if (colorKey) custom.colors[id] = colorKey
  if (iconKey) custom.icons[id] = iconKey
  saveCustom(custom)
  return id
}

export function removeIncomeParentCategory(parentId) {
  const custom = loadCustom()
  custom.parents = custom.parents.filter((p) => p.id !== parentId)
  delete custom.colors[parentId]
  delete custom.icons[parentId]
  delete custom.extras[parentId]
  delete custom.hidden[parentId]
  delete custom.names[parentId]
  if (custom.names) {
    Object.keys(custom.names).forEach((k) => {
      if (k.startsWith(`${parentId}/`)) delete custom.names[k]
    })
  }
  saveCustom(custom)
}

export function isBuiltinIncomeChild(parentId, childId) {
  const p = INCOME_TREE.find((x) => x.id === parentId)
  return Boolean(p?.children.some((c) => c.id === childId))
}

export function addIncomeSubcategory(parentId, nameId, nameEn) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed || !parentId) return null
  const en = String(nameEn || trimmed).trim() || trimmed
  const tree = getMergedIncomeTree()
  const parent = tree.find((p) => p.id === parentId)
  if (parent?.children) {
    const exists = parent.children.some((c) => {
      const cIdName = (c.names?.id || c.id || '').trim().toLowerCase()
      const cEnName = (c.names?.en || c.id || '').trim().toLowerCase()
      return cIdName === trimmed.toLowerCase() || cEnName === en.toLowerCase()
    })
    if (exists) return null
  }

  const custom = loadCustom()
  let id = null
  if (isBuiltinIncomeCategory(parentId) || INCOME_TREE.some((x) => x.id === parentId)) {
    const list = custom.extras[parentId] || []
    id = `isub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    list.push({ id, names: { id: trimmed, en } })
    custom.extras[parentId] = list
  } else {
    const p = custom.parents.find((item) => item.id === parentId)
    if (p) {
      id = `isub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      p.children.push({ id, names: { id: trimmed, en } })
    }
  }
  saveCustom(custom)
  return id
}

export function removeIncomeSubcategory(parentId, childId) {
  if (!parentId || !childId) return
  const custom = loadCustom()
  if (isBuiltinIncomeChild(parentId, childId)) {
    const list = custom.hidden[parentId] || []
    if (!list.includes(childId)) list.push(childId)
    custom.hidden[parentId] = list
  } else {
    if (custom.extras[parentId]) {
      custom.extras[parentId] = custom.extras[parentId].filter((c) => c.id !== childId)
    }
    const parent = custom.parents.find((p) => p.id === parentId)
    if (parent && parent.children) {
      parent.children = parent.children.filter((c) => c.id !== childId)
    }
  }
  saveCustom(custom)
}

export function removeIncomeCategory(id) {
  if (!id) return
  if (id.includes('/')) {
    const [pid, cid] = id.split('/')
    removeIncomeSubcategory(pid, cid)
  } else {
    removeIncomeParentCategory(id)
  }
}

export function addIncomeCategory(nameId, nameEn) {
  addIncomeParentCategory(nameId, nameEn)
}
