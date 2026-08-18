import { format, parseISO, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, Check } from 'lucide-react'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import CustomDatePickerModal from '../components/ui/CustomDatePickerModal'
import ToastBanner from '../components/ui/ToastBanner'
import CategoryPickerModal from '../components/transactions/CategoryPickerModal'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import { TransactionListSection } from '../components/transactions/TransactionListSection'
import useBackButton from '../hooks/useBackButton'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { formatCategoryName, getCategoryColorClass, getTransactionCategoryLabels, resolveTransactionIconKey } from '../lib/categoryIcon'
import {
  convertCurrency,
  downloadTextFile,
  FALLBACK_EXCHANGE_RATES,
  formatCurrency,
  formatMoneyValueForInput,
  parseMoneyInput,
  toTransactionsCsv,
} from '../lib/utils'
import useTranslation from '../hooks/useTranslation'
import useSwipeAction from '../hooks/useSwipeAction'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore from '../store/useTransactionStore'
import useWalletStore from '../store/useWalletStore'

const initialFormData = {
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  type: 'expense',
  category: '',
  notes: '',
  currency: 'IDR',
}

const ALL_TYPES = ['income', 'expense', 'transfer']

function computeFilteredTransactions(transactions, filters, userWalletsCount, usedCategoriesCount) {
  const activeTypes = filters.types
  const isAllTypes = !activeTypes || activeTypes.length === 0 || activeTypes.length === ALL_TYPES.length

  const activeWalletIds = filters.walletIds
  const isAllWallets = !activeWalletIds || activeWalletIds.length === 0 || activeWalletIds.length === userWalletsCount

  const activeCategories = filters.categories
  const isAllCategories = !activeCategories || activeCategories.length === 0 || activeCategories.length === usedCategoriesCount

  const searchLower = (filters.search || '').toLowerCase().trim()
  const startDate = filters.startDate
  const endDate = filters.endDate

  return transactions
    .filter((item) => {
      if (searchLower) {
        const searchTarget = `${item.notes ?? ''} ${item.category ?? ''} ${item.subcategory ?? ''} ${item.rawText ?? ''}`.toLowerCase()
        if (!searchTarget.includes(searchLower)) return false
      }

      if (!isAllTypes && !activeTypes.includes(item.type)) return false

      if (!isAllWallets) {
        const wId = String(item.walletId)
        const twId = String(item.targetWalletId)
        const matchWallet = activeWalletIds.some((id) => String(id) === wId || String(id) === twId)
        if (!matchWallet) return false
      }

      if (!isAllCategories) {
        const itemCat = item.category ? (String(item.category).includes('/') ? String(item.category).split('/')[0].trim() : String(item.category).trim()) : ''
        if (!activeCategories.includes(itemCat)) return false
      }

      if (startDate && item.date < startDate) return false
      if (endDate && item.date > endDate) return false

      return true
    })
    .sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
}

function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const cachedTransactions = useTransactionStore((state) => state.transactions)
  const setStoreTransactions = useTransactionStore((state) => state.setTransactions)
  const transactionsRaw = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const cachedWallets = useWalletStore((state) => state.wallets)
  const setStoreWallets = useWalletStore((state) => state.setWallets)
  const dbWallets = useLiveQuery(() => db.wallets.toArray(), [])

  useEffect(() => {
    if (dbWallets && dbWallets.length > 0 && setStoreWallets) {
      setStoreWallets(dbWallets)
    }
  }, [dbWallets, setStoreWallets])

  const allWallets = useMemo(() => {
    if (dbWallets !== undefined && dbWallets.length > 0) return dbWallets
    if (cachedWallets && cachedWallets.length > 0) return cachedWallets
    return dbWallets || []
  }, [dbWallets, cachedWallets])

  useEffect(() => {
    if (transactionsRaw) {
      setStoreTransactions(transactionsRaw)
    }
  }, [transactionsRaw, setStoreTransactions])

  const transactions = useMemo(() => {
    if (transactionsRaw !== undefined) return transactionsRaw
    if (cachedTransactions && cachedTransactions.length > 0) return cachedTransactions
    return []
  }, [transactionsRaw, cachedTransactions])

  const isInitialLoading = transactionsRaw === undefined && (!cachedTransactions || cachedTransactions.length === 0)
  const {
    filters,
    setFilters,
    updateTransaction,
    deleteTransaction,
  } = useTransactionStore()
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editFormData, setEditFormData] = useState(initialFormData)
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  const [apiError, setApiError] = useState('')
  const [apiErrorTone, setApiErrorTone] = useState('error')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  useBackButton(() => {
    setIsFilterOpen(false)
  }, isFilterOpen)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(null)
  const [draftPeriodPreset, setDraftPeriodPreset] = useState(null)
  const {
    swipedId: swipedTransactionId,
    setSwipedId: setSwipedTransactionId,
    isSwipingId,
    setIsSwipingId,
    getSwipeHandlers,
  } = useSwipeAction()
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [pendingFocusTransactionId, setPendingFocusTransactionId] = useState(null)
  const [highlightedTransactionId, setHighlightedTransactionId] = useState(null)
  const listScrollRef = useRef(null)
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false)
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false)
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false)

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

  useEffect(() => {
    if (isBulkMode) {
      document.body.classList.add('hide-bottom-nav')
    } else {
      document.body.classList.remove('hide-bottom-nav')
    }
    return () => {
      document.body.classList.remove('hide-bottom-nav')
    }
  }, [isBulkMode])

  useEffect(() => {
    if (isFilterOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFilterOpen])

  const [isEntering, setIsEntering] = useState(false)
  const hasInitializedDefaultRange = useRef(false)

  useEffect(() => {
    if (!hasInitializedDefaultRange.current) {
      hasInitializedDefaultRange.current = true
      if (!location.state?.focusTransactionId && !filters.startDate && !filters.endDate) {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate()
        const startKey = `${yyyy}-${mm}-01`
        const endKey = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`
        setFilters({ startDate: startKey, endDate: endKey })
      }
    }
  }, [location.state?.focusTransactionId, filters.startDate, filters.endDate, setFilters])

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

  useEffect(() => {
    if (!isMenuOpen) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    const focusTransactionId = location.state?.focusTransactionId
    if (!focusTransactionId) return

    window.setTimeout(() => {
      setPendingFocusTransactionId(String(focusTransactionId))
      setFilters({
        search: '',
        type: 'all',
        category: 'all',
        startDate: '',
        endDate: '',
      })

      navigate(location.pathname, { replace: true, state: null })
    }, 0)
  }, [location.pathname, location.state, navigate, setFilters])

  const usedCategories = useMemo(() => {
    const set = new Set()
    for (const tx of transactions) {
      if (!tx?.category) continue
      const rawCat = String(tx.category).trim()
      const parentCat = rawCat.includes('/') ? rawCat.split('/')[0].trim() : rawCat
      if (parentCat) set.add(parentCat)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [transactions])

  const userWallets = useMemo(() => {
    return (allWallets || []).filter(w => !w.isArchived)
  }, [allWallets])

  const [activeFilterSection, setActiveFilterSection] = useState('type')

  const toggleTypeFilter = (typeKey) => {
    const currentTypes = draftFilters?.types ?? filters.types ?? ALL_TYPES
    const isCurrentlyAll = currentTypes.length === ALL_TYPES.length
    let nextTypes = []

    if (typeKey === 'all') {
      nextTypes = isCurrentlyAll ? [] : [...ALL_TYPES]
    } else {
      const set = new Set(currentTypes)
      if (set.has(typeKey)) set.delete(typeKey)
      else set.add(typeKey)
      nextTypes = Array.from(set)
    }
    setDraftFilters((p) => ({ ...(p || filters), types: nextTypes }))
  }

  const toggleWalletFilter = (walletIdKey) => {
    const allIds = userWallets.map((w) => String(w.id))
    const currentWallets = (draftFilters?.walletIds ?? filters.walletIds ?? allIds).map(String)
    const isCurrentlyAll = currentWallets.length === allIds.length
    let nextWallets = []

    if (walletIdKey === 'all') {
      nextWallets = isCurrentlyAll ? [] : [...allIds]
    } else {
      const targetStr = String(walletIdKey)
      const set = new Set(currentWallets)
      if (set.has(targetStr)) set.delete(targetStr)
      else set.add(targetStr)
      nextWallets = Array.from(set)
    }
    setDraftFilters((p) => ({ ...(p || filters), walletIds: nextWallets }))
  }

  const toggleCategoryFilter = (catKey) => {
    const currentCats = draftFilters?.categories ?? filters.categories ?? usedCategories
    const isCurrentlyAll = currentCats.length === usedCategories.length
    let nextCats = []

    if (catKey === 'all') {
      nextCats = isCurrentlyAll ? [] : [...usedCategories]
    } else {
      const set = new Set(currentCats)
      if (set.has(catKey)) set.delete(catKey)
      else set.add(catKey)
      nextCats = Array.from(set)
    }
    setDraftFilters((p) => ({ ...(p || filters), categories: nextCats }))
  }

  const filteredTransactions = computeFilteredTransactions(
    transactions,
    filters,
    userWallets.length,
    usedCategories.length,
  )

  const getDatesForQuickRange = (rangeKey) => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`

    if (rangeKey === 'all') {
      return { startDate: '', endDate: '' }
    }
    if (rangeKey === 'today') {
      return { startDate: today, endDate: today }
    }
    if (rangeKey === 'monthly') {
      const startKey = `${yyyy}-${mm}-01`
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate()
      const endKey = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`
      return { startDate: startKey, endDate: endKey }
    }
    return { startDate: '', endDate: '' }
  }

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
    })
  }, [allWallets, defaultCurrency])

  const handleExportCsv = () => {
    const csvContent = toTransactionsCsv(filteredTransactions)
    const filename = `transactions-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
    downloadTextFile(filename, csvContent, 'text/csv;charset=utf-8;')
  }

  const newestTransactionId = useMemo(() => {
    if (!transactions || transactions.length === 0) return null
    const sorted = [...transactions].sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
    return sorted[0]?.id || null
  }, [transactions])

  const groupedEntries = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc, tx) => {
      const key = tx.date || 'unknown'
      return { ...acc, [key]: [...(acc[key] || []), tx] }
    }, {})
    return Object.entries(grouped).sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  }, [filteredTransactions])

  const groupedEntriesDetailed = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    return groupedEntries.map(([dateKey, items]) => {
      let dateLabel
      if (dateKey === todayStr) {
        dateLabel = 'HARI INI'
      } else if (dateKey === yesterdayStr) {
        dateLabel = 'KEMARIN'
      } else if (dateKey !== 'unknown') {
        try {
          const dateObj = new Date(`${dateKey}T12:00:00`)
          dateLabel = format(dateObj, 'EEEE, d MMMM yyyy', {
            locale: locale === 'en' ? enUS : idLocale
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
          rates,
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
  }, [groupedEntries, locale, defaultCurrency, rates, t])

  useEffect(() => {
    const el = listScrollRef.current
    if (!el) return
    const rafId = window.requestAnimationFrame(() => {
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
      setShowTopFade(el.scrollTop > 2)
      setShowBottomFade(maxScrollTop - el.scrollTop > 2)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [filteredTransactions.length, groupedEntries.length])

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
  }, [pendingFocusTransactionId, groupedEntries, filteredTransactions.length])

  const handleScroll = (event) => {
    setSwipedTransactionId(null)
    setIsSwipingId(null)
    const el = event.currentTarget
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
    setShowTopFade(el.scrollTop > 2)
    setShowBottomFade(maxScrollTop - el.scrollTop > 2)
  }

  const datesMonthly = getDatesForQuickRange('monthly')
  const hasActiveFilters = Boolean(
    (filters.types && filters.types.length > 0 && filters.types.length < 3) ||
    (filters.categories && filters.categories.length > 0) ||
    (filters.walletIds && filters.walletIds.length > 0) ||
    (filters.startDate && filters.startDate !== datesMonthly.startDate) ||
    (filters.endDate && filters.endDate !== datesMonthly.endDate)
  )

  return (
    <div className="bg-[var(--bg)]">
      <div
        className={`ft-motion-page flex min-h-[calc(100svh_-_64px)] max-h-[calc(100svh_-_64px)] flex-col gap-2 overflow-hidden transform-gpu md:min-h-[calc(100vh_-_65px)] md:max-h-[calc(100vh_-_65px)] ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {apiError ? <ToastBanner message={apiError} tone={apiErrorTone} /> : null}

        {/* Top Bar Header */}
        <section className="relative z-30 flex items-center justify-between gap-3 pt-1">
          <h1 className="ft-display text-2xl font-black tracking-tight text-[var(--fg)] min-w-0 flex-1 truncate">
            {t('tx.pageTitle')}
          </h1>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen((v) => !v)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
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
                setDraftFilters({ ...filters })
                setDraftPeriodPreset(null)
                setIsFilterOpen(true)
              }}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
                hasActiveFilters
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
              {hasActiveFilters && (
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
                className="relative z-50 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label={t('tx.menu.open')}
              >
                ⋯
              </button>
              <div
                className={`absolute right-0 top-11 z-50 w-48 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-2xl transition-all duration-200 ${
                  isMenuOpen
                    ? 'pointer-events-auto scale-100 opacity-100'
                    : 'pointer-events-none scale-95 opacity-0'
                }`}
              >
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer"
                  onClick={() => {
                    setIsBulkMode(true)
                    setIsMenuOpen(false)
                  }}
                >
                  Edit Massal (Bulk)
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer"
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
              className="ft-field mt-0 h-10 pl-9 pr-9 text-xs sm:text-sm bg-[var(--field-bg)] border-[var(--border)] rounded-2xl focus:border-[var(--accent)]"
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] p-1 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        )}

        {/* 3. Transaction List Section Component */}
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

      {/* ── Transaction Edit BottomSheet ────────────────────────── */}
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

      {/* ── Advanced Filter Panel (BottomSheet Overlay) ─────────── */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-250 ease-out ${
          isFilterOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
          onClick={() => {
            setIsFilterOpen(false)
          }}
          aria-label={t('tx.filter.close')}
        />
        <div
          className={`absolute inset-x-0 bottom-0 max-h-[85dvh] flex flex-col rounded-t-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transition-transform duration-380 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform transform-gpu ${
            isFilterOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[var(--border)]/40 bg-[var(--panel-strong)] rounded-t-3xl">
            <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-[var(--border-strong)]/40" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-[var(--fg)] tracking-tight">{t('tx.filter.title')}</p>
              <button
                type="button"
                className="rounded-xl px-3 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition cursor-pointer"
                onClick={() => {
                  setIsFilterOpen(false)
                }}
              >
                {t('tx.filter.close')}
              </button>
            </div>
          </div>

          {/* Middle Body (Single Scroll Container) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3.5 ft-hide-scrollbar">
            {/* 1. Rentang Waktu Accordion */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden transition">
              <button
                type="button"
                onClick={() => setActiveFilterSection((prev) => (prev === 'date' ? null : 'date'))}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">Rentang Waktu</span>
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 rounded-full truncate">
                    {(() => {
                      const curStart = draftFilters?.startDate ?? filters.startDate
                      const curEnd = draftFilters?.endDate ?? filters.endDate
                      const datesToday = getDatesForQuickRange('today')
                      const datesMonthly = getDatesForQuickRange('monthly')

                      let activePreset = draftPeriodPreset
                      if (!activePreset) {
                        if (!curStart && !curEnd) activePreset = 'all'
                        else if (curStart === datesToday.startDate && curEnd === datesToday.endDate) activePreset = 'today'
                        else if (curStart === datesMonthly.startDate && curEnd === datesMonthly.endDate) activePreset = 'monthly'
                        else activePreset = 'custom'
                      }

                      if (activePreset === 'all') return 'Semua'
                      if (activePreset === 'today') return 'Hari ini'
                      if (activePreset === 'monthly') return 'Bulan ini'
                      if (curStart || curEnd) {
                        const startLabel = curStart ? format(parseISO(curStart), 'dd MMM', { locale: locale === 'en' ? enUS : idLocale }) : '...'
                        const endLabel = curEnd ? format(parseISO(curEnd), 'dd MMM', { locale: locale === 'en' ? enUS : idLocale }) : '...'
                        return `${startLabel} - ${endLabel}`
                      }
                      return 'Kustom'
                    })()}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 shrink-0 ${activeFilterSection === 'date' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
              </button>

              {activeFilterSection === 'date' && (
                <div className="border-t border-[var(--border)] p-2 space-y-1.5 bg-[var(--panel-strong)] ft-slide-in">
                  {(() => {
                    const curStart = draftFilters?.startDate ?? filters.startDate
                    const curEnd = draftFilters?.endDate ?? filters.endDate
                    const datesToday = getDatesForQuickRange('today')
                    const datesMonthly = getDatesForQuickRange('monthly')

                    let activePreset = draftPeriodPreset
                    if (!activePreset) {
                      if (!curStart && !curEnd) activePreset = 'all'
                      else if (curStart === datesToday.startDate && curEnd === datesToday.endDate) activePreset = 'today'
                      else if (curStart === datesMonthly.startDate && curEnd === datesMonthly.endDate) activePreset = 'monthly'
                      else activePreset = 'custom'
                    }

                    const periodOptions = [
                      { id: 'today', label: 'Hari ini' },
                      { id: 'monthly', label: 'Bulan ini' },
                      { id: 'all', label: 'Semua' },
                      { id: 'custom', label: 'Kustom (Pilih Tanggal)' },
                    ]

                    return (
                      <>
                        <div className="space-y-1">
                          {periodOptions.map((item) => {
                            const isSelected = activePreset === item.id
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setDraftPeriodPreset(item.id)
                                  if (item.id !== 'custom') {
                                    const dates = getDatesForQuickRange(item.id)
                                    setDraftFilters((p) => ({
                                      ...(p || filters),
                                      startDate: dates.startDate,
                                      endDate: dates.endDate,
                                    }))
                                  }
                                }}
                                className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                                    : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                                }`}
                              >
                                <span>{item.label}</span>
                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center transition shrink-0 ${
                                  isSelected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                                }`}>
                                  {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Custom Date Range Display Card when Custom is active */}
                        {activePreset === 'custom' && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setIsDatePickerModalOpen(true)}
                              className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-[0.99] cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CalendarIcon className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.2} />
                                <div className="flex items-center gap-1.5 min-w-0 text-left">
                                  <span className="truncate">
                                    {curStart
                                      ? format(parseISO(curStart), 'dd MMM yyyy', { locale: locale === 'en' ? enUS : idLocale })
                                      : 'Dari Tanggal'}
                                  </span>
                                  <span className="text-[var(--muted)]">-</span>
                                  <span className="truncate">
                                    {curEnd
                                      ? format(parseISO(curEnd), 'dd MMM yyyy', { locale: locale === 'en' ? enUS : idLocale })
                                      : 'Sampai Tanggal'}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                            </button>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* 2. Jenis Transaksi */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden transition">
              <button
                type="button"
                onClick={() => setActiveFilterSection((prev) => (prev === 'type' ? null : 'type'))}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Jenis Transaksi</span>
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 rounded-full">
                    {(() => {
                      const list = draftFilters?.types ?? filters.types ?? ALL_TYPES
                      if (list.length === 0 || list.length === ALL_TYPES.length) return 'Semua'
                      if (list.length === 1) {
                        return list[0] === 'income' ? 'Pemasukan' : list[0] === 'expense' ? 'Pengeluaran' : 'Transfer'
                      }
                      return `${list.length} Dipilih`
                    })()}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${activeFilterSection === 'type' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
              </button>
              {activeFilterSection === 'type' && (
                <div className="border-t border-[var(--border)] p-2 space-y-1 bg-[var(--panel-strong)] ft-slide-in">
                  {(() => {
                    const list = draftFilters?.types ?? filters.types ?? ALL_TYPES
                    const isAllChecked = list.length === ALL_TYPES.length
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleTypeFilter('all')}
                          className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                            isAllChecked
                              ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                              : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                          }`}
                        >
                          <span>Semua Jenis Transaksi</span>
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                            isAllChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                          }`}>
                            {isAllChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </div>
                        </button>
                        {[
                          { id: 'income', label: 'Pemasukan' },
                          { id: 'expense', label: 'Pengeluaran' },
                          { id: 'transfer', label: 'Transfer (Pindah Saldo)' },
                        ].map((item) => {
                          const isChecked = list.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleTypeFilter(item.id)}
                              className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                                isChecked
                                  ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                                  : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                              }`}
                            >
                              <span>{item.label}</span>
                              <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                                isChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                              }`}>
                                {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                              </div>
                            </button>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* 3. Akun / Dompet */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveFilterSection((prev) => (prev === 'wallet' ? null : 'wallet'))}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Akun / Dompet</span>
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 rounded-full truncate max-w-[120px]">
                    {(() => {
                      const allIds = userWallets.map((w) => String(w.id))
                      const list = (draftFilters?.walletIds ?? filters.walletIds ?? allIds).map(String)
                      if (list.length === 0 || list.length === allIds.length) return 'Semua Akun'
                      if (list.length === 1) {
                        const found = userWallets.find((w) => String(w.id) === list[0])
                        return found ? found.name : '1 Dipilih'
                      }
                      return `${list.length} Dipilih`
                    })()}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${activeFilterSection === 'wallet' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
              </button>
              {activeFilterSection === 'wallet' && (
                <div className="border-t border-[var(--border)] p-2 space-y-1 bg-[var(--panel-strong)] max-h-52 overflow-y-auto overscroll-contain ft-hide-scrollbar ft-slide-in">
                  {(() => {
                    const allIds = userWallets.map((w) => String(w.id))
                    const list = (draftFilters?.walletIds ?? filters.walletIds ?? allIds).map(String)
                    const isAllChecked = list.length === allIds.length
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleWalletFilter('all')}
                          className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                            isAllChecked
                              ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                              : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                          }`}
                        >
                          <span>Semua Akun</span>
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                            isAllChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                          }`}>
                            {isAllChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </div>
                        </button>
                        {userWallets.map((wallet) => {
                          const isChecked = list.includes(String(wallet.id))
                          return (
                            <button
                              key={wallet.id}
                              type="button"
                              onClick={() => toggleWalletFilter(wallet.id)}
                              className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                                isChecked ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]' : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-[var(--panel-strong)] flex items-center justify-center text-[9px] font-black border border-[var(--border)] overflow-hidden shrink-0">
                                  {wallet.logoUrl ? (
                                    <img src={wallet.logoUrl} alt={wallet.name} className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    wallet.name?.substring(0, 2).toUpperCase()
                                  )}
                                </div>
                                <span className="truncate">{wallet.name}</span>
                              </div>
                              <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                                isChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                              }`}>
                                {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                              </div>
                            </button>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* 4. Kategori Utama */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveFilterSection((prev) => (prev === 'category' ? null : 'category'))}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>{t('tx.filter.mainCategory', 'Kategori Utama')}</span>
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 rounded-full truncate max-w-[120px]">
                    {(() => {
                      const list = draftFilters?.categories ?? filters.categories ?? usedCategories
                      if (list.length === 0 || list.length === usedCategories.length) return t('tx.filter.allCategories', 'Semua Kategori')
                      if (list.length === 1) return formatCategoryName(list[0], locale)
                      return t('tx.filter.selectedCount', { count: list.length }, `${list.length} Dipilih`)
                    })()}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${activeFilterSection === 'category' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
              </button>
              {activeFilterSection === 'category' && (
                <div className="border-t border-[var(--border)] grid grid-cols-2 gap-1.5 p-2 bg-[var(--panel-strong)] max-h-60 overflow-y-auto overscroll-contain ft-hide-scrollbar ft-slide-in">
                  {(() => {
                    const list = draftFilters?.categories ?? filters.categories ?? usedCategories
                    const isAllChecked = list.length === usedCategories.length
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleCategoryFilter('all')}
                          className={`col-span-2 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                            isAllChecked
                              ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)] border border-[var(--accent)]/30'
                              : 'text-[var(--fg)] bg-[var(--field-bg)] border border-[var(--border)] hover:bg-[var(--panel)]'
                          }`}
                        >
                          <span>{t('tx.filter.allCategories', 'Semua Kategori')}</span>
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                            isAllChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                          }`}>
                            {isAllChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </div>
                        </button>
                        {usedCategories.map((category) => {
                          const isChecked = list.includes(category)
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => toggleCategoryFilter(category)}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                                isChecked
                                  ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)] border border-[var(--accent)]/30'
                                  : 'text-[var(--fg)] bg-[var(--field-bg)] border border-[var(--border)] hover:bg-[var(--panel)]'
                              }`}
                            >
                              <span className="truncate">{formatCategoryName(category, locale)}</span>
                              <div className={`h-3.5 w-3.5 rounded-md border flex items-center justify-center transition shrink-0 ml-1 ${
                                isChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                              }`}>
                                {isChecked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                              </div>
                            </button>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 p-4 pt-3 bg-[var(--panel-strong)] border-t border-[var(--border)] flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-2.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
              onClick={() => {
                const resetValues = {
                  search: filters.search,
                  types: [...ALL_TYPES],
                  walletIds: userWallets.map((w) => String(w.id)),
                  categories: [...usedCategories],
                  startDate: datesMonthly.startDate,
                  endDate: datesMonthly.endDate,
                }
                setDraftFilters(resetValues)
                setFilters(resetValues)
                setDraftPeriodPreset(null)
                setIsFilterOpen(false)
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="ft-btn-primary flex-1 py-2.5 text-xs font-bold cursor-pointer"
              onClick={() => {
                if (draftFilters) {
                  setFilters(draftFilters)
                }
                setIsFilterOpen(false)
              }}
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Floating Bar ────────────────────────────── */}
      {isBulkMode && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-50 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--fg)]">{selectedTxIds.size} Dipilih</span>
            <button
              type="button"
              onClick={selectAllVisible}
              className="rounded-lg bg-[var(--field-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
            >
              {t('tx.bulk.all', 'Semua')} ({filteredTransactions.length})
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBatchCategoryModalOpen(true)}
              disabled={selectedTxIds.size === 0}
              className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/40 disabled:opacity-40 transition active:scale-95 cursor-pointer"
            >
              {t('tx.bulk.changeCategory', 'Ubah Kategori')}
            </button>
            <button
              type="button"
              onClick={() => setIsBatchDeleteModalOpen(true)}
              disabled={selectedTxIds.size === 0}
              className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/25 disabled:opacity-40 transition active:scale-95 cursor-pointer"
            >
              {t('tx.bulk.delete', 'Hapus')} ({selectedTxIds.size})
            </button>
            <button
              type="button"
              onClick={clearBulkSelection}
              className="rounded-full p-2 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 text-xs font-bold cursor-pointer"
              title={t('tx.bulk.cancel', 'Batal')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Batch Delete Confirm Modal ──────────────────────────── */}
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

      {/* ── Category Picker Modal for Batch Category ────────────── */}
      <CategoryPickerModal
        isOpen={isBatchCategoryModalOpen}
        txType="expense"
        onClose={() => setIsBatchCategoryModalOpen(false)}
        onSelectCategory={(categoryKey) => {
          handleBatchCategoryChange(categoryKey)
        }}
      />

      {/* ── Custom Date Picker Modal ───────────────────────────── */}
      <CustomDatePickerModal
        isOpen={isDatePickerModalOpen}
        onClose={() => setIsDatePickerModalOpen(false)}
        startDate={draftFilters?.startDate ?? filters.startDate ?? ''}
        endDate={draftFilters?.endDate ?? filters.endDate ?? ''}
        locale={locale}
        onSelectRange={({ startDate, endDate }) => {
          setDraftPeriodPreset('custom')
          setDraftFilters((p) => ({ ...(p || filters), startDate, endDate }))
        }}
      />
    </div>
  )
}

export default Transactions
