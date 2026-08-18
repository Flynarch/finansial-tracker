import { memo } from 'react'
import useAnimatedCounter from '../../hooks/useAnimatedCounter'
import { formatCurrency } from '../../lib/utils'

export const AnimatedCounter = memo(function AnimatedCounter({
  value = 0,
  currency = 'IDR',
  duration = 600,
  className = '',
  formatter,
  prefix = '',
  suffix = '',
}) {
  const animatedValue = useAnimatedCounter(value, { duration })

  const displayString = formatter
    ? formatter(animatedValue)
    : formatCurrency(animatedValue, currency)

  return (
    <span className={`tabular-nums font-inherit ${className}`}>
      {prefix}
      {displayString}
      {suffix}
    </span>
  )
})

export default AnimatedCounter
