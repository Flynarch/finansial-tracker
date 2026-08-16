import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeWalletBalance } from '../lib/db'
import { format, subDays } from 'date-fns'
import { enUS, id as idLocale } from 'date-fns/locale'
import { Edit2, Trash2, Receipt, Search, Archive, ArchiveRestore } from 'lucide-react'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../data/walletInstitutions'
import { TransactionItemCard } from '../components/transactions/TransactionItemCard'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import useTransactionStore from '../store/useTransactionStore'
import useWalletStore from '../store/useWalletStore'
import useSwipeAction from '../hooks/useSwipeAction'
import Modal from '../components/ui/Modal'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import QuickAddTransactionModal from '../components/transactions/QuickAddTransactionModal'
import ToastBanner from '../components/ui/ToastBanner'
import PageHeader from '../components/ui/PageHeader'
import { formatCurrency, formatMoneyInput, formatMoneyValueForInput, parseMoneyInput, convertCurrency, FALLBACK_EXCHANGE_RATES } from '../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { getCategoryColorClass, resolveTransactionIconKey, getTransactionCategoryLabels } from '../lib/categoryIcon'

export default function WalletDetailPage() {
  const { id } = useParams()
  const walletId = Number(id)
  const navigate = useNavigate()
  const [pageError, setPageError] = useState('')
  
  const wallet = useLiveQuery(() => (walletId && !isNaN(walletId) ? db.wallets.get(walletId) : null), [walletId])
  const cachedWallets = useWalletStore((state) => state.wallets)
  const setStoreWallets = useWalletStore((state) => state.setWallets)
  const dbWallets = useLiveQuery(() => db.wallets.toArray(), [])

  useEffect(() => {
    if (dbWallets && dbWallets.length > 0 && setStoreWallets) {
      setStoreWallets(dbWallets)
    }
  }, [dbWallets, setStoreWallets])

  const allWallets = useMemo(() => {
    if (dbWallets !== undefined && dbWallets.length > 0) return dbWallets
    if (cachedWallets && cachedWallets.length > 0) return cachedWallets
    return dbWallets || []
  }, [dbWallets, cachedWallets])

  const allTransactions = useLiveQuery(async () => {
    if (!walletId || isNaN(walletId)) return []
    const txs = await db.transactions
      .filter((tx) => tx.walletId === walletId || tx.targetWalletId === walletId)
      .toArray()
    return txs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [walletId])

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })

  useEffect(() => {
    const loadRates = async () => {
      try {
        const fetched = await fetchCurrencyRates('USD')
        setRates(fetched)
      } catch {
        setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
  }, [])

  const handleToggleArchive = async () => {
    if (!wallet) return
    const nextArchived = !wallet.isArchived
    await db.wallets.update(walletId, { isArchived: nextArchived })
  }

  const deleteWallet = useWalletStore(state => state.deleteWallet)
  const addTransaction = useTransactionStore(state => state.addTransaction)
  const updateTransaction = useTransactionStore(state => state.updateTransaction)
  const deleteTransaction = useTransactionStore(state => state.deleteTransaction)

  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore(state => state.defaultCurrency)
  
  const [activeTab, setActiveTab] = useState('all') // all, expense, income
  const [searchQuery, setSearchQuery] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [newBalanceRaw, setNewBalanceRaw] = useState('')

  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editFormData, setEditFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    type: 'expense',
    category: '',
    notes: '',
    currency: 'IDR',
  })

  const {
    swipedId: swipedTransactionId,
    setSwipedId: setSwipedTransactionId,
    isSwipingId,
    getSwipeHandlers,
  } = useSwipeAction()

  const openEditTransaction = useCallback((transaction) => {
    setEditingTransaction(transaction)
    const targetCurrency = transaction.currency || wallet?.currency || defaultCurrency
    setEditFormData({
      date: transaction.date,
      amount: formatMoneyValueForInput(transaction.amount, targetCurrency),
      type: transaction.type,
      category: transaction.category,
      notes: transaction.notes || '',
      currency: targetCurrency,
    })
  }, [wallet?.currency, defaultCurrency])

  const handleEditSubmit = async () => {
    if (!editingTransaction?.id) return
    try {
      setPageError('')
      await updateTransaction(editingTransaction.id, {
        ...editFormData,
        amount: parseMoneyInput(editFormData.amount, editFormData.currency),
      })
      setEditingTransaction(null)
    } catch (err) {
      setPageError(err.message || 'Gagal mengubah transaksi.')
    }
  }

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
      const txCurr = tx.currency || defaultCurrency
      const walletCurr = wallet?.currency || defaultCurrency
      const convertedAmt =
        txCurr === walletCurr
          ? amount
          : convertCurrency(amount, txCurr, walletCurr, rates || {})

      if (tx.type === 'expense') {
        group.totalExpense += convertedAmt
      } else if (tx.type === 'income') {
        group.totalIncome += convertedAmt
      } else if (tx.type === 'transfer') {
        if (String(tx.walletId) === String(walletId)) group.totalExpense += convertedAmt
        if (String(tx.targetWalletId) === String(walletId)) group.totalIncome += convertedAmt
      } else if (tx.type === 'balance_adjustment') {
        if (amount >= 0) {
          group.totalIncome += convertedAmt
        } else {
          group.totalExpense += Math.abs(convertedAmt)
        }
      }
    }

    return Array.from(groupsMap.values()).map(group => {
      let dateLabel
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
  }, [filteredTransactions, locale, walletId, wallet?.currency, defaultCurrency, rates])

  const currentBalance = useMemo(() => {
    if (!wallet) return 0
    return computeWalletBalance(wallet, allTransactions || [], rates)
  }, [wallet, allTransactions, rates])

  const handleDeleteWallet = async () => {
    try {
      const activeLoans = await db.loans
        .where('walletId')
        .equals(Number(walletId))
        .filter((l) => l.status !== 'paid')
        .toArray()

      if (activeLoans && activeLoans.length > 0) {
        setIsDeleteModalOpen(false)
        setPageError('Tidak bisa menghapus wallet ini karena masih terdapat catatan utang/piutang aktif yang terhubung. Selesaikan atau hapus catatan utang/piutang terlebih dahulu.')
        return
      }

      await deleteWallet(walletId)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Failed to delete wallet', err)
      setPageError('Gagal menghapus wallet')
    }
  }

  const handleEditBalance = async (e) => {
    e.preventDefault()
    const targetCurrency = wallet?.currency || defaultCurrency
    const newBal = parseMoneyInput(newBalanceRaw, targetCurrency)
    if (isNaN(newBal)) return

    const diff = newBal - currentBalance
    if (diff !== 0) {
      await addTransaction({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'balance_adjustment',
        category: 'Penyesuaian Saldo',
        notes: 'Edit Saldo',
        amount: diff,
        currency: targetCurrency,
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
        radial-gradient(ellipse at 50% 0%, rgba(${tintRgb}, 0.15) 0%, transparent 70%),
        linear-gradient(180deg, var(--panel-strong) 0%, var(--bg) 100%)
      `,
      borderBottom: '1px solid var(--border)',
    }
  }, [wallet])

  if (wallet === null || (dbWallets !== undefined && !wallet)) {
    return (
      <div className="min-h-screen bg-[var(--bg)] p-4 max-w-2xl mx-auto flex flex-col">
        <PageHeader title={t('wallets.notFound', 'Akun Tidak Ditemukan')} onBack={() => navigate('/dashboard')} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-12 rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] flex items-center justify-center mb-4">
            <Archive className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-black text-[var(--fg)]">{t('wallets.notFoundTitle', 'Akun Tidak Ditemukan')}</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5 max-w-xs">{t('wallets.notFoundDesc', 'Akun atau dompet yang Anda cari tidak tersedia atau mungkin telah dihapus.')}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs font-black shadow-xs hover:opacity-90 active:scale-95 transition cursor-pointer"
          >
            {t('common.backToDashboard', 'Kembali ke Dashboard')}
          </button>
        </div>
      </div>
    )
  }

  if (wallet === undefined) return <div className="min-h-screen bg-[var(--bg)]" />

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
      <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)] pb-28 relative">
        {pageError ? <ToastBanner message={pageError} type="error" onDismiss={() => setPageError('')} /> : null}
        {/* ── 1. Curved Hero Section with Wallet Icon & Accent Glow ────────────── */}
        <div 
          className="ft-wallet-detail-hero -mx-4 -mt-4 pb-9 pt-3 px-4 text-center relative overflow-hidden"
          style={heroAmbientStyle}
        >
          {/* Top Nav Bar */}
          <PageHeader
            title={wallet.name}
            titleUppercase={true}
            onBack={() => navigate('/dashboard')}
            rightAction={
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleToggleArchive} 
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition active:scale-95 ${
                    wallet.isArchived
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--fg)]/10'
                  }`}
                  title={wallet.isArchived ? t('wallets.unarchive', 'Buka Arsip Akun') : t('wallets.archive', 'Arsipkan Akun')}
                  aria-label={wallet.isArchived ? t('wallets.unarchive', 'Buka Arsip Akun') : t('wallets.archive', 'Arsipkan Akun')}
                >
                  {wallet.isArchived ? <ArchiveRestore size={16} strokeWidth={2} /> : <Archive size={16} strokeWidth={2} />}
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(true)} 
                  className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--earthy-terra)]/80 hover:text-[var(--earthy-terra)] hover:bg-[var(--earthy-terra-soft)] transition active:scale-95"
                  title={t('common.delete', 'Hapus Akun')}
                  aria-label={t('common.delete', 'Hapus Akun')}
                >
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </div>
            }
          />

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
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-strong)]/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--muted)] shadow-xs">
              <span>{formatAccountType(wallet.institutionType, wallet.name)}</span>
            </div>
          </div>
        </div>

        {/* ── 2. Overlapping Balance Card with Pencil Edit Icon (Compact) ─────── */}
        <div className="px-4 -mt-3 relative z-20">
          <div className="-mx-3.5 sm:mx-0 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2.5 sm:p-3 shadow-md space-y-1">
            {/* Top Row: Label Caption & Edit Pencil Button */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider text-[var(--muted-2)]">
                Saldo Akun Saat Ini
              </span>

              <button
                type="button"
                onClick={() => {
                  setNewBalanceRaw(formatMoneyValueForInput(currentBalance, wallet.currency || defaultCurrency))
                  setIsEditBalanceModalOpen(true)
                }}
                className="w-6 h-6 rounded-md bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 shrink-0"
                title={t('wallets.adjustBalance', 'Penyesuaian Saldo')}
                aria-label={t('wallets.adjustBalance', 'Penyesuaian Saldo')}
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
          <div className="mt-1.5 -mx-3.5 sm:mx-0 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2.5 sm:p-3 shadow-sm space-y-2.5">
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
                    placeholder={t('tx.search.placeholder', 'Cari transaksi...')}
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
              groupedTransactions.map((group, idx) => (
                <section key={group.dateKey} className="space-y-1.5 ft-stagger-in" style={{ '--stagger': Math.min(idx, 10) }}>
                  {/* Sticky Date Header Strip */}
                  <div className="sticky top-0 z-20 flex items-center gap-2.5 px-1 py-1.5 bg-[var(--bg)]/95 backdrop-blur-xs">
                    <span className="text-[11px] font-black tracking-wider text-[var(--muted)] uppercase shrink-0">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]/50" />
                    {group.dailySummaryText ? (
                      <span className={`text-[11px] font-black tabular-nums shrink-0 ${
                        group.isPositive ? 'text-[var(--status-income)]' : 'text-[var(--muted)]'
                      }`}>
                        {group.dailySummaryText}
                      </span>
                    ) : null}
                  </div>

                  {/* Feed Group Card */}
                  <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
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
                        swipedTransactionId={swipedTransactionId}
                        setSwipedTransactionId={setSwipedTransactionId}
                        isSwipingId={isSwipingId}
                        getSwipeHandlers={getSwipeHandlers}
                        contextWalletId={walletId}
                        wallets={allWallets}
                      />
                    ))}
                  </div>
                </section>
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
      <TransactionEditSheet
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        formData={editFormData}
        setFormData={setEditFormData}
        onSubmit={handleEditSubmit}
        t={t}
        locale={locale}
        wallets={allWallets}
      />

      <QuickAddTransactionModal 
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialWalletId={walletId}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteWallet}
        title={t('wallets.deleteTitle', 'Hapus Dompet')}
        message={
          <>
            Apakah Anda yakin ingin menghapus dompet <strong className="text-[var(--fg)]">{wallet?.name}</strong>? Semua transaksi yang terkait dengan dompet ini juga akan dihapus secara permanen.
          </>
        }
      />

      <Modal isOpen={isEditBalanceModalOpen} onClose={() => setIsEditBalanceModalOpen(false)} title={t('wallets.adjustBalance', 'Penyesuaian Saldo')}>
        <form onSubmit={handleEditBalance} className="pt-1">
          <p className="text-[13px] leading-relaxed text-[var(--muted)] mb-4">
            Masukkan nominal saldo riil Anda. Sistem otomatis membuat transaksi penyesuaian untuk selisihnya.
          </p>
          <div className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] focus-within:border-[var(--accent)] transition-colors mb-5">
            <span className="pl-4 text-[var(--muted)] font-bold text-sm select-none">
              {(wallet?.currency || defaultCurrency) === 'IDR' ? 'Rp' : (wallet?.currency || defaultCurrency) === 'USD' ? '$' : wallet?.currency || defaultCurrency}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={newBalanceRaw}
              onChange={(e) => setNewBalanceRaw(formatMoneyInput(e.target.value, wallet?.currency || defaultCurrency))}
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
