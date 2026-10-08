import { getDecryptedNoteSync, isFieldEncrypted } from '../fieldEncryption'

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
 * relative keyword ("terakhir", "latest"), numeric/word ordinals ("kedua", "ke-3"),
 * or date AND search query constraints.
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

  // 1. Cek referensi relatif terbaru
  if (/^(?:terakhir|latest|last|tadi|barusan)$/i.test(sq)) {
    return allFreshTxs[0] || null
  }

  // 2. Cek format numerik "ke-1", "ke 2", "transaksi ke-3", "2nd", "3rd", dll.
  const numOrdinalMatch = sq.match(/(?:transaksi\s+)?(?:ke[- ]?(\d+)|(\d+)(?:st|nd|rd|th))/i)
  if (numOrdinalMatch) {
    const idx = parseInt(numOrdinalMatch[1] || numOrdinalMatch[2], 10) - 1
    if (idx >= 0 && idx < allFreshTxs.length) {
      return allFreshTxs[idx]
    }
  }

  // 3. Cek format kata ordinal "pertama", "kedua", "ketiga", dst.
  const wordOrdinals = {
    pertama: 0, kesatu: 0, first: 0,
    kedua: 1, second: 1,
    ketiga: 2, third: 2,
    keempat: 3, fourth: 3,
    kelima: 4, fifth: 4,
    keenam: 5, sixth: 5,
    ketujuh: 6, seventh: 6,
    kedelapan: 7, eighth: 7,
    kesembilan: 8, ninth: 8,
    kesepuluh: 9, tenth: 9,
  }
  for (const [word, idx] of Object.entries(wordOrdinals)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(sq)) {
      if (idx < allFreshTxs.length) return allFreshTxs[idx]
    }
  }

  const tokens = sq.split(/\s+/).filter((tok) => tok.length >= 2)

  return (
    allFreshTxs.find((t) => {
      const matchesDate = !result.date || t.date === result.date
      const rawNotes = t.notes || ''
      const plainNotes = isFieldEncrypted(rawNotes) ? getDecryptedNoteSync(rawNotes) : rawNotes
      const notesLower = (plainNotes || '').toLowerCase()
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
