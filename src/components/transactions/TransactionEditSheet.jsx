import { useRef, useState, useCallback, useMemo } from 'react'
import BottomSheet from '../ui/BottomSheet'
import CustomDatePicker from '../ui/CustomDatePicker'
import CategoryIcon from '../ui/CategoryIcon'
import CategoryPickerModal from './CategoryPickerModal'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import TransactionTypeSelector from './quick-add/TransactionTypeSelector'
import AmountInput from './quick-add/AmountInput'
import ReceiptUploadAttachment from './ReceiptUploadAttachment'
import ReceiptPreviewModal from './ReceiptPreviewModal'
import ReceiptScannerModal from './ReceiptScannerModal'
import ToastBanner from '../ui/ToastBanner'
import useBackButton from '../../hooks/useBackButton'
import useTranslation from '../../hooks/useTranslation'
import { resolveTransactionIconKey } from '../../lib/categoryIcon'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import { formatMoneyInput, parseMoneyInput, formatMoneyValueForInput } from '../../lib/utils'
import { evaluateExpression } from '../../lib/calcParser'
import { updateTransaction } from '../../services/transactionService'
import { getLocalDateString } from '../../lib/dateUtils'
import { LayoutGrid, ChevronDown, Sliders, Pencil, Layers } from 'lucide-react'

export default function TransactionEditSheet({
  isOpen,
  onClose,
  transaction,
  formData: propFormData,
  setFormData: propSetFormData,
  onSubmit: propOnSubmit,
  onSaved,
  locale,
  wallets = [],
}) {
  const { t } = useTranslation()
  const [internalFormData, setInternalFormData] = useState(null)
  const [prevTxKey, setPrevTxKey] = useState(null)

  const currentTxKey = isOpen && transaction && !propFormData ? `${transaction.id}_${transaction.updatedAt || transaction.amount}` : null
  if (currentTxKey !== prevTxKey) {
    setPrevTxKey(currentTxKey)
    if (currentTxKey) {
      const tgtWallet = wallets?.find((w) => String(w.id) === String(transaction.targetWalletId))
      const tgtCurr = tgtWallet?.currency || 'IDR'
      setInternalFormData({
        id: transaction.id,
        amount: formatMoneyValueForInput(transaction.amount || 0, transaction.currency || 'IDR'),
        type: transaction.type || 'expense',
        category: transaction.category || '',
        date: transaction.date || getLocalDateString(),
        walletId: transaction.walletId ? String(transaction.walletId) : '',
        targetWalletId: transaction.targetWalletId ? String(transaction.targetWalletId) : '',
        targetAmount: transaction.targetAmount ? formatMoneyValueForInput(transaction.targetAmount, tgtCurr) : '',
        notes: transaction.notes || '',
        currency: transaction.currency || 'IDR',
        isSplit: Boolean(transaction.isSplit),
        splitItems: Array.isArray(transaction.splitItems) ? [...transaction.splitItems] : [],
        receiptImage: transaction.receiptImage || null,
        isExcludeAnalyticsTx: Boolean(transaction.isExcludeAnalyticsTx),
      })
    } else {
      setInternalFormData(null)
    }
  }

  const formData = propFormData || internalFormData
  const setFormData = propSetFormData || setInternalFormData
  const [walletModalMode, setWalletModalMode] = useState(null)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoryError, setCategoryError] = useState(false)
  const [walletError, setWalletError] = useState(false)
  const [amountError, setAmountError] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false)

  const handleApplyAiReceipt = useCallback((scanResult, imagePreview) => {
    if (!scanResult) return
    setIsReceiptScannerOpen(false)
    setFormData((prev) => {
      const nextAmount = scanResult.amount ? formatMoneyInput(String(scanResult.amount), prev.currency) : prev.amount
      const nextDate = scanResult.date || prev.date
      const nextNotes = scanResult.notes || scanResult.merchant || prev.notes
      let nextCat = prev.category
      if (scanResult.category) {
        nextCat = scanResult.category
      }
      return {
        ...prev,
        amount: nextAmount,
        date: nextDate,
        notes: nextNotes,
        category: nextCat,
        receiptImage: imagePreview || prev.receiptImage,
      }
    })
  }, [setFormData])

  const categoryButtonRef = useRef(null)
  const walletButtonRef = useRef(null)
  const receiptInputRef = useRef(null)
  const receiptSectionRef = useRef(null)

  const handleTriggerReceiptUpload = useCallback(() => {
    receiptInputRef.current?.click()
    receiptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  useBackButton(() => {
    if (isReceiptScannerOpen) {
      setIsReceiptScannerOpen(false)
      return
    }
    if (walletModalMode) {
      setWalletModalMode(null)
      return
    }
    if (isCatModalOpen) {
      setIsCatModalOpen(false)
      return
    }
    if (previewImage) {
      setPreviewImage(null)
      return
    }
    onClose?.()
  }, Boolean(isOpen))

  const selectedWallet = useMemo(
    () => wallets?.find((w) => String(w.id) === String(formData?.walletId)),
    [wallets, formData?.walletId]
  )
  const selectedTargetWallet = useMemo(
    () => wallets?.find((w) => String(w.id) === String(formData?.targetWalletId)),
    [wallets, formData?.targetWalletId]
  )
  const isCrossCurrencyTransfer = useMemo(() => {
    if (formData?.type !== 'transfer') return false
    if (!selectedWallet || !selectedTargetWallet) return false
    const srcCurr = selectedWallet.currency || formData?.currency || 'IDR'
    const tgtCurr = selectedTargetWallet.currency || 'IDR'
    return srcCurr !== tgtCurr
  }, [formData?.type, selectedWallet, selectedTargetWallet, formData?.currency])
  const targetCurrency = selectedTargetWallet?.currency || 'IDR'

  const isCashWallet = useMemo(
    () =>
      Boolean(
        selectedWallet &&
          (selectedWallet.institutionType === 'cash' ||
            selectedWallet.customIcon === 'dollar' ||
            selectedWallet.customIcon === 'cash' ||
            String(selectedWallet.name || '').toLowerCase().includes('cash') ||
            String(selectedWallet.name || '').toLowerCase().includes('tunai'))
      ),
    [selectedWallet]
  )

  const modeAccent =
    formData?.type === 'expense'
      ? 'var(--expense)'
      : formData?.type === 'income'
      ? 'var(--income)'
      : formData?.type === 'transfer'
      ? 'var(--transfer)'
      : 'var(--accent)'

  const handleTypeSelect = useCallback(
    (nextType) => {
      setFormData((prev) => ({
        ...prev,
        type: nextType,
        category: nextType === 'transfer' ? 'transfer' : prev.type === nextType ? prev.category : '',
      }))
    },
    [setFormData]
  )

  const handleSwapWallets = useCallback(() => {
    setFormData((prev) => {
      const currentSource = prev.walletId
      const currentTarget = prev.targetWalletId
      if (!currentSource && !currentTarget) return prev

      const chosen = wallets?.find((w) => String(w.id) === String(currentTarget))
      const newCurr = chosen?.currency || prev.currency

      return {
        ...prev,
        walletId: currentTarget,
        targetWalletId: currentSource,
        currency: newCurr,
        amount: formatMoneyInput(prev.amount, newCurr),
      }
    })
  }, [wallets, setFormData])

  const handleSelectWallet = useCallback(
    (selectedIdRaw) => {
      const selectedId = String(selectedIdRaw)
      if (!selectedId) return

      if (walletModalMode === 'targetWalletId') {
        setFormData((prev) => ({ ...prev, targetWalletId: selectedId }))
      } else {
        const chosen = wallets?.find((w) => String(w.id) === selectedId)
        const newCurr = chosen?.currency || formData?.currency
        setFormData((prev) => ({
          ...prev,
          walletId: selectedId,
          currency: newCurr,
          amount: formatMoneyInput(prev.amount, newCurr),
        }))
      }
      setWalletError(false)
      setWalletModalMode(null)
    },
    [walletModalMode, wallets, formData?.currency, setFormData]
  )

  const handleSplitItemChange = useCallback(
    (index, field, value) => {
      setFormData((prev) => {
        const nextItems = [...(prev.splitItems || [])]
        const currentItem = nextItems[index] || {}

        let nextValue = value
        if (field === 'amount') {
          if (!value || !String(value).trim()) {
            nextValue = ''
          } else {
            nextValue = parseMoneyInput(value, prev.currency)
          }
        }

        nextItems[index] = {
          ...currentItem,
          [field]: nextValue,
        }

        let nextAmount = prev.amount
        if (field === 'amount') {
          const sum = nextItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)
          nextAmount = formatMoneyValueForInput(sum, prev.currency)
        }

        return {
          ...prev,
          splitItems: nextItems,
          amount: nextAmount,
        }
      })
    },
    [setFormData]
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      setSubmitError('')
      if (formData.type !== 'transfer' && (!formData.category || !formData.category.trim())) {
        setCategoryError(true)
        setSubmitError('')
        categoryButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
      if (!formData.walletId) {
        setWalletError(true)
        setSubmitError('')
        walletButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
      if (formData.type === 'transfer') {
        if (!formData.targetWalletId) {
          setSubmitError(t('tx.selectTargetWallet', 'Silakan pilih dompet tujuan.'))
          return
        }
        if (String(formData.walletId) === String(formData.targetWalletId)) {
          setSubmitError(t('tx.sameWalletTransfer', 'Dompet asal dan tujuan tidak boleh sama.'))
          return
        }
      }

      const evalResult = evaluateExpression(formData.amount, formData.currency)
      const totalAmount =
        evalResult.isValid && evalResult.result !== null
          ? evalResult.result
          : parseMoneyInput(formData.amount, formData.currency)

      if (formData.type !== 'balance_adjustment' && (!Number.isFinite(totalAmount) || totalAmount <= 0)) {
        setAmountError(true)
        setSubmitError(t('tx.amountPositive', 'Nominal transaksi harus lebih dari 0.'))
        return
      }

      if (formData.isSplit && Array.isArray(formData.splitItems) && formData.splitItems.length > 0) {
        for (const item of formData.splitItems) {
          const itemAmount = Number(item.amount) || 0
          if (itemAmount <= 0) {
            setAmountError(true)
            setSubmitError(t('tx.splitAmountInvalid', 'Setiap rincian transaksi harus memiliki nominal lebih dari 0.'))
            return
          }
          if (!item.category || !String(item.category).trim()) {
            setCategoryError(true)
            setSubmitError(t('tx.splitCategoryRequired', 'Kategori pada setiap rincian transaksi harus dipilih.'))
            return
          }
        }
        const splitSum = formData.splitItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)
        if (Math.abs(splitSum - totalAmount) > 0.05) {
          setAmountError(true)
          setSubmitError(t('tx.splitTotalMismatch', 'Total nominal harus sama dengan jumlah rincian split item.'))
          return
        }
      }

      setSubmitError('')
      setCategoryError(false)
      setWalletError(false)
      setAmountError(false)
      if (typeof propOnSubmit === 'function') {
        propOnSubmit(event)
      } else if (transaction?.id) {
        await updateTransaction(transaction.id, {
          ...formData,
          amount: totalAmount,
          targetAmount: isCrossCurrencyTransfer && formData.targetAmount ? parseMoneyInput(formData.targetAmount, targetCurrency) : null,
          updatedAt: new Date().toISOString(),
        })
        onSaved?.()
        onClose?.()
      }
    } catch (err){
      console.warn('[TransactionEditSheet]', err)
      setSubmitError(err.message || t('common.error.saveFailed', 'Gagal menyimpan transaksi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!formData) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      enableBackButton={false}
      onClose={() => {
        setSubmitError('')
        setCategoryError(false)
        setWalletError(false)
        setAmountError(false)
        onClose()
      }}
      title={
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                formData.type === 'expense'
                  ? 'var(--expense-tint)'
                  : formData.type === 'income'
                  ? 'var(--income-tint)'
                  : formData.type === 'transfer'
                  ? 'var(--transfer-subtle)'
                  : 'color-mix(in srgb, var(--accent) 15%, transparent)',
            }}
          >
            <Pencil
              className="h-3 w-3"
              style={{
                color: modeAccent,
              }}
            />
          </div>
          <span className="text-sm font-bold tracking-tight text-[var(--fg)]">
            {t('tx.modal.editTitle', 'Edit Transaksi')}
          </span>
        </div>
      }
      maxHeight="max-h-[95dvh]"
      scrollable={true}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-1/3 h-[44px] rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] border border-[var(--border)] bg-[var(--field-bg)] transition-colors cursor-pointer active:scale-[0.98]"
            onClick={onClose}
          >
            {t('addTx.cancel', 'Batal')}
          </button>
          <button
            type="submit"
            form="transaction-edit-form"
            disabled={isSubmitting}
            style={{
              backgroundColor: modeAccent,
            }}
            className={`flex-1 h-[44px] rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              formData.type === 'transfer' ? 'shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:opacity-90' : ''
            }`}
          >
            {t('tx.modal.update', 'Perbarui Transaksi')}
          </button>
        </div>
      }
    >
      {submitError ? (
        <div className="mb-2">
          <ToastBanner message={submitError} />
        </div>
      ) : null}

      {/* Mode Toggle - Sliding Segmented Track */}
      <div className="mb-3">
        {formData.type === 'balance_adjustment' ? (
          <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold select-none">
            <Sliders className="h-3.5 w-3.5" />
            <span>{t('tx.type.adjustment', 'Penyesuaian Saldo Sistem')}</span>
          </div>
        ) : (
          <TransactionTypeSelector
            txType={formData.type}
            onSelectType={handleTypeSelect}
          />
        )}
      </div>

      {/* Form Content */}
      <form id="transaction-edit-form" onSubmit={handleSubmit} className="space-y-3">
        <AmountInput
          amount={formData.amount}
          onChangeAmount={(val) => {
            setAmountError(false)
            setFormData((p) => ({ ...p, amount: val }))
          }}
          currency={formData.currency}
          onChangeCurrency={(val) => {
            setAmountError(false)
            setFormData((p) => ({ ...p, currency: val }))
          }}
          isCashWallet={isCashWallet}
          txType={formData.type}
          onOpenAiScan={() => setIsReceiptScannerOpen(true)}
          onAttachReceipt={handleTriggerReceiptUpload}
          modeAccent={modeAccent}
          hasError={amountError}
        />

        {/* Form Fields Container */}
        <div className="space-y-2.5">
          {/* Row 1: Tanggal + Dompet Asal */}
          <div className="flex items-stretch gap-2">
            <div className="shrink-0 min-w-[125px] sm:min-w-[135px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 h-[14px] flex items-center">
                {t('addTx.date', 'Tanggal')}
              </div>
              <div className="bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] rounded-xl px-0.5 h-[42px] hover:border-[var(--field-border-hover,var(--border-strong))] transition-colors">
                <CustomDatePicker
                  value={formData.date}
                  onChange={(val) => setFormData((p) => ({ ...p, date: val }))}
                  title={t('tx.date.selectTitle', 'Pilih Tanggal Transaksi')}
                  buttonClassName="border-none bg-transparent shadow-none px-3 py-2 min-h-[42px]"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 h-[14px]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                  {formData.type === 'transfer' ? t('tx.transferFrom', 'Dari Dompet') : t('addTx.wallet', 'Dompet')}
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
                  placeholder={
                    formData.type === 'transfer'
                      ? t('tx.transferFrom', 'Pilih Dompet Asal')
                      : t('loans.selectWallet', 'Pilih Wallet / Akun')
                  }
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
            {formData.type === 'transfer' ? (
              <div>
                <div className="flex items-center justify-between mb-1 h-[18px]">
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[var(--transfer)]" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M12 19l-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--transfer)]">
                      {t('tx.transferTo', 'Ke Dompet Tujuan')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwapWallets}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--transfer)]/10 hover:bg-[var(--transfer)]/20 text-[var(--transfer)] text-[10.5px] font-bold transition active:scale-95 cursor-pointer"
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
                {isCrossCurrencyTransfer && (
                  <div className="mt-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-2.5 space-y-1.5 animate-[ft-fade-in_0.2s_ease-out]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        {t('tx.targetAmount', 'Nominal Diterima')} ({targetCurrency})
                      </span>
                      <span className="text-[10px] text-[var(--accent)] font-semibold">
                        {t('tx.fixedRateLocked', 'Nilai tukar terkunci')}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.targetAmount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setFormData((prev) => ({ ...prev, targetAmount: formatMoneyInput(val, targetCurrency) }))
                      }}
                      placeholder={formatMoneyInput('0', targetCurrency)}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-xs font-black text-[var(--fg)] tracking-wide focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                )}
              </div>
            ) : formData.type === 'balance_adjustment' ? (
              <div>
                <div className="flex items-center justify-between mb-1 h-[18px]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                    {t('tx.category', 'Kategori')}
                  </div>
                </div>
                <div className="flex h-[42px] min-h-[42px] items-center rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 text-xs font-semibold text-amber-600 dark:text-amber-400 gap-2">
                  <Sliders className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>{locale === 'en' ? 'System Adjustment' : 'Penyesuaian Sistem'}</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1 h-[18px]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                    {t('addTx.category', 'Kategori')}
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
                  onClick={() => {
                    setCategoryError(false)
                    setIsCatModalOpen(true)
                  }}
                  className={`group flex w-full h-[42px] min-h-[42px] items-center justify-between gap-2.5 rounded-xl px-3 py-1 text-left transition-all duration-200 focus-visible:outline-none active:scale-[0.99] cursor-pointer ${
                    categoryError
                      ? 'bg-rose-500/10 border-2 border-rose-500 text-rose-500'
                      : formData.category
                      ? 'bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] text-[var(--fg)] hover:border-[var(--field-border-hover,var(--border-strong))]'
                      : 'bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] text-[var(--muted)] hover:border-[var(--field-border-hover,var(--border-strong))]'
                  }`}
                >
                  {formData.category && formData.category.trim() ? (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-7 w-7 rounded-full aspect-square flex items-center justify-center shrink-0 border border-[var(--border)] bg-[var(--panel)] overflow-hidden shadow-2xs">
                        <CategoryIcon
                          icon={resolveTransactionIconKey(formData.category, formData.type)}
                          className="h-4 w-4 text-[var(--fg)]/80"
                        />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
                          {formData.type === 'expense'
                            ? formatExpenseCategory(formData.category, locale)
                            : formatIncomeCategory(formData.category, locale)}
                        </p>
                        <div className="text-[10px] font-medium text-[var(--muted)] truncate mt-0.5 leading-none">
                          {formData.category.includes('/')
                            ? formData.type === 'expense'
                              ? formatExpenseCategory(formData.category.split('/')[0], locale)
                              : formatIncomeCategory(formData.category.split('/')[0], locale)
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

          {/* Row 2.5: Split Transaction Breakdown (if split) */}
          {formData.isSplit && Array.isArray(formData.splitItems) && formData.splitItems.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-500">
                  <Layers className="h-3.5 w-3.5" />
                  <span>
                    {t('transactions.splitItemsCount', 'Rincian Split Transaksi ({{count}})', {
                      count: formData.splitItems.length,
                    })}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-[var(--muted-2)]">
                  {t('tx.splitEditableHint', 'Edit item & nominal')}
                </span>
              </div>
              <div className="space-y-2">
                {formData.splitItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]/60 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name || item.category || ''}
                        onChange={(e) => handleSplitItemChange(idx, 'category', e.target.value)}
                        placeholder={t('categories.name', 'Kategori / Item')}
                        className="flex-1 min-w-0 bg-[var(--field-bg)] rounded-lg border border-[var(--border)]/50 px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-[var(--muted-2)]">
                          {formData.currency || 'IDR'}
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            item.amount !== '' && item.amount != null
                              ? formData.currency === 'IDR'
                                ? Number(item.amount).toLocaleString('id-ID')
                                : item.amount
                              : ''
                          }
                          onChange={(e) => handleSplitItemChange(idx, 'amount', e.target.value)}
                          placeholder="0"
                          className="w-24 text-right bg-[var(--field-bg)] rounded-lg border border-[var(--border)]/50 px-2 py-1.5 text-xs font-bold tabular-nums text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleSplitItemChange(idx, 'notes', e.target.value)}
                      placeholder={t('addTx.notesPlaceholder', 'Tulis catatan transaksi (opsional)...')}
                      className="w-full bg-[var(--field-bg)] rounded-lg border border-[var(--border)]/50 px-2.5 py-1 text-[11px] text-[var(--muted)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Catatan */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 h-[14px] flex items-center">
              {t('addTx.notes', 'Catatan')}
            </div>
            <textarea
              value={formData.notes || ''}
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck={true}
              autoComplete="on"
              onChange={(e) => {
                setFormData((p) => ({ ...p, notes: e.target.value }))
                const el = e.target
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 80)}px`
              }}
              placeholder={t('addTx.notesPlaceholder', 'Tulis catatan transaksi (opsional)...')}
              rows={1}
              className="w-full bg-[var(--field-bg)] rounded-xl border border-[var(--field-border,var(--border))] py-2.5 px-3.5 text-xs sm:text-sm font-normal text-[var(--fg)] outline-none placeholder:text-[var(--muted-2)]/60 hover:border-[var(--field-border-hover,var(--border-strong))] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--ring)] transition-all resize-none"
            />
          </div>

          {/* Row 4: Lampiran Struk */}
          <ReceiptUploadAttachment
            inputRef={receiptInputRef}
            containerRef={receiptSectionRef}
            value={formData.receiptImage || formData.receipt || formData.receiptUrl || formData.image || ''}
            onChange={(img) =>
              setFormData((prev) => ({ ...prev, receiptImage: img || null, receipt: img || null }))
            }
            onView={(img) => setPreviewImage(img)}
          />
        </div>
      </form>

      {/* Wallet Select Modal */}
      <WalletSelectModal
        isOpen={Boolean(walletModalMode)}
        onClose={() => setWalletModalMode(null)}
        wallets={wallets}
        selectedWalletId={walletModalMode === 'targetWalletId' ? formData.targetWalletId : formData.walletId}
        onSelectWallet={handleSelectWallet}
        title={
          walletModalMode === 'targetWalletId'
            ? t('tx.transferTo', 'Pilih Dompet Tujuan')
            : formData.type === 'transfer'
            ? t('tx.transferFrom', 'Pilih Dompet Asal')
            : t('wallets.selectWalletTitle', 'Pilih Dompet / Akun')
        }
      />

      {/* Category Picker Modal */}
      <CategoryPickerModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        txType={formData.type || 'expense'}
        selectedCategory={formData.category}
        onSelectCategory={(cat) => {
          setCategoryError(false)
          setFormData((prev) => ({ ...prev, category: cat }))
        }}
      />

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        imageSrc={previewImage}
        notes={formData.notes}
        date={formData.date}
        category={formData.category}
        amountFormatted={formData.amount ? `${formData.amount} ${formData.currency || ''}` : null}
        zIndex="z-[80]"
      />

      {/* AI Receipt Scanner Modal */}
      {isReceiptScannerOpen && (
        <ReceiptScannerModal
          isOpen={isReceiptScannerOpen}
          onClose={() => setIsReceiptScannerOpen(false)}
          onApplyReceipt={handleApplyAiReceipt}
        />
      )}
    </BottomSheet>
  )
}
