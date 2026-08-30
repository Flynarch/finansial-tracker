import { memo } from 'react'

/**
 * AppBackground - Premium grain texture + soft ambient glow
 * Inspired by Stripe, Linear, Vercel aesthetics.
 * Film-grain SVG filter overlay + desaturated radial glow from top.
 * All colors from CSS custom properties for automatic theme adaptation.
 */
export const AppBackground = memo(function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {/* ── Base solid canvas ── */}
      <div className="absolute inset-0 bg-[var(--bg)]" />

      {/* ── Soft ambient glow (top-center) ── */}
      <div
        className="absolute -top-[18%] left-1/2 -translate-x-1/2 h-[55vh] w-[140vw] rounded-full blur-[120px]"
        style={{
          background: 'radial-gradient(ellipse, var(--accent), transparent 70%)',
          opacity: 0.07,
        }}
      />

      {/* ── Secondary subtle glow (bottom-right) ── */}
      <div
        className="absolute -bottom-[12%] -right-[15%] h-[40vh] w-[40vh] rounded-full blur-[100px]"
        style={{
          background: 'var(--accent)',
          opacity: 0.03,
        }}
      />

      {/* ── Film grain texture (SVG feTurbulence filter) ── */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.03] mix-blend-soft-light">
        <filter id="ft-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#ft-grain)" />
      </svg>
    </div>
  )
})

export default AppBackground
