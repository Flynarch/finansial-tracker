function Card({ title, children, className = '', titleClassName = '', withDivider = false, glass = true }) {
  const baseClass = glass
    ? 'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-[var(--shadow-card)]'
    : 'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--field-bg)] p-4 sm:p-5 shadow-2xs'

  return (
    <section className={`${baseClass} ${className}`}>
      {title ? (
        <h3 className={`text-sm sm:text-base font-black tracking-tight text-[var(--fg)] mb-3 ${titleClassName}`}>
          {title}
        </h3>
      ) : null}
      {title && withDivider ? <div className="mb-3 h-px w-full bg-[var(--border)]/60" /> : null}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

export default Card
