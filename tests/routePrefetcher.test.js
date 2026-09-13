import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prefetchCriticalRoutes } from '../src/lib/routePrefetcher'

describe('routePrefetcher Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('initiates prefetching without error during idle periods', () => {
    expect(() => prefetchCriticalRoutes()).not.toThrow()
    vi.advanceTimersByTime(2000)
  })
})
