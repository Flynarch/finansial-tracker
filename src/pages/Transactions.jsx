import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import CategoryIcon from '../components/ui/CategoryIcon'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ToastBanner from '../components/ui/ToastBanner'
import CategoryPickerModal from '../components/transactions/CategoryPickerModal'
import { TransactionItemCard } from '../components/transactions/TransactionItemCard'
import useBackButton from '../hooks/useBackButton'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { getCategoryColorClass, getTransactionCategoryLabels, resolveTransactionIconKey } from '../lib/categoryIcon'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import {
  convertCurrency,
  downloadTextFile,
  FALLBACK_EXCHANGE_RATES,
  formatCurrency,
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toTransactionsCsv,
} from '../lib/utils'
import useTranslation from '../hooks/useTranslation'
import useSwipeAction from '../hooks/useSwipeAction'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import useSettingsStore from '../store/useSettingsStore'
import useTransactionStore from '../store/useTransactionStore'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

const initialFormData = {
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  type: 'expense',
  category: '',
  notes: '',
  currency: 'IDR',
}

function TransactionForm({
  t,
  formData,
  setFormData,
  onSubmit,
  submitLabel,
  onCancel,
  showCancel = false,
}) {
  const { locale } = useTranslation()
  const amountInputRef = useRef(null)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!formData.category || !formData.category.trim()) {
          alert(t('addTx.selectCategoryRequired', 'Silakan pilih kategori terlebih dahulu.'))
          return
        }
        onSubmit()
      }}
    >
      <label className="ft-label">
        {t('tx.date')}
        <input
          type="date"
          value={formData.date}
          onChange={(event) =>
            setFormData((prev) => ({
              ...prev,
              date: event.target.value,
            }))
          }
          required
          className="ft-field"
        />
      </label>
      <label className="ft-label">
        {t('tx.amount')}
        <input
          ref={amountInputRef}
          type="text"
          inputMode="numeric"
          value={formData.amount}
          onChange={(event) => {
            const rawValue = event.target.value
            const currency = formData.currency
            const formatted = formatMoneyInput(rawValue, currency)
            const caret = getMoneyInputCaret(rawValue, formatted, event.target.selectionStart, currency)
            setFormData((prev) => ({ ...prev, amount: formatted }))
            window.requestAnimationFrame(() => {
              const el = amountInputRef.current
              if (!el) return
              el.setSelectionRange(caret, caret)
            })
          }}
          required
          className="ft-field"
        />
      </label>
      <label className="ft-label">
        {t('tx.type')}
        <select
          value={formData.type}
          onChange={(event) => {
            const nextType = event.target.value
            setFormData((prev) => ({
              ...prev,
              type: nextType,
              category: prev.type === nextType ? prev.category : '',
            }))
          }}
          className="ft-field"
        >
          <option value="income">{t('tx.type.income')}</option>
          <option value="expense">{t('tx.type.expense')}</option>
        </select>
      </label>
      <div className="ft-label">
        {t('tx.category')}
        <button
          type="button"
          onClick={() => setIsCatModalOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 text-left transition hover:border-[var(--border-strong)] mt-1"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="flex h-7 w-9 shrink-0 items-center justify-center">
              <CategoryIcon icon={resolveTransactionIconKey(formData.category, formData.type)} className="h-5 w-5" />
            </span>
            <span className={`truncate text-sm ${!formData.category ? 'font-normal italic text-[var(--muted)]' : 'font-semibold text-[var(--fg)]'}`}>
              {!formData.category
                ? t('addTx.selectCategory', 'Pilih Kategori...')
                : formData.type === 'expense'
                  ? formatExpenseCategory(formData.category, locale)
                  : formatIncomeCategory(formData.category, locale)}
            </span>
          </div>
          <span className="shrink-0 text-xs font-bold text-[var(--accent)]">{t('tx.change') || 'Ubah'} ›</span>
        </button>
        <CategoryPickerModal
          isOpen={isCatModalOpen}
          onClose={() => setIsCatModalOpen(false)}
          txType={formData.type || 'expense'}
          selectedCategory={formData.category}
          onSelectCategory={(cat) => setFormData((prev) => ({ ...prev, category: cat }))}
        />
      </div>
      <label className="ft-label">
        {t('tx.currency')}
        <select
          value={formData.currency}
          onChange={(event) =>
            setFormData((prev) => ({
              ...prev,
              currency: event.target.value,
              amount: formatMoneyInput(prev.amount, event.target.value),
            }))
          }
          className="ft-field"
        >
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>
      <label className="ft-label md:col-span-2">
        {t('tx.notes')}
        <input
          type="text"
          value={formData.notes}
          onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder={t('tx.notes.placeholder')}
          className="ft-field"
        />
      </label>
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit">{submitLabel}</Button>
        {showCancel ? (
          <Button
            type="button"
            onClick={onCancel}
            className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
          >
            {t('tx.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

// TransactionItemCard is now imported from ../components/transactions/TransactionItemCard

function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const transactionsRaw = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [], [])
  const allWallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const transactions = useMemo(() => transactionsRaw || [], [transactionsRaw])
  const {
    categories,
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
  const [quickRange, setQuickRange] = useState('today')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)
  useBackButton(() => {
    setIsCategoryPickerOpen(false)
    setIsFilterOpen(false)
  }, isFilterOpen)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(null)
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
    if (!confirm(`Hapus ${selectedTxIds.size} transaksi terpilih?`)) return
    const ids = Array.from(selectedTxIds)
    for (const id of ids) {
      await deleteTransaction(id)
    }
    clearBulkSelection()
  }

  const handleBatchCategoryChange = async (newCategory) => {
    if (selectedTxIds.size === 0 || !newCategory) return
    const ids = Array.from(selectedTxIds)
    await db.transactions.where('id').anyOf(ids).modify({ category: newCategory })
    setIsBatchCategoryModalOpen(false)
    clearBulkSelection()
  }

  const [isEntering, setIsEntering] = useState(false)
  const hasInitializedDefaultRange = useRef(false)

  useEffect(() => {
    if (!hasInitializedDefaultRange.current) {
      hasInitializedDefaultRange.current = true
      if (!location.state?.focusTransactionId && !filters.startDate && !filters.endDate) {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const today = `${yyyy}-${mm}-${dd}`
        setFilters({ startDate: today, endDate: today })
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
      setQuickRange(null)
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const searchTarget = `${item.notes ?? ''} ${item.category ?? ''}`.toLowerCase()
      const searchPass = searchTarget.includes(filters.search.toLowerCase())
      const typePass = filters.type === 'all' ? true : item.type === filters.type
      const categoryPass = filters.category === 'all' ? true : item.category === filters.category
      const startPass = filters.startDate ? item.date >= filters.startDate : true
      const endPass = filters.endDate ? item.date <= filters.endDate : true
      return searchPass && typePass && categoryPass && startPass && endPass
    }).sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [filters, transactions])

  const applyQuickRange = (nextRange) => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`

    setQuickRange(nextRange)
    if (nextRange === 'today') {
      setFilters({ startDate: today, endDate: today })
      return
    }
    if (nextRange === 'weekly') {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      const startKey = format(start, 'yyyy-MM-dd')
      setFilters({ startDate: startKey, endDate: today })
      return
    }
    // monthly
    const startKey = `${yyyy}-${mm}-01`
    setFilters({ startDate: startKey, endDate: today })
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
    setEditFormData({
      date: transaction.date,
      amount: formatMoneyValueForInput(transaction.amount, transaction.currency || 'IDR'),
      type: transaction.type,
      category: transaction.category,
      notes: transaction.notes || '',
      currency: transaction.currency || 'IDR',
    })
  }, [])

  const handleExportCsv = () => {
    const csvContent = toTransactionsCsv(filteredTransactions)
    const filename = `transactions-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
    downloadTextFile(filename, csvContent, 'text/csv;charset=utf-8;')
  }

  const totals = filteredTransactions.reduce(
    (accumulator, transaction) => {
      const convertedAmount = convertCurrency(
        transaction.amount,
        transaction.currency || defaultCurrency,
        defaultCurrency,
        rates,
      )
      if (transaction.type === 'income') {
        accumulator.income += convertedAmount
      } else {
        accumulator.expense += convertedAmount
      }
      return accumulator
    },
    { income: 0, expense: 0 },
  )

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const key = tx.date || 'unknown'
      if (!acc[key]) acc[key] = []
      acc[key].push(tx)
      return acc
    }, {})
  }, [filteredTransactions])

  const groupedEntries = useMemo(() => {
    return Object.entries(groupedTransactions).sort((a, b) => String(b[0]).localeCompare(String(a[0])))
  }, [groupedTransactions])

  const groupedEntriesDetailed = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    return groupedEntries.map(([dateKey, items]) => {
      let label = ''
      if (dateKey === todayStr) {
        label = 'HARI INI'
      } else if (dateKey === yesterdayStr) {
        label = 'KEMARIN'
      } else if (dateKey !== 'unknown') {
        try {
          const dateObj = new Date(`${dateKey}T12:00:00`)
          label = format(dateObj, 'EEEE, d MMMM yyyy', {
            locale: locale === 'en' ? enUS : idLocale
          }).toUpperCase()
        } catch {
          label = dateKey
        }
      } else {
        label = t('tx.unknownDate')
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
        dateLabel: label,
        dailySummaryText,
        isPositive: net > 0,
      }
    })
  }, [groupedEntries, locale, defaultCurrency, rates, t])
  // Always keep the list as the scroll container. The page wrapper uses overflow-hidden
  // for layout stability, so letting the list "grow" can make the screen non-scrollable.
  // Kept for future tuning; currently list is always scroll container.
  // eslint-disable-next-line no-unused-vars
  const allowListGrow = false

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

  return (
    <div className="bg-[var(--bg)]">
      <div
        className={`ft-motion-page flex min-h-[calc(100svh_-_64px)] max-h-[calc(100svh_-_64px)] flex-col gap-4 overflow-hidden transform-gpu md:min-h-[calc(100vh_-_65px)] md:max-h-[calc(100vh_-_65px)] ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {apiError ? <ToastBanner message={apiError} tone={apiErrorTone} /> : null}
        <section className="relative z-30 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="ft-display text-2xl font-black tracking-tight text-[var(--fg)] min-w-0 flex-1">{t('tx.pageTitle')}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
              {[
                { id: 'monthly', label: t('tx.range.monthly') },
                { id: 'weekly', label: t('tx.range.weekly') },
                { id: 'today', label: t('tx.range.today') },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyQuickRange(item.id)}
                  className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
                    quickRange === item.id ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="relative z-50">
              {isMenuOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-[1px]"
                  aria-label={t('tx.menu.closeOverlay')}
                  onClick={() => setIsMenuOpen(false)}
                />
              ) : null}
              <button
                type="button"
                className="relative z-50 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95"
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
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98]"
                  onClick={() => {
                    setIsBulkMode(true)
                    setIsMenuOpen(false)
                  }}
                >
                  Edit Massal (Bulk)
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98]"
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

      <Card className="min-w-0 bg-[color-mix(in_srgb,var(--panel-strong)_92%,var(--bg)_8%)]">
        <div className="flex items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-3 gap-2 text-xs sm:text-sm">
            <div className="rounded-xl bg-[var(--field-bg)] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{t('tx.summary.income')}</p>
              <p className="ft-income-text break-all text-[13px] font-semibold tabular-nums sm:text-[15px]">
                {formatCurrency(totals.income, defaultCurrency)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--field-bg)] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{t('tx.summary.expense')}</p>
              <p className="ft-expense-text break-all text-[13px] font-semibold tabular-nums sm:text-[15px]">
                {formatCurrency(totals.expense, defaultCurrency)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--field-bg)] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{t('tx.summary.net')}</p>
              <p
                className={`break-all text-[13px] font-semibold tabular-nums sm:text-[15px] ${
                  totals.income - totals.expense >= 0 ? 'ft-income-text' : 'ft-expense-text'
                }`}
              >
                {formatCurrency(totals.income - totals.expense, defaultCurrency)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="sticky top-[68px] z-10 space-y-2 rounded-2xl bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] p-1 backdrop-blur">
        <div className="relative">
          <input
            type="text"
            placeholder={t('tx.search.placeholder')}
            value={filters.search}
            onChange={(event) => setFilters({ search: event.target.value })}
            className="ft-field mt-0 pl-9 pr-11"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)]"
            onClick={() => {
              setIsMenuOpen(false)
              setIsCategoryPickerOpen(false)
              setDraftFilters({ ...filters })
              setIsFilterOpen(true)
            }}
            aria-label={t('tx.filter.open')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16" strokeLinecap="round" />
              <path d="M7 12h10" strokeLinecap="round" />
              <path d="M10 18h4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
          {[
            { id: 'all', label: t('tx.filter.all') },
            { id: 'income', label: t('tx.type.income') },
            { id: 'expense', label: t('tx.type.expense') },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilters({ type: item.id })}
              className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
                filters.type === item.id
                  ? 'bg-[var(--fg)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

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
                onScroll={(event) => {
                  // Close swipe actions when user scrolls the list.
                  setSwipedTransactionId(null)
                  setIsSwipingId(null)
                  const el = event.currentTarget
                  const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
                  setShowTopFade(el.scrollTop > 2)
                  setShowBottomFade(maxScrollTop - el.scrollTop > 2)
                }}
              >
                <div className="min-h-full space-y-4 p-1 pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
                {groupedEntriesDetailed.map((group) => (
                  <section key={group.dateKey} className="space-y-2">
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-[var(--border)]/40">
                      <span className="text-[11px] font-extrabold tracking-wider text-[var(--muted)] uppercase">
                        {group.dateLabel}
                      </span>
                      {group.dailySummaryText ? (
                        <span className={`text-[11px] font-extrabold tabular-nums ${group.isPositive ? 'text-green-600 dark:text-green-400' : 'text-[var(--muted)]'}`}>
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

      </div>

      <Modal
        isOpen={Boolean(editingTransaction)}
        title={t('tx.modal.editTitle')}
        onClose={() => setEditingTransaction(null)}
      >
        <TransactionForm
          t={t}
          formData={editFormData}
          setFormData={setEditFormData}
          categories={categories}
          onSubmit={handleEditSubmit}
          submitLabel={t('tx.modal.update')}
          onCancel={() => setEditingTransaction(null)}
          showCancel
        />
      </Modal>

      <div
        className={`fixed inset-0 z-50 transition-opacity ${
          isFilterOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setIsCategoryPickerOpen(false)
            setIsFilterOpen(false)
          }}
          aria-label={t('tx.filter.close')}
        />
        <div
          className={`absolute inset-x-0 bottom-0 h-[min(78dvh,40rem)] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 ease-out ${
            isFilterOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" />
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--fg)]">{t('tx.filter.title')}</p>
            <button
              type="button"
              className="rounded-xl px-3 py-1 text-sm text-[var(--muted)] hover:bg-[var(--field-bg)]"
              onClick={() => {
                setIsCategoryPickerOpen(false)
                setIsFilterOpen(false)
              }}
            >
              {t('tx.filter.close')}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <label className="ft-label text-xs">
                {t('tx.category')}
                <button
                  type="button"
                  className="ft-field mt-1 flex items-center justify-between gap-2 px-3 py-2"
                  onClick={() => setIsCategoryPickerOpen((v) => !v)}
                  aria-expanded={isCategoryPickerOpen}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {(() => {
                      const categoryValue = draftFilters?.category ?? filters.category
                      return categoryValue === 'all' ? t('tx.filter.allCategories') : String(categoryValue || '')
                    })()}
                  </span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </label>

              {isCategoryPickerOpen ? (
                <div className="absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1 shadow-2xl">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                      draftFilters?.category === 'all' ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--fg)]' : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                    }`}
                    onClick={() => {
                      setDraftFilters((p) => ({ ...(p || filters), category: 'all' }))
                      setIsCategoryPickerOpen(false)
                    }}
                  >
                    <span>{t('tx.filter.allCategories')}</span>
                    {draftFilters?.category === 'all' ? <span className="text-[var(--accent)]">✓</span> : null}
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                        draftFilters?.category === category
                          ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--fg)]'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                      onClick={() => {
                        setDraftFilters((p) => ({ ...(p || filters), category }))
                        setIsCategoryPickerOpen(false)
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{category}</span>
                      {draftFilters?.category === category ? <span className="text-[var(--accent)]">✓</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="ft-label text-xs">
              {t('tx.filter.startDate')}
              <input
                type="date"
                value={draftFilters?.startDate ?? filters.startDate ?? ''}
                onChange={(event) => setDraftFilters((p) => ({ ...(p || filters), startDate: event.target.value }))}
                className="ft-field"
              />
            </label>
            <label className="ft-label text-xs sm:col-span-2">
              {t('tx.filter.endDate')}
              <input
                type="date"
                value={draftFilters?.endDate ?? filters.endDate ?? ''}
                onChange={(event) => setDraftFilters((p) => ({ ...(p || filters), endDate: event.target.value }))}
                className="ft-field"
              />
            </label>
          </div>

          <div className="sticky bottom-0 mt-4 bg-[var(--panel-strong)] pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-2">
            <button
              type="button"
              className="ft-btn-primary w-full"
              onClick={() => {
                if (!draftFilters) return
                setFilters(draftFilters)
                setIsCategoryPickerOpen(false)
                setIsFilterOpen(false)
              }}
            >
              {t('tx.filter.apply')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Floating Bar ────────────────────────── */}
      {isBulkMode && (
        <div className="fixed bottom-16 left-4 right-4 z-40 flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--fg)]">{selectedTxIds.size} Dipilih</span>
            <button
              type="button"
              onClick={selectAllVisible}
              className="rounded-lg bg-[var(--field-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)]"
            >
              Semua ({filteredTransactions.length})
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBatchCategoryModalOpen(true)}
              disabled={selectedTxIds.size === 0}
              className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--border)]/40 disabled:opacity-40"
            >
              Ubah Kategori
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={selectedTxIds.size === 0}
              className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/25 disabled:opacity-40"
            >
              Hapus ({selectedTxIds.size})
            </button>
            <button
              type="button"
              onClick={clearBulkSelection}
              className="rounded-full p-1.5 text-[var(--muted)] hover:text-[var(--fg)] text-xs font-bold"
              title="Batal"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Category Picker Modal for Batch Category ────────────── */}
      <CategoryPickerModal
        isOpen={isBatchCategoryModalOpen}
        txType="expense"
        onClose={() => setIsBatchCategoryModalOpen(false)}
        onSelectCategory={(categoryKey) => {
          handleBatchCategoryChange(categoryKey)
        }}
      />
    </div>
  )
}

export default Transactions
