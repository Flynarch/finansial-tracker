import { describe, it, expect } from 'vitest'
import { getLocalDateString } from '../src/lib/dateUtils'
import { format } from 'date-fns'

describe('getLocalDateString', () => {
  it('returns today date in yyyy-MM-dd format', () => {
    const result = getLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches date-fns local format', () => {
    const result = getLocalDateString()
    const expected = format(new Date(), 'yyyy-MM-dd')
    expect(result).toBe(expected)
  })
})
