const variantClasses = {
  primary: 'bg-[var(--accent)] text-white shadow-xs hover:opacity-90',
  secondary: 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)]',
  ghost: 'bg-transparent text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]',
  danger: 'border border-[var(--status-expense)]/30 bg-[var(--status-expense-soft)] text-[var(--status-expense)] hover:bg-[var(--status-expense)]/20',
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-[translate,scale,opacity] duration-150 ease-out ${variantCls} ${disabledCls} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
