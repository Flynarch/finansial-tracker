import { describe, it, expect } from 'vitest'
import { evaluateExpression } from '../src/lib/calcParser'

describe('calcParser - evaluateExpression', () => {
  it('returns invalid for empty strings', () => {
    expect(evaluateExpression('')).toEqual({ isValid: false, result: null, hasExpression: false })
    expect(evaluateExpression('   ')).toEqual({ isValid: false, result: null, hasExpression: false })
    expect(evaluateExpression(null)).toEqual({ isValid: false, result: null, hasExpression: false })
  })

  it('evaluates basic numeric values', () => {
    const res = evaluateExpression('50000')
    expect(res.isValid).toBe(true)
    expect(res.result).toBe(50000)
    expect(res.hasExpression).toBe(false)
  })

  it('evaluates thousand formatted numbers (50.000 + 25.000)', () => {
    expect(evaluateExpression('50.000 + 25.000', 'IDR').result).toBe(75000)
    expect(evaluateExpression('1.000.000 + 500.000', 'IDR').result).toBe(1500000)
    expect(evaluateExpression('50.000 * 2', 'IDR').result).toBe(100000)
  })

  it('evaluates simple math expressions (+, -, *, /)', () => {
    expect(evaluateExpression('25000 + 15000').result).toBe(40000)
    expect(evaluateExpression('100000 - 35000').result).toBe(65000)
    expect(evaluateExpression('15000 * 3').result).toBe(45000)
    expect(evaluateExpression('100000 / 4').result).toBe(25000)
  })

  it('evaluates shorthand suffix "k" and "rb"', () => {
    expect(evaluateExpression('50k').result).toBe(50000)
    expect(evaluateExpression('25rb').result).toBe(25000)
    expect(evaluateExpression('25k + 15k').result).toBe(40000)
    expect(evaluateExpression('50rb - 10rb').result).toBe(40000)
  })

  it('evaluates shorthand suffix "jt" and "m" with decimal comma', () => {
    expect(evaluateExpression('2.5jt').result).toBe(2500000)
    expect(evaluateExpression('2,5jt').result).toBe(2500000)
    expect(evaluateExpression('1.2m').result).toBe(1200000)
    expect(evaluateExpression('3jt + 500k').result).toBe(3500000)
  })

  it('evaluates parentheses and operator precedence', () => {
    expect(evaluateExpression('(10k + 5k) * 2').result).toBe(30000)
    expect(evaluateExpression('10k + 5k * 2').result).toBe(20000)
  })

  it('handles invalid math gracefully without throwing', () => {
    expect(evaluateExpression('50k +').isValid).toBe(false)
    expect(evaluateExpression('abc').isValid).toBe(false)
  })
})
