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

// Modern Authentic Official Bank BRI / BRImo Logo Vector (Royal Blue with crisp white BRI and signature orange mo)
export const BRI_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="%2300529C"/><g transform="translate(0, 1)"><path d="M32.13 26.58c.19-.18.4-.41.65-.7c.25-.28.48-.61.7-.99.23-.39.42-.82.57-1.3.16-.47.24-.98.24-1.52 0-1.05-.18-2.03-.55-2.94-.37-.91-.93-1.71-1.69-2.39-.76-.68-1.71-1.21-2.85-1.6-1.14-.38-2.47-.57-3.98-.57H15.2v26.94h11c1.6 0 3-.21 4.19-.63 1.19-.43 2.18-1.01 2.96-1.76.79-.74 1.37-1.61 1.75-2.6.38-.99.57-2.05.57-3.18 0-1.51-.35-2.86-1.06-4.04-.71-1.18-1.54-2.09-2.48-2.73zm-4.86-7.07c.37.14.68.32.92.54.63.59.94 1.29.94 2.11 0 .74-.13 1.35-.39 1.84-.26.49-.52.86-.78 1.11H20.31v-5.92h4.75c.89 0 1.63.11 2.21.32zm-.79 10.26c1.38 0 2.41.35 3.08 1.05.63.69.94 1.51.94 2.45 0 .97-.36 1.8-1.08 2.49-.71.69-1.89 1.04-3.54 1.04h-5.57v-7.03h6.17zm27.84.14c.82-.55 1.51-1.19 2.06-1.92.55-.73.96-1.54 1.22-2.43.26-.88.39-1.79.39-2.71 0-1.21-.2-2.32-.61-3.33-.41-1.01-1.02-1.88-1.83-2.62-.81-.73-1.83-1.3-3.04-1.71-1.22-.41-2.63-.62-4.22-.62H37.46v26.94h5.21v-10.01h2.9l7.18 10.01h6.1l-7.42-10.35c1.1-.28 2.06-.7 2.89-1.25zm-5.99-10.72c.31 0 .62.02.93.06.93.14 1.69.46 2.27.98.8.7 1.19 1.57 1.19 2.59 0 .51-.09 1.01-.25 1.49-.17.48-.44.92-.8 1.29-.37.37-.84.67-1.41.9-.57.23-1.27.34-2.07.34h-5.51v-7.65h5.65zm12.36-4.62v.01l-.15-.01h-.05v26.94h5.31V14.57h-5.11z" fill="white"/><path d="M25.32 61.9v-8.58c0-.72.11-1.43.33-2.11.52-1.61 1.35-2.89 2.49-3.85 1.24-1.07 2.67-1.6 4.27-1.6 1.72 0 3.34.71 4.86 2.14 1.38-1.43 2.99-2.14 4.83-2.14 1.6 0 3.03.52 4.29 1.57 1.26 1.04 2.1 2.37 2.52 3.97.2.77.3 1.39.3 1.87V61.9H44.81v-8.49c-.04-.32-.06-.5-.06-.54-.14-.7-.43-1.31-.87-1.81-.5-.56-1.08-.84-1.74-.84-.66 0-1.24.28-1.74.84-.42.5-.7 1.11-.84 1.81-.02.14-.04.32-.06.54V61.9h-4.44v-8.58c-.04-.3-.06-.46-.06-.48-.14-.7-.43-1.3-.87-1.81-.5-.54-1.08-.81-1.74-.81-.76 0-1.4.37-1.92 1.11-.48.66-.72 1.4-.72 2.2V61.9h-4.42zm24.99-8.07c0-2.21.78-4.09 2.34-5.66 1.56-1.56 3.43-2.35 5.61-2.35 2.22 0 4.12.78 5.71 2.35 1.58 1.56 2.37 3.46 2.37 5.69 0 2.19-.79 4.07-2.37 5.66-1.56 1.58-3.44 2.38-5.65 2.38-2.22 0-4.11-.78-5.67-2.35-1.56-1.58-2.34-3.49-2.34-5.72zm4.41 0c0 1 .35 1.86 1.05 2.56.7.7 1.55 1.05 2.55 1.05.98 0 1.82-.35 2.52-1.05.72-.72 1.08-1.57 1.08-2.56 0-.98-.36-1.83-1.08-2.53-.72-.7-1.57-1.05-2.55-1.05-.98 0-1.82.35-2.52 1.05-.7.7-1.05 1.55-1.05 2.53z" fill="%23F36F21"/></g></svg>`

// Authentic Official Bank Central Asia (BCA) Logo Vector (Royal Blue with authentic emblem & wordmark)
export const BCA_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="%2300529C"/><g transform="translate(14, 46) scale(0.092)" fill="white"><path d="m 147.35,237.88 c 0,-12.49 0.14,-45.88 -0.17,-49.99 0.27,-49.68 -35.85,-84.73 -58.67,-82 -15.79,1.37 -29.03,7.81 -36.13,26.33 -6.59,17.26 -0.7,40.22 21.2,45.61 23.41,5.79 37.09,10.6 46.98,17.39 12.12,8.32 22.02,24.2 22.28,42.67"/><path d="m 156.69,313.4 c -41.28,0 -83.71,-10.17 -126.09,-30.28 l -1.04,-0.51 -0.5,-1.06 C 10.06,241.41 0,197.51 0,154.56 0,111.68 9.64,69.65 28.67,29.57 l 0.52,-1.07 1.06,-0.53 C 69.45,9.41 111.62,0 155.62,0 c 40.99,0 84.77,10.47 126.58,30.33 l 1.07,0.48 0.49,1.08 c 19.38,40.88 29.6,84.77 29.6,127.01 0,42.08 -9.81,84.13 -29.21,124.99 l -0.51,1.07 -1.08,0.5 c -38.6,18.27 -82.13,27.94 -125.87,27.94 M 34.53,277.62 c 41.16,19.36 82.22,29.14 122.16,29.14 42.36,0 84.48,-9.26 121.98,-26.81 18.63,-39.59 28.07,-80.33 28.07,-121.05 0,-40.88 -9.85,-83.41 -28.5,-123.09 -40.58,-19.07 -82.95,-29.19 -122.63,-29.19 -42.6,0 -83.43,9.04 -121.45,26.86 C 15.93,72.34 6.64,113.05 6.64,154.56 c 0,41.59 9.65,84.13 27.89,123.06"/><path d="m 137.56,237.9 c 0.08,-16.01 -8.86,-30.17 -20.54,-37.78 -10.36,-6.72 -24.27,-11.14 -46.71,-16.83 -6.94,-1.77 -14.19,-5.72 -16.44,-10.74 -5.94,5.99 -7.02,19.45 -5.98,27.31 1.21,9.1 11.85,24.11 27.87,24.69 9.78,0.39 22.15,-2.11 28.08,-3.37 10.23,-2.21 26.42,4.2 28.99,16.69"/><path d="m 155.62,28.47 c -27.16,0 -50.62,17.91 -50.53,48.9 0.08,26.06 21.04,40.01 28.52,49.98 11.3,15.02 17.42,32.79 18.05,59.99 0.49,21.65 0.47,43.02 0.58,50.59 l 6,0 c -0.1,-7.93 -0.38,-30.62 -0.07,-51.26 0.41,-27.21 6.74,-44.3 18.05,-59.32 7.54,-9.97 28.49,-23.92 28.53,-49.98 0.1,-30.99 -23.34,-48.9 -50.48,-48.9"/><path d="m 162.51,237.88 c 0,-12.49 -0.14,-45.88 0.16,-49.99 -0.27,-49.68 35.83,-84.73 58.67,-82 15.79,1.37 29.01,7.81 36.14,26.33 6.58,17.26 0.66,40.22 -21.21,45.61 -23.43,5.79 -37.08,10.6 -47,17.39 -12.11,8.32 -21.31,24.2 -21.6,42.67"/><path d="m 172.29,237.9 c -0.08,-16.01 8.85,-30.17 20.5,-37.78 10.4,-6.72 24.33,-11.14 46.75,-16.83 6.95,-1.77 14.2,-5.72 16.4,-10.74 5.97,5.99 7.05,19.45 6,27.31 -1.24,9.1 -11.85,24.11 -27.84,24.69 -9.78,0.39 -22.21,-2.11 -28.12,-3.37 -10.19,-2.21 -26.42,4.2 -29.01,16.69"/><path d="m 528.93,27.01 c 40.35,0.23 63.15,22.13 63.15,53.77 0,29.17 -24.05,54.98 -50.44,68.33 27.18,9.99 29.53,34.51 29.53,51.87 0,41.92 -42.06,81.09 -96.74,81.09 l -119.24,0 46.51,-179.59 -19.11,-0.11 39.06,-75.35 c 0,0 74.47,-0.23 107.28,0 M 489.35,130.42 c 8.35,0 23.08,-2.11 26.77,-18.27 4.04,-17.53 -9.79,-18.01 -16.43,-18.01 l -23.7,-0.1 -8.27,36.38 z m -33.51,45.07 -10.91,41.92 27.91,0 c 10.98,0 25.95,-5.45 29.62,-19.09 3.62,-13.68 -6.84,-22.83 -17.78,-22.83"/><path d="m 829.52,52.94 -38.66,70.17 c -14.59,-11.85 -32.41,-20.57 -55.15,-20.57 -53.8,0 -75.66,40.11 -75.66,68.36 0,20.97 13.73,51.91 61.6,51.91 20.09,0 48.66,-13.98 56.88,-20.34 l -38.24,81.41 c -18.23,3.64 -24.21,5.89 -39.64,6.37 -85.69,2.56 -120.31,-50.08 -120.29,-103.87 0.06,-71.1 63.27,-157.58 168.07,-157.58 6.42,0 14.28,2.22 20.99,4.68 l 6.79,-8.68"/><path d="M 989.05,27.01 1000,282.06 l -81.48,0 -0.05,-43.74 -55.56,0 -18.29,43.74 -88.36,0 92.38,-182.13 -20.83,-0.14 39.58,-72.79 z m -71.11,78.03 -31.41,74.19 32.36,0"/></g></svg>`

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
