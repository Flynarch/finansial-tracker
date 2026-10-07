import { useState, useMemo, useEffect } from 'react'
import BottomSheet from '../ui/BottomSheet'
import CategoryIcon from '../ui/CategoryIcon'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { getDecryptedNoteSync, warmupDecryptionCache, isFieldEncrypted } from '../../lib/fieldEncryption'
import { useDecryptedNote } from '../../hooks/useDecryptedNote'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import { format, parseISO } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import ReceiptPreviewModal from './ReceiptPreviewModal'
import {
  Calendar,
  Clock,
  Wallet,
  FileText,
  Pencil,
  Trash2,
  Paperclip,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Sliders,
  Eye,
  Layers,
  Repeat,
  Tag,
} from 'lucide-react'

export default function TransactionDetailSheet({
  isOpen,
  onClose,
  transaction: incomingTransaction,
  openEditTransaction,
  deleteTransaction,
  wallets = [],
  defaultCurrency = 'IDR',
  rates,
  formatCurrency,
  convertCurrency,
  locale = 'id',
  t,
}) {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  const [cachedTx, setCachedTx] = useState(incomingTransaction)
  const [prevIncomingTx, setPrevIncomingTx] = useState(incomingTransaction)
  if (incomingTransaction && incomingTransaction !== prevIncomingTx) {
    setPrevIncomingTx(incomingTransaction)
    setCachedTx(incomingTransaction)
  }
  const transaction = incomingTransaction || cachedTx

  useEffect(() => {
    if (transaction) {
      warmupDecryptionCache(transaction).catch(() => {})
    }
  }, [transaction])

  const resolvedNotes = useDecryptedNote(transaction?.notes)

  const dateLocaleObj = useMemo(() => (locale === 'id' ? idLocale : enUS), [locale])

  if (!transaction) return null

  const getWallet = (id) => (wallets || []).find((w) => String(w.id) === String(id))
  const sourceWallet = getWallet(transaction.walletId)
  const targetWallet = getWallet(transaction.targetWalletId)

  // Determine category & icons
  const iconKey = resolveTransactionIconKey(transaction.category, transaction.type)
  const colorClass = getCategoryColorClass(iconKey, transaction.type, transaction.category)
  const labels = getTransactionCategoryLabels(transaction.category, transaction.type, locale)

  // Type-specific display
  let typeLabel = t('tx.type.expense', 'Pengeluaran')
  let typeBadgeClass = 'bg-[var(--status-expense-soft)] text-[var(--status-expense)] border-[var(--status-expense)]/20'
  let TypeIcon = TrendingDown
  let amountPrefix = '-'
  let amountColorClass = 'ft-expense-text'

  if (transaction.type === 'income') {
    typeLabel = t('tx.type.income', 'Pemasukan')
    typeBadgeClass = 'bg-[var(--status-income-soft)] text-[var(--status-income)] border-[var(--status-income)]/20'
    TypeIcon = TrendingUp
    amountPrefix = '+'
    amountColorClass = 'ft-income-text'
  } else if (transaction.type === 'transfer') {
    typeLabel = t('tx.type.transfer', 'Transfer')
    typeBadgeClass = 'bg-[var(--status-transfer-soft)] text-[var(--status-transfer)] border-[var(--status-transfer)]/20'
    TypeIcon = ArrowRightLeft
    amountPrefix = ''
    amountColorClass = 'ft-transfer-text'
  } else if (transaction.type === 'balance_adjustment') {
    typeLabel = t('tx.type.adjustment', 'Penyesuaian Saldo')
    typeBadgeClass = 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)]'
    TypeIcon = Sliders
    const val = Number(transaction.amount || 0)
    amountPrefix = val > 0 ? '+' : val < 0 ? '-' : ''
    amountColorClass = val > 0 ? 'ft-income-text' : val < 0 ? 'ft-expense-text' : 'text-[var(--fg)]'
  }

  // Format date
  let formattedFullDate
  try {
    const parsedDate = parseISO(transaction.date)
    formattedFullDate = format(parsedDate, 'EEEE, d MMMM yyyy', { locale: dateLocaleObj })
  } catch (err){
      console.warn('[TransactionDetailSheet]', err)
    formattedFullDate = transaction.date || ''
  }

  // Format time
  let formattedTime = transaction.time || null
  if (!formattedTime && transaction.createdAt) {
    const createdAtMs = Number(transaction.createdAt)
    if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
      formattedTime = format(new Date(createdAtMs), 'HH:mm')
    }
  }

  const txCurrency = transaction.currency || defaultCurrency
  const isDifferentCurrency = String(txCurrency) !== String(defaultCurrency)

  const renderWalletItem = (walletObj, fallbackLabel) => {
    if (!walletObj) {
      return (
        <span className="font-semibold text-xs text-[var(--muted)]">
          {fallbackLabel || t('common.wallet', 'Dompet')}
        </span>
      )
    }

    const isCash =
      walletObj.customIcon === 'dollar' ||
      walletObj.customIcon === 'cash' ||
      walletObj.institutionType === 'cash' ||
      String(walletObj.name || '').toLowerCase().includes('cash') ||
      String(walletObj.name || '').toLowerCase().includes('tunai')
    const logo = getWalletLogoUrl(walletObj)

    return (
      <div className="flex items-center gap-2">
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--field-bg)]">
          {isCash ? (
            <div className="flex items-center justify-center text-amber-500">
              <MoneyBagIcon size={13} strokeWidth={2.5} />
            </div>
          ) : logo ? (
            <img src={logo} alt={walletObj.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[8px] font-black text-[var(--fg)]">
              {walletObj.name ? walletObj.name.substring(0, 2).toUpperCase() : 'W'}
            </span>
          )}
        </div>
        <span className="font-bold text-xs text-[var(--fg)] truncate">{walletObj.name}</span>
      </div>
    )
  }

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={t('tx.detail.sheetTitle', 'Detail Transaksi')}
        maxHeight="max-h-[min(92dvh,45rem)]"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose?.()
                deleteTransaction?.(transaction)
              }}
              className="h-11 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t('common.delete', 'Hapus')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose?.()
                openEditTransaction?.(transaction)
              }}
              className="flex-1 h-11 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
              <span>{t('tx.modal.editTitle', 'Edit Transaksi')}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-1 pb-2">
          {/* ── Hero Transaction Card ── */}
          <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 text-center overflow-hidden">
            {/* Top Badge: Transaction Type */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${typeBadgeClass}`}>
                <TypeIcon className="h-3 w-3" strokeWidth={2.5} />
                <span>{typeLabel}</span>
              </span>
              {String(resolvedNotes || '').includes('(Auto:') && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--accent)]">
                  <Repeat className="h-2.5 w-2.5" />
                  <span>Auto</span>
                </span>
              )}
            </div>

            {/* Category Icon & Category Name */}
            <div className="flex flex-col items-center justify-center gap-2">
              <div className={`grid h-14 w-14 place-items-center rounded-2xl ${colorClass} shadow-sm`}>
                {transaction.type === 'transfer' ? (
                  <ArrowRightLeft className="h-6 w-6" strokeWidth={2.5} />
                ) : (
                  <CategoryIcon icon={iconKey} className="h-7 w-7" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--fg)] tracking-tight">
                  {labels.main ||
                    (transaction.type === 'expense'
                      ? formatExpenseCategory(transaction.category, locale)
                      : formatIncomeCategory(transaction.category, locale))}
                </h3>
                {labels.sub && (
                  <p className="text-xs font-semibold text-[var(--muted)] mt-0.5">{labels.sub}</p>
                )}
              </div>
            </div>

            {/* Big Amount */}
            <div className="mt-3.5 pt-3.5 border-t border-[var(--border)]/60">
              <p className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight leading-tight break-all ${amountColorClass}`}>
                {amountPrefix}
                {formatCurrency(Math.abs(Number(transaction.amount || 0)), txCurrency)}
              </p>
              {isDifferentCurrency && (
                <p className="text-xs font-semibold text-[var(--muted)] mt-1 tabular-nums">
                  ≈ {formatCurrency(convertCurrency(transaction.amount, txCurrency, defaultCurrency, rates), defaultCurrency)}
                </p>
              )}
            </div>
          </div>

          {/* ── Metadata Grid ── */}
          <div className="space-y-2.5">
            {/* Date & Time */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Calendar className="h-4 w-4 text-[var(--accent)] shrink-0" />
                <span className="font-bold">{t('common.date', 'Tanggal')}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-[var(--fg)] block">{formattedFullDate}</span>
                {formattedTime && (
                  <span className="font-semibold text-[11px] text-[var(--muted)] flex items-center justify-end gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{formattedTime}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Account / Wallet */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 text-xs">
              {transaction.type === 'transfer' ? (
                <div className="space-y-2">
                  <span className="font-bold text-[var(--muted)] block text-[11px] uppercase tracking-wider">
                    {t('tx.type.transfer', 'Transfer Dompet')}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold text-[var(--muted)] mb-1">
                        {t('tx.fromWallet', 'Dari')}
                      </span>
                      {renderWalletItem(sourceWallet, 'Dompet Asal')}
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)]">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 text-right flex flex-col items-end">
                      <span className="block text-[10px] font-semibold text-[var(--muted)] mb-1">
                        {t('tx.toWallet', 'Ke')}
                      </span>
                      {renderWalletItem(targetWallet, 'Dompet Tujuan')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[var(--muted)]">
                    <Wallet className="h-4 w-4 text-[var(--accent)] shrink-0" />
                    <span className="font-bold">{t('common.wallet', 'Dompet')}</span>
                  </div>
                  <div className="min-w-0 text-right">
                    {renderWalletItem(sourceWallet, 'Dompet')}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method if available */}
            {transaction.paymentMethod && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-[var(--muted)]">{t('tx.paymentMethod', 'Metode Pembayaran')}</span>
                <span className="font-bold text-[var(--fg)] capitalize px-2 py-0.5 rounded-lg bg-[var(--panel)] border border-[var(--border)] text-[11px]">
                  {transaction.paymentMethod}
                </span>
              </div>
            )}

            {/* Linked Loan Info if applicable */}
            {transaction.loanId && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-amber-500">{t('loans.linkedTitle', 'Terkait Pinjaman')}</span>
                <span className="font-bold text-amber-500 text-[11px]">
                  {t('loans.loanPayment', 'Pembayaran Cicilan')}
                </span>
              </div>
            )}

            {/* Split Details if any */}
            {transaction.isSplit && Array.isArray(transaction.splitItems) && transaction.splitItems.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-500">
                  <Layers className="h-3.5 w-3.5" />
                  <span>
                    {t('transactions.splitItemsCount', 'Rincian Split Transaksi ({{count}})', {
                      count: transaction.splitItems.length,
                    })}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {transaction.splitItems.map((item, idx) => {
                    const rawSiNote = item?.notes
                    const plainSiNote = isFieldEncrypted(rawSiNote) ? getDecryptedNoteSync(rawSiNote) : rawSiNote
                    const itemNote = isFieldEncrypted(plainSiNote) ? '' : (plainSiNote || '')
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[var(--panel)] border border-[var(--border)]/60 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--fg)] truncate">
                            {item.name || item.category || `Item ${idx + 1}`}
                          </span>
                          <span className="font-bold tabular-nums text-[var(--fg)] shrink-0">
                            {formatCurrency(item.amount, txCurrency)}
                          </span>
                        </div>
                        {itemNote ? (
                          <p className="text-[11px] text-[var(--muted)] italic truncate">
                            &ldquo;{itemNote}&rdquo;
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Notes Section with robust multiline break-words */}
            {resolvedNotes && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-1.5 overflow-hidden min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]">
                  <FileText className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span>{t('common.notes', 'Catatan')}</span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl bg-[var(--panel)] p-2.5 border border-[var(--border)]/50">
                  <p className="text-xs text-[var(--fg)] leading-relaxed italic break-words [overflow-wrap:anywhere] break-all whitespace-pre-wrap select-text">
                    &ldquo;{resolvedNotes}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {/* Tags if any */}
            {Array.isArray(transaction.tags) && transaction.tags.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]">
                  <Tag className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span>{t('common.tags', 'Label')}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {transaction.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-lg bg-[var(--panel)] border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Receipt Proof Preview Card */}
            {(() => {
              const receiptImageSrc = transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null
              if (!receiptImageSrc) return null

              return (
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-500">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('transactions.receiptAttachment', 'Bukti / Lampiran Struk')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsReceiptModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-600 transition cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      <span>{t('common.viewFull', 'Lihat Bukti')}</span>
                    </button>
                  </div>

                  <div
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-black/10 dark:bg-black/30 h-36 flex items-center justify-center cursor-pointer group"
                  >
                    <img
                      src={receiptImageSrc}
                      alt={t('transactions.receiptAttachment', 'Receipt Attachment')}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200 select-none"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                        <Eye className="h-3.5 w-3.5" />
                        {t('transactions.clickToPreview', 'Klik untuk melihat')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </BottomSheet>

      {/* Standalone Receipt Preview from Detail Sheet */}
      <ReceiptPreviewModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        imageSrc={transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null}
        amountFormatted={`${amountPrefix}${formatCurrency(Math.abs(Number(transaction.amount || 0)), txCurrency)}`}
        date={formattedFullDate}
        notes={resolvedNotes}
        category={labels.main}
        zIndex="z-[60]"
      />
    </>
  )
}
