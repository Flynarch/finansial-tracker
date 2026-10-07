import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { syncNotificationQueue } from '../lib/notificationIngestion'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSwipeAction from '../hooks/useSwipeAction'
import useBackButton from '../hooks/useBackButton'
import { useTransactionFilters } from '../hooks/useTransactionFilters'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore from '../store/useTransactionStore'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import {
  getCategoryColorClass,
  getTransactionCategoryLabels,
  resolveTransactionIconKey,
} from '../lib/categoryIcon'
import {
  convertCurrency,
  FALLBACK_EXCHANGE_RATES,
  formatCurrency,
} from '../lib/utils'
import { exportTransactionsToCsv } from '../lib/exportReports'
import { updateLastSeenTxTimestamp } from '../lib/transactionLastSeen'
import { warmupDecryptionCache } from '../lib/fieldEncryption'

import ToastBanner from '../components/ui/ToastBanner'
import { TransactionListSection } from '../components/transactions/TransactionListSection'
import TransactionHeaderActions from '../components/transactions/TransactionHeaderActions'
import TransactionModalsManager from '../components/transactions/TransactionModalsManager'
import TransactionViewTabs from '../components/transactions/TransactionViewTabs'
import TransactionStagingTab from '../components/transactions/TransactionStagingTab'
import TransactionSearchAndBanner from '../components/transactions/TransactionSearchAndBanner'
import { groupTransactionsDetailed } from '../components/transactions/transactionDateGrouping'
import { useTransactionBatchActions } from '../components/transactions/useTransactionBatchActions'
import { useTransactionEditForm } from '../components/transactions/useTransactionEditForm'
import { useSingleDeleteTransaction } from '../components/transactions/useSingleDeleteTransaction'
import { useTransactionFocusScroll } from '../components/transactions/useTransactionFocusScroll'

import {
  getCachedDashboardTransactions,
  setCachedDashboardTransactions,
  getCachedDashboardWallets,
  setCachedDashboardWallets,
  clearCachedDashboardState,
} from '../hooks/useDashboardData'
import { scheduleNativeWidgetSync } from '../lib/nativeWidgetSync'

function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const clearUnviewedMutations = useSettingsStore((state) => state.clearUnviewedMutations)

  // Live queries from Dexie with zero-latency memory cache fallback
  const transactionsRaw = useLiveQuery(async () => {
    const list = await db.transactions.orderBy('date').reverse().toArray()
    return (list || []).filter((tx) => !tx.deletedAt)
  }, [])
  const dbWallets = useLiveQuery(() => db.wallets.toArray(), [])

  useEffect(() => {
    if (transactionsRaw) {
      setCachedDashboardTransactions(transactionsRaw)
      if (transactionsRaw.length > 0) {
        warmupDecryptionCache(transactionsRaw)
      }
    }
  }, [transactionsRaw])

  useEffect(() => {
    if (dbWallets) {
      setCachedDashboardWallets(dbWallets)
    }
  }, [dbWallets])

  const transactions = useMemo(() => {
    let list = []
    if (transactionsRaw !== undefined) list = transactionsRaw
    else {
      const dashboardTxs = getCachedDashboardTransactions?.()
      if (dashboardTxs && dashboardTxs.length > 0) list = dashboardTxs
    }
    return list.filter((tx) => !tx.deletedAt)
  }, [transactionsRaw])

  const allWallets = useMemo(() => {
    if (dbWallets !== undefined) return dbWallets
    const dashboardWallets = getCachedDashboardWallets?.()
    if (dashboardWallets && dashboardWallets.length > 0) return dashboardWallets
    return []
  }, [dbWallets])

  const pendingReviewTxs = useMemo(() => {
    return transactions.filter((tx) => tx.isPendingReview === true || tx.isPendingReview === 1)
  }, [transactions])

  const isInitialLoading =
    transactionsRaw === undefined &&
    (!getCachedDashboardTransactions?.() || getCachedDashboardTransactions().length === 0)

  // Filter Engine Hook
  const {
    filters,
    setFilters,
    filteredTransactions,
    activeFilterCount,
    usedCategories,
    userWallets,
  } = useTransactionFilters(transactions, allWallets)

  // Store actions
  const addTransaction = useTransactionStore((state) => state.addTransaction)
  const updateTransaction = useTransactionStore((state) => state.updateTransaction)
  const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)

  // Local UI State
  const [detailTransaction, setDetailTransaction] = useState(null)
  const [receiptPreviewTx, setReceiptPreviewTx] = useState(null)
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const [apiError, setApiError] = useState('')
  const [apiErrorTone, setApiErrorTone] = useState('error')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isStatementImportOpen, setIsStatementImportOpen] = useState(false)
  const [hasOpenedStatementImport, setHasOpenedStatementImport] = useState(false)
  if (isStatementImportOpen && !hasOpenedStatementImport) {
    setHasOpenedStatementImport(true)
  }
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false)
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const listScrollRef = useRef(null)
  const stagingScrollRef = useRef(null)

  const [selectedViewTab, setSelectedViewTab] = useState(null)
  const isUrlStaging = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('tab') === 'staging' || location.state?.tab === 'staging'
  }, [location.search, location.state])
  const activeViewTab = selectedViewTab ?? (isUrlStaging ? 'staging' : 'all')

  // Swipe Actions Hook
  const {
    swipedId: swipedTransactionId,
    setSwipedId: setSwipedTransactionId,
    isSwipingId,
    setIsSwipingId,
    getSwipeHandlers,
  } = useSwipeAction()

  // Batch actions hook
  const {
    isBulkMode,
    setIsBulkMode,
    selectedTxIds,
    isBatchCategoryModalOpen,
    setIsBatchCategoryModalOpen,
    isBatchDeleteModalOpen,
    setIsBatchDeleteModalOpen,
    toggleSelectTx,
    selectAllVisible,
    clearBulkSelection,
    handleBatchDelete,
    handleBatchCategoryChange,
  } = useTransactionBatchActions({
    filteredTransactions,
    deleteTransaction,
    t,
    setApiError,
    setApiErrorTone,
  })

  // Edit form hook
  const {
    editingTransaction,
    setEditingTransaction,
    editFormData,
    setEditFormData,
    openEditTransaction,
    handleEditSubmit,
    handleDuplicateTransaction,
  } = useTransactionEditForm({
    allWallets,
    defaultCurrency,
    addTransaction,
    updateTransaction,
    t,
    setApiError,
    setApiErrorTone,
  })

  // Single delete hook
  const {
    singleDeleteTx,
    setSingleDeleteTx,
    handleConfirmSingleDelete,
  } = useSingleDeleteTransaction({
    deleteTransaction,
    swipedTransactionId,
    setSwipedTransactionId,
    t,
    setApiError,
    setApiErrorTone,
  })

  // Focus transaction scroll and session last seen timestamp
  const {
    highlightedTransactionId,
    sessionLastSeenTimestamp,
  } = useTransactionFocusScroll({
    location,
    navigate,
    setFilters,
    listScrollRef,
    filteredTransactionsCount: filteredTransactions.length,
  })

  // Sync native notification queue on mount if on native platform
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const currentSettings = useSettingsStore.getState()
      syncNotificationQueue({
        defaultCurrency: currentSettings.defaultCurrency,
        defaultWalletId: currentSettings.defaultWalletId,
        notificationAutoApprove: currentSettings.notificationAutoApprove,
      }).catch((err) => console.warn('[Transactions:syncNotificationQueue]', err))
    }
  }, [])

  // Android Hardware Back Button Handlers
  useBackButton(() => setIsMenuOpen(false), isMenuOpen)
  useBackButton(() => {
    clearBulkSelection()
  }, isBulkMode)
  useBackButton(() => setIsSearchOpen(false), isSearchOpen)

  // Rate loading
  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
        setApiError('')
        setApiErrorTone('error')
      } catch (err) {
        console.error('[Transactions:loadRates]', err)
        setRates({ ...FALLBACK_EXCHANGE_RATES })
        setApiError(t('tx.apiFallback'))
        setApiErrorTone('warning')
      }
    }
    loadRates()
  }, [defaultCurrency, t])

  // Page entrance animation, scroll reset & clear mutation badge
  useEffect(() => {
    window.scrollTo(0, 0)
    clearUnviewedMutations?.()
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [clearUnviewedMutations])

  // Grouped entries for TransactionListSection
  const newestTransactionId = useMemo(() => {
    if (!filteredTransactions || filteredTransactions.length === 0) return null
    return filteredTransactions[0]?.id || null
  }, [filteredTransactions])

  const groupedEntriesDetailed = useMemo(() => {
    return groupTransactionsDetailed(filteredTransactions, {
      locale,
      defaultCurrency,
      rates,
      t,
    })
  }, [filteredTransactions, locale, defaultCurrency, rates, t])

  const scrollRafRef = useRef(null)
  const handleScroll = useCallback((event) => {
    if (swipedTransactionId !== null) setSwipedTransactionId(null)
    if (isSwipingId !== null) setIsSwipingId(null)

    const el = event.currentTarget
    if (!el) return
    if (scrollRafRef.current) return

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
      const nextTop = el.scrollTop > 2
      const nextBottom = maxScrollTop - el.scrollTop > 2
      setShowTopFade((prev) => (prev !== nextTop ? nextTop : prev))
      setShowBottomFade((prev) => (prev !== nextBottom ? nextBottom : prev))
    })
  }, [swipedTransactionId, isSwipingId, setSwipedTransactionId, setIsSwipingId])

  const handleExportCsv = async () => {
    setIsMenuOpen(false)
    await exportTransactionsToCsv(filteredTransactions, allWallets, defaultCurrency, locale)
  }

  const handleRefresh = useCallback(async () => {
    try {
      clearCachedDashboardState()
      await Promise.allSettled([
        fetchCurrencyRates(defaultCurrency || 'USD'),
        scheduleNativeWidgetSync(),
        syncNotificationQueue(),
      ])
      updateLastSeenTxTimestamp()
    } catch (err) {
      console.warn('[Transactions:handleRefresh]', err)
    }
  }, [defaultCurrency])

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        className={`ft-motion-page flex h-full flex-1 min-h-0 flex-col gap-2 overflow-hidden transform-gpu ${
          isEntering ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {apiError ? <ToastBanner message={apiError} tone={apiErrorTone} /> : null}

        {/* Top Bar Header */}
        <TransactionHeaderActions
          t={t}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          hasSearchQuery={Boolean(filters.search)}
          activeFilterCount={activeFilterCount}
          onOpenFilter={() => {
            setIsMenuOpen(false)
            setIsFilterOpen(true)
          }}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          onOpenBulkMode={() => setIsBulkMode(true)}
          onOpenSplitBill={() => setIsSplitBillOpen(true)}
          onOpenStatementImport={() => setIsStatementImportOpen(true)}
          onExportCsv={handleExportCsv}
        />

        {/* View Switcher: Semua Transaksi vs Tampungan */}
        <TransactionViewTabs
          activeViewTab={activeViewTab}
          onSelectTab={setSelectedViewTab}
          pendingReviewCount={pendingReviewTxs.length}
          t={t}
        />

        {activeViewTab === 'staging' ? (
          <TransactionStagingTab
            stagingScrollRef={stagingScrollRef}
            pendingReviewTxs={pendingReviewTxs}
            allWallets={allWallets}
            formatCurrency={formatCurrency}
            defaultCurrency={defaultCurrency}
            locale={locale}
            onEditTransaction={openEditTransaction}
            onRefresh={handleRefresh}
            t={t}
          />
        ) : (
          <>
            <TransactionSearchAndBanner
              isSearchOpen={isSearchOpen}
              searchQuery={filters.search}
              onSearchChange={(search) => setFilters({ search })}
              pendingReviewCount={pendingReviewTxs.length}
              onOpenStaging={() => setSelectedViewTab('staging')}
              t={t}
            />

            {/* Transaction List Section Component */}
            <TransactionListSection
              isLoading={isInitialLoading}
              filteredTransactions={filteredTransactions}
              groupedEntriesDetailed={groupedEntriesDetailed}
              listScrollRef={listScrollRef}
              showTopFade={showTopFade}
              showBottomFade={showBottomFade}
              onScroll={handleScroll}
              onRefresh={handleRefresh}
              isBulkMode={isBulkMode}
              selectedTxIds={selectedTxIds}
              toggleSelectTx={toggleSelectTx}
              swipedTransactionId={swipedTransactionId}
              isSwipingId={isSwipingId}
              highlightedTransactionId={highlightedTransactionId}
              openEditTransaction={openEditTransaction}
              deleteTransaction={deleteTransaction}
              onViewDetail={setDetailTransaction}
              onPreviewReceipt={setReceiptPreviewTx}
              onDelete={setSingleDeleteTx}
              onDuplicate={handleDuplicateTransaction}
              setSwipedTransactionId={setSwipedTransactionId}
              getSwipeHandlers={getSwipeHandlers}
              getCategoryColorClass={getCategoryColorClass}
              resolveTransactionIconKey={resolveTransactionIconKey}
              getTransactionCategoryLabels={getTransactionCategoryLabels}
              t={t}
              locale={locale}
              defaultCurrency={defaultCurrency}
              formatCurrency={formatCurrency}
              convertCurrency={convertCurrency}
              rates={rates}
              allWallets={allWallets}
              sessionLastSeenTimestamp={sessionLastSeenTimestamp}
              newestTransactionId={newestTransactionId}
            />
          </>
        )}
      </div>

      {/* Transaction Modals, BottomSheets, and Overlays */}
      <TransactionModalsManager
        singleDeleteTx={singleDeleteTx}
        onCloseSingleDelete={() => setSingleDeleteTx(null)}
        onConfirmSingleDelete={handleConfirmSingleDelete}
        receiptPreviewTx={receiptPreviewTx}
        onCloseReceiptPreview={() => setReceiptPreviewTx(null)}
        detailTransaction={detailTransaction}
        onCloseDetail={() => setDetailTransaction(null)}
        onOpenEditFromDetail={openEditTransaction}
        onDeleteFromDetail={setSingleDeleteTx}
        editingTransaction={editingTransaction}
        onCloseEdit={() => setEditingTransaction(null)}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        onSubmitEdit={handleEditSubmit}
        isFilterOpen={isFilterOpen}
        onCloseFilter={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        userWallets={userWallets}
        usedCategories={usedCategories}
        onOpenDatePickerModal={() => setIsDatePickerModalOpen(true)}
        isBulkMode={isBulkMode}
        selectedTxIds={selectedTxIds}
        totalFilteredCount={filteredTransactions.length}
        onSelectAllVisible={selectAllVisible}
        onOpenBatchCategory={() => setIsBatchCategoryModalOpen(true)}
        onOpenBatchDelete={() => setIsBatchDeleteModalOpen(true)}
        onCancelBulk={clearBulkSelection}
        isBatchDeleteModalOpen={isBatchDeleteModalOpen}
        onCloseBatchDelete={() => setIsBatchDeleteModalOpen(false)}
        onConfirmBatchDelete={handleBatchDelete}
        isBatchCategoryModalOpen={isBatchCategoryModalOpen}
        onCloseBatchCategory={() => setIsBatchCategoryModalOpen(false)}
        onSelectBatchCategory={handleBatchCategoryChange}
        isDatePickerModalOpen={isDatePickerModalOpen}
        onCloseDatePicker={() => setIsDatePickerModalOpen(false)}
        onSelectDateRange={({ startDate, endDate }) => {
          setFilters({ startDate, endDate })
          setIsDatePickerModalOpen(false)
        }}
        isSplitBillOpen={isSplitBillOpen}
        onCloseSplitBill={() => setIsSplitBillOpen(false)}
        isStatementImportOpen={isStatementImportOpen}
        onCloseStatementImport={() => setIsStatementImportOpen(false)}
        hasOpenedStatementImport={hasOpenedStatementImport}
        onImportStatementComplete={(count) => {
          setApiError(t('statement.importSuccess', 'Berhasil mengimpor {{count}} transaksi ke dompet.', { count }))
          setApiErrorTone('success')
        }}
        allWallets={allWallets}
        transactions={transactions}
        defaultCurrency={defaultCurrency}
        rates={rates}
        convertCurrency={convertCurrency}
        locale={locale}
        t={t}
      />
    </div>
  )
}

export default Transactions
