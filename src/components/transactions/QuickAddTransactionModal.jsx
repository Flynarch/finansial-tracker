import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Sparkles, Tag, Split, Plus, Trash2, X } from 'lucide-react'
import Button from '../ui/Button'
import CategoryIcon from '../ui/CategoryIcon'
import Modal from '../ui/Modal'
import ToastBanner from '../ui/ToastBanner'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import CustomDatePicker from '../ui/CustomDatePicker'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import {
  getCategoryToneClass,
  getEffectiveCategoryTone,
  getEffectiveIncomeCategoryTone,
  resolveExpenseParentIconKey,
  resolveIncomeParentIconKey,
} from '../../lib/categoryIcon'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import {
  addExpenseParentCategory,
  addExpenseSubcategory,
  EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT,
  formatExpenseCategory,
  getDefaultExpenseCategoryPath,
  getMergedExpenseTree,
  isValidExpenseCategoryPath,
  removeExpenseSubcategory,
  setExpenseCategoryColor,
} from '../../lib/expenseCategories'
import {
  addIncomeParentCategory,
  addIncomeSubcategory,
  formatIncomeCategory,
  getMergedIncomeTree,
  INCOME_CATEGORY_CUSTOM_CHANGED_EVENT,
  isValidIncomeCategoryPath,
  removeIncomeSubcategory,
  setIncomeCategoryColor,
} from '../../lib/incomeCategories'
import { fetchGoldPricePerGramIDR, getGoldPriceHistory, fetchCurrencyRates, getCachedCurrencyRates } from '../../lib/api'
import { db, computeAllWalletBalances } from '../../lib/db'
import { formatMoneyInput, getMoneyInputCaret, parseMoneyInput, toSafeNumber, FALLBACK_EXCHANGE_RATES } from '../../lib/utils'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']
const investmentTypeOptions = ['Emas', 'Crypto', 'Saham']
const investmentSubByType = {
  emas: 'emas',
  crypto: 'crypto',
  saham: 'saham',
}
const GOLD_MIN_GRAM = 0.0001

function getInvestmentNameByType(type) {
  const raw = String(type || '').toLowerCase()
  if (raw === 'emas') return 'Emas'
  if (raw === 'crypto') return 'Crypto'
  if (raw === 'saham') return 'Saham'
  return 'Investasi'
}

function QuickAddTransactionModal({ nonce, isOpen, onClose, initialWalletId }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const addTransaction = useTransactionStore((state) => state.addTransaction)

  const [txType, setTxType] = useState(() => 'expense')
  const [form, setForm] = useState(() => ({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: getDefaultExpenseCategoryPath(),
    notes: '',
    currency: defaultCurrency,
    walletId: initialWalletId || defaultWalletId || '',
    targetWalletId: '',
  }))
  const [investmentForm, setInvestmentForm] = useState(() => ({
    action: 'buy',
    investmentId: '',
    goldInputInAmount: false,
    name: 'Emas',
    type: 'Emas',
    date: format(new Date(), 'yyyy-MM-dd'),
    quantity: '',
    totalValue: '',
    purchasePrice: '',
    purchaseCurrency: defaultCurrency,
    fundingSource: 'balance',
  }))
  const ownedInvestments = useLiveQuery(() => db.investments.toArray(), [], [])
  const rawWallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [], [])
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })

  useEffect(() => {
    fetchCurrencyRates('USD')
      .then((r) => r && setRates(r))
      .catch(() => {})
  }, [])

  const wallets = useMemo(() => {
    return computeAllWalletBalances(rawWallets || [], allTransactions || [], rates)
  }, [rawWallets, allTransactions, rates])

  const [walletModalMode, setWalletModalMode] = useState(null) // null | 'walletId' | 'targetWalletId'
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [isSplit, setIsSplit] = useState(false)
  const [splitItems, setSplitItems] = useState([
    { id: '1', category: 'makanan/restoran', amount: '', notes: '' },
    { id: '2', category: 'belanja/kebutuhan_harian', amount: '', notes: '' },
  ])

  const handleAddTag = (e) => {
    e?.preventDefault?.()
    const clean = tagInput.trim().replace(/^#/, '').toLowerCase()
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove))
  }

  const handleAddSplitItem = () => {
    setSplitItems((prev) => [
      ...prev,
      { id: String(Date.now()), category: getDefaultExpenseCategoryPath(), amount: '', notes: '' },
    ])
  }

  const handleRemoveSplitItem = (idToRemove) => {
    if (splitItems.length <= 2) return
    setSplitItems((prev) => prev.filter((it) => it.id !== idToRemove))
  }

  const handleUpdateSplitItem = (id, field, val) => {
    setSplitItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it)),
    )
  }

  const openQuickLog = useChatStore((s) => s.openQuickLog)

  const handleOpenAiScan = useCallback(() => {
    onClose?.()
    openQuickLog({ autoScan: true })
  }, [onClose, openQuickLog])

  const selectedWallet = useMemo(() => wallets?.find((w) => String(w.id) === String(form.walletId)), [wallets, form.walletId])
  const selectedTargetWallet = useMemo(() => wallets?.find((w) => String(w.id) === String(form.targetWalletId)), [wallets, form.targetWalletId])
  const isCashWallet = useMemo(
    () =>
      Boolean(
        selectedWallet &&
          (selectedWallet.institutionType === 'cash' ||
            selectedWallet.customIcon === 'dollar' ||
            selectedWallet.customIcon === 'cash' ||
            String(selectedWallet.name || '').toLowerCase().includes('cash') ||
            String(selectedWallet.name || '').toLowerCase().includes('tunai')),
      ),
    [selectedWallet],
  )

  const [prevInitialWalletId, setPrevInitialWalletId] = useState(initialWalletId || '')
  const normalizedInitialWalletId = initialWalletId || ''
  if (normalizedInitialWalletId !== prevInitialWalletId) {
    setPrevInitialWalletId(normalizedInitialWalletId)
    const matching = wallets?.find((w) => String(w.id) === String(initialWalletId))
    const nextCurr = matching?.currency || defaultCurrency
    setForm((p) => ({
      ...p,
      walletId: initialWalletId || '',
      currency: nextCurr,
      amount: formatMoneyInput(p.amount, nextCurr),
    }))
  }

  const [categorySheetOpen, setCategorySheetOpen] = useState(() => false)
  const [categorySheetEnter, setCategorySheetEnter] = useState(() => false)

  useBackButton(() => {
    if (walletModalMode) {
      setWalletModalMode(null)
      return
    }
    if (categorySheetOpen) {
      setCategorySheetOpen(false)
      return
    }
    onClose?.()
  }, Boolean(isOpen))
  const [expenseParentId, setExpenseParentId] = useState(() => null)
  const [incomeParentId, setIncomeParentId] = useState(() => null)
  const [categoryEditMode, setCategoryEditMode] = useState(false)
  const [incomeEditMode, setIncomeEditMode] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [newParentName, setNewParentName] = useState('')
  const [, setNewIncomeCatName] = useState('')
  const [categoryCustomVersion, setCategoryCustomVersion] = useState(0)
  const [submitError, setSubmitError] = useState('')
  const [categoryError, setCategoryError] = useState(false)
  const [categoryShaking, setCategoryShaking] = useState(false)
  const categoryButtonRef = useRef(null)
  const [goldAutoPrice, setGoldAutoPrice] = useState(0)
  const [isAmountFocused, setIsAmountFocused] = useState(false)
  const amountInputRef = useRef(null)

  const mergedExpenseTree = useMemo(() => {
    void categoryCustomVersion
    return getMergedExpenseTree()
  }, [categoryCustomVersion])

  const mergedIncomeTree = useMemo(() => {
    void categoryCustomVersion
    return getMergedIncomeTree()
  }, [categoryCustomVersion])
  const ownedInvestmentGroups = useMemo(() => {
    if (!ownedInvestments) return []
    const map = new Map()
    ownedInvestments.forEach((row) => {
      const key = `${String(row.type || '').toLowerCase()}__${String(row.name || '').toLowerCase()}`
      const prev = map.get(key) || {
        key,
        name: row.name,
        type: row.type,
        purchaseCurrency: row.purchaseCurrency || defaultCurrency,
        quantity: 0,
        sourceEntries: [],
      }
      prev.quantity += toSafeNumber(row.quantity)
      prev.sourceEntries.push({
        id: row.id,
        quantity: toSafeNumber(row.quantity),
        purchasePrice: toSafeNumber(row.purchasePrice),
      })
      map.set(key, prev)
    })
    return Array.from(map.values())
  }, [ownedInvestments, defaultCurrency])
  const selectedOwnedInvestment = useMemo(() => {
    if (!investmentForm.investmentId) return null
    return ownedInvestmentGroups.find((row) => row.key === investmentForm.investmentId) || null
  }, [ownedInvestmentGroups, investmentForm.investmentId])

  const syncExpenseParentFromCategory = useCallback((maybePath) => {
    const next = String(maybePath || '')
    if (isValidExpenseCategoryPath(next)) {
      const [pid] = next.split('/')
      if (pid) {
        setExpenseParentId(pid)
        return
      }
    }
    setExpenseParentId(null)
  }, [])

  const syncIncomeParentFromCategory = useCallback((maybePath) => {
    const next = String(maybePath || '')
    if (isValidIncomeCategoryPath(next)) {
      const [pid] = next.split('/')
      if (pid) {
        setIncomeParentId(pid)
        return
      }
    }
    setIncomeParentId(null)
  }, [])

  useEffect(() => {
    const bump = () => setCategoryCustomVersion((v) => v + 1)
    window.addEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, bump)
    window.addEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, bump)
    return () => {
      window.removeEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, bump)
      window.removeEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, bump)
    }
  }, [])

  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      setTxType('expense')
      setCategoryError(false)
      setCategoryShaking(false)
      setSubmitError('')
      setForm((prev) => ({
        ...prev,
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        category: '',
        notes: '',
        currency: defaultCurrency,
        walletId: initialWalletId || (wallets?.length > 0 ? wallets[0].id : ''),
        targetWalletId: '',
      }))
      syncExpenseParentFromCategory('')
      syncIncomeParentFromCategory('')
      setExpenseParentId(null)
      setIncomeParentId(null)
    }
  }

  useEffect(() => {
    if (txType !== 'investment') return
    if (String(investmentForm.type || '').toLowerCase() !== 'emas') return
    let cancelled = false
    const syncGoldPrice = async () => {
      try {
        const next = await fetchGoldPricePerGramIDR()
        if (cancelled) return
        const safe = toSafeNumber(next)
        setGoldAutoPrice(safe)
        setInvestmentForm((p) => ({
          ...p,
          purchaseCurrency: 'IDR',
          purchasePrice: formatMoneyInput(String(Math.round(safe)), 'IDR'),
        }))
      } catch {
        const rows = getGoldPriceHistory()
        const last = toSafeNumber(rows[rows.length - 1]?.price)
        if (!cancelled && last > 0) {
          setGoldAutoPrice(last)
          setInvestmentForm((p) => ({
            ...p,
            purchaseCurrency: 'IDR',
            purchasePrice: formatMoneyInput(String(Math.round(last)), 'IDR'),
          }))
        }
      }
    }
    syncGoldPrice()
    return () => {
      cancelled = true
    }
  }, [txType, investmentForm.type])

  const closeCategorySheet = useCallback(() => {
    setCategoryEditMode(false)
    setIncomeEditMode(false)
    setNewSubName('')
    setNewParentName('')
    setNewIncomeCatName('')
    setCategorySheetEnter(false)
    window.setTimeout(() => setCategorySheetOpen(false), 280)
  }, [])

  const openCategorySheet = () => {
    setCategoryError(false)
    setCategoryShaking(false)
    setSubmitError('')
    setCategoryEditMode(false)
    setIncomeEditMode(false)
    setNewSubName('')
    setNewParentName('')
    setNewIncomeCatName('')
    setCategorySheetOpen(true)
    if (txType === 'expense') syncExpenseParentFromCategory(form.category)
    if (txType === 'income') syncIncomeParentFromCategory(form.category)
    requestAnimationFrame(() => requestAnimationFrame(() => setCategorySheetEnter(true)))
  }

  const activeTree = txType === 'expense' ? mergedExpenseTree : mergedIncomeTree
  const activeParentId = txType === 'expense' ? expenseParentId : incomeParentId
  const setActiveParentId = txType === 'expense' ? setExpenseParentId : setIncomeParentId
  const activeEditMode = txType === 'expense' ? categoryEditMode : incomeEditMode
  const activeParent = useMemo(() => activeTree.find((p) => p.id === activeParentId) || null, [activeTree, activeParentId])
  const resolveParentIcon = txType === 'expense' ? resolveExpenseParentIconKey : resolveIncomeParentIconKey
  const getEffectiveTone = txType === 'expense' ? getEffectiveCategoryTone : getEffectiveIncomeCategoryTone
  const setCatColor = txType === 'expense' ? setExpenseCategoryColor : setIncomeCategoryColor
  const syncParentFromCategory = useCallback((maybePath) => {
    if (txType === 'expense') syncExpenseParentFromCategory(maybePath)
    else syncIncomeParentFromCategory(maybePath)
  }, [txType, syncExpenseParentFromCategory, syncIncomeParentFromCategory])
  const lang = locale === 'en' ? 'en' : 'id'

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setSubmitError('')
      if (txType === 'investment') {
        const effectiveDate = format(new Date(), 'yyyy-MM-dd')
        const selectedType =
          investmentForm.action === 'sell' ? String(selectedOwnedInvestment?.type || investmentForm.type) : investmentForm.type
        const selectedCurrency =
          investmentForm.action === 'sell'
            ? String(selectedOwnedInvestment?.purchaseCurrency || investmentForm.purchaseCurrency || defaultCurrency)
            : investmentForm.purchaseCurrency
        const unitPrice = parseMoneyInput(investmentForm.purchasePrice, selectedCurrency)
        const totalByAmount = parseMoneyInput(investmentForm.totalValue, selectedCurrency)
        const isGold = String(selectedType || '').toLowerCase() === 'emas'
        const quantity =
          isGold && investmentForm.goldInputInAmount
            ? (unitPrice > 0 ? totalByAmount / unitPrice : 0)
            : toSafeNumber(investmentForm.quantity)
        const totalAmount = isGold && investmentForm.goldInputInAmount ? totalByAmount : quantity * unitPrice
        const createdAt = Date.now()
        const side = investmentForm.action === 'sell' ? 'sell' : 'buy'
        const assetType = String(selectedType || '').toLowerCase()
        const investmentSub = investmentSubByType[assetType] || 'investasi_lain'
        if (!(quantity > 0) || !(totalAmount > 0) || !(unitPrice > 0)) throw new Error('invalid investment input')

        if (side === 'buy') {
          const investmentName = getInvestmentNameByType(selectedType)
          const normalizedName = investmentName.toLowerCase()
          const matchRows = (ownedInvestments || []).filter(
            (row) =>
              String(row?.type || '').toLowerCase() === String(selectedType || '').toLowerCase() &&
              String(row?.name || '').toLowerCase() === normalizedName &&
              String(row?.purchaseCurrency || defaultCurrency) === String(selectedCurrency || defaultCurrency),
          )
          if (matchRows.length === 0) {
            await db.investments.add({
              name: investmentName,
              type: selectedType,
              quantity,
              purchasePrice: unitPrice,
              purchaseCurrency: selectedCurrency,
            })
          } else {
            const sorted = matchRows.slice().sort((a, b) => Number(a.id) - Number(b.id))
            const keep = sorted[0]
            const existingQty = sorted.reduce((sum, row) => sum + toSafeNumber(row.quantity), 0)
            const existingCost = sorted.reduce(
              (sum, row) => sum + toSafeNumber(row.quantity) * toSafeNumber(row.purchasePrice),
              0,
            )
            const nextQty = existingQty + quantity
            const nextAvgPrice = nextQty > 0 ? (existingCost + totalAmount) / nextQty : unitPrice
            await db.investments.update(keep.id, {
              name: investmentName || keep.name,
              type: selectedType || keep.type,
              quantity: nextQty,
              purchasePrice: nextAvgPrice,
              purchaseCurrency: selectedCurrency,
            })
            const extraIds = sorted.slice(1).map((row) => row.id)
            if (extraIds.length > 0) {
              await db.investments.bulkDelete(extraIds)
            }
          }
          await db.investmentOrders.add({
            date: effectiveDate,
            createdAt,
            side: 'buy',
            name: investmentName,
            type: selectedType,
            quantity,
            unitPrice,
            totalAmount,
            currency: selectedCurrency,
            fundingSource: investmentForm.fundingSource,
          })
          if (investmentForm.fundingSource === 'balance') {
            await addTransaction({
              date: effectiveDate,
              amount: totalAmount,
              type: 'expense',
              category: `investasi_pengeluaran/${investmentSub}`,
              notes: `Buy ${investmentName}`,
              currency: selectedCurrency,
              createdAt,
            })
          }
        } else {
          if (!selectedOwnedInvestment) throw new Error('investment not found')
          const ownedQty = toSafeNumber(selectedOwnedInvestment.quantity)
          if (!(quantity > 0) || quantity > ownedQty) throw new Error('invalid sell qty')
          let remaining = quantity
          const sourceEntries = (selectedOwnedInvestment.sourceEntries || []).slice().sort((a, b) => Number(a.id) - Number(b.id))
          for (const source of sourceEntries) {
            if (remaining <= 0) break
            const sourceQty = toSafeNumber(source.quantity)
            const taken = Math.min(sourceQty, remaining)
            const nextQty = sourceQty - taken
            remaining -= taken
            if (nextQty <= 0.0000001) {
              await db.investments.delete(source.id)
            } else {
              await db.investments.update(source.id, { quantity: nextQty })
            }
          }
          await db.investmentOrders.add({
            date: effectiveDate,
            createdAt,
            side: 'sell',
            name: selectedOwnedInvestment.name,
            type: selectedOwnedInvestment.type,
            quantity,
            unitPrice,
            totalAmount,
            currency: selectedCurrency,
            fundingSource: investmentForm.fundingSource,
          })
          if (investmentForm.fundingSource === 'balance') {
            await addTransaction({
              date: effectiveDate,
              amount: totalAmount,
              type: 'income',
              category: `investasi/${investmentSub}`,
              notes: `Sell ${selectedOwnedInvestment.name}`,
              currency: selectedCurrency,
              createdAt,
            })
          }
        }
      } else {
        if (txType !== 'transfer' && (!form.category || !form.category.trim())) {
          setCategoryError(true)
          setCategoryShaking(true)
          setSubmitError('')
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([30, 50, 30])
            } catch {
              // ignore
            }
          }
          categoryButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          setTimeout(() => setCategoryShaking(false), 500)
          return
        }
        if (!form.walletId) {
          setSubmitError('Silakan pilih wallet terlebih dahulu.')
          return
        }
        if (txType === 'transfer') {
          if (!form.targetWalletId) {
            setSubmitError(t('tx.selectTargetWallet', 'Silakan pilih wallet tujuan.'))
            return
          }
          if (String(form.walletId) === String(form.targetWalletId)) {
            setSubmitError(t('tx.sameWalletTransfer', 'Wallet asal dan tujuan tidak boleh sama.'))
            return
          }
        }
        
        let totalAmount = parseMoneyInput(form.amount, form.currency)
        let resolvedCategory = txType === 'transfer' ? 'transfer' : form.category
        let formattedSplitItems = []

        if (txType === 'expense' && isSplit) {
          formattedSplitItems = splitItems
            .map((it) => ({
              category: it.category,
              amount: parseMoneyInput(it.amount, form.currency),
              notes: (it.notes || '').trim(),
            }))
            .filter((it) => it.amount > 0)

          if (formattedSplitItems.length < 2) {
            setSubmitError('Split transaksi membutuhkan minimal 2 pembagian kategori dengan nominal > 0.')
            return
          }

          const splitSum = formattedSplitItems.reduce((acc, it) => acc + it.amount, 0)
          totalAmount = splitSum
          resolvedCategory = formattedSplitItems[0].category
        }

        await addTransaction({
          date: form.date,
          amount: totalAmount,
          type: txType,
          category: resolvedCategory,
          notes: form.notes.trim() || '',
          currency: form.currency,
          walletId: form.walletId,
          ...(txType === 'transfer' ? { targetWalletId: form.targetWalletId } : {}),
          ...(tags.length > 0 ? { tags } : {}),
          ...(txType === 'expense' && isSplit && formattedSplitItems.length >= 2
            ? { isSplit: true, splitItems: formattedSplitItems }
            : {}),
        })
      }
      onClose()
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setSubmitError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
    }
  }

  const modeAccent =
    txType === 'income'
      ? 'var(--income)'
      : txType === 'expense'
      ? 'var(--expense)'
      : txType === 'transfer'
      ? '#2563eb'
      : 'var(--accent)'

  return (
    <Modal key={nonce} isOpen={isOpen} title={t('addTx.title')} onClose={onClose}>
      {/* Visual Drag Handle */}
      <div className="flex justify-center -mt-2 mb-3">
        <div className="h-1 w-9 shrink-0 rounded-full bg-[var(--border)]" />
      </div>

      {submitError ? <ToastBanner message={submitError} /> : null}


      {/* Mode Toggle - Sliding Segmented Track */}
      {(() => {
        const hasTransfer = (wallets || []).length >= 2
        const tabs = hasTransfer
          ? [
              { id: 'income', label: t('addTx.income') },
              { id: 'expense', label: t('addTx.expense') },
              { id: 'transfer', label: 'Transfer' },
            ]
          : [
              { id: 'income', label: t('addTx.income') },
              { id: 'expense', label: t('addTx.expense') },
            ]
        const activeIdx = Math.max(0, tabs.findIndex((tab) => tab.id === txType))
        const tabWidthPct = 100 / tabs.length

        return (
          <div className="relative mb-5 flex items-center rounded-xl bg-[var(--field-bg)] p-1">
            {/* Sliding Background Indicator */}
            <div
              className={`absolute top-1 bottom-1 rounded-lg bg-[var(--panel)] border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none ${
                txType === 'transfer' ? 'border-blue-500/30 shadow-[0_0_12px_rgba(37,99,235,0.15)]' : 'border-[var(--border)] shadow-2xs'
              }`}
              style={{
                width: `calc((100% - 0.5rem) / ${tabs.length})`,
                left: `calc(0.25rem + (${activeIdx} * (100% - 0.5rem) / ${tabs.length}))`,
              }}
            />
            {tabs.map((tab) => {
              const isActive = txType === tab.id
              const activeTextColor =
                tab.id === 'income'
                  ? 'text-[var(--income)]'
                  : tab.id === 'expense'
                  ? 'text-[var(--expense)]'
                  : tab.id === 'transfer'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                  : 'text-[var(--fg)]'

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTxType(tab.id)
                    if (tab.id === 'income' || tab.id === 'expense') {
                      setForm((p) => ({ ...p, category: '' }))
                      if (tab.id === 'income') setIncomeParentId(null)
                      else setExpenseParentId(null)
                    } else if (tab.id === 'transfer') {
                      setForm((p) => ({ ...p, category: 'Lainnya' }))
                    }
                  }}
                  style={{ width: `${tabWidthPct}%` }}
                  className={`relative z-10 py-2.5 text-center text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    isActive ? `${activeTextColor}` : 'text-[var(--muted)] hover:text-[var(--fg)] font-medium'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        )
      })()}

      <form className="grid gap-4" onSubmit={handleSubmit}>
        {txType === 'investment' ? (
          <>
            <label className="ft-label">
              {t('addTx.investmentAction')}
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
                <button
                  type="button"
                  onClick={() => setInvestmentForm((p) => ({ ...p, action: 'buy' }))}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    investmentForm.action === 'buy' ? 'bg-indigo-600 text-white' : 'text-[var(--muted)]'
                  }`}
                >
                  {t('addTx.investment.buy')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstOwned = (ownedInvestmentGroups || [])[0]
                    setInvestmentForm((p) => ({
                      ...p,
                      action: 'sell',
                      investmentId: firstOwned ? firstOwned.key : '',
                      name: firstOwned?.name || p.name,
                      type: firstOwned?.type || p.type,
                      purchaseCurrency: firstOwned?.purchaseCurrency || p.purchaseCurrency,
                    }))
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    investmentForm.action === 'sell' ? 'bg-indigo-600 text-white' : 'text-[var(--muted)]'
                  }`}
                >
                  {t('addTx.investment.sell')}
                </button>
              </div>
            </label>
            {investmentForm.action === 'sell' ? (
              <label className="ft-label">
                {t('addTx.investmentOwned')}
                <select
                  value={investmentForm.investmentId}
                  onChange={(e) => {
                    const next = (ownedInvestmentGroups || []).find((row) => row.key === e.target.value)
                    setInvestmentForm((p) => ({
                      ...p,
                      investmentId: e.target.value,
                      name: next?.name || p.name,
                      type: next?.type || p.type,
                      purchaseCurrency: next?.purchaseCurrency || p.purchaseCurrency,
                    }))
                  }}
                  className="ft-field"
                  required
                >
                  {(ownedInvestmentGroups || []).length === 0 ? (
                    <option value="">{t('invest.empty')}</option>
                  ) : (
                    (ownedInvestmentGroups || []).map((row) => (
                      <option key={row.key} value={row.key}>
                        {row.name} ({row.quantity})
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : null}
            <div className="ft-label">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">
                {t('addTx.date')}
              </label>
              <CustomDatePicker
                value={investmentForm.date}
                onChange={(val) => setInvestmentForm((p) => ({ ...p, date: val }))}
                title={t('invest.dateSelectTitle', 'Pilih Tanggal Investasi')}
              />
            </div>
            {investmentForm.action === 'buy' ? (
              <label className="ft-label">
                {t('invest.type')}
                <select
                  value={investmentForm.type}
                  onChange={(e) =>
                    setInvestmentForm((p) => ({
                      ...p,
                      type: e.target.value,
                      name: getInvestmentNameByType(e.target.value),
                    }))
                  }
                  className="ft-field"
                >
                  {investmentTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {String(investmentForm.type || '').toLowerCase() === 'emas' ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3">
                <p className="ft-muted mb-2 text-xs">
                  {t('addTx.investment.goldPrice')}:{' '}
                  {toSafeNumber(goldAutoPrice) > 0
                    ? `${formatMoneyInput(String(Math.round(goldAutoPrice)), 'IDR')} / ${t('invest.unit.gram')}`
                    : '-'}
                </p>
                {investmentForm.action === 'buy' ? (
                  <p className="mb-2 rounded-lg border border-amber-300/40 bg-amber-50/50 px-2 py-1 text-[11px] text-amber-700">
                    {t('addTx.investment.goldMin', {
                      gram: GOLD_MIN_GRAM,
                      amount:
                        parseMoneyInput(investmentForm.purchasePrice, investmentForm.purchaseCurrency) > 0
                          ? formatMoneyInput(
                              String(
                                GOLD_MIN_GRAM *
                                  parseMoneyInput(investmentForm.purchasePrice, investmentForm.purchaseCurrency),
                              ),
                              investmentForm.purchaseCurrency,
                            )
                          : '-',
                    })}
                  </p>
                ) : null}
                <div className="mb-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setInvestmentForm((p) => ({ ...p, goldInputInAmount: !p.goldInputInAmount }))}
                    className="rounded-full border border-[var(--border)] bg-[var(--panel)] p-2 text-[var(--muted)] hover:text-[var(--fg)]"
                    aria-label={t('addTx.investment.convert')}
                    title={t('addTx.investment.convert')}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 7h10M17 7l-2-2m2 2-2 2M17 17H7m0 0 2-2m-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                {investmentForm.goldInputInAmount ? (
                  <>
                    <label className="ft-label">
                      {t('addTx.investment.input.amount')}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={investmentForm.totalValue}
                        onChange={(e) =>
                          setInvestmentForm((p) => ({
                            ...p,
                            totalValue: formatMoneyInput(e.target.value, p.purchaseCurrency),
                          }))
                        }
                        className="ft-field"
                        required
                      />
                    </label>
                    <p className="ft-muted mt-2 text-xs">
                      {t('invest.quantity', { unit: t('invest.unit.gram') })}:{" "}
                      {parseMoneyInput(investmentForm.purchasePrice, investmentForm.purchaseCurrency) > 0
                        ? (
                            parseMoneyInput(investmentForm.totalValue, investmentForm.purchaseCurrency) /
                            parseMoneyInput(investmentForm.purchasePrice, investmentForm.purchaseCurrency)
                          ).toFixed(6)
                        : '0'}
                    </p>
                  </>
                ) : (
                  <>
                    <label className="ft-label">
                      {t('invest.quantity', { unit: t('invest.unit.gram') })}
                      <input
                        type="number"
                        min="0"
                        max={investmentForm.action === 'sell' ? toSafeNumber(selectedOwnedInvestment?.quantity) : undefined}
                        step="0.0001"
                        value={investmentForm.quantity}
                        onChange={(e) => setInvestmentForm((p) => ({ ...p, quantity: e.target.value }))}
                        className="ft-field"
                        required
                      />
                    </label>
                    <p className="ft-muted mt-2 text-xs">
                      {t('addTx.amount')}:{" "}
                      {formatMoneyInput(
                        String(
                          toSafeNumber(investmentForm.quantity) *
                            parseMoneyInput(investmentForm.purchasePrice, investmentForm.purchaseCurrency),
                        ),
                        investmentForm.purchaseCurrency,
                      )}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <label className="ft-label">
              {t('invest.quantity', {
                unit: investmentForm.type === 'Emas' ? t('invest.unit.gram') : t('invest.unit.unit'),
              })}
              <input
                type="number"
                min="0"
                max={investmentForm.action === 'sell' ? toSafeNumber(selectedOwnedInvestment?.quantity) : undefined}
                step="0.0001"
                value={investmentForm.quantity}
                onChange={(e) => setInvestmentForm((p) => ({ ...p, quantity: e.target.value }))}
                className="ft-field"
                required
              />
              </label>
            )}
            {String(investmentForm.type || '').toLowerCase() !== 'emas' ? (
              <label className="ft-label">
                {investmentForm.action === 'sell' ? t('addTx.investment.sellPrice') : t('invest.buyPrice')}
                <input
                  type="text"
                  inputMode="numeric"
                  value={investmentForm.purchasePrice}
                  onChange={(e) =>
                    setInvestmentForm((p) => ({
                      ...p,
                      purchasePrice: formatMoneyInput(e.target.value, p.purchaseCurrency),
                    }))
                  }
                  className="ft-field"
                  required
                />
              </label>
            ) : null}
            <label className="ft-label">
              {t('addTx.fundingSource')}
              <select
                value={investmentForm.fundingSource}
                onChange={(e) => setInvestmentForm((p) => ({ ...p, fundingSource: e.target.value }))}
                className="ft-field"
              >
                <option value="balance">{t('addTx.funding.balance')}</option>
                <option value="external">{t('addTx.funding.external')}</option>
              </select>
            </label>
            <label className="ft-label">
              {t('invest.buyCurrency')}
              <select
                value={investmentForm.purchaseCurrency}
                disabled={String(investmentForm.type || '').toLowerCase() === 'emas' || investmentForm.action === 'sell'}
                onChange={(e) =>
                  setInvestmentForm((p) => ({
                    ...p,
                    purchaseCurrency: e.target.value,
                    purchasePrice: formatMoneyInput(p.purchasePrice, e.target.value),
                  }))
                }
                className={`ft-field ${
                  String(investmentForm.type || '').toLowerCase() === 'emas' || investmentForm.action === 'sell'
                    ? 'cursor-not-allowed opacity-80'
                    : ''
                }`}
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            {/* Hero Amount Section */}
            <div className="py-2">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                  {txType === 'transfer' ? t('tx.transferAmount', 'Nominal Transfer') : t('addTx.amount', 'Nominal')}
                </div>
                {txType !== 'transfer' && (
                  <button
                    type="button"
                    onClick={handleOpenAiScan}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 transition-all active:scale-[0.96] text-[11px] font-bold cursor-pointer shadow-2xs group"
                  >
                    <Camera className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span>{t('transactions.ocr.pillBtn', 'Scan Struk AI')}</span>
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                  </button>
                )}
              </div>
              <div className="flex items-baseline gap-2.5">
                {/* Inline Currency Prefix */}
                <div className="relative shrink-0 flex items-center">
                  {isCashWallet ? (
                    <>
                      <select
                        value={form.currency}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            currency: e.target.value,
                            amount: formatMoneyInput(p.amount, e.target.value),
                          }))
                        }
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 min-h-[44px] min-w-[44px]"
                        aria-label={t('addTx.currency')}
                      >
                        {currencyOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 select-none pointer-events-none text-base font-extrabold text-[var(--fg)] bg-[var(--field-bg)] px-2 py-0.5 rounded-lg border border-[var(--border)] transition-colors shadow-2xs">
                        <span>{form.currency}</span>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center select-none text-base font-extrabold text-[var(--muted-2)] px-1 py-0.5">
                      <span>{form.currency}</span>
                    </div>
                  )}
                </div>

                {/* Hero Numeric Input */}
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => {
                    const rawValue = e.target.value
                    const currency = form.currency
                    const formatted = formatMoneyInput(rawValue, currency)
                    const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart, currency)
                    setForm((p) => ({ ...p, amount: formatted }))
                    window.requestAnimationFrame(() => {
                      const el = amountInputRef.current
                      if (!el) return
                      el.setSelectionRange(caret, caret)
                    })
                  }}
                  onFocus={() => setIsAmountFocused(true)}
                  onBlur={() => setIsAmountFocused(false)}
                  required
                  placeholder="0"
                  className={`w-full min-w-0 bg-transparent py-0 font-extrabold outline-none tracking-tight leading-none transition-all ${
                    form.amount ? 'text-[var(--fg)]' : 'text-[var(--muted-2)]/50 font-medium'
                  } ${
                    String(form.amount || '').length > 11
                      ? 'text-xl sm:text-2xl'
                      : String(form.amount || '').length > 7
                      ? 'text-2xl sm:text-3xl'
                      : 'text-3xl sm:text-4xl'
                  }`}
                />
              </div>

              {/* Dynamic Focus Underline Gradient */}
              <div
                className="mt-3.5 h-[2px] rounded-full transition-all duration-300"
                style={{
                  background: isAmountFocused
                    ? `linear-gradient(90deg, ${modeAccent}, color-mix(in srgb, ${modeAccent} 40%, transparent) 65%, transparent)`
                    : 'var(--border)',
                }}
              />
            </div>
            {/* Form Fields Container - Fixed height to prevent jumping between tabs */}
            <div className="space-y-3" style={{ minHeight: '192px' }}>
              {/* Row 1: Tanggal + Dompet Asal */}
              <div className="flex items-stretch gap-2">
                <div className="shrink-0 min-w-[125px] sm:min-w-[135px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 h-[14px] flex items-center">
                    {t('addTx.date')}
                  </div>
                  <div className="bg-[var(--field-bg)] rounded-xl px-0.5 h-[42px]">
                    <CustomDatePicker
                      value={form.date}
                      onChange={(val) => setForm((p) => ({ ...p, date: val }))}
                      title={t('tx.date.selectTitle', 'Pilih Tanggal Transaksi')}
                      buttonClassName="border-none bg-transparent shadow-none px-3 py-2 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 h-[14px] flex items-center">
                    {txType === 'transfer' ? t('tx.transferFrom', 'Dari Dompet') : t('addTx.wallet', 'Dompet')}
                  </div>
                  <WalletSelectTrigger
                    wallet={selectedWallet}
                    placeholder={txType === 'transfer' ? t('tx.transferFrom', 'Pilih Dompet Asal') : t('loans.selectWallet', 'Pilih Wallet / Akun')}
                    compact
                    abbreviateBalance
                    onClick={() => setWalletModalMode('walletId')}
                    className="!h-[42px]"
                  />
                </div>
              </div>

              {/* Row 2: Kategori (Expense/Income) OR Dompet Tujuan (Transfer) */}
              <div style={{ minHeight: '60px' }}>
                {txType === 'transfer' ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 h-[18px]">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M12 19l-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {t('tx.transferTo', 'Ke Dompet Tujuan')}
                      </span>
                    </div>
                    <WalletSelectTrigger
                      wallet={selectedTargetWallet}
                      placeholder={t('tx.transferTo', 'Pilih Dompet Tujuan')}
                      compact
                      abbreviateBalance
                      onClick={() => setWalletModalMode('targetWalletId')}
                      className="!h-[42px]"
                    />
                  </div>
                ) : (
                  <div className={categoryShaking ? 'ft-shake' : ''}>
                    <div className="flex items-center justify-between mb-1 h-[18px]">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                        {t('addTx.category')}
                      </div>
                      {categoryError && (
                        <span className="text-[10.5px] font-bold text-rose-500 flex items-center gap-1 animate-[ft-fade-in_0.2s_ease-out]">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                          {t('addTx.selectCategoryRequired', 'Pilih kategori terlebih dahulu')}
                        </span>
                      )}
                    </div>
                    <button
                      ref={categoryButtonRef}
                      type="button"
                      onClick={openCategorySheet}
                      className={`w-full h-[42px] flex items-center justify-between gap-2 rounded-xl px-3.5 text-left min-w-0 transition-all active:scale-[0.99] cursor-pointer ${
                        categoryError
                          ? 'border border-rose-500/60 bg-rose-500/[0.08] shadow-[0_0_12px_rgba(244,63,94,0.18)] ring-2 ring-rose-500/30'
                          : 'bg-[var(--field-bg)] hover:bg-[var(--panel-strong)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {form.category && form.category.trim() ? (
                          <CategoryIcon
                            icon={resolveParentIcon(form.category.split('/')[0])}
                            className="h-4 w-4 shrink-0 text-[var(--fg)]/70"
                          />
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              categoryError ? 'text-rose-500' : 'text-[var(--muted)]'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          >
                            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <span
                          className={`min-w-0 flex-1 leading-snug truncate text-xs sm:text-sm ${
                            !form.category || !form.category.trim()
                              ? categoryError
                                ? 'font-bold text-rose-500'
                                : 'font-normal italic text-[var(--muted-2)]'
                              : 'font-semibold text-[var(--fg)]'
                          }`}
                        >
                          {txType === 'expense' ? (
                            form.category ? formatExpenseCategory(form.category, locale) : 'Pilih Kategori'
                          ) : (
                            form.category ? formatIncomeCategory(form.category, locale) : 'Pilih Kategori'
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {categoryError ? (
                          <span className="rounded-lg bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500 border border-rose-500/30">
                            Pilih {'>'}
                          </span>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Row 3: Catatan */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 h-[14px] flex items-center">
                  {t('addTx.notes', 'Catatan')}
                </div>
                <textarea
                  value={form.notes}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, notes: e.target.value }))
                    // Auto-resize
                    const el = e.target
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 80)}px`
                  }}
                  placeholder={t('addTx.notesPlaceholder')}
                  rows={1}
                  className="w-full bg-[var(--field-bg)] rounded-xl border-none py-2.5 px-3.5 text-xs sm:text-sm font-normal text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)]/60 focus:ring-1 focus:ring-[var(--border-strong)] transition-all resize-none"
                />
              </div>

              {/* Row 4: Tag System */}
              {txType !== 'transfer' && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-[var(--muted)]" />
                      Label / Tag (Opsional)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] animate-fadeIn"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-[var(--muted)] hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddTag()
                        }
                      }}
                      placeholder={t('tx.tagsPlaceholder', 'Tambah label (contoh: liburan, kantor)...')}
                      className="flex-1 bg-[var(--field-bg)] rounded-xl py-2 px-3 text-xs font-semibold text-[var(--fg)] outline-none border border-[var(--border)] focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      className="px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] disabled:opacity-40 cursor-pointer"
                    >
                      + Tag
                    </button>
                  </div>
                </div>
              )}

              {/* Row 5: Split Transaction Section (Expenses only) */}
              {form.type === 'expense' && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[var(--fg)] flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3 9 15"/><path d="M3 21l6-6"/></svg>
                        {t('addTx.splitCategory', 'Split Kategori Transaksi')}
                      </p>
                      <p className="text-[10px] text-[var(--muted)]">
                        {t('addTx.splitDesc', 'Bagi transaksi ke beberapa sub-kategori berbeda')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleSplit}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${isSplitMode ? 'bg-purple-500' : 'bg-[var(--border)]'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSplitMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {isSplitMode && (
                    <div className="space-y-2 pt-1 border-t border-[var(--border)]/60 animate-dropdown">
                      {splitItems.map((item, idx) => (
                        <div key={item.id} className="p-2 rounded-xl bg-[var(--panel-strong)] border border-[var(--border)] space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-[var(--muted)]">
                              {t('addTx.splitItem', 'Item')} #{idx + 1}
                            </span>
                            {splitItems.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSplitItem(item.id)}
                                className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                              >
                                {t('common.delete', 'Hapus')}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={item.category}
                              onChange={(e) => handleUpdateSplitItem(item.id, 'category', e.target.value)}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fg)] outline-none"
                            >
                              {(mergedExpenseTree || []).map((parent) => (
                                <optgroup key={parent.id} label={parent.names?.[lang] || parent.id}>
                                  {(parent.subcategories || []).map((sub) => (
                                    <option key={sub.id} value={`${parent.id}/${sub.id}`}>
                                      {sub.names?.[lang] || sub.id}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder={t('common.amount', 'Nominal')}
                              value={item.amount}
                              onChange={(e) =>
                                handleUpdateSplitItem(
                                  item.id,
                                  'amount',
                                  formatMoneyInput(e.target.value, form.currency),
                                )
                              }
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-black text-[var(--fg)] outline-none text-right font-mono"
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddSplitItem}
                        className="w-full py-2 rounded-xl border border-dashed border-[var(--border)] bg-transparent text-xs font-bold text-indigo-500 hover:bg-indigo-500/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Pembagian Kategori
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="submit"
            style={{
              backgroundColor: modeAccent,
            }}
            className={`w-full h-[48px] rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-[0.99] flex items-center justify-center cursor-pointer ${
              txType === 'transfer' ? 'shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:opacity-90' : ''
            }`}
          >
            {t('addTx.save', 'Simpan')}
          </button>
          <button
            type="button"
            className="w-full py-2 text-center text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
            onClick={onClose}
          >
            {t('addTx.cancel')}
          </button>
        </div>
      </form>

      {txType !== 'investment' && categorySheetOpen ? (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto" role="presentation">
          <button
            type="button"
            className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
              categorySheetEnter ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label={t('addTx.closeSheet')}
            onClick={closeCategorySheet}
          />
          <div
            className={`relative flex max-h-[min(88vh,36rem)] w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transition-transform duration-300 ease-out ${
              categorySheetEnter ? 'translate-y-0' : 'translate-y-full'
            }`}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)]/40" />
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/70 px-4 py-3">
              <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--fg)]">
                {txType === 'expense'
                  ? categoryEditMode
                    ? t('addTx.manageCategory')
                    : t('addTx.pickCategory')
                  : incomeEditMode
                    ? t('addTx.manageIncomeCategory')
                    : t('addTx.categorySheetTitle')}
              </p>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)]"
                  aria-label={
                    (txType === 'expense' ? categoryEditMode : incomeEditMode)
                      ? t('addTx.doneEditing')
                      : txType === 'expense'
                        ? t('addTx.manageCategory')
                        : t('addTx.manageIncomeCategory')
                  }
                  onClick={() => {
                    if (txType === 'expense') {
                      if (categoryEditMode) {
                        setCategoryEditMode(false)
                        setNewSubName('')
                      } else {
                        setCategoryEditMode(true)
                      }
                      return
                    }
                    if (incomeEditMode) {
                      setIncomeEditMode(false)
                      setNewIncomeCatName('')
                    } else {
                      setIncomeEditMode(true)
                    }
                  }}
                >
                  {txType === 'expense' && categoryEditMode ? (
                    <span className="px-1 text-sm font-semibold text-[var(--accent)]">{t('addTx.doneEditing')}</span>
                  ) : txType === 'income' && incomeEditMode ? (
                    <span className="px-1 text-sm font-semibold text-[var(--accent)]">{t('addTx.doneEditing')}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                      <path
                        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)]"
                  aria-label={t('addTx.closeSheet')}
                  onClick={closeCategorySheet}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex min-h-[220px] flex-1 divide-x divide-[var(--border)]">
              {/* Left pane: Main categories */}
              <div className="flex w-[min(46%,11rem)] shrink-0 flex-col justify-between">
                <ul className="ft-hide-scrollbar min-w-0 flex-1 overflow-y-auto py-1">
                  {activeTree.map((parent) => {
                    const selected = activeParentId === parent.id
                    const hasChildren = (parent.children || []).length > 0
                    return (
                      <li key={parent.id} className="border-b border-[var(--border)]/30 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (!activeEditMode && (!hasChildren || selected)) {
                              setForm((p) => ({ ...p, category: parent.id }))
                              syncParentFromCategory(parent.id)
                              closeCategorySheet()
                            } else {
                              setActiveParentId(parent.id)
                            }
                          }}
                          onDoubleClick={() => {
                            if (!activeEditMode) {
                              setForm((p) => ({ ...p, category: parent.id }))
                              syncParentFromCategory(parent.id)
                              closeCategorySheet()
                            }
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition border-l-[2.5px] ${
                            selected
                              ? 'bg-[color-mix(in_srgb,var(--fg)_7%,var(--field-bg))] text-[var(--fg)] font-semibold border-l-[var(--fg)]/80'
                              : 'text-[var(--fg)] hover:bg-[var(--field-bg)] border-l-transparent'
                          }`}
                        >
                          <CategoryIcon icon={resolveParentIcon(parent.id)} className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 leading-snug truncate">{parent.names[lang]}</span>
                          {hasChildren || activeEditMode ? <span className="shrink-0 text-[var(--muted)]">›</span> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {activeEditMode ? (
                  <div className="border-t border-[var(--border)]/70 p-2 bg-[var(--field-bg)]/40">
                    <input
                      type="text"
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newParentName.trim()) {
                            if (txType === 'expense') addExpenseParentCategory(newParentName.trim(), newParentName.trim())
                            else addIncomeParentCategory(newParentName.trim(), newParentName.trim())
                            setNewParentName('')
                          }
                        }
                      }}
                      placeholder={lang === 'id' ? '+ Kategori Utama' : '+ Main Category'}
                      className="ft-field w-full text-xs px-2 py-1 mb-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full text-xs py-1"
                      onClick={() => {
                        if (newParentName.trim()) {
                          if (txType === 'expense') addExpenseParentCategory(newParentName.trim(), newParentName.trim())
                          else addIncomeParentCategory(newParentName.trim(), newParentName.trim())
                          setNewParentName('')
                        }
                      }}
                    >
                      {lang === 'id' ? 'Tambah Utama' : 'Add Main'}
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Right pane: Subcategories & Options */}
              {!activeParent ? (
                <div className="flex min-h-[220px] min-w-0 flex-1 flex-col items-center justify-center p-6 text-center text-[var(--muted)] animate-[ft-fade-up_0.25s_ease-out]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] mb-3 shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[var(--fg)] mb-1">{lang === 'id' ? 'Pilih Kategori Utama' : 'Select Main Category'}</p>
                  <p className="text-xs text-[var(--muted)] max-w-[180px] leading-relaxed">{lang === 'id' ? 'Klik salah satu kategori di sebelah kiri untuk melihat daftar subkategori.' : 'Click a category on the left to view its subcategories.'}</p>
                </div>
              ) : activeEditMode ? (
                <div className="flex min-h-[220px] min-w-0 flex-1 flex-col">
                  <div className="border-b border-[var(--border)]/70 p-3 bg-[var(--field-bg)]/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[var(--fg)]">
                        {lang === 'id' ? `Pilihan Warna (${activeParent.names[lang]})` : `Color Option (${activeParent.names[lang]})`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['amber', 'emerald', 'sky', 'indigo', 'purple', 'rose', 'teal', 'slate', 'orange', 'pink', 'yellow'].map((tone) => {
                        const activeTone = getEffectiveTone(activeParent.id)
                        const active = activeTone === tone
                        return (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => setCatColor(activeParent.id, tone)}
                            className={`h-6 w-6 rounded-full transition ${getCategoryToneClass(tone)} ${
                              active
                                ? 'scale-105 ring-2 ring-[var(--fg)]/80 ring-offset-2 ring-offset-[var(--panel)] shadow-2xs'
                                : 'border border-[var(--border)] opacity-80 hover:opacity-100'
                            }`}
                            title={tone}
                          />
                        )
                      })}
                    </div>
                  </div>
                  <ul className="ft-hide-scrollbar min-w-0 flex-1 overflow-y-auto py-1">
                    {activeParent.children.length === 0 ? (
                      <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{t('addTx.emptySubs')}</li>
                    ) : (
                      activeParent.children.map((child) => (
                        <li
                          key={child.id}
                          className="flex items-center gap-2 border-b border-[var(--border)]/40 px-3 py-2.5 last:border-b-0"
                        >
                          <span className="min-w-0 flex-1 text-left text-[13px] font-medium text-[var(--fg)]">
                            {child.names[lang]}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10"
                            aria-label={t('addTx.confirmRemoveCustom')}
                            onClick={() => {
                              if (txType === 'expense') removeExpenseSubcategory(activeParent.id, child.id)
                              else removeIncomeSubcategory(activeParent.id, child.id)
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" strokeLinecap="round" />
                            </svg>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="shrink-0 border-t border-[var(--border)]/70 p-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (newSubName.trim() && activeParent) {
                              if (txType === 'expense') addExpenseSubcategory(activeParent.id, newSubName.trim(), newSubName.trim())
                              else addIncomeSubcategory(activeParent.id, newSubName.trim(), newSubName.trim())
                              setNewSubName('')
                            }
                          }
                        }}
                        placeholder={t('addTx.subNamePlaceholder')}
                        className="ft-field min-w-0 flex-1 text-sm py-1.5 px-3"
                      />
                      <Button
                        type="button"
                        className="shrink-0"
                        onClick={() => {
                          if (newSubName.trim() && activeParent) {
                            if (txType === 'expense') addExpenseSubcategory(activeParent.id, newSubName.trim(), newSubName.trim())
                            else addIncomeSubcategory(activeParent.id, newSubName.trim(), newSubName.trim())
                            setNewSubName('')
                          }
                        }}
                      >
                        {t('addTx.addSub')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] min-w-0 flex-1 flex-col">
                  <ul key={activeParent?.id} className="ft-hide-scrollbar flex-1 overflow-y-auto py-1 px-1.5 ft-swush-in">
                    {(activeParent?.children || []).length === 0 ? (
                      <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{t('addTx.emptySubs')}</li>
                    ) : (
                      activeParent?.children.map((child) => {
                        const path = `${activeParent.id}/${child.id}`
                        const picked = form.category === path
                        return (
                          <li key={child.id} className="py-1 border-b border-[var(--border)]/35 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, category: path }))
                                syncParentFromCategory(path)
                                closeCategorySheet()
                              }}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-[13px] transition ${
                                picked
                                  ? 'border border-[var(--fg)]/60 bg-[color-mix(in_srgb,var(--fg)_6%,var(--field-bg))] font-semibold text-[var(--fg)] shadow-2xs'
                                  : 'border border-transparent hover:bg-[var(--field-bg)] font-medium text-[var(--fg)]'
                              }`}
                            >
                              <span className="min-w-0 flex-1">{child.names[lang]}</span>
                              {picked && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                              )}
                            </button>
                          </li>
                        )
                      })
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <WalletSelectModal
        isOpen={Boolean(walletModalMode)}
        onClose={() => setWalletModalMode(null)}
        wallets={wallets}
        selectedWalletId={walletModalMode === 'targetWalletId' ? form.targetWalletId : form.walletId}
        onSelectWallet={(id) => {
          if (walletModalMode === 'targetWalletId') {
            setForm((p) => ({ ...p, targetWalletId: Number(id) }))
          } else {
            const chosen = wallets?.find((w) => String(w.id) === String(id))
            const newCurr = chosen?.currency || defaultCurrency
            setForm((p) => ({
              ...p,
              walletId: Number(id),
              currency: newCurr,
              amount: formatMoneyInput(p.amount, newCurr),
            }))
          }
        }}
        title={
          walletModalMode === 'targetWalletId'
            ? 'Pilih Dompet Tujuan'
            : txType === 'transfer'
            ? 'Pilih Dompet Asal'
            : 'Pilih Dompet / Akun'
        }
      />
    </Modal>
  )
}

export default QuickAddTransactionModal
