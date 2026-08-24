const variantClasses = {
  primary: 'bg-[var(--fg)] text-[var(--bg)] shadow-xs hover:opacity-90',
  secondary: 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)]',
  ghost: 'bg-transparent text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20',
}

function Button({ children, className = '', disabled = false, variant = 'primary', type = 'button', ...props }) {
  const variantCls = variantClasses[variant] || variantClasses.primary
  const disabledCls = disabled
    ? 'opacity-40 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer active:scale-[0.97]'

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-[transform,opacity] duration-150 ease-out ${variantCls} ${disabledCls} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
