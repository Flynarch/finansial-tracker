import { memo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import { TransactionItemCard } from './TransactionItemCard'

export function TransactionListSkeleton() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto ft-hide-scrollbar px-0.5 space-y-3 pt-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {[1, 2].map((groupKey) => (
          <section key={groupKey} className="space-y-1.5 animate-pulse">
            {/* Shimmer Date Header Strip */}
            <div className="flex items-center gap-2.5 px-1 py-1.5">
              <div className="h-3 w-28 rounded-md bg-[var(--border)]/60" />
              <div className="h-px flex-1 bg-[var(--border)]/40" />
              <div className="h-3 w-16 rounded-md bg-[var(--border)]/40" />
            </div>

            {/* Shimmer Feed Group Card */}
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
              {[1, 2, 3].map((itemKey) => (
                <div key={itemKey} className="flex items-center justify-between p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Shimmer Icon */}
                    <div className="h-10 w-10 shrink-0 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
                    {/* Shimmer Labels */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="h-3.5 w-24 rounded-md bg-[var(--border)]/70" />
                      <div className="h-2.5 w-36 rounded-md bg-[var(--border)]/40" />
                    </div>
                  </div>
                  {/* Shimmer Amount */}
                  <div className="h-4 w-20 rounded-md bg-[var(--border)]/60 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export const TransactionListSection = memo(function TransactionListSection({
  isLoading = false,
  filteredTransactions,
  groupedEntriesDetailed,
  listScrollRef,
  showTopFade,
  showBottomFade,
  onScroll,
  isBulkMode,
  selectedTxIds,
  toggleSelectTx,
  swipedTransactionId,
  isSwipingId,
  highlightedTransactionId,
  openEditTransaction,
  deleteTransaction,
  onDuplicate,
  setSwipedTransactionId,
  getSwipeHandlers,
  getCategoryColorClass,
  resolveTransactionIconKey,
  getTransactionCategoryLabels,
  format,
  t,
  locale,
  defaultCurrency,
  formatCurrency,
  convertCurrency,
  rates,
  setApiError,
  setApiErrorTone,
  allWallets,
  newestTransactionId,
}) {
  const PAGE_CHUNK = 25
  const [prevLength, setPrevLength] = useState(filteredTransactions.length)
  const [visibleGroupCount, setVisibleGroupCount] = useState(PAGE_CHUNK)

  if (prevLength !== filteredTransactions.length) {
    setPrevLength(filteredTransactions.length)
    setVisibleGroupCount(PAGE_CHUNK)
  }

  const handleScrollInternal = (event) => {
    onScroll?.(event)
    const el = event.currentTarget
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
      if (visibleGroupCount < groupedEntriesDetailed.length) {
        setVisibleGroupCount((prev) => Math.min(prev + PAGE_CHUNK, groupedEntriesDetailed.length))
      }
    }
  }

  if (isLoading) {
    return <TransactionListSkeleton />
  }

  if (filteredTransactions.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-6">
        <EmptyState title={t('tx.emptyTitle')} description={t('tx.emptyDesc')} />
      </div>
    )
  }

  const visibleGroups = groupedEntriesDetailed.slice(0, visibleGroupCount)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={listScrollRef}
        className="min-h-0 flex-1 overflow-y-auto ft-hide-scrollbar touch-pan-y overscroll-contain px-0.5"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        onScroll={handleScrollInternal}
      >
        <div className="min-h-full space-y-3 pt-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {visibleGroups.map((group, idx) => (
            <section key={group.dateKey} className="space-y-1.5 ft-stagger-in" style={{ '--stagger': Math.min(idx, 10) }}>
              {/* Date Header Strip */}
              <div className="sticky top-0 z-20 flex items-center gap-2.5 px-1 py-1.5 bg-[var(--bg)]/95 backdrop-blur-xs">
                <span className="text-[11px] font-black tracking-wider text-[var(--muted)] uppercase shrink-0">
                  {group.dateLabel}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]/50" />
                {group.dailySummaryText ? (
                  <span className={`text-[11px] font-black tabular-nums shrink-0 ${
                    group.isPositive ? 'text-[var(--status-income)]' : 'text-[var(--muted)]'
                  }`}>
                    {group.dailySummaryText}
                  </span>
                ) : null}
              </div>

              {/* Feed Group Card */}
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
                {group.items.map((transaction) => (
                  <div key={transaction.id} className="flex items-center">
                    {isBulkMode && (
                      <div className="pl-3 pr-1 py-3 bg-[var(--panel-strong)]">
                        <input
                          type="checkbox"
                          checked={selectedTxIds.has(transaction.id)}
                          onChange={() => toggleSelectTx(transaction.id)}
                          className="h-5 w-5 shrink-0 rounded-md border-[var(--border)] text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <TransactionItemCard
                        transaction={transaction}
                        swipedTransactionId={swipedTransactionId}
                        isSwipingId={isSwipingId}
                        highlightedTransactionId={highlightedTransactionId}
                        openEditTransaction={openEditTransaction}
                        deleteTransaction={deleteTransaction}
                        onDuplicate={onDuplicate}
                        setSwipedTransactionId={setSwipedTransactionId}
                        getSwipeHandlers={getSwipeHandlers}
                        getCategoryColorClass={getCategoryColorClass}
                        resolveTransactionIconKey={resolveTransactionIconKey}
                        getTransactionCategoryLabels={getTransactionCategoryLabels}
                        format={format}
                        t={t}
                        locale={locale}
                        defaultCurrency={defaultCurrency}
                        formatCurrency={formatCurrency}
                        convertCurrency={convertCurrency}
                        rates={rates}
                        setApiError={setApiError}
                        setApiErrorTone={setApiErrorTone}
                        wallets={allWallets}
                        newestTransactionId={newestTransactionId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Progressive Load Indicator / More Groups Button */}
          {visibleGroupCount < groupedEntriesDetailed.length && (
            <div className="flex justify-center pt-2 pb-1">
              <button
                type="button"
                onClick={() => setVisibleGroupCount((prev) => Math.min(prev + PAGE_CHUNK, groupedEntriesDetailed.length))}
                className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
              >
                {t('common.loadMore', 'Tampilkan Lebih Banyak')} ({groupedEntriesDetailed.length - visibleGroupCount} lagi)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top & Bottom Subtle Fade Overlays */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[var(--bg)] to-transparent transition-opacity duration-200 ${
          showTopFade ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--bg)] to-transparent transition-opacity duration-200 ${
          showBottomFade ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
})
