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
  showSign = false,
}) {
  const animatedValue = useAnimatedCounter(value, { duration, skipInitial })

  // Clean rounding for zero-decimal currencies (IDR, JPY, KRW, VND) to eliminate micro-jitter
  const cleanCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : 'IDR'
  const isZeroDecimal =
    cleanCurrency === 'IDR' ||
    cleanCurrency === 'JPY' ||
    cleanCurrency === 'KRW' ||
    cleanCurrency === 'VND'

  const rawRounded = isZeroDecimal ? Math.round(animatedValue) : animatedValue
  const safeRoundedValue = Math.abs(rawRounded) === 0 ? 0 : rawRounded

  let dynamicPrefix = prefix
  let valToFormat = safeRoundedValue

  if (showSign) {
    if (safeRoundedValue > 0) {
      dynamicPrefix = `${prefix}+`
    } else if (safeRoundedValue < 0) {
      dynamicPrefix = `${prefix}-`
      valToFormat = Math.abs(safeRoundedValue)
    }
  }

  const displayString = formatter
    ? formatter(valToFormat)
    : formatCurrency(valToFormat, currency)

  return (
    <span className={`tabular-nums font-inherit transition-colors duration-200 ${className}`}>
      {dynamicPrefix}
      {displayString}
      {suffix}
    </span>
  )
})

export default AnimatedCounter
