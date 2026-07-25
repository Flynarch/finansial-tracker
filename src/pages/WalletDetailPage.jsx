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

  const counts = useMemo(() => {
    if (!allTransactions) return { all: 0, expense: 0, income: 0 }
    let expense = 0, income = 0
    for (const tx of allTransactions) {
      if (tx.type === 'expense') expense++
      else if (tx.type === 'income') income++
      else if (tx.type === 'transfer') {
        if (tx.walletId === walletId) expense++
        if (tx.targetWalletId === walletId) income++
      }
    }
    return { all: allTransactions.length, expense, income }
  }, [allTransactions, walletId])

  if (!wallet) return <div className="min-h-screen bg-[var(--bg)]" />

  const updatedAt = wallet.createdAt ? format(new Date(wallet.createdAt), 'dd MMM yyyy, HH:mm') : 'Baru saja'

  const TABS = [
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'expense', label: 'Pengeluaran', count: counts.expense },
    { id: 'income', label: 'Pemasukan', count: counts.income },
  ]

  return (
    <>
      <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)] pb-24 relative">
        {/* ── 1. Hero Header Banner (Centered Identity Stack) ───────── */}
        <div className="ft-wallet-detail-hero pb-12 pt-4 px-4 text-center relative overflow-hidden">
          {/* Top Nav Bar */}
          <div className="relative z-10 flex items-center justify-between mb-2">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-[var(--fg)] hover:bg-[var(--fg)]/10 transition active:scale-95"
              aria-label="Kembali"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>

            <h2 className="ft-display text-lg font-black tracking-tight text-[var(--fg)] uppercase">
              {wallet.name}
            </h2>

            <button 
              onClick={() => setIsDeleteModalOpen(true)} 
              className="flex items-center justify-center w-9 h-9 rounded-full text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95"
              title="Hapus Akun"
              aria-label="Hapus Akun"
            >
              <Trash2 size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Centered Circular Logo */}
          <div className="relative z-10 w-16 h-16 rounded-full bg-[var(--panel-strong)] flex items-center justify-center overflow-hidden border border-[var(--border)] shadow-md mx-auto my-3">
            {wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' ? (
              <div className="w-full h-full flex items-center justify-center text-amber-500">
                <MoneyBagIcon size={30} strokeWidth={2.5} />
              </div>
            ) : wallet.logoUrl ? (
              <img 
                src={wallet.logoUrl} 
                alt={wallet.name} 
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-full h-full flex items-center justify-center font-black text-xl text-[var(--fg)]"
              style={{ display: wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' || wallet.logoUrl ? 'none' : 'flex' }}
            >
              {getInitials(wallet.name)}
            </div>
          </div>

          {/* Subtitles: Institution & Account Type */}
          <div className="relative z-10 space-y-1">
            <p className="text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase">
              {wallet.name}
            </p>
            <p className="text-sm font-extrabold text-[var(--fg)] tracking-tight">
              {wallet.institutionType && wallet.institutionType !== 'lainnya' ? wallet.institutionType : 'Akun Manual'}
            </p>
          </div>
        </div>

        {/* ── 2. Overlapping Balance Card with Pencil Edit Icon ─────── */}
        <div className="px-4 -mt-7 relative z-20">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-lg flex items-center justify-between gap-3">
            {/* Left Money Icon */}
            <div className="w-10 h-10 rounded-xl bg-[var(--field-bg)] flex items-center justify-center text-amber-500 shrink-0 border border-[var(--border)] shadow-sm">
              <MoneyBagIcon size={20} strokeWidth={2.5} />
            </div>

            {/* Middle Amount & Timestamp */}
            <div className="flex-1 min-w-0">
              <p className="ft-display text-xl font-black text-[var(--fg)] tabular-nums truncate leading-tight">
                {formatCurrency(currentBalance, wallet.currency || defaultCurrency)}
              </p>
              <p className="text-[10px] font-medium text-[var(--muted-2)] mt-0.5 truncate">
                Terakhir update {updatedAt}
              </p>
            </div>

            {/* Right Edit Pencil Button */}
            <button
              onClick={() => {
                setNewBalanceRaw(currentBalance.toString())
                setIsEditBalanceModalOpen(true)
              }}
              className="w-9 h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 shrink-0"
              title="Penyesuaian Saldo"
              aria-label="Penyesuaian Saldo"
            >
              <Edit2 size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── 3. Content Section: Pill Filter Tabs & Feed ───────────── */}
        <div className="px-4 mt-6">
          {/* Rounded Pill Tabs */}
          <div className="flex items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-extrabold transition ${
                  activeTab === tab.id
                    ? 'bg-[var(--fg)] text-[var(--bg)] shadow-sm'
                    : 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Transactions Feed List / Empty State */}
          <div className="mt-5 space-y-4 pb-4">
            {groupedTransactions && groupedTransactions.length > 0 ? (
              groupedTransactions.map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  {/* Timeline Date Header */}
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-[var(--border)]/40">
                    <span className="text-[11px] font-extrabold tracking-wider text-[var(--muted)] uppercase">
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
              <div className="py-14 text-center">
                <div className="w-16 h-16 rounded-3xl bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4 text-[var(--muted-2)]">
                  <Receipt size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-[var(--fg)] mb-1">Kamu belum punya transaksi</h3>
                <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
                  Belum ada catatan transaksi {activeTab !== 'all' ? activeTab : ''} pada akun dompet ini.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Floating Action Button (FAB) ───────────────────────── */}
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="fixed bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-[var(--fg)] text-[var(--bg)] shadow-xl flex items-center justify-center transition-transform active:scale-95 focus:outline-none"
          aria-label="Tambah Transaksi"
          title="Tambah Transaksi"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
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
