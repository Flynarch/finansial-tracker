import { memo } from 'react'

/**
 * AppBackground - Optimized ambient glow background.
 * Uses lightweight native CSS radial gradients without heavy feTurbulence SVG filters
 * or realtime GPU blur filters to eliminate rasterization jank and frame drops.
 */
export const AppBackground = memo(function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {/* ── Base solid canvas ── */}
      <div className="absolute inset-0 bg-[var(--bg)]" />

      {/* ── Soft ambient glow (top-center) without heavy blur filter ── */}
      <div
        className="absolute -top-[15%] left-1/2 -translate-x-1/2 h-[55vh] w-[130vw] rounded-full pointer-events-none transform-gpu"
        style={{
          background: 'radial-gradient(ellipse at center, var(--accent) 0%, transparent 65%)',
          opacity: 0.06,
          willChange: 'transform',
        }}
      />

      {/* ── Secondary subtle glow (bottom-right) ── */}
      <div
        className="absolute -bottom-[10%] -right-[10%] h-[40vh] w-[40vh] rounded-full pointer-events-none transform-gpu"
        style={{
          background: 'radial-gradient(circle at center, var(--accent) 0%, transparent 70%)',
          opacity: 0.025,
          willChange: 'transform',
        }}
      />
    </div>
  )
})

export default AppBackground
