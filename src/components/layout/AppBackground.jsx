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
        className="absolute -top-[18%] left-1/2 -translate-x-1/2 h-[55vh] w-[140vw] rounded-full blur-[100px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, var(--accent), transparent 70%)',
          opacity: 0.07,
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      {/* ── Secondary subtle glow (bottom-right) ── */}
      <div
        className="absolute -bottom-[12%] -right-[15%] h-[40vh] w-[40vh] rounded-full blur-[80px] pointer-events-none"
        style={{
          background: 'var(--accent)',
          opacity: 0.03,
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      {/* ── High-performance GPU-cached film grain pattern (200x200 tiled) ── */}
      <div
        className="absolute inset-0 h-full w-full pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='ft-grain-filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23ft-grain-filter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </div>
  )
})

export default AppBackground
