/**
 * Fluid sliding pill tab selector between "Semua Transaksi" and "Tampungan" (staging inbox).
 */
export default function TransactionViewTabs({
  activeViewTab,
  onSelectTab,
  pendingReviewCount = 0,
  t,
}) {
  return (
    <div className="relative flex items-center rounded-2xl bg-[var(--field-bg)] p-1 border border-[var(--border)] shrink-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-[var(--panel-strong)] shadow-xs transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: 'calc(50% - 4px)',
          transform: activeViewTab === 'staging' ? 'translateX(100%)' : 'translateX(0)',
        }}
      />
      <button
        type="button"
        onClick={() => onSelectTab('all')}
        className={`relative z-1 flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200 active:scale-[0.98] cursor-pointer ${
          activeViewTab === 'all' ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        <span>{t('tx.tab.all', 'Semua Transaksi')}</span>
      </button>
      <button
        type="button"
        onClick={() => onSelectTab('staging')}
        className={`relative z-1 flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200 active:scale-[0.98] cursor-pointer ${
          activeViewTab === 'staging' ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        <span>{t('tx.tab.staging', 'Tampungan')}</span>
        {pendingReviewCount > 0 ? (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-white">
            {pendingReviewCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}
