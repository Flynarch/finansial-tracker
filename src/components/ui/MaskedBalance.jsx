import { memo } from 'react'
import useTranslation from '../../hooks/useTranslation'

const SIZE_MAP = {
  hero: {
    container: 'h-8 sm:h-9 gap-2 px-0.5',
    dot: 'h-3 w-3 sm:h-3.5 sm:w-3.5',
    defaultCount: 6,
  },
  lg: {
    container: 'h-6 sm:h-7 gap-1.5 px-0.5',
    dot: 'h-2.5 w-2.5 sm:h-3 sm:w-3',
    defaultCount: 6,
  },
  md: {
    container: 'h-4 gap-1.5 px-0.5 shrink-0',
    dot: 'h-2 w-2',
    defaultCount: 5,
  },
  sm: {
    container: 'h-3.5 gap-1 px-0.5 shrink-0',
    dot: 'h-1.5 w-1.5',
    defaultCount: 5,
  },
}

export const MaskedBalance = memo(function MaskedBalance({
  size = 'sm',
  count,
  className = '',
}) {
  const { t } = useTranslation()
  const conf = SIZE_MAP[size] || SIZE_MAP.sm
  const dotCount = count || conf.defaultCount
  const dots = Array.from({ length: dotCount })

  return (
    <span
      className={`inline-flex items-center select-none ${conf.container} ${className}`}
      aria-label={t('common.balanceHidden', 'Saldo disembunyikan')}
    >
      {dots.map((_, i) => (
        <span
          key={`mask-dot-${i}`}
          className={`rounded-full bg-current shrink-0 transform-gpu ${conf.dot}`}
          style={{
            animation: 'ft-mask-dot-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
            animationDelay: `${i * 45}ms`,
            opacity: 0.85,
          }}
        />
      ))}
    </span>
  )
})

export default MaskedBalance
