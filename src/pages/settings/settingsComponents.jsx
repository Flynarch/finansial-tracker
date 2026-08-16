import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function SettingsSection({ label, footnote, children, className = '' }) {
  return (
    <section className={`ft-settings-section ${className}`}>
      {label ? <h2 className="ft-settings-section-label">{label}</h2> : null}
      <div className="ft-settings-group">{children}</div>
      {footnote ? (
        <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-[var(--muted)] font-medium">
          {footnote}
        </p>
      ) : null}
    </section>
  )
}

export function SettingsSplitRow({ label, description, icon: Icon, iconColor = 'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20', children }) {
  return (
    <div className="ft-settings-cell flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {Icon ? (
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <span className="block text-sm font-bold text-[var(--fg)] leading-snug">{label}</span>
          {description ? (
            <span className="mt-0.5 block text-[11px] font-medium text-[var(--muted)] leading-snug">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      <div className="w-full sm:w-auto sm:min-w-[10rem] sm:max-w-[14rem]">{children}</div>
    </div>
  )
}

export function SettingsSegmentControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full items-center rounded-xl bg-[var(--field-bg)] p-1 border border-[var(--border)] shadow-inner-xs"
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        const OptIcon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-bold transition-all cursor-pointer select-none ${
              isActive
                ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs border border-[var(--border)]/80 scale-[1.02]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg-hover)]'
            }`}
          >
            {OptIcon ? <OptIcon className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SettingsLinkRow({
  to,
  title,
  label,
  subtitle,
  icon: Icon,
  iconColor = 'text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20',
  badge,
  badgeColor = 'bg-[var(--field-bg)] text-[var(--muted)] border-[var(--border)]',
}) {
  const navigate = useNavigate()
  const displayTitle = title || label
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="ft-settings-cell flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent text-left transition hover:bg-[var(--field-bg)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon ? (
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${iconColor} shadow-2xs`}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <span className="block text-sm font-bold leading-snug text-[var(--fg)]">
            {displayTitle}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-[var(--muted)]">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold border ${badgeColor}`}
          >
            {badge}
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
      </div>
    </button>
  )
}
