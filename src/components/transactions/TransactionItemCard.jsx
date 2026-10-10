import { memo } from 'react'
import { format as defaultFormat } from 'date-fns'
import { formatCurrency as defaultFormatCurrency, convertCurrency as defaultConvertCurrency } from '../../lib/utils'
import {
  getCategoryColorClass as defaultGetCategoryColorClass,
  resolveTransactionIconKey as defaultResolveTransactionIconKey,
  getTransactionCategoryLabels as defaultGetTransactionCategoryLabels,
} from '../../lib/categoryIcon'
import CategoryIcon from '../ui/CategoryIcon'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import { Paperclip } from 'lucide-react'
import { useDecryptedNote } from '../../hooks/useDecryptedNote'

export const TransactionItemCard = memo(function TransactionItemCard({
  transaction,
  swipedTransactionId,
  highlightedTransactionId,
  openEditTransaction,
  deleteTransaction,
  onDelete,
  onViewDetail,
  onPreviewReceipt,
  setSwipedTransactionId,
  getSwipeHandlers,
  getCategoryColorClass = defaultGetCategoryColorClass,
  resolveTransactionIconKey = defaultResolveTransactionIconKey,
  getTransactionCategoryLabels = defaultGetTransactionCategoryLabels,
  format = defaultFormat,
  t = (key, fallback) => (typeof fallback === 'string' ? fallback : key),
  locale = 'id',
  defaultCurrency = 'IDR',
  formatCurrency = defaultFormatCurrency,
  convertCurrency = defaultConvertCurrency,
  rates = {},
  contextWalletId,
  wallets: walletsProp,
  isNew: isNewProp,
  newestTransactionId,
  isBulkMode,
  isSelected,
  onToggleSelect,
}) {
  const wallets = walletsProp && walletsProp.length > 0 ? walletsProp : []

  const getWalletName = (id) => {
    if (!id) return 'Wallet'
    const found = wallets?.find((w) => String(w.id) === String(id))
    return found?.name || 'Wallet'
  }

  const isNew = Boolean(isNewProp !== undefined ? isNewProp : (newestTransactionId && String(transaction.id) === String(newestTransactionId)))

  let iconKey = resolveTransactionIconKey(transaction.category, transaction.type)
  let colorClass = getCategoryColorClass(iconKey, transaction.type, transaction.category)
  let labels = getTransactionCategoryLabels(transaction.category, transaction.type, locale)
  let amountPrefix = transaction.type === 'income' ? '+' : '-'
  let amountColorClass = transaction.type === 'income' ? 'ft-income-text' : 'ft-expense-text'

  if (transaction.type === 'balance_adjustment') {
    iconKey = 'adjustment'
    colorClass = 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]'
    labels = {
      main: locale === 'en' ? 'Balance Adjustment' : 'Penyesuaian Saldo',
      sub: locale === 'en' ? 'System' : 'Sistem',
    }
    const val = Number(transaction.amount || 0)
    if (val > 0) {
      amountPrefix = '+'
      amountColorClass = 'ft-income-text'
    } else if (val < 0) {
      amountPrefix = '-'
      amountColorClass = 'ft-expense-text'
    } else {
      amountPrefix = ''
      amountColorClass = 'text-[var(--fg)]'
    }
  } else if (transaction.type === 'transfer') {
    iconKey = 'arrow-right-left'
    if (contextWalletId && contextWalletId === transaction.targetWalletId) {
      colorClass = 'bg-[var(--earthy-green-soft)] text-[var(--earthy-green)]'
      labels = { main: 'Transfer Masuk', sub: `Dari ${getWalletName(transaction.walletId)}` }
      amountPrefix = '+'
      amountColorClass = 'ft-income-text'
    } else if (contextWalletId && contextWalletId === transaction.walletId) {
      colorClass = 'bg-[var(--earthy-terra-soft)] text-[var(--earthy-terra)]'
      labels = { main: 'Transfer Keluar', sub: `Ke ${getWalletName(transaction.targetWalletId)}` }
      amountPrefix = '-'
      amountColorClass = 'ft-expense-text'
    } else {
      // Global view
      colorClass = 'ft-transfer-soft border border-[color-mix(in_srgb,var(--status-transfer)_25%,transparent)]'
      const fromName = getWalletName(transaction.walletId)
      const toName = getWalletName(transaction.targetWalletId)
      labels = {
        main: locale === 'en' ? 'Transfer' : 'Transfer',
        sub: `${fromName} -> ${toName}`,
      }
      amountPrefix = ''
      amountColorClass = 'ft-transfer-text'
    }
  }

  let createdTime = null
  if (transaction?.time && typeof transaction.time === 'string' && transaction.time.trim()) {
    createdTime = transaction.time.trim()
  } else if (transaction?.createdAt) {
    try {
      const formatFn = typeof format === 'function' ? format : defaultFormat
      const rawCreatedAt = transaction.createdAt
      let dateObj = null

      if (rawCreatedAt instanceof Date) {
        dateObj = rawCreatedAt
      } else if (typeof rawCreatedAt === 'number' || (typeof rawCreatedAt === 'string' && rawCreatedAt.trim())) {
        const createdAtMs = Number(rawCreatedAt)
        if (Number.isFinite(createdAtMs)) {
          if (createdAtMs > 0) {
            dateObj = new Date(createdAtMs)
          }
        } else {
          const parsed = new Date(rawCreatedAt)
          if (!isNaN(parsed.getTime())) {
            dateObj = parsed
          }
        }
      }

      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        createdTime = formatFn(dateObj, 'HH:mm')
      }
    } catch {
      createdTime = null
    }
  }

  const isTransfer = transaction.type === 'transfer'
  const sub = labels.sub || null
  const resolvedNotes = useDecryptedNote(transaction.notes)
  const noteStr = resolvedNotes ? String(resolvedNotes).trim() : ''
  const walletName = !isTransfer ? getWalletName(transaction.walletId) : null
  const isContextWalletMatch = Boolean(contextWalletId && String(contextWalletId) === String(transaction.walletId))
  const displayWalletName = isContextWalletMatch ? null : walletName

  const isSwiped = swipedTransactionId === transaction.id

  return (
    <div
      key={transaction.id}
      data-transaction-id={transaction.id}
      className="relative overflow-hidden bg-[var(--field-bg)] select-none"
    >
      {/* Progressive Swipe Background */}
      <div className="absolute inset-y-0 right-0 z-0 flex items-center justify-end px-5 opacity-0 transition-colors duration-150 w-full" />

      <article
        className={`relative z-10 flex touch-pan-y items-center justify-between gap-3 p-3 sm:px-4 bg-[var(--panel-strong)] border-r border-[var(--border)]/60 transition-colors cursor-pointer active:bg-[var(--panel)] ${
          highlightedTransactionId === String(transaction.id)
            ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/50'
            : isSelected
            ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30'
            : ''
        }`}
        onClick={() => {
          if (isSwiped && setSwipedTransactionId) {
            setSwipedTransactionId(null)
            return
          }
          if (isBulkMode && onToggleSelect) {
            onToggleSelect()
            return
          }
          if (onViewDetail) {
            onViewDetail(transaction)
          }
        }}
        {...(getSwipeHandlers ? getSwipeHandlers(transaction.id, {
          onEdit: () => openEditTransaction?.(transaction),
          onDelete: () => (onDelete ? onDelete(transaction) : deleteTransaction?.(transaction.id)),
        }) : {})}
      >
        {/* Top-Right Badge: BARU / NEW */}
        {isNew ? (
          <span
            data-testid="badge-new-tx"
            className="absolute top-1.5 right-2 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[8px] sm:text-[8.5px] font-black tracking-wider text-white uppercase leading-none shadow-2xs z-20 pointer-events-none select-none animate-in fade-in duration-200"
          >
            {t('common.new', 'BARU')}
          </span>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Avatar Icon */}
          <div className="relative shrink-0">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-semibold ${colorClass} shadow-2xs`}
            >
              {transaction.type === 'transfer' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M21 3 9 15"/><path d="M8 21H3v-5"/><path d="M3 21l12-12"/></svg>
              ) : (
                <CategoryIcon icon={iconKey} className="h-4.5 w-4.5" />
              )}
            </div>

            {/* Micro-Avatar Wallet Badge */}
            {(() => {
              if (isContextWalletMatch) return null
              const walletObj = wallets?.find((w) => String(w.id) === String(transaction.walletId))
              if (!walletObj) return null
              const isCash = walletObj.customIcon === 'dollar' || walletObj.customIcon === 'cash' || String(walletObj.name || '').toLowerCase().includes('cash') || String(walletObj.name || '').toLowerCase().includes('uang tunai')
              const logo = getWalletLogoUrl(walletObj)
              return (
                <div
                  className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[var(--wallet-logo-border,var(--border))] bg-[var(--wallet-logo-bg,var(--panel-strong))] shadow-2xs"
                  title={walletObj.name}
                >
                  {isCash ? (
                    <div className="w-full h-full flex items-center justify-center text-amber-500">
                      <MoneyBagIcon size={10} strokeWidth={2.5} />
                    </div>
                  ) : logo ? (
                    <img
                      src={logo}
                      alt={walletObj.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <span
                    className="text-[7px] font-black leading-none text-[var(--fg)] flex items-center justify-center"
                    style={{ display: isCash || logo ? 'none' : 'flex' }}
                  >
                    {walletObj.name ? walletObj.name.substring(0, 2).toUpperCase() : 'W'}
                  </span>
                </div>
              )
            })()}
          </div>

          {/* 2 or 3 Clean Text Lines */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <p className="truncate text-sm font-extrabold text-[var(--fg)] leading-tight">{labels.main}</p>
              {transaction.isSplit && Array.isArray(transaction.splitItems) && transaction.splitItems.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--split-bill-soft)] border border-[var(--split-bill)]/30 px-1.5 py-0.2 text-[9px] font-extrabold text-[var(--split-bill)] shrink-0">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3 9 15"/><path d="M3 21l6-6"/></svg>
                  <span>Split ({transaction.splitItems.length})</span>
                </span>
              ) : null}
              {String(resolvedNotes || '').includes('(Auto:') ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--accent)] shrink-0" title={t('tx.autoRecurringTooltip', 'Otomatis dari jadwal berulang')}>
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  <span>Auto</span>
                </span>
              ) : null}
            </div>

            {/* Line 2: Wallet / Flow & Subcategory & Time */}
            <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-[var(--muted)]">
              {isTransfer ? (
                <>
                  <span className="text-[var(--fg)]/90 font-bold">{sub}</span>
                  {createdTime ? <> • {createdTime}</> : null}
                </>
              ) : (
                <>
                  <span className="text-[var(--fg)]/90 font-bold">{displayWalletName}</span>
                  {sub ? <> • {sub}</> : null}
                  {createdTime ? <> • {createdTime}</> : null}
                </>
              )}
            </p>

            {/* Line 3: Notes (Dedicated Line with line-clamp-2) */}
            {noteStr ? (
              <p className="mt-0.5 text-[11px] italic leading-tight text-[var(--muted)] line-clamp-2 break-words [overflow-wrap:anywhere] break-all">
                &ldquo;{noteStr}&rdquo;
              </p>
            ) : null}

            {/* Line 4: Tags Pills */}
            {Array.isArray(transaction.tags) && transaction.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {transaction.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-[var(--field-bg)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Section: Amount & Strictly Right-Aligned Badges */}
        {(() => {
          const receiptSrc = transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null

          return (
            <div className={`shrink-0 max-w-[48%] pl-2 text-right flex flex-col items-end justify-center ml-auto ${isNew ? 'pt-2 sm:pt-2.5' : ''}`}>
              <p
                className={`whitespace-nowrap truncate max-w-full text-[14.5px] sm:text-[15px] font-black tabular-nums tracking-tight leading-tight ${amountColorClass}`}
              >
                {amountPrefix}
                {formatCurrency(Math.abs(Number(transaction.amount || 0)), transaction.currency)}
              </p>
              {String(transaction.currency || defaultCurrency) !== String(defaultCurrency) ? (
                <p className="ft-muted whitespace-nowrap truncate max-w-full text-[10px] tabular-nums mt-0.5">
                  ≈{' '}
                  {formatCurrency(
                    convertCurrency(
                      transaction.amount,
                      transaction.currency || defaultCurrency,
                      defaultCurrency,
                      rates,
                    ),
                    defaultCurrency,
                  )}
                </p>
              ) : null}

              {/* Right-aligned Badges: Struk Attachment */}
              {receiptSrc ? (
                <div className="mt-1.5 flex items-center justify-end gap-1.5 flex-wrap ml-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onPreviewReceipt) {
                        onPreviewReceipt(transaction)
                      } else if (onViewDetail) {
                        onViewDetail(transaction)
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--receipt-soft)] border border-[var(--receipt)]/30 px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--receipt)] hover:bg-[var(--receipt)]/25 transition shrink-0 cursor-pointer shadow-2xs leading-normal active:scale-95"
                    title={t('transactions.viewReceipt', 'Lihat Bukti Transaksi')}
                  >
                    <Paperclip className="h-2.5 w-2.5 shrink-0" />
                    <span>{t('transactions.receiptBadge', 'Struk')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          )
        })()}
      </article>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.transaction === nextProps.transaction &&
    (prevProps.swipedTransactionId === prevProps.transaction?.id) === (nextProps.swipedTransactionId === nextProps.transaction?.id) &&
    (prevProps.isSwipingId === prevProps.transaction?.id) === (nextProps.isSwipingId === nextProps.transaction?.id) &&
    (prevProps.highlightedTransactionId === String(prevProps.transaction?.id)) === (nextProps.highlightedTransactionId === String(nextProps.transaction?.id)) &&
    Boolean(prevProps.isNew ?? (prevProps.newestTransactionId && String(prevProps.newestTransactionId) === String(prevProps.transaction?.id))) ===
      Boolean(nextProps.isNew ?? (nextProps.newestTransactionId && String(nextProps.newestTransactionId) === String(nextProps.transaction?.id))) &&
    prevProps.isBulkMode === nextProps.isBulkMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.locale === nextProps.locale &&
    prevProps.defaultCurrency === nextProps.defaultCurrency &&
    prevProps.rates === nextProps.rates &&
    prevProps.contextWalletId === nextProps.contextWalletId &&
    prevProps.wallets === nextProps.wallets &&
    prevProps.onViewDetail === nextProps.onViewDetail &&
    prevProps.onPreviewReceipt === nextProps.onPreviewReceipt &&
    prevProps.onDelete === nextProps.onDelete
  )
})
