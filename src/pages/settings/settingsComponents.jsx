import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, X } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'

export function SettingsSection({ label, action, footnote, children, className = '' }) {
  return (
    <section className={`ft-settings-section ${className}`}>
      {label ? (
        <div className="flex items-center justify-between px-1 mb-2.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            {label}
          </h2>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      <div className="ft-settings-group">{children}</div>
      {footnote ? (
        <p className="mt-2.5 px-1.5 text-xs leading-relaxed text-[var(--muted)] font-medium">
          {footnote}
        </p>
      ) : null}
    </section>
  )
}

export function SettingsSplitRow({
  label,
  description,
  icon: Icon,
  iconColor = 'text-[var(--badge-icon)] bg-[var(--badge-bg)] border-[var(--badge-border)]',
  children,
}) {
  return (
    <div className="ft-settings-cell flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon ? (
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${iconColor} shadow-2xs`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <span className="block text-[14.5px] font-bold text-[var(--fg)] leading-tight">{label}</span>
          {description ? (
            <span className="block text-xs font-medium text-[var(--muted)] leading-tight mt-1">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      <div className="w-full sm:w-auto sm:min-w-[11rem] sm:max-w-[15rem]">{children}</div>
    </div>
  )
}

export function SettingsSegmentControl({ options, value, onChange, ariaLabel }) {
  const count = options.length || 1
  const activeIndex = options.findIndex((opt) => opt.value === value)

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex w-full items-center rounded-xl bg-[var(--field-bg)] p-1 border border-[var(--border)] gap-1 shadow-2xs"
    >
      {/* Fluid Sliding Pill Indicator */}
      {activeIndex >= 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-lg bg-[var(--panel-strong)] shadow-xs border border-[var(--border)] transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: `calc((100% - ${(count - 1) * 4}px - 8px) / ${count})`,
            transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
          }}
        />
      ) : null}

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
            className={`relative z-1 flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2.5 text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer select-none active:scale-[0.98] ${
              isActive
                ? 'text-[var(--fg)] font-extrabold'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
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
  iconColor = 'text-[var(--badge-icon)] bg-[var(--badge-bg)] border-[var(--badge-border)]',
  badge,
  badgeColor = 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border)]',
  onClick,
}) {
  const navigate = useNavigate()
  const displayTitle = title || label
  const handleClick = () => {
    if (onClick) onClick()
    else if (to) navigate(to)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group ft-settings-cell flex w-full cursor-pointer items-center justify-between gap-3.5 border-0 bg-transparent text-left transition hover:bg-[var(--field-bg)]/60 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {Icon ? (
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${iconColor} shadow-2xs group-hover:scale-105 transition-transform`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold leading-snug text-[var(--fg)]">
            {displayTitle}
          </span>
          {subtitle ? (
            <span className="block text-xs font-medium leading-normal text-[var(--muted)] mt-0.5">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-1">
        {badge ? (
          <span
            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold border ${badgeColor} whitespace-nowrap`}
          >
            {badge}
          </span>
        ) : null}
        <ChevronRight className="h-4.5 w-4.5 text-[var(--muted)] group-hover:text-[var(--fg)] group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </button>
  )
}

export function SettingsToggleRow({
  label,
  description,
  icon: Icon,
  iconColor = 'text-[var(--badge-icon)] bg-[var(--badge-bg)] border-[var(--badge-border)]',
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="ft-settings-cell flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {Icon ? (
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${iconColor} shadow-2xs`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-[var(--fg)] leading-snug">{label}</span>
          {description ? (
            <span className="block text-xs font-medium text-[var(--muted)] leading-normal mt-0.5">
              {description}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-checked={checked ? 'true' : 'false'}
        onClick={() => onChange(!checked)}
        className="ft-toggle-switch shrink-0"
      >
        <span data-checked={checked ? 'true' : 'false'} className="ft-toggle-switch-thumb" />
      </button>
    </div>
  )
}

export function SettingsBentoTile({
  label,
  value,
  icon: Icon,
  iconColor = 'text-[var(--badge-icon)] bg-[var(--badge-bg)] border-[var(--badge-border)]',
  onClick,
  active = false,
  badge,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={`ft-settings-tile relative ${
        active ? 'border-[var(--accent)]/50 ring-2 ring-[var(--accent)]/20' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${iconColor} shadow-2xs`}>
          <Icon className="h-5 w-5" />
        </div>
        {badge ? (
          <span className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--muted)] whitespace-nowrap">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <span className="block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] leading-tight">
          {label}
        </span>
        <span className="block text-sm font-black text-[var(--fg)] leading-snug mt-1">
          {value}
        </span>
      </div>
    </div>
  )
}

export function SettingsSearchInput({
  value,
  onChange,
  placeholder = 'Cari pengaturan...',
  onClear,
}) {
  const { t } = useTranslation()

  return (
    <div className="relative flex items-center">
      <div className="absolute left-3.5 text-[var(--muted)] pointer-events-none">
        <Search className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] pl-10 pr-10 text-sm font-semibold text-[var(--fg)] placeholder:text-[var(--muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-card transition-all"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear || (() => onChange(''))}
          className="absolute right-3 grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition cursor-pointer"
          aria-label={t('common.clearSearch', 'Hapus pencarian')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
