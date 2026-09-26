/**
 * Resolves and validates source and target wallets for a transfer action.
 * Returns { isValid, fromWallet, toWallet, errorMessageKey }.
 * 
 * @param {number|string} fromWalletId
 * @param {number|string} toWalletId
 * @param {Array} wallets
 * @returns {{ isValid: boolean, fromWallet: object|null, toWallet: object|null, errorMessageKey: string|null }}
 */
export function validateTransferWallets(fromWalletId, toWalletId, wallets = []) {
  const fromWallet = wallets.find((w) => w.id === Number(fromWalletId))
  const toWallet = wallets.find((w) => w.id === Number(toWalletId))

  if (!fromWallet || !toWallet) {
    return {
      isValid: false,
      fromWallet: fromWallet || null,
      toWallet: toWallet || null,
      errorMessageKey: 'missing_wallets',
    }
  }

  if (fromWallet.id === toWallet.id) {
    return {
      isValid: false,
      fromWallet,
      toWallet,
      errorMessageKey: 'same_wallet',
    }
  }

  return {
    isValid: true,
    fromWallet,
    toWallet,
    errorMessageKey: null,
  }
}

/**
 * Matches a transaction for update or delete actions using transactionId,
 * relative keyword ("terakhir", "latest"), or date AND search query constraints.
 * 
 * @param {Array} allFreshTxs
 * @param {object} result
 * @returns {object|null}
 */
export function findMatchingTransactionForAction(allFreshTxs = [], result = {}) {
  if (result.transactionId) {
    return allFreshTxs.find((t) => t.id === Number(result.transactionId)) || null
  }
  const sq = result.searchQuery ? result.searchQuery.toLowerCase().trim() : ''
  if (!sq) return null
  if (sq === 'terakhir' || sq === 'latest' || sq === 'tadi' || sq === 'barusan') {
    return allFreshTxs[0] || null
  }

  const tokens = sq.split(/\s+/).filter((tok) => tok.length >= 2)

  return (
    allFreshTxs.find((t) => {
      const matchesDate = !result.date || t.date === result.date
      const notesLower = (t.notes || '').toLowerCase()
      const merchantLower = (t.merchant || '').toLowerCase()
      const categoryLower = (t.category || '').toLowerCase()

      const directMatch =
        (notesLower && notesLower.includes(sq)) ||
        (merchantLower && merchantLower.includes(sq)) ||
        (categoryLower && categoryLower.includes(sq))

      const tokenMatch =
        tokens.length > 0 &&
        tokens.some((token) => notesLower.includes(token) || merchantLower.includes(token))

      return matchesDate && (directMatch || tokenMatch)
    }) || null
  )
}

/**
 * Matches a loan record for pay, mark_paid, or delete actions by title or personName.
 * Disallows empty search terms.
 * 
 * @param {Array} allLoans
 * @param {object} result
 * @param {object} [options]
 * @param {boolean} [options.includePaid=false]
 * @returns {{ filterTerm: string, matched: object|null }}
 */
export function findMatchingLoanForAction(allLoans = [], result = {}, { includePaid = false } = {}) {
  const filterTerm = (result.title || result.personName || '').trim().toLowerCase()
  if (!filterTerm) {
    return { filterTerm: '', matched: null }
  }
  const matched =
    allLoans.find(
      (l) =>
        (includePaid || (l.status !== 'paid' && !l.isArchived)) &&
        ((l.title && l.title.toLowerCase().includes(filterTerm)) ||
          (l.personName && l.personName.toLowerCase().includes(filterTerm)))
    ) || null
  return { filterTerm, matched }
}

/**
 * Prepares the unified message for display in chat, clearing streaming/temporary
 * processing text when action cards render.
 * 
 * @param {Array} newMsgs
 * @param {object} result
 * @returns {object|null}
 */
export function prepareUnifiedMessage(newMsgs = [], result = {}) {
  if (!newMsgs || newMsgs.length === 0) return null
  const unifiedMsg = { ...newMsgs[0] }
  const isActionCard = unifiedMsg.type && unifiedMsg.type !== 'text'
  if (isActionCard && !unifiedMsg.preserveContent && !unifiedMsg.isError) {
    unifiedMsg.content = ''
  } else {
    unifiedMsg.content = (unifiedMsg.isError || unifiedMsg.preserveContent)
      ? (unifiedMsg.content || unifiedMsg.customMsg || '')
      : (result.text || unifiedMsg.content || unifiedMsg.customMsg || '')
  }
  if (result.chips && result.chips.length > 0) {
    unifiedMsg.chips = result.chips
  }
  return unifiedMsg
}
