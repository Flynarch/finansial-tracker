import { memo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import PullToRefresh from '../ui/PullToRefresh'
import { TransactionItemCard } from './TransactionItemCard'
import { isTransactionNew } from '../../lib/transactionLastSeen'

export function TransactionListSkeleton() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto ft-hide-scrollbar px-0.5 space-y-4 pt-1 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {[1, 2].map((groupKey) => (
          <section key={groupKey} className="space-y-2">
            {/* Shimmer Date Header Strip */}
            <div className="flex items-center gap-2.5 px-1 py-1">
              <div className="h-3 w-28 ft-skeleton !rounded-md" />
              <div className="h-px flex-1 bg-[var(--border)]/40" />
              <div className="h-3 w-16 ft-skeleton !rounded-md" />
            </div>

            {/* Shimmer Feed Group Card */}
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
              {[1, 2, 3].map((itemKey) => (
                <div key={itemKey} className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Shimmer Icon */}
                    <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
                    {/* Shimmer Labels */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="h-3.5 w-28 ft-skeleton !rounded-lg" />
                      <div className="h-2.5 w-36 ft-skeleton !rounded-md" />
                    </div>
                  </div>
                  {/* Shimmer Amount */}
                  <div className="h-4.5 w-22 ft-skeleton !rounded-lg shrink-0" />
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
  onRefresh,
  isBulkMode,
  selectedTxIds,
  toggleSelectTx,
  swipedTransactionId,
  isSwipingId,
  highlightedTransactionId,
  openEditTransaction,
  deleteTransaction,
  onDelete,
  onViewDetail,
  onPreviewReceipt,
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
  allWallets,
  sessionLastSeenTimestamp,
  newestTransactionId,
}) {
  const PAGE_CHUNK = 25
  const [prevLength, setPrevLength] = useState(filteredTransactions.length)
  const [visibleGroupCount, setVisibleGroupCount] = useState(PAGE_CHUNK)

  // Reset pagination only when list size changes significantly (e.g. filter/search changed),
  // not on single-item mutations (delete/edit/undo) so user does not lose scroll position.
  if (Math.abs(prevLength - filteredTransactions.length) > 2) {
    setPrevLength(filteredTransactions.length)
    setVisibleGroupCount(PAGE_CHUNK)
  } else if (prevLength !== filteredTransactions.length) {
    setPrevLength(filteredTransactions.length)
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
      <PullToRefresh
        onRefresh={onRefresh}
        disabled={!onRefresh}
        className="flex min-h-[46dvh] flex-1 flex-col items-center justify-center py-12 px-4 my-auto w-full"
      >
        <EmptyState
          variant="transactions"
          title={t('tx.emptyTitle', 'Belum Ada Transaksi')}
          description={t('tx.emptyDesc', 'Catat pengeluaran atau pemasukan pertamamu untuk mulai memantau arus kas.')}
        />
      </PullToRefresh>
    )
  }

  const visibleGroups = groupedEntriesDetailed.slice(0, visibleGroupCount)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden w-full">
      <PullToRefresh
        onRefresh={onRefresh}
        disabled={!onRefresh}
        scrollContainerRef={listScrollRef}
        className="flex min-h-0 flex-1 flex-col w-full"
        contentClassName="flex min-h-0 flex-1 flex-col w-full"
      >
        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-y-auto ft-hide-scrollbar touch-pan-y overscroll-contain px-0.5"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onScroll={handleScrollInternal}
        >
        <div className="min-h-full space-y-3 pt-1 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-6">
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
                        onDelete={onDelete}
                        onViewDetail={onViewDetail}
                        onPreviewReceipt={onPreviewReceipt}
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
                        wallets={allWallets}
                        isNew={sessionLastSeenTimestamp ? isTransactionNew(transaction, sessionLastSeenTimestamp) : (newestTransactionId && String(transaction.id) === String(newestTransactionId))}
                        newestTransactionId={newestTransactionId}
                        isBulkMode={isBulkMode}
                        isSelected={selectedTxIds.has(transaction.id)}
                        onToggleSelect={() => toggleSelectTx(transaction.id)}
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
      </PullToRefresh>

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
