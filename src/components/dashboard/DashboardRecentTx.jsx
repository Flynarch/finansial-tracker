import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'
import { convertCurrency, formatCurrency, toSafeNumber } from '../../lib/utils'
import { getCategoryColorClass, getTransactionCategoryLabels, resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../ui/CategoryIcon'

export const DashboardRecentTx = memo(function DashboardRecentTx({
  groupedRecentEntries,
  isDbLoading,
  defaultCurrency,
  locale,
  rates,
  t,
}) {
  const navigate = useNavigate()

  const formatDateHeader = useCallback(
    (dateKey) => {
      if (!dateKey || dateKey === 'unknown') return 'Tanggal tidak diketahui'
      const dateObj = new Date(`${dateKey}T12:00:00`)
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
          <h3 className="text-sm font-bold tracking-tight text-[var(--fg)]">Transaksi Terakhir</h3>
          <div className="flex items-center gap-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]">
            <span>Lihat Semua</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {groupedRecentEntries && groupedRecentEntries.length > 0 ? (() => {
          const [latestDateKey, items] = groupedRecentEntries[0]
          const latestTx = items[0]
          const dateLabel = formatDateHeader(latestDateKey)

          const iconKey = resolveTransactionIconKey(latestTx?.category, latestTx?.type)
          const colorClass = getCategoryColorClass(iconKey, latestTx?.type, latestTx?.category)
          const labels = getTransactionCategoryLabels(latestTx?.category, latestTx?.type, locale)

          let createdTime = null
          const createdAtMs = Number(latestTx?.createdAt)
          if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
            createdTime = format(new Date(createdAtMs), 'HH:mm')
          }

          const sub = labels.sub || null
          const noteStr = latestTx?.notes ? String(latestTx.notes).trim() : ''
          const isExpense = latestTx?.type === 'expense'

          return (
            <div className="flex flex-col gap-2 ft-smooth-in">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-80" />
                  <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--fg)]">{dateLabel}</p>
                </div>
                <span className="rounded-lg border border-[var(--border)] bg-[var(--accent)] px-2 py-0.5 text-[9px] font-black tracking-wider text-[var(--bg)]">
                  BARU
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${colorClass}`}>
                      <CategoryIcon iconKey={iconKey} className="h-4 w-4" />
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
                        <p className="mt-0.5 truncate text-[9px] italic leading-tight text-[var(--muted-2)]">{noteStr}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs sm:text-sm font-black tabular-nums ${
                      isExpense ? 'text-[var(--status-expense)]' : 'text-[var(--status-income)]'
                    }`}>
                      {isExpense ? '-' : '+'}
                      {formatCurrency(
                        convertCurrency(toSafeNumber(latestTx?.amount), latestTx?.currency || defaultCurrency, defaultCurrency, rates),
                        defaultCurrency,
                        locale,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })() : isDbLoading ? (
          <div className="flex items-center gap-3 py-3 px-2 animate-pulse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--border)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 rounded bg-[var(--border)]" />
              <div className="h-2.5 w-1/2 rounded bg-[var(--border)]/60" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-3 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
              <ChevronRight className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[var(--fg)]">{t('dashboard.history.empty') || 'Belum ada transaksi'}</p>
              <p className="text-[10px] mt-0.5 font-medium text-[var(--muted)]">Mulai catat pengeluaran pertamamu.</p>
            </div>
          </div>
        )}
      </button>
    </section>
  )
})

export default DashboardRecentTx
