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
