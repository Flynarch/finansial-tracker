import { useState } from 'react'
import PropTypes from 'prop-types'
import { Check, Trash2, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react'
import { db } from '../../lib/db'
import { invalidateWalletBalance } from '../../lib/balanceEngine'

export default function StagingReviewInbox({
  pendingTransactions = [],
  wallets = [],
  formatCurrency,
  defaultCurrency = 'IDR',
  t,
}) {
  const [selectedWalletMap, setSelectedWalletMap] = useState({})
  const [isProcessingId, setIsProcessingId] = useState(null)

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return null
  }

  const handleWalletChange = (txId, walletId) => {
    setSelectedWalletMap((prev) => ({
      ...prev,
      [txId]: Number(walletId),
    }))
  }

  const handleApprove = async (tx) => {
    const targetWalletId = selectedWalletMap[tx.id] || tx.walletId || wallets[0]?.id
    if (!targetWalletId) return

    setIsProcessingId(tx.id)
    try {
      await db.transactions.update(tx.id, {
        walletId: Number(targetWalletId),
        isPendingReview: false,
      })

      const affectedWallets = [tx.walletId, Number(targetWalletId)].filter(Boolean)
      await invalidateWalletBalance(affectedWallets)
    } catch (err) {
      console.error('Failed to approve staged transaction:', err)
    } finally {
      setIsProcessingId(null)
    }
  }

  const handleDismiss = async (tx) => {
    setIsProcessingId(tx.id)
    try {
      await db.transactions.delete(tx.id)
      if (tx.walletId) {
        await invalidateWalletBalance([Number(tx.walletId)])
      }
    } catch (err) {
      console.error('Failed to dismiss staged transaction:', err)
    } finally {
      setIsProcessingId(null)
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3.5 sm:p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold text-[var(--fg)]">
            {t('tx.staging.title', 'Tinjau Notifikasi Mutasi')} ({pendingTransactions.length})
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-[var(--muted)] px-2 py-0.5 rounded-full bg-[var(--field-bg)] border border-[var(--border)]">
          {t('tx.staging.desc', 'Pilih dompet')}
        </span>
      </div>

      <div className="space-y-2">
        {pendingTransactions.map((tx) => {
          const currentWalletId = selectedWalletMap[tx.id] || tx.walletId || wallets[0]?.id || ''
          const isIncome = tx.type === 'income'
          const isTransfer = tx.type === 'transfer'

          return (
            <div
              key={tx.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    isIncome
                      ? 'bg-[var(--income)]/10 text-[var(--income)]'
                      : isTransfer
                      ? 'bg-[var(--status-transfer-soft)] text-[var(--status-transfer)]'
                      : 'bg-[var(--expense)]/10 text-[var(--expense)]'
                  }`}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : isTransfer ? (
                    <ArrowRightLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--fg)] truncate">
                      {tx.notes || tx.category || 'Mutasi Bank'}
                    </span>
                    <span className="text-[10px] text-[var(--muted)] shrink-0">{tx.date}</span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--fg)] mt-0.5">
                    {formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <select
                  value={currentWalletId}
                  onChange={(e) => handleWalletChange(tx.id, e.target.value)}
                  className="h-8 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 text-xs font-medium text-[var(--fg)] focus:border-[var(--accent)] outline-none"
                  aria-label={t('tx.staging.selectWallet', 'Pilih Dompet')}
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isProcessingId === tx.id}
                  onClick={() => handleApprove(tx)}
                  className="flex h-8 items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{t('tx.staging.approve', 'Setujui')}</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessingId === tx.id}
                  onClick={() => handleDismiss(tx)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-rose-500 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  aria-label={t('tx.staging.dismiss', 'Abaikan')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

StagingReviewInbox.propTypes = {
  pendingTransactions: PropTypes.array,
  wallets: PropTypes.array,
  formatCurrency: PropTypes.func.isRequired,
  defaultCurrency: PropTypes.string,
  t: PropTypes.func.isRequired,
}
