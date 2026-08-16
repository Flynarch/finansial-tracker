/**
 * Ultra-Smooth Wind Gust & Storm Sweep Theme Transition
 * 
 * Delivers 120 FPS GPU-accelerated transitions across 3 themes:
 * 1. 'light' (Mode Terang / Putih Studio)
 * 2. 'dark' (Mode Arang / Matte Charcoal)
 * 3. 'midnight' (Mode Biru Malam / Obsidian Navy Blue)
 */

export const THEME_CYCLE = ['light', 'dark', 'midnight']

export function getNextTheme(currentTheme) {
  if (currentTheme === 'light') return 'dark'
  if (currentTheme === 'dark') return 'midnight'
  return 'light'
}

export function getThemeDetails(theme) {
  switch (theme) {
    case 'midnight':
      return {
        label: 'Mode Biru (Midnight)',
        shortLabel: 'Biru',
        bgColor: '#090d16',
      }
    case 'dark':
      return {
        label: 'Mode Arang (Matte)',
        shortLabel: 'Arang',
        bgColor: '#191b1f',
      }
    case 'light':
    default:
      return {
        label: 'Mode Terang (Putih)',
        shortLabel: 'Putih',
        bgColor: '#f4f6f9',
      }
  }
}

/**
 * Executes an ultra-smooth diagonal sweep transition.
 * Uses native View Transitions API with GPU-composited clip-path,
 * with a high-performance zero-jank fallback for other browsers.
 */
export function executeThemeTransition({ currentTheme, targetTheme, setTheme, originX, originY }) {
  const nextTheme = targetTheme || getNextTheme(currentTheme)
  const nextDetails = getThemeDetails(nextTheme)

  // Check for reduced motion preference
  const isReduced =
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-motion') === 'reduce' ||
      (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches))

  if (isReduced) {
    document.documentElement.setAttribute('data-theme', nextTheme)
    setTheme(nextTheme)
    return
  }

  // Consistent top-right origin for diagonal wind gust / storm sweep
  const x = originX !== undefined ? originX : (typeof window !== 'undefined' ? window.innerWidth : 400)
  const y = originY !== undefined ? originY : 0

  // 1. Native View Transitions API (Chrome, Edge, Safari 18+, Opera, Android Webview)
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    // Avoid double transitions if one is currently active
    if (document.documentElement.classList.contains('ft-theme-transitioning')) {
      return
    }
    document.documentElement.classList.add('ft-theme-transitioning')

    try {
      const transition = document.startViewTransition(() => {
        document.documentElement.setAttribute('data-theme', nextTheme)
        setTheme(nextTheme)
      })

      transition.ready.then(() => {
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        ) * 1.05

        const animation = document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
            fill: 'forwards',
          }
        )

        animation.onfinish = () => {
          document.documentElement.classList.remove('ft-theme-transitioning')
        }
      }).catch(() => {
        document.documentElement.setAttribute('data-theme', nextTheme)
        setTheme(nextTheme)
        document.documentElement.classList.remove('ft-theme-transitioning')
      })

      transition.finished.finally(() => {
        document.documentElement.classList.remove('ft-theme-transitioning')
      })
    } catch {
      document.documentElement.setAttribute('data-theme', nextTheme)
      setTheme(nextTheme)
      document.documentElement.classList.remove('ft-theme-transitioning')
    }
  } else {
    // 2. High-performance GPU-composited Fallback Curtain
    triggerSmoothFallbackCurtain({
      bgColor: nextDetails.bgColor,
      x,
      y,
      onApply: () => {
        document.documentElement.setAttribute('data-theme', nextTheme)
        setTheme(nextTheme)
      },
    })
  }
}

/**
 * Zero-jank GPU Fallback using transform + clip-path
 */
function triggerSmoothFallbackCurtain({ bgColor, x, y, onApply }) {
  if (typeof document === 'undefined') return

  const curtain = document.createElement('div')
  curtain.setAttribute('aria-hidden', 'true')
  curtain.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: ${bgColor};
    pointer-events: none;
    z-index: 999999;
    clip-path: circle(0px at ${x}px ${y}px);
    transition: clip-path 480ms cubic-bezier(0.16, 1, 0.3, 1);
    will-change: clip-path;
  `
  document.body.appendChild(curtain)

  // Trigger expansion
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      ) * 1.05

      curtain.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`

      // Halfway through expansion, switch theme in background
      setTimeout(() => {
        onApply()
      }, 240)

      // Clean up when animation finishes
      setTimeout(() => {
        curtain.remove()
      }, 520)
    })
  })
}
