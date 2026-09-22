import { THEME_BG_COLORS } from './lib/themeColors'

// Early theme initialization before React hydration
try {
  const t = typeof window !== 'undefined' ? (window.localStorage?.getItem('ft_theme') || 'light') : 'light'
  document.documentElement.setAttribute('data-theme', t)
  const bg = THEME_BG_COLORS[t] || THEME_BG_COLORS.light
  const m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', bg)
} catch (err) {
  console.error('[initTheme]', err)
}
