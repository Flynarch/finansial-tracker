/**
 * Reusable empty state component.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.icon] - Icon/illustration to show (defaults to a generic empty icon)
 * @param {string} props.title - Title message
 * @param {string} [props.description] - Optional description
 * @param {React.ReactNode} [props.action] - Optional action button/link
 * @param {string} [props.className] - Additional classes
 */
function EmptyState({ icon, title, description, action, className = '' }) {
  const defaultIcon = (
    <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="8" y="10" width="32" height="28" rx="4" strokeDasharray="4 3" />
      <path d="M20 24h8M24 20v8" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )

  return (
    <div className={`ft-empty-state ${className}`}>
      <div className="ft-empty-state-icon">
        {icon || defaultIcon}
      </div>
      <p className="ft-empty-state-title">{title}</p>
      {description ? <p className="ft-empty-state-desc">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export default EmptyState
