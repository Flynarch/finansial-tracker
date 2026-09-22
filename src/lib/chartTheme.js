/**
 * Shared Recharts Theme Configuration, Color Tokens, and Axis Defaults
 * Used across Dashboard and Reports modules for visual consistency.
 */

/**
 * Read a CSS custom-property value from the document root at runtime.
 * Returns the trimmed value or the provided fallback when the DOM is unavailable.
 * @param {string} varName - CSS variable name including `--` prefix.
 * @param {string} fallback - Fallback hex value.
 * @returns {string}
 */
function cssVar(varName, fallback) {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
}

/**
 * Dynamic chart palette that reads CSS custom properties (--chart-1 … --chart-8)
 * so colors automatically adapt to the active data-theme (dark / midnight / light).
 * Call this function each render cycle to pick up theme changes.
 * @returns {string[]}
 */
export function getChartPalette() {
  return [
    cssVar('--chart-1', '#818cf8'),
    cssVar('--chart-2', '#34d399'),
    cssVar('--chart-3', '#fbbf24'),
    cssVar('--chart-4', '#fb7185'),
    cssVar('--chart-5', '#38bdf8'),
    cssVar('--chart-6', '#a78bfa'),
    cssVar('--chart-7', '#f472b6'),
    cssVar('--chart-8', '#2dd4bf'),
  ]
}

/** @deprecated Use getChartPalette() for theme-adaptive colors. Kept for backward compatibility. */
export const CHART_PALETTE = [
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#2dd4bf',
]

export const CHART_X_AXIS_DEFAULTS = Object.freeze({
  stroke: 'var(--muted-2)',
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  fontWeight: 600,
  dy: 6,
})

export const CHART_Y_AXIS_DEFAULTS = Object.freeze({
  stroke: 'var(--muted-2)',
  tickLine: false,
  axisLine: false,
  width: 48,
  fontSize: 10,
  fontWeight: 600,
})

export const CHART_GRID_DEFAULTS = Object.freeze({
  strokeDasharray: '3 3',
  stroke: 'var(--border)',
  vertical: false,
  opacity: 0.4,
})

export const CHART_TOOLTIP_CURSOR = Object.freeze({
  stroke: 'var(--accent)',
  strokeWidth: 1.5,
  strokeDasharray: '4 4',
})

export const CHART_MARGIN_DEFAULTS = Object.freeze({
  top: 10,
  right: 10,
  left: -10,
  bottom: 0,
})
