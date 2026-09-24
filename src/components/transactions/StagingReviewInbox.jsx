import { useState } from 'react'
import { Check, CheckCheck, Trash2, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, ArrowRight, Edit2, Sparkles } from 'lucide-react'
import { db } from '../../lib/db'
import { invalidateWalletBalance } from '../../lib/balanceEngine'
import { scheduleNativeWidgetSync } from '../../lib/nativeWidgetSync'
import { deleteTransaction } from '../../services/transactionService'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import { rememberMerchantCategory, classifyMerchantWithAi } from '../../lib/ai/merchantCategorizer'

export default function StagingReviewInbox({
  pendingTransactions = [],
  wallets = [],
  formatCurrency,
  defaultCurrency = 'IDR',
  locale = 'id',
  onEditTransaction,
  t,
}) {
  const [selectedWalletMap, setSelectedWalletMap] = useState({})
  const [selectedTargetWalletMap, setSelectedTargetWalletMap] = useState({})
  const [isProcessingId, setIsProcessingId] = useState(null)
  const [isProcessingAll, setIsProcessingAll] = useState(false)
  const [isProcessingAiId, setIsProcessingAiId] = useState(null)

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return null
  }

  const handleWalletChange = (txId, walletId) => {
    setSelectedWalletMap((prev) => ({
      ...prev,
      [txId]: Number(walletId),
    }))
  }

  const handleTargetWalletChange = (txId, walletId) => {
    setSelectedTargetWalletMap((prev) => ({
      ...prev,
      [txId]: Number(walletId),
    }))
  }

  const handleApprove = async (tx) => {
    const isTransfer = tx.type === 'transfer'
    const sourceWalletId = selectedWalletMap[tx.id] || tx.walletId || wallets[0]?.id
    if (!sourceWalletId) return

    let destWalletId = undefined
    if (isTransfer) {
      destWalletId =
        selectedTargetWalletMap[tx.id] ||
        (tx.targetWalletId && Number(tx.targetWalletId) !== Number(sourceWalletId) ? tx.targetWalletId : undefined) ||
        wallets.find((w) => Number(w.id) !== Number(sourceWalletId))?.id
      if (!destWalletId || Number(destWalletId) === Number(sourceWalletId)) return
    }

    setIsProcessingId(tx.id)
    try {
      const updateData = {
        walletId: Number(sourceWalletId),
        isPendingReview: false,
      }
      if (isTransfer) {
        updateData.targetWalletId = Number(destWalletId)
      } else {
        updateData.targetWalletId = null
      }

      await db.transactions.update(tx.id, updateData)

      // Automatically learn user's merchant categorization
      if (tx.category && tx.category !== 'lainnya_kategori/umum' && tx.category !== 'lainnya/umum') {
        const merchant = tx.cleanMerchant || tx.notes || ''
        rememberMerchantCategory(merchant, tx.category, tx.type)
      }

      const affectedWallets = [
        tx.walletId,
        Number(sourceWalletId),
        tx.targetWalletId,
        isTransfer ? Number(destWalletId) : null,
      ].filter(Boolean)
      await invalidateWalletBalance(Array.from(new Set(affectedWallets)))
      scheduleNativeWidgetSync()
    } catch (err) {
      console.error('[StagingReviewInbox:approve]', err)
    } finally {
      setIsProcessingId(null)
    }
  }

  const handleDismiss = async (tx) => {
    setIsProcessingId(tx.id)
    try {
      await deleteTransaction(tx.id)
      scheduleNativeWidgetSync()
    } catch (err) {
      console.error('[StagingReviewInbox:dismiss]', err)
    } finally {
      setIsProcessingId(null)
    }
  }

  const handleApproveAll = async () => {
    if (!pendingTransactions || pendingTransactions.length === 0) return
    setIsProcessingAll(true)
    try {
      const affectedWallets = new Set()
      for (const tx of pendingTransactions) {
        const isTransfer = tx.type === 'transfer'
        const sourceWalletId = Number(selectedWalletMap[tx.id] || tx.walletId || wallets[0]?.id)
        if (!sourceWalletId) continue

        let destWalletId = undefined
        if (isTransfer) {
          destWalletId = Number(
            selectedTargetWalletMap[tx.id] ||
            (tx.targetWalletId && Number(tx.targetWalletId) !== sourceWalletId ? tx.targetWalletId : undefined) ||
            wallets.find((w) => Number(w.id) !== sourceWalletId)?.id
          )
          if (!destWalletId || destWalletId === sourceWalletId) {
            continue
          }
          if (tx.targetWalletId) affectedWallets.add(Number(tx.targetWalletId))
          affectedWallets.add(destWalletId)
        }

        if (tx.walletId) affectedWallets.add(Number(tx.walletId))
        affectedWallets.add(sourceWalletId)

        const updateData = {
          walletId: sourceWalletId,
          isPendingReview: false,
        }
        if (isTransfer) {
          updateData.targetWalletId = destWalletId
        } else {
          updateData.targetWalletId = null
        }

        await db.transactions.update(tx.id, updateData)

        // Automatically learn user's merchant categorization in bulk
        if (tx.category && tx.category !== 'lainnya_kategori/umum' && tx.category !== 'lainnya/umum') {
          const merchant = tx.cleanMerchant || tx.notes || ''
          rememberMerchantCategory(merchant, tx.category, tx.type)
        }
      }

      const walletIdsArray = Array.from(affectedWallets).filter(Boolean)
      if (walletIdsArray.length > 0) {
        await invalidateWalletBalance(walletIdsArray)
      }
      scheduleNativeWidgetSync()
    } catch (err) {
      console.error('[StagingReviewInbox:approveAll]', err)
    } finally {
      setIsProcessingAll(false)
    }
  }

  const handleDismissAll = async () => {
    if (!pendingTransactions || pendingTransactions.length === 0) return
    setIsProcessingAll(true)
    try {
      for (const tx of pendingTransactions) {
        await deleteTransaction(tx.id)
      }
      scheduleNativeWidgetSync()
    } catch (err) {
      console.error('[StagingReviewInbox:dismissAll]', err)
    } finally {
      setIsProcessingAll(false)
    }
  }

  const handleAiClassify = async (tx) => {
    const merchant = tx.cleanMerchant || tx.notes || ''
    if (!merchant) return

    setIsProcessingAiId(tx.id)
    try {
      const aiCategory = await classifyMerchantWithAi(merchant, tx.type)
      if (aiCategory) {
        await db.transactions.update(tx.id, { category: aiCategory })
      }
    } catch (err) {
      console.warn('[StagingReviewInbox:aiClassify]', err)
    } finally {
      setIsProcessingAiId(null)
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3.5 sm:p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold text-[var(--fg)]">
            {t('tx.staging.title', 'Tinjau Notifikasi Mutasi')} ({pendingTransactions.length})
          </h3>
        </div>

        {pendingTransactions.length > 1 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={isProcessingAll || isProcessingId !== null || isProcessingAiId !== null}
              onClick={handleApproveAll}
              className="flex h-7 items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 text-[11px] font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>{t('tx.staging.approveAll', 'Setujui Semua')}</span>
            </button>
            <button
              type="button"
              disabled={isProcessingAll || isProcessingId !== null || isProcessingAiId !== null}
              onClick={handleDismissAll}
              className="flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 text-[11px] font-semibold text-[var(--muted)] hover:text-rose-500 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              <span>{t('tx.staging.dismissAll', 'Abaikan Semua')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {pendingTransactions.map((tx) => {
          const currentWalletId = selectedWalletMap[tx.id] || tx.walletId || wallets[0]?.id || ''
          const currentTargetWalletId =
            selectedTargetWalletMap[tx.id] ||
            (tx.targetWalletId && Number(tx.targetWalletId) !== Number(currentWalletId) ? tx.targetWalletId : undefined) ||
            wallets.find((w) => Number(w.id) !== Number(currentWalletId))?.id ||
            ''
          const isIncome = tx.type === 'income'
          const isTransfer = tx.type === 'transfer'
          const isFallbackCategory =
            !tx.category ||
            tx.category === 'lainnya_kategori/umum' ||
            tx.category === 'lainnya/umum' ||
            tx.category === 'Lainnya'

          const categoryLabel = tx.category
            ? isIncome
              ? formatIncomeCategory(tx.category, locale)
              : formatExpenseCategory(tx.category, locale)
            : null

          return (
            <div
              key={tx.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-[var(--fg)] truncate">
                      {tx.cleanMerchant || tx.notes || tx.category || 'Mutasi Bank'}
                    </span>
                    {tx.suggestedInstitution && (
                      <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--accent)] shrink-0">
                        {tx.suggestedInstitution}
                      </span>
                    )}
                    {categoryLabel && (
                      <span className="rounded-md bg-[var(--field-bg)] border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--muted)] shrink-0">
                        {categoryLabel}
                      </span>
                    )}
                    {isFallbackCategory && (
                      <button
                        type="button"
                        disabled={isProcessingAiId === tx.id || isProcessingAll}
                        onClick={() => handleAiClassify(tx)}
                        className="flex items-center gap-1 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        title={t('tx.staging.aiClassify', 'Tebak Kategori dengan AI')}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>
                          {isProcessingAiId === tx.id
                            ? t('common.loading', 'Memproses...')
                            : t('tx.staging.guessCategory', 'Prediksi AI')}
                        </span>
                      </button>
                    )}
                    <span className="text-[10px] text-[var(--muted)] shrink-0">{tx.date}</span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--fg)] mt-0.5">
                    {formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center shrink-0 flex-wrap sm:flex-nowrap">
                {isTransfer ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={currentWalletId}
                      onChange={(e) => handleWalletChange(tx.id, e.target.value)}
                      className="h-8 max-w-[110px] sm:max-w-none rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 text-xs font-medium text-[var(--fg)] focus:border-[var(--accent)] outline-none"
                      aria-label={t('tx.staging.sourceWallet', 'Dompet Asal')}
                      title={t('tx.staging.sourceWallet', 'Dompet Asal')}
                    >
                      {wallets.map((w) => (
                        <option
                          key={w.id}
                          value={w.id}
                          disabled={Boolean(currentTargetWalletId && Number(w.id) === Number(currentTargetWalletId))}
                        >
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <ArrowRight className="h-3 w-3 text-[var(--muted)] shrink-0" />
                    <select
                      value={currentTargetWalletId}
                      onChange={(e) => handleTargetWalletChange(tx.id, e.target.value)}
                      className="h-8 max-w-[110px] sm:max-w-none rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 text-xs font-medium text-[var(--fg)] focus:border-[var(--accent)] outline-none"
                      aria-label={t('tx.staging.targetWallet', 'Dompet Tujuan')}
                      title={t('tx.staging.targetWallet', 'Dompet Tujuan')}
                    >
                      {wallets.map((w) => (
                        <option
                          key={w.id}
                          value={w.id}
                          disabled={Boolean(currentWalletId && Number(w.id) === Number(currentWalletId))}
                        >
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
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
                )}

                {onEditTransaction && (
                  <button
                    type="button"
                    disabled={isProcessingId === tx.id || isProcessingAll}
                    onClick={() => onEditTransaction(tx)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--accent)] transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    aria-label={t('common.edit', 'Edit')}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    isProcessingId === tx.id ||
                    isProcessingAll ||
                    (isTransfer && (!currentTargetWalletId || Number(currentTargetWalletId) === Number(currentWalletId)))
                  }
                  onClick={() => handleApprove(tx)}
                  className="flex h-8 items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{t('tx.staging.approve', 'Setujui')}</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessingId === tx.id || isProcessingAll}
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
