import fs from 'fs'

const content = fs.readFileSync('src/lib/i18n.js', 'utf8')
const lines = content.split(/\r?\n/)

let idEnd = -1
let enStart = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('en: {')) {
    idEnd = i - 1
    enStart = i + 1
    break
  }
}

let enEnd = -1
for (let i = enStart; i < lines.length; i++) {
  if (lines[i].trim() === '},' && lines[i + 1]?.trim() === '}') {
    enEnd = i
    break
  }
}

const idLines = lines.slice(2, idEnd)
const enLines = lines.slice(enStart, enEnd)

fs.mkdirSync('src/locales', { recursive: true })
fs.writeFileSync('src/locales/id.js', 'export default {\n' + idLines.join('\n') + '\n}\n')
fs.writeFileSync('src/locales/en.js', 'export default {\n' + enLines.join('\n') + '\n}\n')

const newI18n = `import id from '../locales/id'
import en from '../locales/en'

const dictionaries = {
  id,
  en,
}

/**
 * @param {'id' | 'en'} locale
 * @param {string} key
 * @param {Record<string, string | number> | string} [fallbackOrVars]
 * @param {Record<string, string | number>} [maybeVars]
 */
export function translate(locale, key, fallbackOrVars = {}, maybeVars = null) {
  const lang = locale === 'en' ? 'en' : 'id'
  const hasFallback = typeof fallbackOrVars === 'string'
  const fallback = hasFallback ? fallbackOrVars : key
  const varMap =
    typeof fallbackOrVars === 'object' && fallbackOrVars !== null
      ? fallbackOrVars
      : typeof maybeVars === 'object' && maybeVars !== null
      ? maybeVars
      : {}

  let str = dictionaries[lang]?.[key] ?? dictionaries.id?.[key] ?? fallback
  if (typeof str === 'string') {
    Object.entries(varMap).forEach(([k, v]) => {
      str = str.replaceAll(\`{{\${k}}}\`, String(v))
    })
  }
  return str
}
`

fs.writeFileSync('src/lib/i18n.js', newI18n)
console.log('Successfully split i18n into id.js and en.js!')
