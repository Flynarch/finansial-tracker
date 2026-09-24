/**
 * Global Keyboard Autocorrect, Predictive Suggestions & Capitalization Enforcer.
 * Ensures all editable text fields across Android WebView have native
 * keyboard autocorrect, spellcheck, sentence capitalization, and word predictions enabled,
 * while safely ignoring sensitive fields (PINs, passwords, and crypto recovery mnemonics).
 */

export function isSensitiveField(element) {
  if (!element || !(element instanceof HTMLElement)) return true
  const type = (element.getAttribute('type') || '').toLowerCase()
  if (type === 'password' || type === 'number' || type === 'tel') return true

  const inputMode = (element.getAttribute('inputmode') || '').toLowerCase()
  if (inputMode === 'numeric' || inputMode === 'decimal') return true

  const name = (element.getAttribute('name') || '').toLowerCase()
  const id = (element.getAttribute('id') || '').toLowerCase()
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase()

  if (
    name.includes('pin') ||
    id.includes('pin') ||
    name.includes('password') ||
    id.includes('password') ||
    name.includes('mnemonic') ||
    id.includes('mnemonic') ||
    autocomplete === 'new-password' ||
    autocomplete === 'current-password' ||
    autocomplete === 'one-time-code' ||
    element.dataset.sensitive === 'true' ||
    element.dataset.noAutocorrect === 'true' ||
    element.getAttribute('autocorrect') === 'off'
  ) {
    return true
  }

  return false
}

export function applyAutocorrectToElement(element) {
  if (!element || isSensitiveField(element)) return

  // Enable autocorrect
  if (!element.hasAttribute('autocorrect') || element.getAttribute('autocorrect') !== 'on') {
    element.setAttribute('autocorrect', 'on')
  }

  // Enable spellcheck
  if (!element.hasAttribute('spellcheck') || element.getAttribute('spellcheck') !== 'true') {
    element.setAttribute('spellcheck', 'true')
  }

  // Enable autocapitalize
  if (
    !element.hasAttribute('autocapitalize') ||
    element.getAttribute('autocapitalize') === 'none' ||
    element.getAttribute('autocapitalize') === 'off'
  ) {
    element.setAttribute('autocapitalize', 'sentences')
  }

  // Enable autocomplete
  if (!element.hasAttribute('autocomplete') || element.getAttribute('autocomplete') === 'off') {
    element.setAttribute('autocomplete', 'on')
  }
}

export function initGlobalAutocorrect() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // 1. Capture-phase focus and touch triggers (ensures attributes are present before IME connects)
  const handleInteraction = (e) => {
    const target = e.target
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      applyAutocorrectToElement(target)
    }
  }

  window.addEventListener('focusin', handleInteraction, { capture: true, passive: true })
  window.addEventListener('pointerdown', handleInteraction, { capture: true, passive: true })

  // 2. MutationObserver scans newly mounted elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
            applyAutocorrectToElement(node)
          }
          const nestedInputs = node.querySelectorAll?.('input, textarea')
          if (nestedInputs && nestedInputs.length > 0) {
            nestedInputs.forEach(applyAutocorrectToElement)
          }
        }
      }
    }
  })

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  })

  // 3. Initial pass for static elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('input, textarea').forEach(applyAutocorrectToElement)
    })
  } else {
    document.querySelectorAll('input, textarea').forEach(applyAutocorrectToElement)
  }
}
