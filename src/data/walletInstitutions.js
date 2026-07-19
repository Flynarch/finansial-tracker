const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN
const getLogoUrl = (domain) => `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`

export const walletInstitutions = [
  // Bank - Recommended
  { id: 'bca', name: 'BCA', type: 'bank', logoUrl: getLogoUrl('bca.co.id'), isRecommended: true },
  { id: 'mandiri', name: 'Mandiri', type: 'bank', logoUrl: getLogoUrl('bankmandiri.co.id'), isRecommended: true },
  { id: 'bni', name: 'BNI', type: 'bank', logoUrl: getLogoUrl('bni.co.id'), isRecommended: true },
  
  // Bank - Others
  { id: 'bri', name: 'BRI', type: 'bank', logoUrl: getLogoUrl('bri.co.id'), isRecommended: false },
  { id: 'bsi', name: 'BSI', type: 'bank', logoUrl: getLogoUrl('bankbsi.co.id'), isRecommended: false },
  { id: 'cimb', name: 'CIMB Niaga', type: 'bank', logoUrl: getLogoUrl('cimbniaga.co.id'), isRecommended: false },
  { id: 'jago', name: 'Bank Jago', type: 'bank', logoUrl: getLogoUrl('jago.com'), isRecommended: false },
  { id: 'seabank', name: 'SeaBank', type: 'bank', logoUrl: getLogoUrl('seabank.co.id'), isRecommended: false },
  
  // E-Wallet
  { id: 'gopay', name: 'GoPay', type: 'ewallet', logoUrl: getLogoUrl('gopay.co.id'), isRecommended: false },
  { id: 'ovo', name: 'OVO', type: 'ewallet', logoUrl: getLogoUrl('ovo.id'), isRecommended: false },
  { id: 'dana', name: 'DANA', type: 'ewallet', logoUrl: getLogoUrl('dana.id'), isRecommended: false },
  { id: 'shopeepay', name: 'ShopeePay', type: 'ewallet', logoUrl: getLogoUrl('shopeepay.co.id'), isRecommended: false },
  { id: 'linkaja', name: 'LinkAja', type: 'ewallet', logoUrl: getLogoUrl('linkaja.id'), isRecommended: false },
  
  // Investasi
  { id: 'bibit', name: 'Bibit', type: 'investasi', logoUrl: getLogoUrl('bibit.id'), isRecommended: false },
  { id: 'ajaib', name: 'Ajaib', type: 'investasi', logoUrl: getLogoUrl('ajaib.co.id'), isRecommended: false },
  { id: 'bareksa', name: 'Bareksa', type: 'investasi', logoUrl: getLogoUrl('bareksa.com'), isRecommended: false },
  { id: 'stockbit', name: 'Stockbit', type: 'investasi', logoUrl: getLogoUrl('stockbit.com'), isRecommended: false },
  
  // Lainnya
  { id: 'cash', name: 'Cash', type: 'lainnya', logoUrl: '', isRecommended: false, subtitle: 'International', customIcon: 'dollar' },
]
