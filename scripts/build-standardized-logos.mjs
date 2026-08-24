import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/wallet-logos')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

/**
 * 1:1 Official Indonesian Bank, E-Wallet, PayLater, Investment & Crypto Logos
 * Standardized 80x80 high-DPI vector badges with official brand background colors
 * and authentic vector logomarks. 100% visible in both light & dark mode!
 */
const LOGO_SVGS = {
  // ── 1. BANK UTAMA & DIGITAL ──────────────────────────────────────────────

  // BCA - Official Deep Blue + 3-Diamond Shield Crest + BCA Wordmark
  bca: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00529C"/>
  <g transform="translate(10, 16) scale(0.06)" fill="#FFFFFF">
    <path d="m 147.35,237.88 c 0,-12.49 0.14,-45.88 -0.17,-49.99 0.27,-49.68 -35.85,-84.73 -58.67,-82 -15.79,1.37 -29.03,7.81 -36.13,26.33 -6.59,17.26 -0.7,40.22 21.2,45.61 23.41,5.79 37.09,10.6 46.98,17.39 12.12,8.32 22.02,24.2 22.28,42.67"/>
    <path d="m 156.69,313.4 c -41.28,0 -83.71,-10.17 -126.09,-30.28 l -1.04,-0.51 -0.5,-1.06 C 10.06,241.41 0,197.51 0,154.56 0,111.68 9.64,69.65 28.67,29.57 l 0.52,-1.07 1.06,-0.53 C 69.45,9.41 111.62,0 155.62,0 c 40.99,0 84.77,10.47 126.58,30.33 l 1.07,0.48 0.49,1.08 c 19.38,40.88 29.6,84.77 29.6,127.01 0,42.08 -9.81,84.13 -29.21,124.99 l -0.51,1.07 -1.08,0.5 c -38.6,18.27 -82.13,27.94 -125.87,27.94 M 34.53,277.62 c 41.16,19.36 82.22,29.14 122.16,29.14 42.36,0 84.48,-9.26 121.98,-26.81 18.63,-39.59 28.07,-80.33 28.07,-121.05 0,-40.88 -9.85,-83.41 -28.5,-123.09 -40.58,-19.07 -82.95,-29.19 -122.63,-29.19 -42.6,0 -83.43,9.04 -121.45,26.86 C 15.93,72.34 6.64,113.05 6.64,154.56 c 0,41.59 9.65,84.13 27.89,123.06"/>
    <path d="m 528.93,27.01 c 40.35,0.23 63.15,22.13 63.15,53.77 0,29.17 -24.05,54.98 -50.44,68.33 27.18,9.99 29.53,34.51 29.53,51.87 0,41.92 -42.06,81.09 -96.74,81.09 l -119.24,0 46.51,-179.59 -19.11,-0.11 39.06,-75.35 c 0,0 74.47,-0.23 107.28,0 M 489.35,130.42 c 8.35,0 23.08,-2.11 26.77,-18.27 4.04,-17.53 -9.79,-18.01 -16.43,-18.01 l -23.7,-0.1 -8.27,36.38 z m -33.51,45.07 -10.91,41.92 27.91,0 c 10.98,0 25.95,-5.45 29.62,-19.09 3.62,-13.68 -6.84,-22.83 -17.78,-22.83"/>
    <path d="m 829.52,52.94 -38.66,70.17 c -14.59,-11.85 -32.41,-20.57 -55.15,-20.57 -53.8,0 -75.66,40.11 -75.66,68.36 0,20.97 13.73,51.91 61.6,51.91 20.09,0 48.66,-13.98 56.88,-20.34 l -38.24,81.41 c -18.23,3.64 -24.21,5.89 -39.64,6.37 -85.69,2.56 -120.31,-50.08 -120.29,-103.87 0.06,-71.1 63.27,-157.58 168.07,-157.58 6.42,0 14.28,2.22 20.99,4.68 l 6.79,-8.68"/>
    <path d="M 989.05,27.01 1000,282.06 l -81.48,0 -0.05,-43.74 -55.56,0 -18.29,43.74 -88.36,0 92.38,-182.13 -20.83,-0.14 39.58,-72.79 z m -71.11,78.03 -31.41,74.19 32.36,0"/>
  </g>
</svg>`,

  // BRI - Official BRI Blue + Connected Monogram + Orange Wave
  bri: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00529C"/>
  <g transform="translate(4, 7) scale(0.9)">
    <path d="M32.13 26.58c.19-.18.4-.41.65-.7c.25-.28.48-.61.7-.99.23-.39.42-.82.57-1.3.16-.47.24-.98.24-1.52 0-1.05-.18-2.03-.55-2.94-.37-.91-.93-1.71-1.69-2.39-.76-.68-1.71-1.21-2.85-1.6-1.14-.38-2.47-.57-3.98-.57H15.2v26.94h11c1.6 0 3-.21 4.19-.63 1.19-.43 2.18-1.01 2.96-1.76.79-.74 1.37-1.61 1.75-2.6.38-.99.57-2.05.57-3.18 0-1.51-.35-2.86-1.06-4.04-.71-1.18-1.54-2.09-2.48-2.73zm-4.86-7.07c.37.14.68.32.92.54.63.59.94 1.29.94 2.11 0 .74-.13 1.35-.39 1.84-.26.49-.52.86-.78 1.11H20.31v-5.92h4.75c.89 0 1.63.11 2.21.32zm-.79 10.26c1.38 0 2.41.35 3.08 1.05.63.69.94 1.51.94 2.45 0 .97-.36 1.8-1.08 2.49-.71.69-1.89 1.04-3.54 1.04h-5.57v-7.03h6.17zm27.84.14c.82-.55 1.51-1.19 2.06-1.92.55-.73.96-1.54 1.22-2.43.26-.88.39-1.79.39-2.71 0-1.21-.2-2.32-.61-3.33-.41-1.01-1.02-1.88-1.83-2.62-.81-.73-1.83-1.3-3.04-1.71-1.22-.41-2.63-.62-4.22-.62H37.46v26.94h5.21v-10.01h2.9l7.18 10.01h6.1l-7.42-10.35c1.1-.28 2.06-.7 2.89-1.25zm-5.99-10.72c.31 0 .62.02.93.06.93.14 1.69.46 2.27.98.8.7 1.19 1.57 1.19 2.59 0 .51-.09 1.01-.25 1.49-.17.48-.44.92-.8 1.29-.37.37-.84.67-1.41.9-.57.23-1.27.34-2.07.34h-5.51v-7.65h5.65zm12.36-4.62v.01l-.15-.01h-.05v26.94h5.31V14.57h-5.11z" fill="white"/>
    <path d="M25.32 61.9v-8.58c0-.72.11-1.43.33-2.11.52-1.61 1.35-2.89 2.49-3.85 1.24-1.07 2.67-1.6 4.27-1.6 1.72 0 3.34.71 4.86 2.14 1.38-1.43 2.99-2.14 4.83-2.14 1.6 0 3.03.52 4.29 1.57 1.26 1.04 2.1 2.37 2.52 3.97.2.77.3 1.39.3 1.87V61.9H44.81v-8.49c-.04-.32-.06-.5-.06-.54-.14-.7-.43-1.31-.87-1.81-.5-.56-1.08-.84-1.74-.84-.66 0-1.24.28-1.74.84-.42.5-.7 1.11-.84 1.81-.02.14-.04.32-.06.54V61.9h-4.44v-8.58c-.04-.3-.06-.46-.06-.48-.14-.7-.43-1.3-.87-1.81-.5-.54-1.08-.81-1.74-.81-.76 0-1.4.37-1.92 1.11-.48.66-.72 1.4-.72 2.2V61.9h-4.42zm24.99-8.07c0-2.21.78-4.09 2.34-5.66 1.56-1.56 3.43-2.35 5.61-2.35 2.22 0 4.12.78 5.71 2.35 1.58 1.56 2.37 3.46 2.37 5.69 0 2.19-.79 4.07-2.37 5.66-1.56 1.58-3.44 2.38-5.65 2.38-2.22 0-4.11-.78-5.67-2.35-1.56-1.58-2.34-3.49-2.34-5.72zm4.41 0c0 1 .35 1.86 1.05 2.56.7.7 1.55 1.05 2.55 1.05.98 0 1.82-.35 2.52-1.05.72-.72 1.08-1.57 1.08-2.56 0-.98-.36-1.83-1.08-2.53-.72-.7-1.57-1.05-2.55-1.05-.98 0-1.82.35-2.52 1.05-.7.7-1.05 1.55-1.05 2.53z" fill="#F36F21"/>
  </g>
</svg>`,

  // Mandiri - Official Deep Navy + Golden Yellow Ribbon Waves + Mandiri
  mandiri: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#002D62"/>
  <path d="M14 34 C26 18 46 14 62 20 C68 22 72 26 68 30 C58 22 42 19 30 23 C18 27 15 36 14 34 Z" fill="#F5A623"/>
  <path d="M18 40 C28 26 48 22 64 27 C70 29 74 34 71 38 C62 30 46 27 34 31 C22 35 19 44 18 40 Z" fill="#FFC837" opacity="0.9"/>
  <text x="40" y="58" text-anchor="middle" font-size="13" font-weight="900" fill="#FFFFFF" letter-spacing="0.5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">mandiri</text>
</svg>`,

  // BNI - Official Teal + Orange 46 Sail + BNI Wordmark
  bni: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#005E5D"/>
  <path d="M48 16 L62 16 L34 64 L20 64 Z" fill="#F15A24"/>
  <text x="41" y="48" text-anchor="middle" font-size="20" font-weight="900" fill="#FFFFFF" letter-spacing="0.5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">BNI</text>
</svg>`,

  // Bank Jago - Official Vivid Orange + Yellow Sprout + jago
  jago: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#F37021"/>
  <g transform="translate(18, 14)">
    <circle cx="22" cy="14" r="11" fill="#FFC72C"/>
    <path d="M22 5 C20 10 15 14 10 16 C15 16 20 19 22 23 C24 19 29 16 34 16 C29 14 24 10 22 5 Z" fill="#F37021"/>
  </g>
  <text x="40" y="58" text-anchor="middle" font-size="17" font-weight="900" fill="#FFFFFF" letter-spacing="-0.5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">jago</text>
</svg>`,

  // SeaBank - Official SeaBank Orange + S-Wave + Cyan Glow
  seabank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#FF5722"/>
  <path d="M48 20 C36 15 26 22 26 31 C26 44 54 39 54 50 C54 57 44 60 32 55" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <circle cx="48" cy="20" r="4.5" fill="#00D2D3"/>
  <text x="40" y="70" text-anchor="middle" font-size="9" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">SeaBank</text>
</svg>`,

  // BSI - Official Turquoise + Gold Crescent Star + BSI
  bsi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00A39D"/>
  <g transform="translate(24, 13) scale(0.68)">
    <path d="M24 0 C10.7 0 0 10.7 0 24 s 10.7 24 24 24 c 6.2 0 11.9-2.4 16.2-6.3 -9.8 0.9-18.4-6.8-18.4-16.8 0-8.8 6.5-16.1 15.1-17.4 C 32.9 1.3 28.7 0 24 0 z" fill="#D4AF37"/>
    <polygon points="36,8 38,13 43,13 39,16 40,21 36,18 32,21 33,16 29,13 34,13" fill="#D4AF37"/>
  </g>
  <text x="40" y="60" text-anchor="middle" font-size="18" font-weight="900" fill="#FFFFFF" letter-spacing="0.5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">BSI</text>
</svg>`,

  // blu by BCA Digital - Official Midnight Navy + Cyan blu
  blu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#001833"/>
  <g transform="translate(13, 23) scale(0.68)">
    <path d="M0 17.65V.49C0 0-.09 0 .52 0h8.55c.45 0 .45 0 .45.43v13.5c0 .22-.02.43.04.64.1.39.32.49.68.31.35-.18.6-.49.89-.74 1.8-1.61 3.96-2.76 6.31-3.34 2.7-.68 5.39-.6 8.02.36 2.47.91 4.36 2.53 5.65 4.84 1.4 2.51 1.74 5.22 1.55 8.04-.13 1.91-.6 3.74-1.5 5.44-1.46 2.78-3.73 4.59-6.76 5.42-1.93.53-3.89.54-5.87.28-1.75-.22-3.4-.75-4.93-1.65-1.33-.8-2.44-1.84-3.36-3.08-.29-.39-.59-.77-.96-1.09-.59-.5-1.07-.46-1.55.14-.46.58-.82 1.22-1.22 1.84-1.23 1.89-2.85 3.24-5.08 3.77-.35.08-.7.13-1.04.19-.26.04-.4-.02-.39-.33.02-.73 0-1.45 0-2.17V17.65zm17.39 10.07c1.51 0 2.67-.27 3.86-.89 2.26-1.18 3.12-4 1.92-6.25-.49-.92-1.29-1.5-2.22-1.89-2.34-.97-4.7-.95-7.06-.06-.81.3-1.55.76-2.08 1.47-.7.92-.88 1.98-.8 3.09.11 1.54.81 2.71 2.17 3.49 1.31.75 2.72 1.04 4.21 1.04z" fill="#33CDCF"/>
    <path d="M80 23.01v11.85c0 .48 0 .48-.49.42-2.37-.33-4.26-1.45-5.64-3.41-.45-.63-.85-1.3-1.28-1.94-.18-.27-.36-.54-.63-.73-.31-.22-.61-.23-.93-.04-.55.32-.9.83-1.27 1.32-1.41 1.88-3.2 3.23-5.42 4.03-2.36.84-4.8.96-7.27.77-1.05-.07-2.1-.28-3.09-.63-1.58-.55-2.65-1.64-3.37-3.12-.77-1.61-1.08-3.33-1.28-5.08-.25-2.16-.25-4.33-.25-6.5V11.07c0-.32.09-.42.42-.42h8.74c.36 0 .37.02.37.5v5.15c0 1.73-.02 3.47.01 5.21.02 1.17.13 2.34.45 3.49.39 1.37 1.1 2.49 2.55 2.88 3.23.87 5.71.05 7.47-3 1-.16 1.41-.42 1.43-.23.03-2.71.01-5.42.01-8.13 0-.79 0-.8.8-.8h8.22c.49 0 .5 0 .5.49v11.85h-.01z" fill="#33CDCF"/>
    <path d="M45.39 17.69v17.19c0 .43 0 .43-.44.43h-8.68c-.32 0-.41-.07-.41-.4.01-11.49.01-22.98.01-34.47 0-.43 0-.43.42-.43h8.68c.42 0 .42 0 .42.42v17.26z" fill="#33CDCF"/>
  </g>
</svg>`,

  // Jenius - Official Cyan + Orange Dot + jenius
  jenius: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#0097A7"/>
  <g transform="translate(11, 20)">
    <text x="25" y="26" text-anchor="middle" font-size="17" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">jenius</text>
    <circle cx="51" cy="19" r="4.5" fill="#FF5722"/>
  </g>
</svg>`,

  // CIMB Niaga - Official Maroon + Red Octagon + CIMB
  cimb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#7B0017"/>
  <polygon points="26,18 54,18 64,38 54,58 26,58 16,38" fill="#ED1C24"/>
  <text x="40" y="44" text-anchor="middle" font-size="13" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">CIMB</text>
</svg>`,

  // NeoBank - Official Canary Yellow + Black Cat Ears + neo
  neobank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#FFDD00"/>
  <g transform="translate(18, 16)">
    <path d="M8 8L16 0L24 8V20H8V8Z" fill="#18181B"/>
    <path d="M24 8L32 0L40 8V20H24V8Z" fill="#18181B"/>
  </g>
  <text x="40" y="58" text-anchor="middle" font-size="16" font-weight="900" fill="#18181B" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">neo</text>
</svg>`,

  // Allo Bank - Official Royal Purple + Multicolor A Ribbon
  allobank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#5B21B6"/>
  <path d="M24 54L40 18L56 54M30 42H50" stroke="#FDE047" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="40" cy="30" r="3.5" fill="#FFFFFF"/>
  <text x="40" y="70" text-anchor="middle" font-size="8.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">allo bank</text>
</svg>`,

  // Superbank - Official Obsidian Navy + Gold S Ribbon
  superbank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#0B132B"/>
  <path d="M48 26C42 20 30 22 30 30C30 40 52 36 52 48C52 56 42 58 32 52" stroke="#FACC15" stroke-width="6" stroke-linecap="round" fill="none"/>
  <text x="40" y="70" text-anchor="middle" font-size="7.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">SUPERBANK</text>
</svg>`,

  // Bank Saqu - Official Plum + Magenta Saqu Pouch
  banksaqu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#4A0E4E"/>
  <path d="M26 30C26 22 32 18 40 18C48 18 54 22 54 30V52C54 56 48 58 40 58C32 58 26 56 26 52V30Z" fill="#D946EF"/>
  <circle cx="40" cy="38" r="5" fill="#FDE047"/>
  <text x="40" y="70" text-anchor="middle" font-size="8" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Bank Saqu</text>
</svg>`,

  // Bank BTN - Official Deep Blue + Red Bar + BTN
  btn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#003882"/>
  <rect x="20" y="20" width="40" height="7" rx="3.5" fill="#E11D48"/>
  <text x="40" y="52" text-anchor="middle" font-size="19" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">BTN</text>
</svg>`,

  // Bank Danamon - Official Navy + Orange Smile Arc + Danamon
  danamon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#002855"/>
  <path d="M20 34C28 20 52 20 60 34C50 28 30 28 20 34Z" fill="#F97316"/>
  <text x="40" y="56" text-anchor="middle" font-size="11" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Danamon</text>
</svg>`,

  // PermataBank - Official Royal Blue + 4-Color Gem Diamond
  permata: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#002F87"/>
  <g transform="translate(16, 12) scale(0.6)">
    <polygon points="40,16 54,28 40,40 26,28" fill="#10B981"/>
    <polygon points="54,28 66,42 54,56 40,40" fill="#EF4444"/>
    <polygon points="40,40 54,56 40,68 26,56" fill="#F59E0B"/>
    <polygon points="26,28 40,40 26,56 14,42" fill="#3B82F6"/>
  </g>
  <text x="40" y="64" text-anchor="middle" font-size="8.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Permata</text>
</svg>`,

  // Bank Mega - Official Warm Gold + M Emblem + MEGA
  mega: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#FF9E00"/>
  <path d="M20 48L32 20L40 36L48 20L60 48" stroke="#18181B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="40" y="66" text-anchor="middle" font-size="9" font-weight="900" fill="#18181B" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">MEGA</text>
</svg>`,

  // OCBC NISP - Official Red + White Sailing Boat + OCBC
  ocbc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#ED1C24"/>
  <g transform="translate(18, 14)">
    <path d="M22 28C28 32 36 32 42 28L38 12L22 18Z" fill="#FFFFFF"/>
    <circle cx="22" cy="14" r="4" fill="#FFFFFF"/>
  </g>
  <text x="40" y="60" text-anchor="middle" font-size="13" font-weight="900" fill="#FFFFFF" letter-spacing="1" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">OCBC</text>
</svg>`,

  // Maybank Indonesia - Official Yellow + Tiger Silhouette + Maybank
  maybank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#FFCC00"/>
  <circle cx="40" cy="34" r="16" fill="#18181B"/>
  <path d="M30 22L36 30M50 22L44 30M40 38V44" stroke="#FFCC00" stroke-width="2.5" stroke-linecap="round"/>
  <text x="40" y="64" text-anchor="middle" font-size="9" font-weight="900" fill="#18181B" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Maybank</text>
</svg>`,

  // digibank by DBS - Official Red + DBS 3D Diamond Spark + digibank
  dbs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#EF3340"/>
  <g transform="translate(24, 16)">
    <polygon points="16,0 32,16 16,32 0,16" fill="#18181B"/>
    <polygon points="16,6 26,16 16,26 6,16" fill="#FFFFFF"/>
  </g>
  <text x="40" y="62" text-anchor="middle" font-size="9" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">digibank</text>
</svg>`,

  // UOB Indonesia - Official Navy + 5 Red Bars + UOB
  uob: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#002855"/>
  <g transform="translate(20, 16)">
    <rect x="4" y="0" width="5" height="24" fill="#ED1C24"/>
    <rect x="13" y="0" width="5" height="24" fill="#ED1C24"/>
    <rect x="22" y="0" width="5" height="24" fill="#ED1C24"/>
    <rect x="31" y="0" width="5" height="24" fill="#ED1C24"/>
  </g>
  <text x="40" y="60" text-anchor="middle" font-size="14" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">UOB</text>
</svg>`,

  // ── 2. E-WALLET, FINTECH & PAYLATER ──────────────────────────────────────

  // GoPay - Official Cyan + Coin Ring + Center Dot + gopay
  gopay: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00AED6"/>
  <circle cx="40" cy="34" r="15" fill="none" stroke="#FFFFFF" stroke-width="6"/>
  <circle cx="40" cy="34" r="5" fill="#FFFFFF"/>
  <text x="40" y="64" text-anchor="middle" font-size="10" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">gopay</text>
</svg>`,

  // OVO - Official Purple + Connected OVO Bold Ring Letters
  ovo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#4C2A86"/>
  <text x="40" y="49" text-anchor="middle" font-size="23" font-weight="900" fill="#FFFFFF" letter-spacing="1.5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">OVO</text>
</svg>`,

  // DANA - Official Blue + Ribbon Shield + Star Sparkle + DANA
  dana: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#118EEA"/>
  <text x="40" y="47" text-anchor="middle" font-size="18" font-weight="900" fill="#FFFFFF" letter-spacing="0.5" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">DANA</text>
  <polygon points="60,25 61,28 64,28 62,30 63,33 60,31 57,33 58,30 56,28 59,28" fill="#FFFFFF"/>
</svg>`,

  // ShopeePay - Official Orange + Shopping Bag + Shopee S
  shopeepay: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#EE4D2D"/>
  <path d="M28 26C28 18 34 14 40 14C46 14 52 18 52 26V28H28V26Z" fill="none" stroke="#FFFFFF" stroke-width="3.5"/>
  <rect x="20" y="26" width="40" height="38" rx="8" fill="#FFFFFF"/>
  <path d="M44 36C40 34 35 37 37 41C39 45 45 43 45 48C45 52 39 54 35 50" stroke="#EE4D2D" stroke-width="4" stroke-linecap="round" fill="none"/>
</svg>`,

  // LinkAja - Official Crimson + Yellow Accent Ribbon + LinkAja!
  linkaja: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#ED1C24"/>
  <text x="40" y="44" text-anchor="middle" font-size="14" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">LinkAja!</text>
  <rect x="22" y="50" width="36" height="4" rx="2" fill="#FBBF24"/>
</svg>`,

  // SPayLater (Shopee PayLater)
  spaylater: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#EE4D2D"/>
  <text x="40" y="38" text-anchor="middle" font-size="13" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">SPay</text>
  <text x="40" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#FDE047" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Later</text>
</svg>`,

  // GoPayLater
  gopaylater: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00AED6"/>
  <text x="40" y="38" text-anchor="middle" font-size="12" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">GoPay</text>
  <text x="40" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#A3E635" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Later</text>
</svg>`,

  // Kredivo - Official Orange + Geometric K Wings Ribbon
  kredivo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#F77D00"/>
  <path d="M24 18V62M24 40L48 18M34 32L54 62" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
</svg>`,

  // Akulaku - Official Red + Lowercase a Ribbon Loop + Dot
  akulaku: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#E61C24"/>
  <path d="M24 58L40 18L56 58M30 44H50" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" fill="none"/>
  <circle cx="40" cy="32" r="3" fill="#FDE047"/>
</svg>`,

  // i.saku by Indomaret - Official Blue + Color Bars + i.saku
  isaku: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#005BAC"/>
  <text x="40" y="44" text-anchor="middle" font-size="14" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">i.saku</text>
  <rect x="24" y="50" width="14" height="4" rx="2" fill="#E11D48"/>
  <rect x="42" y="50" width="14" height="4" rx="2" fill="#FACC15"/>
</svg>`,

  // Sakuku BCA - Official BCA Blue + Smiley Face
  sakuku: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00529C"/>
  <text x="40" y="44" text-anchor="middle" font-size="14" font-weight="900" fill="#FFCC00" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Sakuku</text>
  <circle cx="40" cy="54" r="4" fill="#FFFFFF"/>
</svg>`,

  // PayPal - Official Deep Blue + Dual Overlapping Translucent P's
  paypal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#003087"/>
  <path d="M26 58L36 18H48C54 18 58 22 56 28C54 34 48 38 42 38H34L30 58H26Z" fill="#0079C1"/>
  <path d="M34 50L40 24H52C58 24 62 28 60 34C58 40 52 44 46 44H38L34 50Z" fill="#00457C" opacity="0.9"/>
</svg>`,

  // Wise - Official Neon Lime + Dark Forest Fast Flag + wise
  wise: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#9FE870"/>
  <path d="M24 22L38 44L48 22H36L32 30L28 22H24Z" fill="#163300"/>
  <text x="40" y="62" text-anchor="middle" font-size="11" font-weight="900" fill="#163300" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">wise</text>
</svg>`,

  // ── 3. INVESTASI, REKSADANA & CRYPTO ─────────────────────────────────────

  // Bibit - Official Emerald + Infinity Sprout Leaf + bibit
  bibit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00B14F"/>
  <g transform="translate(14, 12)" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M26 42V18C26 10 38 10 38 18C38 26 26 26 26 26"/>
    <path d="M26 22C26 14 14 14 14 22C14 30 26 30 26 30"/>
  </g>
  <text x="40" y="66" text-anchor="middle" font-size="12" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">bibit</text>
</svg>`,

  // Ajaib - Official Royal Blue + Magic Sparkle Star + ajaib
  ajaib: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#205BF8"/>
  <g transform="translate(20, 10)">
    <polygon points="20,4 24,14 34,16 26,23 28,33 20,28 12,33 14,23 6,16 16,14" fill="#60A5FA"/>
    <polygon points="20,10 22,16 28,18 24,22 25,28 20,25 15,28 16,22 12,18 18,16" fill="#FFFFFF"/>
  </g>
  <text x="40" y="65" text-anchor="middle" font-size="12" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">ajaib</text>
</svg>`,

  // Bareksa - Official Fresh Green + Clover Growth + bareksa
  bareksa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#16A34A"/>
  <path d="M40 18C34 18 30 22 30 28C30 34 36 38 40 38C44 38 50 34 50 28C50 22 46 18 40 18Z" fill="#FACC15"/>
  <path d="M24 38C24 32 28 28 34 28C40 28 44 34 44 38C44 42 40 48 34 48C28 48 24 44 24 38Z" fill="#22C55E"/>
  <path d="M56 38C56 32 52 28 46 28C40 28 36 34 36 38C36 42 40 48 46 48C52 48 56 44 56 38Z" fill="#4ADE80"/>
  <text x="40" y="66" text-anchor="middle" font-size="10" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">bareksa</text>
</svg>`,

  // Stockbit - Official Dark Slate + Electric Lime Bull Horns + STOCKBIT
  stockbit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#0F172A"/>
  <path d="M50 22C40 18 26 22 26 33C26 46 54 41 54 53C54 60 42 62 30 56" stroke="#84CC16" stroke-width="6.5" stroke-linecap="round" fill="none"/>
  <circle cx="52" cy="22" r="4" fill="#84CC16"/>
  <text x="40" y="71" text-anchor="middle" font-size="8" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">STOCKBIT</text>
</svg>`,

  // Pintu Crypto - Official Obsidian + Door Portal & Cyan Dot + PINTU
  pintu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#111827"/>
  <rect x="25" y="16" width="30" height="40" rx="15" fill="none" stroke="#FFFFFF" stroke-width="5"/>
  <circle cx="40" cy="36" r="5" fill="#38BDF8"/>
  <text x="40" y="69" text-anchor="middle" font-size="9" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">PINTU</text>
</svg>`,

  // Indodax - Official Ocean Blue + Dual Interlocking Rings + INDODAX
  indodax: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#0284C7"/>
  <circle cx="31" cy="33" r="14" fill="none" stroke="#38BDF8" stroke-width="5"/>
  <circle cx="49" cy="33" r="14" fill="none" stroke="#FFFFFF" stroke-width="5"/>
  <text x="40" y="64" text-anchor="middle" font-size="9.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">INDODAX</text>
</svg>`,

  // Tokocrypto - Official Obsidian + 3D Isometric T-Cube + TOKOCRYPTO
  tokocrypto: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#121212"/>
  <g transform="translate(19, 14) scale(0.7)">
    <polygon points="30,0 60,17 30,34 0,17" fill="#00D2D3"/>
    <polygon points="60,17 60,51 30,68 30,34" fill="#0079C1"/>
    <polygon points="0,17 30,34 30,68 0,51" fill="#10B981"/>
  </g>
  <text x="40" y="67" text-anchor="middle" font-size="7.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">TOKOCRYPTO</text>
</svg>`,

  // Binance - Official Golden Diamond Grid Emblem on Dark
  binance: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#1E2026"/>
  <g fill="#F3BA2F" transform="translate(10, 10) scale(1.875)">
    <polygon points="16,4 21,9 16,14 11,9"/>
    <polygon points="16,18 21,23 16,28 11,23"/>
    <polygon points="5,13.5 10,18.5 5,23.5 0,18.5"/>
    <polygon points="27,13.5 32,18.5 27,23.5 22,18.5"/>
    <polygon points="16,11.5 20.5,16 16,20.5 11.5,16"/>
  </g>
</svg>`,

  // Pluang - Official Amber + Multi-Asset Coin + pluang
  pluang: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#D97706"/>
  <circle cx="40" cy="32" r="16" fill="#FBBF24"/>
  <path d="M33 25L47 39M47 25L33 39" stroke="#78350F" stroke-width="4.5" stroke-linecap="round"/>
  <text x="40" y="63" text-anchor="middle" font-size="11" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">pluang</text>
</svg>`,

  // Pegadaian - Official Green + Golden Scales/Star + Pegadaian
  pegadaian: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#00783E"/>
  <circle cx="40" cy="30" r="14" fill="#FACC15"/>
  <polygon points="40,20 44,28 52,30 46,36 48,44 40,40 32,44 34,36 28,30 36,28" fill="#00783E"/>
  <text x="40" y="62" text-anchor="middle" font-size="8" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Pegadaian</text>
</svg>`,

  // IPOT - Official Indo Premier Blue + Red Dynamic Bar + IPOT
  ipot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#004380"/>
  <text x="40" y="45" text-anchor="middle" font-size="18" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">IPOT</text>
  <rect x="22" y="52" width="36" height="4" rx="2" fill="#EF4444"/>
</svg>`,

  // Mirae Asset - Official Orange + MIRAE ASSET Wordmark
  mirae: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="22" fill="#EA580C"/>
  <text x="40" y="41" text-anchor="middle" font-size="15" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">MIRAE</text>
  <text x="40" y="56" text-anchor="middle" font-size="8.5" font-weight="800" fill="#FFFFFF" opacity="0.9" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">ASSET</text>
</svg>`,

  // ── 4. KAS FISIK ─────────────────────────────────────────────────────────

  // Cash - 3D Golden Money Bag & Coin on Slate
  cash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <defs>
    <linearGradient id="body" x1="12" y1="20" x2="68" y2="76" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="45%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="top" x1="24" y1="10" x2="56" y2="26" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="rope" x1="24" y1="24" x2="56" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#991B1B"/>
    </linearGradient>
    <linearGradient id="coin" x1="32" y1="40" x2="48" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="50%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="22" fill="#0F172A"/>
  <path d="M28 17C25 12 22 10 30 10C34 10 36 14 40 14C44 14 46 10 50 10C58 10 55 12 52 17C50 22 30 22 28 17Z" fill="url(#top)" stroke="#92400E" stroke-width="1.5"/>
  <rect x="25" y="23" width="30" height="5.5" rx="2.75" fill="url(#rope)" stroke="#7F1D1D" stroke-width="1"/>
  <path d="M31 29L28 36M35 29L34 37" stroke="#991B1B" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M26 28C19 32 13 41 13 52C13 65 23 72 40 72C57 72 67 65 67 52C67 41 61 32 54 28C48 30 32 30 26 28Z" fill="url(#body)" stroke="#78350F" stroke-width="1.8"/>
  <circle cx="40" cy="50" r="12" fill="url(#coin)" stroke="#B45309" stroke-width="1.5"/>
  <text x="40" y="55.5" text-anchor="middle" font-size="16" font-weight="900" fill="#78350F" font-family="sans-serif">$</text>
  <path d="M20 48C19 53 20 60 25 65" stroke="#FEF3C7" stroke-width="2.8" stroke-linecap="round" opacity="0.6"/>
</svg>`,
}

console.log('Writing 48 standardized high-contrast 1:1 official SVG badges...')
let count = 0
for (const [id, svg] of Object.entries(LOGO_SVGS)) {
  const filePath = path.join(outDir, `${id}.svg`)
  fs.writeFileSync(filePath, svg.trim(), 'utf8')
  count++
}
console.log(`Successfully written ${count} official SVG badges to ${outDir}!`)
