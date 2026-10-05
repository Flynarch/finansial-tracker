/**
 * Indonesian Finance NLP Parser Facade
 *
 * Decomposed into modular sub-modules under ./nlp/:
 * - lexicon.js: Dictionaries, merchant services, keyword constants, regex definitions
 * - tokenizer.js: Text normalization, token extraction, clean notes logic, wallet matcher
 * - rules.js: Transaction classification rules, amount parsing, date extraction, multi-clause splitting
 * - index.js: Aggregating and re-exporting internal symbols
 *
 * This facade re-exports 100% of all public symbols for backwards compatibility.
 */

export {
  // Lexicon definitions
  DAY_DEFINITIONS,
  KNOWN_MERCHANT_SERVICES,
  MONTH_DEFINITIONS,
  MONTH_NAME_REGEX,

  // Tokenizer and extraction utilities
  normalizeIndonesianNlpText,
  escapeRegExp,
  maskDateExpressions,
  extractMerchantAndCategory,
  findWalletInText,

  // Parsing rules and calculations
  getRecentPastDayDate,
  extractDateFromPhrase,
  parseIndonesianAmount,
  extractCurrencyFromText,
  extractMonetaryAmountFromText,
  parseTransferTransaction,
  parseMultiClauseTransactions,
  parseIndonesianFinancialText,
} from './nlp'
