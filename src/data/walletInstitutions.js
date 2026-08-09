const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN
const getLogoUrl = (domain) => `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`

// Modern Official Bank BRI Logo Vector (Royal Blue & Orange emblem)
export const BRI_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="30" fill="%2300529C"/><path d="M25 82V38h28c11 0 18 5 18 13 0 5-4 9-9 11 7 2 11 7 11 14 0 10-8 16-22 16H25zm16-28h11c5 0 8-2 8-5s-3-5-8-5H41v10zm0 20h12c6 0 10-3 10-7s-4-6-10-6H41v13z" fill="white"/><rect x="85" y="38" width="12" height="44" rx="2" fill="%23F37021"/></svg>`

export function getWalletLogoUrl(wallet) {
  if (!wallet) return ''
  const name = String(wallet.name || '').toLowerCase()
  const inst = String(wallet.institutionType || wallet.id || '').toLowerCase()
  const url = String(wallet.logoUrl || '')

  if (name.includes('bri') || inst.includes('bri') || url.includes('bri.co.id')) {
    return getLogoUrl('bri.co.id') || BRI_CUSTOM_LOGO
  }
  return wallet.logoUrl || ''
}

export const walletInstitutions = [
  // ── 1. Bank Utama & Digital Indonesia ──────────────────────────────────
  { id: 'bca', name: 'BCA', type: 'bank', logoUrl: getLogoUrl('bca.co.id'), isRecommended: true },
  { id: 'mandiri', name: 'Mandiri', type: 'bank', logoUrl: getLogoUrl('bankmandiri.co.id'), isRecommended: true },
  { id: 'bni', name: 'BNI', type: 'bank', logoUrl: getLogoUrl('bni.co.id'), isRecommended: true },
  { id: 'bri', name: 'BRI', type: 'bank', logoUrl: getLogoUrl('bri.co.id'), isRecommended: true },
  { id: 'jago', name: 'Bank Jago', type: 'bank', logoUrl: getLogoUrl('jago.com'), isRecommended: true },
  { id: 'seabank', name: 'SeaBank', type: 'bank', logoUrl: getLogoUrl('seabank.co.id'), isRecommended: true },
  { id: 'bsi', name: 'BSI (Bank Syariah Indonesia)', type: 'bank', logoUrl: getLogoUrl('bankbsi.co.id'), isRecommended: true },

  // Bank Digital & Swasta
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
  { id: 'muamalat', name: 'Bank Muamalat', type: 'bank', logoUrl: getLogoUrl('bankmuamalat.co.id'), isRecommended: false },
  { id: 'ocbc', name: 'OCBC NISP', type: 'bank', logoUrl: getLogoUrl('ocbc.id'), isRecommended: false },
  { id: 'maybank', name: 'Maybank Indonesia', type: 'bank', logoUrl: getLogoUrl('maybank.co.id'), isRecommended: false },
  { id: 'dbs', name: 'digibank (DBS)', type: 'bank', logoUrl: getLogoUrl('dbs.id'), isRecommended: false },
  { id: 'kbbukopin', name: 'KB Bank (Bukopin)', type: 'bank', logoUrl: getLogoUrl('kbbukopin.com'), isRecommended: false },
  { id: 'uob', name: 'UOB Indonesia', type: 'bank', logoUrl: getLogoUrl('uob.co.id'), isRecommended: false },
  { id: 'hsbc', name: 'HSBC Indonesia', type: 'bank', logoUrl: getLogoUrl('hsbc.co.id'), isRecommended: false },
  { id: 'scb', name: 'Standard Chartered', type: 'bank', logoUrl: getLogoUrl('sc.com'), isRecommended: false },
  { id: 'bankraya', name: 'Bank Raya', type: 'bank', logoUrl: getLogoUrl('bankraya.co.id'), isRecommended: false },
  { id: 'krom', name: 'Krom Digital Bank', type: 'bank', logoUrl: getLogoUrl('krom.id'), isRecommended: false },
  { id: 'superbank', name: 'Superbank', type: 'bank', logoUrl: getLogoUrl('superbank.id'), isRecommended: false },
  { id: 'linebank', name: 'Line Bank (Hana)', type: 'bank', logoUrl: getLogoUrl('linebank.co.id'), isRecommended: false },
  { id: 'banksaqu', name: 'Bank Saqu', type: 'bank', logoUrl: getLogoUrl('banksaqu.co.id'), isRecommended: false },
  { id: 'commbank', name: 'Commonwealth Bank', type: 'bank', logoUrl: getLogoUrl('commbank.co.id'), isRecommended: false },
  { id: 'mayapada', name: 'Bank Mayapada', type: 'bank', logoUrl: getLogoUrl('mayapadabank.co.id'), isRecommended: false },

  // Bank Daerah (BPD)
  { id: 'bankdki', name: 'Bank DKI', type: 'bank', logoUrl: getLogoUrl('bankdki.co.id'), isRecommended: false },
  { id: 'bankbjb', name: 'Bank BJB', type: 'bank', logoUrl: getLogoUrl('bankbjb.co.id'), isRecommended: false },
  { id: 'bankjateng', name: 'Bank Jateng', type: 'bank', logoUrl: getLogoUrl('bankjateng.co.id'), isRecommended: false },
  { id: 'bankjatim', name: 'Bank Jatim', type: 'bank', logoUrl: getLogoUrl('bankjatim.co.id'), isRecommended: false },
  { id: 'banknagari', name: 'Bank Nagari', type: 'bank', logoUrl: getLogoUrl('banknagari.co.id'), isRecommended: false },
  { id: 'banksumut', name: 'Bank Sumut', type: 'bank', logoUrl: getLogoUrl('banksumut.co.id'), isRecommended: false },

  // ── 2. E-Wallet, Fintech & PayLater ────────────────────────────────────
  { id: 'gopay', name: 'GoPay', type: 'ewallet', logoUrl: getLogoUrl('gopay.co.id'), isRecommended: true },
  { id: 'ovo', name: 'OVO', type: 'ewallet', logoUrl: getLogoUrl('ovo.id'), isRecommended: true },
  { id: 'dana', name: 'DANA', type: 'ewallet', logoUrl: getLogoUrl('dana.id'), isRecommended: true },
  { id: 'shopeepay', name: 'ShopeePay', type: 'ewallet', logoUrl: getLogoUrl('shopeepay.co.id'), isRecommended: true },
  { id: 'linkaja', name: 'LinkAja', type: 'ewallet', logoUrl: getLogoUrl('linkaja.id'), isRecommended: false },
  { id: 'astrapay', name: 'AstraPay', type: 'ewallet', logoUrl: getLogoUrl('astrapay.com'), isRecommended: false },
  { id: 'isaku', name: 'iSAKU (Indomaret)', type: 'ewallet', logoUrl: getLogoUrl('isaku-indomaret.com'), isRecommended: false },
  { id: 'doku', name: 'DOKU Wallet', type: 'ewallet', logoUrl: getLogoUrl('doku.com'), isRecommended: false },
  { id: 'sakuku', name: 'Sakuku BCA', type: 'ewallet', logoUrl: getLogoUrl('bca.co.id'), isRecommended: false },
  { id: 'jakonepay', name: 'JakOne Pay', type: 'ewallet', logoUrl: getLogoUrl('jakone.mobi'), isRecommended: false },
  { id: 'motionpay', name: 'MotionPay', type: 'ewallet', logoUrl: getLogoUrl('motionpay.id'), isRecommended: false },
  { id: 'paypal', name: 'PayPal', type: 'ewallet', logoUrl: getLogoUrl('paypal.com'), isRecommended: false },
  { id: 'wise', name: 'Wise (TransferWise)', type: 'ewallet', logoUrl: getLogoUrl('wise.com'), isRecommended: false },
  { id: 'revolut', name: 'Revolut', type: 'ewallet', logoUrl: getLogoUrl('revolut.com'), isRecommended: false },
  { id: 'kredivo', name: 'Kredivo / PayLater', type: 'ewallet', logoUrl: getLogoUrl('kredivo.com'), isRecommended: false },
  { id: 'akulaku', name: 'Akulaku PayLater', type: 'ewallet', logoUrl: getLogoUrl('akulaku.com'), isRecommended: false },
  { id: 'spaylater', name: 'SPayLater (Shopee)', type: 'ewallet', logoUrl: getLogoUrl('shopee.co.id'), isRecommended: false },
  { id: 'gopaylater', name: 'GoPayLater', type: 'ewallet', logoUrl: getLogoUrl('gojek.com'), isRecommended: false },
  { id: 'indodana', name: 'Indodana PayLater', type: 'ewallet', logoUrl: getLogoUrl('indodana.id'), isRecommended: false },
  { id: 'atome', name: 'Atome PayLater', type: 'ewallet', logoUrl: getLogoUrl('atome.id'), isRecommended: false },

  // ── 3. Investasi, Reksadana & Crypto ──────────────────────────────────
  { id: 'bibit', name: 'Bibit', type: 'investasi', logoUrl: getLogoUrl('bibit.id'), isRecommended: false },
  { id: 'ajaib', name: 'Ajaib Sekuritas', type: 'investasi', logoUrl: getLogoUrl('ajaib.co.id'), isRecommended: false },
  { id: 'bareksa', name: 'Bareksa', type: 'investasi', logoUrl: getLogoUrl('bareksa.com'), isRecommended: false },
  { id: 'stockbit', name: 'Stockbit', type: 'investasi', logoUrl: getLogoUrl('stockbit.com'), isRecommended: false },
  { id: 'pintu', name: 'Pintu Crypto', type: 'investasi', logoUrl: getLogoUrl('pintu.co.id'), isRecommended: false },
  { id: 'indodax', name: 'Indodax', type: 'investasi', logoUrl: getLogoUrl('indodax.com'), isRecommended: false },
  { id: 'pluang', name: 'Pluang', type: 'investasi', logoUrl: getLogoUrl('pluang.com'), isRecommended: false },
  { id: 'tokocrypto', name: 'Tokocrypto', type: 'investasi', logoUrl: getLogoUrl('tokocrypto.com'), isRecommended: false },
  { id: 'binance', name: 'Binance', type: 'investasi', logoUrl: getLogoUrl('binance.com'), isRecommended: false },
  { id: 'bybit', name: 'Bybit Crypto', type: 'investasi', logoUrl: getLogoUrl('bybit.com'), isRecommended: false },
  { id: 'luno', name: 'Luno Crypto', type: 'investasi', logoUrl: getLogoUrl('luno.com'), isRecommended: false },
  { id: 'pegadaian', name: 'Pegadaian Digital (Emas)', type: 'investasi', logoUrl: getLogoUrl('pegadaian.co.id'), isRecommended: false },
  { id: 'treasury', name: 'Treasury Emas', type: 'investasi', logoUrl: getLogoUrl('treasury.id'), isRecommended: false },
  { id: 'ipot', name: 'IPOT (Indo Premier)', type: 'investasi', logoUrl: getLogoUrl('indopremier.com'), isRecommended: false },
  { id: 'mirae', name: 'Mirae Asset Sekuritas', type: 'investasi', logoUrl: getLogoUrl('miraeasset.co.id'), isRecommended: false },
  { id: 'bions', name: 'BNI Sekuritas (BIONS)', type: 'investasi', logoUrl: getLogoUrl('bions.id'), isRecommended: false },
  { id: 'most', name: 'Mandiri Sekuritas (MOST)', type: 'investasi', logoUrl: getLogoUrl('most.co.id'), isRecommended: false },
  { id: 'bcasekuritas', name: 'BCA Sekuritas (BEST)', type: 'investasi', logoUrl: getLogoUrl('bcasekuritas.co.id'), isRecommended: false },

  // ── 4. Kas Utama & Lainnya ──────────────────────────────────────────────
  { id: 'cash', name: 'Uang Tunai (Cash)', type: 'lainnya', logoUrl: '', isRecommended: true, subtitle: 'Kas Fisik', customIcon: 'dollar' },
]
