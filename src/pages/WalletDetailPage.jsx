import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { ChevronLeft, Edit2, Trash2, Receipt, Search, Archive, ArchiveRestore } from 'lucide-react'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../data/walletInstitutions'
import { TransactionItemCard } from '../components/transactions/TransactionItemCard'
import useTransactionStore from '../store/useTransactionStore'
import useWalletStore from '../store/useWalletStore'
import Modal from '../components/ui/Modal'
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
  const allWallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const allTransactions = useLiveQuery(async () => {
    const txs = await db.transactions
      .where('walletId').equals(walletId)
      .or('targetWalletId').equals(walletId)
      .toArray()
    return txs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [walletId])

  const handleToggleArchive = async () => {
    if (!wallet) return
    const nextArchived = !wallet.isArchived
    await db.wallets.update(walletId, { isArchived: nextArchived })
  }

  const deleteWallet = useWalletStore(state => state.deleteWallet)
  const addTransaction = useTransactionStore(state => state.addTransaction)

  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore(state => state.defaultCurrency)
  
  const [activeTab, setActiveTab] = useState('all') // all, expense, income
  const [searchQuery, setSearchQuery] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [newBalanceRaw, setNewBalanceRaw] = useState('')

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return []
    const query = searchQuery.trim().toLowerCase()

    return allTransactions.filter(tx => {
      // Tab Filter
      let matchesTab = true
      if (activeTab !== 'all') {
        if (tx.type === activeTab) matchesTab = true
        else if (tx.type === 'transfer') {
          if (activeTab === 'income' && tx.targetWalletId === walletId) matchesTab = true
          else if (activeTab === 'expense' && tx.walletId === walletId) matchesTab = true
          else matchesTab = false
        } else {
          matchesTab = false
        }
      }
      if (!matchesTab) return false

      // Search Query Filter
      if (query) {
        const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(query) : false
        const categoryMatch = tx.category ? tx.category.toLowerCase().includes(query) : false
        const amountMatch = String(tx.amount).includes(query)
        return notesMatch || categoryMatch || amountMatch
      }
      return true
    })
  }, [allTransactions, activeTab, searchQuery, walletId])

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
      let dateLabel = ''
      if (group.dateKey === todayStr) {
        dateLabel = 'HARI INI'
      } else if (group.dateKey === yesterdayStr) {
        dateLabel = 'KEMARIN'
      } else if (group.dateKey !== 'Lainnya') {
        try {
          const dateObj = new Date(`${group.dateKey}T12:00:00`)
          dateLabel = format(dateObj, 'EEEE, d MMMM yyyy', {
            locale: locale === 'en' ? enUS : idLocale
          }).toUpperCase()
        } catch {
          dateLabel = group.dateKey
        }
      } else {
        dateLabel = 'LAINNYA'
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
        dateLabel,
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

  // Idea B: Dynamic ambient tint color based on wallet category/type/name
  const heroAmbientStyle = useMemo(() => {
    if (!wallet) return {}
    const wType = String(wallet.type || '').toLowerCase()
    const wName = String(wallet.name || '').toLowerCase()

    let tintRgb = '245, 158, 11' // Amber (Cash / Default)
    if (wType.includes('bank') || wName.includes('bca') || wName.includes('mandiri') || wName.includes('bni') || wName.includes('bri') || wName.includes('jago')) {
      tintRgb = '99, 102, 241' // Indigo Blue (Bank)
    } else if (wType.includes('ewallet') || wType.includes('e-wallet') || wName.includes('dana') || wName.includes('gopay') || wName.includes('ovo') || wName.includes('shopee')) {
      tintRgb = '20, 184, 166' // Emerald/Cyan (E-Wallet)
    }

    return {
      background: `
        radial-gradient(ellipse at 50% 0%, rgba(${tintRgb}, 0.14) 0%, transparent 68%),
        linear-gradient(180deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%)
      `
    }
  }, [wallet])

  if (!wallet) return <div className="min-h-screen bg-[var(--bg)]" />

  const formatAccountType = (type, name) => {
    const rawType = String(type || '').toLowerCase().trim()
    const rawName = String(name || '').toLowerCase().trim()

    if (rawType.includes('ewallet') || rawType.includes('e-wallet') || rawType.includes('e wallet') ||
        rawName.includes('dana') || rawName.includes('gopay') || rawName.includes('ovo') || rawName.includes('shopee')) {
      return 'E-Wallet'
    }
    if (rawType.includes('bank') || rawName.includes('bca') || rawName.includes('mandiri') || rawName.includes('bni') || rawName.includes('bri') || rawName.includes('jago')) {
      return 'Bank'
    }
    if (rawType.includes('cash') || rawType.includes('tunai') || rawName.includes('cash') || rawName.includes('tunai')) {
      return 'Akun Manual'
    }
    if (rawType === 'investasi' || rawType === 'investment') return 'Investasi'
    if (!type || type === 'lainnya') return 'Akun Manual'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const updatedAt = wallet.createdAt ? format(new Date(wallet.createdAt), 'dd MMM yyyy, HH:mm') : 'Baru saja'

  const TABS = [
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'expense', label: 'Pengeluaran', count: counts.expense },
    { id: 'income', label: 'Pemasukan', count: counts.income },
  ]

  return (
    <>
      <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)] pb-32 relative">
        {/* ── 1. Curved Hero Section with Wallet Icon & Accent Glow ────────────── */}
        <div 
          className="ft-wallet-detail-hero -mx-4 -mt-4 pb-9 pt-3 px-4 text-center relative overflow-hidden"
          style={heroAmbientStyle}
        >
          {/* Top Nav Bar */}
          <div className="relative z-10 flex items-center justify-between mb-1 min-h-[36px]">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="relative z-10 flex items-center justify-center w-9 h-9 -ml-1 rounded-full text-[var(--fg)] hover:bg-[var(--fg)]/10 transition active:scale-95"
              aria-label="Kembali"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>

            <h2 className="absolute left-1/2 -translate-x-1/2 max-w-[60%] truncate text-center text-base sm:text-lg font-black tracking-tight text-[var(--fg)] uppercase pointer-events-none">
              {wallet.name}
            </h2>

            <div className="relative z-10 flex items-center gap-1">
              <button 
                onClick={handleToggleArchive} 
                className={`flex items-center justify-center w-8 h-8 rounded-full transition active:scale-95 ${
                  wallet.isArchived
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--fg)]/10'
                }`}
                title={wallet.isArchived ? 'Buka Arsip Akun' : 'Arsipkan Akun'}
                aria-label={wallet.isArchived ? 'Buka Arsip Akun' : 'Arsipkan Akun'}
              >
                {wallet.isArchived ? <ArchiveRestore size={16} strokeWidth={2} /> : <Archive size={16} strokeWidth={2} />}
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)} 
                className="flex items-center justify-center w-8 h-8 rounded-full text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95"
                title="Hapus Akun"
                aria-label="Hapus Akun"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Centered Circular Logo */}
          <div className="relative z-10 w-12 h-12 rounded-full bg-[var(--panel-strong)] flex items-center justify-center overflow-hidden border border-[var(--border)] shadow-md mx-auto mt-2.5 mb-2">
            {wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' ? (
              <div className="w-full h-full flex items-center justify-center text-amber-500">
                <MoneyBagIcon size={24} strokeWidth={2.5} />
              </div>
            ) : getWalletLogoUrl(wallet) ? (
              <img 
                src={getWalletLogoUrl(wallet)} 
                alt={wallet.name} 
                className="w-full h-full object-contain p-[2px] rounded-full"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-full h-full flex items-center justify-center font-black text-sm text-[var(--fg)]"
              style={{ display: wallet.customIcon === 'dollar' || wallet.name?.toLowerCase() === 'cash' || getWalletLogoUrl(wallet) ? 'none' : 'flex' }}
            >
              {getInitials(wallet.name)}
            </div>
          </div>

          {/* Subtitles: Account Type Pill Badge */}
          <div className="relative z-10 flex flex-col items-center mb-1">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 dark:border-[var(--border)] bg-white/80 dark:bg-[var(--panel-strong)]/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--muted)] shadow-xs">
              <span>{formatAccountType(wallet.institutionType, wallet.name)}</span>
            </div>
          </div>
        </div>

        {/* ── 2. Overlapping Balance Card with Pencil Edit Icon (Compact) ─────── */}
        <div className="px-4 -mt-3 relative z-20">
          <div className="-mx-3.5 sm:mx-0 rounded-xl border border-slate-200/90 dark:border-[var(--border)] bg-white dark:bg-[var(--panel-strong)] p-2.5 sm:p-3 shadow-md space-y-1">
            {/* Top Row: Label Caption & Edit Pencil Button */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider text-[var(--muted-2)]">
                Saldo Akun Saat Ini
              </span>

              <button
                type="button"
                onClick={() => {
                  setNewBalanceRaw(currentBalance.toString())
                  setIsEditBalanceModalOpen(true)
                }}
                className="w-6 h-6 rounded-md bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 shrink-0"
                title="Penyesuaian Saldo"
                aria-label="Penyesuaian Saldo"
              >
                <Edit2 size={11} strokeWidth={2} />
              </button>
            </div>

            {/* Middle Row: Crisp Bold Balance Display */}
            <div>
              <p className="ft-display text-lg sm:text-xl font-black text-[var(--fg)] tabular-nums truncate leading-none">
                {formatCurrency(currentBalance, wallet.currency || defaultCurrency)}
              </p>
            </div>

            {/* Bottom Row: Timestamp Sub-info & Currency Badge */}
            <div className="pt-1 border-t border-[var(--border)]/30 flex items-center justify-between text-[9px] text-[var(--muted-2)]">
              <span>Update {updatedAt}</span>
              <span className="font-extrabold text-[var(--muted)] uppercase tracking-wider">
                {wallet.currency || defaultCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. Content Section: Unified Transaction Feed Card ─────── */}
        <div className="px-4 mt-2.5">
          {/* Transactions Feed Card Wrapper with Integrated Controls */}
          <div className="mt-1.5 -mx-3.5 sm:mx-0 rounded-xl border border-slate-200/90 dark:border-[var(--border)] bg-white dark:bg-[var(--panel-strong)] p-2.5 sm:p-3 shadow-sm space-y-2.5">
            {/* Unified Card Header & Control Section */}
            <div className="space-y-2 pb-2 border-b border-[var(--border)]/40">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="ft-display text-xs font-extrabold text-[var(--fg)] tracking-tight">
                  Riwayat Transaksi
                </h3>
                <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[9.5px] font-extrabold tabular-nums text-[var(--muted)]">
                  {filteredTransactions?.length || 0} transaksi
                </span>
              </div>

              {/* Compact Search & Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="relative sm:col-span-6">
                  <Search size={13} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)] pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari transaksi..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-1 pl-7 pr-6 text-[11px] text-[var(--fg)] placeholder-[var(--muted-2)] outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto ft-hide-scrollbar sm:col-span-6">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition flex items-center gap-1 shrink-0 ${
                        activeTab === tab.id
                          ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs'
                          : 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[9px] opacity-75">({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {groupedTransactions && groupedTransactions.length > 0 ? (
              groupedTransactions.map((group) => (
                <div key={group.dateKey} className="space-y-1.5">
                  {/* Timeline Date Header - Rectangular Neutral Box */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--field-bg)]">
                    <span className="text-[10px] font-extrabold tracking-wider text-[var(--fg)] uppercase">
                      {group.dateLabel}
                    </span>
                    {group.dailySummaryText ? (
                      <span className="text-[11px] font-extrabold tabular-nums text-[var(--muted)]">
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
                        wallets={allWallets}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center mx-auto mb-3 text-[var(--muted-2)]">
                  <Receipt size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-bold text-[var(--fg)] mb-1">Belum ada transaksi</h3>
                <p className="text-[11px] text-[var(--muted)] max-w-xs mx-auto">
                  Belum ada catatan transaksi {activeTab !== 'all' ? activeTab : ''} tercatat di akun ini.
                </p>
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
