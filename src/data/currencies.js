export const CURRENCIES = [
  {
    code: 'IDR',
    name: 'Indonesian Rupiah',
    nameId: 'Rupiah Indonesia',
    symbol: 'Rp',
    country: 'Indonesia',
    countryId: 'Indonesia',
    flag: 'id',
  },
  {
    code: 'USD',
    name: 'US Dollar',
    nameId: 'Dolar Amerika Serikat',
    symbol: '$',
    country: 'United States',
    countryId: 'Amerika Serikat',
    flag: 'us',
  },
  {
    code: 'EUR',
    name: 'Euro',
    nameId: 'Euro Uni Eropa',
    symbol: '€',
    country: 'European Union',
    countryId: 'Uni Eropa',
    flag: 'eu',
  },
  {
    code: 'SGD',
    name: 'Singapore Dollar',
    nameId: 'Dolar Singapura',
    symbol: 'S$',
    country: 'Singapore',
    countryId: 'Singapura',
    flag: 'sg',
  },
  {
    code: 'MYR',
    name: 'Malaysian Ringgit',
    nameId: 'Ringgit Malaysia',
    symbol: 'RM',
    country: 'Malaysia',
    countryId: 'Malaysia',
    flag: 'my',
  },
  {
    code: 'JPY',
    name: 'Japanese Yen',
    nameId: 'Yen Jepang',
    symbol: '¥',
    country: 'Japan',
    countryId: 'Jepang',
    flag: 'jp',
  },
  {
    code: 'GBP',
    name: 'British Pound',
    nameId: 'Pound Sterling Inggris',
    symbol: '£',
    country: 'United Kingdom',
    countryId: 'Inggris Raya',
    flag: 'gb',
  },
  {
    code: 'AUD',
    name: 'Australian Dollar',
    nameId: 'Dolar Australia',
    symbol: 'A$',
    country: 'Australia',
    countryId: 'Australia',
    flag: 'au',
  },
  {
    code: 'SAR',
    name: 'Saudi Riyal',
    nameId: 'Riyal Arab Saudi',
    symbol: 'SR',
    country: 'Saudi Arabia',
    countryId: 'Arab Saudi',
    flag: 'sa',
  },
  {
    code: 'CNY',
    name: 'Chinese Yuan',
    nameId: 'Yuan Tiongkok',
    symbol: '¥',
    country: 'China',
    countryId: 'Tiongkok',
    flag: 'cn',
  },
  {
    code: 'KRW',
    name: 'South Korean Won',
    nameId: 'Won Korea Selatan',
    symbol: '₩',
    country: 'South Korea',
    countryId: 'Korea Selatan',
    flag: 'kr',
  },
  {
    code: 'CHF',
    name: 'Swiss Franc',
    nameId: 'Franc Swiss',
    symbol: 'CHF',
    country: 'Switzerland',
    countryId: 'Swiss',
    flag: 'ch',
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    nameId: 'Dolar Kanada',
    symbol: 'C$',
    country: 'Canada',
    countryId: 'Kanada',
    flag: 'ca',
  },
  {
    code: 'THB',
    name: 'Thai Baht',
    nameId: 'Baht Thailand',
    symbol: '฿',
    country: 'Thailand',
    countryId: 'Thailand',
    flag: 'th',
  },
  {
    code: 'HKD',
    name: 'Hong Kong Dollar',
    nameId: 'Dolar Hong Kong',
    symbol: 'HK$',
    country: 'Hong Kong',
    countryId: 'Hong Kong',
    flag: 'hk',
  },
  {
    code: 'AED',
    name: 'UAE Dirham',
    nameId: 'Dirham Uni Emirat Arab',
    symbol: 'AED',
    country: 'United Arab Emirates',
    countryId: 'Uni Emirat Arab',
    flag: 'ae',
  },
  {
    code: 'INR',
    name: 'Indian Rupee',
    nameId: 'Rupee India',
    symbol: '₹',
    country: 'India',
    countryId: 'India',
    flag: 'in',
  },
  {
    code: 'PHP',
    name: 'Philippine Peso',
    nameId: 'Peso Filipina',
    symbol: '₱',
    country: 'Philippines',
    countryId: 'Filipina',
    flag: 'ph',
  },
  {
    code: 'VND',
    name: 'Vietnamese Dong',
    nameId: 'Dong Vietnam',
    symbol: '₫',
    country: 'Vietnam',
    countryId: 'Vietnam',
    flag: 'vn',
  },
  {
    code: 'BRL',
    name: 'Brazilian Real',
    nameId: 'Real Brasil',
    symbol: 'R$',
    country: 'Brazil',
    countryId: 'Brasil',
    flag: 'br',
  },
]

export const POPULAR_CURRENCY_CODES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP', 'AUD', 'SAR']

export function getCurrencyInfo(code) {
  if (!code) return CURRENCIES[0]
  const upper = String(code).toUpperCase()
  return (
    CURRENCIES.find((c) => c.code === upper) || {
      code: upper,
      name: upper,
      nameId: upper,
      symbol: upper,
      country: upper,
      countryId: upper,
      flag: 'un',
    }
  )
}

export function getCurrencyName(code, locale = 'id') {
  const info = getCurrencyInfo(code)
  return locale === 'id' ? info.nameId : info.name
}

export function getCurrencyCountry(code, locale = 'id') {
  const info = getCurrencyInfo(code)
  return locale === 'id' ? info.countryId : info.country
}

export function getCurrencySymbol(code) {
  return getCurrencyInfo(code).symbol
}
