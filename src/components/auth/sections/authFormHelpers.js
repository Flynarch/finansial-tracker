export const SUGGESTED_DOMAINS = ['@gmail.com', '@googlemail.com']

export const getInputClasses = (hasError, isLarge = false) => {
  const basePadding = isLarge ? 'pl-10 pr-4 py-2.5 rounded-2xl' : 'pl-9 pr-3 py-2 rounded-xl'
  if (hasError) {
    return `w-full border ${basePadding} text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-rose-500/50 bg-rose-500/[0.025] text-[var(--fg)] ring-2 ring-rose-500/15 focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/25`
  }
  return `w-full border ${basePadding} text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15`
}

export const getPasswordInputClasses = (hasError) => {
  if (hasError) {
    return `w-full rounded-xl border pl-9 pr-9 py-2 text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-rose-500/50 bg-rose-500/[0.025] text-[var(--fg)] ring-2 ring-rose-500/15 focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/25`
  }
  return `w-full rounded-xl border pl-9 pr-9 py-2 text-xs font-semibold placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200 border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15`
}
