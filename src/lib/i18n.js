import id from '../locales/id'
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
      str = str.replaceAll(`{{${k}}}`, String(v))
    })
  }
  return str
}
