import { memo } from 'react'
import { Receipt } from 'lucide-react'
import CategoryIcon from '../../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../../lib/categoryIcon'
import { formatCurrency } from '../../../lib/utils'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../../lib/fieldEncryption'
import { getWalletLogoUrl } from '../../../data/walletInstitutions'
import useTranslation from '../../../hooks/useTranslation'

export const SingleTxReceiptCard = memo(function SingleTxReceiptCard({
  tx,
  defaultCurrency = 'IDR',
  locale = 'id',
  wallets = [],
}) {
  const { t } = useTranslation()
  const isIncome = tx.type === 'income'
  const isTransfer = tx.type === 'transfer'
  const iconKey = resolveTransactionIconKey(tx.category, tx.type)
  const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
  const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)

  const walletObj = wallets.find((w) => String(w.id) === String(tx.walletId))
  const walletLogo = walletObj ? getWalletLogoUrl(walletObj) : null
  const targetWalletObj = isTransfer ? wallets.find((w) => String(w.id) === String(tx.targetWalletId)) : null
  const targetWalletLogo = targetWalletObj ? getWalletLogoUrl(targetWalletObj) : null

  const rawNote = tx.notes || ''
  const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
  const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote

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
        {safeNote ? (
          <div className="col-span-2 pt-1 mt-0.5 border-t border-[var(--border)]/30 min-w-0">
            <span className="text-[9.5px] font-bold text-[var(--muted)] block uppercase tracking-wider">
              {t('addTx.notes', 'Catatan')}
            </span>
            <p className="text-[11px] text-[var(--fg)] italic line-clamp-2 break-words [overflow-wrap:anywhere] mt-0.5">
              &ldquo;{safeNote}&rdquo;
            </p>
          </div>
        ) : null}
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
})

export default SingleTxReceiptCard
