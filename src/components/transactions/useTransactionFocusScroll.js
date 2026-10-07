import { useEffect, useMemo, useState } from 'react'
import { getLastSeenTxTimestamp, updateLastSeenTxTimestamp } from '../../lib/transactionLastSeen'

/**
 * Handles navigation-focused transaction auto-scrolling, transient row highlighting,
 * and session-level last seen timestamp commits for new badge indicators.
 */
export function useTransactionFocusScroll({
  location,
  navigate,
  setFilters,
  listScrollRef,
  filteredTransactionsCount = 0,
}) {
  const [pendingFocusTransactionId, setPendingFocusTransactionId] = useState(null)
  const [highlightedTransactionId, setHighlightedTransactionId] = useState(null)

  // Handle focus transaction from navigation state
  useEffect(() => {
    const focusTransactionId = location.state?.focusTransactionId
    if (!focusTransactionId) return

    window.setTimeout(() => {
      setPendingFocusTransactionId(String(focusTransactionId))
      setFilters({
        search: '',
        types: ['income', 'expense', 'transfer'],
        categories: [],
        startDate: '',
        endDate: '',
      })
      navigate(location.pathname, { replace: true, state: null })
    }, 0)
  }, [location.pathname, location.state, navigate, setFilters])

  // Scroll to focused transaction within listScrollRef to avoid outer window scroll displacement
  useEffect(() => {
    if (!pendingFocusTransactionId) return

    const frameId = window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-transaction-id="${pendingFocusTransactionId}"]`)
      if (!row) return
      const container = listScrollRef.current
      if (container) {
        const containerRect = container.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        const targetScrollTop =
          container.scrollTop + (rowRect.top - containerRect.top) - containerRect.height / 2 + rowRect.height / 2
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
      } else {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      setHighlightedTransactionId(pendingFocusTransactionId)
      setPendingFocusTransactionId(null)
      window.setTimeout(() => {
        setHighlightedTransactionId((current) => (current === pendingFocusTransactionId ? null : current))
      }, 1200)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [pendingFocusTransactionId, filteredTransactionsCount, listScrollRef])

  // Track session last seen timestamp to determine new transactions
  const sessionLastSeenTimestamp = useMemo(() => getLastSeenTxTimestamp(), [])

  useEffect(() => {
    // Commit last seen after 3.5 seconds of active view
    const timer = setTimeout(() => {
      updateLastSeenTxTimestamp()
    }, 3500)

    // Commit when app or tab is backgrounded
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateLastSeenTxTimestamp()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Commit last seen on unmount (user navigated away)
      updateLastSeenTxTimestamp()
    }
  }, [])

  return {
    highlightedTransactionId,
    sessionLastSeenTimestamp,
  }
}
