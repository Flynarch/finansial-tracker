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

const WORD_ORDINALS = {
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

const INDO_NUMBER_WORDS = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
}

/**
 * Parses a single token or short phrase to a 0-based ordinal index, or null.
 * 
 * @param {string} text
 * @returns {number|null}
 */
export function parseOrdinalNumber(text) {
  if (!text || typeof text !== 'string') return null
  const clean = text.toLowerCase().trim()

  if (clean in WORD_ORDINALS) {
    return WORD_ORDINALS[clean]
  }

  const numMatch = clean.match(/^(?:transaksi|item|nomor|no\.?|ke[- ]?)?\s*#?(\d+)(?:st|nd|rd|th)?$/i)
  if (numMatch) {
    const val = parseInt(numMatch[1], 10)
    return val > 0 ? val - 1 : null
  }

  return null
}

/**
 * Resolves all 0-based ordinal indices mentioned in a natural language string.
 * Supports:
 * - "2 transaksi terakhir", "dua transaksi terakhir", "kedua transaksi tadi" -> [0, 1]
 * - "transaksi terakhir", "yang terakhir", "tadi", "barusan" -> [0]
 * - "transaksi pertama dan kedua", "transaksi ke-1 dan ke-2", "transaksi #1 dan #3" -> [0, 1] / [0, 2]
 * - "item #1, #2, #3", "transaksi 1 dan 2" -> [0, 1, 2] / [0, 1]
 * 
 * @param {string} text
 * @returns {number[]} Array of sorted unique 0-based indices
 */
export function resolveOrdinalIndices(text) {
  if (!text || typeof text !== 'string') return []
  const norm = text.toLowerCase().trim()
  const indices = new Set()

  // 1. Check expressions like "2 transaksi terakhir", "dua transaksi terakhir", "kedua transaksi tadi"
  const countRecentMatch = norm.match(/(?:(?:hapus|ubah|ganti|edit)\s+)?(?:(\d+)|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s+(?:transaksi\s+)?(?:terakhir|tadi|barusan|latest|last)/i)
  if (countRecentMatch) {
    const rawCount = countRecentMatch[1]
    const count = rawCount ? parseInt(rawCount, 10) : INDO_NUMBER_WORDS[countRecentMatch[0].match(/dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh/i)?.[0]] || 2
    for (let i = 0; i < count; i++) {
      indices.add(i)
    }
    return Array.from(indices).sort((a, b) => a - b)
  }

  // 2. Check "kedua transaksi tadi" / "kedua transaksi ini"
  if (/(?:kedua|2)\s+transaksi\s+(?:tadi|ini|tersebut)/i.test(norm)) {
    indices.add(0)
    indices.add(1)
    return Array.from(indices).sort((a, b) => a - b)
  }

  // 3. Check relative single latest: "transaksi terakhir", "yang terakhir", "terakhir", "latest", "last", "barusan", "tadi", "transaksi tadi"
  if (/(?:^|\b)(?:transaksi\s+)?(?:terakhir|latest|last|barusan|tadi)(?:\b|$)/i.test(norm)) {
    indices.add(0)
  }

  // 4. Handle "transaksi 1 dan 2", "transaksi 1, 2, dan 3", "transaksi ke-1 dan ke-3", etc.
  const transListMatch = norm.match(/(?:transaksi|item)\s+((?:(?:ke[- ]?)?\d+|pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan|kesembilan|kesepuluh)(?:\s*(?:,|dan|and|&|-)\s*(?:(?:ke[- ]?)?\d+|pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan|kesembilan|kesepuluh))*)/i)
  if (transListMatch) {
    const tokens = transListMatch[1].split(/[\s,dan&]+/i).filter(Boolean)
    for (const tok of tokens) {
      const idx = parseOrdinalNumber(tok)
      if (idx !== null && idx >= 0) {
        indices.add(idx)
      }
    }
  }

  // 5. Extract word ordinals: "pertama", "kedua", "ketiga", dst.
  for (const [word, idx] of Object.entries(WORD_ORDINALS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(norm)) {
      indices.add(idx)
    }
  }

  // 6. Extract numeric ordinals: "ke-1", "ke 2", "1st", "2nd", "#1", "#2", "no 1", "nomor 2", "transaksi 1", "item 2"
  const regexPatterns = [
    /(?:transaksi|item)?\s*ke[- ]?(\d+)/gi,
    /(\d+)(?:st|nd|rd|th)/gi,
    /#(\d+)/gi,
    /(?:nomor|no\.?)\s*(\d+)/gi,
    /(?:transaksi|item)\s+(\d+)/gi,
  ]

  for (const reg of regexPatterns) {
    let match
    while ((match = reg.exec(norm)) !== null) {
      const idx = parseInt(match[1], 10) - 1
      if (idx >= 0) indices.add(idx)
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Resolves the first 0-based ordinal index from a text string, or null.
 * 
 * @param {string} text
 * @returns {number|null}
 */
export function resolveOrdinalIndex(text) {
  const indices = resolveOrdinalIndices(text)
  return indices.length > 0 ? indices[0] : null
}

/**
 * Matches transactions for update or delete actions, supporting multiple transactions
 * via explicit transactionIds, ordinal Indonesian/English matching ("transaksi 1 dan 2",
 * "pertama dan kedua", "2 transaksi terakhir", "#1", "#2"), or text/token matching.
 * 
 * @param {Array} allFreshTxs
 * @param {object} result
 * @returns {Array<object>}
 */
export function findMatchingTransactionsForAction(allFreshTxs = [], result = {}) {
  if (Array.isArray(result.transactionIds) && result.transactionIds.length > 0) {
    const idSet = new Set(result.transactionIds.map(Number).filter(Number.isFinite))
    return allFreshTxs.filter((t) => idSet.has(t.id))
  }

  if (result.transactionId) {
    const single = allFreshTxs.find((t) => t.id === Number(result.transactionId))
    return single ? [single] : []
  }

  const sq = result.searchQuery ? result.searchQuery.toLowerCase().trim() : ''
  if (!sq) return []

  // Check ordinal matches first
  const ordinalIndices = resolveOrdinalIndices(sq)
  if (ordinalIndices.length > 0) {
    const matched = []
    for (const idx of ordinalIndices) {
      if (idx >= 0 && idx < allFreshTxs.length) {
        matched.push(allFreshTxs[idx])
      }
    }
    if (matched.length > 0) return matched
  }

  // Fallback to text / token search
  const isBatch = /\b(semua|all|semuanya|seluruh|seluruhnya|every)\b/i.test(sq) || Boolean(result.isBatch)
  const allTokens = sq.split(/\s+/).filter((tok) => tok.length >= 2)
  const filterTokens = allTokens.filter(
    (tok) => !['semua', 'all', 'semuanya', 'seluruh', 'seluruhnya', 'every'].includes(tok.toLowerCase())
  )
  const tokens = filterTokens.length > 0 ? filterTokens : (isBatch ? [] : allTokens)

  const checkTxMatch = (t) => {
    const matchesDate = !result.date || t.date === result.date
    const rawNotes = t.notes || ''
    const plainNotes = isFieldEncrypted(rawNotes) ? getDecryptedNoteSync(rawNotes) : rawNotes
    const notesLower = (plainNotes || '').toLowerCase()
    const merchantLower = (t.merchant || '').toLowerCase()
    const categoryLower = (t.category || '').toLowerCase()

    let splitNotesLower = ''
    if (Array.isArray(t.splitItems) && t.splitItems.length > 0) {
      splitNotesLower = t.splitItems
        .map((si) => {
          const rawSi = si?.notes || ''
          const plainSi = isFieldEncrypted(rawSi) ? getDecryptedNoteSync(rawSi) : rawSi
          return `${plainSi || ''} ${si?.category || ''}`
        })
        .join(' ')
        .toLowerCase()
    }

    if (isBatch && tokens.length === 0) {
      return matchesDate
    }

    const directMatch =
      (notesLower && notesLower.includes(sq)) ||
      (merchantLower && merchantLower.includes(sq)) ||
      (categoryLower && categoryLower.includes(sq)) ||
      (splitNotesLower && splitNotesLower.includes(sq))

    const tokenMatch =
      tokens.length > 0 &&
      tokens.some(
        (token) =>
          notesLower.includes(token) ||
          merchantLower.includes(token) ||
          categoryLower.includes(token) ||
          splitNotesLower.includes(token)
      )

    return matchesDate && (directMatch || tokenMatch)
  }

  if (isBatch) {
    return allFreshTxs.filter(checkTxMatch)
  }

  const matchedTx = allFreshTxs.find(checkTxMatch)
  return matchedTx ? [matchedTx] : []
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
  const matches = findMatchingTransactionsForAction(allFreshTxs, result)
  return matches.length > 0 ? matches[0] : null
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
