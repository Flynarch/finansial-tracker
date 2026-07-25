/**
 * Pure chart domain and tick helper functions extracted from Dashboard.jsx.
 * All functions are stateless and have no React dependencies.
 */

export function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function buildCenteredDomain(series, padRatio = 0.22, { includeZero = false } = {}) {
  const values = (series || []).map((row) => Number(row?.value)).filter((v) => Number.isFinite(v))
  if (values.length === 0) return ['auto', 'auto']
  const min = Math.min(...values); const max = Math.max(...values)
  const last = Number((series || [])[series.length - 1]?.value)
  const center = Number.isFinite(last) ? last : (min + max) / 2
  const halfSpan = Math.max(1, Math.max(Math.abs(max - center), Math.abs(center - min)))
  const pad = halfSpan * padRatio
  const lo = center - halfSpan - pad; const hi = center + halfSpan + pad
  if (!includeZero) return [lo, hi]
  return [Math.min(lo, 0), Math.max(hi, 0)]
}

export function buildPaddedDomain(series, padRatio = 0.18, { includeZero = false, respectDataSign = false } = {}) {
  const values = (series || []).map((row) => Number(row?.value)).filter((v) => Number.isFinite(v))
  if (values.length === 0) return ['auto', 'auto']
  const min = Math.min(...values); const max = Math.max(...values)
  const span = Math.max(1, max - min); const pad = span * padRatio
  let lo = min - pad; let hi = max + pad
  if (includeZero) { if (min >= 0) lo = 0; if (max <= 0) hi = 0 }
  if (respectDataSign) { if (min >= 0) hi = max; if (max <= 0) lo = min }
  return [lo, hi]
}

export function pickNiceStep(roughStep, minUnit = 1) {
  const safeRough = Math.max(Number(minUnit) || 1, Number(roughStep) || 1)
  const exponent = Math.floor(Math.log10(safeRough))
  const base = 10 ** exponent; const normalized = safeRough / base
  const ladder = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 10]
  const chosen = ladder.find((n) => n >= normalized) || 10
  const step = chosen * base; const unit = Math.max(1, Number(minUnit) || 1)
  return Math.max(unit, Math.ceil(step / unit) * unit)
}

export function buildNiceTicksForDomain(domain, maxLabels = 5, minUnit = 1, includeZero = true) {
  if (!Array.isArray(domain) || domain.length < 2) return [0]
  let lo = Number(domain[0]); let hi = Number(domain[1])
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0]
  if (lo > hi) { const tmp = lo; lo = hi; hi = tmp }
  if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0) }
  const targetLabels = Math.max(3, maxLabels)
  let step = pickNiceStep((hi - lo) / Math.max(1, targetLabels - 1), minUnit)
  let start = Math.floor(lo / step) * step; let end = Math.ceil(hi / step) * step
  let ticks = []
  for (let v = start; v <= end + step * 0.5; v += step) ticks.push(Math.round(v))
  while (ticks.length > targetLabels + 1) {
    step = pickNiceStep(step * 1.6, minUnit)
    start = Math.floor(lo / step) * step; end = Math.ceil(hi / step) * step
    ticks = []
    for (let v = start; v <= end + step * 0.5; v += step) ticks.push(Math.round(v))
  }
  return ticks
}

export function buildAdaptiveMoneyTicks(domain, { minUnit = 1 } = {}) {
  if (!Array.isArray(domain) || domain.length < 2) return [0]
  const lo = Number(domain[0]); const hi = Number(domain[1])
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0]
  const min = Math.min(lo, hi); const max = Math.max(lo, hi)
  const ticks = new Set(); ticks.add(0)
  const addSide = (target, sign) => {
    const absTarget = Math.max(0, Math.abs(target)); if (absTarget <= 0) return
    let decade = Math.max(1, Number(minUnit) || 1)
    while (decade <= absTarget * 1.001) {
      ;[1, 2.5, 5].forEach((m) => { const v = Math.round(m * decade); if (v <= 0) return; if (v <= absTarget * 1.001) ticks.add(sign * v) })
      decade *= 10
    }
  }
  addSide(max, 1); addSide(min, -1)
  return Array.from(ticks).filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
}

export function compactTicksAroundZero(allTicks, maxLabels = 6) {
  const sorted = Array.from(new Set((allTicks || []).filter((v) => Number.isFinite(v)))).sort((a, b) => a - b)
  if (sorted.length <= maxLabels) return sorted
  const negatives = sorted.filter((v) => v < 0); const positives = sorted.filter((v) => v > 0)
  const result = [0]; let negIdx = negatives.length - 1; let posIdx = 0
  while (result.length < maxLabels && (negIdx >= 0 || posIdx < positives.length)) {
    if (negIdx >= 0) { result.push(negatives[negIdx]); negIdx -= 1; if (result.length >= maxLabels) break }
    if (posIdx < positives.length) { result.push(positives[posIdx]); posIdx += 1 }
  }
  return Array.from(new Set(result)).sort((a, b) => a - b)
}

export function ensureZeroTickWithinLimit(ticks, maxLabels) {
  const uniqueSorted = Array.from(new Set((ticks || []).filter((v) => Number.isFinite(v)))).sort((a, b) => a - b)
  if (uniqueSorted.length === 0) return [0]
  const withZero = uniqueSorted.includes(0) ? uniqueSorted : [...uniqueSorted, 0].sort((a, b) => a - b)
  if (withZero.length <= maxLabels) return withZero
  const minTick = withZero[0]; const maxTick = withZero[withZero.length - 1]
  const selected = new Set([minTick, 0, maxTick])
  const remaining = withZero.filter((v) => !selected.has(v)).sort((a, b) => Math.abs(a) - Math.abs(b))
  for (const tick of remaining) { if (selected.size >= maxLabels) break; selected.add(tick) }
  return Array.from(selected).sort((a, b) => a - b)
}
