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
  const hasExpression = /[+\-*/kKmMbBjJrR(]/.test(trimmed)

  let sanitized = trimmed
    // Remove spaces
    .replace(/\s+/g, '')

  // If currency is IDR, strip thousand dots before evaluating
  if (currency === 'IDR') {
    // Replace dots that are thousand separators (followed by 3 digits)
    sanitized = sanitized.replace(/(\d+)\.(\d{3})(?=\D|$|\.)/g, '$1$2')
    // If multiple thousand dots exist (e.g. 1.000.000 -> 1000000)
    while (/(\d+)\.(\d{3})(?=\D|$|\.)/.test(sanitized)) {
      sanitized = sanitized.replace(/(\d+)\.(\d{3})(?=\D|$|\.)/g, '$1$2')
    }
    // Replace decimal comma with dot
    sanitized = sanitized.replace(/,(\d+)/g, '.$1')
  }

  // Expand shorthand suffixes to numbers
  sanitized = sanitized
    .replace(/([0-9.]+)\s*(jt|juta|m(?:illion)?)(?!\w)/gi, '($1*1000000)')
    .replace(/([0-9.]+)\s*(k|rb|ribu)(?!\w)/gi, '($1*1000)')
    .replace(/([0-9.]+)\s*(b|milyar|billion)(?!\w)/gi, '($1*1000000000)')

  // Only allow valid numeric & math characters
  if (!/^[0-9.+\-*/() ]+$/.test(sanitized)) {
    return { isValid: false, result: null, hasExpression: false }
  }

  try {
    // Safe mathematical expression evaluator using strict mode Function constructor
    const fn = new Function(`'use strict'; return (${sanitized});`)
    const rawResult = fn()

    if (typeof rawResult === 'number' && Number.isFinite(rawResult) && !Number.isNaN(rawResult)) {
      const rounded = Math.round(rawResult * 100) / 100
      return {
        isValid: true,
        result: allowNegative ? rounded : Math.max(0, rounded),
        hasExpression,
      }
    }
  } catch {
    // Math syntax error while user is typing (e.g. "50000 + ")
  }

  return { isValid: false, result: null, hasExpression }
}
