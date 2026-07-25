import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { ChevronLeft, Edit2, Trash2, Plus, Receipt, SlidersHorizontal, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import { TransactionItemCard } from '../components/transactions/TransactionItemCard'
import useTransactionStore from '../store/useTransactionStore'
import useWalletStore from '../store/useWalletStore'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import QuickAddTransactionModal from '../components/transactions/QuickAddTransactionModal'
import { formatCurrency, FALLBACK_EXCHANGE_RATES } from '../lib/utils'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { getCategoryColorClass, resolveTransactionIconKey, getTransactionCategoryLabels } from '../lib/categoryIcon'

export default function WalletDetailPage() {
  const { id } = useParams()
  const walletId = Number(id)
  const navigate = useNavigate()
  
  const wallet = useLiveQuery(() => db.wallets.get(walletId), [walletId])
  const allTransactions = useLiveQuery(async () => {
    const txs = await db.transactions
      .where('walletId').equals(walletId)
      .or('targetWalletId').equals(walletId)
      .toArray()
    return txs.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [walletId])

  const deleteWallet = useWalletStore(state => state.deleteWallet)
  const addTransaction = useTransactionStore(state => state.addTransaction)

  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore(state => state.defaultCurrency)
  
  const [activeTab, setActiveTab] = useState('all') // all, expense, income
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [newBalanceRaw, setNewBalanceRaw] = useState('')

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return []
    if (activeTab === 'all') return allTransactions
    return allTransactions.filter(tx => {
      if (tx.type === activeTab) return true
      if (tx.type === 'transfer') {
        if (activeTab === 'income' && tx.targetWalletId === walletId) return true
        if (activeTab === 'expense' && tx.walletId === walletId) return true
      }
      return false
    })
  }, [allTransactions, activeTab, walletId])

  const groupedTransactions = useMemo(() => {
    if (!filteredTransactions || filteredTransactions.length === 0) return []
    
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    
    const groupsMap = new Map()

    for (const tx of filteredTransactions) {
      const dateKey = tx.date || 'Lainnya'
      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, {
          dateKey,
          items: [],
          totalExpense: 0,
          totalIncome: 0,
        })
      }
      const group = groupsMap.get(dateKey)
      group.items.push(tx)

      const amount = Number(tx.amount) || 0
      if (tx.type === 'expense') {
        group.totalExpense += amount
      } else if (tx.type === 'income') {
        group.totalIncome += amount
      } else if (tx.type === 'transfer') {
        if (tx.walletId === walletId) group.totalExpense += amount
        if (tx.targetWalletId === walletId) group.totalIncome += amount
      }
    }

    return Array.from(groupsMap.values()).map(group => {
      let label = ''
      if (group.dateKey === todayStr) {
        label = 'HARI INI'
      } else if (group.dateKey === yesterdayStr) {
        label = 'KEMARIN'
      } else if (group.dateKey !== 'Lainnya') {
        try {
          const dateObj = new Date(`${group.dateKey}T12:00:00`)
          label = format(dateObj, 'EEEE, d MMMM yyyy', {
            locale: locale === 'en' ? enUS : idLocale
          }).toUpperCase()
        } catch {
          label = group.dateKey
        }
      } else {
        label = 'LAINNYA'
      }

      const net = group.totalIncome - group.totalExpense
      let dailySummaryText = ''
      if (net > 0) {
        dailySummaryText = `+${formatCurrency(net, wallet?.currency || defaultCurrency)}`
      } else if (net < 0) {
        dailySummaryText = `-${formatCurrency(Math.abs(net), wallet?.currency || defaultCurrency)}`
      } else if (group.totalExpense > 0) {
        dailySummaryText = `-${formatCurrency(group.totalExpense, wallet?.currency || defaultCurrency)}`
      }

      return {
        ...group,
        dateLabel: label,
        dailySummaryText,
        isPositive: net > 0,
      }
    })
  }, [filteredTransactions, locale, walletId, wallet?.currency, defaultCurrency])

  const currentBalance = useMemo(() => {
    if (!wallet) return 0
    let bal = Number(wallet.balance) || 0
    if (!allTransactions) return bal
    for (const tx of allTransactions) {
      const amount = Number(tx.amount) || 0
      if (tx.walletId === walletId) {
        if (tx.type === 'income') bal += amount
        else if (tx.type === 'expense') bal -= amount
        else if (tx.type === 'transfer') bal -= amount
        else if (tx.type === 'balance_adjustment') bal += amount
      }
      if (tx.targetWalletId === walletId) {
        if (tx.type === 'transfer') bal += amount
      }
    }
    return bal
  }, [wallet, allTransactions, walletId])

  // Monthly income/expense for this wallet
  const { monthIncome, monthExpense } = useMemo(() => {
    if (!allTransactions) return { monthIncome: 0, monthExpense: 0 }
    const currentMonth = format(new Date(), 'yyyy-MM')
    let inc = 0, exp = 0
    for (const tx of allTransactions) {
      if (!tx.date?.startsWith(currentMonth)) continue
      const amount = Number(tx.amount) || 0
      if (tx.type === 'income' && tx.walletId === walletId) inc += amount
      else if (tx.type === 'expense' && tx.walletId === walletId) exp += amount
      else if (tx.type === 'transfer') {
        if (tx.walletId === walletId) exp += amount
        if (tx.targetWalletId === walletId) inc += amount
      }
    }
    return { monthIncome: inc, monthExpense: exp }
  }, [allTransactions, walletId])

  const handleDeleteWallet = async () => {
    try {
      const txsToDelete = await db.transactions
        .filter(tx => tx.walletId === walletId || tx.targetWalletId === walletId)
        .primaryKeys()
      
      await db.transactions.bulkDelete(txsToDelete)
      await deleteWallet(walletId)
      
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Failed to delete wallet', err)
      alert('Gagal menghapus wallet')
    }
  }

  const handleEditBalance = async (e) => {
    e.preventDefault()
    const newBal = parseInt(newBalanceRaw.replace(/\D/g, ''), 10)
    if (isNaN(newBal)) return

    const diff = newBal - currentBalance
    if (diff !== 0) {
      await addTransaction({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'balance_adjustment',
        category: 'Lainnya',
        notes: 'Edit Saldo',
        amount: diff,
        currency: wallet.currency,
        walletId: wallet.id,
      })
    }
    
    setIsEditBalanceModalOpen(false)
  }

  const getInitials = (text) => text ? text.substring(0, 2).toUpperCase() : ''

  if (!wallet) return <div className="min-h-screen bg-[var(--bg)]" />

  const updatedAt = wallet.createdAt ? format(new Date(wallet.createdAt), 'dd MMM yyyy, HH:mm') : 'Baru saja'

  const TABS = [
    { id: 'all', label: 'Semua' },
    { id: 'expense', label: 'Pengeluaran' },
    { id: 'income', label: 'Pemasukan' },
  ]

  return (
    <>
      <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)] pb-20">
        {/* ── Hero Digital Wallet Banner ─────────────────────────────── */}
        <div className="ft-wallet-detail-hero">
          {/* Top Nav Bar */}
          <div className="relative z-10 flex items-center justify-between mb-5">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-[var(--fg)] hover:bg-[var(--fg)]/10 transition active:scale-95"
              aria-label="Kembali"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => {
                  setNewBalanceRaw(currentBalance.toString())
                  setIsEditBalanceModalOpen(true)
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--fg)]/10 transition active:scale-95 border border-[var(--border)]"
                title="Penyesuaian Saldo"
              >
                <Edit2 size={13} strokeWidth={2} />
                <span>Edit Saldo</span>
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)} 
                className="flex items-center justify-center w-9 h-9 rounded-full text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95"
                title="Hapus Akun"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Wallet Identity Row */}
          <div className="relative z-10 flex items-center gap-3.5">
            {/* Logo */}
            <div className="w-12 h-12 rounded-full bg-[var(--field-bg)] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)] shadow-md">
              {wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' ? (
                <div className="w-full h-full flex items-center justify-center text-amber-500">
                  <MoneyBagIcon size={24} strokeWidth={2.5} />
                </div>
              ) : wallet.logoUrl ? (
                <img 
                  src={wallet.logoUrl} 
                  alt={wallet.name} 
                  className="w-full h-full object-contain p-1.5"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="w-full h-full flex items-center justify-center font-extrabold text-[15px] text-[var(--fg)]"
                style={{ display: wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' || wallet.logoUrl ? 'none' : 'flex' }}
              >
                {getInitials(wallet.name)}
              </div>
            </div>

            {/* Title & Metadata Badges */}
            <div className="flex-1 min-w-0">
              <h1 className="ft-display text-xl font-extrabold text-[var(--fg)] tracking-tight truncate leading-snug">
                {wallet.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {wallet.institutionType !== 'lainnya' ? wallet.institutionType : 'Akun Manual'}
                </span>
                <span className="text-[10px] font-semibold text-[var(--muted-2)]">•</span>
                <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">
                  {wallet.currency || defaultCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Integrated Balance Section */}
          <div className="relative z-10 mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
              Saldo Saat Ini
            </p>
            <p className="ft-display mt-1 text-[2.25rem] leading-[1.05] font-black tracking-tight tabular-nums text-[var(--fg)] break-all">
              {formatCurrency(currentBalance, wallet.currency || defaultCurrency)}
            </p>
            <p className="text-[10px] font-medium text-[var(--muted-2)] mt-1.5">
              Diperbarui {updatedAt}
            </p>
          </div>

          {/* Hero Quick Action Buttons */}
          <div className="relative z-10 mt-5 flex gap-2.5">
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="ft-wallet-action-btn ft-wallet-action-primary flex-1"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>+ Transaksi</span>
            </button>
            
            <button
              onClick={() => {
                setNewBalanceRaw(currentBalance.toString())
                setIsEditBalanceModalOpen(true)
              }}
              className="ft-wallet-action-btn ft-wallet-action-secondary"
            >
              <SlidersHorizontal size={16} strokeWidth={2} />
              <span>Penyesuaian</span>
            </button>
          </div>

          {/* Monthly Stats Summary */}
          <div className="relative z-10 mt-4 flex gap-2">
            <div className="ft-stat-pill ft-stat-pill--income">
              <div className="ft-stat-pill-icon">
                <ArrowDownLeft size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--status-income)' }}>
                  Pemasukan
                </p>
                <p className="text-[11px] font-black tabular-nums truncate" style={{ color: 'var(--status-income)' }}>
                  {formatCurrency(monthIncome, wallet.currency || defaultCurrency)}
                </p>
              </div>
            </div>

            <div className="ft-stat-pill ft-stat-pill--expense">
              <div className="ft-stat-pill-icon">
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--status-expense)' }}>
                  Pengeluaran
                </p>
                <p className="text-[11px] font-black tabular-nums truncate" style={{ color: 'var(--status-expense)' }}>
                  {formatCurrency(monthExpense, wallet.currency || defaultCurrency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content Section: Filters & Transactions Feed ─────────── */}
        <div className="px-4 mt-5">
          {/* Tab Filters */}
          <div className="flex gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-lg py-2 px-2 text-[12px] font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-[var(--fg)] text-[var(--bg)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Header Row: Transaction Count */}
          <div className="mt-4 flex items-center justify-between px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted-2)]">
              Riwayat Transaksi
            </h3>
            <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
              {filteredTransactions?.length || 0} transaksi
            </span>
          </div>

          {/* Transactions Feed List (Grouped Timeline) */}
          <div className="mt-4 space-y-4 pb-4">
            {groupedTransactions && groupedTransactions.length > 0 ? (
              groupedTransactions.map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  {/* Timeline Date Header */}
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-[var(--border)]/40">
                    <span className="text-[10px] font-bold tracking-wider text-[var(--muted-2)] uppercase">
                      {group.dateLabel}
                    </span>
                    {group.dailySummaryText ? (
                      <span className={`text-[11px] font-extrabold tabular-nums ${group.isPositive ? 'text-green-600 dark:text-green-400' : 'text-[var(--muted)]'}`}>
                        {group.dailySummaryText}
                      </span>
                    ) : null}
                  </div>

                  {/* Transaction Cards in this Date Group */}
                  <div className="space-y-2">
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
                        convertCurrency={() => 0}
                        rates={FALLBACK_EXCHANGE_RATES}
                        openEditTransaction={() => {}}
                        deleteTransaction={() => {}}
                        contextWalletId={walletId}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10">
                <EmptyState
                  icon={<Receipt className="text-[var(--muted-2)] mx-auto mb-3" size={44} strokeWidth={1.2} />}
                  title="Belum ada transaksi"
                  description={`Belum ada transaksi ${activeTab !== 'all' ? activeTab : ''} tercatat di akun ini.`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <QuickAddTransactionModal 
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialWalletId={walletId}
      />

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Hapus Dompet">
        <div className="pt-1">
          <p className="text-[13px] leading-relaxed text-[var(--muted)] mb-5">
            Apakah Anda yakin ingin menghapus dompet <strong className="text-[var(--fg)]">{wallet.name}</strong>? Semua transaksi yang terkait dengan dompet ini juga akan dihapus secara permanen.
          </p>
          <div className="flex gap-2.5">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98]"
            >
              Batal
            </button>
            <button 
              onClick={handleDeleteWallet}
              className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-bold text-[13px] shadow-sm transition hover:bg-rose-600 active:scale-[0.98]"
            >
              Hapus
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEditBalanceModalOpen} onClose={() => setIsEditBalanceModalOpen(false)} title="Penyesuaian Saldo">
        <form onSubmit={handleEditBalance} className="pt-1">
          <p className="text-[13px] leading-relaxed text-[var(--muted)] mb-4">
            Masukkan nominal saldo riil Anda. Sistem otomatis membuat transaksi penyesuaian untuk selisihnya.
          </p>
          <div className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] focus-within:border-[var(--accent)] transition-colors mb-5">
            <span className="pl-4 text-[var(--muted)] font-bold text-sm">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={newBalanceRaw ? Number(newBalanceRaw.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
              onChange={(e) => setNewBalanceRaw(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-transparent py-3.5 pl-3 pr-4 font-black text-xl text-[var(--fg)] outline-none"
              autoFocus
            />
          </div>
          <div className="flex gap-2.5">
            <button 
              type="button"
              onClick={() => setIsEditBalanceModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98]"
            >
              Batal
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98]"
            >
              Simpan Saldo
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
