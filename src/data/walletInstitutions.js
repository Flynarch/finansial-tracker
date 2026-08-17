const LOGO_DEV_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN

// Robust logo URL generator with public Google Favicon fallback for Capacitor APK builds
export const getLogoUrl = (domain) => {
  if (!domain) return ''
  if (LOGO_DEV_TOKEN) {
    return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`
  }
  // High-res (128px) public Google Favicon CDN requiring ZERO token (works 100% in Android APK)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}

// Modern Official Bank BRI Logo Vector (Royal Blue with modern centered BRI lettering and iconic orange accent)
export const BRI_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="%2300529C"/><g transform="translate(19, 41) scale(0.68)"><text x="5" y="44" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="40" font-weight="900" letter-spacing="1.5">BRI</text><rect x="95" y="12" width="9" height="34" rx="3" fill="%23F37021"/></g></svg>`

// Modern Official Bank BCA Logo Vector (Royal Blue with perfectly proportioned centered emblem)
export const BCA_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="%2300529C"/><g transform="translate(20, 40) scale(0.68)"><path d="M18 10 L34 32 L18 54 L2 32 Z" fill="white"/><path d="M18 20 L26 32 L18 44 L10 32 Z" fill="%2300529C"/><text x="44" y="44" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="1">BCA</text></g></svg>`

// Modern High-Detail Gold Money Sack Cash Vector (White Badge)
export const CASH_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="body" x1="12" y1="20" x2="52" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23FCD34D"/><stop offset="45%25" stop-color="%23F59E0B"/><stop offset="100%25" stop-color="%23B45309"/></linearGradient><linearGradient id="top" x1="20" y1="8" x2="44" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23FDE68A"/><stop offset="100%25" stop-color="%23D97706"/></linearGradient><linearGradient id="rope" x1="20" y1="20" x2="44" y2="25" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23EF4444"/><stop offset="100%25" stop-color="%23991B1B"/></linearGradient><linearGradient id="coin" x1="26" y1="32" x2="38" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23FFFBEB"/><stop offset="50%25" stop-color="%23FBBF24"/><stop offset="100%25" stop-color="%23D97706"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="white" stroke="%23E2E8F0" stroke-width="1.5"/><path d="M22 14C20 10 18 8 24 8C27 8 29 11 32 11C35 11 37 8 40 8C46 8 44 10 42 14C40 18 24 18 22 14Z" fill="url(%23top)" stroke="%2392400E" stroke-width="1.2"/><rect x="20" y="19" width="24" height="4.5" rx="2.2" fill="url(%23rope)" stroke="%237F1D1D" stroke-width="0.8"/><path d="M25 23.5L22 29M28 23.5L27 30" stroke="%23991B1B" stroke-width="1.8" stroke-linecap="round"/><path d="M21 23C15 26 10 33 10 42C10 52 18 58 32 58C46 58 54 52 54 42C54 33 49 26 43 23C38 25 26 25 21 23Z" fill="url(%23body)" stroke="%2378350F" stroke-width="1.5"/><circle cx="32" cy="40" r="9.5" fill="url(%23coin)" stroke="%23B45309" stroke-width="1.2"/><text x="32" y="44.5" text-anchor="middle" font-size="13" font-weight="900" fill="%2378350F" font-family="sans-serif">$</text><path d="M16 38C15 42 16 48 20 52" stroke="%23FEF3C7" stroke-width="2.2" stroke-linecap="round" opacity="0.6"/></svg>`

export function getWalletLogoUrl(wallet) {
  if (!wallet) return ''
  const name = String(wallet.name || '').toLowerCase()
  const inst = String(wallet.institutionType || wallet.id || '').toLowerCase()
  const url = String(wallet.logoUrl || '')

  if (name.includes('bca') || inst.includes('bca') || url.includes('bca.co.id')) {
    return BCA_CUSTOM_LOGO
  }

  if (name.includes('bri') || inst.includes('bri') || url.includes('bri.co.id')) {
    return BRI_CUSTOM_LOGO
  }

  if (
    inst === 'cash' ||
    name.includes('uang tunai') ||
    name.includes('cash') ||
    wallet.customIcon === 'dollar' ||
    wallet.customIcon === 'cash' ||
    inst.includes('tunai')
  ) {
    return CASH_CUSTOM_LOGO
  }

  // If stored logoUrl has invalid token=undefined, replace with robust logo URL
  if (url.includes('token=undefined')) {
    const domainMatch = url.match(/img\.logo\.dev\/([^?]+)/)
    if (domainMatch && domainMatch[1]) {
      return getLogoUrl(domainMatch[1])
    }
  }

  return url || (wallet.domain ? getLogoUrl(wallet.domain) : '')
}

export const walletInstitutions = [
  // ── 1. Bank Utama & Digital Indonesia ──────────────────────────────────
  { id: 'bca', name: 'BCA', type: 'bank', domain: 'bca.co.id', logoUrl: BCA_CUSTOM_LOGO, isRecommended: true },
  { id: 'bri', name: 'BRI', type: 'bank', domain: 'bri.co.id', logoUrl: BRI_CUSTOM_LOGO, isRecommended: true },
  { id: 'mandiri', name: 'Mandiri', type: 'bank', domain: 'bankmandiri.co.id', logoUrl: getLogoUrl('bankmandiri.co.id'), isRecommended: false },
  { id: 'bni', name: 'BNI', type: 'bank', domain: 'bni.co.id', logoUrl: getLogoUrl('bni.co.id'), isRecommended: false },
  { id: 'jago', name: 'Bank Jago', type: 'bank', domain: 'jago.com', logoUrl: getLogoUrl('jago.com'), isRecommended: false },
  { id: 'seabank', name: 'SeaBank', type: 'bank', domain: 'seabank.co.id', logoUrl: getLogoUrl('seabank.co.id'), isRecommended: false },
  { id: 'bsi', name: 'BSI (Bank Syariah Indonesia)', type: 'bank', domain: 'bankbsi.co.id', logoUrl: getLogoUrl('bankbsi.co.id'), isRecommended: false },

  // Bank Digital & Swasta
  { id: 'cimb', name: 'CIMB Niaga', type: 'bank', domain: 'cimbniaga.co.id', logoUrl: getLogoUrl('cimbniaga.co.id'), isRecommended: false },
  { id: 'jenius', name: 'Jenius (BTPN)', type: 'bank', domain: 'jenius.com', logoUrl: getLogoUrl('jenius.com'), isRecommended: false },
  { id: 'blu', name: 'blu (BCA Digital)', type: 'bank', domain: 'bcadigital.co.id', logoUrl: getLogoUrl('bcadigital.co.id'), isRecommended: false },
  { id: 'neobank', name: 'NeoBank (BNC)', type: 'bank', domain: 'bankneocommerce.co.id', logoUrl: getLogoUrl('bankneocommerce.co.id'), isRecommended: false },
  { id: 'allobank', name: 'Allo Bank', type: 'bank', domain: 'allobank.com', logoUrl: getLogoUrl('allobank.com'), isRecommended: false },
  { id: 'btn', name: 'Bank BTN', type: 'bank', domain: 'btn.co.id', logoUrl: getLogoUrl('btn.co.id'), isRecommended: false },
  { id: 'permata', name: 'PermataBank', type: 'bank', domain: 'permatabank.com', logoUrl: getLogoUrl('permatabank.com'), isRecommended: false },
  { id: 'danamon', name: 'Bank Danamon', type: 'bank', domain: 'danamon.co.id', logoUrl: getLogoUrl('danamon.co.id'), isRecommended: false },
  { id: 'mega', name: 'Bank Mega', type: 'bank', domain: 'bankmega.com', logoUrl: getLogoUrl('bankmega.com'), isRecommended: false },
  { id: 'sinarmas', name: 'Bank Sinarmas', type: 'bank', domain: 'banksinarmas.com', logoUrl: getLogoUrl('banksinarmas.com'), isRecommended: false },
  { id: 'panin', name: 'Panin Bank', type: 'bank', domain: 'panin.co.id', logoUrl: getLogoUrl('panin.co.id'), isRecommended: false },
  { id: 'muamalat', name: 'Bank Muamalat', type: 'bank', domain: 'bankmuamalat.co.id', logoUrl: getLogoUrl('bankmuamalat.co.id'), isRecommended: false },
  { id: 'ocbc', name: 'OCBC NISP', type: 'bank', domain: 'ocbc.id', logoUrl: getLogoUrl('ocbc.id'), isRecommended: false },
  { id: 'maybank', name: 'Maybank Indonesia', type: 'bank', domain: 'maybank.co.id', logoUrl: getLogoUrl('maybank.co.id'), isRecommended: false },
  { id: 'dbs', name: 'digibank (DBS)', type: 'bank', domain: 'dbs.id', logoUrl: getLogoUrl('dbs.id'), isRecommended: false },
  { id: 'kbbukopin', name: 'KB Bank (Bukopin)', type: 'bank', domain: 'kbbukopin.com', logoUrl: getLogoUrl('kbbukopin.com'), isRecommended: false },
  { id: 'uob', name: 'UOB Indonesia', type: 'bank', domain: 'uob.co.id', logoUrl: getLogoUrl('uob.co.id'), isRecommended: false },
  { id: 'hsbc', name: 'HSBC Indonesia', type: 'bank', domain: 'hsbc.co.id', logoUrl: getLogoUrl('hsbc.co.id'), isRecommended: false },
  { id: 'scb', name: 'Standard Chartered', type: 'bank', domain: 'sc.com', logoUrl: getLogoUrl('sc.com'), isRecommended: false },
  { id: 'bankraya', name: 'Bank Raya', type: 'bank', domain: 'bankraya.co.id', logoUrl: getLogoUrl('bankraya.co.id'), isRecommended: false },
  { id: 'krom', name: 'Krom Digital Bank', type: 'bank', domain: 'krom.id', logoUrl: getLogoUrl('krom.id'), isRecommended: false },
  { id: 'superbank', name: 'Superbank', type: 'bank', domain: 'superbank.id', logoUrl: getLogoUrl('superbank.id'), isRecommended: false },
  { id: 'linebank', name: 'Line Bank (Hana)', type: 'bank', domain: 'linebank.co.id', logoUrl: getLogoUrl('linebank.co.id'), isRecommended: false },
  { id: 'banksaqu', name: 'Bank Saqu', type: 'bank', domain: 'banksaqu.co.id', logoUrl: getLogoUrl('banksaqu.co.id'), isRecommended: false },
  { id: 'commbank', name: 'Commonwealth Bank', type: 'bank', domain: 'commbank.co.id', logoUrl: getLogoUrl('commbank.co.id'), isRecommended: false },
  { id: 'mayapada', name: 'Bank Mayapada', type: 'bank', domain: 'mayapadabank.co.id', logoUrl: getLogoUrl('mayapadabank.co.id'), isRecommended: false },

  // Bank Daerah (BPD)
  { id: 'bankdki', name: 'Bank DKI', type: 'bank', domain: 'bankdki.co.id', logoUrl: getLogoUrl('bankdki.co.id'), isRecommended: false },
  { id: 'bankbjb', name: 'Bank BJB', type: 'bank', domain: 'bankbjb.co.id', logoUrl: getLogoUrl('bankbjb.co.id'), isRecommended: false },
  { id: 'bankjateng', name: 'Bank Jateng', type: 'bank', domain: 'bankjateng.co.id', logoUrl: getLogoUrl('bankjateng.co.id'), isRecommended: false },
  { id: 'bankjatim', name: 'Bank Jatim', type: 'bank', domain: 'bankjatim.co.id', logoUrl: getLogoUrl('bankjatim.co.id'), isRecommended: false },
  { id: 'banknagari', name: 'Bank Nagari', type: 'bank', domain: 'banknagari.co.id', logoUrl: getLogoUrl('banknagari.co.id'), isRecommended: false },
  { id: 'banksumut', name: 'Bank Sumut', type: 'bank', domain: 'banksumut.co.id', logoUrl: getLogoUrl('banksumut.co.id'), isRecommended: false },

  // ── 2. E-Wallet, Fintech & PayLater ────────────────────────────────────
  { id: 'gopay', name: 'GoPay', type: 'ewallet', domain: 'gopay.co.id', logoUrl: getLogoUrl('gopay.co.id'), isRecommended: true },
  { id: 'ovo', name: 'OVO', type: 'ewallet', domain: 'ovo.id', logoUrl: getLogoUrl('ovo.id'), isRecommended: true },
  { id: 'dana', name: 'DANA', type: 'ewallet', domain: 'dana.id', logoUrl: getLogoUrl('dana.id'), isRecommended: true },
  { id: 'shopeepay', name: 'ShopeePay', type: 'ewallet', domain: 'shopeepay.co.id', logoUrl: getLogoUrl('shopeepay.co.id'), isRecommended: false },
  { id: 'linkaja', name: 'LinkAja', type: 'ewallet', domain: 'linkaja.id', logoUrl: getLogoUrl('linkaja.id'), isRecommended: false },
  { id: 'astrapay', name: 'AstraPay', type: 'ewallet', domain: 'astrapay.com', logoUrl: getLogoUrl('astrapay.com'), isRecommended: false },
  { id: 'isaku', name: 'iSAKU (Indomaret)', type: 'ewallet', domain: 'isaku-indomaret.com', logoUrl: getLogoUrl('isaku-indomaret.com'), isRecommended: false },
  { id: 'doku', name: 'DOKU Wallet', type: 'ewallet', domain: 'doku.com', logoUrl: getLogoUrl('doku.com'), isRecommended: false },
  { id: 'sakuku', name: 'Sakuku BCA', type: 'ewallet', domain: 'bca.co.id', logoUrl: getLogoUrl('bca.co.id'), isRecommended: false },
  { id: 'jakonepay', name: 'JakOne Pay', type: 'ewallet', domain: 'jakone.mobi', logoUrl: getLogoUrl('jakone.mobi'), isRecommended: false },
  { id: 'motionpay', name: 'MotionPay', type: 'ewallet', domain: 'motionpay.id', logoUrl: getLogoUrl('motionpay.id'), isRecommended: false },
  { id: 'paypal', name: 'PayPal', type: 'ewallet', domain: 'paypal.com', logoUrl: getLogoUrl('paypal.com'), isRecommended: false, defaultCurrency: 'USD' },
  { id: 'wise', name: 'Wise (TransferWise)', type: 'ewallet', domain: 'wise.com', logoUrl: getLogoUrl('wise.com'), isRecommended: false, defaultCurrency: 'USD' },
  { id: 'revolut', name: 'Revolut', type: 'ewallet', domain: 'revolut.com', logoUrl: getLogoUrl('revolut.com'), isRecommended: false, defaultCurrency: 'USD' },
  { id: 'kredivo', name: 'Kredivo / PayLater', type: 'ewallet', domain: 'kredivo.com', logoUrl: getLogoUrl('kredivo.com'), isRecommended: false },
  { id: 'akulaku', name: 'Akulaku PayLater', type: 'ewallet', domain: 'akulaku.com', logoUrl: getLogoUrl('akulaku.com'), isRecommended: false },
  { id: 'spaylater', name: 'SPayLater (Shopee)', type: 'ewallet', domain: 'shopee.co.id', logoUrl: getLogoUrl('shopee.co.id'), isRecommended: false },
  { id: 'gopaylater', name: 'GoPayLater', type: 'ewallet', domain: 'gojek.com', logoUrl: getLogoUrl('gojek.com'), isRecommended: false },
  { id: 'indodana', name: 'Indodana PayLater', type: 'ewallet', domain: 'indodana.id', logoUrl: getLogoUrl('indodana.id'), isRecommended: false },
  { id: 'atome', name: 'Atome PayLater', type: 'ewallet', domain: 'atome.id', logoUrl: getLogoUrl('atome.id'), isRecommended: false },

  // ── 3. Investasi, Reksadana & Crypto ──────────────────────────────────
  { id: 'bibit', name: 'Bibit', type: 'investasi', domain: 'bibit.id', logoUrl: getLogoUrl('bibit.id'), isRecommended: false },
  { id: 'ajaib', name: 'Ajaib Sekuritas', type: 'investasi', domain: 'ajaib.co.id', logoUrl: getLogoUrl('ajaib.co.id'), isRecommended: false },
  { id: 'bareksa', name: 'Bareksa', type: 'investasi', domain: 'bareksa.com', logoUrl: getLogoUrl('bareksa.com'), isRecommended: false },
  { id: 'stockbit', name: 'Stockbit', type: 'investasi', domain: 'stockbit.com', logoUrl: getLogoUrl('stockbit.com'), isRecommended: false },
  { id: 'pintu', name: 'Pintu Crypto', type: 'investasi', domain: 'pintu.co.id', logoUrl: getLogoUrl('pintu.co.id'), isRecommended: false },
  { id: 'indodax', name: 'Indodax', type: 'investasi', domain: 'indodax.com', logoUrl: getLogoUrl('indodax.com'), isRecommended: false },
  { id: 'pluang', name: 'Pluang', type: 'investasi', domain: 'pluang.com', logoUrl: getLogoUrl('pluang.com'), isRecommended: false },
  { id: 'tokocrypto', name: 'Tokocrypto', type: 'investasi', domain: 'tokocrypto.com', logoUrl: getLogoUrl('tokocrypto.com'), isRecommended: false },
  { id: 'binance', name: 'Binance', type: 'investasi', domain: 'binance.com', logoUrl: getLogoUrl('binance.com'), isRecommended: false, defaultCurrency: 'USD' },
  { id: 'bybit', name: 'Bybit Crypto', type: 'investasi', domain: 'bybit.com', logoUrl: getLogoUrl('bybit.com'), isRecommended: false, defaultCurrency: 'USD' },
  { id: 'luno', name: 'Luno Crypto', type: 'investasi', domain: 'luno.com', logoUrl: getLogoUrl('luno.com'), isRecommended: false },
  { id: 'pegadaian', name: 'Pegadaian Digital (Emas)', type: 'investasi', domain: 'pegadaian.co.id', logoUrl: getLogoUrl('pegadaian.co.id'), isRecommended: false },
  { id: 'treasury', name: 'Treasury Emas', type: 'investasi', domain: 'treasury.id', logoUrl: getLogoUrl('treasury.id'), isRecommended: false },
  { id: 'ipot', name: 'IPOT (Indo Premier)', type: 'investasi', domain: 'indopremier.com', logoUrl: getLogoUrl('indopremier.com'), isRecommended: false },
  { id: 'mirae', name: 'Mirae Asset Sekuritas', type: 'investasi', domain: 'miraeasset.co.id', logoUrl: getLogoUrl('miraeasset.co.id'), isRecommended: false },
  { id: 'bions', name: 'BNI Sekuritas (BIONS)', type: 'investasi', domain: 'bions.id', logoUrl: getLogoUrl('bions.id'), isRecommended: false },
  { id: 'most', name: 'Mandiri Sekuritas (MOST)', type: 'investasi', domain: 'most.co.id', logoUrl: getLogoUrl('most.co.id'), isRecommended: false },
  { id: 'bcasekuritas', name: 'BCA Sekuritas (BEST)', type: 'investasi', domain: 'bcasekuritas.co.id', logoUrl: getLogoUrl('bcasekuritas.co.id'), isRecommended: false },

  // ── 4. Kas Utama & Lainnya ──────────────────────────────────────────────
  { id: 'cash', name: 'Cash', type: 'lainnya', logoUrl: CASH_CUSTOM_LOGO, isRecommended: true, subtitle: 'Kas Fisik', customIcon: 'dollar' },
]
