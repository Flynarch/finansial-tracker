const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN
const getLogoUrl = (domain) => `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`

export const BRI_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2300529C"/><path d="M22 68 V32 H48 C58 32 64 37 64 43 C64 47 61 50 56 52 C63 54 67 58 67 63 C67 70 60 75 48 75 H22 Z M35 48 H46 C51 48 54 46 54 43 C54 40 51 38 46 38 H35 V48 Z M35 68 H48 C53 68 57 66 57 62 C57 58 53 56 48 56 H35 V68 Z" fill="white"/><path d="M72 32 H80 V75 H72 Z" fill="%23F37021"/></svg>`

export function getWalletLogoUrl(wallet) {
  if (!wallet) return ''
  const name = String(wallet.name || '').toLowerCase()
  const inst = String(wallet.institutionType || wallet.id || '').toLowerCase()
  const url = String(wallet.logoUrl || '')

  if (name.includes('bri') || inst.includes('bri') || url.includes('bri.co.id')) {
    return BRI_CUSTOM_LOGO
  }
  return wallet.logoUrl || ''
}

export const walletInstitutions = [
  // Bank Utama / Recommended
  { id: 'bca', name: 'BCA', type: 'bank', logoUrl: getLogoUrl('bca.co.id'), isRecommended: true },
  { id: 'mandiri', name: 'Mandiri', type: 'bank', logoUrl: getLogoUrl('bankmandiri.co.id'), isRecommended: true },
  { id: 'bni', name: 'BNI', type: 'bank', logoUrl: getLogoUrl('bni.co.id'), isRecommended: true },
  { id: 'bri', name: 'BRI', type: 'bank', logoUrl: BRI_CUSTOM_LOGO, isRecommended: true },
  { id: 'jago', name: 'Bank Jago', type: 'bank', logoUrl: getLogoUrl('jago.com'), isRecommended: true },
  { id: 'seabank', name: 'SeaBank', type: 'bank', logoUrl: getLogoUrl('seabank.co.id'), isRecommended: true },
  
  // Bank Lainnya & Bank Digital
  { id: 'bsi', name: 'BSI', type: 'bank', logoUrl: getLogoUrl('bankbsi.co.id'), isRecommended: false },
  { id: 'cimb', name: 'CIMB Niaga', type: 'bank', logoUrl: getLogoUrl('cimbniaga.co.id'), isRecommended: false },
  { id: 'jenius', name: 'Jenius (BTPN)', type: 'bank', logoUrl: getLogoUrl('jenius.com'), isRecommended: false },
  { id: 'blu', name: 'blu (BCA Digital)', type: 'bank', logoUrl: getLogoUrl('bcadigital.co.id'), isRecommended: false },
  { id: 'neobank', name: 'NeoBank (BNC)', type: 'bank', logoUrl: getLogoUrl('bankneocommerce.co.id'), isRecommended: false },
  { id: 'allobank', name: 'Allo Bank', type: 'bank', logoUrl: getLogoUrl('allobank.com'), isRecommended: false },
  { id: 'btn', name: 'Bank BTN', type: 'bank', logoUrl: getLogoUrl('btn.co.id'), isRecommended: false },
  { id: 'permata', name: 'PermataBank', type: 'bank', logoUrl: getLogoUrl('permatabank.com'), isRecommended: false },
  { id: 'danamon', name: 'Bank Danamon', type: 'bank', logoUrl: getLogoUrl('danamon.co.id'), isRecommended: false },
  { id: 'mega', name: 'Bank Mega', type: 'bank', logoUrl: getLogoUrl('bankmega.com'), isRecommended: false },
  { id: 'sinarmas', name: 'Bank Sinarmas', type: 'bank', logoUrl: getLogoUrl('banksinarmas.com'), isRecommended: false },
  { id: 'panin', name: 'Panin Bank', type: 'bank', logoUrl: getLogoUrl('panin.co.id'), isRecommended: false },
  
  // E-Wallet & PayLater
  { id: 'gopay', name: 'GoPay', type: 'ewallet', logoUrl: getLogoUrl('gopay.co.id'), isRecommended: true },
  { id: 'ovo', name: 'OVO', type: 'ewallet', logoUrl: getLogoUrl('ovo.id'), isRecommended: true },
  { id: 'dana', name: 'DANA', type: 'ewallet', logoUrl: getLogoUrl('dana.id'), isRecommended: true },
  { id: 'shopeepay', name: 'ShopeePay', type: 'ewallet', logoUrl: getLogoUrl('shopeepay.co.id'), isRecommended: false },
  { id: 'linkaja', name: 'LinkAja', type: 'ewallet', logoUrl: getLogoUrl('linkaja.id'), isRecommended: false },
  { id: 'astrapay', name: 'AstraPay', type: 'ewallet', logoUrl: getLogoUrl('astrapay.com'), isRecommended: false },
  { id: 'isaku', name: 'iSAKU (Indomaret)', type: 'ewallet', logoUrl: getLogoUrl('isaku-indomaret.com'), isRecommended: false },
  { id: 'paypal', name: 'PayPal', type: 'ewallet', logoUrl: getLogoUrl('paypal.com'), isRecommended: false },
  { id: 'kredivo', name: 'Kredivo / PayLater', type: 'ewallet', logoUrl: getLogoUrl('kredivo.com'), isRecommended: false },
  
  // Investasi & Crypto
  { id: 'bibit', name: 'Bibit', type: 'investasi', logoUrl: getLogoUrl('bibit.id'), isRecommended: false },
  { id: 'ajaib', name: 'Ajaib', type: 'investasi', logoUrl: getLogoUrl('ajaib.co.id'), isRecommended: false },
  { id: 'bareksa', name: 'Bareksa', type: 'investasi', logoUrl: getLogoUrl('bareksa.com'), isRecommended: false },
  { id: 'stockbit', name: 'Stockbit', type: 'investasi', logoUrl: getLogoUrl('stockbit.com'), isRecommended: false },
  { id: 'pintu', name: 'Pintu Crypto', type: 'investasi', logoUrl: getLogoUrl('pintu.co.id'), isRecommended: false },
  { id: 'indodax', name: 'Indodax', type: 'investasi', logoUrl: getLogoUrl('indodax.com'), isRecommended: false },
  { id: 'pluang', name: 'Pluang', type: 'investasi', logoUrl: getLogoUrl('pluang.com'), isRecommended: false },
  { id: 'tokocrypto', name: 'Tokocrypto', type: 'investasi', logoUrl: getLogoUrl('tokocrypto.com'), isRecommended: false },
  { id: 'binance', name: 'Binance', type: 'investasi', logoUrl: getLogoUrl('binance.com'), isRecommended: false },
  { id: 'pegadaian', name: 'Pegadaian (Emas)', type: 'investasi', logoUrl: getLogoUrl('pegadaian.co.id'), isRecommended: false },
  
  // Lainnya
  { id: 'cash', name: 'Uang Tunai (Cash)', type: 'lainnya', logoUrl: '', isRecommended: true, subtitle: 'International', customIcon: 'dollar' },
]
