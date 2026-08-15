import { memo } from 'react'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import { TransactionItemCard } from './TransactionItemCard'

export const TransactionListSection = memo(function TransactionListSection({
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
  return (
    <Card
      title={t('tx.listTitle', { count: filteredTransactions.length })}
      withDivider
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[color-mix(in_srgb,var(--panel-strong)_92%,var(--bg)_8%)]"
    >
      {filteredTransactions.length === 0 ? (
        <div className="h-full overflow-y-auto ft-hide-scrollbar">
          <EmptyState title={t('tx.emptyTitle')} description={t('tx.emptyDesc')} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={listScrollRef}
              className="min-h-0 flex-1 overflow-y-auto ft-hide-scrollbar touch-pan-y overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              onScroll={onScroll}
            >
              <div className="min-h-full space-y-4 p-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
                {groupedEntriesDetailed.map((group, idx) => (
                  <section key={group.dateKey} className="space-y-2 ft-stagger-in" style={{ '--stagger': idx }}>
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-[var(--border)]/40">
                      <span className="text-[11px] font-extrabold tracking-wider text-[var(--muted)] uppercase">
                        {group.dateLabel}
                      </span>
                      {group.dailySummaryText ? (
                        <span className={`text-[11px] font-extrabold tabular-nums ${group.isPositive ? 'text-[var(--earthy-green)]' : 'text-[var(--muted)]'}`}>
                          {group.dailySummaryText}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((transaction) => (
                        <div key={transaction.id} className="flex items-center gap-2">
                          {isBulkMode && (
                            <input
                              type="checkbox"
                              checked={selectedTxIds.has(transaction.id)}
                              onChange={() => toggleSelectTx(transaction.id)}
                              className="h-5 w-5 shrink-0 rounded-md border-[var(--border)] text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <TransactionItemCard
                              transaction={transaction}
                              swipedTransactionId={swipedTransactionId}
                              isSwipingId={isSwipingId}
                              highlightedTransactionId={highlightedTransactionId}
                              openEditTransaction={openEditTransaction}
                              deleteTransaction={deleteTransaction}
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
              </div>
            </div>
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-[var(--panel-strong)] to-transparent transition-opacity duration-200 ${
                showTopFade ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-[var(--panel-strong)] to-transparent transition-opacity duration-200 ${
                showBottomFade ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        </div>
      )}
    </Card>
  )
})
