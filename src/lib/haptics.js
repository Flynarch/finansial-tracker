/**
 * High-performance, multi-tier Haptic Feedback Engine for FinTrack.
 *
 * Tiers:
 * 1. Web Vibration API (navigator.vibrate) - instant, zero overhead on mobile browsers
 * 2. Silent graceful fallback on desktop / non-supporting environments
 */

const VIBRATION_PATTERNS = {
  light: 10,
  medium: 22,
  heavy: 45,
  success: [12, 40, 18],
  warning: [30, 50, 30],
  error: [40, 60, 40, 60, 40],
}

export function triggerHaptic(type = 'light') {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return

    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      const pattern = VIBRATION_PATTERNS[type] || VIBRATION_PATTERNS.light
      navigator.vibrate(pattern)
    }
  } catch {
    // Graceful no-op on platforms blocking vibration
  }
}
