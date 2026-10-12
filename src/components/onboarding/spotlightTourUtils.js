/**
 * Spotlight Tour Utilities & Mathematics
 * Helper functions for element geometry, smooth easing, and SVG cutout paths.
 */

export function getVisibleElement(selector) {
  if (typeof document === 'undefined' || !selector) return null
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (selector === '[data-tour="ai-chat-btn"]') {
    if (isMobile) {
      const mobilePill = document.querySelector('.ft-ai-bar, button[data-tour="ai-chat-btn"].ft-ai-bar')
      if (mobilePill) return mobilePill
    } else {
      const desktopBtn = document.querySelector('nav [data-tour="ai-chat-btn"], header [data-tour="ai-chat-btn"]')
      if (desktopBtn) return desktopBtn
    }
  }

  const elements = Array.from(document.querySelectorAll(selector))
  if (elements.length === 0) return null

  return (
    elements.find((el) => {
      const rect = el.getBoundingClientRect()
      const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : {}
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style?.display !== 'none' &&
        style?.visibility !== 'hidden'
      )
    }) ||
    elements[0] ||
    null
  )
}

export function isFixedElement(el) {
  if (!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return false
  let curr = el
  while (curr && curr !== document.body && curr !== document.documentElement) {
    try {
      const style = window.getComputedStyle(curr)
      if (style?.position === 'fixed') return true
    } catch {
      break
    }
    curr = curr.parentElement
  }
  return false
}

export function smoothScrollTo(targetY, duration = 380, onComplete) {
  if (typeof window === 'undefined') {
    onComplete?.()
    return null
  }
  const startY = window.scrollY || window.pageYOffset
  const diff = targetY - startY
  if (Math.abs(diff) < 2) {
    onComplete?.()
    return null
  }

  const startTime = performance.now()
  // Cubic ease-out curve (1 - (1 - t)^3) matches standard CSS ease-out timing
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

  let rafId = null

  const step = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(1, elapsed / duration)
    const eased = easeOutCubic(progress)
    window.scrollTo(0, startY + diff * eased)
    if (progress < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      window.scrollTo(0, targetY)
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(step)
  return () => {
    if (rafId) cancelAnimationFrame(rafId)
  }
}

/** Generate Driver.js-style evenodd SVG path with rounded rectangle cutout */
export function buildCutoutSvgPath(rect, vw, vh) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return `M0,0 H${vw} V${vh} H0 Z`
  const { left: x, top: y, width: w, height: h, radius: rawR } = rect
  const r = Math.max(0, Math.min(rawR || 20, w / 2, h / 2))

  return `M0,0 H${vw} V${vh} H0 Z M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0 1 ${r},-${r} Z`
}
