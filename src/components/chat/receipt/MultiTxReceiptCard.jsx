import { memo } from 'react'
import { format } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { Layers, Pencil } from 'lucide-react'
import CategoryIcon from '../../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../../lib/categoryIcon'
import { formatCurrency } from '../../../lib/utils'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../../lib/fieldEncryption'
import { getWalletLogoUrl } from '../../../data/walletInstitutions'
import useTranslation from '../../../hooks/useTranslation'

export const MultiTxReceiptCard = memo(function MultiTxReceiptCard({
  txList = [],
  defaultCurrency = 'IDR',
  displayCurrency = 'IDR',
  locale = 'id',
  wallets = [],
  netTotal = 0,
  totalExpense = 0,
  totalIncome = 0,
  onStartEdit,
}) {
  const { t } = useTranslation()
  const dateLocaleObj = locale === 'id' ? idLocale : enUS

  return (
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
          const walletObj = wallets.find((w) => String(w.id) === String(tx.walletId))
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
                  onClick={() => onStartEdit(tx)}
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
  )
})

export default MultiTxReceiptCard
