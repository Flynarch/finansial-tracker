import { memo } from 'react'

/**
 * Domain-specific premium SVG glyphs for contextual empty states.
 * All designs use pure SVG paths, clean strokes, and semantic CSS variables.
 */
function EmptyIllustration({ variant = 'generic' }) {
  switch (variant) {
    case 'transactions':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <path d="M6 15h2" />
          <path d="M14 15h4" />
        </svg>
      )
    case 'budget':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      )
    case 'savings':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-3.5c1-.5 1.5-1 2-2 1.5-2.5 1-4 1-5.5 0-1.5-1-1-2-1z" />
          <path d="M16 11h.01" />
          <path d="M10 8h4" />
        </svg>
      )
    case 'loans':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
          <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.7-2.9l-3.7 2.5" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      )
    case 'todos':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 11 3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      )
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      )
    case 'search':
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      )
  }
}

/**
 * Reusable, multi-layered empty state component.
 * Features ambient badge halo, contextual domain illustrations, clear typography, and tactile CTA.
 *
 * @param {object} props
 * @param {'generic'|'transactions'|'budget'|'savings'|'loans'|'todos'|'calendar'|'reports'|'search'} [props.variant='generic']
 * @param {React.ReactNode} [props.icon] - Override icon to show inside inner core
 * @param {string} props.title - Title message
 * @param {string} [props.description] - Contextual description or guide
 * @param {React.ReactNode} [props.action] - Optional CTA button/link
 * @param {string} [props.hint] - Optional tip or status hint pill
 * @param {string} [props.className] - Additional wrapper classes
 */
function EmptyState({
  variant = 'generic',
  icon,
  title,
  description,
  action,
  hint,
  className = '',
}) {
  return (
    <div
      role="status"
      aria-label={typeof title === 'string' ? title : 'Status Kosong'}
      className={`relative flex flex-col items-center justify-center text-center p-6 sm:p-8 select-none ${className}`}
    >
      {/* Ambient Aura Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 h-28 w-28 rounded-full bg-[var(--accent)] opacity-10 blur-2xl"
      />

      {/* Layered Concentric Tactile Badge */}
      <div className="ft-empty-badge-halo">
        <div className="ft-empty-badge-core">
          {icon || <EmptyIllustration variant={variant} />}
        </div>
      </div>

      {/* Title */}
      <p className="ft-empty-state-title">{title}</p>

      {/* Contextual Description */}
      {description ? (
        <p className="ft-empty-state-desc">{description}</p>
      ) : null}

      {/* CTA Action Button */}
      {action ? (
        <div className="mt-5 flex items-center justify-center">
          {action}
        </div>
      ) : null}

      {/* Optional Hint Pill */}
      {hint ? (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)]/80 px-3 py-1 text-[11px] font-semibold text-[var(--muted)] shadow-2xs">
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  )
}

export default memo(EmptyState)
