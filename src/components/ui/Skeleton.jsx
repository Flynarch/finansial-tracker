/**
 * Shimmer loading skeleton.
 *
 * @param {object} props
 * @param {'text'|'circle'|'card'|'chart'} [props.variant='text'] - Shape variant
 * @param {string} [props.className] - Additional classes
 * @param {number} [props.lines=1] - Number of text lines (only for variant="text")
 */
function Skeleton({ variant = 'text', className = '', lines = 1 }) {
  if (variant === 'circle') {
    return (
      <div className={`ft-skeleton h-10 w-10 !rounded-full ${className}`} />
    )
  }

  if (variant === 'card') {
    return (
      <div className={`ft-skeleton rounded-2xl p-4 ${className}`} style={{ minHeight: '120px' }}>
        <div className="ft-skeleton mb-3 h-4 w-2/5 !rounded-md" />
        <div className="ft-skeleton mb-2 h-3 w-full !rounded-md" />
        <div className="ft-skeleton mb-2 h-3 w-4/5 !rounded-md" />
        <div className="ft-skeleton mt-4 h-8 w-1/3 !rounded-lg" />
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div className={`ft-skeleton rounded-2xl ${className}`} style={{ minHeight: '180px' }}>
        <div className="flex h-full items-end gap-1.5 p-4 pt-10">
          {[40, 65, 45, 80, 55, 70, 35, 60, 75, 50, 85, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, background: 'var(--skeleton-shine)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Default: text lines
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="ft-skeleton h-3 !rounded-md"
          style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

export default Skeleton
