import { evaluateExpression } from './calcParser'
import { formatCurrency } from './utils'

const COMP_REGEX = /(?:^|\s)(>=|<=|>|<|==|=)\s*(?:rp\.?\s*|\$\s*)?(\d[\d.,]*(?:\s*(?:jt|juta|million|m|k|rb|ribu|b|miliar|milyar|billion))?)(?:\s|$)/i

const RANGE_REGEX = /(?:^|\s)(?:rp\.?\s*|\$\s*)?(\d[\d.,]*(?:\s*(?:jt|juta|million|m|k|rb|ribu|b|miliar|milyar|billion))?)\s*(?:-|–|—|\.\.)\s*(?:rp\.?\s*|\$\s*)?(\d[\d.,]*(?:\s*(?:jt|juta|million|m|k|rb|ribu|b|miliar|milyar|billion))?)(?:\s|$)/i

const STANDALONE_AMOUNT_REGEX = /^(?:rp\.?\s*|\$\s*)?(\d[\d.,]*(?:\s*(?:jt|juta|million|m|k|rb|ribu|b|miliar|milyar|billion))?)$/i

/**
 * Parses a transaction search string into a text query and an amount filter condition.
 * Supports:
 * - Pure text: "kopi kenangan"
 * - Shorthand / exact amount: "50k", "50rb", "50.000", "2,5jt"
 * - Comparison operators: "> 100k", "<= 50rb", "= 25000"
 * - Range queries: "50k - 200k", "25000..50000"
 * - Mixed queries: "kopi > 20k", "< 50rb bca", "makan 20k - 50k"
 *
 * @param {string} rawInput
 * @param {string} [currency='IDR']
 * @returns {{ textQuery: string, amountCondition: object|null, rawQuery: string }}
 */
export function parseTransactionSearchQuery(rawInput, currency = 'IDR') {
  if (!rawInput || typeof rawInput !== 'string') {
    return { textQuery: '', amountCondition: null, rawQuery: '' }
  }

  const rawQuery = rawInput.trim()
  if (!rawQuery) {
    return { textQuery: '', amountCondition: null, rawQuery: '' }
  }

  // 1. Check for range pattern (e.g., "50k - 200k" or "makan 20k-50k")
  const rangeMatch = rawQuery.match(RANGE_REGEX)
  if (rangeMatch) {
    const rawMin = rangeMatch[1]
    const rawMax = rangeMatch[2]
    const evalMin = evaluateExpression(rawMin, currency)
    const evalMax = evaluateExpression(rawMax, currency)

    if (evalMin.isValid && evalMax.isValid && evalMin.result !== null && evalMax.result !== null) {
      const minVal = Math.min(evalMin.result, evalMax.result)
      const maxVal = Math.max(evalMin.result, evalMax.result)

      const textQuery = rawQuery
        .replace(rangeMatch[0], ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        textQuery,
        amountCondition: {
          type: 'range',
          min: minVal,
          max: maxVal,
        },
        rawQuery,
      }
    }
  }

  // 2. Check for comparison operators (e.g. "> 100k", "<= 50000", "kopi > 20k")
  const compMatch = rawQuery.match(COMP_REGEX)
  if (compMatch) {
    const rawOp = compMatch[1]
    const op = rawOp === '==' ? '=' : rawOp
    const rawAmt = compMatch[2]
    const evalAmt = evaluateExpression(rawAmt, currency)

    if (evalAmt.isValid && evalAmt.result !== null) {
      const textQuery = rawQuery
        .replace(compMatch[0], ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        textQuery,
        amountCondition: {
          type: 'comp',
          op,
          value: evalAmt.result,
        },
        rawQuery,
      }
    }
  }

  // 3. Check for standalone single amount shorthand or number (e.g. "50k", "50.000", "2,5jt")
  const standaloneMatch = rawQuery.match(STANDALONE_AMOUNT_REGEX)
  if (standaloneMatch) {
    const evalAmt = evaluateExpression(standaloneMatch[1], currency)
    if (evalAmt.isValid && evalAmt.result !== null) {
      return {
        textQuery: '',
        amountCondition: {
          type: 'exact',
          value: evalAmt.result,
        },
        rawQuery,
      }
    }
  }

  // 4. Default: pure text query
  return {
    textQuery: rawQuery,
    amountCondition: null,
    rawQuery,
  }
}

/**
 * Checks whether a transaction satisfies an amount condition.
 * Adheres to Split Transaction Invariants: parent-level and child-level amounts are evaluated.
 *
 * @param {object} tx - Transaction object
 * @param {object|null} amountCondition - Condition returned by parseTransactionSearchQuery
 * @returns {boolean}
 */
export function matchesTransactionAmount(tx, amountCondition) {
  if (!amountCondition || typeof amountCondition !== 'object') {
    return true
  }

  const evaluateNum = (val) => {
    const absAmt = Math.abs(Number(val) || 0)
    if (amountCondition.type === 'exact') {
      return Math.abs(absAmt - amountCondition.value) < 0.01
    }
    if (amountCondition.type === 'comp') {
      switch (amountCondition.op) {
        case '>':
          return absAmt > amountCondition.value
        case '>=':
          return absAmt >= amountCondition.value
        case '<':
          return absAmt < amountCondition.value
        case '<=':
          return absAmt <= amountCondition.value
        case '=':
          return Math.abs(absAmt - amountCondition.value) < 0.01
        default:
          return true
      }
    }
    if (amountCondition.type === 'range') {
      return absAmt >= amountCondition.min && absAmt <= amountCondition.max
    }
    return true
  }

  if (evaluateNum(tx?.amount)) {
    return true
  }

  // If transaction has split items, evaluate each split item amount
  if (tx?.isSplit && Array.isArray(tx?.splitItems) && tx.splitItems.length > 0) {
    return tx.splitItems.some((si) => evaluateNum(si?.amount))
  }

  return false
}

/**
 * Formats an amount condition for display in an active filter badge or UI pill.
 *
 * @param {object} condition
 * @param {string} [locale='id-ID']
 * @param {string} [currency='IDR']
 * @returns {string}
 */
export function formatAmountConditionBadge(condition, locale = 'id-ID', currency = 'IDR') {
  if (!condition) return ''

  if (condition.type === 'comp') {
    return `${condition.op} ${formatCurrency(condition.value, currency, locale)}`
  }
  if (condition.type === 'range') {
    return `${formatCurrency(condition.min, currency, locale)} - ${formatCurrency(condition.max, currency, locale)}`
  }
  if (condition.type === 'exact') {
    return `= ${formatCurrency(condition.value, currency, locale)}`
  }

  return ''
}
