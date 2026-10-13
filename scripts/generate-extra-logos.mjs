import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/wallet-logos')

const EXTRA_LOGOS = {
  // Binance - Official Golden Diamond Symbol on Dark
  binance: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#1E2026"/>
  <g fill="#F3BA2F" transform="translate(10, 10) scale(1.875)">
    <polygon points="16,4 21,9 16,14 11,9"/>
    <polygon points="16,18 21,23 16,28 11,23"/>
    <polygon points="5,13.5 10,18.5 5,23.5 0,18.5"/>
    <polygon points="27,13.5 32,18.5 27,23.5 22,18.5"/>
    <polygon points="16,11.5 20.5,16 16,20.5 11.5,16"/>
  </g>
</svg>`,

  // Bibit - Official Emerald Green + Sprout Leaf
  bibit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#00B14F"/>
  <g transform="translate(14, 12)" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M26 42V18C26 10 38 10 38 18C38 26 26 26 26 26"/>
    <path d="M26 22C26 14 14 14 14 22C14 30 26 30 26 30"/>
  </g>
  <text x="40" y="66" text-anchor="middle" font-size="12" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">bibit</text>
</svg>`,

  // Ajaib - Official Royal Blue + Magic Sparkle Star
  ajaib: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#205BF8"/>
  <g transform="translate(20, 10)">
    <polygon points="20,4 24,14 34,16 26,23 28,33 20,28 12,33 14,23 6,16 16,14" fill="#60A5FA"/>
    <polygon points="20,10 22,16 28,18 24,22 25,28 20,25 15,28 16,22 12,18 18,16" fill="#FFFFFF"/>
  </g>
  <text x="40" y="65" text-anchor="middle" font-size="12" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">ajaib</text>
</svg>`,

  // Bareksa - Official Fresh Green + Clover Growth
  bareksa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#16A34A"/>
  <path d="M40 18C34 18 30 22 30 28C30 34 36 38 40 38C44 38 50 34 50 28C50 22 46 18 40 18Z" fill="#FACC15"/>
  <path d="M24 38C24 32 28 28 34 28C40 28 44 34 44 38C44 42 40 48 34 48C28 48 24 44 24 38Z" fill="#22C55E"/>
  <path d="M56 38C56 32 52 28 46 28C40 28 36 34 36 38C36 42 40 48 46 48C52 48 56 44 56 38Z" fill="#4ADE80"/>
  <text x="40" y="66" text-anchor="middle" font-size="10" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">bareksa</text>
</svg>`,

  // Stockbit - Official Dark Slate + Electric Lime Bull Horns
  stockbit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#0F172A"/>
  <path d="M50 22C40 18 26 22 26 33C26 46 54 41 54 53C54 60 42 62 30 56" stroke="#84CC16" stroke-width="6.5" stroke-linecap="round" fill="none"/>
  <circle cx="52" cy="22" r="4" fill="#84CC16"/>
  <text x="40" y="71" text-anchor="middle" font-size="8" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">STOCKBIT</text>
</svg>`,

  // Pintu Crypto - Official Obsidian + Door Portal & Cyan Dot
  pintu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#111827"/>
  <rect x="25" y="16" width="30" height="40" rx="15" fill="none" stroke="#FFFFFF" stroke-width="5"/>
  <circle cx="40" cy="36" r="5" fill="#38BDF8"/>
  <text x="40" y="69" text-anchor="middle" font-size="9" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">PINTU</text>
</svg>`,

  // Indodax - Official Ocean Blue + Dual Interlocking Rings
  indodax: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#0284C7"/>
  <circle cx="31" cy="33" r="14" fill="none" stroke="#38BDF8" stroke-width="5"/>
  <circle cx="49" cy="33" r="14" fill="none" stroke="#FFFFFF" stroke-width="5"/>
  <text x="40" y="64" text-anchor="middle" font-size="9.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">INDODAX</text>
</svg>`,

  // Tokocrypto - Official Obsidian + 3D Isometric T-Cube
  tokocrypto: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#121212"/>
  <g transform="translate(19, 14) scale(0.7)">
    <polygon points="30,0 60,17 30,34 0,17" fill="#00D2D3"/>
    <polygon points="60,17 60,51 30,68 30,34" fill="#0079C1"/>
    <polygon points="0,17 30,34 30,68 0,51" fill="#10B981"/>
  </g>
  <text x="40" y="67" text-anchor="middle" font-size="7.5" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">TOKOCRYPTO</text>
</svg>`,

  // Pluang - Official Amber + Multi-Asset Coin
  pluang: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#D97706"/>
  <circle cx="40" cy="32" r="16" fill="#FBBF24"/>
  <path d="M33 25L47 39M47 25L33 39" stroke="#78350F" stroke-width="4.5" stroke-linecap="round"/>
  <text x="40" y="63" text-anchor="middle" font-size="11" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">pluang</text>
</svg>`,

  // IPOT - Official Indo Premier Blue + Red Bar
  ipot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#004380"/>
  <text x="40" y="45" text-anchor="middle" font-size="18" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">IPOT</text>
  <rect x="22" y="52" width="36" height="4" rx="2" fill="#EF4444"/>
</svg>`,

  // Mirae Asset - Official Orange + Bold Wordmark
  mirae: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#EA580C"/>
  <text x="40" y="41" text-anchor="middle" font-size="15" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">MIRAE</text>
  <text x="40" y="56" text-anchor="middle" font-size="8.5" font-weight="800" fill="#FFFFFF" opacity="0.9" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">ASSET</text>
</svg>`,

  // SPayLater - ShopeePay Later
  spaylater: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#EE4D2D"/>
  <text x="40" y="38" text-anchor="middle" font-size="13" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">SPay</text>
  <text x="40" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#FDE047" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Later</text>
</svg>`,

  // GoPayLater
  gopaylater: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#00AED6"/>
  <text x="40" y="38" text-anchor="middle" font-size="12" font-weight="900" fill="#FFFFFF" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">GoPay</text>
  <text x="40" y="55" text-anchor="middle" font-size="11" font-weight="900" fill="#A3E635" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Later</text>
</svg>`,

  // Sakuku BCA
  sakuku: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#00529C"/>
  <text x="40" y="44" text-anchor="middle" font-size="14" font-weight="900" fill="#FFCC00" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">Sakuku</text>
  <circle cx="40" cy="54" r="4" fill="#FFFFFF"/>
</svg>`,
}

for (const [id, svgContent] of Object.entries(EXTRA_LOGOS)) {
  const targetFile = path.join(outDir, `${id}.svg`)
  fs.writeFileSync(targetFile, svgContent, 'utf8')
  console.log(`Saved extra logo ${id}.svg`)
}
console.log('All extra logos generated successfully!')
