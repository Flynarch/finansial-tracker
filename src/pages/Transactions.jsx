import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
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
import { Filter, MoreVertical, Search } from 'lucide-react'
import {
  getCategoryColorClass,
  getTransactionCategoryLabels,
  resolveTransactionIconKey,
} from '../lib/categoryIcon'
import {
  convertCurrency,
  FALLBACK_EXCHANGE_RATES,
  formatCurrency,
  formatMoneyValueForInput,
  isExcludeAnalyticsTx,
  parseMoneyInput,
  toSafeNumber,
} from '../lib/utils'
import { exportTransactionsToCsv } from '../lib/exportReports'
import { getLastSeenTxTimestamp, updateLastSeenTxTimestamp } from '../lib/transactionLastSeen'

import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import PageHeader from '../components/ui/PageHeader'
import CustomDatePickerModal from '../components/ui/CustomDatePickerModal'
import ToastBanner from '../components/ui/ToastBanner'
import CategoryPickerModal from '../components/transactions/CategoryPickerModal'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import TransactionDetailSheet from '../components/transactions/TransactionDetailSheet'
import ReceiptPreviewModal from '../components/transactions/ReceiptPreviewModal'
import { TransactionListSection } from '../components/transactions/TransactionListSection'
import TransactionFilterSheet from '../components/transactions/TransactionFilterSheet'
import TransactionBulkBar from '../components/transactions/TransactionBulkBar'
import SplitBillModal from '../components/split-bill/SplitBillModal'
import StagingReviewInbox from '../components/transactions/StagingReviewInbox'
import { rememberMerchantCategory } from '../lib/ai/merchantCategorizer'

const StatementImportModal = lazy(() => import('../components/transactions/StatementImportModal'))

import {
  getCachedDashboardTransactions,
  setCachedDashboardTransactions,
  getCachedDashboardWallets,
  setCachedDashboardWallets,
} from '../hooks/useDashboardData'

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

  // Local State
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [detailTransaction, setDetailTransaction] = useState(null)
  const [receiptPreviewTx, setReceiptPreviewTx] = useState(null)
  const [singleDeleteTx, setSingleDeleteTx] = useState(null)
  const [editFormData, setEditFormData] = useState(initialFormData)
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
  const [pendingFocusTransactionId, setPendingFocusTransactionId] = useState(null)
  const [highlightedTransactionId, setHighlightedTransactionId] = useState(null)
  const listScrollRef = useRef(null)

  const [selectedViewTab, setSelectedViewTab] = useState(null)
  const isUrlStaging = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('tab') === 'staging' || location.state?.tab === 'staging'
  }, [location.search, location.state])
  const activeViewTab = selectedViewTab ?? (isUrlStaging ? 'staging' : 'all')

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

  // Bulk Actions
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false)
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false)
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false)
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false)
  const [isEntering, setIsEntering] = useState(false)

  // Android Hardware Back Button Handlers
  useBackButton(() => setDetailTransaction(null), Boolean(detailTransaction))
  useBackButton(() => setReceiptPreviewTx(null), Boolean(receiptPreviewTx))
  useBackButton(() => setSingleDeleteTx(null), Boolean(singleDeleteTx))
  useBackButton(() => setEditingTransaction(null), Boolean(editingTransaction))
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

  // Scroll to focused transaction within listScrollRef to avoid outer window scroll displacement
  useEffect(() => {
    if (!pendingFocusTransactionId) return

    const frameId = window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-transaction-id="${pendingFocusTransactionId}"]`)
      if (!row) return
      const container = listScrollRef.current
      if (container) {
        const containerRect = container.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        const targetScrollTop =
          container.scrollTop + (rowRect.top - containerRect.top) - containerRect.height / 2 + rowRect.height / 2
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
      } else {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      setHighlightedTransactionId(pendingFocusTransactionId)
      setPendingFocusTransactionId(null)
      window.setTimeout(() => {
        setHighlightedTransactionId((current) => (current === pendingFocusTransactionId ? null : current))
      }, 1200)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [pendingFocusTransactionId, filteredTransactions.length])

  // Track session last seen timestamp to determine new transactions
  const sessionLastSeenTimestamp = useMemo(() => getLastSeenTxTimestamp(), [])

  useEffect(() => {
    // Commit last seen after 3.5 seconds of active view
    const timer = setTimeout(() => {
      updateLastSeenTxTimestamp()
    }, 3500)

    // Commit when app or tab is backgrounded
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateLastSeenTxTimestamp()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Commit last seen on unmount (user navigated away)
      updateLastSeenTxTimestamp()
    }
  }, [])

  // Grouped entries for TransactionListSection
  const newestTransactionId = useMemo(() => {
    if (!filteredTransactions || filteredTransactions.length === 0) return null
    return filteredTransactions[0]?.id || null
  }, [filteredTransactions])

  const groupedEntriesDetailed = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const grouped = {}
    for (let i = 0; i < filteredTransactions.length; i++) {
      const tx = filteredTransactions[i]
      const key = tx.date || 'unknown'
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(tx)
    }

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
        } catch (err) {
          console.error('[Transactions:formatDate]', err)
          dateLabel = dateKey
        }
      } else {
        dateLabel = t('tx.unknownDate')
      }

      let totalIncome = 0
      let totalExpense = 0

      for (const item of items) {
        if (item.isSplit && Array.isArray(item.splitItems) && item.splitItems.length > 0) {
          for (const si of item.splitItems) {
            const splitTxItem = {
              ...item,
              ...si,
              amount: toSafeNumber(si.amount),
              type: si.type || item.type,
              category: si.category || item.category,
              isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
              excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
              isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
            }
            if (isExcludeAnalyticsTx(splitTxItem)) continue
            const convertedAmount = convertCurrency(
              splitTxItem.amount,
              splitTxItem.currency || item.currency || defaultCurrency,
              defaultCurrency,
              rates
            )
            if (splitTxItem.type === 'income') totalIncome += convertedAmount
            else if (splitTxItem.type === 'expense') totalExpense += convertedAmount
          }
        } else {
          if (isExcludeAnalyticsTx(item)) continue
          const convertedAmount = convertCurrency(
            toSafeNumber(item.amount),
            item.currency || defaultCurrency,
            defaultCurrency,
            rates
          )
          if (item.type === 'income') totalIncome += convertedAmount
          else if (item.type === 'expense') totalExpense += convertedAmount
        }
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
    try {
      for (const id of ids) {
        await deleteTransaction(id)
      }
      clearBulkSelection()
      setIsBatchDeleteModalOpen(false)
    } catch (err) {
      console.error('[Transactions:handleBatchDelete]', err)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setApiError(err?.userMessage || err?.message || (offline ? t('common.error.offline') : t('common.error.saveFailed')))
      setApiErrorTone('error')
      clearBulkSelection()
      setIsBatchDeleteModalOpen(false)
    }
  }

  const handleBatchCategoryChange = async (newCategory) => {
    if (selectedTxIds.size === 0 || !newCategory) return
    const ids = Array.from(selectedTxIds)
    try {
      const selectedTxs = (await db.transactions.where('id').anyOf(ids).toArray()).filter((tx) => !tx.deletedAt)

      const nonSplitIds = []
      let skippedSplitCount = 0

      for (const tx of selectedTxs) {
        if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          skippedSplitCount++
        } else {
          nonSplitIds.push(tx.id)
        }
      }

      if (nonSplitIds.length > 0) {
        await db.transactions.where('id').anyOf(nonSplitIds).modify({ category: newCategory })
      }

      if (skippedSplitCount > 0) {
        setApiError(
          t(
            'tx.batch.splitSkipped',
            'Transaksi split dilewati karena memiliki rincian multi-kategori.'
          )
        )
        setApiErrorTone('warning')
      }

      setIsBatchCategoryModalOpen(false)
      clearBulkSelection()
    } catch (err) {
      console.error('[Transactions:handleBatchCategoryChange]', err)
      setApiError(err?.message || t('common.error.saveFailed'))
      setApiErrorTone('error')
      setIsBatchCategoryModalOpen(false)
      clearBulkSelection()
    }
  }

  // Edit and Duplicate Handlers
  const openEditTransaction = useCallback((transaction) => {
    setEditingTransaction(transaction)
    const matchingWallet = allWallets?.find((w) => String(w.id) === String(transaction.walletId))
    const targetCurrency = transaction.currency || matchingWallet?.currency || defaultCurrency
    const receipt = transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null
    setEditFormData({
      date: transaction.date,
      amount: formatMoneyValueForInput(transaction.amount, targetCurrency),
      type: transaction.type,
      category: transaction.category,
      notes: transaction.notes || '',
      currency: targetCurrency,
      walletId: transaction.walletId,
      targetWalletId: transaction.targetWalletId || '',
      receiptImage: receipt,
      receipt: receipt,
      isSplit: Boolean(transaction.isSplit),
      splitItems: Array.isArray(transaction.splitItems) ? JSON.parse(JSON.stringify(transaction.splitItems)) : [],
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
        receiptImage: editFormData.receiptImage || null,
        isSplit: Boolean(editFormData.isSplit),
        splitItems: editFormData.isSplit && Array.isArray(editFormData.splitItems) ? editFormData.splitItems : undefined,
        isPendingReview: false,
      })

      // If user confirms/edits a transaction from staging, learn the merchant categorization
      if (editFormData.category && editFormData.category !== 'lainnya_kategori/umum' && editFormData.category !== 'lainnya/umum') {
        const merchant = editingTransaction.cleanMerchant || editFormData.notes || editingTransaction.notes || ''
        rememberMerchantCategory(merchant, editFormData.category, editFormData.type)
      }

      setEditingTransaction(null)
    } catch (err) {
      console.error('[Transactions:handleSaveEdit]', err)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setApiError(offline ? t('common.error.offline') : (err?.message || t('common.error.saveFailed')))
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
          isPendingReview: false,
        }
        delete payload.id
        await addTransaction(payload)
        setApiError(t('tx.duplicateSuccess', 'Transaksi berhasil diduplikasi ke hari ini.'))
        setApiErrorTone('success')
      } catch (err) {
        console.error('[Transactions:handleDuplicate]', err)
        setApiError(err?.message || t('common.error.saveFailed', 'Gagal menduplikasi transaksi.'))
        setApiErrorTone('error')
      }
    },
    [addTransaction, t]
  )

  const handleExportCsv = async () => {
    setIsMenuOpen(false)
    await exportTransactionsToCsv(filteredTransactions, allWallets, defaultCurrency, locale)
  }

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        className={`ft-motion-page flex h-full flex-1 min-h-0 flex-col gap-2 overflow-hidden transform-gpu ${
          isEntering ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {apiError ? <ToastBanner message={apiError} tone={apiErrorTone} /> : null}

        {/* Top Bar Header */}
        <PageHeader
          title={t('tx.pageTitle', 'Transaksi')}
          titlePosition="left"
          className="relative z-30 pt-1 !mb-0"
          rightAction={
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
                <Search className="h-4 w-4" />
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
                <Filter className="h-4 w-4" />
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
                      setIsStatementImportOpen(true)
                      setIsMenuOpen(false)
                    }}
                  >
                    {t('tx.menu.importStatement', 'Impor Mutasi / e-Statement')}
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
          }
        />

        {/* View Switcher: Semua Transaksi vs Tampungan */}
        <div className="flex items-center gap-1 rounded-2xl bg-[var(--field-bg)] p-1 border border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={() => setSelectedViewTab('all')}
            className={"flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition active:scale-[0.98] cursor-pointer " + (activeViewTab === 'all' ? "bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs" : "text-[var(--muted)] hover:text-[var(--fg)]")}
          >
            <span>{t('tx.tab.all', 'Semua Transaksi')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedViewTab('staging')}
            className={"flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition active:scale-[0.98] cursor-pointer " + (activeViewTab === 'staging' ? "bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs" : "text-[var(--muted)] hover:text-[var(--fg)]")}
          >
            <span>{t('tx.tab.staging', 'Tampungan')}</span>
            {pendingReviewTxs.length > 0 ? (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-white">
                {pendingReviewTxs.length}
              </span>
            ) : null}
          </button>
        </div>

        {activeViewTab === 'staging' ? (
          <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
            <StagingReviewInbox
              pendingTransactions={pendingReviewTxs}
              wallets={allWallets}
              formatCurrency={formatCurrency}
              defaultCurrency={defaultCurrency}
              locale={locale}
              onEditTransaction={openEditTransaction}
              t={t}
            />
          </div>
        ) : (
          <>
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

            {/* Quick banner if pending mutations exist */}
            {pendingReviewTxs.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3.5 py-2.5 text-[var(--fg)] shrink-0 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
                  <p className="text-xs font-semibold truncate">
                    {t('tx.staging.bannerDesc', 'Ada {{count}} transaksi baru dari notifikasi siap diperiksa.', { count: pendingReviewTxs.length })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedViewTab('staging')}
                  className="shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--accent)] text-white transition active:scale-95 cursor-pointer"
                >
                  {t('tx.staging.reviewNow', 'Tinjau')}
                </button>
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
          onViewDetail={setDetailTransaction}
          onPreviewReceipt={setReceiptPreviewTx}
          onDelete={setSingleDeleteTx}
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
          allWallets={allWallets}
          sessionLastSeenTimestamp={sessionLastSeenTimestamp}
          newestTransactionId={newestTransactionId}
            />
          </>
        )}
      </div>

      {/* Single Delete Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(singleDeleteTx)}
        onClose={() => setSingleDeleteTx(null)}
        onConfirm={async () => {
          if (!singleDeleteTx?.id) return
          const txId = singleDeleteTx.id
          setSingleDeleteTx(null)
          try {
            await deleteTransaction(txId)
            if (swipedTransactionId === txId) setSwipedTransactionId(null)
          } catch (err) {
            console.error('[Transactions:singleDelete]', err)
            const offline = typeof navigator !== 'undefined' && navigator.onLine === false
            setApiError(err?.userMessage || err?.message || (offline ? t('common.error.offline') : t('common.error.saveFailed')))
            setApiErrorTone('error')
          }
        }}
        title={t('tx.item.delete') || 'Hapus Transaksi'}
        message={t('tx.item.deleteConfirm') || 'Apakah Anda yakin ingin menghapus transaksi ini?'}
      />

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={Boolean(receiptPreviewTx)}
        onClose={() => setReceiptPreviewTx(null)}
        imageSrc={
          receiptPreviewTx?.receiptImage ||
          receiptPreviewTx?.receipt ||
          receiptPreviewTx?.receiptUrl ||
          receiptPreviewTx?.image ||
          null
        }
        amountFormatted={
          receiptPreviewTx
            ? `${receiptPreviewTx.type === 'income' ? '+' : '-'}${formatCurrency(
                Math.abs(Number(receiptPreviewTx.amount || 0)),
                receiptPreviewTx.currency || defaultCurrency,
              )}`
            : ''
        }
        date={receiptPreviewTx?.date}
        notes={receiptPreviewTx?.notes}
        category={
          receiptPreviewTx
            ? getTransactionCategoryLabels(receiptPreviewTx.category, receiptPreviewTx.type, locale)?.main
            : ''
        }
        zIndex="z-[60]"
      />

      {/* Transaction Detail BottomSheet */}
      <TransactionDetailSheet
        isOpen={Boolean(detailTransaction)}
        onClose={() => setDetailTransaction(null)}
        transaction={detailTransaction}
        openEditTransaction={(tx) => {
          setDetailTransaction(null)
          openEditTransaction(tx)
        }}
        deleteTransaction={(tx) => {
          const targetTx = tx || detailTransaction
          if (!targetTx?.id) return
          setDetailTransaction(null)
          setSingleDeleteTx(targetTx)
        }}
        wallets={allWallets}
        defaultCurrency={defaultCurrency}
        rates={rates}
        formatCurrency={formatCurrency}
        convertCurrency={convertCurrency}
        locale={locale}
        t={t}
      />

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

      {/* Universal e-Statement & Bank Mutation Import Modal */}
      {hasOpenedStatementImport && (
        <Suspense fallback={null}>
          <StatementImportModal
            isOpen={isStatementImportOpen}
            onClose={() => setIsStatementImportOpen(false)}
            wallets={allWallets}
            existingTransactions={transactions}
            onImportComplete={(count) => {
              setApiError(t('statement.importSuccess', 'Berhasil mengimpor {{count}} transaksi ke dompet.', { count }))
              setApiErrorTone('success')
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

export default Transactions
