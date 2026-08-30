function ToastBanner({ message, tone = 'error' }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'

  const indicatorClass =
    tone === 'success' ? 'bg-emerald-400' : tone === 'warning' ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${toneClass}`}>
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${indicatorClass}`} />
      <p className="m-0 leading-relaxed">{message}</p>
    </div>
  )
}

export default ToastBanner
