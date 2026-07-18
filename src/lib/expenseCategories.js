/**
 * Hierarchical expense categories (parent / sub). Stored on transactions as `parentId/childId`.
 * User can hide built-in subs or add custom subs per parent; persisted in localStorage.
 */

const STORAGE_KEY = 'ft_expense_category_custom_v1'

export const EXPENSE_TREE = [
  {
    id: 'makanan',
    names: { id: 'Makanan', en: 'Food' },
    children: [
      { id: 'makan_siang', names: { id: 'Makan siang', en: 'Lunch' } },
      { id: 'makan_sore', names: { id: 'Makan sore', en: 'Afternoon meal' } },
      { id: 'makan_malam', names: { id: 'Makan malam', en: 'Dinner' } },
      { id: 'makan_diluar', names: { id: 'Makan diluar', en: 'Dining out' } },
      { id: 'minuman', names: { id: 'Minuman', en: 'Drinks' } },
      { id: 'jajan', names: { id: 'Jajan', en: 'Snacks' } },
    ],
  },
  {
    id: 'kehidupan_sosial',
    names: { id: 'Kehidupan sosial', en: 'Social life' },
    children: [
      { id: 'teman', names: { id: 'Teman', en: 'Friends' } },
      { id: 'hobi', names: { id: 'Hobi', en: 'Hobby' } },
      { id: 'alumni', names: { id: 'Alumni', en: 'Alumni' } },
      { id: 'iuran', names: { id: 'Iuran', en: 'Dues' } },
      { id: 'dipinjam', names: { id: 'Di pinjam', en: 'Lent / borrowed' } },
    ],
  },
  {
    id: 'transportasi',
    names: { id: 'Transportasi', en: 'Transport' },
    children: [
      { id: 'bis', names: { id: 'Bis', en: 'Bus' } },
      { id: 'kereta', names: { id: 'Kereta', en: 'Train' } },
      { id: 'taksi', names: { id: 'Taksi', en: 'Taxi' } },
      { id: 'ojol', names: { id: 'Gojek/Grab', en: 'Ride-hail' } },
      { id: 'angkot', names: { id: 'Angkot', en: 'Minivan' } },
    ],
  },
  {
    id: 'kultur',
    names: { id: 'Kultur', en: 'Culture' },
    children: [
      { id: 'buku', names: { id: 'Buku', en: 'Books' } },
      { id: 'film', names: { id: 'Film', en: 'Movies' } },
      { id: 'musik', names: { id: 'Musik', en: 'Music' } },
      { id: 'aplikasi', names: { id: 'Aplikasi', en: 'Apps' } },
    ],
  },
  {
    id: 'kebutuhan_harian',
    names: { id: 'Kebutuhan harian', en: 'Daily needs' },
    children: [
      { id: 'peralatan', names: { id: 'Peralatan', en: 'Equipment' } },
      { id: 'furnitur', names: { id: 'Furnitur', en: 'Furniture' } },
      { id: 'dapur', names: { id: 'Dapur', en: 'Kitchen' } },
      { id: 'perlengkapan_mandi', names: { id: 'Perlengkapan mandi', en: 'Toiletries' } },
      { id: 'elektronik', names: { id: 'Elektronik', en: 'Electronics' } },
    ],
  },
  {
    id: 'pakaian',
    names: { id: 'Pakaian', en: 'Clothing' },
    children: [
      { id: 'baju', names: { id: 'Baju', en: 'Clothes' } },
      { id: 'fashion', names: { id: 'Fashion', en: 'Fashion' } },
      { id: 'sepatu', names: { id: 'Sepatu', en: 'Shoes' } },
      { id: 'laundri', names: { id: 'Laundri', en: 'Laundry' } },
    ],
  },
  {
    id: 'kecantikan',
    names: { id: 'Kecantikan', en: 'Beauty' },
    children: [
      { id: 'kosmetik', names: { id: 'Kosmetik', en: 'Cosmetics' } },
      { id: 'makeup', names: { id: 'Makeup', en: 'Makeup' } },
      { id: 'aksesoris', names: { id: 'Aksesoris', en: 'Accessories' } },
      { id: 'perawatan_rambut', names: { id: 'Perawatan rambut', en: 'Hair care' } },
      { id: 'perawatan_lain', names: { id: 'Perawatan lain', en: 'Other care' } },
    ],
  },
  {
    id: 'pendidikan',
    names: { id: 'Pendidikan', en: 'Education' },
    children: [
      { id: 'sekolah', names: { id: 'Sekolah', en: 'School' } },
      { id: 'buku_tulis', names: { id: 'Buku tulis', en: 'Notebooks' } },
      { id: 'peralatan_sekolah', names: { id: 'Peralatan sekolah', en: 'School supplies' } },
      { id: 'akademi', names: { id: 'Akademi', en: 'Academy' } },
      { id: 'kas_kelas', names: { id: 'Kas', en: 'Class fund' } },
    ],
  },
  {
    id: 'kesehatan',
    names: { id: 'Kesehatan', en: 'Health' },
    children: [
      { id: 'dokter', names: { id: 'Dokter', en: 'Doctor' } },
      { id: 'obat', names: { id: 'Obat', en: 'Medicine' } },
      { id: 'vitamin', names: { id: 'Vitamin', en: 'Vitamins' } },
      { id: 'checkup', names: { id: 'Check-up', en: 'Check-up' } },
      { id: 'kesehatan_lain', names: { id: 'Lainnya', en: 'Other' } },
    ],
  },
  {
    id: 'investasi_pengeluaran',
    names: { id: 'Investasi', en: 'Investment' },
    children: [
      { id: 'emas', names: { id: 'Emas', en: 'Gold' } },
      { id: 'crypto', names: { id: 'Crypto', en: 'Crypto' } },
      { id: 'saham', names: { id: 'Saham', en: 'Stocks' } },
      { id: 'investasi_lain', names: { id: 'Lainnya', en: 'Other' } },
    ],
  },
  {
    id: 'hadiah',
    names: { id: 'Hadiah', en: 'Gifts' },
    children: [
      { id: 'ulang_tahun', names: { id: 'Ulang tahun', en: 'Birthday' } },
      { id: 'hari_raya', names: { id: 'Hari raya', en: 'Holiday' } },
      { id: 'hadiah_lain', names: { id: 'Lainnya', en: 'Other' } },
    ],
  },
  {
    id: 'hilang',
    names: { id: 'Hilang / tidak diketahui', en: 'Lost / unknown' },
    children: [
      { id: 'tidak_diketahui', names: { id: 'Tidak diketahui', en: 'Unknown' } },
      { id: 'hilang_lain', names: { id: 'Lainnya', en: 'Other' } },
    ],
  },
  {
    id: 'lainnya_kategori',
    names: { id: 'Lainnya', en: 'Other' },
    children: [{ id: 'umum', names: { id: 'Umum', en: 'General' } }],
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
  if (typeof localStorage === 'undefined') return { hidden: {}, extras: {}, colors: {}, parents: [], names: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedCustom = { hidden: {}, extras: {}, colors: {}, parents: [], names: {} }
      return cachedCustom
    }
    const data = JSON.parse(raw)
    cachedCustom = {
      hidden: data.hidden && typeof data.hidden === 'object' ? data.hidden : {},
      extras: data.extras && typeof data.extras === 'object' ? data.extras : {},
      colors: data.colors && typeof data.colors === 'object' ? data.colors : {},
      parents: Array.isArray(data.parents) ? data.parents : [],
      names: data.names && typeof data.names === 'object' ? data.names : {},
    }
    return cachedCustom
  } catch {
    cachedCustom = { hidden: {}, extras: {}, colors: {}, parents: [], names: {} }
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

/** Merged tree: defaults minus hidden subs, plus user-added subs per parent, custom parents, custom names & colors. */
export function getMergedExpenseTree() {
  const { hidden = {}, extras = {}, colors = {}, parents = [], names = {} } = loadCustom()
  const baseTree = [...EXPENSE_TREE, ...parents]
  return baseTree
    .filter((parent) => parent.id !== 'investasi_pengeluaran')
    .map((parent) => {
      const parentName = names[parent.id] || parent.names
      const children = [
        ...(parent.children || []).filter((c) => !(hidden[parent.id] || []).includes(c.id)),
        ...(extras[parent.id] || []),
      ].map((child) => {
        const childName = names[`${parent.id}/${child.id}`] || child.names
        return {
          ...child,
          names: childName,
          color: colors[`${parent.id}/${child.id}`] || colors[parent.id] || null,
        }
      })
      return {
        ...parent,
        names: parentName,
        color: colors[parent.id] || null,
        children,
      }
    })
}

export function getExpenseCategoryColor(categoryId) {
  if (!categoryId) return null
  const custom = loadCustom()
  if (custom.colors[categoryId]) return custom.colors[categoryId]
  const [pid] = String(categoryId).split('/')
  return custom.colors[pid] || null
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

export function updateExpenseCategoryName(parentId, childId, nameId, nameEn) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return
  const en = String(nameEn || trimmed).trim() || trimmed
  const custom = loadCustom()
  const key = childId ? `${parentId}/${childId}` : parentId
  custom.names[key] = { id: trimmed, en }
  saveCustom(custom)
}

export function addExpenseParentCategory(nameId, nameEn, colorKey) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return
  const en = String(nameEn || trimmed).trim() || trimmed
  const custom = loadCustom()
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  custom.parents.push({ id, names: { id: trimmed, en }, children: [] })
  if (colorKey) custom.colors[id] = colorKey
  saveCustom(custom)
}

export function removeExpenseParentCategory(parentId) {
  const custom = loadCustom()
  custom.parents = custom.parents.filter((p) => p.id !== parentId)
  saveCustom(custom)
}

export function isBuiltinExpenseChild(parentId, childId) {
  const p = EXPENSE_TREE.find((x) => x.id === parentId)
  return Boolean(p?.children.some((c) => c.id === childId))
}

export function addExpenseSubcategory(parentId, nameId, nameEn) {
  const trimmed = String(nameId || '').trim()
  if (!trimmed) return
  const en = String(nameEn || trimmed).trim() || trimmed
  const custom = loadCustom()
  if (!custom.extras[parentId]) custom.extras[parentId] = []
  const id = `x_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  custom.extras[parentId].push({ id, names: { id: trimmed, en } })
  saveCustom(custom)
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
  const parsed = parseExpenseCategoryPath(value)
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
