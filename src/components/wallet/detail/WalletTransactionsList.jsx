import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { format, subDays } from 'date-fns'
import { Search, X } from 'lucide-react'
import { TransactionItemCard } from '../../transactions/TransactionItemCard'
import TransactionEditSheet from '../../transactions/TransactionEditSheet'
import TransactionDetailSheet from '../../transactions/TransactionDetailSheet'
import ReceiptPreviewModal from '../../transactions/ReceiptPreviewModal'
import ConfirmDeleteModal from '../../ui/ConfirmDeleteModal'
import EmptyState from '../../ui/EmptyState'
import useSwipeAction from '../../../hooks/useSwipeAction'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../../lib/fieldEncryption'
import { updateTransaction, deleteTransaction } from '../../../services/transactionService'
import { formatCurrency, formatMoneyValueForInput, parseMoneyInput, convertCurrency } from '../../../lib/utils'
import { getCategoryColorClass, resolveTransactionIconKey, getTransactionCategoryLabels } from '../../../lib/categoryIcon'
import { isTransactionNew } from '../../../lib/transactionLastSeen'
import useTranslation from '../../../hooks/useTranslation'

export const WalletTransactionsList = memo(function WalletTransactionsList({
  walletId,
  wallet,
  allTransactions,
  transactions,
  allWallets,
  wallets,
  rates = {},
  defaultCurrency = 'IDR',
  locale = 'id',
  t: customT,
  sessionLastSeenTimestamp,
  onError,
}) {
  const { t: fallbackT } = useTranslation()
  const t = customT || fallbackT

  const activeTransactions = useMemo(() => allTransactions || transactions || [], [allTransactions, transactions])
  const activeWallets = useMemo(() => allWallets || wallets || [], [allWallets, wallets])

  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Transaction interaction modal states
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [detailTransaction, setDetailTransaction] = useState(null)
  const [receiptPreviewTx, setReceiptPreviewTx] = useState(null)
  const [singleDeleteTx, setSingleDeleteTx] = useState(null)
  const [editFormData, setEditFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    type: 'expense',
    category: '',
    notes: '',
    currency: 'IDR',
  })

  // Swipe Action Hook
  const {
    swipedId: swipedTransactionId,
    setSwipedId: setSwipedTransactionId,
    isSwipingId,
    getSwipeHandlers,
  } = useSwipeAction()

  // Notes decryption cache synchronization
  const [decryptedTick, setDecryptedTick] = useState(0)
  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((tick) => tick + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  // Edit transaction handler
  const openEditTransaction = useCallback((transaction) => {
    setEditingTransaction(transaction)
    const targetCurrency = transaction.currency || wallet?.currency || defaultCurrency
    const receipt = transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null
    const rawNote = transaction.notes || ''
    const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
    const safeNote = isFieldEncrypted(plainNote) ? '' : plainNote

    setEditFormData({
      date: transaction.date,
      amount: formatMoneyValueForInput(transaction.amount, targetCurrency),
      type: transaction.type,
      category: transaction.category,
      notes: safeNote,
      currency: targetCurrency,
      walletId: transaction.walletId,
      targetWalletId: transaction.targetWalletId || '',
      receiptImage: receipt,
      receipt: receipt,
      isSplit: Boolean(transaction.isSplit),
      splitItems: Array.isArray(transaction.splitItems)
        ? transaction.splitItems.map((si) => {
            const rawSi = si?.notes || ''
            const plainSi = isFieldEncrypted(rawSi) ? getDecryptedNoteSync(rawSi) : rawSi
            return { ...si, notes: isFieldEncrypted(plainSi) ? '' : plainSi }
          })
        : [],
    })
  }, [wallet?.currency, defaultCurrency])

  const handleEditSubmit = async () => {
    if (!editingTransaction?.id) return
    try {
      const tgtWallet = activeWallets?.find((w) => String(w.id) === String(editFormData.targetWalletId))
      const tgtCurr = tgtWallet?.currency || defaultCurrency
      const parsedTargetAmount =
        editFormData.type === 'transfer' && editFormData.targetAmount
          ? parseMoneyInput(editFormData.targetAmount, tgtCurr)
          : undefined

      await updateTransaction(editingTransaction.id, {
        ...editFormData,
        amount: parseMoneyInput(editFormData.amount, editFormData.currency),
        targetAmount: parsedTargetAmount,
        receiptImage: editFormData.receiptImage || null,
        isSplit: Boolean(editFormData.isSplit),
        splitItems: editFormData.isSplit && Array.isArray(editFormData.splitItems) ? editFormData.splitItems : undefined,
      })
      setEditingTransaction(null)
    } catch (err) {
      console.error('[WalletTransactionsList:editTransaction]', err)
      onError?.(err.message || t('tx.editFailed', 'Gagal mengubah transaksi.'))
    }
  }

  const handleConfirmDelete = async () => {
    if (!singleDeleteTx?.id) return
    const txId = singleDeleteTx.id
    setSingleDeleteTx(null)
    try {
      await deleteTransaction(txId)
      if (swipedTransactionId === txId) setSwipedTransactionId(null)
    } catch (err) {
      console.error('[WalletTransactionsList:deleteTransaction]', err)
      onError?.(err.userMessage || err.message || t('tx.deleteFailed', 'Gagal menghapus transaksi.'))
    }
  }

  // Filtered transactions calculation
  const filteredTransactions = useMemo(() => {
    void decryptedTick
    if (!activeTransactions) return []
    const query = searchQuery.trim().toLowerCase()

    return activeTransactions.filter((tx) => {
      if (tx.isPendingReview === true || tx.isPendingReview === 1) return false

      // Tab Filter
      let matchesTab = true
      if (activeTab !== 'all') {
        if (tx.type === activeTab) {
          matchesTab = true
        } else if (tx.type === 'transfer') {
          if (activeTab === 'income' && String(tx.targetWalletId) === String(walletId)) matchesTab = true
          else if (activeTab === 'expense' && String(tx.walletId) === String(walletId)) matchesTab = true
          else matchesTab = false
        } else if (tx.type === 'balance_adjustment') {
          if (activeTab === 'income' && Number(tx.amount || 0) > 0) matchesTab = true
          else if (activeTab === 'expense' && Number(tx.amount || 0) < 0) matchesTab = true
          else matchesTab = false
        } else {
          matchesTab = false
        }
      }

      // Search Filter
      let matchesSearch = true
      if (query) {
        const catLabels = getTransactionCategoryLabels(tx.category, tx.type, locale)
        const catName = (catLabels?.main || tx.category || '').toLowerCase()
        const subName = (catLabels?.sub || '').toLowerCase()
        const rawNote = tx.notes || ''
        const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
        const notes = isFieldEncrypted(plainNote) ? '' : plainNote.toLowerCase()
        const amountStr = String(tx.amount || '')
        matchesSearch = catName.includes(query) || subName.includes(query) || notes.includes(query) || amountStr.includes(query)

        // Split items unpacking invariant
        if (!matchesSearch && tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          matchesSearch = tx.splitItems.some((si) => {
            if (!si) return false
            const siLabels = getTransactionCategoryLabels(si.category, si.type || tx.type, locale)
            const siCat = (siLabels?.main || si.category || '').toLowerCase()
            const siSub = (siLabels?.sub || si.subcategory || '').toLowerCase()
            const rawSi = si.notes || ''
            const plainSi = isFieldEncrypted(rawSi) ? getDecryptedNoteSync(rawSi) : rawSi
            const siNotes = isFieldEncrypted(plainSi) ? '' : plainSi.toLowerCase()
            return siCat.includes(query) || siSub.includes(query) || siNotes.includes(query) || String(si.amount || '').includes(query)
          })
        }
      }

      return matchesTab && matchesSearch
    })
  }, [activeTransactions, activeTab, searchQuery, walletId, locale, decryptedTick])

  // Grouped transactions calculation
  const groupedTransactions = useMemo(() => {
    if (!filteredTransactions.length) return []
    const groups = {}
    filteredTransactions.forEach((tx) => {
      const dateKey = tx.date
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(tx)
    })

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => {
        let dateLabel = dateKey === todayStr ? t('common.today', 'Hari Ini') : dateKey === yesterdayStr ? t('common.yesterday', 'Kemarin') : null
        if (!dateLabel) {
          try {
            const rawDate = typeof dateKey === 'string' && dateKey.length === 10 ? `${dateKey}T12:00:00` : dateKey
            dateLabel = format(new Date(rawDate), 'dd MMMM yyyy')
          } catch (err) {
            console.error('[WalletTransactionsList:formatDate]', err)
            dateLabel = dateKey
          }
        }

        const items = groups[dateKey]
        let net = 0
        const walletCurrency = wallet?.currency || defaultCurrency

        items.forEach((tx) => {
          if (tx.isPendingReview === true || tx.isPendingReview === 1) return
          if (tx.type === 'income') {
            net += convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
          } else if (tx.type === 'expense') {
            net -= convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
          } else if (tx.type === 'transfer') {
            if (String(tx.targetWalletId) === String(walletId)) {
              const sourceWallet = activeWallets.find((w) => String(w.id) === String(tx.walletId))
              const sourceCurrency = tx.currency || sourceWallet?.currency || defaultCurrency
              net += tx.targetAmount != null && Number(tx.targetAmount) > 0 ? Number(tx.targetAmount) : convertCurrency(tx.amount, sourceCurrency, walletCurrency, rates)
            } else if (String(tx.walletId) === String(walletId)) {
              net -= convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
            }
          } else if (tx.type === 'balance_adjustment') {
            net += convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
          }
        })

        const dailySummaryText = net !== 0 ? `${net > 0 ? '+' : ''}${formatCurrency(net, wallet?.currency || defaultCurrency)}` : null
        return { dateKey, dateLabel, items, dailySummaryText, isPositive: net > 0 }
      })
  }, [filteredTransactions, t, defaultCurrency, wallet?.currency, rates, walletId, activeWallets])

  // Pagination / Batching state
  const currentFilterKey = `${activeTab}-${searchQuery}-${walletId}`
  const [extraCount, setExtraCount] = useState(0)
  const [prevFilterKey, setPrevFilterKey] = useState(currentFilterKey)

  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey)
    setExtraCount(0)
  }

  const displayCount = 30 + extraCount
  const visibleGroups = useMemo(() => {
    let count = 0
    const result = []
    for (const group of groupedTransactions) {
      if (count >= displayCount) break
      result.push(group)
      count += group.items.length
    }
    return result
  }, [groupedTransactions, displayCount])

  const totalTxCount = filteredTransactions.length
  const currentRenderedTxCount = useMemo(() => visibleGroups.reduce((acc, g) => acc + g.items.length, 0), [visibleGroups])
  const hasMore = currentRenderedTxCount < totalTxCount

  // Tab counts
  const counts = useMemo(() => {
    if (!activeTransactions) return { all: 0, expense: 0, income: 0 }
    let expense = 0
    let income = 0
    for (const tx of activeTransactions) {
      if (tx.type === 'expense') expense++
      else if (tx.type === 'income') income++
      else if (tx.type === 'transfer') {
        if (String(tx.walletId) === String(walletId)) expense++
        if (String(tx.targetWalletId) === String(walletId)) income++
      }
    }
    return { all: activeTransactions.length, expense, income }
  }, [activeTransactions, walletId])

  const TABS = [
    { id: 'all', label: t('common.all', 'Semua'), count: counts.all },
    { id: 'expense', label: t('common.expense', 'Pengeluaran'), count: counts.expense },
    { id: 'income', label: t('common.income', 'Pemasukan'), count: counts.income },
  ]

  return (
    <>
      <div className="px-4 mt-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 sm:p-4 shadow-sm space-y-3">
          {/* Header & Filter Controls */}
          <div className="space-y-2.5 pb-2.5 border-b border-[var(--border)]/40">
            <div className="flex items-center justify-between px-0.5">
              <h3 className="ft-display text-sm font-black text-[var(--fg)] tracking-tight">
                {t('wallets.txHistory', 'Riwayat Transaksi')}
              </h3>
              <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums text-[var(--muted)]">
                {t('wallets.txCount', '{{count}} transaksi', { count: filteredTransactions?.length || 0 })}
              </span>
            </div>

            {/* Search Input & Tab Buttons */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('tx.search.placeholder', 'Cari kategori, nominal, atau catatan...')}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-1.5 pl-8 pr-7 text-xs text-[var(--fg)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto ft-hide-scrollbar">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                        : 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] font-black opacity-80">({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grouped Transaction Feed */}
          {visibleGroups && visibleGroups.length > 0 ? (
            <>
              {visibleGroups.map((group, idx) => (
                <section key={group.dateKey} className="space-y-1.5 ft-stagger-in" style={{ '--stagger': Math.min(idx, 10) }}>
                  <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-1 py-1.5 bg-[var(--panel-strong)]/95 backdrop-blur-xs rounded-lg">
                    <span className="text-[11px] font-black tracking-wider text-[var(--muted)] uppercase">{group.dateLabel}</span>
                    {group.dailySummaryText ? (
                      <span className={`text-[11px] font-black tabular-nums ${group.isPositive ? 'text-[var(--status-income)]' : 'text-[var(--muted)]'}`}>
                        {group.dailySummaryText}
                      </span>
                    ) : null}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] divide-y divide-[var(--border)]/40 shadow-xs">
                    {group.items.map((tx) => (
                      <TransactionItemCard
                        key={tx.id}
                        transaction={tx}
                        locale={locale}
                        t={t}
                        format={format}
                        defaultCurrency={defaultCurrency}
                        formatCurrency={formatCurrency}
                        getCategoryColorClass={getCategoryColorClass}
                        resolveTransactionIconKey={resolveTransactionIconKey}
                        getTransactionCategoryLabels={getTransactionCategoryLabels}
                        convertCurrency={convertCurrency}
                        rates={rates}
                        openEditTransaction={openEditTransaction}
                        deleteTransaction={deleteTransaction}
                        onDelete={setSingleDeleteTx}
                        onViewDetail={setDetailTransaction}
                        onPreviewReceipt={setReceiptPreviewTx}
                        swipedTransactionId={swipedTransactionId}
                        setSwipedTransactionId={setSwipedTransactionId}
                        isSwipingId={isSwipingId}
                        getSwipeHandlers={getSwipeHandlers}
                        contextWalletId={walletId}
                        wallets={activeWallets}
                        isNew={isTransactionNew(tx, sessionLastSeenTimestamp)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {hasMore && (
                <div className="pt-2 pb-3 text-center">
                  <button
                    type="button"
                    onClick={() => setExtraCount((prev) => prev + 30)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer shadow-2xs active:scale-95"
                  >
                    {t('common.loadMore', 'Muat Lebih Banyak')} ({totalTxCount - currentRenderedTxCount})
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              variant="transactions"
              title={t('wallets.emptyTxTitle', 'Belum Ada Transaksi')}
              description={t('wallets.emptyTxDesc', 'Belum ada catatan transaksi di akun dompet ini.')}
            />
          )}
        </div>
      </div>

      {/* Transaction Interaction Modals */}
      <TransactionDetailSheet
        isOpen={Boolean(detailTransaction)}
        onClose={() => setDetailTransaction(null)}
        transaction={detailTransaction}
        openEditTransaction={(tx) => {
          setDetailTransaction(null)
          openEditTransaction(tx)
        }}
        deleteTransaction={(tx) => {
          const targetTx = tx || detailTransaction
          if (!targetTx?.id) return
          setDetailTransaction(null)
          setSingleDeleteTx(targetTx)
        }}
        wallets={activeWallets}
        defaultCurrency={defaultCurrency}
        rates={rates}
        formatCurrency={formatCurrency}
        convertCurrency={convertCurrency}
        locale={locale}
        t={t}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(singleDeleteTx)}
        onClose={() => setSingleDeleteTx(null)}
        onConfirm={handleConfirmDelete}
        title={t('tx.item.delete') || 'Hapus Transaksi'}
        message={t('tx.item.deleteConfirm') || 'Apakah Anda yakin ingin menghapus transaksi ini?'}
      />

      <ReceiptPreviewModal
        isOpen={Boolean(receiptPreviewTx)}
        onClose={() => setReceiptPreviewTx(null)}
        imageSrc={receiptPreviewTx?.receiptImage || receiptPreviewTx?.receipt || receiptPreviewTx?.receiptUrl || receiptPreviewTx?.image || null}
        amountFormatted={
          receiptPreviewTx
            ? `${receiptPreviewTx.type === 'income' ? '+' : '-'}${formatCurrency(
                Math.abs(Number(receiptPreviewTx.amount || 0)),
                receiptPreviewTx.currency || defaultCurrency
              )}`
            : ''
        }
        date={receiptPreviewTx?.date}
        notes={getDecryptedNoteSync(receiptPreviewTx?.notes)}
        category={receiptPreviewTx ? getTransactionCategoryLabels(receiptPreviewTx.category, receiptPreviewTx.type, locale)?.main : ''}
        zIndex="z-[60]"
      />

      <TransactionEditSheet
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        formData={editFormData}
        setFormData={setEditFormData}
        onSubmit={handleEditSubmit}
        t={t}
        locale={locale}
        wallets={activeWallets}
      />
    </>
  )
})

export default WalletTransactionsList
