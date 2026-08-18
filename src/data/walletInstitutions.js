// ── FinTrack Native Offline SVG Vector Brand Badge System ─────────────────
// Every institution uses self-contained inlined SVG vector data URIs (100% offline & APK compatible)

export const createSvgBadge = (bgColor, contentSvg) => {
  const cleanBg = String(bgColor || '').replace(/#/g, '%23')
  const cleanContent = String(contentSvg || '').replace(/#/g, '%23')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${cleanBg}"/>${cleanContent}</svg>`
  return `data:image/svg+xml;utf8,${svg}`
}

export const createTextBadge = (bgColor, textColor, text, subtext = '') => {
  const cleanBg = String(bgColor || '').replace(/#/g, '%23')
  const cleanText = String(textColor || '').replace(/#/g, '%23')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${cleanBg}"/><text x="40" y="${subtext ? '38' : '46'}" text-anchor="middle" font-size="${text.length > 5 ? '13' : '18'}" font-weight="900" fill="${cleanText}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">${text}</text>${subtext ? `<text x="40" y="55" text-anchor="middle" font-size="9" font-weight="800" fill="${cleanText}" opacity="0.85" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">${subtext}</text>` : ''}</svg>`
  return `data:image/svg+xml;utf8,${svg}`
}

// ── 1. Bank Utama & Digital Vectors ───────────────────────────────────────

// BRI
export const BRI_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="%2300529C"/><g transform="translate(0, 1)"><path d="M32.13 26.58c.19-.18.4-.41.65-.7c.25-.28.48-.61.7-.99.23-.39.42-.82.57-1.3.16-.47.24-.98.24-1.52 0-1.05-.18-2.03-.55-2.94-.37-.91-.93-1.71-1.69-2.39-.76-.68-1.71-1.21-2.85-1.6-1.14-.38-2.47-.57-3.98-.57H15.2v26.94h11c1.6 0 3-.21 4.19-.63 1.19-.43 2.18-1.01 2.96-1.76.79-.74 1.37-1.61 1.75-2.6.38-.99.57-2.05.57-3.18 0-1.51-.35-2.86-1.06-4.04-.71-1.18-1.54-2.09-2.48-2.73zm-4.86-7.07c.37.14.68.32.92.54.63.59.94 1.29.94 2.11 0 .74-.13 1.35-.39 1.84-.26.49-.52.86-.78 1.11H20.31v-5.92h4.75c.89 0 1.63.11 2.21.32zm-.79 10.26c1.38 0 2.41.35 3.08 1.05.63.69.94 1.51.94 2.45 0 .97-.36 1.8-1.08 2.49-.71.69-1.89 1.04-3.54 1.04h-5.57v-7.03h6.17zm27.84.14c.82-.55 1.51-1.19 2.06-1.92.55-.73.96-1.54 1.22-2.43.26-.88.39-1.79.39-2.71 0-1.21-.2-2.32-.61-3.33-.41-1.01-1.02-1.88-1.83-2.62-.81-.73-1.83-1.3-3.04-1.71-1.22-.41-2.63-.62-4.22-.62H37.46v26.94h5.21v-10.01h2.9l7.18 10.01h6.1l-7.42-10.35c1.1-.28 2.06-.7 2.89-1.25zm-5.99-10.72c.31 0 .62.02.93.06.93.14 1.69.46 2.27.98.8.7 1.19 1.57 1.19 2.59 0 .51-.09 1.01-.25 1.49-.17.48-.44.92-.8 1.29-.37.37-.84.67-1.41.9-.57.23-1.27.34-2.07.34h-5.51v-7.65h5.65zm12.36-4.62v.01l-.15-.01h-.05v26.94h5.31V14.57h-5.11z" fill="white"/><path d="M25.32 61.9v-8.58c0-.72.11-1.43.33-2.11.52-1.61 1.35-2.89 2.49-3.85 1.24-1.07 2.67-1.6 4.27-1.6 1.72 0 3.34.71 4.86 2.14 1.38-1.43 2.99-2.14 4.83-2.14 1.6 0 3.03.52 4.29 1.57 1.26 1.04 2.1 2.37 2.52 3.97.2.77.3 1.39.3 1.87V61.9H44.81v-8.49c-.04-.32-.06-.5-.06-.54-.14-.7-.43-1.31-.87-1.81-.5-.56-1.08-.84-1.74-.84-.66 0-1.24.28-1.74.84-.42.5-.7 1.11-.84 1.81-.02.14-.04.32-.06.54V61.9h-4.44v-8.58c-.04-.3-.06-.46-.06-.48-.14-.7-.43-1.3-.87-1.81-.5-.54-1.08-.81-1.74-.81-.76 0-1.4.37-1.92 1.11-.48.66-.72 1.4-.72 2.2V61.9h-4.42zm24.99-8.07c0-2.21.78-4.09 2.34-5.66 1.56-1.56 3.43-2.35 5.61-2.35 2.22 0 4.12.78 5.71 2.35 1.58 1.56 2.37 3.46 2.37 5.69 0 2.19-.79 4.07-2.37 5.66-1.56 1.58-3.44 2.38-5.65 2.38-2.22 0-4.11-.78-5.67-2.35-1.56-1.58-2.34-3.49-2.34-5.72zm4.41 0c0 1 .35 1.86 1.05 2.56.7.7 1.55 1.05 2.55 1.05.98 0 1.82-.35 2.52-1.05.72-.72 1.08-1.57 1.08-2.56 0-.98-.36-1.83-1.08-2.53-.72-.7-1.57-1.05-2.55-1.05-.98 0-1.82.35-2.52 1.05-.7.7-1.05 1.55-1.05 2.53z" fill="%23F36F21"/></g></svg>`

// BCA
export const BCA_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="%2300529C"/><g transform="translate(14, 46) scale(0.092)" fill="white"><path d="m 147.35,237.88 c 0,-12.49 0.14,-45.88 -0.17,-49.99 0.27,-49.68 -35.85,-84.73 -58.67,-82 -15.79,1.37 -29.03,7.81 -36.13,26.33 -6.59,17.26 -0.7,40.22 21.2,45.61 23.41,5.79 37.09,10.6 46.98,17.39 12.12,8.32 22.02,24.2 22.28,42.67"/><path d="m 156.69,313.4 c -41.28,0 -83.71,-10.17 -126.09,-30.28 l -1.04,-0.51 -0.5,-1.06 C 10.06,241.41 0,197.51 0,154.56 0,111.68 9.64,69.65 28.67,29.57 l 0.52,-1.07 1.06,-0.53 C 69.45,9.41 111.62,0 155.62,0 c 40.99,0 84.77,10.47 126.58,30.33 l 1.07,0.48 0.49,1.08 c 19.38,40.88 29.6,84.77 29.6,127.01 0,42.08 -9.81,84.13 -29.21,124.99 l -0.51,1.07 -1.08,0.5 c -38.6,18.27 -82.13,27.94 -125.87,27.94 M 34.53,277.62 c 41.16,19.36 82.22,29.14 122.16,29.14 42.36,0 84.48,-9.26 121.98,-26.81 18.63,-39.59 28.07,-80.33 28.07,-121.05 0,-40.88 -9.85,-83.41 -28.5,-123.09 -40.58,-19.07 -82.95,-29.19 -122.63,-29.19 -42.6,0 -83.43,9.04 -121.45,26.86 C 15.93,72.34 6.64,113.05 6.64,154.56 c 0,41.59 9.65,84.13 27.89,123.06"/><path d="m 137.56,237.9 c 0.08,-16.01 -8.86,-30.17 -20.54,-37.78 -10.36,-6.72 -24.27,-11.14 -46.71,-16.83 -6.94,-1.77 -14.19,-5.72 -16.44,-10.74 -5.94,5.99 -7.02,19.45 -5.98,27.31 1.21,9.1 11.85,24.11 27.87,24.69 9.78,0.39 22.15,-2.11 28.08,-3.37 10.23,-2.21 26.42,4.2 28.99,16.69"/><path d="m 155.62,28.47 c -27.16,0 -50.62,17.91 -50.53,48.9 0.08,26.06 21.04,40.01 28.52,49.98 11.3,15.02 17.42,32.79 18.05,59.99 0.49,21.65 0.47,43.02 0.58,50.59 l 6,0 c -0.1,-7.93 -0.38,-30.62 -0.07,-51.26 0.41,-27.21 6.74,-44.3 18.05,-59.32 7.54,-9.97 28.49,-23.92 28.53,-49.98 0.1,-30.99 -23.34,-48.9 -50.48,-48.9"/><path d="m 162.51,237.88 c 0,-12.49 -0.14,-45.88 0.16,-49.99 -0.27,-49.68 35.83,-84.73 58.67,-82 15.79,1.37 29.01,7.81 36.14,26.33 6.58,17.26 0.66,40.22 -21.21,45.61 -23.43,5.79 -37.08,10.6 -47,17.39 -12.11,8.32 -21.31,24.2 -21.6,42.67"/><path d="m 172.29,237.9 c -0.08,-16.01 8.85,-30.17 20.5,-37.78 10.4,-6.72 24.33,-11.14 46.75,-16.83 6.95,-1.77 14.2,-5.72 16.4,-10.74 5.97,5.99 7.05,19.45 6,27.31 -1.24,9.1 -11.85,24.11 -27.84,24.69 -9.78,0.39 -22.21,-2.11 -28.12,-3.37 -10.19,-2.21 -26.42,4.2 -29.01,16.69"/><path d="m 528.93,27.01 c 40.35,0.23 63.15,22.13 63.15,53.77 0,29.17 -24.05,54.98 -50.44,68.33 27.18,9.99 29.53,34.51 29.53,51.87 0,41.92 -42.06,81.09 -96.74,81.09 l -119.24,0 46.51,-179.59 -19.11,-0.11 39.06,-75.35 c 0,0 74.47,-0.23 107.28,0 M 489.35,130.42 c 8.35,0 23.08,-2.11 26.77,-18.27 4.04,-17.53 -9.79,-18.01 -16.43,-18.01 l -23.7,-0.1 -8.27,36.38 z m -33.51,45.07 -10.91,41.92 27.91,0 c 10.98,0 25.95,-5.45 29.62,-19.09 3.62,-13.68 -6.84,-22.83 -17.78,-22.83"/><path d="m 829.52,52.94 -38.66,70.17 c -14.59,-11.85 -32.41,-20.57 -55.15,-20.57 -53.8,0 -75.66,40.11 -75.66,68.36 0,20.97 13.73,51.91 61.6,51.91 20.09,0 48.66,-13.98 56.88,-20.34 l -38.24,81.41 c -18.23,3.64 -24.21,5.89 -39.64,6.37 -85.69,2.56 -120.31,-50.08 -120.29,-103.87 0.06,-71.1 63.27,-157.58 168.07,-157.58 6.42,0 14.28,2.22 20.99,4.68 l 6.79,-8.68"/><path d="M 989.05,27.01 1000,282.06 l -81.48,0 -0.05,-43.74 -55.56,0 -18.29,43.74 -88.36,0 92.38,-182.13 -20.83,-0.14 39.58,-72.79 z m -71.11,78.03 -31.41,74.19 32.36,0"/></g></svg>`

// blu (BCA Digital)
export const BLU_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="%23001833"/><g transform="translate(13, 23) scale(0.68)"><path d="M0 17.65V.49C0 0-.09 0 .52 0h8.55c.45 0 .45 0 .45.43v13.5c0 .22-.02.43.04.64.1.39.32.49.68.31.35-.18.6-.49.89-.74 1.8-1.61 3.96-2.76 6.31-3.34 2.7-.68 5.39-.6 8.02.36 2.47.91 4.36 2.53 5.65 4.84 1.4 2.51 1.74 5.22 1.55 8.04-.13 1.91-.6 3.74-1.5 5.44-1.46 2.78-3.73 4.59-6.76 5.42-1.93.53-3.89.54-5.87.28-1.75-.22-3.4-.75-4.93-1.65-1.33-.8-2.44-1.84-3.36-3.08-.29-.39-.59-.77-.96-1.09-.59-.5-1.07-.46-1.55.14-.46.58-.82 1.22-1.22 1.84-1.23 1.89-2.85 3.24-5.08 3.77-.35.08-.7.13-1.04.19-.26.04-.4-.02-.39-.33.02-.73 0-1.45 0-2.17V17.65zm17.39 10.07c1.51 0 2.67-.27 3.86-.89 2.26-1.18 3.12-4 1.92-6.25-.49-.92-1.29-1.5-2.22-1.89-2.34-.97-4.7-.95-7.06-.06-.81.3-1.55.76-2.08 1.47-.7.92-.88 1.98-.8 3.09.11 1.54.81 2.71 2.17 3.49 1.31.75 2.72 1.04 4.21 1.04z" fill="%2333CDCF"/><path d="M80 23.01v11.85c0 .48 0 .48-.49.42-2.37-.33-4.26-1.45-5.64-3.41-.45-.63-.85-1.3-1.28-1.94-.18-.27-.36-.54-.63-.73-.31-.22-.61-.23-.93-.04-.55.32-.9.83-1.27 1.32-1.41 1.88-3.2 3.23-5.42 4.03-2.36.84-4.8.96-7.27.77-1.05-.07-2.1-.28-3.09-.63-1.58-.55-2.65-1.64-3.37-3.12-.77-1.61-1.08-3.33-1.28-5.08-.25-2.16-.25-4.33-.25-6.5V11.07c0-.32.09-.42.42-.42h8.74c.36 0 .37.02.37.5v5.15c0 1.73-.02 3.47.01 5.21.02 1.17.13 2.34.45 3.49.39 1.37 1.1 2.49 2.55 2.88 3.23.87 5.71.05 7.47-3 1-.16 1.41-.42 1.43-.23.03-2.71.01-5.42.01-8.13 0-.79 0-.8.8-.8h8.22c.49 0 .5 0 .5.49v11.85h-.01z" fill="%2333CDCF"/><path d="M45.39 17.69v17.19c0 .43 0 .43-.44.43h-8.68c-.32 0-.41-.07-.41-.4.01-11.49.01-22.98.01-34.47 0-.43 0-.43.42-.43h8.68c.42 0 .42 0 .42.42v17.26z" fill="%2333CDCF"/></g></svg>`

// Mandiri / Livin
export const MANDIRI_CUSTOM_LOGO = createSvgBadge('#002D62', `
  <path d="M16 48C28 48 34 32 48 32C56 32 60 36 64 42C60 30 52 24 42 24C28 24 24 40 16 48Z" fill="#F5A623"/>
  <text x="40" y="58" text-anchor="middle" font-size="13" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">mandiri</text>
`)

// BNI / wondr
export const BNI_CUSTOM_LOGO = createSvgBadge('#005E5D', `
  <path d="M46 16L56 16L34 64L24 64Z" fill="#F15A24"/>
  <text x="42" y="47" text-anchor="middle" font-size="18" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">BNI</text>
`)

// Bank Jago
export const JAGO_CUSTOM_LOGO = createSvgBadge('#F37021', `
  <circle cx="40" cy="40" r="32" fill="#F37021"/>
  <text x="40" y="46" text-anchor="middle" font-size="16" font-weight="900" fill="#FFC72C" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">jago</text>
  <path d="M30 52C36 57 44 57 50 52" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
`)

// SeaBank
export const SEABANK_CUSTOM_LOGO = createSvgBadge('#FF5722', `
  <path d="M48 24C40 20 30 26 30 34C30 46 50 42 50 52C50 58 42 60 34 56" stroke="white" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <text x="40" y="70" text-anchor="middle" font-size="8" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">SeaBank</text>
`)

// BSI (Bank Syariah Indonesia)
export const BSI_CUSTOM_LOGO = createSvgBadge('#00A39D', `
  <path d="M36 22C42 16 54 22 52 32C50 42 38 46 32 40C38 42 46 38 46 30C46 24 40 22 36 22Z" fill="#D4AF37"/>
  <polygon points="53,24 55,28 59,28 56,31 57,35 53,33 50,35 51,31 48,28 52,28" fill="#D4AF37"/>
  <text x="40" y="60" text-anchor="middle" font-size="16" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">BSI</text>
`)

// CIMB Niaga / OCTO
export const CIMB_CUSTOM_LOGO = createSvgBadge('#7B0017', `
  <polygon points="26,20 54,20 62,40 54,60 26,60 18,40" fill="#ED1C24"/>
  <text x="40" y="46" text-anchor="middle" font-size="12" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">CIMB</text>
`)

// Jenius (BTPN)
export const JENIUS_CUSTOM_LOGO = createSvgBadge('#0097A7', `
  <text x="36" y="47" text-anchor="middle" font-size="14" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">jenius</text>
  <circle cx="61" cy="40" r="4.5" fill="#FF5722"/>
`)

// PermataBank
export const PERMATA_CUSTOM_LOGO = createSvgBadge('#1E40AF', `
  <polygon points="40,16 54,28 40,40 26,28" fill="#10B981"/>
  <polygon points="54,28 66,42 54,56 40,40" fill="#EF4444"/>
  <polygon points="40,40 54,56 40,68 26,56" fill="#F59E0B"/>
  <polygon points="26,28 40,40 26,56 14,42" fill="#3B82F6"/>
`)

// Bank Danamon
export const DANAMON_CUSTOM_LOGO = createSvgBadge('#1E3A8A', `
  <path d="M18 36C28 22 52 22 62 36C52 30 28 30 18 36Z" fill="#F97316"/>
  <text x="40" y="55" text-anchor="middle" font-size="10" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Danamon</text>
`)

// Bank BTN
export const BTN_CUSTOM_LOGO = createSvgBadge('#1E40AF', `
  <rect x="18" y="22" width="44" height="6" rx="3" fill="#EF4444"/>
  <text x="40" y="52" text-anchor="middle" font-size="18" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">BTN</text>
`)

// OCBC NISP
export const OCBC_CUSTOM_LOGO = createSvgBadge('#DC2626', `
  <path d="M22 46C30 52 50 52 58 46L54 26L40 34L26 26Z" fill="white"/>
  <text x="40" y="65" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">OCBC</text>
`)

// Maybank
export const MAYBANK_CUSTOM_LOGO = createSvgBadge('#FACC15', `
  <circle cx="40" cy="36" r="16" fill="#18181B"/>
  <path d="M30 24L36 32M50 24L44 32" stroke="#FACC15" stroke-width="3" stroke-linecap="round"/>
  <text x="40" y="64" text-anchor="middle" font-size="9" font-weight="900" fill="#18181B" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Maybank</text>
`)

// ── 2. E-Wallet, Fintech & PayLater Vectors ───────────────────────────────

// GoPay
export const GOPAY_CUSTOM_LOGO = createSvgBadge('#00AED6', `
  <circle cx="40" cy="38" r="15" fill="none" stroke="white" stroke-width="6"/>
  <circle cx="40" cy="38" r="5" fill="white"/>
  <text x="40" y="67" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">gopay</text>
`)

// OVO
export const OVO_CUSTOM_LOGO = createSvgBadge('#4C2A86', `
  <text x="40" y="49" text-anchor="middle" font-size="22" font-weight="900" fill="white" letter-spacing="1" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">OVO</text>
`)

// DANA
export const DANA_CUSTOM_LOGO = createSvgBadge('#118EEA', `
  <text x="40" y="48" text-anchor="middle" font-size="17" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">DANA</text>
  <polygon points="58,26 59,29 62,29 60,31 61,34 58,32 55,34 56,31 54,29 57,29" fill="white"/>
`)

// ShopeePay
export const SHOPEEPAY_CUSTOM_LOGO = createSvgBadge('#EE4D2D', `
  <path d="M28 30C28 22 34 18 40 18C46 18 52 22 52 30V32H28V30Z" fill="none" stroke="white" stroke-width="3"/>
  <rect x="22" y="30" width="36" height="34" rx="6" fill="white"/>
  <path d="M43 38C39 36 34 39 36 43C38 47 44 45 44 50C44 54 38 56 34 52" stroke="#EE4D2D" stroke-width="3.5" stroke-linecap="round" fill="none"/>
`)

// LinkAja
export const LINKAJA_CUSTOM_LOGO = createSvgBadge('#ED1C24', `
  <text x="40" y="45" text-anchor="middle" font-size="12" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">LinkAja!</text>
  <rect x="24" y="50" width="32" height="3" rx="1.5" fill="#FBBF24"/>
`)

// PayPal
export const PAYPAL_CUSTOM_LOGO = createSvgBadge('#003087', `
  <path d="M26 60L36 20H48C54 20 58 24 56 30C54 36 48 40 42 40H34L30 60H26Z" fill="#0079C1"/>
  <path d="M34 52L40 26H52C58 26 62 30 60 36C58 42 52 46 46 46H38L34 52Z" fill="#00457C" opacity="0.85"/>
`)

// Wise
export const WISE_CUSTOM_LOGO = createSvgBadge('#9FE870', `
  <path d="M24 24L38 46L48 24H36L32 32L28 24H24Z" fill="#163300"/>
  <text x="40" y="64" text-anchor="middle" font-size="10" font-weight="900" fill="#163300" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">wise</text>
`)

// Kredivo
export const KREDIVO_CUSTOM_LOGO = createSvgBadge('#F77D00', `
  <path d="M24 20V60M24 40L48 20M34 32L54 60" stroke="white" stroke-width="6" stroke-linecap="round"/>
`)

// Akulaku
export const AKULAKU_CUSTOM_LOGO = createSvgBadge('#E61C24', `
  <path d="M24 60L40 20L56 60M30 46H50" stroke="white" stroke-width="5" stroke-linecap="round" fill="none"/>
`)

// ── 3. Investasi, Reksadana & Crypto Vectors ───────────────────────────────

// Bibit
export const BIBIT_CUSTOM_LOGO = createSvgBadge('#10B981', `
  <path d="M40 58V32M40 32C40 22 56 22 56 32C56 42 40 42 40 42M40 38C40 28 24 28 24 38C24 48 40 48 40 48" stroke="white" stroke-width="4.5" stroke-linecap="round" fill="none"/>
`)

// Ajaib
export const AJAIB_CUSTOM_LOGO = createSvgBadge('#2563EB', `
  <polygon points="40,16 46,30 60,32 50,42 52,56 40,49 28,56 30,42 20,32 34,30" fill="white"/>
  <text x="40" y="69" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">ajaib</text>
`)

// Bareksa
export const BAREKSA_CUSTOM_LOGO = createSvgBadge('#16A34A', `
  <text x="40" y="52" text-anchor="middle" font-size="28" font-weight="900" fill="white" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">B</text>
`)

// Stockbit
export const STOCKBIT_CUSTOM_LOGO = createSvgBadge('#0F172A', `
  <path d="M48 26C42 22 32 26 32 34C32 44 48 40 48 50C48 56 40 58 32 54" stroke="#84CC16" stroke-width="5" stroke-linecap="round" fill="none"/>
`)

// Pintu Crypto
export const PINTU_CUSTOM_LOGO = createSvgBadge('#111827', `
  <rect x="26" y="20" width="28" height="40" rx="14" fill="none" stroke="white" stroke-width="4.5"/>
  <circle cx="40" cy="40" r="4" fill="white"/>
`)

// Indodax
export const INDODAX_CUSTOM_LOGO = createSvgBadge('#0284C7', `
  <circle cx="34" cy="40" r="14" fill="none" stroke="#38BDF8" stroke-width="4.5"/>
  <circle cx="46" cy="40" r="14" fill="none" stroke="white" stroke-width="4.5"/>
`)

// Binance
export const BINANCE_CUSTOM_LOGO = createSvgBadge('#1E2026', `
  <polygon points="40,22 47,29 40,36 33,29" fill="#F3BA2F"/>
  <polygon points="40,44 47,51 40,58 33,51" fill="#F3BA2F"/>
  <polygon points="26,36 33,43 26,50 19,43" fill="#F3BA2F"/>
  <polygon points="54,36 61,43 54,50 47,43" fill="#F3BA2F"/>
  <polygon points="40,33 47,40 40,47 33,40" fill="#F3BA2F"/>
`)

// Cash / Tunai
export const CASH_CUSTOM_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="body" x1="12" y1="20" x2="52" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23FCD34D"/><stop offset="45%25" stop-color="%23F59E0B"/><stop offset="100%25" stop-color="%23B45309"/></linearGradient><linearGradient id="top" x1="20" y1="8" x2="44" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23FDE68A"/><stop offset="100%25" stop-color="%23D97706"/></linearGradient><linearGradient id="rope" x1="20" y1="20" x2="44" y2="25" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23EF4444"/><stop offset="100%25" stop-color="%23991B1B"/></linearGradient><linearGradient id="coin" x1="26" y1="32" x2="38" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23FFFBEB"/><stop offset="50%25" stop-color="%23FBBF24"/><stop offset="100%25" stop-color="%23D97706"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="white" stroke="%23E2E8F0" stroke-width="1.5"/><path d="M22 14C20 10 18 8 24 8C27 8 29 11 32 11C35 11 37 8 40 8C46 8 44 10 42 14C40 18 24 18 22 14Z" fill="url(%23top)" stroke="%2392400E" stroke-width="1.2"/><rect x="20" y="19" width="24" height="4.5" rx="2.2" fill="url(%23rope)" stroke="%237F1D1D" stroke-width="0.8"/><path d="M25 23.5L22 29M28 23.5L27 30" stroke="%23991B1B" stroke-width="1.8" stroke-linecap="round"/><path d="M21 23C15 26 10 33 10 42C10 52 18 58 32 58C46 58 54 52 54 42C54 33 49 26 43 23C38 25 26 25 21 23Z" fill="url(%23body)" stroke="%2378350F" stroke-width="1.5"/><circle cx="32" cy="40" r="9.5" fill="url(%23coin)" stroke="%23B45309" stroke-width="1.2"/><text x="32" y="44.5" text-anchor="middle" font-size="13" font-weight="900" fill="%2378350F" font-family="sans-serif">$</text><path d="M16 38C15 42 16 48 20 52" stroke="%23FEF3C7" stroke-width="2.2" stroke-linecap="round" opacity="0.6"/></svg>`

// ── Master Static Mapping for 100% Offline Matching ────────────────────────
const BRAND_VECTOR_MAP = {
  // Banks
  bca: BCA_CUSTOM_LOGO,
  bri: BRI_CUSTOM_LOGO,
  blu: BLU_CUSTOM_LOGO,
  mandiri: MANDIRI_CUSTOM_LOGO,
  bni: BNI_CUSTOM_LOGO,
  jago: JAGO_CUSTOM_LOGO,
  seabank: SEABANK_CUSTOM_LOGO,
  bsi: BSI_CUSTOM_LOGO,
  cimb: CIMB_CUSTOM_LOGO,
  jenius: JENIUS_CUSTOM_LOGO,
  permata: PERMATA_CUSTOM_LOGO,
  danamon: DANAMON_CUSTOM_LOGO,
  btn: BTN_CUSTOM_LOGO,
  ocbc: OCBC_CUSTOM_LOGO,
  maybank: MAYBANK_CUSTOM_LOGO,
  neobank: createTextBadge('#FDE047', '#18181B', 'neo', 'bank'),
  allobank: createTextBadge('#6B21A8', 'white', 'allo', 'bank'),
  linebank: createTextBadge('#22C55E', 'white', 'LINE', 'bank'),
  superbank: createTextBadge('#0F172A', '#FACC15', 'SUPER', 'BANK'),
  banksaqu: createTextBadge('#C026D3', 'white', 'Saqu'),
  panin: createTextBadge('#15803D', 'white', 'Panin'),
  sinarmas: createTextBadge('#991B1B', 'white', 'Sinarmas'),
  mega: createTextBadge('#FBBF24', '#EA580C', 'MEGA'),
  dbs: createTextBadge('#DC2626', 'white', 'DBS'),
  uob: createTextBadge('#002D62', '#EF4444', 'UOB'),
  hsbc: createTextBadge('#DC2626', 'white', 'HSBC'),
  scb: createTextBadge('#0284C7', '#10B981', 'StanChart'),
  bankraya: createTextBadge('#0284C7', 'white', 'Raya'),
  krom: createTextBadge('#4F46E5', 'white', 'Krom'),
  commbank: createTextBadge('#FACC15', '#18181B', 'CBA'),
  muamalat: createTextBadge('#4A044E', '#FACC15', 'Muamalat'),
  bankdki: createTextBadge('#DC2626', 'white', 'DKI'),
  bankbjb: createTextBadge('#1E40AF', '#FACC15', 'BJB'),
  bankjateng: createTextBadge('#991B1B', 'white', 'Jateng'),
  bankjatim: createTextBadge('#DC2626', 'white', 'Jatim'),
  banknagari: createTextBadge('#1E40AF', '#EF4444', 'Nagari'),
  banksumut: createTextBadge('#0284C7', 'white', 'Sumut'),

  // E-Wallets & PayLater
  gopay: GOPAY_CUSTOM_LOGO,
  ovo: OVO_CUSTOM_LOGO,
  dana: DANA_CUSTOM_LOGO,
  shopeepay: SHOPEEPAY_CUSTOM_LOGO,
  linkaja: LINKAJA_CUSTOM_LOGO,
  paypal: PAYPAL_CUSTOM_LOGO,
  wise: WISE_CUSTOM_LOGO,
  kredivo: KREDIVO_CUSTOM_LOGO,
  akulaku: AKULAKU_CUSTOM_LOGO,
  astrapay: createTextBadge('#1D4ED8', 'white', 'Astra', 'Pay'),
  isaku: createTextBadge('#1E40AF', '#FACC15', 'i.saku'),
  doku: createTextBadge('#DC2626', 'white', 'DOKU'),
  sakuku: createTextBadge('#00529C', '#FACC15', 'Sakuku'),
  jakonepay: createTextBadge('#DC2626', 'white', 'JakOne'),
  motionpay: createTextBadge('#0284C7', 'white', 'Motion'),
  spaylater: createTextBadge('#EE4D2D', 'white', 'SPay', 'Later'),
  gopaylater: createTextBadge('#00AED6', 'white', 'GoPay', 'Later'),
  indodana: createTextBadge('#1E3A8A', '#38BDF8', 'Indodana'),
  atome: createTextBadge('#FEF08A', '#15803D', 'atome'),
  revolut: createTextBadge('#191C1F', 'white', 'Revolut'),

  // Investasi & Crypto
  bibit: BIBIT_CUSTOM_LOGO,
  ajaib: AJAIB_CUSTOM_LOGO,
  bareksa: BAREKSA_CUSTOM_LOGO,
  stockbit: STOCKBIT_CUSTOM_LOGO,
  pintu: PINTU_CUSTOM_LOGO,
  indodax: INDODAX_CUSTOM_LOGO,
  binance: BINANCE_CUSTOM_LOGO,
  pluang: createTextBadge('#FBBF24', '#78350F', 'Pluang'),
  tokocrypto: createTextBadge('#18181B', '#10B981', 'Toko', 'crypto'),
  bybit: createTextBadge('#17181E', '#FBBF24', 'BYBIT'),
  luno: createTextBadge('#1B3280', 'white', 'Luno'),
  pegadaian: createTextBadge('#15803D', '#FACC15', 'Pegadaian'),
  treasury: createTextBadge('#F59E0B', '#18181B', 'Treasury'),
  ipot: createTextBadge('#1E40AF', '#EF4444', 'IPOT'),
  mirae: createTextBadge('#EA580C', 'white', 'Mirae'),
  bions: createTextBadge('#005E5D', '#F15A24', 'BIONS'),
  most: createTextBadge('#002D62', '#F5A623', 'MOST'),
  bcasekuritas: createTextBadge('#00529C', 'white', 'BEST'),

  // Cash
  cash: CASH_CUSTOM_LOGO,
}

// ── Smart Vector Logo Resolver ─────────────────────────────────────────────
export function getWalletLogoUrl(wallet) {
  if (!wallet) return ''
  const name = String(wallet.name || '').toLowerCase().trim()
  const id = String(wallet.id || '').toLowerCase().trim()
  const inst = String(wallet.institutionType || '').toLowerCase().trim()
  const customIcon = String(wallet.customIcon || '').toLowerCase().trim()
  const url = String(wallet.logoUrl || '')

  // 1. Direct SVG Data URI check (already embedded)
  if (url.startsWith('data:image/svg+xml')) {
    return url
  }

  // 2. Cash / Physical Money Checks
  if (
    id === 'cash' ||
    inst === 'cash' ||
    customIcon === 'dollar' ||
    customIcon === 'cash' ||
    name.includes('uang tunai') ||
    name.includes('cash') ||
    name.includes('dompet fisik') ||
    name.includes('kas')
  ) {
    return CASH_CUSTOM_LOGO
  }

  // 3. Match by ID from predefined map
  if (id && BRAND_VECTOR_MAP[id]) {
    return BRAND_VECTOR_MAP[id]
  }

  // 4. Keyword fuzzy match across all Indonesian institutions
  for (const [key, vectorSvg] of Object.entries(BRAND_VECTOR_MAP)) {
    if (key.length > 2 && (name.includes(key) || inst.includes(key))) {
      return vectorSvg
    }
  }

  // 5. Special multi-word bank abbreviations
  if (name.includes('bca') || inst.includes('bca')) return BCA_CUSTOM_LOGO
  if (name.includes('bri') || inst.includes('bri')) return BRI_CUSTOM_LOGO
  if (name.includes('mandiri') || inst.includes('mandiri')) return MANDIRI_CUSTOM_LOGO
  if (name.includes('bni') || inst.includes('bni')) return BNI_CUSTOM_LOGO
  if (name.includes('jago') || inst.includes('jago')) return JAGO_CUSTOM_LOGO
  if (name.includes('seabank') || inst.includes('seabank')) return SEABANK_CUSTOM_LOGO
  if (name.includes('bsi') || inst.includes('bsi')) return BSI_CUSTOM_LOGO
  if (name.includes('cimb') || inst.includes('cimb')) return CIMB_CUSTOM_LOGO
  if (name.includes('jenius') || inst.includes('jenius')) return JENIUS_CUSTOM_LOGO
  if (name.includes('gopay') || inst.includes('gopay')) return GOPAY_CUSTOM_LOGO
  if (name.includes('ovo') || inst.includes('ovo')) return OVO_CUSTOM_LOGO
  if (name.includes('dana') || inst.includes('dana')) return DANA_CUSTOM_LOGO
  if (name.includes('shopee') || inst.includes('shopee')) return SHOPEEPAY_CUSTOM_LOGO
  if (name.includes('linkaja') || inst.includes('linkaja')) return LINKAJA_CUSTOM_LOGO
  if (name.includes('bibit') || inst.includes('bibit')) return BIBIT_CUSTOM_LOGO
  if (name.includes('ajaib') || inst.includes('ajaib')) return AJAIB_CUSTOM_LOGO
  if (name.includes('bareksa') || inst.includes('bareksa')) return BAREKSA_CUSTOM_LOGO
  if (name.includes('stockbit') || inst.includes('stockbit')) return STOCKBIT_CUSTOM_LOGO
  if (name.includes('pintu') || inst.includes('pintu')) return PINTU_CUSTOM_LOGO
  if (name.includes('indodax') || inst.includes('indodax')) return INDODAX_CUSTOM_LOGO
  if (name.includes('binance') || inst.includes('binance')) return BINANCE_CUSTOM_LOGO
  if (name.includes('paypal') || inst.includes('paypal')) return PAYPAL_CUSTOM_LOGO
  if (name.includes('wise') || inst.includes('wise')) return WISE_CUSTOM_LOGO

  // 6. Dynamic crisp vector badge fallback based on initial characters (Zero external network)
  const cleanName = wallet.name || 'Akun'
  const initials = cleanName.substring(0, 2).toUpperCase()
  return createTextBadge('#1E293B', '#F8FAFC', initials)
}

// ── Predefined Institution Presets ─────────────────────────────────────────
export const walletInstitutions = [
  // ── 1. Bank Utama & Digital Indonesia ──────────────────────────────────
  { id: 'bca', name: 'BCA', type: 'bank', domain: 'bca.co.id', logoUrl: BCA_CUSTOM_LOGO, isRecommended: true },
  { id: 'bri', name: 'BRI', type: 'bank', domain: 'bri.co.id', logoUrl: BRI_CUSTOM_LOGO, isRecommended: true },
  { id: 'mandiri', name: 'Mandiri', type: 'bank', domain: 'bankmandiri.co.id', logoUrl: MANDIRI_CUSTOM_LOGO, isRecommended: true },
  { id: 'bni', name: 'BNI', type: 'bank', domain: 'bni.co.id', logoUrl: BNI_CUSTOM_LOGO, isRecommended: true },
  { id: 'jago', name: 'Bank Jago', type: 'bank', domain: 'jago.com', logoUrl: JAGO_CUSTOM_LOGO, isRecommended: true },
  { id: 'seabank', name: 'SeaBank', type: 'bank', domain: 'seabank.co.id', logoUrl: SEABANK_CUSTOM_LOGO, isRecommended: true },
  { id: 'bsi', name: 'BSI (Bank Syariah Indonesia)', type: 'bank', domain: 'bankbsi.co.id', logoUrl: BSI_CUSTOM_LOGO, isRecommended: true },

  // Bank Digital & Swasta
  { id: 'cimb', name: 'CIMB Niaga', type: 'bank', domain: 'cimbniaga.co.id', logoUrl: CIMB_CUSTOM_LOGO, isRecommended: false },
  { id: 'jenius', name: 'Jenius (BTPN)', type: 'bank', domain: 'jenius.com', logoUrl: JENIUS_CUSTOM_LOGO, isRecommended: false },
  { id: 'blu', name: 'blu (BCA Digital)', type: 'bank', domain: 'bcadigital.co.id', logoUrl: BLU_CUSTOM_LOGO, isRecommended: false },
  { id: 'neobank', name: 'NeoBank (BNC)', type: 'bank', domain: 'bankneocommerce.co.id', logoUrl: BRAND_VECTOR_MAP.neobank, isRecommended: false },
  { id: 'allobank', name: 'Allo Bank', type: 'bank', domain: 'allobank.com', logoUrl: BRAND_VECTOR_MAP.allobank, isRecommended: false },
  { id: 'btn', name: 'Bank BTN', type: 'bank', domain: 'btn.co.id', logoUrl: BTN_CUSTOM_LOGO, isRecommended: false },
  { id: 'permata', name: 'PermataBank', type: 'bank', domain: 'permatabank.com', logoUrl: PERMATA_CUSTOM_LOGO, isRecommended: false },
  { id: 'danamon', name: 'Bank Danamon', type: 'bank', domain: 'danamon.co.id', logoUrl: DANAMON_CUSTOM_LOGO, isRecommended: false },
  { id: 'mega', name: 'Bank Mega', type: 'bank', domain: 'bankmega.com', logoUrl: BRAND_VECTOR_MAP.mega, isRecommended: false },
  { id: 'sinarmas', name: 'Bank Sinarmas', type: 'bank', domain: 'banksinarmas.com', logoUrl: BRAND_VECTOR_MAP.sinarmas, isRecommended: false },
  { id: 'panin', name: 'Panin Bank', type: 'bank', domain: 'panin.co.id', logoUrl: BRAND_VECTOR_MAP.panin, isRecommended: false },
  { id: 'muamalat', name: 'Bank Muamalat', type: 'bank', domain: 'bankmuamalat.co.id', logoUrl: BRAND_VECTOR_MAP.muamalat, isRecommended: false },
  { id: 'ocbc', name: 'OCBC NISP', type: 'bank', domain: 'ocbc.id', logoUrl: OCBC_CUSTOM_LOGO, isRecommended: false },
  { id: 'maybank', name: 'Maybank Indonesia', type: 'bank', domain: 'maybank.co.id', logoUrl: MAYBANK_CUSTOM_LOGO, isRecommended: false },
  { id: 'dbs', name: 'digibank (DBS)', type: 'bank', domain: 'dbs.id', logoUrl: BRAND_VECTOR_MAP.dbs, isRecommended: false },
  { id: 'uob', name: 'UOB Indonesia', type: 'bank', domain: 'uob.co.id', logoUrl: BRAND_VECTOR_MAP.uob, isRecommended: false },
  { id: 'hsbc', name: 'HSBC Indonesia', type: 'bank', domain: 'hsbc.co.id', logoUrl: BRAND_VECTOR_MAP.hsbc, isRecommended: false },
  { id: 'scb', name: 'Standard Chartered', type: 'bank', domain: 'sc.com', logoUrl: BRAND_VECTOR_MAP.scb, isRecommended: false },
  { id: 'bankraya', name: 'Bank Raya', type: 'bank', domain: 'bankraya.co.id', logoUrl: BRAND_VECTOR_MAP.bankraya, isRecommended: false },
  { id: 'krom', name: 'Krom Digital Bank', type: 'bank', domain: 'krom.id', logoUrl: BRAND_VECTOR_MAP.krom, isRecommended: false },
  { id: 'superbank', name: 'Superbank', type: 'bank', domain: 'superbank.id', logoUrl: BRAND_VECTOR_MAP.superbank, isRecommended: false },
  { id: 'linebank', name: 'Line Bank (Hana)', type: 'bank', domain: 'linebank.co.id', logoUrl: BRAND_VECTOR_MAP.linebank, isRecommended: false },
  { id: 'banksaqu', name: 'Bank Saqu', type: 'bank', domain: 'banksaqu.co.id', logoUrl: BRAND_VECTOR_MAP.banksaqu, isRecommended: false },
  { id: 'commbank', name: 'Commonwealth Bank', type: 'bank', domain: 'commbank.co.id', logoUrl: BRAND_VECTOR_MAP.commbank, isRecommended: false },

  // Bank Daerah (BPD)
  { id: 'bankdki', name: 'Bank DKI', type: 'bank', domain: 'bankdki.co.id', logoUrl: BRAND_VECTOR_MAP.bankdki, isRecommended: false },
  { id: 'bankbjb', name: 'Bank BJB', type: 'bank', domain: 'bankbjb.co.id', logoUrl: BRAND_VECTOR_MAP.bankbjb, isRecommended: false },
  { id: 'bankjateng', name: 'Bank Jateng', type: 'bank', domain: 'bankjateng.co.id', logoUrl: BRAND_VECTOR_MAP.bankjateng, isRecommended: false },
  { id: 'bankjatim', name: 'Bank Jatim', type: 'bank', domain: 'bankjatim.co.id', logoUrl: BRAND_VECTOR_MAP.bankjatim, isRecommended: false },
  { id: 'banknagari', name: 'Bank Nagari', type: 'bank', domain: 'banknagari.co.id', logoUrl: BRAND_VECTOR_MAP.banknagari, isRecommended: false },
  { id: 'banksumut', name: 'Bank Sumut', type: 'bank', domain: 'banksumut.co.id', logoUrl: BRAND_VECTOR_MAP.banksumut, isRecommended: false },

  // ── 2. E-Wallet, Fintech & PayLater ────────────────────────────────────
  { id: 'gopay', name: 'GoPay', type: 'ewallet', domain: 'gopay.co.id', logoUrl: GOPAY_CUSTOM_LOGO, isRecommended: true },
  { id: 'ovo', name: 'OVO', type: 'ewallet', domain: 'ovo.id', logoUrl: OVO_CUSTOM_LOGO, isRecommended: true },
  { id: 'dana', name: 'DANA', type: 'ewallet', domain: 'dana.id', logoUrl: DANA_CUSTOM_LOGO, isRecommended: true },
  { id: 'shopeepay', name: 'ShopeePay', type: 'ewallet', domain: 'shopeepay.co.id', logoUrl: SHOPEEPAY_CUSTOM_LOGO, isRecommended: true },
  { id: 'linkaja', name: 'LinkAja', type: 'ewallet', domain: 'linkaja.id', logoUrl: LINKAJA_CUSTOM_LOGO, isRecommended: true },
  { id: 'astrapay', name: 'AstraPay', type: 'ewallet', domain: 'astrapay.com', logoUrl: BRAND_VECTOR_MAP.astrapay, isRecommended: false },
  { id: 'isaku', name: 'iSAKU (Indomaret)', type: 'ewallet', domain: 'isaku-indomaret.com', logoUrl: BRAND_VECTOR_MAP.isaku, isRecommended: false },
  { id: 'doku', name: 'DOKU Wallet', type: 'ewallet', domain: 'doku.com', logoUrl: BRAND_VECTOR_MAP.doku, isRecommended: false },
  { id: 'sakuku', name: 'Sakuku BCA', type: 'ewallet', domain: 'bca.co.id', logoUrl: BRAND_VECTOR_MAP.sakuku, isRecommended: false },
  { id: 'jakonepay', name: 'JakOne Pay', type: 'ewallet', domain: 'jakone.mobi', logoUrl: BRAND_VECTOR_MAP.jakonepay, isRecommended: false },
  { id: 'motionpay', name: 'MotionPay', type: 'ewallet', domain: 'motionpay.id', logoUrl: BRAND_VECTOR_MAP.motionpay, isRecommended: false },
  { id: 'paypal', name: 'PayPal', type: 'ewallet', domain: 'paypal.com', logoUrl: PAYPAL_CUSTOM_LOGO, isRecommended: false, defaultCurrency: 'USD' },
  { id: 'wise', name: 'Wise (TransferWise)', type: 'ewallet', domain: 'wise.com', logoUrl: WISE_CUSTOM_LOGO, isRecommended: false, defaultCurrency: 'USD' },
  { id: 'revolut', name: 'Revolut', type: 'ewallet', domain: 'revolut.com', logoUrl: BRAND_VECTOR_MAP.revolut, isRecommended: false, defaultCurrency: 'USD' },
  { id: 'kredivo', name: 'Kredivo / PayLater', type: 'ewallet', domain: 'kredivo.com', logoUrl: KREDIVO_CUSTOM_LOGO, isRecommended: false },
  { id: 'akulaku', name: 'Akulaku PayLater', type: 'ewallet', domain: 'akulaku.com', logoUrl: AKULAKU_CUSTOM_LOGO, isRecommended: false },
  { id: 'spaylater', name: 'SPayLater (Shopee)', type: 'ewallet', domain: 'shopee.co.id', logoUrl: BRAND_VECTOR_MAP.spaylater, isRecommended: false },
  { id: 'gopaylater', name: 'GoPayLater', type: 'ewallet', domain: 'gojek.com', logoUrl: BRAND_VECTOR_MAP.gopaylater, isRecommended: false },
  { id: 'indodana', name: 'Indodana PayLater', type: 'ewallet', domain: 'indodana.id', logoUrl: BRAND_VECTOR_MAP.indodana, isRecommended: false },
  { id: 'atome', name: 'Atome PayLater', type: 'ewallet', domain: 'atome.id', logoUrl: BRAND_VECTOR_MAP.atome, isRecommended: false },

  // ── 3. Investasi, Reksadana & Crypto ──────────────────────────────────
  { id: 'bibit', name: 'Bibit', type: 'investasi', domain: 'bibit.id', logoUrl: BIBIT_CUSTOM_LOGO, isRecommended: true },
  { id: 'ajaib', name: 'Ajaib Sekuritas', type: 'investasi', domain: 'ajaib.co.id', logoUrl: AJAIB_CUSTOM_LOGO, isRecommended: true },
  { id: 'bareksa', name: 'Bareksa', type: 'investasi', domain: 'bareksa.com', logoUrl: BAREKSA_CUSTOM_LOGO, isRecommended: false },
  { id: 'stockbit', name: 'Stockbit', type: 'investasi', domain: 'stockbit.com', logoUrl: STOCKBIT_CUSTOM_LOGO, isRecommended: false },
  { id: 'pintu', name: 'Pintu Crypto', type: 'investasi', domain: 'pintu.co.id', logoUrl: PINTU_CUSTOM_LOGO, isRecommended: false },
  { id: 'indodax', name: 'Indodax', type: 'investasi', domain: 'indodax.com', logoUrl: INDODAX_CUSTOM_LOGO, isRecommended: false },
  { id: 'pluang', name: 'Pluang', type: 'investasi', domain: 'pluang.com', logoUrl: BRAND_VECTOR_MAP.pluang, isRecommended: false },
  { id: 'tokocrypto', name: 'Tokocrypto', type: 'investasi', domain: 'tokocrypto.com', logoUrl: BRAND_VECTOR_MAP.tokocrypto, isRecommended: false },
  { id: 'binance', name: 'Binance', type: 'investasi', domain: 'binance.com', logoUrl: BINANCE_CUSTOM_LOGO, isRecommended: false, defaultCurrency: 'USD' },
  { id: 'bybit', name: 'Bybit Crypto', type: 'investasi', domain: 'bybit.com', logoUrl: BRAND_VECTOR_MAP.bybit, isRecommended: false, defaultCurrency: 'USD' },
  { id: 'luno', name: 'Luno Crypto', type: 'investasi', domain: 'luno.com', logoUrl: BRAND_VECTOR_MAP.luno, isRecommended: false },
  { id: 'pegadaian', name: 'Pegadaian Digital (Emas)', type: 'investasi', domain: 'pegadaian.co.id', logoUrl: BRAND_VECTOR_MAP.pegadaian, isRecommended: false },
  { id: 'treasury', name: 'Treasury Emas', type: 'investasi', domain: 'treasury.id', logoUrl: BRAND_VECTOR_MAP.treasury, isRecommended: false },
  { id: 'ipot', name: 'IPOT (Indo Premier)', type: 'investasi', domain: 'indopremier.com', logoUrl: BRAND_VECTOR_MAP.ipot, isRecommended: false },
  { id: 'mirae', name: 'Mirae Asset Sekuritas', type: 'investasi', domain: 'miraeasset.co.id', logoUrl: BRAND_VECTOR_MAP.mirae, isRecommended: false },
  { id: 'bions', name: 'BNI Sekuritas (BIONS)', type: 'investasi', domain: 'bions.id', logoUrl: BRAND_VECTOR_MAP.bions, isRecommended: false },
  { id: 'most', name: 'Mandiri Sekuritas (MOST)', type: 'investasi', domain: 'most.co.id', logoUrl: BRAND_VECTOR_MAP.most, isRecommended: false },
  { id: 'bcasekuritas', name: 'BCA Sekuritas (BEST)', type: 'investasi', domain: 'bcasekuritas.co.id', logoUrl: BRAND_VECTOR_MAP.bcasekuritas, isRecommended: false },

  // ── 4. Kas Utama & Lainnya ──────────────────────────────────────────────
  { id: 'cash', name: 'Cash', type: 'lainnya', logoUrl: CASH_CUSTOM_LOGO, isRecommended: true, subtitle: 'Kas Fisik', customIcon: 'dollar' },
]
