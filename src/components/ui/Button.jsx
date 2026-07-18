const variantClasses = {
  primary: 'ft-btn-primary',
  secondary: 'ft-btn-secondary',
  ghost: 'ft-btn-ghost',
  danger: 'ft-btn-danger',
}

function Button({ children, className = '', disabled = false, variant = 'primary', ...props }) {
  const cls = disabled ? 'ft-btn-disabled' : (variantClasses[variant] || variantClasses.primary)

  return (
    <button
      disabled={disabled}
      className={`${cls} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
