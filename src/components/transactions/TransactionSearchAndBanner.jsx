/**
 * Collapsible search input and new transactions notification banner for the Transactions page.
 */
export default function TransactionSearchAndBanner({
  isSearchOpen,
  searchQuery,
  onSearchChange,
  pendingReviewCount = 0,
  onOpenStaging,
  t,
}) {
  return (
    <>
      {/* Collapsible Search Input */}
      {(isSearchOpen || searchQuery) && (
        <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
          <input
            type="text"
            autoFocus
            placeholder={t('tx.search.placeholder') || 'Cari catatan atau kategori...'}
            value={searchQuery || ''}
            onChange={(event) => onSearchChange(event.target.value)}
            className="ft-field mt-0 h-11 pl-9 pr-9 text-xs sm:text-sm bg-[var(--field-bg)] border-[var(--border)] rounded-2xl focus:border-[var(--accent)]"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] p-2 min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-90 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      )}

      {/* Quick banner if pending mutations exist */}
      {pendingReviewCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3.5 py-2.5 text-[var(--fg)] shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
            <p className="text-xs font-semibold truncate">
              {t('tx.staging.bannerDesc', 'Ada {{count}} transaksi baru dari notifikasi siap diperiksa.', { count: pendingReviewCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenStaging}
            className="shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--accent)] text-white transition active:scale-95 cursor-pointer"
          >
            {t('tx.staging.reviewNow', 'Tinjau')}
          </button>
        </div>
      )}
    </>
  )
}
