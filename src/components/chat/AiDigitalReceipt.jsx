import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import {
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Plus,
  Receipt,
  Wallet as WalletIcon,
  Calendar,
  Tag,
  FileText,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil,
  Store,
  Layers,
  Sparkles,
} from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import TransactionEditSheet from '../transactions/TransactionEditSheet'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { formatCurrency, formatMoneyInput, parseMoneyInput } from '../../lib/utils'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'

function generateReceiptRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = ''
  for (let i = 0; i < 6; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `FT-${format(new Date(), 'yyMMdd')}-${hash}`
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
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
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

  const contextualTheme = useMemo(() => {
    if (isSingle) {
      if (singleTx.type === 'income') {
        return {
          glow: 'from-emerald-500/15 via-emerald-500/4 to-transparent',
          line: 'from-transparent via-emerald-500/50 to-transparent',
          badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
          title: 'Pemasukan Tercatat',
          tag: 'text-emerald-500',
        }
      }
      if (singleTx.type === 'transfer') {
        return {
          glow: 'from-sky-500/15 via-sky-500/4 to-transparent',
          line: 'from-transparent via-sky-500/50 to-transparent',
          badge: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
          title: 'Transfer Berhasil',
          tag: 'text-sky-500',
        }
      }
      return {
        glow: 'from-rose-500/12 via-rose-500/3 to-transparent',
        line: 'from-transparent via-rose-500/40 to-transparent',
        badge: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
        title: 'Pengeluaran Tercatat',
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
        title: `${txList.length} Pemasukan Tercatat`,
        tag: 'text-emerald-500',
      }
    }
    if (hasExpense && !hasIncome) {
      return {
        glow: 'from-rose-500/12 via-rose-500/3 to-transparent',
        line: 'from-transparent via-rose-500/40 to-transparent',
        badge: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
        title: `${txList.length} Pengeluaran Tercatat`,
        tag: 'text-rose-500',
      }
    }

    return {
      glow: 'from-[var(--accent)]/15 via-[var(--accent)]/4 to-transparent',
      line: 'from-transparent via-[var(--accent)]/50 to-transparent',
      badge: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      title: `${txList.length} Transaksi Tercatat`,
      tag: 'text-[var(--accent)]',
    }
  }, [isSingle, singleTx.type, txList])

  const totalExpense = txList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalIncome = txList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const netTotal = totalIncome - totalExpense

  // Barcode line width pattern generator (deterministic based on refCode)
  const barcodeLines = useMemo(() => {
    const widths = [2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1]
    return widths.map((w, i) => ({ width: w, isSpace: i % 5 === 0 }))
  }, [])

  const handleUndo = async () => {
    setIsUndoing(true)
    try {
      for (const tx of txList) {
        if (tx.id) {
          await deleteTransaction(tx.id)
        }
      }
      setIsUndone(true)
    } catch {
      // ignore
    } finally {
      setIsUndoing(false)
    }
  }

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(refCode)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
  }

  const handleViewTransactions = () => {
    if (onClose) onClose()
    closeQuickLog()
    navigate('/transactions')
  }

  const getWalletInfo = (walletId) => {
    return wallets.find((w) => w.id === walletId)
  }

  // Edit Handlers using the standard form
  const handleStartEdit = (tx) => {
    setEditingTx(tx)
    const txCurrency = tx.currency || defaultCurrency
    setEditFormData({
      date: tx.date || format(new Date(), 'yyyy-MM-dd'),
      amount: formatMoneyInput(String(tx.amount || ''), txCurrency),
      type: tx.type || 'expense',
      category: tx.category || '',
      notes: tx.notes || '',
      currency: txCurrency,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTx?.id) return
    const numericAmt = parseMoneyInput(editFormData.amount, editFormData.currency)

    const updated = {
      date: editFormData.date,
      amount: numericAmt,
      type: editFormData.type,
      category: editFormData.category,
      notes: editFormData.notes,
      currency: editFormData.currency,
    }

    try {
      await updateTransaction(editingTx.id, updated)
      setLocalTxs((prev) =>
        prev.map((t) => (t.id === editingTx.id ? { ...t, ...updated } : t))
      )
      setEditingTx(null)
    } catch {
      // ignore
    }
  }

  // Format creation timestamp
  const dateLocaleObj = locale === 'id' ? idLocale : enUS
  const firstTxDate = singleTx.date ? new Date(singleTx.date) : new Date()
  const receiptDate = format(firstTxDate, 'EEEE, d MMMM yyyy', { locale: dateLocaleObj })
  const receiptTime = singleTx.time || format(new Date(), 'HH:mm')

  // Undone State View
  if (isUndone) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in duration-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
          <RotateCcw className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-[var(--fg)]">Transaksi Dibatalkan</h3>
          <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
            {txList.length > 1 ? `${txList.length} transaksi telah dihapus` : 'Transaksi telah dihapus'} dari riwayat keuangan Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogAnother}
          className="ft-btn-primary py-2.5 px-5 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition mt-2"
        >
          <Plus className="h-4 w-4" />
          <span>Catat Transaksi Lain</span>
        </button>
      </div>
    )
  }

  const activeMerchant = merchant || singleTx.merchant || txList.find((t) => t.merchant)?.merchant || ''

  return (
    <div className="space-y-3 ft-mode-enter">
      {/* ── DIGITAL RECEIPT CARD (Authentic Perforated Ticket) ────── */}
      <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-xl overflow-hidden">
        {/* Decorative Top Accent Glow Line */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${contextualTheme.line}`} />

        {/* Merchant / Store Top Banner (if detected) */}
        {activeMerchant ? (
          <div className="px-3.5 py-2.5 bg-[var(--field-bg)] border-b border-[var(--border)]/60 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20">
                <Store className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {locale === 'en' ? 'Merchant / Store' : 'Toko / Merchant'}
                </span>
                <h3 className="text-xs font-black text-[var(--fg)] tracking-tight truncate">
                  {activeMerchant}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[9px] font-bold text-emerald-500">
              <Sparkles className="h-2.5 w-2.5" />
              <span>{locale === 'en' ? 'Verified' : 'Struk Terdeteksi'}</span>
            </div>
          </div>
        ) : null}

        {/* Receipt Header Banner */}
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-[var(--border)]/40 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-xl ${contextualTheme.badge} border flex items-center justify-center shadow-2xs shrink-0`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-black tracking-tight text-[var(--fg)] truncate">
              {contextualTheme.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-bold text-[var(--muted)] tabular-nums pl-6 sm:pl-0 truncate">
            <Calendar className="h-3 w-3 text-[var(--muted)] shrink-0" />
            <span>{receiptDate} • {receiptTime}</span>
          </div>
        </div>

        {/* Prompt Citation if available */}
        {rawPrompt ? (
          <div className="px-4 py-1.5 bg-[var(--field-bg)]/20 border-b border-[var(--border)]/30 text-[10.5px] text-[var(--muted)] italic truncate">
            "{rawPrompt}"
          </div>
        ) : null}

        {/* ── SINGLE TRANSACTION HERO VIEW ────────────────────── */}
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
            <div className="p-3.5 sm:p-4 flex flex-col">
              {/* Hero Amount & Category Icon */}
              <div className="flex flex-col items-center text-center pb-2.5 border-b border-[var(--border)]/40">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${colorClass} mb-1.5 shadow-sm`}>
                  <CategoryIcon icon={iconKey} className="h-5 w-5" />
                </div>

                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider mb-0.5 ${
                  isIncome
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : isTransfer
                    ? 'bg-sky-500/15 text-sky-500'
                    : 'bg-rose-500/15 text-rose-500'
                }`}>
                  {isIncome ? <ArrowDownLeft className="h-3 w-3" /> : isTransfer ? <ArrowLeftRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {isIncome ? 'Pemasukan' : isTransfer ? 'Transfer Saldo' : 'Pengeluaran'}
                </span>

                <h2 className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-0.5 ${
                  isIncome ? 'ft-income-text' : isTransfer ? 'text-sky-500' : 'ft-expense-text'
                }`}>
                  {isIncome ? '+' : isTransfer ? '' : '-'}
                  {formatCurrency(Math.abs(Number(tx.amount || 0)), tx.currency || defaultCurrency)}
                </h2>
              </div>

              {/* Transaction Specs (FinTech Key-Value Grid) */}
              <div className="py-2.5 space-y-2 text-xs min-w-0">
                {/* Category */}
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium pt-1 shrink-0">
                    <Tag className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <span>Kategori</span>
                  </span>
                  <div className="flex flex-col items-end min-w-0 text-right">
                    <span className="font-extrabold text-xs text-[var(--fg)] leading-tight truncate max-w-[200px] sm:max-w-xs">
                      {labels.main || tx.category}
                    </span>
                    {labels.sub ? (
                      <span className="text-[10.5px] text-[var(--muted)] font-semibold mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                        {labels.sub}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Wallet Account */}
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium shrink-0">
                    <WalletIcon className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <span>{isTransfer ? 'Sumber Saldo' : 'Akun / Dompet'}</span>
                  </span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/70 font-bold text-[var(--fg)] shadow-2xs max-w-[200px] truncate">
                    {walletLogo ? (
                      <img src={walletLogo} alt="" className="h-3.5 w-3.5 rounded-full object-contain shrink-0" />
                    ) : null}
                    <span className="truncate">{walletObj?.name || 'Dompet Utama'}</span>
                  </div>
                </div>

                {/* Target Wallet for Transfer */}
                {isTransfer && targetWalletObj ? (
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium shrink-0">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-sky-500" />
                      <span>Dompet Tujuan</span>
                    </span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 border border-sky-500/20 font-bold text-sky-500 shadow-2xs max-w-[200px] truncate">
                      {targetWalletLogo ? (
                        <img src={targetWalletLogo} alt="" className="h-3.5 w-3.5 rounded-full object-contain shrink-0" />
                      ) : null}
                      <span className="truncate">{targetWalletObj.name}</span>
                    </div>
                  </div>
                ) : null}

                {/* User Notes */}
                {tx.notes ? (
                  <div className="flex items-start justify-between gap-3 pt-2 mt-1 border-t border-[var(--border)]/40 min-w-0">
                    <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium shrink-0 pt-0.5">
                      <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />
                      <span>Catatan</span>
                    </span>
                    <span className="italic text-[var(--fg)] text-right font-normal break-words line-clamp-2 bg-[var(--field-bg)]/40 px-2.5 py-1 rounded-xl border border-[var(--border)]/40 text-[11.5px] max-w-[200px] sm:max-w-xs">
                      "{tx.notes}"
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })() : (
          /* ── MULTI TRANSACTION ITEMIZED VIEW (Scan Per Item Mode) ── */
          <div className="p-4 flex flex-col">
            {/* Header info for multi-items */}
            <div className="mb-2.5 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
                <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>{locale === 'en' ? 'Itemized Breakdown' : 'Rincian Item Belanja'}</span>
              </div>
              <span className="rounded-full bg-[var(--field-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--fg)] border border-[var(--border)]">
                {txList.length} {locale === 'en' ? 'items' : 'item'}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto overscroll-contain ft-hide-scrollbar pr-0.5">
              {txList.map((tx, idx) => {
                const isIncome = tx.type === 'income'
                const isTransfer = tx.type === 'transfer'
                const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
                const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                const walletObj = getWalletInfo(tx.walletId)
                const walletLogo = walletObj ? getWalletLogoUrl(walletObj) : null
                const itemName = tx.notes || labels.main || tx.category

                return (
                  <div
                    key={tx.id || idx}
                    style={{ animationDelay: `${idx * 40}ms` }}
                    className="ft-receipt-item-enter flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-[var(--field-bg)]/60 border border-[var(--border)]/70 hover:border-[var(--accent)]/50 transition"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {/* Item Number Badge */}
                      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--panel)] border border-[var(--border)] text-[10px] font-mono font-black text-[var(--muted)]">
                        {idx + 1}
                      </span>

                      {/* Category Icon with Micro Wallet Logo Badge */}
                      <div className="relative shrink-0">
                        <div className={`grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl ${colorClass}`}>
                          <CategoryIcon icon={iconKey} className="h-4 w-4" />
                        </div>
                        {walletObj && (
                          <div
                            className="absolute -bottom-1 -right-1 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--panel-strong)] bg-[var(--field-bg)] shadow-2xs"
                            title={walletObj.name}
                          >
                            {walletLogo ? (
                              <img
                                src={walletLogo}
                                alt={walletObj.name}
                                className="h-full w-full object-contain p-[0.5px] rounded-full"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <span
                              className="text-[6.5px] font-black leading-none text-[var(--fg)] flex items-center justify-center"
                              style={{ display: walletLogo ? 'none' : 'flex' }}
                            >
                              {walletObj.name ? walletObj.name.substring(0, 2).toUpperCase() : 'W'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title & Category Sub-label */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
                          {itemName}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)] mt-0.5 truncate">
                          <span className="font-semibold text-[var(--accent)]">
                            {labels.main || tx.category}
                          </span>
                          {labels.sub ? <span>• {labels.sub}</span> : null}
                          {walletObj ? (
                            <span className="font-medium text-[var(--muted)] shrink-0">
                              • {walletObj.name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-right">
                        <p className={`text-xs font-black tabular-nums tracking-tight ${
                          isIncome ? 'ft-income-text' : isTransfer ? 'text-sky-500' : 'ft-expense-text'
                        }`}>
                          {isIncome ? '+' : isTransfer ? '' : '-'}
                          {formatCurrency(Math.abs(Number(tx.amount || 0)), tx.currency || defaultCurrency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tx)}
                        className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--panel)] transition cursor-pointer"
                        title={t('tx.modal.editTitle', 'Edit Transaksi')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotals Breakdown */}
            <div className="mt-3 pt-3 border-t border-[var(--border)]/60 flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-1.5 text-[var(--muted)]">
                <span>{locale === 'en' ? 'Total Amount' : 'Total Keseluruhan'}</span>
                <span className="text-[10px] font-normal">({txList.length} item)</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-black tabular-nums ${netTotal >= 0 ? 'ft-income-text' : 'ft-expense-text'}`}>
                  {netTotal >= 0 ? '+' : '-'}
                  {formatCurrency(Math.abs(netTotal || totalExpense || totalIncome), txList[0]?.currency || defaultCurrency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Perforated Ticket Notches & Tear Line ────────────── */}
        <div className="relative flex items-center px-4 py-0.5">
          {/* Left Notch Cutout */}
          <div className="absolute -left-2.5 h-4.5 w-4.5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]" />
          {/* Authentic Dashed Tear Line */}
          <div className="w-full border-t border-dashed border-[var(--border-strong)]/60" />
          {/* Right Notch Cutout */}
          <div className="absolute -right-2.5 h-4.5 w-4.5 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]" />
        </div>

        {/* ── Decorative Barcode & Receipt Ticket Footer ───────── */}
        <div className="px-4 py-2 bg-[var(--field-bg)]/40 space-y-1.5">
          {/* Decorative CSS Barcode */}
          <div className="ft-receipt-barcode h-7">
            {barcodeLines.map((line, idx) => (
              <div
                key={idx}
                className="ft-receipt-barcode-line"
                style={{
                  width: `${line.width}px`,
                  opacity: line.isSpace ? 0.3 : 0.85,
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 font-mono text-[var(--muted)]">
              <Receipt className="h-3 w-3 text-[var(--accent)]" />
              <span>{refCode}</span>
              <button
                type="button"
                onClick={handleCopyRef}
                className="p-0.5 hover:text-[var(--fg)] transition cursor-pointer"
                title={t('common.copyRef', 'Salin No. Referensi')}
              >
                {copiedRef ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>

            <span className={`font-bold text-[9.5px] uppercase tracking-wider ${contextualTheme.tag}`}>
              FinTrack Verified
            </span>
          </div>
        </div>
      </div>

      {/* ── Ergonomic Action Buttons ────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        {/* Primary CTA */}
        <button
          type="button"
          onClick={onLogAnother}
          className="ft-btn-primary w-full py-2.5 px-4 text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          <span>Catat Transaksi Lagi</span>
        </button>

        {/* Secondary CTAs */}
        <div className="flex items-center gap-2">
          {/* Edit Detail Button: Only render for single transaction */}
          {isSingle && (
            <button
              type="button"
              onClick={() => handleStartEdit(singleTx)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
            >
              <Pencil className="h-3 w-3 text-[var(--accent)]" />
              <span>Edit Detail</span>
            </button>
          )}

          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={isUndoing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{isUndoing ? 'Membatalkan...' : 'Batalkan'}</span>
          </button>

          {/* View in History Button */}
          <button
            type="button"
            onClick={handleViewTransactions}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[11px] font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer"
          >
            <span>Riwayat</span>
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
