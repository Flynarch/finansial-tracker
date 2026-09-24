/**
 * Shimmer loading skeleton with high-definition financial primitives.
 *
 * @param {object} props
 * @param {'text'|'circle'|'avatar'|'card'|'chart'|'list-item'|'pill'|'bar'} [props.variant='text'] - Shape variant
 * @param {string} [props.className] - Additional classes
 * @param {number} [props.lines=1] - Number of text lines (only for variant="text")
 */
function Skeleton({ variant = 'text', className = '', lines = 1, ...rest }) {
  if (variant === 'circle' || variant === 'avatar') {
    return (
      <div
        aria-hidden="true"
        className={`ft-skeleton shrink-0 !rounded-full border border-[var(--border)]/40 ${className || 'h-10 w-10'}`}
        {...rest}
      />
    )
  }

  if (variant === 'pill') {
    return (
      <div
        aria-hidden="true"
        className={`ft-skeleton !rounded-full border border-[var(--border)]/40 ${className || 'h-7 w-20'}`}
        {...rest}
      />
    )
  }

  if (variant === 'bar') {
    return (
      <div
        aria-hidden="true"
        className={`ft-skeleton !rounded-lg ${className || 'h-3.5 w-full'}`}
        {...rest}
      />
    )
  }

  if (variant === 'card') {
    return (
      <div
        aria-hidden="true"
        className={`ft-skeleton-card p-4 sm:p-5 space-y-4 ${className}`}
        style={{ minHeight: '130px' }}
        {...rest}
      >
        <div className="flex items-center justify-between">
          <div className="ft-skeleton h-3.5 w-24 !rounded-lg" />
          <div className="ft-skeleton h-6 w-16 !rounded-full" />
        </div>
        <div className="ft-skeleton h-8 w-44 !rounded-xl" />
        <div className="flex items-center gap-4 pt-1">
          <div className="space-y-1.5 flex-1">
            <div className="ft-skeleton h-2.5 w-16 !rounded-md" />
            <div className="ft-skeleton h-4 w-28 !rounded-lg" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="ft-skeleton h-2.5 w-16 !rounded-md" />
            <div className="ft-skeleton h-4 w-28 !rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'list-item') {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-between p-3 sm:p-3.5 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] ${className}`}
        {...rest}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="ft-skeleton h-11 w-11 shrink-0 !rounded-2xl border border-[var(--border)]/50" />
          <div className="space-y-2 flex-1 min-w-0">
            <div className="ft-skeleton h-3.5 w-28 !rounded-lg" />
            <div className="ft-skeleton h-2.5 w-40 !rounded-md" />
          </div>
        </div>
        <div className="ft-skeleton h-4.5 w-24 shrink-0 !rounded-lg" />
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div
        aria-hidden="true"
        className={`ft-skeleton-card p-4 sm:p-5 space-y-3 ${className}`}
        style={{ minHeight: '180px' }}
        {...rest}
      >
        <div className="flex items-center justify-between">
          <div className="ft-skeleton h-4 w-32 !rounded-lg" />
          <div className="ft-skeleton h-6 w-20 !rounded-full" />
        </div>
        <div className="flex h-36 items-end gap-2 pt-6">
          {[35, 55, 40, 75, 50, 65, 30, 80, 60, 45, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md ft-skeleton border-t border-[var(--border)]/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="h-0.5 w-full bg-[var(--border)]/40 rounded-full" />
      </div>
    )
  }

  // Default: text lines
  return (
    <div aria-hidden="true" className={`space-y-2.5 ${className}`} {...rest}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="ft-skeleton h-3.5 !rounded-lg"
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export default Skeleton
