import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../ui/Button'
import CategoryIcon from '../ui/CategoryIcon'
import Modal from '../ui/Modal'
import ToastBanner from '../ui/ToastBanner'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import CustomDatePicker from '../ui/CustomDatePicker'
import useTranslation from '../../hooks/useTranslation'
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
import { fetchGoldPricePerGramIDR, getGoldPriceHistory } from '../../lib/api'
import { db } from '../../lib/db'
import { formatMoneyInput, getMoneyInputCaret, parseMoneyInput, toSafeNumber } from '../../lib/utils'

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
  const addTransaction = useTransactionStore((state) => state.addTransaction)

  const [txType, setTxType] = useState(() => 'expense')
  const [form, setForm] = useState(() => ({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: getDefaultExpenseCategoryPath(),
    notes: '',
    currency: defaultCurrency,
    walletId: initialWalletId || '',
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
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const [walletModalMode, setWalletModalMode] = useState(null) // null | 'walletId' | 'targetWalletId'
  const selectedWallet = useMemo(() => wallets?.find((w) => String(w.id) === String(form.walletId)), [wallets, form.walletId])
  const selectedTargetWallet = useMemo(() => wallets?.find((w) => String(w.id) === String(form.targetWalletId)), [wallets, form.targetWalletId])

  const [categorySheetOpen, setCategorySheetOpen] = useState(() => false)
  const [categorySheetEnter, setCategorySheetEnter] = useState(() => false)
  const [expenseParentId, setExpenseParentId] = useState(() => null)
  const [incomeParentId, setIncomeParentId] = useState(() => null)
  const [categoryEditMode, setCategoryEditMode] = useState(false)
  const [incomeEditMode, setIncomeEditMode] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [newParentName, setNewParentName] = useState('')
  const [, setNewIncomeCatName] = useState('')
  const [categoryCustomVersion, setCategoryCustomVersion] = useState(0)
  const [submitError, setSubmitError] = useState('')
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

  useEffect(() => {
    if (isOpen) {
      setTxType('expense')
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
  }, [isOpen, defaultCurrency, initialWalletId, wallets, syncExpenseParentFromCategory, syncIncomeParentFromCategory])

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
          setSubmitError(t('addTx.selectCategoryRequired', 'Silakan pilih kategori terlebih dahulu.'))
          return
        }
        if (!form.walletId) {
          setSubmitError('Silakan pilih wallet terlebih dahulu.')
          return
        }
        if (txType === 'transfer') {
          if (!form.targetWalletId) {
            setSubmitError('Silakan pilih wallet tujuan.')
            return
          }
          if (form.walletId === form.targetWalletId) {
            setSubmitError('Wallet asal dan tujuan tidak boleh sama.')
            return
          }
        }
        
        await addTransaction({
          date: form.date,
          amount: parseMoneyInput(form.amount, form.currency),
          type: txType,
          category: txType === 'transfer' ? 'transfer' : form.category,
          notes: form.notes.trim() || '',
          currency: form.currency,
          walletId: form.walletId,
          ...(txType === 'transfer' ? { targetWalletId: form.targetWalletId } : {})
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
              className="absolute top-1 bottom-1 rounded-lg bg-[var(--panel)] border border-[var(--border)] shadow-2xs transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
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
                title="Pilih Tanggal Investasi"
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-2">
                {t('addTx.amount')}
              </div>
              <div className="flex items-baseline gap-2.5">
                {/* Inline Currency Prefix */}
                <div className="relative shrink-0 flex items-center">
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
                  <div className="flex items-center gap-1 select-none pointer-events-none text-base font-extrabold text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
                    <span>{form.currency}</span>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
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

              {/* Dynamic Focus Underline Gradient & Glow */}
              <div
                className="mt-3.5 h-[2px] rounded-full transition-all duration-300"
                style={{
                  background: isAmountFocused
                    ? `linear-gradient(90deg, ${modeAccent}, color-mix(in srgb, ${modeAccent} 40%, transparent) 65%, transparent)`
                    : 'var(--border)',
                  boxShadow: isAmountFocused ? `0 1px 14px color-mix(in srgb, ${modeAccent} 45%, transparent)` : 'none',
                }}
              />
            </div>

            {/* Compact Two-Chip Row: Tanggal + Wallet */}
            <div className="flex items-center gap-2">
              <div className="shrink-0 bg-[var(--field-bg)] rounded-xl px-0.5">
                <CustomDatePicker
                  value={form.date}
                  onChange={(val) => setForm((p) => ({ ...p, date: val }))}
                  title="Pilih Tanggal Transaksi"
                  buttonClassName="border-none bg-transparent shadow-none px-3 py-2 min-h-[42px]"
                />
              </div>

              {txType === 'transfer' ? (
                <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                  <WalletSelectTrigger
                    wallet={selectedWallet}
                    placeholder="Asal"
                    compact
                    abbreviateBalance
                    onClick={() => setWalletModalMode('walletId')}
                  />
                  <WalletSelectTrigger
                    wallet={selectedTargetWallet}
                    placeholder="Tujuan"
                    compact
                    abbreviateBalance
                    onClick={() => setWalletModalMode('targetWalletId')}
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <WalletSelectTrigger
                    wallet={selectedWallet}
                    placeholder="Pilih Wallet / Akun"
                    compact
                    abbreviateBalance
                    onClick={() => setWalletModalMode('walletId')}
                  />
                </div>
              )}
            </div>

            {/* Kategori Trigger Button */}
            {txType !== 'transfer' && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1.5">
                  {t('addTx.category')}
                </div>
                <button
                  type="button"
                  onClick={openCategorySheet}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-[var(--field-bg)] px-3.5 py-3 text-left min-w-0 transition-all hover:bg-[var(--panel-strong)] active:scale-[0.99] cursor-pointer"
                >
                  <span className={`min-w-0 flex-1 leading-snug truncate text-xs sm:text-sm ${!form.category || !form.category.trim() ? 'font-normal italic text-[var(--muted-2)]' : 'font-semibold text-[var(--fg)]'}`}>
                    {txType === 'expense' ? (
                      form.category ? formatExpenseCategory(form.category, locale) : 'Pilih Kategori'
                    ) : (
                      form.category ? formatIncomeCategory(form.category, locale) : 'Pilih Kategori'
                    )}
                  </span>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Catatan Ghost Underline */}
            <div>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t('addTx.notesPlaceholder')}
                className="w-full bg-transparent border-b border-[var(--border)] py-2 px-0 text-xs sm:text-sm font-normal text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)]/60 focus:border-[var(--border-strong)] transition-colors"
              />
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="submit"
            style={{
              backgroundColor: modeAccent,
              boxShadow: `0 10px 22px color-mix(in srgb, ${modeAccent} 45%, transparent)`,
            }}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.99] cursor-pointer"
          >
            {t('addTx.save')}
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
                      <li key={parent.id}>
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
                  <ul key={activeParent?.id} className="ft-hide-scrollbar flex-1 overflow-y-auto py-1 px-1.5 space-y-1 ft-swush-in">
                    {(activeParent?.children || []).length === 0 ? (
                      <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{t('addTx.emptySubs')}</li>
                    ) : (
                      activeParent?.children.map((child) => {
                        const path = `${activeParent.id}/${child.id}`
                        const picked = form.category === path
                        return (
                          <li key={child.id} className="p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, category: path }))
                                syncParentFromCategory(path)
                                closeCategorySheet()
                              }}
                              className={`flex w-full items-center rounded-xl px-3.5 py-3 text-left text-[13px] transition ${
                                picked
                                  ? 'border border-[var(--fg)]/60 bg-[color-mix(in_srgb,var(--fg)_6%,var(--field-bg))] font-semibold text-[var(--fg)] shadow-2xs'
                                  : 'border border-transparent hover:bg-[var(--field-bg)] font-medium text-[var(--fg)]'
                              }`}
                            >
                              <span className="min-w-0 flex-1">{child.names[lang]}</span>
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
            setForm((p) => ({ ...p, walletId: Number(id) }))
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
