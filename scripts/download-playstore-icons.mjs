import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/wallet-logos')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const PLAY_STORE_PACKAGES = {
  // ── 1. Bank Utama & Digital Indonesia ──────────────────────────────────
  bca: 'com.bca',
  mandiri: 'id.bmri.livin',
  bri: 'id.co.bri.brimo',
  bni: 'id.bni.wondr',
  jago: 'com.jago.digitalBanking',
  seabank: 'com.seabank.id',
  bsi: 'com.bsi.mobile',
  blu: 'id.co.bcadigital.blu',
  jenius: 'com.btpn.dc',
  cimb: 'com.cimbniaga.octomobile',
  neobank: 'com.bnc.finance',
  allobank: 'com.allobank.allobank',
  superbank: 'id.co.superbank.app',
  banksaqu: 'id.co.banksaqu.mobile',
  btn: 'com.btn.mobile',
  danamon: 'id.co.danamon.dbankpro',
  permata: 'net.myinfosys.PermataMobileX',
  mega: 'com.bankmega.msmile',
  ocbc: 'com.ocbc.nisp.mobile',
  maybank: 'com.maybank.m2u.id',
  dbs: 'com.dbs.id.dbsib',
  uob: 'com.uob.tmrw.id',

  // ── 2. E-Wallet, Fintech & PayLater ────────────────────────────────────
  gopay: 'com.gojek.gopay',
  ovo: 'ovo.id',
  dana: 'id.dana',
  shopeepay: 'com.shopee.id',
  linkaja: 'com.telkom.mwallet',
  kredivo: 'com.finaccel.android',
  akulaku: 'io.silvrr.installment',
  isaku: 'com.isaku.app',
  sakuku: 'com.bca.sakuku',
  paypal: 'com.paypal.android.p2pmobile',
  wise: 'com.transferwise.android',

  // ── 3. Investasi, Reksadana & Crypto ──────────────────────────────────
  bibit: 'com.bibit.bibitid',
  ajaib: 'ajaib.co.id',
  bareksa: 'com.bareksa.app',
  stockbit: 'com.stockbit.android',
  pintu: 'com.pintu.pintu',
  indodax: 'com.bitcoin.indodax',
  tokocrypto: 'com.tokocrypto.tkc',
  binance: 'com.binance.dev',
  pluang: 'com.pluang.pluang',
  pegadaian: 'com.pegadaian.digital',
  ipot: 'com.indopremier.ipot',
  mirae: 'com.miraeasset.mstock',
}

async function downloadPlayStoreIcon(id, pkg) {
  try {
    const res = await fetch(`https://play.google.com/store/apps/details?id=${pkg}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    })
    if (!res.ok) {
      console.warn(`[WARN] HTTP ${res.status} for ${id} (${pkg})`)
      return false
    }
    const html = await res.text()
    const match = html.match(/https:\/\/play-lh\.googleusercontent\.com\/[a-zA-Z0-9_\-=]+/)
    if (!match) {
      console.warn(`[WARN] No icon match for ${id} (${pkg})`)
      return false
    }
    const iconUrl = match[0] + '=s256-rw'
    const imgRes = await fetch(iconUrl)
    if (!imgRes.ok) {
      console.warn(`[WARN] Failed image fetch for ${id}: ${imgRes.status}`)
      return false
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const filePath = path.join(outDir, `${id}.webp`)
    fs.writeFileSync(filePath, buffer)
    console.log(`[OK] Saved ${id}.webp (${buffer.length} bytes) from Google Play`)
    return true
  } catch (err) {
    console.error(`[ERR] ${id} (${pkg}):`, err.message)
    return false
  }
}

async function main() {
  console.log('Downloading 100% official Google Play App Icons for Indonesian financial apps...')
  let success = 0
  let failed = 0
  for (const [id, pkg] of Object.entries(PLAY_STORE_PACKAGES)) {
    const ok = await downloadPlayStoreIcon(id, pkg)
    if (ok) success++
    else failed++
  }
  console.log(`Finished: ${success} downloaded, ${failed} failed`)
}

main()
