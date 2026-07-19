import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { format } from 'date-fns'
import { ChevronLeft, Edit2, Trash2, Plus, Receipt, DollarSign } from 'lucide-react'
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

  const handleDeleteWallet = async () => {
    try {
      // Cascade delete
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
      // Create adjustment transaction
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

  if (!wallet) return <div className="min-h-screen bg-white" />

  const updatedAt = wallet.createdAt ? format(new Date(wallet.createdAt), 'dd MMM yyyy, HH:mm') : 'Baru saja'

  return (
    <>
      <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)] pb-24">
        {/* ── Top Header Section ─────────────────────────── */}
        <div className="relative bg-[var(--panel-strong)] border-b border-[var(--border)] text-[var(--fg)] px-4 pt-5 pb-8 shrink-0 shadow-sm rounded-b-[2rem]">
          {/* Header Nav */}
          <div className="relative z-10 flex items-center justify-between mb-6">
            <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[var(--fg)] hover:bg-[var(--fg)]/10 rounded-full transition">
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>
            
            <div className="bg-[var(--fg)]/5 backdrop-blur-md border border-[var(--border)] text-[var(--fg)] px-5 py-1.5 rounded-full text-[13px] font-bold shadow-sm">
              {wallet.institutionType !== 'lainnya' ? 'Akun Institusi' : 'Akun Manual'}
            </div>

            <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 -mr-2 text-rose-500 hover:text-white hover:bg-rose-500 rounded-full transition">
              <Trash2 size={22} strokeWidth={2.5} />
            </button>
          </div>

          {/* Logo and Name Horizontal Layout */}
          <div className="relative z-10 flex items-center gap-4 px-2">
            {/* Logo Circle */}
            <div className="w-[52px] h-[52px] rounded-full bg-[var(--field-bg)] flex items-center justify-center overflow-hidden shrink-0 shadow-md ring-4 ring-[var(--panel)]">
              {wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' ? (
                <div className="w-full h-full flex items-center justify-center text-amber-500 drop-shadow-sm">
                  <MoneyBagIcon size={28} strokeWidth={2.5} />
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
                className="w-full h-full flex items-center justify-center font-extrabold text-[17px] text-[var(--fg)]"
                style={{ display: wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' || wallet.logoUrl ? 'none' : 'flex' }}
              >
                {getInitials(wallet.name)}
              </div>
            </div>

            {/* Name & Balance Preview */}
            <div className="flex-1">
              <h2 className="text-[22px] font-extrabold text-[var(--fg)] tracking-tight line-clamp-1">{wallet.name}</h2>
              <p className="text-[var(--muted)] text-sm font-medium mt-0.5">{wallet.currency} Account</p>
            </div>
          </div>
        </div>

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <div className="px-5 -mt-4 relative z-20">
          
          {/* Balance Card */}
          <div className="bg-[var(--field-bg)] rounded-3xl p-6 shadow-lg shadow-black/5 border border-[var(--border)]">
            <p className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Saldo saat ini</p>
            <div className="flex items-center gap-3">
              <h3 className="text-3xl font-black text-[var(--fg)] tracking-tight break-all">
                {formatCurrency(currentBalance, wallet.currency)}
              </h3>
              <button 
                onClick={() => {
                  setNewBalanceRaw(currentBalance.toString())
                  setIsEditBalanceModalOpen(true)
                }}
                className="p-2 bg-[var(--fg)]/10 text-[var(--fg)] rounded-full hover:bg-[var(--fg)]/20 transition shrink-0"
              >
                <Edit2 size={16} strokeWidth={2.5} />
              </button>
            </div>
            <p className="text-[12px] text-[var(--muted-2)] font-medium mt-3">
              Terakhir update {updatedAt}
            </p>
          </div>

          {/* Filters */}
          <div className="mt-8 flex gap-2 overflow-x-auto ft-no-scrollbar pb-2">
            {['all', 'expense', 'income'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-[13px] font-bold transition-all border-[1.5px] ${
                  activeTab === tab
                    ? 'bg-[var(--fg)] border-[var(--fg)] text-[var(--bg)] shadow-md'
                    : 'bg-[var(--field-bg)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {tab === 'all' ? 'Semua' : tab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="mt-6 space-y-3">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
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
                  convertCurrency={() => 0} // Dummy for now
                  rates={FALLBACK_EXCHANGE_RATES}
                  // Mock handlers since we don't have full editing in detail page yet
                  openEditTransaction={() => {}}
                  deleteTransaction={() => {}}
                  contextWalletId={walletId}
                />
              ))
            ) : (
              <div className="py-10">
                <EmptyState
                  icon={<Receipt className="text-[var(--muted-2)] mx-auto mb-3" size={48} strokeWidth={1} />}
                  title="Belum ada transaksi"
                  description={`Belum ada transaksi ${activeTab !== 'all' ? 'ini' : ''} di dompet ini.`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB - Moved outside the ft-page-enter container to avoid transform stack issues */}
      <div className="fixed bottom-24 right-6 z-40 ft-page-enter">
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="w-14 h-14 bg-[var(--accent)] text-[var(--bg)] rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      </div>

      {/* Modals */}
      <QuickAddTransactionModal 
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialWalletId={walletId}
      />

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Hapus Dompet">
        <div className="p-4">
          <p className="text-gray-600 mb-6">
            Apakah Anda yakin ingin menghapus dompet <strong>{wallet.name}</strong>? Semua transaksi yang terkait dengan dompet ini juga akan dihapus secara permanen.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl"
            >
              Batal
            </button>
            <button 
              onClick={handleDeleteWallet}
              className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl shadow-md shadow-rose-500/20"
            >
              Hapus
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEditBalanceModalOpen} onClose={() => setIsEditBalanceModalOpen(false)} title="Penyesuaian Saldo">
        <form onSubmit={handleEditBalance} className="p-4">
          <p className="text-sm text-gray-500 mb-4">
            Masukkan nominal saldo riil Anda. Sistem otomatis membuat transaksi penyesuaian untuk selisihnya.
          </p>
          <div className="relative flex items-center bg-gray-50 border-2 border-gray-200 rounded-2xl focus-within:border-blue-500 mb-6">
            <span className="pl-4 text-gray-500 font-bold">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={newBalanceRaw ? Number(newBalanceRaw.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
              onChange={(e) => setNewBalanceRaw(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-transparent py-4 pl-3 pr-4 font-black text-2xl text-gray-900 outline-none"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => setIsEditBalanceModalOpen(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl"
            >
              Batal
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md shadow-blue-600/20"
            >
              Simpan Saldo
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
