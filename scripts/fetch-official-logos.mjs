import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/wallet-logos')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const LOGO_SOURCES = {
  // Indonesian Banks
  bca: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bca.svg',
  bri: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bri.svg',
  mandiri: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/mandiri.svg',
  bni: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bni.svg',
  jago: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bank-jago.svg',
  seabank: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/seabank.svg',
  bsi: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bsi.svg',
  blu: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/blu-bca.svg',
  jenius: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/jenius.svg',
  cimb: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/cimb-niaga.svg',
  neobank: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bank-neo-commerce.svg',
  allobank: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/allo-bank-indonesia.svg',
  superbank: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/superbank.svg',
  banksaqu: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bank-saqu.svg',
  btn: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/btn.svg',
  danamon: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/danamon.svg',
  permata: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/permata.svg',
  mega: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/bank-mega.svg',
  ocbc: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/ocbc-nisp.svg',
  maybank: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/maybank.svg',
  dbs: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/dbs.svg',
  uob: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/uob.svg',

  // E-Wallets & PayLater
  gopay: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/gopay.svg',
  ovo: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/ovo.svg',
  dana: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/dana.svg',
  shopeepay: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/shopeepay.svg',
  linkaja: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/linkaja.svg',
  kredivo: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/kredivo.svg',
  akulaku: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/akulaku.svg',
  isaku: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/isaku.svg',
  paypal: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/paypal.svg',
  wise: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/wise.svg',
  pegadaian: 'https://cdn.jsdelivr.net/npm/idn-finlogos@2.5.0/dist/icons/pegadaian.svg',
}

async function main() {
  console.log('Downloading official 1:1 logos...')
  for (const [id, url] of Object.entries(LOGO_SOURCES)) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`Failed ${id}: ${res.status}`)
        continue
      }
      const svgText = await res.text()
      const targetFile = path.join(outDir, `${id}.svg`)
      fs.writeFileSync(targetFile, svgText, 'utf8')
      console.log(`Saved ${id}.svg (${svgText.length} bytes)`)
    } catch (err) {
      console.error(`Error downloading ${id}:`, err.message)
    }
  }
  console.log('Done!')
}

main()
