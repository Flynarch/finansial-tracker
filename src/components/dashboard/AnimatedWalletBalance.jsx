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
  size = 'sm',
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

  const isLg = size === 'lg'
  // Sm masked balance is 50px, Lg masked balance is 106px to prevent 6-dot truncation
  const maskedWidth = isLg ? 106 : 50
  const targetWidth = hideBalance ? maskedWidth : (measuredWidth || 'auto')
  const heightCls = isLg ? 'h-8 sm:h-9' : 'h-4'
  const textCls = isLg ? 'ft-display text-xl sm:text-3xl font-black' : 'text-[13px] font-bold'

  return (
    <div
      className={`relative flex items-center overflow-hidden ${heightCls} select-none ${
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
        className={`invisible absolute pointer-events-none whitespace-nowrap ${textCls} tabular-nums`}
      >
        {formatted}
      </span>

      {/* Unmasked real balance */}
      <span
        aria-hidden={hideBalance}
        className={`absolute inset-0 flex items-center whitespace-nowrap ${textCls} tabular-nums leading-none text-[var(--fg)] transform-gpu ${
          reduceMotion
            ? hideBalance
              ? 'hidden'
              : 'block'
            : `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                hideBalance
                  ? 'opacity-0 scale-90 translate-y-1 blur-[3px] pointer-events-none'
                  : 'opacity-100 scale-100 translate-y-0 blur-0'
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
                  ? 'opacity-100 scale-100 translate-y-0 blur-0'
                  : 'opacity-0 scale-90 -translate-y-1 blur-[2px] pointer-events-none'
              }`
        }`}
      >
        <MaskedBalance size={isLg ? 'lg' : 'sm'} />
      </span>
    </div>
  )
})

export default AnimatedWalletBalance
