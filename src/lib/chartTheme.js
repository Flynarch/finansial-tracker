/**
 * Shared Recharts Theme Configuration, Color Tokens, and Axis Defaults
 * Used across Dashboard and Reports modules for visual consistency.
 */

export const CHART_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#0ea5e9', // Sky
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
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
