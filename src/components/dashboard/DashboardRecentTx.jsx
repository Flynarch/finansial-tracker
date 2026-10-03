import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { ChevronRight, ReceiptText, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import { convertCurrency, formatCurrency, toSafeNumber } from '../../lib/utils'
import { getCategoryColorClass, getTransactionCategoryLabels, resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../ui/CategoryIcon'
import MoneyBagIcon from '../ui/MoneyBagIcon'

export const DashboardRecentTx = memo(function DashboardRecentTx({
  groupedRecentEntries,
  isDbLoading,
  defaultCurrency,
  locale,
  rates,
  wallets: walletsProp,
  t,
}) {
  const navigate = useNavigate()
  const dbWallets = useLiveQuery(() => (walletsProp && walletsProp.length > 0 ? null : db.wallets.toArray()), [walletsProp])
  const wallets = walletsProp && walletsProp.length > 0 ? walletsProp : (dbWallets || [])

  const formatDateHeader = useCallback(
    (dateKey) => {
      if (!dateKey || dateKey === 'unknown' || dateKey === 'Unknown') return 'Tanggal tidak diketahui'
      const cleanDateKey = String(dateKey || '').slice(0, 10)
      const dateObj = new Date(`${cleanDateKey}T12:00:00`)
      if (Number.isNaN(dateObj.getTime())) return dateKey
      return format(dateObj, 'EEEE, d MMMM yyyy', {
        locale: locale === 'en' ? enUS : idLocale,
      })
    },
    [locale],
  )

  return (
    <section className="ft-stagger-in" style={{ '--stagger': 1 }}>
      <button
        type="button"
        onClick={() => navigate('/transactions')}
        className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm hover:border-[var(--border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold tracking-tight text-[var(--fg)]">
            {t('dashboard.recentTransactions', 'Transaksi Terakhir')}
          </h3>
          <div className="flex items-center gap-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]">
            <span>{t('common.viewAll', 'Lihat Semua')}</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {groupedRecentEntries && groupedRecentEntries.length > 0 ? (() => {
          const [latestDateKey, items] = groupedRecentEntries[0]
          const latestTx = items[0]
          const dateLabel = formatDateHeader(latestDateKey)

          let iconKey = resolveTransactionIconKey(latestTx?.category, latestTx?.type)
          let colorClass = getCategoryColorClass(iconKey, latestTx?.type, latestTx?.category)
          let labels = getTransactionCategoryLabels(latestTx?.category, latestTx?.type, locale)
          let amountPrefix = latestTx?.type === 'income' ? '+' : '-'
          let amountColorClass = latestTx?.type === 'income' ? 'text-[var(--status-income)]' : 'text-[var(--status-expense)]'

          if (latestTx?.type === 'transfer') {
            iconKey = 'transfer'
            colorClass = 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]'
            const fromW = wallets.find((w) => String(w.id) === String(latestTx.walletId))
            const toW = wallets.find((w) => String(w.id) === String(latestTx.targetWalletId))
            const fromName = fromW?.name || 'Wallet'
            const toName = toW?.name || 'Wallet'
            labels = {
              main: locale === 'en' ? 'Transfer' : 'Transfer',
              sub: `${fromName} -> ${toName}`,
            }
            amountPrefix = ''
            amountColorClass = 'text-[var(--accent)]'
          } else if (latestTx?.type === 'balance_adjustment') {
            iconKey = 'adjustment'
            colorClass = 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]'
            labels = {
              main: locale === 'en' ? 'Balance Adjustment' : 'Penyesuaian Saldo',
              sub: locale === 'en' ? 'System' : 'Sistem',
            }
            const val = Number(latestTx.amount || 0)
            if (val > 0) {
              amountPrefix = '+'
              amountColorClass = 'text-[var(--status-income)]'
            } else if (val < 0) {
              amountPrefix = '-'
              amountColorClass = 'text-[var(--status-expense)]'
            } else {
              amountPrefix = ''
              amountColorClass = 'text-[var(--fg)]'
            }
          }

          let createdTime = null
          const createdAtMs = Number(latestTx?.createdAt)
          if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
            createdTime = format(new Date(createdAtMs), 'HH:mm')
          }

          const sub = labels.sub || null
          const noteStr = latestTx?.notes ? String(latestTx.notes).trim() : ''

          return (
            <div className="flex flex-col gap-2 ft-smooth-in">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{dateLabel}</p>
                <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
                  {t('dashboard.newBadge', 'BARU')}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${colorClass}`}>
                        <CategoryIcon iconKey={iconKey} className="h-4 w-4" />
                      </div>
                      {(() => {
                        const originWallet = wallets.find((w) => String(w.id) === String(latestTx?.walletId))
                        if (!originWallet) return null
                        const isCash = originWallet.customIcon === 'dollar' || originWallet.customIcon === 'cash' || String(originWallet.name || '').toLowerCase().includes('cash') || String(originWallet.name || '').toLowerCase().includes('uang tunai')
                        const logo = getWalletLogoUrl(originWallet)
                        return (
                          <div
                            className="absolute -bottom-1 -right-1 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[var(--wallet-logo-border,var(--border))] bg-[var(--wallet-logo-bg,var(--panel-strong))] shadow-2xs"
                            title={originWallet.name}
                          >
                            {isCash ? (
                              <div className="w-full h-full flex items-center justify-center text-amber-500">
                                <MoneyBagIcon size={9} strokeWidth={2.5} />
                              </div>
                            ) : logo ? (
                              <img
                                src={logo}
                                alt={originWallet.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <span
                              className="text-[6.5px] font-black leading-none text-[var(--fg)] flex items-center justify-center"
                              style={{ display: isCash || logo ? 'none' : 'flex' }}
                            >
                              {originWallet.name ? originWallet.name.substring(0, 2).toUpperCase() : 'W'}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {createdTime ? (
                        <p className="text-[9px] font-medium leading-tight text-[var(--muted)]">{createdTime}</p>
                      ) : null}
                      <p className="truncate text-xs font-bold text-[var(--fg)]">{labels.main}</p>
                      {sub ? (
                        <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-[var(--muted)]">{sub}</p>
                      ) : null}
                      {noteStr ? (
                        <p className="mt-0.5 text-[9.5px] italic leading-tight text-[var(--muted-2)] line-clamp-2 break-words [overflow-wrap:anywhere]">&ldquo;{noteStr}&rdquo;</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs sm:text-sm font-black tabular-nums ${amountColorClass}`}>
                      {amountPrefix}
                      {formatCurrency(
                        Math.abs(Number(latestTx?.amount || 0)),
                        latestTx?.currency || defaultCurrency,
                        locale,
                      )}
                    </p>
                    {String(latestTx?.currency || defaultCurrency) !== String(defaultCurrency) ? (
                      <p className="text-[10px] text-[var(--muted)] tabular-nums mt-0.5">
                        ≈{' '}
                        {formatCurrency(
                          convertCurrency(toSafeNumber(latestTx?.amount), latestTx?.currency || defaultCurrency, defaultCurrency, rates),
                          defaultCurrency,
                          locale,
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })() : isDbLoading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/40 p-2.5 animate-pulse">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-[var(--border)]/70" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3 w-28 rounded bg-[var(--border)]/80" />
                  <div className="h-2 w-36 rounded bg-[var(--border)]/50" />
                </div>
              </div>
              <div className="h-6 w-14 rounded-lg bg-[var(--border)]/60" />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--field-bg)]/40 p-2.5 transition-colors hover:border-[var(--border-strong)]">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[var(--fg)]">
                    {t('dashboard.history.empty', 'Belum Ada Transaksi')}
                  </p>
                  <p className="truncate text-[10px] font-medium text-[var(--muted)]">
                    {t('dashboard.history.emptyDescCompact', 'Mulai catat transaksi pertamamu')}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 border border-[var(--accent)]/25 px-2 py-1 text-[10px] font-extrabold text-[var(--accent)] shadow-2xs">
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                  <span>{t('dashboard.history.add', 'Catat')}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </button>
    </section>
  )
})

export default DashboardRecentTx
