import { useNavigate } from 'react-router-dom'

export function SettingsSection({ label, footnote, children }) {
  return (
    <section className="ft-settings-section">
      {label ? <h2 className="ft-settings-section-label">{label}</h2> : null}
      <div className="ft-settings-group">{children}</div>
      {footnote ? <p className="mt-2 px-1 text-[12px] leading-relaxed text-[var(--muted-2)]">{footnote}</p> : null}
    </section>
  )
}

export function SettingsSplitRow({ label, children }) {
  return (
    <div className="ft-settings-cell ft-settings-split">
      <span className="ft-settings-split-label">{label}</span>
      <div className="ft-settings-split-control">{children}</div>
    </div>
  )
}

export function SettingsLinkRow({ to, title, subtitle }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="ft-settings-cell flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent text-left transition hover:bg-[var(--field-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
    >
      <div className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug text-[var(--fg)]">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">{subtitle}</span>
        ) : null}
      </div>
      <span className="shrink-0 text-lg text-[var(--muted)]" aria-hidden="true">
        ›
      </span>
    </button>
  )
}
