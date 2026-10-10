import { getMergedExpenseTree, parseExpenseCategoryPath } from './expenseCategories'
import { getMergedIncomeTree, parseIncomeCategoryPath } from './incomeCategories'

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
  if (type === 'income') {
    const parsed = parseIncomeCategoryPath(raw)
    if (parsed && (parsed.child || !parsed.childId)) {
      const defaultChild = parsed.parent?.children?.[0]?.id || 'umum'
      return parsed.childId ? `${parsed.parentId}/${parsed.childId}` : `${parsed.parentId}/${defaultChild}`
    }
  } else {
    const parsed = parseExpenseCategoryPath(raw)
    if (parsed && (parsed.child || !parsed.childId)) {
      const defaultChild = parsed.parent?.children?.[0]?.id || 'umum'
      return parsed.childId ? `${parsed.parentId}/${parsed.childId}` : `${parsed.parentId}/${defaultChild}`
    }
  }

  const lower = raw.toLowerCase().replace(/[_-\s]+/g, ' ')

  // 2. Comprehensive Income Categorization & Slang Dictionary
  if (type === 'income') {
    // Check tree structure directly for matching parent or child IDs/names
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

    // Keyword mapping for Indonesian slang & colloquial income terms
    if (lower.includes('uang saku') || lower.includes('sangu') || lower.includes('uang jajan') || lower.includes('dikasih') || lower.includes('kiriman') || lower.includes('pocket money')) {
      return 'uang_jajan/uang_saku'
    }
    if (lower.includes('lembur') || lower.includes('overtime')) {
      return 'gaji/lembur'
    }
    if (lower.includes('tunjangan') || lower.includes('tukin') || lower.includes('allowance')) {
      return 'gaji/tunjangan'
    }
    if (lower.includes('gaji') || lower.includes('salary') || lower.includes('paycheck') || lower.includes('honor') || lower.includes('upah')) {
      return 'gaji/gaji_pokok'
    }
    if (lower.includes('thr') || lower.includes('lebaran') || lower.includes('natal')) {
      return 'bonus/thr'
    }
    if (lower.includes('bonus tahunan') || lower.includes('annual bonus') || lower.includes('performa')) {
      return 'bonus/bonus_tahunan'
    }
    if (lower.includes('hadiah') || lower.includes('kado') || lower.includes('gift') || lower.includes('reward') || lower.includes('giveaway')) {
      return 'bonus/hadiah'
    }
    if (lower.includes('cashback') || lower.includes('promo balik') || lower.includes('kembali dana')) {
      return 'bonus/cashback'
    }
    if (lower.includes('bonus')) {
      return 'bonus/thr'
    }
    if (lower.includes('jual') || lower.includes('penjualan') || lower.includes('omset') || lower.includes('dagang') || lower.includes('preloved') || lower.includes('orderan')) {
      return 'bisnis/penjualan'
    }
    if (lower.includes('freelance') || lower.includes('proyek') || lower.includes('jasa') || lower.includes('side hustle') || lower.includes('gig')) {
      return 'bisnis/freelance'
    }
    if (lower.includes('komisi') || lower.includes('affiliate') || lower.includes('jastip') || lower.includes('tip') || lower.includes('fee')) {
      return 'bisnis/komisi'
    }
    if (lower.includes('adsense') || lower.includes('youtube') || lower.includes('saweria') || lower.includes('tiktok') || lower.includes('content') || lower.includes('konten') || lower.includes('endorse')) {
      return 'bisnis/content_creator'
    }
    if (lower.includes('bisnis') || lower.includes('usaha')) {
      return 'bisnis/penjualan'
    }
    if (lower.includes('utang') || lower.includes('piutang') || lower.includes('balikin uang') || lower.includes('lunas piutang')) {
      return 'kas_kecil/bayar_utang'
    }
    if (lower.includes('kembalian') || lower.includes('sisa belanja')) {
      return 'kas_kecil/kembalian'
    }
    if (lower.includes('patungan') || lower.includes('split bill')) {
      return 'kas_kecil/patungan'
    }
    if (lower.includes('dividen') || lower.includes('yield') || lower.includes('obligasi')) {
      return 'investasi/dividen'
    }
    if (lower.includes('bunga') || lower.includes('deposito')) {
      return 'investasi/bunga_bank'
    }
    if (lower.includes('reksadana')) {
      return 'investasi/cair_reksadana'
    }
    if (lower.includes('saham') || lower.includes('cuan saham')) {
      return 'investasi/jual_saham'
    }
    if (lower.includes('crypto') || lower.includes('kripto') || lower.includes('bitcoin') || lower.includes('btc') || lower.includes('cuan')) {
      return 'investasi/jual_crypto'
    }
    if (lower.includes('invest')) {
      return 'investasi/dividen'
    }
    if (lower.includes('undian') || lower.includes('lomba') || lower.includes('menang') || lower.includes('lottery')) {
      return 'lainnya/menang_undian'
    }
    if (lower.includes('nemu')) {
      return 'lainnya/nemu_uang'
    }

    return 'gaji/gaji_pokok'
  }

  // 3. Comprehensive Expense Categorization & Slang Dictionary
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

  // Expense Slang & Local Indonesian Keywords
  // Food & Beverage
  if (lower.includes('kopi') || lower.includes('coffee') || lower.includes('cafe') || lower.includes('kafe') || lower.includes('starbucks') || lower.includes('janji jiwa') || lower.includes('kenangan') || lower.includes('starling') || lower.includes('teh') || lower.includes('matcha') || lower.includes('greentea') || lower.includes('green tea') || lower.includes('taro') || lower.includes('red velvet') || lower.includes('thai tea') || lower.includes('earl grey') || lower.includes('boba') || lower.includes('cappuccino') || lower.includes('latte')) return 'makanan/kopi'
  if (lower.includes('sarapan') || lower.includes('breakfast') || lower.includes('bubur') || lower.includes('lontong') || lower.includes('nasi uduk') || lower.includes('roti bakar')) return 'makanan/sarapan'
  if (lower.includes('malam') || lower.includes('dinner') || lower.includes('nasgor') || lower.includes('pecel lele') || lower.includes('sate') || lower.includes('martabak') || lower.includes('angkringan')) return 'makanan/makan_malam'
  if (lower.includes('jajan') || lower.includes('snack') || lower.includes('cemilan') || lower.includes('seblak') || lower.includes('cilok') || lower.includes('siomay') || lower.includes('batagor') || lower.includes('gorengan') || lower.includes('es krim') || lower.includes('donat') || lower.includes('croissant') || lower.includes('pastry')) return 'makanan/jajan'
  if (lower.includes('minum') || lower.includes('drink') || lower.includes('jus') || lower.includes('air mineral') || lower.includes('galon') || lower.includes('aqua')) return 'makanan/minuman'
  if (lower.includes('resto') || lower.includes('restoran') || lower.includes('dining') || lower.includes('makan luar') || lower.includes('ayce') || lower.includes('all you can eat') || lower.includes('gofood') || lower.includes('go food') || lower.includes('grabfood') || lower.includes('grab food') || lower.includes('shopeefood') || lower.includes('shopee food')) return 'makanan/makan_diluar'
  if (lower.includes('makan') || lower.includes('siang') || lower.includes('lunch') || lower.includes('padang') || lower.includes('warteg') || lower.includes('warmindo') || lower.includes('mie ayam') || /\bmie\b/i.test(lower) || lower.includes('bakso') || lower.includes('geprek') || lower.includes('ayam') || lower.includes('nasi') || lower.includes('food') || lower.includes('kuliner')) return 'makanan/makan_siang'

  // Transportation
  if (lower.includes('bensin') || lower.includes('pertamax') || lower.includes('pertalite') || lower.includes('bbm') || lower.includes('shell') || lower.includes('fuel') || lower.includes('solar')) return 'transportasi/bensin'
  if (lower.includes('gojek') || lower.includes('grab') || lower.includes('ojol') || lower.includes('maxim') || lower.includes('goride') || lower.includes('gocar') || lower.includes('grabcar') || lower.includes('indrive')) return 'transportasi/ojol'
  if (lower.includes('parkir') || lower.includes('parking') || lower.includes('karcis parkir')) return 'transportasi/parkir'
  if (/\b(tol|e-toll|etoll|kartu tol)\b/i.test(lower)) return 'transportasi/tol'
  if (lower.includes('kereta') || lower.includes('krl') || lower.includes('mrt') || lower.includes('lrt') || lower.includes('kai') || lower.includes('commuter')) return 'transportasi/kereta'
  if (/\b(bis|bus|transjakarta|tj|damri)\b/i.test(lower)) return 'transportasi/bis'
  if (lower.includes('taksi') || lower.includes('taxi') || lower.includes('bluebird')) return 'transportasi/taksi'
  if (lower.includes('servis') || lower.includes('bengkel') || lower.includes('ganti oli') || lower.includes('tambal ban') || lower.includes('cuci motor') || lower.includes('cuci mobil')) return 'transportasi/servis_kendaraan'
  if (lower.includes('transport')) return 'transportasi/bensin'

  // Bills & Utilities
  if (lower.includes('listrik') || lower.includes('pln') || lower.includes('token listrik') || lower.includes('token pln')) return 'tagihan/listrik'
  if (/\b(air|pdam)\b/i.test(lower) && !lower.includes('conditioner') && !lower.includes('fryer')) return 'tagihan/air'
  if (lower.includes('wifi') || lower.includes('indihome') || lower.includes('biznet') || lower.includes('myrepublic') || lower.includes('firstmedia') || lower.includes('internet')) return 'tagihan/internet'
  if (lower.includes('pulsa') || lower.includes('kuota') || lower.includes('paket data') || lower.includes('paketan') || lower.includes('paket internet') || lower.includes('telkomsel') || lower.includes('indosat') || (/\bxl\b/i.test(lower) && !/\b(baju|kaos|celana|kemeja|pakaian|size|ukuran|jaket|hoodie|gamis|rok|dress)\b/i.test(lower)) || /\btri\b/i.test(lower) || lower.includes('smartfren')) return 'tagihan/paket_data'
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('youtube') || lower.includes('disney') || lower.includes('apple') || lower.includes('langganan') || lower.includes('subscription')) return 'tagihan/langganan'
  if (lower.includes('asuransi') || lower.includes('bpjs')) return 'tagihan/asuransi'
  if (lower.includes('cicilan') || lower.includes('paylater') || lower.includes('kredivo') || lower.includes('spaylater') || lower.includes('angsuran') || lower.includes('kredit') || /\b(kosan|kos|kontrakan)\b/i.test(lower)) return 'tagihan/cicilan'

  // Daily Needs & Groceries
  if (lower.includes('supermarket') || lower.includes('indomaret') || lower.includes('alfamart') || lower.includes('grocer') || lower.includes('sayur') || lower.includes('beras') || lower.includes('minyak') || lower.includes('pasar') || lower.includes('belanja bulanan')) return 'kebutuhan_harian/belanja_bulanan'
  if (lower.includes('peralatan rumah') || lower.includes('perabot') || lower.includes('sapu') || lower.includes('dapur')) return 'kebutuhan_harian/peralatan_rumah'
  if (lower.includes('sabun') || lower.includes('shampoo') || lower.includes('odol') || lower.includes('sikat gigi') || lower.includes('perlengkapan mandi')) return 'kebutuhan_harian/perlengkapan_mandi'
  if (lower.includes('laundry') || lower.includes('cuci baju') || lower.includes('dry clean')) return 'kebutuhan_harian/laundry'
  if (lower.includes('hewan') || lower.includes('kucing') || lower.includes('anjing') || lower.includes('whiskas') || lower.includes('pet food')) return 'kebutuhan_harian/hewan_peliharaan'

  // Social & Hangout
  if (lower.includes('nongkrong') || lower.includes('nongki') || lower.includes('hangout') || lower.includes('warkop') || lower.includes('kumpul')) return 'kehidupan_sosial/kumpul_teman'
  if (lower.includes('hobi') || lower.includes('badminton') || lower.includes('futsal') || lower.includes('sepeda') || lower.includes('tenis') || lower.includes('golf')) return 'kehidupan_sosial/hobi'
  if (lower.includes('kencan') || lower.includes('date') || lower.includes('dating') || lower.includes('jalan sama doi')) return 'kehidupan_sosial/kencan'
  if (lower.includes('sedekah') || lower.includes('zakat') || lower.includes('infaq') || lower.includes('donasi') || lower.includes('amal')) return 'kehidupan_sosial/amal_donasi'
  if (lower.includes('kondangan') || lower.includes('hadiah nikah') || lower.includes('amplop')) return 'kehidupan_sosial/kondangan'
  if (lower.includes('iuran') || lower.includes('iuran rt') || /\bkas\b/i.test(lower)) return 'kehidupan_sosial/iuran'

  // Entertainment / Kultur
  if (lower.includes('bioskop') || lower.includes('cinema') || lower.includes('xxi') || lower.includes('cgv') || lower.includes('film') || lower.includes('nonton')) return 'kultur/bioskop'
  if (lower.includes('konser') || lower.includes('tiket') || lower.includes('festival')) return 'kultur/konser'
  if (lower.includes('game') || lower.includes('steam') || lower.includes('diamond') || lower.includes('mlbb') || lower.includes('free fire') || lower.includes('valorant') || lower.includes('genshin') || lower.includes('topup game')) return 'kultur/games'
  if (lower.includes('buku') || lower.includes('novel') || lower.includes('komik') || lower.includes('gramedia')) return 'kultur/buku'
  if (lower.includes('liburan') || lower.includes('travel') || lower.includes('hotel') || lower.includes('staycation') || lower.includes('tiket pesawat') || lower.includes('villa')) return 'kultur/liburan'

  // Clothing & Fashion
  if (lower.includes('baju') || lower.includes('kaos') || lower.includes('kemeja') || lower.includes('jaket') || lower.includes('hoodie')) return 'pakaian/baju'
  if (lower.includes('celana') || lower.includes('jeans') || lower.includes('rok')) return 'pakaian/celana'
  if (lower.includes('sepatu') || lower.includes('sandal') || lower.includes('sneakers')) return 'pakaian/sepatu'
  if (lower.includes('aksesoris') || lower.includes('jam tangan') || lower.includes('topi') || /\b(tas|ransel)\b/i.test(lower) || lower.includes('fashion') || lower.includes('belanja')) return 'pakaian/aksesoris_pakaian'

  // Beauty & Care
  if (lower.includes('skincare') || lower.includes('sunscreen') || lower.includes('serum') || lower.includes('toner') || lower.includes('moisturizer')) return 'kecantikan/skincare'
  if (lower.includes('makeup') || lower.includes('lipstik') || lower.includes('cushion') || lower.includes('bedak')) return 'kecantikan/makeup'
  if (lower.includes('potong rambut') || lower.includes('barbershop') || lower.includes('salon') || lower.includes('creambath') || lower.includes('facial')) return 'kecantikan/salon'
  if (lower.includes('parfum') || lower.includes('perfume') || lower.includes('cologne')) return 'kecantikan/parfum'

  // Education
  if (lower.includes('sekolah') || lower.includes('kuliah') || lower.includes('spp') || lower.includes('ukt')) return 'pendidikan/sekolah'
  if (lower.includes('kursus') || lower.includes('les') || lower.includes('pelatihan') || lower.includes('bootcamp') || lower.includes('udemy')) return 'pendidikan/kursus'
  if (lower.includes('buku pelajaran') || lower.includes('modul') || lower.includes('textbook')) return 'pendidikan/buku_pelajaran'
  if (lower.includes('alat tulis') || lower.includes('atk') || lower.includes('fotocopy') || lower.includes('print')) return 'pendidikan/alat_tulis'

  // Health
  if (lower.includes('dokter') || lower.includes('klinik') || lower.includes('rumah sakit') || lower.includes('halodoc') || lower.includes('alodokter')) return 'kesehatan/dokter'
  if (lower.includes('obat') || lower.includes('apotek') || lower.includes('kimia farma') || lower.includes('k24')) return 'kesehatan/obat'
  if (lower.includes('vitamin') || lower.includes('suplemen')) return 'kesehatan/vitamin'
  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('yoga') || lower.includes('olahraga')) return 'kesehatan/gym'

  // Investment (Expense)
  if (lower.includes('beli emas') || lower.includes('antam') || lower.includes('emas batangan')) return 'investasi_pengeluaran/emas'
  if (lower.includes('reksadana') || lower.includes('bibit') || lower.includes('bareksa')) return 'investasi_pengeluaran/reksadana'
  if (lower.includes('saham') || lower.includes('ajaib') || lower.includes('stockbit')) return 'investasi_pengeluaran/saham'
  if (lower.includes('crypto') || lower.includes('kripto') || lower.includes('binance') || lower.includes('indodax') || lower.includes('tokocrypto')) return 'investasi_pengeluaran/crypto'
  if (lower.includes('deposito')) return 'investasi_pengeluaran/deposito'
  if (lower.includes('biaya admin') || /\badm\b/i.test(lower) || lower.includes('pajak')) return 'lainnya_kategori/pajak'

  return 'lainnya_kategori/umum'
}
