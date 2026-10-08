import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import {
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Plus,
  Receipt,
  Calendar,
  Copy,
  Check,
  Pencil,
  Store,
  Layers,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import TransactionEditSheet from '../transactions/TransactionEditSheet'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { formatCurrency, formatMoneyValueForInput, parseMoneyInput, convertCurrency, FALLBACK_EXCHANGE_RATES } from '../../lib/utils'
import { evaluateExpression } from '../../lib/calcParser'
import { getCachedCurrencyRates } from '../../lib/api'
import { getDecryptedNoteSync, warmupDecryptionCache, isFieldEncrypted } from '../../lib/fieldEncryption'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import useSettingsStore from '../../store/useSettingsStore'
import { deleteTransaction, updateTransaction } from '../../services/transactionService'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import { copyToClipboard } from '../../lib/clipboard'

function generateReceiptRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = ''
  for (let i = 0; i < 8; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `REC-${hash.slice(0, 4)}-${hash.slice(4)}`
}

export default function AiDigitalReceipt({
  transactions = [],
  rawPrompt = '',
  merchant = '',
  onLogAnother,
  onClose,
  wallets = [],
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const closeQuickLog = useChatStore((s) => s.closeQuickLog)

  const [isUndone, setIsUndone] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [refCode] = useState(generateReceiptRef)

  // Local state for interactive on-receipt modifications
  const [localTxs, setLocalTxs] = useState(() => (Array.isArray(transactions) ? transactions : [transactions]))
  const [editingTx, setEditingTx] = useState(null)
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    type: 'expense',
    category: '',
    notes: '',
    currency: defaultCurrency,
  })

  const [prevTxs, setPrevTxs] = useState(transactions)
  if (prevTxs !== transactions) {
    setPrevTxs(transactions)
    setLocalTxs(Array.isArray(transactions) ? transactions : [transactions])
  }

  const txList = localTxs
  const isSingle = txList.length === 1
  const singleTx = txList[0] || {}
  const engine = singleTx.engine || txList[0]?.engine || (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_nlp' : 'online_ai')
  const isOnlineAi = engine === 'online_ai'

  const [, setDecryptedTick] = useState(0)

  useEffect(() => {
    if (txList && txList.length > 0) {
      warmupDecryptionCache(txList).catch(() => {})
    }
  }, [txList])

  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((t) => t + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  const contextualTheme = useMemo(() => {
    if (isSingle) {
      if (singleTx.type === 'income') {
        return {
          glow: 'from-emerald-500/15 via-emerald-500/4 to-transparent',
          line: 'from-transparent via-emerald-500/50 to-transparent',
          badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
          title: t('ai.incomeLogged', 'Pemasukan Tercatat'),
          tag: 'text-emerald-500',
        }
      }
      if (singleTx.type === 'transfer') {
        return {
          glow: 'from-sky-500/15 via-sky-500/4 to-transparent',
          line: 'from-transparent via-sky-500/50 to-transparent',
          badge: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
          title: t('ai.transferLogged', 'Transfer Berhasil'),
          tag: 'text-sky-500',
        }
      }
      return {
        glow: 'from-rose-500/12 via-rose-500/3 to-transparent',
        line: 'from-transparent via-rose-500/40 to-transparent',
        badge: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
        title: t('ai.expenseLogged', 'Pengeluaran Tercatat'),
        tag: 'text-rose-500',
      }
    }

    const hasIncome = txList.some((t) => t.type === 'income')
    const hasExpense = txList.some((t) => t.type === 'expense')

    if (hasIncome && !hasExpense) {
      return {
        glow: 'from-emerald-500/15 via-emerald-500/4 to-transparent',
        line: 'from-transparent via-emerald-500/50 to-transparent',
        badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
        title: t('ai.multipleIncomeLogged', '{{count}} Pemasukan Tercatat', { count: txList.length }),
        tag: 'text-emerald-500',
      }
    }
    if (hasExpense && !hasIncome) {
      return {
        glow: 'from-rose-500/12 via-rose-500/3 to-transparent',
        line: 'from-transparent via-rose-500/40 to-transparent',
        badge: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
        title: t('ai.multipleExpenseLogged', '{{count}} Pengeluaran Tercatat', { count: txList.length }),
        tag: 'text-rose-500',
      }
    }

    return {
      glow: 'from-[var(--accent)]/15 via-[var(--accent)]/4 to-transparent',
      line: 'from-transparent via-[var(--accent)]/50 to-transparent',
      badge: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      title: t('ai.multipleTxLogged', '{{count}} Transaksi Tercatat', { count: txList.length }),
      tag: 'text-[var(--accent)]',
    }
  }, [isSingle, singleTx.type, txList, t])

  const activeRates = useMemo(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }, [])
  const allSameCurrency = txList.length > 0 && txList.every((t) => (t.currency || defaultCurrency) === (txList[0]?.currency || defaultCurrency))
  const displayCurrency = allSameCurrency ? (txList[0]?.currency || defaultCurrency) : defaultCurrency

  const totalExpense = txList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + convertCurrency(Number(t.amount) || 0, t.currency || defaultCurrency, displayCurrency, activeRates), 0)
  const totalIncome = txList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + convertCurrency(Number(t.amount) || 0, t.currency || defaultCurrency, displayCurrency, activeRates), 0)
  const netTotal = totalIncome - totalExpense

  const handleUndo = async () => {
    setIsUndoing(true)
    try {
      await Promise.all(
        txList.filter((tx) => tx.id).map((tx) => deleteTransaction(tx.id))
      )
      setIsUndone(true)
    } catch (err){
      console.warn('[AiDigitalReceipt]', err)
      // ignore
    } finally {
      setIsUndoing(false)
    }
  }

  const handleCopyRef = async () => {
    const success = await copyToClipboard(refCode)
    if (success) {
      setCopiedRef(true)
      setTimeout(() => setCopiedRef(false), 2000)
    }
  }

  const handleViewTransactions = () => {
    if (onClose) onClose()
    closeQuickLog()
    navigate('/transactions')
  }

  const getWalletInfo = (walletId) => {
    return wallets.find((w) => String(w.id) === String(walletId))
  }

  // Edit Handlers using the standard form
  const handleStartEdit = (tx) => {
    setEditingTx(tx)
    const txCurrency = tx.currency || defaultCurrency
    setEditFormData({
      date: tx.date || format(new Date(), 'yyyy-MM-dd'),
      amount: formatMoneyValueForInput(tx.amount, txCurrency),
      type: tx.type || 'expense',
      category: tx.category || '',
      notes: (isFieldEncrypted(tx.notes) ? getDecryptedNoteSync(tx.notes) : tx.notes) || '',
      currency: txCurrency,
      walletId: tx.walletId,
      targetWalletId: tx.targetWalletId || '',
      receiptImage: tx.receiptImage || null,
      isSplit: tx.isSplit || false,
      splitItems: Array.isArray(tx.splitItems)
        ? tx.splitItems.map((si) => ({
            ...si,
            notes: (isFieldEncrypted(si?.notes) ? getDecryptedNoteSync(si.notes) : si?.notes) || '',
          }))
        : [],
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTx?.id) return
    const evalResult = evaluateExpression(editFormData.amount, editFormData.currency)
    const numericAmt =
      evalResult?.isValid && evalResult?.result !== null
        ? evalResult.result
        : parseMoneyInput(editFormData.amount, editFormData.currency)

    const updated = {
      date: editFormData.date,
      amount: numericAmt,
      type: editFormData.type,
      category: editFormData.category,
      notes: editFormData.notes,
      currency: editFormData.currency,
      walletId: editFormData.walletId,
      targetWalletId: editFormData.targetWalletId || '',
      receiptImage: editFormData.receiptImage || null,
      isSplit: editFormData.isSplit || false,
      splitItems: editFormData.splitItems || [],
    }

    try {
      await updateTransaction(editingTx.id, updated)
      setLocalTxs((prev) =>
        prev.map((t) => (t.id === editingTx.id ? { ...t, ...updated } : t))
      )
      setEditingTx(null)
    } catch (err){
      console.warn('[AiDigitalReceipt]', err)
      // ignore
    }
  }

  // Format creation timestamp
  const dateLocaleObj = locale === 'id' ? idLocale : enUS
  const formattedTime = txList[0]?.time || singleTx.time || format(new Date(), 'HH:mm')

  const uniqueDates = Array.from(new Set(txList.map((t) => t.date).filter(Boolean)))
  const receiptDate = (() => {
    if (uniqueDates.length === 1) {
      const d = new Date(uniqueDates[0] + 'T12:00:00')
      return `${format(d, 'EEEE, d MMMM yyyy', { locale: dateLocaleObj })} • ${formattedTime}`
    }
    if (uniqueDates.length > 1) {
      uniqueDates.sort()
      const dFirst = new Date(uniqueDates[0] + 'T12:00:00')
      const dLast = new Date(uniqueDates[uniqueDates.length - 1] + 'T12:00:00')
      return `${format(dFirst, 'd MMM', { locale: dateLocaleObj })} - ${format(dLast, 'd MMM yyyy', { locale: dateLocaleObj })}`
    }
    const firstTxDate = singleTx.date ? new Date(singleTx.date + 'T12:00:00') : new Date()
    return `${format(firstTxDate, 'EEEE, d MMMM yyyy', { locale: dateLocaleObj })} • ${formattedTime}`
  })()

  // Undone State View
  if (isUndone) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in duration-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
          <RotateCcw className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-[var(--fg)]">{t('ai.txUndone', 'Transaksi Dibatalkan')}</h3>
          <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
            {txList.length > 1 ? t('ai.multipleTxUndoneDesc', '{{count}} transaksi telah dihapus dari riwayat keuangan Anda.', { count: txList.length }) : t('ai.txUndoneDesc', 'Transaksi telah dihapus dari riwayat keuangan Anda.')}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogAnother}
          className="ft-btn-primary py-2.5 px-5 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition mt-2"
        >
          <Plus className="h-4 w-4" />
          <span>{t('ai.logAnother', 'Catat Transaksi Lain')}</span>
        </button>
      </div>
    )
  }

  const activeMerchant = merchant || singleTx.merchant || txList.find((t) => t.merchant)?.merchant || ''

  return (
    <div className="space-y-2.5 ft-mode-enter">
      {/* ── DIGITAL RECEIPT CARD (Compact FinTech Ticket) ────── */}
      <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-lg overflow-hidden">
        {/* Top Accent Line */}
        <div className={`h-1 w-full bg-gradient-to-r ${contextualTheme.line}`} />

        {/* Unified Fintech Ticket Header (Store/Merchant + Verified AI Badge + Date) */}
        <div className="px-3.5 py-2.5 border-b border-[var(--border)]/40 bg-[var(--field-bg)]/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {activeMerchant ? (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
                <Store className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div className={`p-1.5 rounded-lg ${contextualTheme.badge} border flex items-center justify-center shrink-0 shadow-2xs`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="block text-xs font-black text-[var(--fg)] truncate leading-tight">
                {activeMerchant || contextualTheme.title}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isOnlineAi ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-500 shrink-0">
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>{t('ai.engine.online', 'AI Gemini (Online)')}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-500 shrink-0">
                    <WifiOff className="h-2.5 w-2.5" />
                    <span>{t('ai.engine.offline', 'NLP Lokal (Offline)')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted)] shrink-0 tabular-nums bg-[var(--panel)] px-2 py-0.5 rounded-md border border-[var(--border)]/60">
            <Calendar className="h-2.5 w-2.5" />
            <span>{receiptDate}</span>
          </div>
        </div>

        {/* Prompt Citation if available */}
        {rawPrompt ? (
          <div className="px-3 py-1 bg-[var(--field-bg)]/20 border-b border-[var(--border)]/30 text-[10px] text-[var(--muted)] italic truncate">
            &ldquo;{rawPrompt}&rdquo;
          </div>
        ) : null}

        {/* ── SINGLE TRANSACTION COMPACT VIEW ────────────────────── */}
        {isSingle ? (() => {
          const tx = singleTx
          const isIncome = tx.type === 'income'
          const isTransfer = tx.type === 'transfer'
          const iconKey = resolveTransactionIconKey(tx.category, tx.type)
          const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
          const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
          const walletObj = getWalletInfo(tx.walletId)
          const walletLogo = walletObj ? getWalletLogoUrl(walletObj) : null
          const targetWalletObj = isTransfer ? getWalletInfo(tx.targetWalletId) : null
          const targetWalletLogo = targetWalletObj ? getWalletLogoUrl(targetWalletObj) : null

          return (
            <div className="p-3 sm:p-3.5 flex flex-col space-y-2.5">
              {/* Hero Amount & Category Badge in Compact Row */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/40">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl ${colorClass} shrink-0 shadow-2xs`}>
                    <CategoryIcon icon={iconKey} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-black text-[var(--fg)] leading-tight truncate">
                      {labels.main || tx.category}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--muted)] mt-0.5 truncate">
                      <span className={`font-bold ${isIncome ? 'text-emerald-500' : isTransfer ? 'text-sky-500' : 'text-rose-500'}`}>
                        {isIncome ? t('tx.income', 'Pemasukan') : isTransfer ? t('tx.transfer', 'Transfer') : t('tx.expense', 'Pengeluaran')}
                      </span>
                      {labels.sub ? <span>• {labels.sub}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-xl font-black tabular-nums tracking-tight ${
                    isIncome ? 'ft-income-text' : isTransfer ? 'text-sky-500' : 'ft-expense-text'
                  }`}>
                    {isIncome ? '+' : isTransfer ? '' : '-'}
                    {formatCurrency(Math.abs(Number(tx.amount || 0)), tx.currency || defaultCurrency)}
                  </span>
                </div>
              </div>

              {/* Compact Key-Value Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-[var(--field-bg)]/30 rounded-xl p-2.5 border border-[var(--border)]/40">
                {/* Account / Wallet */}
                <div className="min-w-0">
                  <span className="text-[9.5px] font-bold text-[var(--muted)] block uppercase tracking-wider">
                    {isTransfer ? t('tx.transferSource', 'Sumber Saldo') : t('tx.walletOrAccount', 'Dompet / Akun')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    {walletLogo ? (
                      <img src={walletLogo} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
                    ) : null}
                    <span className="font-bold text-[var(--fg)] truncate">
                      {walletObj?.name || t('wallets.primaryBadge', 'Dompet Utama')}
                    </span>
                  </div>
                </div>

                {/* Target Wallet for Transfer OR Currency + Payment Method */}
                {isTransfer && targetWalletObj ? (
                  <div className="min-w-0">
                    <span className="text-[9.5px] font-bold text-sky-500 block uppercase tracking-wider">
                      {t('tx.targetWallet', 'Dompet Tujuan')}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      {targetWalletLogo ? (
                        <img src={targetWalletLogo} alt="" className="h-3.5 w-3.5 rounded-full object-contain shrink-0" />
                      ) : null}
                      <span className="font-bold text-sky-500 truncate">
                        {targetWalletObj.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <span className="text-[9.5px] font-bold text-[var(--muted)] block uppercase tracking-wider">
                      {t('tx.currencyAndMethod', 'Valuta & Metode')}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5 font-bold text-[var(--fg)] truncate">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--panel)] border border-[var(--border)] text-[9.5px]">
                        {tx.currency || defaultCurrency}
                      </span>
                      {tx.paymentMethod ? (
                        <span className="text-[10.5px] text-[var(--muted)] truncate">
                          • {tx.paymentMethod}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* User Notes */}
                {(() => {
                  const rawNote = tx.notes || ''
                  const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
                  const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote
                  if (!safeNote) return null
                  return (
                    <div className="col-span-2 pt-1 mt-0.5 border-t border-[var(--border)]/30 min-w-0">
                      <span className="text-[9.5px] font-bold text-[var(--muted)] block uppercase tracking-wider">
                        {t('addTx.notes', 'Catatan')}
                      </span>
                      <p className="text-[11px] text-[var(--fg)] italic line-clamp-2 break-words [overflow-wrap:anywhere] mt-0.5">
                        &ldquo;{safeNote}&rdquo;
                      </p>
                    </div>
                  )
                })()}
              </div>

              {/* Itemized Struk Breakdown if available */}
              {Array.isArray(tx.items) && tx.items.length > 0 ? (
                <div className="pt-0.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)] px-0.5">
                    <span className="flex items-center gap-1">
                      <Receipt className="h-3 w-3 text-[var(--accent)]" />
                      <span>{t('transactions.ocr.itemsList', 'Rincian Item ({{count}})', { count: tx.items.length })}</span>
                    </span>
                  </div>
                  <div className="space-y-1 bg-[var(--field-bg)]/50 rounded-xl p-2 border border-[var(--border)]/40 text-[11px]">
                    <div className="max-h-36 overflow-y-auto overscroll-contain ft-hide-scrollbar space-y-1 pr-0.5">
                      {tx.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-[10.5px]">
                          <div className="min-w-0 flex-1 truncate">
                            <span className="font-semibold text-[var(--fg)]">{item.name}</span>
                            {item.qty && item.qty > 1 ? (
                              <span className="text-[9.5px] text-[var(--muted)] font-bold ml-1">x{item.qty}</span>
                            ) : null}
                          </div>
                          <span className="font-bold text-[var(--fg)] tabular-nums shrink-0">
                            {formatCurrency(Number(item.price || 0), tx.currency || defaultCurrency)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Subtotal, Tax, Discount Breakdown */}
                    {(tx.subtotal || tx.tax || tx.discount) ? (
                      <div className="pt-1.5 mt-1 border-t border-[var(--border)]/40 space-y-0.5 text-[10px]">
                        {tx.subtotal ? (
                          <div className="flex justify-between text-[var(--muted)] font-medium">
                            <span>{t('tx.subtotal', 'Subtotal')}</span>
                            <span className="tabular-nums">{formatCurrency(Number(tx.subtotal), tx.currency || defaultCurrency)}</span>
                          </div>
                        ) : null}
                        {tx.tax ? (
                          <div className="flex justify-between text-amber-500 font-medium">
                            <span>{t('tx.tax', 'Pajak (PPN/PB1)')}</span>
                            <span className="tabular-nums font-bold">+{formatCurrency(Number(tx.tax), tx.currency || defaultCurrency)}</span>
                          </div>
                        ) : null}
                        {tx.discount ? (
                          <div className="flex justify-between text-emerald-500 font-medium">
                            <span>{t('tx.discount', 'Diskon')}</span>
                            <span className="tabular-nums font-bold">-{formatCurrency(Number(tx.discount), tx.currency || defaultCurrency)}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })() : (
          /* ── MULTI TRANSACTION COMPACT VIEW ── */
          <div className="p-3 sm:p-3.5 flex flex-col">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
                <Layers className="h-3 w-3 text-[var(--accent)]" />
                <span>{t('transactions.ocr.itemsListTitle', 'Rincian Item Belanja')}</span>
              </div>
              <span className="rounded-full bg-[var(--field-bg)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--fg)] border border-[var(--border)]">
                {t('common.itemsCount', '{{count}} item', { count: txList.length })}
              </span>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto overscroll-contain ft-hide-scrollbar pr-0.5">
              {txList.map((tx, idx) => {
                const isIncome = tx.type === 'income'
                const isTransfer = tx.type === 'transfer'
                const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
                const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                const walletObj = getWalletInfo(tx.walletId)
                const walletLogo = walletObj ? getWalletLogoUrl(walletObj) : null
                const rawNote = tx.notes || ''
                const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
                const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote
                const itemName = safeNote || labels.main || tx.category

                return (
                  <div
                    key={tx.id || idx}
                    style={{ animationDelay: `${idx * 30}ms` }}
                    className="ft-receipt-item-enter flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--field-bg)]/50 border border-[var(--border)]/60 hover:border-[var(--accent)]/50 transition"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${colorClass}`}>
                        <CategoryIcon icon={iconKey} className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-bold text-[var(--fg)] leading-tight">
                          {itemName}
                        </p>
                        <div className="flex items-center gap-1 text-[9.5px] text-[var(--muted)] mt-0.5 truncate">
                          <span className="font-semibold text-[var(--accent)]">
                            {labels.main || tx.category}
                          </span>
                          {tx.date ? (
                            <span className="font-bold text-[var(--fg)] shrink-0">
                              • {format(new Date(tx.date + 'T12:00:00'), 'EEE, d MMM', { locale: dateLocaleObj })}
                            </span>
                          ) : null}
                          {walletObj ? (
                            <span className="font-medium text-[var(--muted)] shrink-0 flex items-center gap-1">
                              • {walletLogo ? <img src={walletLogo} alt="" className="h-3 w-3 rounded-full object-cover inline" /> : null}
                              {walletObj.name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <p className={`text-[11.5px] font-black tabular-nums tracking-tight ${
                        isIncome ? 'ft-income-text' : isTransfer ? 'text-sky-500' : 'ft-expense-text'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(Math.abs(Number(tx.amount || 0)), tx.currency || defaultCurrency)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tx)}
                        className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--panel)] transition cursor-pointer"
                        title={t('tx.modal.editTitle', 'Edit Transaksi')}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotals Breakdown */}
            <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-[11px] font-bold">
              <span className="text-[var(--muted)]">
                {t('tx.totalAmount', 'Total Keseluruhan')} ({txList.length} item)
              </span>
              <span className={`text-xs font-black tabular-nums ${netTotal >= 0 ? 'ft-income-text' : 'ft-expense-text'}`}>
                {netTotal >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(Number.isFinite(netTotal) ? netTotal : (totalExpense || totalIncome)), displayCurrency)}
              </span>
            </div>
          </div>
        )}

        {/* ── Pronounced Perforated Ticket Notches & Tear Line ────────────── */}
        <div className="relative flex items-center px-3 py-1 my-0.5">
          <div className="absolute -left-3 h-5 w-5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_-2px_0_3px_rgba(0,0,0,0.15)]" />
          <div className="w-full border-t-2 border-dashed border-[var(--border-strong)]/40" />
          <div className="absolute -right-3 h-5 w-5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_2px_0_3px_rgba(0,0,0,0.15)]" />
        </div>

        {/* Decorative Mini Barcode */}
        <div className="px-4 pt-1 flex items-center justify-center gap-[2px] opacity-30 select-none overflow-hidden" aria-hidden="true">
          {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 3, 1, 2, 4, 1, 2, 3].map((w, i) => (
            <div
              key={i}
              className="h-3 bg-[var(--fg)] rounded-xs shrink-0"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>

        {/* ── Compact Receipt Footer (Ref Code & Verification) ───────── */}
        <div className="px-3.5 py-2 bg-[var(--field-bg)]/40 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 font-mono text-[var(--muted)]">
            <Receipt className="h-3 w-3 text-[var(--accent)]" />
            <span className="tracking-wide font-bold">{refCode}</span>
            <button
              type="button"
              onClick={handleCopyRef}
              className="p-1 hover:text-[var(--fg)] hover:bg-[var(--panel)] rounded transition cursor-pointer"
              title={t('common.copyRef', 'Salin No. Referensi')}
            >
              {copiedRef ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          <span className={`font-black text-[9.5px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--panel)] border border-[var(--border)]/60 ${contextualTheme.tag}`}>
            FinTrack Verified
          </span>
        </div>
      </div>

      {/* ── Compact Action Buttons ────────────────────────────── */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        {/* Primary CTA */}
        <button
          type="button"
          onClick={onLogAnother}
          className="ft-btn-primary w-full py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99] transition rounded-xl"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
          <span>{t('ai.logAnother', 'Catat Transaksi Lagi')}</span>
        </button>

        {/* Secondary CTAs */}
        <div className="flex items-center gap-1.5">
          {isSingle && (
            <button
              type="button"
              onClick={() => handleStartEdit(singleTx)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
            >
              <Pencil className="h-3 w-3 text-[var(--accent)]" />
              <span>{t('common.edit', 'Edit')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleUndo}
            disabled={isUndoing}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{isUndoing ? t('common.cancelling', 'Membatalkan...') : t('common.undo', 'Batalkan')}</span>
          </button>

          <button
            type="button"
            onClick={handleViewTransactions}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
          >
            <span>{t('common.history', 'Riwayat')}</span>
            <ArrowRight className="h-3 w-3 text-[var(--muted)]" />
          </button>
        </div>
      </div>

      {/* ── Official Standard Transaction Edit Sheet ───────────── */}
      {editingTx && (
        <TransactionEditSheet
          isOpen={Boolean(editingTx)}
          onClose={() => setEditingTx(null)}
          formData={editFormData}
          setFormData={setEditFormData}
          onSubmit={handleSaveEdit}
          t={t}
          locale={locale}
          wallets={wallets}
        />
      )}
    </div>
  )
}
