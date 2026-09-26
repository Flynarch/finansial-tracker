const LAST_SEEN_KEY = 'ft_tx_last_seen_timestamp'

/**
 * Retrieves the timestamp of when transactions were last seen.
 * Initializes to the current time on first access so existing historical transactions
 * are not incorrectly marked as new.
 * @returns {number} Unix timestamp in milliseconds
 */
export function getLastSeenTxTimestamp() {
  if (typeof localStorage === 'undefined') return Date.now()
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY)
    if (!raw) {
      const now = Date.now()
      localStorage.setItem(LAST_SEEN_KEY, String(now))
      return now
    }
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now()
  } catch {
    return Date.now()
  }
}

/**
 * Updates the last-seen transaction timestamp in localStorage.
 * @param {number} [timestamp=Date.now()]
 */
export function updateLastSeenTxTimestamp(timestamp = Date.now()) {
  if (typeof localStorage === 'undefined') return
  try {
    const validTs = Number.isFinite(Number(timestamp)) && Number(timestamp) > 0 ? Number(timestamp) : Date.now()
    localStorage.setItem(LAST_SEEN_KEY, String(validTs))
  } catch (err) {
    console.warn('[transactionLastSeen:update]', err)
  }
}

/**
 * Evaluates whether a transaction is considered 'new' based on its creation timestamp.
 * @param {object} transaction
 * @param {number} lastSeenTimestamp
 * @returns {boolean}
 */
export function isTransactionNew(transaction, lastSeenTimestamp) {
  if (!transaction || !lastSeenTimestamp || !Number.isFinite(lastSeenTimestamp)) return false
  const txCreatedAt = Number(transaction.createdAt)
  if (!Number.isFinite(txCreatedAt) || txCreatedAt <= 0) return false
  return txCreatedAt > lastSeenTimestamp
}
