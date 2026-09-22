/**
 * Fast-path heuristic Indonesian NLP parser wrapper for FinTrack AI.
 */
import { parseIndonesianFinancialText } from './indonesianFinanceNlp'

/**
 * Zero-latency Fast-Path NLP heuristic parser for short Indonesian / casual transactions.
 * Handles instant patterns like "bakso 20k", "kopi 25rb bca", "gaji 5jt", "bensin 30k" as well
 * as multi-day transactions ("sabtu dan jumwt masing-masing 10k buat maxim") in 0ms!
 *
 * @param {string} userText - User prompt
 * @param {Array} [wallets=[]] - Available wallets list
 * @param {string} [defaultCurrency='IDR'] - Default active currency
 * @param {Date} [referenceDate=new Date()] - Reference date anchor
 * @returns {object|null} Parsed transaction object or null
 */
export function parseShortTransactionFast(userText, wallets = [], defaultCurrency = 'IDR', referenceDate = new Date()) {
  const result = parseIndonesianFinancialText(userText, wallets, defaultCurrency, referenceDate)
  if (result && (result.type === 'transactions' || result.transactions)) {
    return {
      ...result,
      engine: 'offline_nlp',
      engineLabel: 'NLP Lokal (Offline)',
      transactions: (result.transactions || []).map((t) => ({
        ...t,
        engine: 'offline_nlp',
        engineLabel: 'NLP Lokal (Offline)',
      })),
    }
  }
  return result
}
