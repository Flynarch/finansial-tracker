import { roundCurrency } from './utils'

/**
 * Evaluates math expressions and financial shorthand suffixes safely without using raw eval().
 * Supports:
 * - Basic operators: +, -, *, /, ( )
 * - Thousand dots (e.g. 50.000 + 25.000 -> 50000 + 25000 = 75000)
 * - Decimal commas & dots (e.g. 2,5jt -> 2.5 * 1000000)
 * - Suffixes: k / rb (thousand: *1,000), jt / m (million: *1,000,000), b (billion: *1,000,000,000)
 *
 * @param {string} input - Raw user input string
 * @param {string} [currency='IDR'] - Currency code
 * @param {object} [options={}] - Options object
 * @param {boolean} [options.allowNegative=false] - Whether negative results are permitted
 * @returns {{ isValid: boolean, result: number|null, hasExpression: boolean }}
 */
export function evaluateExpression(input, currency = 'IDR', options = {}) {
  const { allowNegative = false } = options
  if (!input || typeof input !== 'string') {
    return { isValid: false, result: null, hasExpression: false }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return { isValid: false, result: null, hasExpression: false }
  }

  // Detect whether the input contains any mathematical operator or shorthand suffix
  const hasExpression = /[+\-*/×÷−–—kKmMbBjJrR(]/.test(trimmed)

  let sanitized = trimmed
    // Normalize Unicode math symbols
    .replace(/\u00D7|×/g, '*')
    .replace(/\u00F7|÷/g, '/')
    .replace(/[\u2212\u2013\u2014−–—]/g, '-')
    // Remove spaces
    .replace(/\s+/g, '')

  // If currency is IDR, strip thousand dots before evaluating
  if (currency === 'IDR') {
    // Replace dots that are thousand separators (followed by 3 digits)
    while (/(\d+)\.(\d{3})(?=\D|$|\.)/.test(sanitized)) {
      sanitized = sanitized.replace(/(\d+)\.(\d{3})(?=\D|$|\.)/g, '$1$2')
    }
    // Replace decimal comma with dot
    sanitized = sanitized.replace(/,(\d+)/g, '.$1')
  } else {
    // Non-IDR currencies (e.g. USD, EUR, etc.)
    if (/\d+\.\d{3}.*,\d+/.test(sanitized)) {
      while (/(\d+)\.(\d{3})(?=\D|$|\.)/.test(sanitized)) {
        sanitized = sanitized.replace(/(\d+)\.(\d{3})(?=\D|$|\.)/g, '$1$2')
      }
      sanitized = sanitized.replace(/,(\d+)/g, '.$1')
    } else {
      while (/(\d+),(\d{3})(?=\D|$|,)/.test(sanitized)) {
        sanitized = sanitized.replace(/(\d+),(\d{3})(?=\D|$|,)/g, '$1$2')
      }
      sanitized = sanitized.replace(/,(\d+)/g, '.$1')
    }
  }

  // Pure Tokenizer & Recursive-Descent Math Evaluator (100% CSP compliant, zero eval / zero new Function)
  const tokens = []
  let pos = 0
  const len = sanitized.length

  while (pos < len) {
    const ch = sanitized[pos]

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push({ type: ch })
      pos++
      continue
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = ''
      while (pos < len && /[0-9.]/.test(sanitized[pos])) {
        numStr += sanitized[pos]
        pos++
      }
      let mult = 1
      const rest = sanitized.slice(pos)
      const suffixMatch = rest.match(/^(jt|juta|million|m|k|rb|ribu|b|miliar|milyar|billion)(?!\w)/i)
      if (suffixMatch) {
        const s = suffixMatch[1].toLowerCase()
        if (s === 'k' || s === 'rb' || s === 'ribu') mult = 1000
        else if (s === 'jt' || s === 'juta' || s === 'm' || s === 'million') mult = 1000000
        else if (s === 'b' || s === 'miliar' || s === 'milyar' || s === 'billion') mult = 1000000000
        pos += suffixMatch[0].length
      }

      const numVal = parseFloat(numStr) * mult
      if (Number.isNaN(numVal)) {
        return { isValid: false, result: null, hasExpression }
      }
      tokens.push({ type: 'NUM', val: numVal })
      continue
    }

    // Unrecognized character or incomplete syntax
    return { isValid: false, result: null, hasExpression }
  }

  if (tokens.length === 0) {
    return { isValid: false, result: null, hasExpression }
  }

  let cursor = 0

  function peek() {
    return tokens[cursor]
  }

  function consume(expectedType) {
    const t = tokens[cursor]
    if (expectedType && (!t || t.type !== expectedType)) return null
    cursor++
    return t
  }

  function parseExpression() {
    let left = parseTerm()
    if (left === null) return null

    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = consume().type
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm() {
    let left = parseFactor()
    if (left === null) return null

    while (peek() && (peek().type === '*' || peek().type === '/')) {
      const op = consume().type
      const right = parseFactor()
      if (right === null) return null
      if (op === '/') {
        if (right === 0) return null // Division by zero
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  function parseFactor() {
    const t = peek()
    if (!t) return null

    if (t.type === '+') {
      consume('+')
      return parseFactor()
    }
    if (t.type === '-') {
      consume('-')
      const res = parseFactor()
      return res === null ? null : -res
    }

    if (t.type === 'NUM') {
      consume('NUM')
      return t.val
    }

    if (t.type === '(') {
      consume('(')
      const inner = parseExpression()
      if (inner === null) return null
      if (!consume(')')) return null
      return inner
    }

    return null
  }

  try {
    const rawResult = parseExpression()

    if (cursor === tokens.length && typeof rawResult === 'number' && Number.isFinite(rawResult) && !Number.isNaN(rawResult)) {
      const rounded = roundCurrency(rawResult)
      return {
        isValid: true,
        result: allowNegative ? rounded : Math.max(0, rounded),
        hasExpression,
      }
    }
  } catch {
    // Incomplete expression while user is typing (e.g. "50000 + ")
  }

  return { isValid: false, result: null, hasExpression }
}

/**
 * Resolves a potentially unfinished or finished math expression into a formatted money string.
 * Strips any trailing math operators (e.g. "50.000 + " -> "50.000").
 *
 * @param {string} input - User input string
 * @param {string} [currency='IDR'] - Currency code
 * @param {object} [options={}] - Options object
 * @returns {string} Fully evaluated money amount string or original input
 */
export function resolveCalculatedAmount(input, currency = 'IDR', options = {}) {
  if (!input || typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''

  // If input contains mathematical operators or shorthand suffixes
  if (/[+\-*/×÷−–—kKmMbBjJrR(]/.test(trimmed)) {
    // Clean up trailing operators like "50.000 + " -> "50.000"
    const cleaned = trimmed.replace(/\s*[+\-*/×÷−–—]+\s*$/, '').trim()
    if (!cleaned) return ''
    const evalResult = evaluateExpression(cleaned, currency, options)
    if (evalResult.isValid && evalResult.result !== null) {
      return String(evalResult.result)
    }
  }

  return trimmed
}

