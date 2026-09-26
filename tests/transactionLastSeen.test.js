// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getLastSeenTxTimestamp,
  updateLastSeenTxTimestamp,
  isTransactionNew,
} from '../src/lib/transactionLastSeen'

describe('transactionLastSeen utility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('initializes to current timestamp if not previously stored', () => {
    const fakeNow = 1700000000000
    vi.setSystemTime(fakeNow)

    const initial = getLastSeenTxTimestamp()
    expect(initial).toBe(fakeNow)
    expect(localStorage.getItem('ft_tx_last_seen_timestamp')).toBe(String(fakeNow))
  })

  it('retrieves previously stored timestamp correctly', () => {
    const stored = 1695000000000
    localStorage.setItem('ft_tx_last_seen_timestamp', String(stored))

    const retrieved = getLastSeenTxTimestamp()
    expect(retrieved).toBe(stored)
  })

  it('updates timestamp to specified value or defaults to Date.now()', () => {
    const fakeNow = 1710000000000
    vi.setSystemTime(fakeNow)

    updateLastSeenTxTimestamp()
    expect(getLastSeenTxTimestamp()).toBe(fakeNow)

    const customTs = 1720000000000
    updateLastSeenTxTimestamp(customTs)
    expect(getLastSeenTxTimestamp()).toBe(customTs)
  })

  it('correctly evaluates isTransactionNew', () => {
    const baseline = 1700000000000

    // Transaction created after lastSeen
    expect(
      isTransactionNew({ id: 1, createdAt: baseline + 5000 }, baseline)
    ).toBe(true)

    // Transaction created before or at lastSeen
    expect(
      isTransactionNew({ id: 2, createdAt: baseline - 5000 }, baseline)
    ).toBe(false)
    expect(
      isTransactionNew({ id: 3, createdAt: baseline }, baseline)
    ).toBe(false)

    // Transaction missing or invalid createdAt
    expect(isTransactionNew({ id: 4 }, baseline)).toBe(false)
    expect(isTransactionNew({ id: 5, createdAt: 'invalid' }, baseline)).toBe(false)
    expect(isTransactionNew(null, baseline)).toBe(false)
    expect(isTransactionNew({ id: 6, createdAt: baseline + 1000 }, null)).toBe(false)
  })
})
