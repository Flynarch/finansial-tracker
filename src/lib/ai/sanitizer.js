/**
 * Prompt injection sanitization and delimiter wrappers for FinTrack AI.
 */

/**
 * Sanitizes user input string from dangerous prompt injection delimiter sequences.
 * Employs a fixed-point loop to eliminate nested/recursive delimiter bypasses (e.g. </user_</user_turn>turn>)
 * and strips HTML entity encoded representations.
 *
 * @param {string} text - Raw user input string
 * @returns {string} Cleaned string without injected tags
 */
export function sanitizeUserTurn(text) {
  if (typeof text !== 'string') return ''
  let sanitized = text
  let prev
  do {
    prev = sanitized
    sanitized = sanitized
      .replace(/<\/?user_turn(?:\s+[^>]*)?>/gi, '')
      .replace(/<\/?user_untrusted_transactions(?:\s+[^>]*)?>/gi, '')
      .replace(/&(?:lt|#60|#x3c);\/?user_turn(?:[\s\S]*?)&(?:gt|#62|#x3e);/gi, '')
      .replace(/&(?:lt|#60|#x3c);\/?user_untrusted_transactions(?:[\s\S]*?)&(?:gt|#62|#x3e);/gi, '')
  } while (sanitized !== prev)
  return sanitized.trim()
}

/**
 * Wraps user turn into explicit XML delineator tags.
 *
 * @param {string} userPrompt - Raw user prompt
 * @returns {string} Wrapped prompt
 */
export function wrapUserTurn(userPrompt) {
  const sanitized = sanitizeUserTurn(userPrompt)
  return `<user_turn>\n${sanitized}\n</user_turn>`
}

/**
 * Sanitizes Gemini multiturn contents payload.
 * Guarantees:
 * 1. Array is not empty and contains valid parts.
 * 2. Leading 'model' turns are stripped (Gemini multiturn must start with 'user').
 * 3. Adjacent turns with the same role are merged.
 * 4. Empty parts are removed.
 *
 * @param {Array<object>} contents - Raw contents array
 * @returns {Array<object>} Sanitized alternating contents array
 */
export function sanitizeGeminiContents(contents = []) {
  if (!Array.isArray(contents) || contents.length === 0) return []

  const cleanTurns = contents
    .filter((c) => c && (c.role === 'user' || c.role === 'model' || c.role === 'function') && Array.isArray(c.parts) && c.parts.length > 0)
    .map((c) => ({
      role: c.role === 'function' ? 'user' : c.role,
      parts: c.parts.filter((p) => p && (p.text !== undefined || p.inlineData || p.functionCall || p.functionResponse)),
    }))
    .filter((c) => c.parts.length > 0)

  if (cleanTurns.length === 0) return []

  // Multiturn MUST always begin with a 'user' turn
  while (cleanTurns.length > 0 && cleanTurns[0].role === 'model') {
    cleanTurns.shift()
  }

  if (cleanTurns.length === 0) return []

  // Ensure strictly alternating roles
  const alternating = []
  for (const turn of cleanTurns) {
    const last = alternating[alternating.length - 1]
    if (last && last.role === turn.role) {
      last.parts.push(...turn.parts)
    } else {
      alternating.push({ role: turn.role, parts: [...turn.parts] })
    }
  }

  return alternating
}

