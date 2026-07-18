function Card({ title, children, className = '', titleClassName = '', withDivider = false, glass = true }) {
  const baseClass = glass ? 'ft-card' : 'ft-card-solid'
  return (
    <section className={`${baseClass} ${className}`}>
      {title ? <h3 className={`ft-card-title ${titleClassName}`}>{title}</h3> : null}
      {title && withDivider ? <div className="ft-card-divider" /> : null}
      {/* Make cards safe to use as flex column containers (scroll areas need min-h-0). */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

export default Card
