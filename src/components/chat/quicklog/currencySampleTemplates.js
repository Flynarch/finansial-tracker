import { getFrequentUserEntities } from '../../../lib/ai/entityMemory'

export const CURRENCY_SAMPLE_TEMPLATES = {
  IDR: {
    id: [
      'Makan siang 35rb',
      'Gaji 5jt',
      'Sarapan 25rb',
      'Uang saku 50rb',
      'Bensin 30rb',
      'Belanja bulanan 250rb',
      'Token listrik 100rb',
      'Nongkrong 45rb',
      'Dapat cashback 15rb',
      'Beli pulsa 50rb',
      'Bayar WiFi 300rb',
      'Makan malam 60rb',
      'Beli snack 20rb',
      'Bayar langganan 186rb',
    ],
    en: [
      'Lunch 35k IDR',
      'Salary 5M IDR',
      'Breakfast 25k IDR',
      'Pocket money 50k IDR',
      'Gas 30k IDR',
      'Groceries 250k IDR',
      'Electricity 100k IDR',
      'Hangout 45k IDR',
      'Cashback 15k IDR',
      'Mobile data 50k IDR',
      'WiFi bill 300k IDR',
      'Dinner 60k IDR',
      'Snacks 20k IDR',
      'Subscription 186k IDR',
    ],
  },
  USD: {
    id: [
      'Makan siang $5',
      'Gaji $3000',
      'Sarapan $4',
      'Uang saku $20',
      'Bensin $25',
      'Belanja bulanan $60',
      'Token listrik $30',
      'Nongkrong $15',
      'Dapat cashback $5',
      'Beli pulsa $10',
      'Bayar WiFi $40',
      'Makan malam $18',
      'Beli snack $4',
      'Bayar langganan $12',
    ],
    en: [
      'Lunch $5',
      'Salary $3000',
      'Breakfast $4',
      'Pocket money $20',
      'Gas $25',
      'Groceries $60',
      'Electricity bill $30',
      'Hangout $15',
      'Cashback $5',
      'Mobile top-up $10',
      'WiFi bill $40',
      'Dinner $18',
      'Snacks $4',
      'Subscription $12',
    ],
  },
  EUR: {
    id: [
      'Makan siang €5',
      'Gaji €2800',
      'Sarapan €4',
      'Uang saku €20',
      'Bensin €25',
      'Belanja bulanan €55',
      'Token listrik €28',
      'Nongkrong €15',
      'Dapat cashback €5',
      'Beli pulsa €10',
      'Bayar WiFi €35',
      'Makan malam €16',
      'Beli snack €4',
      'Bayar langganan €12',
    ],
    en: [
      'Lunch €5',
      'Salary €2800',
      'Breakfast €4',
      'Pocket money €20',
      'Gas €25',
      'Groceries €55',
      'Electricity bill €28',
      'Hangout €15',
      'Cashback €5',
      'Mobile top-up €10',
      'WiFi bill €35',
      'Dinner €16',
      'Snacks €4',
      'Subscription €12',
    ],
  },
  SGD: {
    id: [
      'Makan siang S$6',
      'Gaji S$4000',
      'Sarapan S$4',
      'Uang saku S$25',
      'Bensin S$30',
      'Belanja bulanan S$70',
      'Token listrik S$35',
      'Nongkrong S$18',
      'Dapat cashback S$6',
      'Beli pulsa S$12',
      'Bayar WiFi S$45',
      'Makan malam S$20',
      'Beli snack S$5',
      'Bayar langganan S$15',
    ],
    en: [
      'Lunch S$6',
      'Salary S$4000',
      'Breakfast S$4',
      'Pocket money S$25',
      'Gas S$30',
      'Groceries S$70',
      'Electricity bill S$35',
      'Hangout S$18',
      'Cashback S$6',
      'Mobile top-up S$12',
      'WiFi bill S$45',
      'Dinner S$20',
      'Snacks S$5',
      'Subscription S$15',
    ],
  },
  MYR: {
    id: [
      'Makan siang RM15',
      'Gaji RM3500',
      'Sarapan RM10',
      'Uang saku RM40',
      'Bensin RM30',
      'Belanja bulanan RM150',
      'Token listrik RM60',
      'Nongkrong RM30',
      'Dapat cashback RM10',
      'Beli pulsa RM20',
      'Bayar WiFi RM90',
      'Makan malam RM35',
      'Beli snack RM8',
      'Bayar langganan RM35',
    ],
    en: [
      'Lunch RM15',
      'Salary RM3500',
      'Breakfast RM10',
      'Pocket money RM40',
      'Gas RM30',
      'Groceries RM150',
      'Electricity bill RM60',
      'Hangout RM30',
      'Cashback RM10',
      'Mobile top-up RM20',
      'WiFi bill RM90',
      'Dinner RM35',
      'Snacks RM8',
      'Subscription RM35',
    ],
  },
  JPY: {
    id: [
      'Makan siang ¥800',
      'Gaji ¥300.000',
      'Sarapan ¥450',
      'Uang saku ¥3.000',
      'Bensin ¥3.500',
      'Belanja bulanan ¥8.000',
      'Token listrik ¥4.500',
      'Nongkrong ¥2.000',
      'Dapat cashback ¥500',
      'Beli pulsa ¥2.000',
      'Bayar WiFi ¥4.500',
      'Makan malam ¥1.800',
      'Beli snack ¥400',
      'Bayar langganan ¥1.500',
    ],
    en: [
      'Lunch ¥800',
      'Salary ¥300,000',
      'Breakfast ¥450',
      'Pocket money ¥3,000',
      'Gas ¥3,500',
      'Groceries ¥8,000',
      'Electricity bill ¥4,500',
      'Hangout ¥2,000',
      'Cashback ¥500',
      'Mobile top-up ¥2,000',
      'WiFi bill ¥4,500',
      'Dinner ¥1,800',
      'Snacks ¥400',
      'Subscription ¥1,500',
    ],
  },
  GBP: {
    id: [
      'Makan siang £5',
      'Gaji £2500',
      'Sarapan £4',
      'Uang saku £20',
      'Bensin £25',
      'Belanja bulanan £50',
      'Token listrik £25',
      'Nongkrong £15',
      'Dapat cashback £5',
      'Beli pulsa £10',
      'Bayar WiFi £30',
      'Makan malam £15',
      'Beli snack £3',
      'Bayar langganan £10',
    ],
    en: [
      'Lunch £5',
      'Salary £2500',
      'Breakfast £4',
      'Pocket money £20',
      'Gas £25',
      'Groceries £50',
      'Electricity bill £25',
      'Hangout £15',
      'Cashback £5',
      'Mobile top-up £10',
      'WiFi bill £30',
      'Dinner £15',
      'Snacks £3',
      'Subscription £10',
    ],
  },
}

function formatShortAmount(amount, currency = 'IDR') {
  if (!amount || amount <= 0) return ''
  if (currency === 'IDR') {
    if (amount >= 1000000) {
      const jt = amount / 1000000
      return `${Number.isInteger(jt) ? jt : jt.toFixed(1)}jt`
    }
    if (amount >= 1000) {
      const rb = amount / 1000
      return `${Number.isInteger(rb) ? rb : rb.toFixed(1)}rb`
    }
    return `${amount}`
  }
  if (amount >= 1000) {
    const k = amount / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k ${currency}`
  }
  return `${amount} ${currency}`
}

export function generateSampleChips(userWallets = [], currency = 'IDR', locale = 'id') {
  const walletNames = (userWallets || []).map((w) => w.name).filter(Boolean)
  const currencySet = CURRENCY_SAMPLE_TEMPLATES[currency] || CURRENCY_SAMPLE_TEMPLATES.IDR
  const baseTitles = [...(currencySet[locale] || currencySet.id || CURRENCY_SAMPLE_TEMPLATES.IDR.id)]

  // 1. Time-of-day reordering
  const currentHour = new Date().getHours()
  let timeKeywords
  if (currentHour >= 5 && currentHour < 11) {
    // Pagi
    timeKeywords = ['sarapan', 'breakfast', 'kopi', 'coffee', 'bensin', 'gas', 'saku', 'pocket']
  } else if (currentHour >= 11 && currentHour < 15) {
    // Siang
    timeKeywords = ['siang', 'lunch', 'snack', 'nongkrong', 'hangout']
  } else {
    // Sore / Malam
    timeKeywords = ['malam', 'dinner', 'belanja', 'groceries', 'token', 'wifi', 'pulsa', 'langganan']
  }

  const prioritized = []
  const remaining = []
  for (const title of baseTitles) {
    const lower = title.toLowerCase()
    if (timeKeywords.some((kw) => lower.includes(kw))) {
      prioritized.push(title)
    } else {
      remaining.push(title)
    }
  }
  const orderedTitles = [...prioritized, ...remaining]

  // 2. Distribute wallets across base titles
  const formattedBaseChips = orderedTitles.map((title, idx) => {
    if (walletNames.length === 0) return title
    const assignedWallet = walletNames[idx % walletNames.length]
    return `${title} ${assignedWallet}`
  })

  // 3. Entity Memory Integration: Prepend user's top frequent transactions
  let personalizedChips = []
  try {
    const frequentEntities = getFrequentUserEntities(3)
    if (Array.isArray(frequentEntities) && frequentEntities.length > 0) {
      personalizedChips = frequentEntities
        .map((ent) => {
          if (!ent?.name) return null
          const cleanName = String(ent.name).trim()
          if (cleanName.length < 2) return null
          const amtStr = ent.lastAmount ? formatShortAmount(ent.lastAmount, currency) : ''
          const entWallet = userWallets.find((w) => String(w.id) === String(ent.walletId))
          const walletSuffix = entWallet?.name ? ` ${entWallet.name}` : ''
          return amtStr ? `${cleanName} ${amtStr}${walletSuffix}` : `${cleanName}${walletSuffix}`
        })
        .filter(Boolean)
    }
  } catch {
    // Defensive fallback
  }

  const allChips = [...personalizedChips, ...formattedBaseChips]
  // Remove duplicates while preserving order
  return Array.from(new Set(allChips))
}

export function getInputPlaceholder(defaultCurrency, locale) {
  if (defaultCurrency === 'USD') {
    return locale === 'en'
      ? 'e.g., Lunch $12 & gas $20 with Cash...'
      : 'Contoh: Makan siang $5 & bensin $20 pakai Cash...'
  }
  if (defaultCurrency === 'EUR') {
    return locale === 'en'
      ? 'e.g., Lunch €12 & gas €20 with Card...'
      : 'Contoh: Makan siang €5 & bensin €20 pakai Rekening...'
  }
  if (defaultCurrency === 'SGD') {
    return locale === 'en'
      ? 'e.g., Lunch S$6 & taxi S$15 with DBS...'
      : 'Contoh: Makan siang S$6 & bensin S$25 pakai DBS...'
  }
  if (defaultCurrency === 'MYR') {
    return locale === 'en'
      ? 'e.g., Lunch RM15 & gas RM30 with Maybank...'
      : 'Contoh: Makan siang RM15 & bensin RM30 pakai Touch n Go...'
  }
  if (defaultCurrency === 'JPY') {
    return locale === 'en'
      ? 'e.g., Lunch ¥800 & gas ¥3000 with Suica...'
      : 'Contoh: Makan siang ¥800 & bensin ¥3000 pakai Cash...'
  }
  if (defaultCurrency === 'GBP') {
    return locale === 'en'
      ? 'e.g., Lunch £6 & groceries £20 with Monzo...'
      : 'Contoh: Makan siang £5 & bensin £20 pakai Bank...'
  }
  return locale === 'en'
    ? 'e.g., Lunch 35k IDR & gas 25k IDR with GoPay...'
    : 'Contoh: Makan siang 35rb & bensin 25rb pakai GoPay...'
}

export function isObviousNonTransaction(text) {
  if (!text) return false
  const lower = text.trim().toLowerCase()

  const isQuestion = lower.endsWith('?') || lower.includes('?')
  const questionWords = [
    'berapa', 'bagaimana', 'gimana', 'kenapa', 'mengapa', 'siapa',
    'apa itu', 'apakah', 'tips', 'saran', 'rekomendasi', 'analisa',
    'analisis', 'laporan', 'grafik', 'ringkasan', 'evaluasi', 'curhat',
    'halo', 'hai', 'hello', 'selamat pagi', 'selamat siang', 'selamat malam',
  ]
  const hasQuestionWord = questionWords.some((w) => lower.startsWith(w) || lower.includes(` ${w} `) || lower.startsWith(`${w} `))

  const hasAmountPattern =
    /\b\d+(\.\d{3})*(k|rb|ribu|jt|juta)?\b/i.test(lower) &&
    (/(rp|\$|k|rb|ribu|jt|juta)/i.test(lower) || /\d{3,}/.test(lower))

  if ((isQuestion || hasQuestionWord) && !hasAmountPattern) {
    return true
  }
  return false
}
