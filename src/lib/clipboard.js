/**
 * Robust clipboard utility for web and Capacitor native Android WebView.
 * Handles unfocused documents, permission restrictions, and legacy fallbacks.
 *
 * @param {string|number} text - Content to copy
 * @returns {Promise<boolean>} True if copied successfully, false otherwise
 */
export async function copyToClipboard(text) {
  if (text === null || text === undefined) {
    return false
  }

  const stringToCopy = String(text)
  if (!stringToCopy) {
    return false
  }

  // 1. Try modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(stringToCopy)
      return true
    } catch {
      // Document may not be focused or permission denied in WebView, proceed to fallback
    }
  }

  // 2. Fallback to hidden textarea with execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = stringToCopy
      textArea.setAttribute('readonly', '')
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '0'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'

      document.body.appendChild(textArea)

      // Support iOS selection range as well
      textArea.focus({ preventScroll: true })
      textArea.select()
      textArea.setSelectionRange(0, stringToCopy.length)

      const success = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (success) {
        return true
      }
    } catch {
      // Fallback failed
    }
  }

  return false
}
