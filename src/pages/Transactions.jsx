import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSwipeAction from '../hooks/useSwipeAction'
import useBackButton from '../hooks/useBackButton'
import { useTransactionFilters } from '../hooks/useTransactionFilters'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore from '../store/useTransactionStore'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { MoreVertical } from 'lucide-react'
import {
  getCategoryColorClass,
  getTransactionCategoryLabels,
  resolveTransactionIconKey,
} from '../lib/categoryIcon'
import {
  convertCurrency,
  downloadTextFile,
  FALLBACK_EXCHANGE_RATES,
  formatCurrency,
  formatMoneyValueForInput,
  parseMoneyInput,
  toTransactionsCsv,
} from '../lib/utils'

import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import CustomDatePickerModal from '../components/ui/CustomDatePickerModal'
import ToastBanner from '../components/ui/ToastBanner'
import CategoryPickerModal from '../components/transactions/CategoryPickerModal'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import { TransactionListSection } from '../components/transactions/TransactionListSection'
import TransactionFilterSheet from '../components/transactions/TransactionFilterSheet'
import TransactionBulkBar from '../components/transactions/TransactionBulkBar'
import SplitBillModal from '../components/split-bill/SplitBillModal'

const initialFormData = {
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  type: 'expense',
  category: '',
  notes: '',
  currency: 'IDR',
}

function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)

  // Live queries from Dexie
  const transactionsRaw = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const dbWallets = useLiveQuery(() => db.wallets.toArray(), [])

  const transactions = useMemo(() => transactionsRaw || [], [transactionsRaw])
  const allWallets = useMemo(() => dbWallets || [], [dbWallets])
  const isInitialLoading = transactionsRaw === undefined

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

  // Local State
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editFormData, setEditFormData] = useState(initialFormData)
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const [apiError, setApiError] = useState('')
  const [apiErrorTone, setApiErrorTone] = useState('error')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [pendingFocusTransactionId, setPendingFocusTransactionId] = useState(null)
  const [highlightedTransactionId, setHighlightedTransactionId] = useState(null)
  const listScrollRef = useRef(null)

  // Bulk Actions
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false)
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false)
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false)
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false)
  const [isEntering, setIsEntering] = useState(false)

  // Android Hardware Back Button Handlers
  useBackButton(() => setIsMenuOpen(false), isMenuOpen)
  useBackButton(() => {
    setSelectedTxIds(new Set())
    setIsBulkMode(false)
  }, isBulkMode)
  useBackButton(() => setIsSearchOpen(false), isSearchOpen)

  // Swipe Actions Hook
  const {
    swipedId: swipedTransactionId,
    setSwipedId: setSwipedTransactionId,
    isSwipingId,
    setIsSwipingId,
    getSwipeHandlers,
  } = useSwipeAction()

  // Rate loading
  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetchedRates = await fetchCurrencyRates('USD')
        setRates(fetchedRates)
        setApiError('')
        setApiErrorTone('error')
      } catch {
        setRates({ ...FALLBACK_EXCHANGE_RATES })
        setApiError(t('tx.apiFallback'))
        setApiErrorTone('warning')
      }
    }
    loadRates()
  }, [defaultCurrency, t])

  // Page entrance animation
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  // Handle focus transaction from navigation state
  useEffect(() => {
    const focusTransactionId = location.state?.focusTransactionId
    if (!focusTransactionId) return

    window.setTimeout(() => {
      setPendingFocusTransactionId(String(focusTransactionId))
      setFilters({
        search: '',
        types: ['income', 'expense', 'transfer'],
        categories: [],
        startDate: '',
        endDate: '',
      })
      navigate(location.pathname, { replace: true, state: null })
    }, 0)
  }, [location.pathname, location.state, navigate, setFilters])

  // Scroll to focused transaction
  useEffect(() => {
    if (!pendingFocusTransactionId) return

    const frameId = window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-transaction-id="${pendingFocusTransactionId}"]`)
      if (!row) return
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setHighlightedTransactionId(pendingFocusTransactionId)
      setPendingFocusTransactionId(null)
      window.setTimeout(() => {
        setHighlightedTransactionId((current) => (current === pendingFocusTransactionId ? null : current))
      }, 1200)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [pendingFocusTransactionId, filteredTransactions.length])

  // Grouped entries for TransactionListSection
  const newestTransactionId = useMemo(() => {
    if (!transactions || transactions.length === 0) return null
    return transactions[0]?.id || null
  }, [transactions])

  const groupedEntriesDetailed = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const grouped = filteredTransactions.reduce((acc, tx) => {
      const key = tx.date || 'unknown'
      return { ...acc, [key]: [...(acc[key] || []), tx] }
    }, {})

    const sortedEntries = Object.entries(grouped).sort((a, b) => String(b[0]).localeCompare(String(a[0])))

    return sortedEntries.map(([dateKey, items]) => {
      let dateLabel
      if (dateKey === todayStr) {
        dateLabel = t('tx.today', 'HARI INI')
      } else if (dateKey === yesterdayStr) {
        dateLabel = t('tx.yesterday', 'KEMARIN')
      } else if (dateKey !== 'unknown') {
        try {
          const dateObj = new Date(`${dateKey}T12:00:00`)
          dateLabel = format(dateObj, 'EEEE, d MMMM yyyy', {
            locale: locale === 'en' ? enUS : idLocale,
          }).toUpperCase()
        } catch {
          dateLabel = dateKey
        }
      } else {
        dateLabel = t('tx.unknownDate')
      }

      let totalIncome = 0
      let totalExpense = 0

      for (const item of items) {
        const convertedAmount = convertCurrency(
          item.amount,
          item.currency || defaultCurrency,
          defaultCurrency,
          rates
        )
        if (item.type === 'income') totalIncome += convertedAmount
        else if (item.type === 'expense') totalExpense += convertedAmount
      }

      const net = totalIncome - totalExpense
      let dailySummaryText = ''
      if (net > 0) {
        dailySummaryText = `+${formatCurrency(net, defaultCurrency)}`
      } else if (net < 0) {
        dailySummaryText = `-${formatCurrency(Math.abs(net), defaultCurrency)}`
      } else if (totalIncome > 0 && totalExpense > 0) {
        dailySummaryText = formatCurrency(0, defaultCurrency)
      } else if (totalExpense > 0) {
        dailySummaryText = `-${formatCurrency(totalExpense, defaultCurrency)}`
      }

      return {
        dateKey,
        items,
        dateLabel,
        dailySummaryText,
        isPositive: net > 0,
      }
    })
  }, [filteredTransactions, locale, defaultCurrency, rates, t])

  const handleScroll = (event) => {
    setSwipedTransactionId(null)
    setIsSwipingId(null)
    const el = event.currentTarget
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
    setShowTopFade(el.scrollTop > 2)
    setShowBottomFade(maxScrollTop - el.scrollTop > 2)
  }

  // Bulk Selection Handlers
  const toggleSelectTx = (id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    const allIds = filteredTransactions.map((t) => t.id)
    setSelectedTxIds(new Set(allIds))
  }

  const clearBulkSelection = () => {
    setSelectedTxIds(new Set())
    setIsBulkMode(false)
  }

  const handleBatchDelete = async () => {
    if (selectedTxIds.size === 0) return
    const ids = Array.from(selectedTxIds)
    for (const id of ids) {
      await deleteTransaction(id)
    }
    clearBulkSelection()
    setIsBatchDeleteModalOpen(false)
  }

  const handleBatchCategoryChange = async (newCategory) => {
    if (selectedTxIds.size === 0 || !newCategory) return
    const ids = Array.from(selectedTxIds)
    await db.transactions.where('id').anyOf(ids).modify({ category: newCategory })
    setIsBatchCategoryModalOpen(false)
    clearBulkSelection()
  }

  // Edit and Duplicate Handlers
  const openEditTransaction = useCallback((transaction) => {
    setEditingTransaction(transaction)
    const matchingWallet = allWallets?.find((w) => String(w.id) === String(transaction.walletId))
    const targetCurrency = transaction.currency || matchingWallet?.currency || defaultCurrency
    setEditFormData({
      date: transaction.date,
      amount: formatMoneyValueForInput(transaction.amount, targetCurrency),
      type: transaction.type,
      category: transaction.category,
      notes: transaction.notes || '',
      currency: targetCurrency,
      walletId: transaction.walletId,
    })
  }, [allWallets, defaultCurrency])

  const handleEditSubmit = async () => {
    if (!editingTransaction?.id) return
    try {
      setApiError('')
      setApiErrorTone('error')
      await updateTransaction(editingTransaction.id, {
        ...editFormData,
        amount: parseMoneyInput(editFormData.amount, editFormData.currency),
      })
      setEditingTransaction(null)
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setApiError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
      setApiErrorTone('error')
    }
  }

  const handleDuplicateTransaction = useCallback(
    async (transaction) => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const payload = {
          ...transaction,
          date: todayStr,
          createdAt: Date.now(),
        }
        delete payload.id
        await addTransaction(payload)
        setApiError(t('tx.duplicateSuccess', 'Transaksi berhasil diduplikasi ke hari ini.'))
        setApiErrorTone('success')
      } catch {
        setApiError(t('common.error.saveFailed', 'Gagal menduplikasi transaksi.'))
        setApiErrorTone('error')
      }
    },
    [addTransaction, t]
  )

  const handleExportCsv = () => {
    const csvContent = toTransactionsCsv(filteredTransactions)
    const filename = `transactions-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
    downloadTextFile(filename, csvContent, 'text/csv;charset=utf-8;')
  }

  return (
    <div>
      <div
        className={`ft-motion-page flex min-h-[calc(100svh_-_64px)] max-h-[calc(100svh_-_64px)] flex-col gap-2 overflow-hidden transform-gpu md:min-h-[calc(100vh_-_65px)] md:max-h-[calc(100vh_-_65px)] ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {apiError ? <ToastBanner message={apiError} tone={apiErrorTone} /> : null}

        {/* Top Bar Header */}
        <section className="relative z-30 flex items-center justify-between gap-3 pt-1">
          <h1 className="ft-display text-xl sm:text-2xl font-black tracking-tight text-[var(--fg)] min-w-0 flex-1 truncate">
            {t('tx.pageTitle', 'Transaksi')}
          </h1>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen((v) => !v)}
              className={`inline-flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
                isSearchOpen || filters.search
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)]'
              }`}
              aria-label={t('tx.search.placeholder') || 'Cari'}
              title={t('tx.search.placeholder', 'Cari Transaksi')}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Filter Modal Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false)
                setIsFilterOpen(true)
              }}
              className={`relative inline-flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
                activeFilterCount > 0
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)]'
              }`}
              aria-label={t('tx.filter.open')}
              title={t('tx.filter.open', 'Filter Lengkap')}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16" strokeLinecap="round" />
                <path d="M7 12h10" strokeLinecap="round" />
                <path d="M10 18h4" strokeLinecap="round" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]" />
              )}
            </button>

            {/* 3-dots Menu */}
            <div className="relative z-50 shrink-0">
              {isMenuOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                  aria-label={t('tx.menu.closeOverlay')}
                  onClick={() => setIsMenuOpen(false)}
                />
              ) : null}
              <button
                type="button"
                className="relative z-50 inline-flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label={t('tx.menu.open')}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <div
                className={`absolute right-0 top-12 z-50 w-52 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-[var(--shadow-card)] transition-all duration-200 ${
                  isMenuOpen
                    ? 'pointer-events-auto scale-100 opacity-100'
                    : 'pointer-events-none scale-95 opacity-0'
                }`}
              >
                <button
                  type="button"
                  className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                  onClick={() => {
                    setIsBulkMode(true)
                    setIsMenuOpen(false)
                  }}
                >
                  {t('tx.menu.bulkEdit', 'Edit Massal (Bulk)')}
                </button>
                <button
                  type="button"
                  className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                  onClick={() => {
                    setIsSplitBillOpen(true)
                    setIsMenuOpen(false)
                  }}
                >
                  {t('tx.menu.splitBill', 'Bagi Tagihan (Split Bill)')}
                </button>
                <button
                  type="button"
                  className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                  onClick={() => {
                    handleExportCsv()
                    setIsMenuOpen(false)
                  }}
                >
                  {t('tx.menu.exportCsv')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Collapsible Search Input */}
        {(isSearchOpen || filters.search) && (
          <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
            <input
              type="text"
              autoFocus
              placeholder={t('tx.search.placeholder') || 'Cari catatan atau kategori...'}
              value={filters.search || ''}
              onChange={(event) => setFilters({ search: event.target.value })}
              className="ft-field mt-0 h-11 pl-9 pr-9 text-xs sm:text-sm bg-[var(--field-bg)] border-[var(--border)] rounded-2xl focus:border-[var(--accent)]"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            {filters.search ? (
              <button
                type="button"
                onClick={() => setFilters({ search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] p-2 min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-90 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        )}

        {/* Transaction List Section Component */}
        <TransactionListSection
          isLoading={isInitialLoading}
          filteredTransactions={filteredTransactions}
          groupedEntriesDetailed={groupedEntriesDetailed}
          listScrollRef={listScrollRef}
          showTopFade={showTopFade}
          showBottomFade={showBottomFade}
          onScroll={handleScroll}
          isBulkMode={isBulkMode}
          selectedTxIds={selectedTxIds}
          toggleSelectTx={toggleSelectTx}
          swipedTransactionId={swipedTransactionId}
          isSwipingId={isSwipingId}
          highlightedTransactionId={highlightedTransactionId}
          openEditTransaction={openEditTransaction}
          deleteTransaction={deleteTransaction}
          onDuplicate={handleDuplicateTransaction}
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
          allWallets={allWallets}
          newestTransactionId={newestTransactionId}
        />
      </div>

      {/* Transaction Edit BottomSheet */}
      <TransactionEditSheet
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        formData={editFormData}
        setFormData={setEditFormData}
        onSubmit={handleEditSubmit}
        t={t}
        locale={locale}
        wallets={allWallets}
      />

      {/* Advanced Filter BottomSheet Modal */}
      <TransactionFilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        userWallets={userWallets}
        usedCategories={usedCategories}
        onOpenDatePickerModal={() => setIsDatePickerModalOpen(true)}
      />

      {/* Bulk Actions Floating Bar */}
      <TransactionBulkBar
        isBulkMode={isBulkMode}
        selectedTxIds={selectedTxIds}
        totalFilteredCount={filteredTransactions.length}
        onSelectAll={selectAllVisible}
        onOpenBatchCategory={() => setIsBatchCategoryModalOpen(true)}
        onOpenBatchDelete={() => setIsBatchDeleteModalOpen(true)}
        onCancel={clearBulkSelection}
      />

      {/* Batch Delete Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        onConfirm={handleBatchDelete}
        title={t('tx.bulk.deleteTitle', 'Hapus Transaksi Terpilih')}
        message={t(
          'tx.bulk.deleteMessage',
          { count: selectedTxIds.size },
          `Apakah Anda yakin ingin menghapus ${selectedTxIds.size} transaksi yang dipilih? Tindakan ini tidak dapat dibatalkan.`
        )}
      />

      {/* Category Picker Modal for Batch Category */}
      <CategoryPickerModal
        isOpen={isBatchCategoryModalOpen}
        txType="expense"
        onClose={() => setIsBatchCategoryModalOpen(false)}
        onSelectCategory={(categoryKey) => {
          handleBatchCategoryChange(categoryKey)
        }}
      />

      {/* Custom Date Picker Modal */}
      <CustomDatePickerModal
        isOpen={isDatePickerModalOpen}
        onClose={() => setIsDatePickerModalOpen(false)}
        startDate={filters.startDate || ''}
        endDate={filters.endDate || ''}
        locale={locale}
        onSelectRange={({ startDate, endDate }) => {
          setFilters({ startDate, endDate })
          setIsDatePickerModalOpen(false)
        }}
      />

      {/* Split Bill Modal */}
      <SplitBillModal
        isOpen={isSplitBillOpen}
        onClose={() => setIsSplitBillOpen(false)}
      />
    </div>
  )
}

export default Transactions
