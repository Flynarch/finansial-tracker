import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logosDir = path.resolve(__dirname, '../public/wallet-logos')

const BRAND_THEMES = {
  bca: { bg: '#00529C', fg: '#FFFFFF' },
  bri: { bg: '#00529C', fg: '#FFFFFF' },
  mandiri: { bg: '#002D62', fg: '#FFFFFF' },
  bni: { bg: '#005E5D', fg: '#FFFFFF' },
  jago: { bg: '#F37021', fg: '#FFFFFF' },
  seabank: { bg: '#FF5722', fg: '#FFFFFF' },
  bsi: { bg: '#00A39D', fg: '#FFFFFF' },
  blu: { bg: '#001833', fg: '#33CDCF' },
  jenius: { bg: '#0097A7', fg: '#FFFFFF' },
  cimb: { bg: '#7B0017', fg: '#FFFFFF' },
  neobank: { bg: '#FFDD00', fg: '#18181B' },
  allobank: { bg: '#5B21B6', fg: '#FFFFFF' },
  superbank: { bg: '#0B132B', fg: '#FFFFFF' },
  banksaqu: { bg: '#4A0E4E', fg: '#FFFFFF' },
  btn: { bg: '#003882', fg: '#FFFFFF' },
  danamon: { bg: '#002855', fg: '#FFFFFF' },
  permata: { bg: '#002F87', fg: '#FFFFFF' },
  mega: { bg: '#FF9E00', fg: '#18181B' },
  ocbc: { bg: '#ED1C24', fg: '#FFFFFF' },
  maybank: { bg: '#FFCC00', fg: '#18181B' },
  dbs: { bg: '#EF3340', fg: '#FFFFFF' },
  uob: { bg: '#002855', fg: '#FFFFFF' },
  gopay: { bg: '#00AED6', fg: '#FFFFFF' },
  ovo: { bg: '#4C2A86', fg: '#FFFFFF' },
  dana: { bg: '#118EEA', fg: '#FFFFFF' },
  shopeepay: { bg: '#EE4D2D', fg: '#FFFFFF' },
  linkaja: { bg: '#ED1C24', fg: '#FFFFFF' },
  spaylater: { bg: '#EE4D2D', fg: '#FFFFFF' },
  gopaylater: { bg: '#00AED6', fg: '#FFFFFF' },
  kredivo: { bg: '#F77D00', fg: '#FFFFFF' },
  akulaku: { bg: '#E61C24', fg: '#FFFFFF' },
  isaku: { bg: '#005BAC', fg: '#FFFFFF' },
  sakuku: { bg: '#00529C', fg: '#FFCC00' },
  paypal: { bg: '#003087', fg: '#FFFFFF' },
  wise: { bg: '#9FE870', fg: '#163300' },
  bibit: { bg: '#00B14F', fg: '#FFFFFF' },
  ajaib: { bg: '#205BF8', fg: '#FFFFFF' },
  bareksa: { bg: '#16A34A', fg: '#FFFFFF' },
  stockbit: { bg: '#0F172A', fg: '#84CC16' },
  pintu: { bg: '#111827', fg: '#FFFFFF' },
  indodax: { bg: '#0284C7', fg: '#FFFFFF' },
  tokocrypto: { bg: '#121212', fg: '#FFFFFF' },
  binance: { bg: '#1E2026', fg: '#F3BA2F' },
  pluang: { bg: '#D97706', fg: '#FFFFFF' },
  pegadaian: { bg: '#00783E', fg: '#FFFFFF' },
  ipot: { bg: '#004380', fg: '#FFFFFF' },
  mirae: { bg: '#EA580C', fg: '#FFFFFF' },
  cash: { bg: '#0F172A', fg: '#FBBF24' },
}

console.log('Validating brand themes for', Object.keys(BRAND_THEMES).length, 'institutions')
