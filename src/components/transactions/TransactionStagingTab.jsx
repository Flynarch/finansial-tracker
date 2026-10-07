import PullToRefresh from '../ui/PullToRefresh'
import StagingReviewInbox from './StagingReviewInbox'

/**
 * Staging Review Inbox tab wrapper with PullToRefresh.
 */
export default function TransactionStagingTab({
  stagingScrollRef,
  pendingReviewTxs,
  allWallets,
  formatCurrency,
  defaultCurrency,
  locale,
  onEditTransaction,
  onRefresh,
  t,
}) {
  return (
    <PullToRefresh
      onRefresh={onRefresh}
      scrollContainerRef={stagingScrollRef}
      className="flex-1 min-h-0 flex flex-col w-full"
      contentClassName="flex-1 min-h-0 flex flex-col w-full"
    >
      <div
        ref={stagingScrollRef}
        className="flex-1 min-h-0 overflow-y-auto pb-[calc(8.5rem+env(safe-area-inset-bottom))]"
      >
        <StagingReviewInbox
          pendingTransactions={pendingReviewTxs}
          wallets={allWallets}
          formatCurrency={formatCurrency}
          defaultCurrency={defaultCurrency}
          locale={locale}
          onEditTransaction={onEditTransaction}
          onSync={onRefresh}
          t={t}
        />
      </div>
    </PullToRefresh>
  )
}
