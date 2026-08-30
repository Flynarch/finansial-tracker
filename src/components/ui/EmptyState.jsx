/**
 * Reusable empty state component with responsive layout and action support.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.icon] - Icon/illustration to show (defaults to clean SVG)
 * @param {string} props.title - Title message
 * @param {string} [props.description] - Optional description
 * @param {React.ReactNode} [props.action] - Optional action button/link
 * @param {string} [props.className] - Additional classes
 */
function EmptyState({ icon, title, description, action, className = '' }) {
  const defaultIcon = (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  return (
    <div role="status" className={`flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in zoom-in-95 duration-300 ${className}`}>
      <div className="mb-3.5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] shadow-[var(--shadow-card)] text-[var(--muted)]">
        {icon || defaultIcon}
      </div>
      <p className="ft-display text-sm sm:text-base font-black text-[var(--fg)] tracking-tight">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-xs text-xs font-medium text-[var(--muted)] leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex items-center justify-center">{action}</div> : null}
    </div>
  )
}

export default EmptyState

