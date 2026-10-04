import { memo, useRef, useState, useLayoutEffect, useEffect } from 'react'
import MaskedBalance from '../ui/MaskedBalance'
import { formatCurrency } from '../../lib/utils'
import useSettingsStore from '../../store/useSettingsStore'

/**
 * AnimatedWalletBalance
 * Smoothly animates the width expansion and shrinking when balance is hidden or shown,
 * with cross-fading unmasked currency and masked dots.
 */
export const AnimatedWalletBalance = memo(function AnimatedWalletBalance({
  balance = 0,
  currency = 'IDR',
  hideBalance = false,
  className = '',
}) {
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const formatted = formatCurrency(balance, currency)
  const measureRef = useRef(null)
  const [measuredWidth, setMeasuredWidth] = useState(null)

  // Use layout effect to measure unmasked width immediately
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
  useIsomorphicLayoutEffect(() => {
    if (measureRef.current) {
      const w = measureRef.current.scrollWidth
      if (w > 0) {
        setMeasuredWidth(w)
      }
    }
  }, [formatted])

  // Sm masked balance with 5 dots + gap is 50px
  const maskedWidth = 50
  const targetWidth = hideBalance ? maskedWidth : (measuredWidth || 'auto')

  return (
    <div
      className={`relative flex items-center overflow-hidden h-4 select-none ${
        reduceMotion
          ? ''
          : 'transition-[width] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]'
      } ${className}`}
      style={{
        width: targetWidth !== 'auto' ? `${targetWidth}px` : undefined,
      }}
    >
      {/* Invisible text measurer */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute pointer-events-none whitespace-nowrap text-[13px] font-bold tabular-nums"
      >
        {formatted}
      </span>

      {/* Unmasked real balance */}
      <span
        aria-hidden={hideBalance}
        className={`absolute inset-0 flex items-center whitespace-nowrap text-[13px] font-bold tabular-nums leading-none text-[var(--fg)] transform-gpu ${
          reduceMotion
            ? hideBalance
              ? 'hidden'
              : 'block'
            : `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                hideBalance
                  ? 'opacity-0 scale-90 translate-y-1 pointer-events-none'
                  : 'opacity-100 scale-100 translate-y-0'
              }`
        }`}
      >
        {formatted}
      </span>

      {/* Masked dots */}
      <span
        aria-hidden={!hideBalance}
        className={`absolute inset-0 flex items-center transform-gpu ${
          reduceMotion
            ? hideBalance
              ? 'block'
              : 'hidden'
            : `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                hideBalance
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-90 -translate-y-1 pointer-events-none'
              }`
        }`}
      >
        <MaskedBalance size="sm" />
      </span>
    </div>
  )
})

export default AnimatedWalletBalance
