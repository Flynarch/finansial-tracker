import { memo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Wallet } from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import { db } from '../../lib/db'
import { getWalletLogoUrl } from '../../data/walletInstitutions'

export const TransactionItemCard = memo(function TransactionItemCard({
  transaction,
  swipedTransactionId,
  isSwipingId,
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
}) {
  const walletsInternal = useLiveQuery(() => (walletsProp ? undefined : db.wallets.toArray()), [walletsProp])
  const wallets = walletsProp || walletsInternal

  const getWalletName = (id) => wallets?.find(w => w.id === id)?.name || 'Wallet'

  let iconKey = resolveTransactionIconKey(transaction.category, transaction.type)
  let colorClass = getCategoryColorClass(iconKey, transaction.type, transaction.category)
  let labels = getTransactionCategoryLabels(transaction.category, transaction.type, locale)
  let amountPrefix = transaction.type === 'income' ? '+' : '-'
  let amountColorClass = transaction.type === 'income' ? 'ft-income-text' : 'ft-expense-text'

  if (transaction.type === 'transfer') {
    iconKey = 'arrow-right-left'
    if (contextWalletId && contextWalletId === transaction.targetWalletId) {
      colorClass = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
      labels = { main: `Transfer dari ${getWalletName(transaction.walletId)}`, sub: 'Transfer Masuk' }
      amountPrefix = '+'
      amountColorClass = 'ft-income-text'
    } else if (contextWalletId && contextWalletId === transaction.walletId) {
      colorClass = 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
      labels = { main: `Transfer ke ${getWalletName(transaction.targetWalletId)}`, sub: 'Transfer Keluar' }
      amountPrefix = '-'
      amountColorClass = 'ft-expense-text'
    } else {
      // Global view
      colorClass = 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
      labels = { main: `Transfer: ${getWalletName(transaction.walletId)} ➔ ${getWalletName(transaction.targetWalletId)}`, sub: 'Transfer Antar Wallet' }
      amountPrefix = ''
      amountColorClass = 'text-blue-600 dark:text-blue-400'
    }
  }

  let createdTime = null
  const createdAtMs = Number(transaction?.createdAt)
  if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
    createdTime = format(new Date(createdAtMs), 'HH:mm')
  }

  const sub = labels.sub || null
  const noteStr = transaction.notes ? String(transaction.notes).trim() : ''
  const walletName = transaction.type !== 'transfer' ? getWalletName(transaction.walletId) : null

  return (
    <div
      key={transaction.id}
      data-transaction-id={transaction.id}
      className="relative overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--field-bg)]"
    >
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)]"
          onClick={() => openEditTransaction(transaction)}
        >
          {t('tx.item.edit')}
        </button>
        <button
          type="button"
          className="rounded-lg border border-rose-500/30 bg-rose-500/12 px-3 py-1.5 text-xs font-semibold text-rose-400"
          onClick={async () => {
            const ok = window.confirm(t('tx.item.deleteConfirm'))
            if (!ok) return
            try {
              if(setApiError) setApiError('')
              if(setApiErrorTone) setApiErrorTone('error')
              await deleteTransaction(transaction.id)
              if(setSwipedTransactionId) setSwipedTransactionId((prev) => (prev === transaction.id ? null : prev))
            } catch {
              const offline = typeof navigator !== 'undefined' && navigator.onLine === false
              if(setApiError) setApiError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
              if(setApiErrorTone) setApiErrorTone('error')
            }
          }}
        >
          {t('tx.item.delete')}
        </button>
      </div>

      <article
        className={`relative flex touch-pan-y items-center justify-between gap-3 bg-[var(--field-bg)] p-3 transition-all duration-200 ${
          swipedTransactionId === transaction.id ? '-translate-x-[118px]' : 'translate-x-0'
        } ${isSwipingId === transaction.id ? 'shadow-[0_6px_18px_rgba(15,23,42,0.08)]' : ''} ${
          highlightedTransactionId === String(transaction.id)
            ? 'ring-2 ring-[var(--accent)]/50'
            : ''
        }`}
        {...(getSwipeHandlers ? getSwipeHandlers(transaction.id) : {})}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold ${colorClass}`}
            >
              {transaction.type === 'transfer' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M21 3 9 15"/><path d="M8 21H3v-5"/><path d="M3 21l12-12"/></svg>
              ) : (
                <CategoryIcon icon={iconKey} className="h-5 w-5" />
              )}
            </div>

            {/* Micro-Avatar Wallet Badge */}
            {(() => {
              const walletObj = wallets?.find((w) => String(w.id) === String(transaction.walletId))
              if (!walletObj) return null
              const logo = getWalletLogoUrl(walletObj)
              return (
                <div
                  className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center overflow-hidden rounded-full border-1.5 border-[var(--field-bg)] bg-[var(--panel-strong)] shadow-2xs"
                  title={walletObj.name}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={walletObj.name}
                      className="h-full w-full object-contain p-[1px] rounded-full"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <span
                    className="text-[7px] font-black leading-none text-[var(--fg)] flex items-center justify-center"
                    style={{ display: logo ? 'none' : 'flex' }}
                  >
                    {walletObj.name ? walletObj.name.substring(0, 2).toUpperCase() : 'W'}
                  </span>
                </div>
              )
            })()}
          </div>

          <div className="min-w-0 flex-1">
            {createdTime ? (
              <p className="text-[10px] font-medium leading-tight text-[var(--muted)]">{createdTime}</p>
            ) : null}
            <p className="truncate text-sm font-semibold text-[var(--fg)]">{labels.main}</p>
            {(sub || walletName) && (
              <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-[var(--muted)]">
                {sub ? <span>{sub}</span> : null}
                {sub && walletName ? <span className="mx-1 opacity-40 text-[9px]">•</span> : null}
                {walletName ? <span className="font-semibold text-[var(--fg)]/80">{walletName}</span> : null}
              </p>
            )}
            {noteStr ? (
              <p className="mt-0.5 truncate text-[10px] italic leading-tight text-[var(--muted-2)]">
                {noteStr}
              </p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 max-w-[50%] pl-2 text-right">
          <p
            className={`break-all text-sm font-semibold tabular-nums ${amountColorClass}`}
          >
            {amountPrefix}
            {formatCurrency(Math.abs(Number(transaction.amount || 0)), transaction.currency)}
          </p>
          {String(transaction.currency || defaultCurrency) !== String(defaultCurrency) ? (
            <p className="ft-muted break-all text-[11px]">
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
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.transaction === nextProps.transaction &&
    (prevProps.swipedTransactionId === prevProps.transaction?.id) === (nextProps.swipedTransactionId === nextProps.transaction?.id) &&
    (prevProps.isSwipingId === prevProps.transaction?.id) === (nextProps.isSwipingId === nextProps.transaction?.id) &&
    (prevProps.highlightedTransactionId === String(prevProps.transaction?.id)) === (nextProps.highlightedTransactionId === String(nextProps.transaction?.id)) &&
    prevProps.locale === nextProps.locale &&
    prevProps.defaultCurrency === nextProps.defaultCurrency &&
    prevProps.rates === nextProps.rates &&
    prevProps.contextWalletId === nextProps.contextWalletId
  )
})
