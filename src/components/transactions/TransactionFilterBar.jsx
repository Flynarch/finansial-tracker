import { memo } from 'react'

export const TransactionFilterBar = memo(function TransactionFilterBar({
  filters,
  setFilters,
  onOpenFilterModal,
  t,
}) {
  return (
    <div className="sticky top-[68px] z-10 space-y-2 rounded-2xl bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] p-1 backdrop-blur-md">
      <div className="relative">
        <input
          type="text"
          placeholder={t('tx.search.placeholder')}
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value })}
          className="ft-field mt-0 pl-9 pr-11 text-xs sm:text-sm"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer"
          onClick={onOpenFilterModal}
          aria-label={t('tx.filter.open')}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16" strokeLinecap="round" />
            <path d="M7 12h10" strokeLinecap="round" />
            <path d="M10 18h4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1 shadow-2xs">
        {[
          { id: 'all', label: t('tx.filter.all') },
          { id: 'income', label: t('tx.type.income') },
          { id: 'expense', label: t('tx.type.expense') },
        ].map((item) => {
          const isActive = filters.type === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilters({ type: item.id })}
              className={`flex-1 rounded-xl py-1.5 px-3 text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs scale-[1.01]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)]'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
})
