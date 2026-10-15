import { getMergedExpenseTree, parseExpenseCategoryPath } from './expenseCategories'
import { getMergedIncomeTree, parseIncomeCategoryPath } from './incomeCategories'

const INCOME_KEYWORD_RULES = [
  { match: ['uang saku', 'sangu', 'uang jajan', 'dikasih', 'kiriman', 'pocket money'], target: 'uang_jajan/uang_saku' },
  { match: ['lembur', 'overtime'], target: 'gaji/lembur' },
  { match: ['tunjangan', 'tukin', 'allowance'], target: 'gaji/tunjangan' },
  { match: ['gaji', 'salary', 'paycheck', 'honor', 'upah'], target: 'gaji/gaji_pokok' },
  { match: ['thr', 'lebaran', 'natal'], target: 'bonus/thr' },
  { match: ['bonus tahunan', 'annual bonus', 'performa'], target: 'bonus/bonus_tahunan' },
  { match: ['hadiah', 'kado', 'gift', 'reward', 'giveaway'], target: 'bonus/hadiah' },
  { match: ['cashback', 'promo balik', 'kembali dana'], target: 'bonus/cashback' },
  { match: ['bonus'], target: 'bonus/thr' },
  { match: ['jual', 'penjualan', 'omset', 'dagang', 'preloved', 'orderan'], target: 'bisnis/penjualan' },
  { match: ['freelance', 'proyek', 'jasa', 'side hustle', 'gig'], target: 'bisnis/freelance' },
  { match: ['komisi', 'affiliate', 'jastip', 'tip', 'fee'], target: 'bisnis/komisi' },
  { match: ['adsense', 'youtube', 'saweria', 'tiktok', 'content', 'konten', 'endorse'], target: 'bisnis/content_creator' },
  { match: ['bisnis', 'usaha'], target: 'bisnis/penjualan' },
  { match: ['utang', 'piutang', 'balikin uang', 'lunas piutang'], target: 'kas_kecil/bayar_utang' },
  { match: ['kembalian', 'sisa belanja'], target: 'kas_kecil/kembalian' },
  { match: ['patungan', 'split bill'], target: 'kas_kecil/patungan' },
  { match: ['dividen', 'yield', 'obligasi'], target: 'investasi/dividen' },
  { match: ['bunga', 'deposito'], target: 'investasi/bunga_bank' },
  { match: ['reksadana'], target: 'investasi/cair_reksadana' },
  { match: ['saham', 'cuan saham'], target: 'investasi/jual_saham' },
  { match: ['crypto', 'kripto', 'bitcoin', 'btc', 'cuan'], target: 'investasi/jual_crypto' },
  { match: ['invest'], target: 'investasi/dividen' },
  { match: ['undian', 'lomba', 'menang', 'lottery'], target: 'lainnya/menang_undian' },
  { match: ['nemu'], target: 'lainnya/nemu_uang' },
]

const EXPENSE_KEYWORD_RULES = [
  // Food & Beverage
  { match: ['kopi', 'coffee', 'cafe', 'kafe', 'starbucks', 'janji jiwa', 'kenangan', 'starling', 'teh', 'matcha', 'greentea', 'green tea', 'taro', 'red velvet', 'thai tea', 'earl grey', 'boba', 'cappuccino', 'latte', 'ngopi', 'es teh'], target: 'makanan/kopi' },
  { match: ['sarapan', 'breakfast', 'bubur', 'lontong', 'nasi uduk', 'roti bakar', 'makan pagi', 'sarap'], target: 'makanan/sarapan' },
  { match: ['malam', 'malem', 'dinner', 'nasgor', 'pecel lele', 'sate', 'martabak', 'angkringan', 'makan malam', 'makan malem'], target: 'makanan/makan_malam' },
  { match: ['jajan', 'snack', 'cemilan', 'seblak', 'cilok', 'siomay', 'batagor', 'gorengan', 'eskrim', 'es krim', 'ice cream', 'icecream', 'gelato', 'sundae', 'donat', 'croissant', 'pastry'], target: 'makanan/jajan' },
  { match: ['minum', 'drink', 'jus', 'air mineral', 'galon', 'aqua'], target: 'makanan/minuman' },
  { match: ['resto', 'restoran', 'dining', 'makan luar', 'ayce', 'all you can eat', 'gofood', 'go food', 'grabfood', 'grab food', 'shopeefood', 'shopee food'], target: 'makanan/makan_diluar' },
  {
    test: (lower) =>
      lower.includes('makan') ||
      lower.includes('siang') ||
      lower.includes('lunch') ||
      lower.includes('padang') ||
      lower.includes('warteg') ||
      lower.includes('warmindo') ||
      lower.includes('mie ayam') ||
      /\bmie\b/i.test(lower) ||
      lower.includes('bakso') ||
      lower.includes('geprek') ||
      lower.includes('ayam') ||
      lower.includes('nasi') ||
      lower.includes('food') ||
      lower.includes('kuliner'),
    target: 'makanan/makan_siang',
  },

  // Transportation
  { match: ['bensin', 'pertamax', 'pertalite', 'bbm', 'shell', 'fuel', 'solar'], target: 'transportasi/bensin' },
  { match: ['gojek', 'grab', 'ojol', 'maxim', 'goride', 'gocar', 'grabcar', 'indrive'], target: 'transportasi/ojol' },
  { match: ['parkir', 'parking', 'karcis parkir'], target: 'transportasi/parkir' },
  { regex: /\b(tol|e-toll|etoll|kartu tol)\b/i, target: 'transportasi/tol' },
  { regex: /\b(kereta|krl|mrt|lrt|kai|commuter)\b/i, target: 'transportasi/kereta' },
  { regex: /\b(bis|bus|transjakarta|tj|damri)\b/i, target: 'transportasi/bis' },
  { match: ['taksi', 'taxi', 'bluebird'], target: 'transportasi/taksi' },
  { match: ['servis', 'bengkel', 'ganti oli', 'tambal ban', 'cuci motor', 'cuci mobil'], target: 'transportasi/servis_kendaraan' },
  { match: ['transport'], target: 'transportasi/bensin' },

  // Bills & Utilities
  { match: ['listrik', 'pln', 'token listrik', 'token pln'], target: 'tagihan/listrik' },
  {
    test: (lower) => /\b(air|pdam)\b/i.test(lower) && !lower.includes('conditioner') && !lower.includes('fryer'),
    target: 'tagihan/air',
  },
  { match: ['wifi', 'indihome', 'biznet', 'myrepublic', 'firstmedia', 'internet'], target: 'tagihan/internet' },
  {
    test: (lower) =>
      lower.includes('pulsa') ||
      lower.includes('kuota') ||
      lower.includes('paket data') ||
      lower.includes('paketan') ||
      lower.includes('paket internet') ||
      lower.includes('telkomsel') ||
      lower.includes('indosat') ||
      (/\bxl\b/i.test(lower) && !/\b(baju|kaos|celana|kemeja|pakaian|size|ukuran|jaket|hoodie|gamis|rok|dress)\b/i.test(lower)) ||
      /\btri\b/i.test(lower) ||
      lower.includes('smartfren'),
    target: 'tagihan/paket_data',
  },
  { match: ['netflix', 'spotify', 'youtube', 'disney', 'apple', 'langganan', 'subscription'], target: 'tagihan/langganan' },
  { match: ['asuransi', 'bpjs'], target: 'tagihan/asuransi' },
  {
    test: (lower) =>
      lower.includes('cicilan') ||
      lower.includes('paylater') ||
      lower.includes('kredivo') ||
      lower.includes('spaylater') ||
      lower.includes('angsuran') ||
      lower.includes('kredit') ||
      /\b(kosan|kos|kontrakan)\b/i.test(lower),
    target: 'tagihan/cicilan',
  },

  // Daily Needs & Groceries
  { match: ['supermarket', 'indomaret', 'alfamart', 'grocer', 'sayur', 'beras', 'minyak', 'pasar', 'belanja bulanan'], target: 'kebutuhan_harian/belanja_bulanan' },
  { match: ['peralatan rumah', 'perabot', 'sapu', 'dapur'], target: 'kebutuhan_harian/peralatan_rumah' },
  { match: ['sabun', 'shampoo', 'odol', 'sikat gigi', 'perlengkapan mandi'], target: 'kebutuhan_harian/perlengkapan_mandi' },
  { match: ['laundry', 'cuci baju', 'dry clean'], target: 'kebutuhan_harian/laundry' },
  { match: ['hewan', 'kucing', 'anjing', 'whiskas', 'pet food'], target: 'kebutuhan_harian/hewan_peliharaan' },

  // Social & Hangout
  { match: ['nongkrong', 'nongki', 'hangout', 'warkop', 'kumpul'], target: 'kehidupan_sosial/kumpul_teman' },
  { match: ['hobi', 'badminton', 'futsal', 'sepeda', 'tenis', 'golf'], target: 'kehidupan_sosial/hobi' },
  { match: ['kencan', 'date', 'dating', 'jalan sama doi'], target: 'kehidupan_sosial/kencan' },
  { match: ['sedekah', 'zakat', 'infaq', 'donasi', 'amal'], target: 'kehidupan_sosial/amal_donasi' },
  { match: ['kondangan', 'hadiah nikah', 'amplop', 'kado', 'hadiah', 'gift'], target: 'kehidupan_sosial/kondangan' },
  {
    test: (lower) => lower.includes('iuran') || lower.includes('iuran rt') || /\bkas\b/i.test(lower),
    target: 'kehidupan_sosial/iuran',
  },

  // Entertainment / Kultur
  { match: ['bioskop', 'cinema', 'xxi', 'cgv', 'film', 'nonton'], target: 'kultur/bioskop' },
  { match: ['konser', 'tiket', 'festival'], target: 'kultur/konser' },
  { match: ['game', 'steam', 'diamond', 'mlbb', 'free fire', 'valorant', 'genshin', 'topup game'], target: 'kultur/games' },
  { match: ['buku', 'novel', 'komik', 'gramedia'], target: 'kultur/buku' },
  { match: ['liburan', 'travel', 'hotel', 'staycation', 'tiket pesawat', 'villa'], target: 'kultur/liburan' },

  // Clothing & Fashion
  { match: ['baju', 'kaos', 'kemeja', 'jaket', 'hoodie'], target: 'pakaian/baju' },
  { match: ['celana', 'jeans', 'rok'], target: 'pakaian/celana' },
  { match: ['sepatu', 'sandal', 'sneakers'], target: 'pakaian/sepatu' },
  {
    test: (lower) =>
      lower.includes('aksesoris') ||
      lower.includes('jam tangan') ||
      lower.includes('topi') ||
      /\b(tas|ransel)\b/i.test(lower) ||
      lower.includes('fashion') ||
      lower.includes('belanja'),
    target: 'pakaian/aksesoris_pakaian',
  },

  // Beauty & Care
  { match: ['skincare', 'sunscreen', 'serum', 'toner', 'moisturizer'], target: 'kecantikan/skincare' },
  { match: ['makeup', 'lipstik', 'cushion', 'bedak'], target: 'kecantikan/makeup' },
  { match: ['potong rambut', 'barbershop', 'salon', 'creambath', 'facial'], target: 'kecantikan/salon' },
  { match: ['parfum', 'perfume', 'cologne'], target: 'kecantikan/parfum' },

  // Education
  { match: ['sekolah', 'kuliah', 'spp', 'ukt'], target: 'pendidikan/sekolah' },
  { match: ['kursus', 'les', 'pelatihan', 'bootcamp', 'udemy'], target: 'pendidikan/kursus' },
  { match: ['buku pelajaran', 'modul', 'textbook'], target: 'pendidikan/buku_pelajaran' },
  { match: ['alat tulis', 'atk', 'fotocopy', 'print'], target: 'pendidikan/alat_tulis' },

  // Health
  { match: ['dokter', 'klinik', 'rumah sakit', 'halodoc', 'alodokter'], target: 'kesehatan/dokter' },
  { match: ['obat', 'apotek', 'kimia farma', 'k24'], target: 'kesehatan/obat' },
  { match: ['vitamin', 'suplemen'], target: 'kesehatan/vitamin' },
  { match: ['gym', 'fitness', 'yoga', 'olahraga'], target: 'kesehatan/gym' },

  // Investment (Expense)
  { match: ['beli emas', 'antam', 'emas batangan'], target: 'investasi_pengeluaran/emas' },
  { match: ['reksadana', 'bibit', 'bareksa'], target: 'investasi_pengeluaran/reksadana' },
  { match: ['saham', 'ajaib', 'stockbit'], target: 'investasi_pengeluaran/saham' },
  { match: ['crypto', 'kripto', 'binance', 'indodax', 'tokocrypto'], target: 'investasi_pengeluaran/crypto' },
  { match: ['deposito'], target: 'investasi_pengeluaran/deposito' },
  {
    test: (lower) => lower.includes('biaya admin') || /\badm\b/i.test(lower) || lower.includes('pajak'),
    target: 'lainnya_kategori/pajak',
  },
]

function findMatchingRuleTarget(lower, rules) {
  for (const rule of rules) {
    if (rule.match && rule.match.some((kw) => lower.includes(kw))) {
      return rule.target
    }
    if (rule.regex && rule.regex.test(lower)) {
      return rule.target
    }
    if (typeof rule.test === 'function' && rule.test(lower)) {
      return rule.target
    }
  }
  return null
}

function matchIncomeCategoryTree(lower) {
  const incomeTree = getMergedIncomeTree()
  for (const parent of incomeTree) {
    const pIdLower = parent.id.toLowerCase().replace(/[_-\s]+/g, ' ')
    const pNameId = (parent.names?.id || '').toLowerCase()
    const pNameEn = (parent.names?.en || '').toLowerCase()

    if (pIdLower === lower || pNameId === lower || pNameEn === lower) {
      const firstChild = parent.children?.[0]?.id || 'umum'
      return `${parent.id}/${firstChild}`
    }

    for (const child of parent.children || []) {
      const cIdLower = child.id.toLowerCase().replace(/[_-\s]+/g, ' ')
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
  return null
}

function matchExpenseCategoryTree(lower) {
  const expenseTree = getMergedExpenseTree()
  for (const parent of expenseTree) {
    const pIdLower = parent.id.toLowerCase().replace(/[_-\s]+/g, ' ')
    const pNameId = (parent.names?.id || '').toLowerCase()
    const pNameEn = (parent.names?.en || '').toLowerCase()

    if (pIdLower === lower || pNameId === lower || pNameEn === lower) {
      const firstChildId = parent.children?.[0]?.id || 'umum'
      return `${parent.id}/${firstChildId}`
    }

    for (const child of parent.children || []) {
      const cIdLower = child.id.toLowerCase().replace(/[_-\s]+/g, ' ')
      const cNameId = (child.names?.id || '').toLowerCase()
      const cNameEn = (child.names?.en || '').toLowerCase()

      if (cIdLower === 'air' && (lower.includes('conditioner') || lower.includes('fryer'))) {
        continue
      }

      const isExact = cIdLower === lower || cNameId === lower || cNameEn === lower
      const matchesWordBoundary = (name) => name && name.length >= 4 && new RegExp(`\\b${name}\\b`, 'i').test(lower)

      if (isExact || matchesWordBoundary(cNameId) || matchesWordBoundary(cNameEn) || matchesWordBoundary(cIdLower)) {
        return `${parent.id}/${child.id}`
      }
    }
  }
  return null
}

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

  // 1. First check if it's already a valid path (e.g. 'makanan/makan_siang' or 'gaji/gaji_pokok')
  const parser = type === 'income' ? parseIncomeCategoryPath : parseExpenseCategoryPath
  const parsed = parser(raw)
  if (parsed && (parsed.child || !parsed.childId)) {
    const defaultChild = parsed.parent?.children?.[0]?.id || 'umum'
    return parsed.childId ? `${parsed.parentId}/${parsed.childId}` : `${parsed.parentId}/${defaultChild}`
  }

  const lower = raw.toLowerCase().replace(/[_-\s]+/g, ' ')

  // 2. Comprehensive Income Categorization & Slang Dictionary
  if (type === 'income') {
    const treeMatch = matchIncomeCategoryTree(lower)
    if (treeMatch) return treeMatch

    const ruleMatch = findMatchingRuleTarget(lower, INCOME_KEYWORD_RULES)
    if (ruleMatch) return ruleMatch

    return 'gaji/gaji_pokok'
  }

  // 3. Comprehensive Expense Categorization & Slang Dictionary
  const expenseTreeMatch = matchExpenseCategoryTree(lower)
  if (expenseTreeMatch) return expenseTreeMatch

  const expenseRuleMatch = findMatchingRuleTarget(lower, EXPENSE_KEYWORD_RULES)
  if (expenseRuleMatch) return expenseRuleMatch

  return 'lainnya_kategori/umum'
}
