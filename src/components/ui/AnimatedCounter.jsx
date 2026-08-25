import { memo } from 'react'
import useAnimatedCounter from '../../hooks/useAnimatedCounter'
import { formatCurrency } from '../../lib/utils'

export const AnimatedCounter = memo(function AnimatedCounter({
  value = 0,
  currency = 'IDR',
  duration,
  className = '',
  formatter,
  prefix = '',
  suffix = '',
  skipInitial = false,
}) {
  const animatedValue = useAnimatedCounter(value, { duration, skipInitial })

  // Clean rounding for zero-decimal currencies (IDR, JPY, KRW) to eliminate micro-jitter
  const safeRoundedValue =
    currency === 'IDR' || currency === 'JPY' || currency === 'KRW'
      ? Math.round(animatedValue)
      : animatedValue

  const displayString = formatter
    ? formatter(safeRoundedValue)
    : formatCurrency(safeRoundedValue, currency)

  return (
    <span className={`tabular-nums font-inherit transition-colors duration-200 ${className}`}>
      {prefix}
      {displayString}
      {suffix}
    </span>
  )
})

export default AnimatedCounter
