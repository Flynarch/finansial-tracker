import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/wallet-logos')

const SEARCH_QUERIES = {
  bca: 'BCA mobile',
  mandiri: 'Livin by Mandiri',
  bri: 'BRImo',
  bni: 'wondr by BNI',
  jago: 'Bank Jago',
  seabank: 'SeaBank Indonesia',
  bsi: 'BSI Mobile',
  blu: 'blu by BCA Digital',
  jenius: 'Jenius BTPN',
  cimb: 'OCTO Mobile by CIMB Niaga',
  neobank: 'Neobank BNC',
  allobank: 'Allo Bank',
  superbank: 'Superbank',
  banksaqu: 'Bank Saqu',
  btn: 'BTN Mobile',
  danamon: 'D-Bank PRO Danamon',
  permata: 'Permata ME',
  mega: 'M-Smile Bank Mega',
  ocbc: 'OCBC mobile Indonesia',
  maybank: 'M2U ID Maybank',
  dbs: 'digibank by DBS Indonesia',
  uob: 'TMRW by UOB Indonesia',
  gopay: 'GoPay',
  ovo: 'OVO',
  dana: 'DANA Dompet Digital Indonesia',
  shopeepay: 'ShopeePay',
  linkaja: 'LinkAja',
  spaylater: 'SPayLater Shopee',
  gopaylater: 'GoPay Later',
  kredivo: 'Kredivo',
  akulaku: 'Akulaku',
  isaku: 'i.saku',
  sakuku: 'Sakuku BCA',
  paypal: 'PayPal',
  wise: 'Wise',
  bibit: 'Bibit Reksadana & Saham',
  ajaib: 'Ajaib Investasi Saham & Reksadana',
  bareksa: 'Bareksa',
  stockbit: 'Stockbit Saham',
  pintu: 'Pintu Crypto',
  indodax: 'Indodax',
  tokocrypto: 'Tokocrypto',
  binance: 'Binance',
  pluang: 'Pluang',
  pegadaian: 'Pegadaian Digital',
  ipot: 'IPOT Indo Premier',
  mirae: 'Mirae Asset M-Stock',
}

async function searchAndDownload(id, query) {
  try {
    const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=id&gl=id`
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
    if (!res.ok) {
      console.warn(`[WARN] Search failed for ${id}: HTTP ${res.status}`)
      return false
    }
    const html = await res.text()
    const matches = html.match(/https:\/\/play-lh\.googleusercontent\.com\/[a-zA-Z0-9_\-]+/g)
    if (!matches || matches.length === 0) {
      console.warn(`[WARN] No icon found for ${id} in search results`)
      return false
    }
    // Pick the primary icon from search results (first non-tiny match)
    const iconBase = matches[0]
    const iconUrl = `${iconBase}=s256-rw`
    const imgRes = await fetch(iconUrl)
    if (!imgRes.ok) {
      console.warn(`[WARN] Failed to fetch image for ${id}: ${imgRes.status}`)
      return false
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const filePath = path.join(outDir, `${id}.webp`)
    fs.writeFileSync(filePath, buffer)
    console.log(`[OK] Saved ${id}.webp (${buffer.length} bytes) for ${query}`)
    return true
  } catch (err) {
    console.error(`[ERR] ${id}:`, err.message)
    return false
  }
}

async function main() {
  console.log('Searching and downloading 100% official Google Play App Icons...')
  let success = 0
  let failed = 0
  for (const [id, query] of Object.entries(SEARCH_QUERIES)) {
    const ok = await searchAndDownload(id, query)
    if (ok) success++
    else failed++
  }
  console.log(`Finished: ${success} downloaded, ${failed} failed`)
}

main()
