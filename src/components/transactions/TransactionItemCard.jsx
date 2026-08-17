import { memo, useState } from 'react'
import CategoryIcon from '../ui/CategoryIcon'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import useWalletStore from '../../store/useWalletStore'

export const TransactionItemCard = memo(function TransactionItemCard({
  transaction,
  swipedTransactionId,
  highlightedTransactionId,
  openEditTransaction,
  deleteTransaction,
  setSwipedTransactionId,
  getSwipeHandlers,
  getCategoryColorClass,
  resolveTransactionIconKey,
  getTransactionCategoryLabels,
  format,
  t,
  locale,
  defaultCurrency,
  formatCurrency,
  convertCurrency,
  rates,
  setApiError,
  setApiErrorTone,
  contextWalletId,
  wallets: walletsProp,
  newestTransactionId,
}) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const handleConfirmDelete = async () => {
    try {
      if (setApiError) setApiError('')
      if (setApiErrorTone) setApiErrorTone('error')
      await deleteTransaction(transaction.id)
      if (setSwipedTransactionId) setSwipedTransactionId((prev) => (prev === transaction.id ? null : prev))
      setIsDeleteModalOpen(false)
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (setApiError) setApiError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
      if (setApiErrorTone) setApiErrorTone('error')
    }
  }

  const wallets = walletsProp && walletsProp.length > 0 ? walletsProp : useWalletStore.getState().wallets

  const getWalletName = (id) => {
    if (!id) return 'Wallet'
    const found = wallets?.find((w) => String(w.id) === String(id))
    return found?.name || 'Wallet'
  }

  let iconKey = resolveTransactionIconKey(transaction.category, transaction.type)
  let colorClass = getCategoryColorClass(iconKey, transaction.type, transaction.category)
  let labels = getTransactionCategoryLabels(transaction.category, transaction.type, locale)
  let amountPrefix = transaction.type === 'income' ? '+' : '-'
  let amountColorClass = transaction.type === 'income' ? 'ft-income-text' : 'ft-expense-text'

  if (transaction.type === 'balance_adjustment') {
    iconKey = 'adjustment'
    colorClass = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25'
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
      colorClass = 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
      const fromName = getWalletName(transaction.walletId)
      const toName = getWalletName(transaction.targetWalletId)
      labels = {
        main: locale === 'en' ? 'Transfer' : 'Transfer',
        sub: `${fromName} ➔ ${toName}`,
      }
      amountPrefix = ''
      amountColorClass = 'text-blue-600 dark:text-blue-400'
    }
  }

  let createdTime = null
  const createdAtMs = Number(transaction?.createdAt)
  if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
    createdTime = format(new Date(createdAtMs), 'HH:mm')
  }

  const isTransfer = transaction.type === 'transfer'
  const sub = labels.sub || null
  const noteStr = transaction.notes ? String(transaction.notes).trim() : ''
  const walletName = !isTransfer ? getWalletName(transaction.walletId) : null
  const isContextWalletMatch = Boolean(contextWalletId && String(contextWalletId) === String(transaction.walletId))
  const displayWalletName = isContextWalletMatch ? null : walletName

  const isSwiped = swipedTransactionId === transaction.id

  return (
    <div
      key={transaction.id}
      data-transaction-id={transaction.id}
      className="relative overflow-hidden bg-[var(--panel-strong)] hover:bg-[var(--field-bg)]/60 transition-colors"
    >
      {/* Progressive Swipe Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-end px-5 opacity-0 transition-colors duration-200" />

      <article
        className={`relative z-10 flex touch-pan-y items-center justify-between gap-3 p-3 sm:px-4 transition-colors ${
          highlightedTransactionId === String(transaction.id)
            ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/50'
            : ''
        }`}
        onClick={() => {
          if (isSwiped && setSwipedTransactionId) {
            setSwipedTransactionId(null)
          }
        }}
        {...(getSwipeHandlers ? getSwipeHandlers(transaction.id, { onEdit: () => openEditTransaction?.(transaction), onDelete: () => setIsDeleteModalOpen(true) }) : {})}
      >
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
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="truncate text-sm font-extrabold text-[var(--fg)] leading-tight">{labels.main}</p>
              {newestTransactionId && String(transaction.id) === String(newestTransactionId) ? (
                <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.2 text-[8.5px] font-black tracking-wider text-[var(--bg)] shrink-0">
                  BARU
                </span>
              ) : null}
            </div>

            {/* Line 2: Wallet / Flow & Subcategory & Time */}
            <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-[var(--muted)]">
              {isTransfer ? (
                <>
                  <span className="text-[var(--fg)]/90 font-bold">{sub}</span>
                  {createdTime ? <span className="mx-1 opacity-40 text-[9px]">•</span> : null}
                  {createdTime ? <span className="tabular-nums opacity-75">{createdTime}</span> : null}
                </>
              ) : (
                <>
                  {displayWalletName ? <span className="text-[var(--fg)]/80 font-bold">{displayWalletName}</span> : null}
                  {displayWalletName && (sub || createdTime) ? <span className="mx-1 opacity-40 text-[9px]">•</span> : null}
                  {sub ? <span>{sub}</span> : null}
                  {sub && createdTime ? <span className="mx-1 opacity-40 text-[9px]">•</span> : null}
                  {createdTime ? <span className="tabular-nums opacity-75">{createdTime}</span> : null}
                </>
              )}
            </p>

            {/* Line 3: Notes (Dedicated Line with line-clamp-2) */}
            {noteStr ? (
              <p className="mt-0.5 text-[11px] font-normal italic text-[var(--muted-2)] line-clamp-2 leading-snug break-words">
                "{noteStr}"
              </p>
            ) : null}
          </div>
        </div>

        {/* Amount */}
        <div className="shrink-0 max-w-[45%] pl-2 text-right">
          <p
            className={`break-all text-[14.5px] sm:text-[15px] font-black tabular-nums tracking-tight leading-tight ${amountColorClass}`}
          >
            {isContextWalletMatch ? '' : amountPrefix}
            {formatCurrency(Math.abs(Number(transaction.amount || 0)), transaction.currency)}
          </p>
          {String(transaction.currency || defaultCurrency) !== String(defaultCurrency) ? (
            <p className="ft-muted break-all text-[10px] tabular-nums mt-0.5">
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
        </div>
      </article>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t('tx.item.delete') || 'Hapus Transaksi'}
        message={t('tx.item.deleteConfirm') || 'Apakah Anda yakin ingin menghapus transaksi ini?'}
      />
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.transaction === nextProps.transaction &&
    (prevProps.swipedTransactionId === prevProps.transaction?.id) === (nextProps.swipedTransactionId === nextProps.transaction?.id) &&
    (prevProps.isSwipingId === prevProps.transaction?.id) === (nextProps.isSwipingId === nextProps.transaction?.id) &&
    (prevProps.highlightedTransactionId === String(prevProps.transaction?.id)) === (nextProps.highlightedTransactionId === String(nextProps.transaction?.id)) &&
    (prevProps.newestTransactionId === prevProps.transaction?.id) === (nextProps.newestTransactionId === nextProps.transaction?.id) &&
    prevProps.locale === nextProps.locale &&
    prevProps.defaultCurrency === nextProps.defaultCurrency &&
    prevProps.rates === nextProps.rates &&
    prevProps.contextWalletId === nextProps.contextWalletId
  )
})
