import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LayoutGrid, ChevronDown } from 'lucide-react'
import Modal from '../ui/Modal'
import ToastBanner from '../ui/ToastBanner'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import CustomDatePicker from '../ui/CustomDatePicker'
import CategoryIcon from '../ui/CategoryIcon'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import {
  getEffectiveCategoryTone,
  getEffectiveIncomeCategoryTone,
  resolveExpenseParentIconKey,
  resolveIncomeParentIconKey,
} from '../../lib/categoryIcon'
import {
  EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT,
  formatExpenseCategory,
  getDefaultExpenseCategoryPath,
  getMergedExpenseTree,
  isValidExpenseCategoryPath,
} from '../../lib/expenseCategories'
import {
  formatIncomeCategory,
  getMergedIncomeTree,
  INCOME_CATEGORY_CUSTOM_CHANGED_EVENT,
  isValidIncomeCategoryPath,
} from '../../lib/incomeCategories'
import {
  fetchGoldPricePerGramIDR,
  getGoldPriceHistory,
  fetchCurrencyRates,
  getCachedCurrencyRates,
} from '../../lib/api'
import { db, computeAllWalletBalances } from '../../lib/db'
import { hapticSuccess, hapticWarning } from '../../lib/haptics'
import {
  formatMoneyInput,
  parseMoneyInput,
  toSafeNumber,
  FALLBACK_EXCHANGE_RATES,
} from '../../lib/utils'
import { evaluateExpression } from '../../lib/calcParser'

import TransactionTypeSelector from './quick-add/TransactionTypeSelector'
import AmountInput from './quick-add/AmountInput'
import CategorySheet from './quick-add/CategorySheet'
import InvestmentForm from './quick-add/InvestmentForm'
import TagInput from './quick-add/TagInput'

const investmentSubByType = {
  emas: 'emas',
  crypto: 'crypto',
  saham: 'saham',
}

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

  const [walletModalMode, setWalletModalMode] = useState(null)
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '').toLowerCase()
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove))
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
  const [categoryCustomVersion, setCategoryCustomVersion] = useState(0)
  const [submitError, setSubmitError] = useState('')
  const [categoryError, setCategoryError] = useState(false)
  const [walletError, setWalletError] = useState(false)
  const [amountError, setAmountError] = useState(false)
  const categoryButtonRef = useRef(null)
  const walletButtonRef = useRef(null)
  const [goldAutoPrice, setGoldAutoPrice] = useState(0)

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
      setWalletError(false)
      setAmountError(false)
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
    setCategorySheetEnter(false)
    window.setTimeout(() => setCategorySheetOpen(false), 240)
  }, [])

  const openCategorySheet = () => {
    setCategoryError(false)
    setSubmitError('')
    setCategorySheetOpen(true)
    if (txType === 'expense') syncExpenseParentFromCategory(form.category)
    if (txType === 'income') syncIncomeParentFromCategory(form.category)
    requestAnimationFrame(() => requestAnimationFrame(() => setCategorySheetEnter(true)))
  }

  const handleSelectType = useCallback(
    (nextType) => {
      if (nextType === txType) return
      setTxType(nextType)
      setCategoryError(false)
      setWalletError(false)
      setAmountError(false)
      setSubmitError('')

      if (nextType === 'expense') {
        if (!isValidExpenseCategoryPath(form.category)) {
          setForm((p) => ({ ...p, category: '' }))
          setExpenseParentId(null)
        } else {
          syncExpenseParentFromCategory(form.category)
        }
      } else if (nextType === 'income') {
        if (!isValidIncomeCategoryPath(form.category)) {
          setForm((p) => ({ ...p, category: '' }))
          setIncomeParentId(null)
        } else {
          syncIncomeParentFromCategory(form.category)
        }
      } else {
        setForm((p) => ({ ...p, category: '' }))
        setExpenseParentId(null)
        setIncomeParentId(null)
      }
    },
    [txType, form.category, syncExpenseParentFromCategory, syncIncomeParentFromCategory],
  )

  const activeTree = txType === 'expense' ? mergedExpenseTree : mergedIncomeTree
  const activeParentId = txType === 'expense' ? expenseParentId : incomeParentId
  const setActiveParentId = txType === 'expense' ? setExpenseParentId : setIncomeParentId
  const resolveParentIcon = txType === 'expense' ? resolveExpenseParentIconKey : resolveIncomeParentIconKey
  const getEffectiveTone = txType === 'expense' ? getEffectiveCategoryTone : getEffectiveIncomeCategoryTone

  const modeAccent =
    txType === 'expense'
      ? 'var(--expense)'
      : txType === 'income'
      ? 'var(--income)'
      : txType === 'transfer'
      ? '#3b82f6'
      : 'var(--accent)'

  const handleSwapTransferWallets = useCallback(() => {
    setForm((prev) => {
      const currentSource = prev.walletId ? Number(prev.walletId) : ''
      const currentTarget = prev.targetWalletId ? Number(prev.targetWalletId) : ''
      if (!currentSource && !currentTarget) return prev

      const chosen = wallets?.find((w) => Number(w.id) === currentTarget)
      const newCurr = chosen?.currency || prev.currency

      return {
        ...prev,
        walletId: currentTarget,
        targetWalletId: currentSource,
        currency: newCurr,
        amount: formatMoneyInput(prev.amount, newCurr),
      }
    })
  }, [wallets])

  const handleSelectWallet = useCallback(
    (selectedIdRaw) => {
      const selectedId = Number(selectedIdRaw)
      if (!selectedId) return

      if (walletModalMode === 'targetWalletId') {
        setForm((prev) => {
          const currentSource = prev.walletId ? Number(prev.walletId) : null
          const currentTarget = prev.targetWalletId ? Number(prev.targetWalletId) : null

          // If the chosen target wallet is currently the source wallet
          if (currentSource === selectedId) {
            if (currentTarget && currentTarget !== selectedId) {
              // Swap: old target becomes source, new wallet becomes target
              const newSourceWallet = wallets?.find((w) => Number(w.id) === currentTarget)
              const newCurr = newSourceWallet?.currency || prev.currency
              return {
                ...prev,
                walletId: currentTarget,
                targetWalletId: selectedId,
                currency: newCurr,
                amount: formatMoneyInput(prev.amount, newCurr),
              }
            } else {
              // Only source was picked: move it to target, clear source
              return {
                ...prev,
                walletId: '',
                targetWalletId: selectedId,
              }
            }
          }

          return {
            ...prev,
            targetWalletId: selectedId,
          }
        })
      } else {
        // walletModalMode === 'walletId'
        setForm((prev) => {
          const currentSource = prev.walletId ? Number(prev.walletId) : null
          const currentTarget = prev.targetWalletId ? Number(prev.targetWalletId) : null
          const chosen = wallets?.find((w) => Number(w.id) === selectedId)
          const newCurr = chosen?.currency || defaultCurrency

          // In transfer mode, if the chosen source wallet is currently the target wallet
          if (txType === 'transfer' && currentTarget === selectedId) {
            if (currentSource && currentSource !== selectedId) {
              // Swap: old source becomes target, new wallet becomes source
              return {
                ...prev,
                walletId: selectedId,
                targetWalletId: currentSource,
                currency: newCurr,
                amount: formatMoneyInput(prev.amount, newCurr),
              }
            } else {
              // Only target was picked: move it to source, clear target
              return {
                ...prev,
                walletId: selectedId,
                targetWalletId: '',
                currency: newCurr,
                amount: formatMoneyInput(prev.amount, newCurr),
              }
            }
          }

          return {
            ...prev,
            walletId: selectedId,
            currency: newCurr,
            amount: formatMoneyInput(prev.amount, newCurr),
          }
        })
      }
      setWalletError(false)
      setWalletModalMode(null)
    },
    [walletModalMode, txType, wallets, defaultCurrency]
  )

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
          hapticWarning()
          setCategoryError(true)
          setSubmitError('')
          categoryButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          return
        }
        if (!form.walletId) {
          hapticWarning()
          setWalletError(true)
          setSubmitError('')
          walletButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          return
        }
        if (txType === 'transfer') {
          if (!form.targetWalletId) {
            hapticWarning()
            setSubmitError(t('tx.selectTargetWallet', 'Silakan pilih wallet tujuan.'))
            return
          }
          if (String(form.walletId) === String(form.targetWalletId)) {
            hapticWarning()
            setSubmitError(t('tx.sameWalletTransfer', 'Wallet asal dan tujuan tidak boleh sama.'))
            return
          }
        }

        const evalResult = evaluateExpression(form.amount, form.currency)
        const totalAmount = evalResult.isValid && evalResult.result !== null
          ? evalResult.result
          : parseMoneyInput(form.amount, form.currency)

        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          hapticWarning()
          setAmountError(true)
          setSubmitError('')
          return
        }

        let resolvedCategory = txType === 'transfer' ? 'transfer' : form.category

        await addTransaction({
          date: form.date,
          amount: totalAmount,
          type: txType,
          category: resolvedCategory,
          notes: form.notes,
          currency: form.currency,
          walletId: Number(form.walletId),
          targetWalletId: txType === 'transfer' ? Number(form.targetWalletId) : undefined,
          tags: tags.length > 0 ? tags : undefined,
        })
        hapticSuccess()
      }
      onClose?.()
    } catch {
      hapticWarning()
      setSubmitError('Gagal menyimpan transaksi. Cek kembali data Anda.')
    }
  }

  return (
    <Modal key={nonce} isOpen={isOpen} title={t('addTx.title')} onClose={onClose}>
      {submitError ? <ToastBanner message={submitError} /> : null}

      {/* Mode Toggle - Sliding Segmented Track */}
      <div className="mb-4">
        <TransactionTypeSelector
          txType={txType}
          onSelectType={handleSelectType}
        />
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {txType === 'investment' ? (
          <InvestmentForm
            form={investmentForm}
            setForm={setInvestmentForm}
            ownedInvestmentGroups={ownedInvestmentGroups}
            selectedOwnedInvestment={selectedOwnedInvestment}
            goldAutoPrice={goldAutoPrice}
          />
        ) : (
          <>
            <AmountInput
              amount={form.amount}
              onChangeAmount={(val) => {
                setAmountError(false)
                setForm((p) => ({ ...p, amount: val }))
              }}
              currency={form.currency}
              onChangeCurrency={(val) => {
                setAmountError(false)
                setForm((p) => ({ ...p, currency: val }))
              }}
              isCashWallet={isCashWallet}
              txType={txType}
              onOpenAiScan={handleOpenAiScan}
              modeAccent={modeAccent}
              hasError={amountError}
            />

            {/* Form Fields Container */}
            <div className="space-y-3" style={{ minHeight: '192px' }}>
              {/* Row 1: Tanggal + Dompet Asal */}
              <div className="flex items-stretch gap-2">
                <div className="shrink-0 min-w-[125px] sm:min-w-[135px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 h-[14px] flex items-center">
                    {t('addTx.date')}
                  </div>
                  <div className="bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] rounded-xl px-0.5 h-[42px] hover:border-[var(--field-border-hover,var(--border-strong))] transition-colors">
                    <CustomDatePicker
                      value={form.date}
                      onChange={(val) => setForm((p) => ({ ...p, date: val }))}
                      title={t('tx.date.selectTitle', 'Pilih Tanggal Transaksi')}
                      buttonClassName="border-none bg-transparent shadow-none px-3 py-2 min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 h-[14px]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                      {txType === 'transfer' ? t('tx.transferFrom', 'Dari Dompet') : t('addTx.wallet', 'Dompet')}
                    </div>
                    {walletError && (
                      <span className="text-[10px] font-medium text-rose-500/80 animate-[ft-fade-in_0.2s_ease-out]">
                        {t('addTx.selectWalletRequired', 'Wajib dipilih')}
                      </span>
                    )}
                  </div>
                  <div ref={walletButtonRef}>
                    <WalletSelectTrigger
                      wallet={selectedWallet}
                      placeholder={txType === 'transfer' ? t('tx.transferFrom', 'Pilih Dompet Asal') : t('loans.selectWallet', 'Pilih Wallet / Akun')}
                      compact
                      error={walletError}
                      abbreviateBalance
                      onClick={() => {
                        setWalletError(false)
                        setWalletModalMode('walletId')
                      }}
                      className="!h-[42px]"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Kategori OR Dompet Tujuan */}
              <div style={{ minHeight: '60px' }}>
                {txType === 'transfer' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1 h-[18px]">
                      <div className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 5v14M12 19l-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {t('tx.transferTo', 'Ke Dompet Tujuan')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSwapTransferWallets}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10.5px] font-bold transition active:scale-95 cursor-pointer"
                        title={t('tx.swapWallets', 'Tukar')}
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{t('tx.swapWallets', 'Tukar')}</span>
                      </button>
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
                  <div>
                    <div className="flex items-center justify-between mb-1 h-[18px]">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                        {t('addTx.category')}
                      </div>
                      {categoryError && (
                        <span className="text-[10px] font-medium text-rose-500/80 animate-[ft-fade-in_0.2s_ease-out]">
                          {t('addTx.selectCategoryRequired', 'Wajib dipilih')}
                        </span>
                      )}
                    </div>
                    <button
                      ref={categoryButtonRef}
                      type="button"
                      onClick={openCategorySheet}
                      className={`group flex w-full h-[42px] min-h-[42px] items-center justify-between gap-2.5 rounded-xl px-3 py-1 text-left transition-all duration-200 focus-visible:outline-none active:scale-[0.99] cursor-pointer ${
                        categoryError
                          ? 'bg-rose-500/10 border-2 border-rose-500 text-rose-500'
                          : form.category
                          ? 'bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] text-[var(--fg)] hover:border-[var(--field-border-hover,var(--border-strong))]'
                          : 'bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] text-[var(--muted)] hover:border-[var(--field-border-hover,var(--border-strong))]'
                      }`}
                    >
                      {form.category && form.category.trim() ? (
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="h-7 w-7 rounded-full aspect-square flex items-center justify-center shrink-0 border border-[var(--border)] bg-[var(--panel)] overflow-hidden shadow-2xs">
                            <CategoryIcon
                              icon={resolveParentIcon(form.category.split('/')[0])}
                              className="h-4 w-4 text-[var(--fg)]/80"
                            />
                          </div>
                          <div className="min-w-0 flex-1 leading-tight">
                            <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
                              {txType === 'expense'
                                ? formatExpenseCategory(form.category, locale)
                                : formatIncomeCategory(form.category, locale)}
                            </p>
                            <div className="text-[10px] font-medium text-[var(--muted)] truncate mt-0.5 leading-none">
                              {form.category.includes('/')
                                ? txType === 'expense'
                                  ? formatExpenseCategory(form.category.split('/')[0], locale)
                                  : formatIncomeCategory(form.category.split('/')[0], locale)
                                : t('categories.mainCategory', 'Kategori Utama')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`h-7 w-7 rounded-full aspect-square grid shrink-0 place-items-center border transition-colors ${
                              categoryError
                                ? 'border-rose-400/40 bg-rose-500/5 text-rose-400'
                                : 'border border-dashed border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]'
                            }`}
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </div>
                          <span
                            className={`text-xs font-semibold truncate transition-colors ${
                              categoryError ? 'text-rose-500/90 dark:text-rose-400' : 'text-[var(--muted)]'
                            }`}
                          >
                            {t('addTx.selectCategory', 'Pilih Kategori')}
                          </span>
                        </div>
                      )}
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                          categoryError ? 'text-rose-400/70' : 'text-[var(--muted)] group-hover:text-[var(--fg)]'
                        }`}
                      />
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
                    const el = e.target
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 80)}px`
                  }}
                  placeholder={t('addTx.notesPlaceholder')}
                  rows={1}
                  className="w-full bg-[var(--field-bg)] rounded-xl border border-[var(--field-border,var(--border))] py-2.5 px-3.5 text-xs sm:text-sm font-normal text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)]/60 hover:border-[var(--field-border-hover,var(--border-strong))] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--ring)] transition-all resize-none"
                />
              </div>

              {/* Row 4: Tag System */}
              <TagInput
                tags={tags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                tagInput={tagInput}
                onChangeTagInput={setTagInput}
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

      {/* Category Bottom Sheet */}
      <CategorySheet
        isOpen={categorySheetOpen}
        isEnter={categorySheetEnter}
        onClose={closeCategorySheet}
        txType={txType}
        activeTree={activeTree}
        activeParentId={activeParentId}
        setActiveParentId={setActiveParentId}
        selectedCategory={form.category}
        onSelectCategory={(path) => setForm((p) => ({ ...p, category: path }))}
        resolveParentIcon={resolveParentIcon}
        getEffectiveTone={getEffectiveTone}
        onCategoryCustomChanged={() => setCategoryCustomVersion((v) => v + 1)}
      />

      {/* Wallet Select Modal */}
      <WalletSelectModal
        isOpen={Boolean(walletModalMode)}
        onClose={() => setWalletModalMode(null)}
        wallets={wallets}
        selectedWalletId={walletModalMode === 'targetWalletId' ? form.targetWalletId : form.walletId}
        onSelectWallet={handleSelectWallet}
        title={
          walletModalMode === 'targetWalletId'
            ? t('tx.transferTo', 'Pilih Dompet Tujuan')
            : txType === 'transfer'
            ? t('tx.transferFrom', 'Pilih Dompet Asal')
            : t('loans.selectWallet', 'Pilih Dompet / Akun')
        }
      />
    </Modal>
  )
}

export default QuickAddTransactionModal
