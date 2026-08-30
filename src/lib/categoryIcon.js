import { getExpenseCategoryColor, parseExpenseCategoryPath } from './expenseCategories'
import { getIncomeCategoryColor, normalizeIncomeCategoryId, parseIncomeCategoryPath } from './incomeCategories'

export const AVAILABLE_CATEGORY_ICONS = [
  { key: 'food', labelId: 'Makanan & Resto', labelEn: 'Food & Dining' },
  { key: 'coffee', labelId: 'Kopi & Minuman', labelEn: 'Coffee & Drinks' },
  { key: 'shopping', labelId: 'Belanja & Toko', labelEn: 'Shopping' },
  { key: 'clothing', labelId: 'Pakaian & Fashion', labelEn: 'Clothing & Fashion' },
  { key: 'transport', labelId: 'Transportasi', labelEn: 'Transportation' },
  { key: 'car', labelId: 'Kendaraan / Mobil', labelEn: 'Car & Vehicle' },
  { key: 'fuel', labelId: 'Bensin & BBM', labelEn: 'Fuel & Gas' },
  { key: 'home', labelId: 'Rumah & Properti', labelEn: 'Home & Housing' },
  { key: 'rent', labelId: 'Sewa & Gedung', labelEn: 'Rent & Building' },
  { key: 'zap', labelId: 'Listrik & Utilitas', labelEn: 'Electricity & Utilities' },
  { key: 'water', labelId: 'Air & PDAM', labelEn: 'Water' },
  { key: 'wifi', labelId: 'Internet & WiFi', labelEn: 'Internet & WiFi' },
  { key: 'phone', labelId: 'Pulsa & Ponsel', labelEn: 'Phone & Data' },
  { key: 'culture', labelId: 'Hiburan & Acara', labelEn: 'Entertainment' },
  { key: 'film', labelId: 'Bioskop & Film', labelEn: 'Cinema & Movies' },
  { key: 'game', labelId: 'Games & Top Up', labelEn: 'Gaming' },
  { key: 'music', labelId: 'Musik & Streaming', labelEn: 'Music' },
  { key: 'beauty', labelId: 'Kecantikan & Salon', labelEn: 'Beauty & Salon' },
  { key: 'health', labelId: 'Kesehatan & Obat', labelEn: 'Health & Medicine' },
  { key: 'gym', labelId: 'Olahraga & Gym', labelEn: 'Sports & Fitness' },
  { key: 'education', labelId: 'Pendidikan & Sekolah', labelEn: 'Education' },
  { key: 'book', labelId: 'Buku & Kursus', labelEn: 'Books & Courses' },
  { key: 'people', labelId: 'Sosial & Teman', labelEn: 'Social & Hangout' },
  { key: 'gift', labelId: 'Hadiah & Kado', labelEn: 'Gifts & Donation' },
  { key: 'pets', labelId: 'Hewan & Peliharaan', labelEn: 'Pets' },
  { key: 'baby', labelId: 'Anak & Bayi', labelEn: 'Baby & Kids' },
  { key: 'travel', labelId: 'Liburan & Travel', labelEn: 'Travel & Vacation' },
  { key: 'salary', labelId: 'Gaji & Upah', labelEn: 'Salary & Wages' },
  { key: 'bonus', labelId: 'Bonus & THR', labelEn: 'Bonus & Rewards' },
  { key: 'cash', labelId: 'Uang Tunai / Bisnis', labelEn: 'Cash & Business' },
  { key: 'briefcase', labelId: 'Pekerjaan & Jasa', labelEn: 'Job & Services' },
  { key: 'wallet', labelId: 'Dompet & Uang Saku', labelEn: 'Wallet & Pocket' },
  { key: 'investment', labelId: 'Investasi & Saham', labelEn: 'Investment' },
  { key: 'crypto', labelId: 'Crypto & Aset', labelEn: 'Crypto & Assets' },
  { key: 'repayment', labelId: 'Cicilan & Piutang', labelEn: 'Repayment & Debt' },
  { key: 'transfer', labelId: 'Transfer & Patungan', labelEn: 'Transfer' },
  { key: 'shield', labelId: 'Asuransi & Proteksi', labelEn: 'Insurance' },
  { key: 'tax', labelId: 'Pajak & Denda', labelEn: 'Tax & Dues' },
  { key: 'tools', labelId: 'Perbaikan & Servis', labelEn: 'Tools & Repair' },
  { key: 'repeat', labelId: 'Langganan Rutin', labelEn: 'Subscriptions' },
  { key: 'star', labelId: 'Favorit / Khusus', labelEn: 'Special' },
  { key: 'heart', labelId: 'Keluarga & Cinta', labelEn: 'Family & Care' },
  { key: 'other', labelId: 'Lainnya / Umum', labelEn: 'Other & General' },
]

const EXPENSE_ICON_BY_PARENT = {
  makanan: 'food',
  makanan_minuman: 'food',
  tagihan: 'zap',
  tagihan_utilitas: 'zap',
  kebutuhan_harian: 'shopping',
  transportasi: 'transport',
  kehidupan_sosial: 'people',
  kultur: 'film',
  hiburan: 'film',
  pakaian: 'clothing',
  belanja: 'shopping',
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
  bisnis: 'briefcase',
  kas_kecil: 'transfer',
  investasi: 'crypto',
  lainnya: 'gift',
}

export function autoDetectCategoryIcon(name, type = 'expense') {
  if (!name || typeof name !== 'string') return type === 'income' ? 'income' : 'food'
  const s = name.toLowerCase().trim()

  if (/kopi|coffee|cafe|starbucks|teh|tea|minum|drink|boba|jus|juice/i.test(s)) return 'coffee'
  if (/makan|food|resto|kuliner|bakso|ayam|nasi|lunch|dinner|sarapan|snack|jajan|burger|pizza|mie|sate|catering/i.test(s)) return 'food'
  if (/bensin|bbm|pertamax|pertalite|fuel|gas|solar|spbu/i.test(s)) return 'fuel'
  if (/mobil|motor|car|vehicle|parkir|parking|tol|toll|ojol|gojek|grab|taksi|taxi|bus|bis|kereta|krl|mrt/i.test(s)) return 'transport'
  if (/listrik|pln|token|power|electric|petir/i.test(s)) return 'zap'
  if (/air|water|pdam|aqua|galon/i.test(s)) return 'water'
  if (/internet|wifi|indihome|biznet|provider/i.test(s)) return 'wifi'
  if (/pulsa|kuota|paket data|telkomsel|indosat|xl|smartfren|phone|hp/i.test(s)) return 'phone'
  if (/belanja|shopping|mall|supermarket|minimarket|indomaret|alfamart|pasar|toko/i.test(s)) return 'shopping'
  if (/pakaian|baju|clothing|celana|kaos|jaket|dress|outfit|sepatu|sandal|fashion/i.test(s)) return 'clothing'
  if (/cantik|beauty|skincare|makeup|salon|barbershop|cukur|parfum|grooming|perawatan/i.test(s)) return 'beauty'
  if (/sehat|health|obat|dokter|apotek|hospital|rumah sakit|klinik|vitamin|dentist|gigi|medis/i.test(s)) return 'health'
  if (/gym|fitness|olahraga|sport|futsal|badminton|lari|workout|yoga|sepeda/i.test(s)) return 'gym'
  if (/didik|educat|sekolah|kuliah|spp|kursus|training|ujian|les/i.test(s)) return 'education'
  if (/buku|book|novel|komik|stationery|alat tulis/i.test(s)) return 'book'
  if (/nonton|cinema|bioskop|film|movie|netflix|youtube|disney/i.test(s)) return 'film'
  if (/game|gaming|playstation|steam|top up|diamond|mlbb|roblox|valorant/i.test(s)) return 'game'
  if (/musik|music|spotify|konser|concert|lagu/i.test(s)) return 'music'
  if (/hiburan|kultur|culture|wisata|rekreasi|event/i.test(s)) return 'culture'
  if (/kucing|anjing|pet|hewan|peliharaan|vet|pakan|whiskas/i.test(s)) return 'pets'
  if (/bayi|baby|anak|kid|pampers|popok|susu formula/i.test(s)) return 'baby'
  if (/liburan|travel|trip|pesawat|flight|hotel|villa|staycation/i.test(s)) return 'travel'
  if (/rumah|home|house|kost|kos|kontrakan|properti/i.test(s)) return 'home'
  if (/sewa|rent|gedung|building|kantor|office/i.test(s)) return 'rent'
  if (/asuransi|insurance|bpjs|prudential|allianz|proteksi/i.test(s)) return 'shield'
  if (/pajak|tax|pbb|npwp|denda|tilang|sanksi/i.test(s)) return 'tax'
  if (/bengkel|servis|service|montir|tukang|renovasi|tools|alat/i.test(s)) return 'tools'
  if (/langganan|subscri|saas|hosting|domain|cloud/i.test(s)) return 'repeat'
  if (/gaji|salary|wage|honor|upah/i.test(s)) return 'salary'
  if (/bonus|thr|insentif|reward|cashback/i.test(s)) return 'bonus'
  if (/bisnis|business|usaha|jual|dagang|toko|freelance|omset/i.test(s)) return 'cash'
  if (/kerja|work|job|proyek|klien|jasa|briefcase/i.test(s)) return 'briefcase'
  if (/saku|jajan|wallet|dompet|allowance/i.test(s)) return 'wallet'
  if (/invest|saham|reksadana|stock|dividen|deposito|emas|gold/i.test(s)) return 'investment'
  if (/crypto|kripto|bitcoin|btc|eth|binance|indodax/i.test(s)) return 'crypto'
  if (/utang|hutang|piutang|pinjam|loan|cicilan|bayar utang|angsuran/i.test(s)) return 'repayment'
  if (/transfer|patungan|split bill|kembalian|bagi/i.test(s)) return 'transfer'
  if (/kado|hadiah|gift|giveaway|undian/i.test(s)) return 'gift'
  if (/amal|donasi|sedekah|zakat|infaq|charity|sosial/i.test(s)) return 'heart'
  if (/teman|kumpul|nongkrong|hangout|people/i.test(s)) return 'people'

  return type === 'income' ? 'income' : 'food'
}

export function resolveExpenseParentIconKey(parentId) {
  const pid = String(parentId || '').toLowerCase()
  return EXPENSE_ICON_BY_PARENT[pid] || autoDetectCategoryIcon(pid, 'expense')
}

export function resolveIncomeParentIconKey(parentId) {
  const [pid] = String(parentId || '').split('/')
  return INCOME_ICON_BY_ID[pid] || autoDetectCategoryIcon(pid, 'income')
}

export function resolveIncomeCategoryIconKey(categoryId) {
  const normalized = normalizeIncomeCategoryId(categoryId)
  const [pid] = String(normalized || '').split('/')
  return INCOME_ICON_BY_ID[pid] || autoDetectCategoryIcon(pid, 'income')
}

export function resolveTransactionIconKey(category, type, customIcon) {
  if (customIcon) return customIcon

  let catStr = category
  let typeStr = type
  if (category && typeof category === 'object') {
    if (category.icon) return category.icon
    catStr = category.category
    typeStr = category.type || type
  }

  if (typeStr === 'income') {
    return resolveIncomeCategoryIconKey(catStr)
  }

  const parsed = parseExpenseCategoryPath(catStr)
  if (parsed?.parent?.icon) return parsed.parent.icon
  if (parsed?.parentId) {
    const parentIcon = EXPENSE_ICON_BY_PARENT[parsed.parentId.toLowerCase()]
    if (parentIcon) return parentIcon
  }

  const raw = String(catStr || '').toLowerCase()
  if (EXPENSE_ICON_BY_PARENT[raw]) return EXPENSE_ICON_BY_PARENT[raw]

  const firstPart = raw.split('/')[0]
  if (EXPENSE_ICON_BY_PARENT[firstPart]) return EXPENSE_ICON_BY_PARENT[firstPart]

  return autoDetectCategoryIcon(raw, 'expense')
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
