function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)]',
    success: 'border ft-income-soft',
    danger: 'border ft-expense-soft',
    gold: 'border border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-400',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold tracking-wide ${tones[tone] || tones.neutral}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  )
}

export default Badge
