import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeWalletBalance } from '../lib/db'
import { format } from 'date-fns'
import {
  Trash2,
  Receipt,
  Search,
  MoreVertical,
  Star,
  Sliders,
  Check,
  X,
  Wallet as WalletIcon
} from 'lucide-react'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../data/walletInstitutions'
import { TransactionItemCard } from '../components/transactions/TransactionItemCard'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import useTransactionStore from '../store/useTransactionStore'
import useWalletStore from '../store/useWalletStore'
import useSwipeAction from '../hooks/useSwipeAction'
import Modal from '../components/ui/Modal'
import BottomSheet from '../components/ui/BottomSheet'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
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

  const deleteWallet = useWalletStore((state) => state.deleteWallet)
  const addTransaction = useTransactionStore((state) => state.addTransaction)
  const updateTransaction = useTransactionStore((state) => state.updateTransaction)
  const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)

  const { locale, t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const setDefaultWalletId = useSettingsStore((state) => state.setDefaultWalletId)
  const isDefaultWallet = defaultWalletId === walletId
  
  const [activeTab, setActiveTab] = useState('all') // all, expense, income
  const [searchQuery, setSearchQuery] = useState('')
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false)
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

  const handleSetDefaultWallet = async () => {
    try {
      await setDefaultWalletId(walletId)
      setIsActionMenuOpen(false)
    } catch (err) {
      console.error('Failed to set default wallet', err)
    }
  }

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return []
    const query = searchQuery.trim().toLowerCase()

    return allTransactions.filter((tx) => {
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

      // Search Filter
      let matchesSearch = true
      if (query) {
        const catLabels = getTransactionCategoryLabels(tx.type, tx.category, locale)
        const catName = (catLabels?.categoryName || tx.category || '').toLowerCase()
        const subName = (catLabels?.subcategoryName || '').toLowerCase()
        const notes = (tx.notes || '').toLowerCase()
        const amountStr = String(tx.amount || '')
        matchesSearch = catName.includes(query) || subName.includes(query) || notes.includes(query) || amountStr.includes(query)
      }

      return matchesTab && matchesSearch
    })
  }, [allTransactions, activeTab, searchQuery, walletId, locale])

  const groupedTransactions = useMemo(() => {
    if (!filteredTransactions.length) return []
    const groups = {}
    
    filteredTransactions.forEach((tx) => {
      const dateKey = tx.date
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(tx)
    })

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = format(yesterdayDate, 'yyyy-MM-dd')

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => {
        let dateLabel
        if (dateKey === todayStr) {
          dateLabel = t('common.today', 'Hari Ini')
        } else if (dateKey === yesterdayStr) {
          dateLabel = t('common.yesterday', 'Kemarin')
        } else {
          try {
            dateLabel = format(new Date(dateKey), 'dd MMMM yyyy')
          } catch {
            dateLabel = dateKey
          }
        }

        const items = groups[dateKey]
        let net = 0
        items.forEach((tx) => {
          const amt = convertCurrency(tx.amount, tx.currency || defaultCurrency, wallet?.currency || defaultCurrency, rates)
          if (tx.type === 'income' || (tx.type === 'transfer' && tx.targetWalletId === walletId)) {
            net += amt
          } else if (tx.type === 'expense' || (tx.type === 'transfer' && tx.walletId === walletId)) {
            net -= amt
          }
        })

        const dailySummaryText = net !== 0 ? `${net > 0 ? '+' : ''}${formatCurrency(net, wallet?.currency || defaultCurrency)}` : null

        return {
          dateKey,
          dateLabel,
          items,
          dailySummaryText,
          isPositive: net > 0,
        }
      })
  }, [filteredTransactions, t, defaultCurrency, wallet?.currency, rates, walletId])

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
        setPageError('Tidak bisa menghapus akun ini karena masih terdapat catatan utang/piutang aktif yang terhubung. Selesaikan atau hapus catatan utang/piutang terlebih dahulu.')
        return
      }

      if (isDefaultWallet) {
        const nextWallet = allWallets.find((w) => w.id !== walletId)
        await setDefaultWalletId(nextWallet ? nextWallet.id : null)
      }

      await deleteWallet(walletId)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Failed to delete wallet', err)
      setPageError('Gagal menghapus akun dompet.')
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

  const getInitials = (text) => (text ? text.substring(0, 2).toUpperCase() : '')

  const counts = useMemo(() => {
    if (!allTransactions) return { all: 0, expense: 0, income: 0 }
    let expense = 0
    let income = 0
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


  if (wallet === null || (dbWallets !== undefined && !wallet)) {
    return (
      <div className="min-h-screen bg-[var(--bg)] p-4 max-w-2xl mx-auto flex flex-col">
        <PageHeader title={t('wallets.notFound', 'Akun Tidak Ditemukan')} onBack={() => navigate('/dashboard')} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-12 rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] flex items-center justify-center mb-4">
            <WalletIcon className="h-7 w-7" />
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
      return 'Kas Fisik'
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

        {/* ── 1. Clean Neutral Hero Section with Wallet Icon ────────────── */}
        <div className="ft-wallet-detail-hero w-full pb-8 pt-3 px-4 text-center bg-[var(--panel)] border-b border-[var(--border)] relative overflow-hidden">
          {/* Top Nav Bar with 3-Dots Action Button */}
          <PageHeader
            title={wallet.name}
            titleUppercase={true}
            onBack={() => navigate('/dashboard')}
            rightAction={
              <button 
                type="button"
                onClick={() => setIsActionMenuOpen(true)} 
                className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer shadow-xs"
                title={t('wallets.options', 'Opsi Akun')}
                aria-label={t('wallets.options', 'Opsi Akun')}
              >
                <MoreVertical size={16} strokeWidth={2.5} />
              </button>
            }
          />

          {/* Centered Circular Logo */}
          {(() => {
            const isCash = wallet.customIcon === 'dollar' || wallet.customIcon === 'cash' || wallet.institutionType === 'cash' || String(wallet.name || '').toLowerCase().includes('cash') || String(wallet.name || '').toLowerCase().includes('uang tunai')
            return (
              <div className="relative z-10 w-13 h-13 rounded-full bg-[var(--wallet-logo-bg,var(--panel-strong))] flex items-center justify-center overflow-hidden border border-[var(--wallet-logo-border,var(--border))] shadow-md mx-auto mt-2.5 mb-2">
                {isCash ? (
                  <div className="w-full h-full flex items-center justify-center text-amber-500">
                    <MoneyBagIcon size={26} strokeWidth={2.5} />
                  </div>
                ) : getWalletLogoUrl(wallet) ? (
                  <img 
                    src={getWalletLogoUrl(wallet)} 
                    alt={wallet.name} 
                    className="w-full h-full object-contain p-1.5 rounded-full" 
                    onError={(e) => {
                      e.target.style.display = 'none'
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full flex items-center justify-center font-black text-sm text-[var(--fg)]"
                  style={{ display: isCash || getWalletLogoUrl(wallet) ? 'none' : 'flex' }}
                >
                  {getInitials(wallet.name)}
                </div>
              </div>
            )
          })()}

          {/* Subtitles: Account Type Pill Badge & Primary Wallet Pill */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 mb-1">
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-strong)]/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--muted)] shadow-xs">
              <span>{formatAccountType(wallet.institutionType, wallet.name)}</span>
            </div>

            {isDefaultWallet && (
              <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-black text-amber-500 shadow-xs animate-in fade-in">
                <Star size={10} className="fill-amber-500 text-amber-500" />
                <span>{t('wallets.primaryBadge', 'Akun Utama')}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Overlapping Balance Card with Single Adjust Balance Action ─────── */}
        <div className="px-4 -mt-3 relative z-20">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 sm:p-4 shadow-md space-y-2">
            {/* Top Row: Label Caption & Direct Adjust Balance Button */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                Saldo Akun Saat Ini
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewBalanceRaw(formatMoneyValueForInput(currentBalance, wallet.currency || defaultCurrency))
                  setIsEditBalanceModalOpen(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] text-[11px] font-bold hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
                title={t('wallets.adjustBalance', 'Penyesuaian Saldo')}
              >
                <Sliders size={12} strokeWidth={2} />
                <span>{t('wallets.adjustBalance', 'Penyesuaian Saldo')}</span>
              </button>
            </div>

            {/* Middle Row: Crisp Bold Balance Display */}
            <div>
              <p className="ft-display text-2xl sm:text-3xl font-black text-[var(--fg)] tabular-nums truncate leading-none">
                {formatCurrency(currentBalance, wallet.currency || defaultCurrency)}
              </p>
            </div>

            {/* Bottom Row: Timestamp & Currency Info */}
            <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span>Terakhir update: {updatedAt}</span>
              <span className="rounded-md bg-[var(--field-bg)] border border-[var(--border)] px-2 py-0.5 font-black text-[10px] text-[var(--muted)] uppercase tracking-wider">
                {wallet.currency || defaultCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. Content Section: Unified Transaction Feed Card ─────── */}
        <div className="px-4 mt-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 sm:p-4 shadow-sm space-y-3">
            {/* Card Header & Controls */}
            <div className="space-y-2.5 pb-2.5 border-b border-[var(--border)]/40">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="ft-display text-sm font-black text-[var(--fg)] tracking-tight">
                  Riwayat Transaksi
                </h3>
                <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums text-[var(--muted)]">
                  {filteredTransactions?.length || 0} transaksi
                </span>
              </div>

              {/* Search & Tab Filter Row */}
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

            {/* Grouped Transaction List */}
            {groupedTransactions && groupedTransactions.length > 0 ? (
              groupedTransactions.map((group, idx) => (
                <section key={group.dateKey} className="space-y-1.5 ft-stagger-in" style={{ '--stagger': Math.min(idx, 10) }}>
                  {/* Sticky Date Header Strip */}
                  <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-1 py-1.5 bg-[var(--panel-strong)]/95 backdrop-blur-xs rounded-lg">
                    <span className="text-[11px] font-black tracking-wider text-[var(--muted)] uppercase">
                      {group.dateLabel}
                    </span>
                    {group.dailySummaryText ? (
                      <span className={`text-[11px] font-black tabular-nums ${
                        group.isPositive ? 'text-[var(--status-income)]' : 'text-[var(--muted)]'
                      }`}>
                        {group.dailySummaryText}
                      </span>
                    ) : null}
                  </div>

                  {/* Transaction Cards Container */}
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
                <div className="w-14 h-14 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center mx-auto mb-3 text-[var(--muted)]">
                  <Receipt size={26} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-bold text-[var(--fg)] mb-1">Belum ada transaksi</h3>
                <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
                  Belum ada catatan transaksi {activeTab !== 'all' ? activeTab : ''} di akun ini.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3-Dots Action BottomSheet ────────────────────────────────── */}
      <BottomSheet
        isOpen={isActionMenuOpen}
        onClose={() => setIsActionMenuOpen(false)}
        title={t('wallets.optionsTitle', 'Opsi Akun Dompet')}
      >
        <div className="space-y-2 pb-2">
          {/* Header Info Inside Sheet */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] mb-3">
            <div className="w-10 h-10 rounded-full bg-[var(--wallet-logo-bg,var(--panel))] border border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center font-black text-xs text-[var(--fg)] shrink-0 shadow-2xs">
              {wallet.customIcon === 'dollar' || wallet.customIcon === 'cash' || wallet.institutionType === 'cash' || String(wallet.name || '').toLowerCase().includes('cash') || String(wallet.name || '').toLowerCase().includes('uang tunai') ? (
                <MoneyBagIcon size={20} className="text-amber-500" strokeWidth={2.5} />
              ) : getWalletLogoUrl(wallet) ? (
                <img src={getWalletLogoUrl(wallet)} alt={wallet.name} className="w-full h-full object-contain p-1.5 rounded-full" />
              ) : (
                getInitials(wallet.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-black text-sm text-[var(--fg)] truncate">{wallet.name}</h4>
              <p className="text-xs text-[var(--muted)] font-semibold">{formatAccountType(wallet.institutionType, wallet.name)} • {wallet.currency || defaultCurrency}</p>
            </div>
            {isDefaultWallet && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-500 shrink-0">
                Utama
              </span>
            )}
          </div>

          {/* Action 1: Set Default Wallet (or active indicator) */}
          {isDefaultWallet ? (
            <div className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 select-none">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Star size={18} className="fill-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--fg)]">Akun Utama (Aktif)</p>
                  <p className="text-[10px] text-[var(--muted)]">Akun ini sedang menjadi akun default Anda</p>
                </div>
              </div>
              <Check size={16} className="text-amber-500 shrink-0" strokeWidth={3} />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSetDefaultWallet}
              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--field-bg)] text-[var(--muted)] flex items-center justify-center">
                  <Star size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--fg)]">Jadikan Akun Utama</p>
                  <p className="text-[10px] text-[var(--muted)]">Pilihan utama saat mencatat transaksi baru</p>
                </div>
              </div>
            </button>
          )}

          {/* Action 2: Delete Wallet */}
          <button
            type="button"
            onClick={() => {
              setIsActionMenuOpen(false)
              setIsDeleteModalOpen(true)
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/15 transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <Trash2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-500">Hapus Akun Dompet</p>
              <p className="text-[10px] text-rose-500/80">Hapus akun ini dan seluruh riwayat transaksinya</p>
            </div>
          </button>
        </div>
      </BottomSheet>

      {/* ── Existing Modals ─────────────────────────────────────────── */}
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
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
            >
              Simpan Saldo
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
