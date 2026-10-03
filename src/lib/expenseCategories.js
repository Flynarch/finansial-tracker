/**
 * Hierarchical expense categories (parent / sub). Stored on transactions as `parentId/childId`.
 * User can hide built-in subs or add custom subs per parent; persisted in localStorage.
 */

const STORAGE_KEY = 'ft_expense_category_custom_v1'

export const EXPENSE_TREE = [
  {
    id: 'makanan',
    icon: 'food',
    names: { id: 'Makanan', en: 'Food' },
    children: [
      { id: 'makan_siang', names: { id: 'Makan siang', en: 'Lunch' } },
      { id: 'makan_malam', names: { id: 'Makan malam', en: 'Dinner' } },
      { id: 'sarapan', names: { id: 'Sarapan', en: 'Breakfast' } },
      { id: 'makan_diluar', names: { id: 'Makan diluar', en: 'Dining out' } },
      { id: 'kopi', names: { id: 'Kopi & Teh', en: 'Coffee & Tea' } },
      { id: 'minuman', names: { id: 'Minuman', en: 'Drinks' } },
      { id: 'jajan', names: { id: 'Jajan', en: 'Snacks' } },
    ],
  },
  {
    id: 'tagihan',
    icon: 'zap',
    names: { id: 'Tagihan & Utilitas', en: 'Bills & Utilities' },
    children: [
      { id: 'listrik', names: { id: 'Listrik', en: 'Electricity' } },
      { id: 'air', names: { id: 'Air', en: 'Water' } },
      { id: 'internet', names: { id: 'Internet / WiFi', en: 'Internet / WiFi' } },
      { id: 'paket_data', names: { id: 'Paket Data / Pulsa', en: 'Mobile Data' } },
      { id: 'langganan', names: { id: 'Langganan (Netflix, dll)', en: 'Subscriptions' } },
      { id: 'asuransi', names: { id: 'Asuransi', en: 'Insurance' } },
      { id: 'cicilan', names: { id: 'Cicilan', en: 'Installments' } },
    ],
  },
  {
    id: 'kebutuhan_harian',
    icon: 'shopping',
    names: { id: 'Kebutuhan Harian', en: 'Daily Needs' },
    children: [
      { id: 'belanja_bulanan', names: { id: 'Belanja Bulanan', en: 'Groceries' } },
      { id: 'peralatan_rumah', names: { id: 'Peralatan Rumah', en: 'Household' } },
      { id: 'perlengkapan_mandi', names: { id: 'Perlengkapan Mandi', en: 'Toiletries' } },
      { id: 'laundry', names: { id: 'Laundry', en: 'Laundry' } },
      { id: 'hewan_peliharaan', names: { id: 'Hewan Peliharaan', en: 'Pets' } },
    ],
  },
  {
    id: 'transportasi',
    icon: 'transport',
    names: { id: 'Transportasi', en: 'Transport' },
    children: [
      { id: 'bensin', names: { id: 'Bensin', en: 'Fuel' } },
      { id: 'parkir', names: { id: 'Parkir', en: 'Parking' } },
      { id: 'tol', names: { id: 'Tol', en: 'Toll' } },
      { id: 'ojol', names: { id: 'Gojek / Grab', en: 'Ride-hail' } },
      { id: 'taksi', names: { id: 'Taksi', en: 'Taxi' } },
      { id: 'kereta', names: { id: 'Kereta / KRL', en: 'Train' } },
      { id: 'bis', names: { id: 'Bis / TransJakarta', en: 'Bus' } },
      { id: 'servis_kendaraan', names: { id: 'Servis Kendaraan', en: 'Vehicle Maintenance' } },
    ],
  },
  {
    id: 'kehidupan_sosial',
    icon: 'people',
    names: { id: 'Kehidupan Sosial', en: 'Social Life' },
    children: [
      { id: 'kumpul_teman', names: { id: 'Nongkrong', en: 'Hangout' } },
      { id: 'hobi', names: { id: 'Hobi', en: 'Hobby' } },
      { id: 'kencan', names: { id: 'Kencan', en: 'Dating' } },
      { id: 'amal_donasi', names: { id: 'Amal / Sedekah', en: 'Charity / Donation' } },
      { id: 'kondangan', names: { id: 'Kondangan / Hadiah', en: 'Gifts / Wedding' } },
      { id: 'iuran', names: { id: 'Iuran', en: 'Dues' } },
    ],
  },
  {
    id: 'kultur',
    icon: 'film',
    names: { id: 'Hiburan', en: 'Entertainment' },
    children: [
      { id: 'bioskop', names: { id: 'Bioskop', en: 'Movies / Cinema' } },
      { id: 'konser', names: { id: 'Konser / Event', en: 'Concerts / Events' } },
      { id: 'games', names: { id: 'Games', en: 'Games' } },
      { id: 'buku', names: { id: 'Buku', en: 'Books' } },
      { id: 'liburan', names: { id: 'Liburan', en: 'Vacation' } },
    ],
  },
  {
    id: 'pakaian',
    icon: 'clothing',
    names: { id: 'Pakaian & Fashion', en: 'Clothing & Fashion' },
    children: [
      { id: 'baju', names: { id: 'Baju', en: 'Clothes' } },
      { id: 'celana', names: { id: 'Celana', en: 'Pants' } },
      { id: 'sepatu', names: { id: 'Sepatu', en: 'Shoes' } },
      { id: 'aksesoris_pakaian', names: { id: 'Aksesoris', en: 'Accessories' } },
    ],
  },
  {
    id: 'kecantikan',
    icon: 'beauty',
    names: { id: 'Kecantikan & Perawatan', en: 'Beauty & Care' },
    children: [
      { id: 'skincare', names: { id: 'Skincare', en: 'Skincare' } },
      { id: 'makeup', names: { id: 'Makeup', en: 'Makeup' } },
      { id: 'salon', names: { id: 'Salon / Barbershop', en: 'Salon / Barbershop' } },
      { id: 'parfum', names: { id: 'Parfum', en: 'Perfume' } },
    ],
  },
  {
    id: 'pendidikan',
    icon: 'education',
    names: { id: 'Pendidikan', en: 'Education' },
    children: [
      { id: 'sekolah', names: { id: 'Sekolah / Kuliah', en: 'School / College' } },
      { id: 'kursus', names: { id: 'Kursus / Pelatihan', en: 'Courses' } },
      { id: 'buku_pelajaran', names: { id: 'Buku Pelajaran', en: 'Textbooks' } },
      { id: 'alat_tulis', names: { id: 'Alat Tulis', en: 'Stationery' } },
    ],
  },
  {
    id: 'kesehatan',
    icon: 'health',
    names: { id: 'Kesehatan', en: 'Health' },
    children: [
      { id: 'dokter', names: { id: 'Dokter', en: 'Doctor' } },
      { id: 'obat', names: { id: 'Obat', en: 'Medicine' } },
      { id: 'vitamin', names: { id: 'Vitamin', en: 'Vitamins' } },
      { id: 'gym', names: { id: 'Gym / Olahraga', en: 'Gym / Sports' } },
      { id: 'asuransi_kesehatan', names: { id: 'Asuransi Kesehatan', en: 'Health Insurance' } },
    ],
  },
  {
    id: 'investasi_pengeluaran',
    icon: 'investment',
    names: { id: 'Investasi', en: 'Investment' },
    children: [
      { id: 'emas', names: { id: 'Emas', en: 'Gold' } },
      { id: 'reksadana', names: { id: 'Reksadana', en: 'Mutual Funds' } },
      { id: 'saham', names: { id: 'Saham', en: 'Stocks' } },
      { id: 'crypto', names: { id: 'Crypto', en: 'Crypto' } },
      { id: 'deposito', names: { id: 'Deposito', en: 'Deposit' } },
      { id: 'investasi_lain', names: { id: 'Lainnya', en: 'Other' } },
    ],
  },
  {
    id: 'lainnya_kategori',
    icon: 'other',
    names: { id: 'Lainnya', en: 'Other' },
    children: [
      { id: 'umum', names: { id: 'Umum', en: 'General' } },
      { id: 'pajak', names: { id: 'Pajak', en: 'Taxes' } },
      { id: 'denda', names: { id: 'Denda / Tilang', en: 'Fines' } },
      { id: 'hilang', names: { id: 'Uang Hilang', en: 'Lost Money' } },
    ],
  },
]

export const EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT = 'ft-expense-category-custom-changed'

let cachedCustom = null

if (typeof window !== 'undefined') {
  window.addEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, () => {
    cachedCustom = null
  })
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) cachedCustom = null
  })
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
      hidden: data.hidden && typeof data.hidden === 'object' ? data.hidden : {},
      extras: data.extras && typeof data.extras === 'object' ? data.extras : {},
      colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
      parents: Array.isArray(data.parents) ? data.parents : [],
      names: data.names && typeof data.names === 'object' ? data.names : {},
      icons: data.icons && typeof data.icons === 'object' ? data.icons : {},
    }
    return cachedCustom
  } catch (err){
      console.warn('[expenseCategories]', err)
    cachedCustom = { hidden: {}, extras: {}, colors: {}, parents: [], names: {}, icons: {} }
    return cachedCustom
  }
}

function notifyExpenseCategoryCustomChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT))
  }
}

function saveCustom(data) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  cachedCustom = null
  notifyExpenseCategoryCustomChanged()
}

/** Mengembalikan daftar pengeluaran ke bawaan: semua sub ditampilkan lagi, sub kustom dihapus. Transaksi tidak diubah. */
export function resetExpenseCategoryCustomizations() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  cachedCustom = null
  notifyExpenseCategoryCustomChanged()
}

const DEFAULT_EXPENSE_COLORS = {
  makanan: 'amber',
  tagihan: 'sky',
  kebutuhan_harian: 'emerald',
  transportasi: 'indigo',
  kehidupan_sosial: 'purple',
  kultur: 'rose',
  pakaian: 'teal',
  kecantikan: 'rose',
  pendidikan: 'indigo',
  kesehatan: 'emerald',
  investasi_pengeluaran: 'sky',
  lainnya_kategori: 'slate',
}

/** Merged tree: defaults minus hidden subs, plus user-added subs per parent, custom parents, custom names & colors. */
export function getMergedExpenseTree() {
  const { hidden = {}, extras = {}, colors = {}, parents = [], names = {}, icons = {} } = loadCustom()
  const baseTree = [...EXPENSE_TREE, ...parents]
  return baseTree
    .filter((parent) => parent.id !== 'investasi_pengeluaran')
    .map((parent) => {
      const parentName = names[parent.id] || parent.names
      const parentIcon = icons[parent.id] || parent.icon || null
      const defaultColor = DEFAULT_EXPENSE_COLORS[parent.id] || 'sky'
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

export function getExpenseCategoryColor(categoryId) {
  if (!categoryId) return null
  const custom = loadCustom()
  if (custom.colors[categoryId]) return custom.colors[categoryId]
  const [pid] = String(categoryId).split('/')
  return custom.colors[pid] || DEFAULT_EXPENSE_COLORS[pid] || null
}

export function setExpenseCategoryColor(categoryId, colorKey) {
  if (!categoryId) return
  const custom = loadCustom()
  if (!colorKey) {
    delete custom.colors[categoryId]
  } else {
    custom.colors[categoryId] = colorKey
  }
  saveCustom(custom)
}

export function getExpenseCategoryIcon(categoryId) {
  if (!categoryId) return null
  const custom = loadCustom()
  if (custom.icons[categoryId]) return custom.icons[categoryId]
  const [pid] = String(categoryId).split('/')
  return custom.icons[pid] || null
}

export function setExpenseCategoryIcon(categoryId, iconKey) {
  if (!categoryId) return
  const custom = loadCustom()
  if (!iconKey) {
    delete custom.icons[categoryId]
  } else {
    custom.icons[categoryId] = iconKey
  }
  saveCustom(custom)
}

export function updateExpenseCategoryName(parentId, childId, nameId, nameEn) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return
  const en = String(nameEn || trimmed).trim() || trimmed
  const custom = loadCustom()
  const key = childId ? `${parentId}/${childId}` : parentId
  custom.names[key] = { id: trimmed, en }
  saveCustom(custom)
}

export function addExpenseParentCategory(nameId, nameEn, colorKey, iconKey) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return null
  const en = String(nameEn || trimmed).trim() || trimmed
  const tree = getMergedExpenseTree()
  const exists = tree.some((p) => {
    const pIdName = (p.names?.id || p.id || '').trim().toLowerCase()
    const pEnName = (p.names?.en || p.id || '').trim().toLowerCase()
    return pIdName === trimmed.toLowerCase() || pEnName === en.toLowerCase()
  })
  if (exists) return null

  const custom = loadCustom()
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  custom.parents.push({ id, names: { id: trimmed, en }, children: [] })
  if (colorKey) custom.colors[id] = colorKey
  if (iconKey) custom.icons[id] = iconKey
  saveCustom(custom)
  return id
}

export function removeExpenseParentCategory(parentId) {
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

export function isBuiltinExpenseChild(parentId, childId) {
  const p = EXPENSE_TREE.find((x) => x.id === parentId)
  return Boolean(p?.children.some((c) => c.id === childId))
}

export function addExpenseSubcategory(parentId, nameId, nameEn) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return null
  const en = String(nameEn || trimmed).trim() || trimmed
  const tree = getMergedExpenseTree()
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
  if (!custom.extras[parentId]) custom.extras[parentId] = []
  const id = `x_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  custom.extras[parentId].push({ id, names: { id: trimmed, en } })
  saveCustom(custom)
  return id
}

export function removeExpenseSubcategory(parentId, childId) {
  const custom = loadCustom()
  if (isBuiltinExpenseChild(parentId, childId)) {
    if (!custom.hidden[parentId]) custom.hidden[parentId] = []
    if (!custom.hidden[parentId].includes(childId)) custom.hidden[parentId].push(childId)
  } else {
    custom.extras[parentId] = (custom.extras[parentId] || []).filter((c) => c.id !== childId)
  }
  saveCustom(custom)
}

function parseExpenseCategoryPathWithTree(value, tree) {
  if (!value || typeof value !== 'string') return null
  if (!value.includes('/')) {
    const parent = tree.find((p) => p.id === value)
    if (!parent) return null
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

export function parseExpenseCategoryPath(value) {
  let parsed = parseExpenseCategoryPathWithTree(value, getMergedExpenseTree())
  if (!parsed) parsed = parseExpenseCategoryPathWithTree(value, EXPENSE_TREE)
  return parsed
}

export function formatExpenseCategory(value, locale) {
  if (!value) return ''
  const cleanWord = (s) =>
    String(s ?? '')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (l) => l.toUpperCase())

  const parsed = parseExpenseCategoryPath(value)
  if (!parsed) {
    return String(value)
      .split('/')
      .map(cleanWord)
      .filter(Boolean)
      .join(' · ')
  }
  const lang = locale === 'en' ? 'en' : 'id'
  const parentName = cleanWord(parsed.parent?.names?.[lang] || parsed.parent?.names?.id || parsed.parent?.id || '')
  if (!parsed.child) {
    return parentName
  }
  const childName = cleanWord(parsed.child?.names?.[lang] || parsed.child?.names?.id || parsed.child?.id || '')
  return `${parentName} · ${childName}`
}

export function getDefaultExpenseCategoryPath() {
  const tree = getMergedExpenseTree()
  for (const p of tree) {
    if (p.children?.length) return `${p.id}/${p.children[0].id}`
  }
  const fallback = EXPENSE_TREE.find((x) => x.children?.length)
  if (fallback) return `${fallback.id}/${fallback.children[0].id}`
  return 'lainnya_kategori/umum'
}

export function isValidExpenseCategoryPath(value) {
  return parseExpenseCategoryPathWithTree(value, getMergedExpenseTree()) !== null
}
