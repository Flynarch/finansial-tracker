import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeWalletBalance } from '../lib/db'
import { format } from 'date-fns'
import {
  Trash2,
  Search,
  MoreVertical,
  Star,
  Sliders,
  Check,
  X,
  Wallet as WalletIcon,
  Download,
  Edit2,
  Eye,
  EyeOff,
} from 'lucide-react'
import MoneyBagIcon from '../components/ui/MoneyBagIcon'
import { getWalletLogoUrl } from '../data/walletInstitutions'
import { TransactionItemCard } from '../components/transactions/TransactionItemCard'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import TransactionDetailSheet from '../components/transactions/TransactionDetailSheet'
import ReceiptPreviewModal from '../components/transactions/ReceiptPreviewModal'
import { createTransaction as addTransaction, updateTransaction, deleteTransaction } from '../services/transactionService'
import { deleteWallet, updateWallet } from '../services/walletService'
import useSettingsStore from '../store/useSettingsStore'
import useSwipeAction from '../hooks/useSwipeAction'
import Modal from '../components/ui/Modal'
import BottomSheet from '../components/ui/BottomSheet'
import ConfirmDeleteModal from '../components/ui/ConfirmDeleteModal'
import EmptyState from '../components/ui/EmptyState'
import ToastBanner from '../components/ui/ToastBanner'
import PageHeader from '../components/ui/PageHeader'
import MaskedBalance from '../components/ui/MaskedBalance'
import {
  formatCurrency,
  formatMoneyInput,
  formatMoneyValueForInput,
  parseMoneyInput,
  convertCurrency,
  FALLBACK_EXCHANGE_RATES,
  safeFormatDate,
} from '../lib/utils'
import { exportTransactionsToCsv } from '../lib/exportReports'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import useTranslation from '../hooks/useTranslation'
import { getCategoryColorClass, resolveTransactionIconKey, getTransactionCategoryLabels } from '../lib/categoryIcon'

export default function WalletDetailPage() {
  const { id } = useParams()
  const walletId = Number(id)
  const navigate = useNavigate()
  const [pageError, setPageError] = useState('')
  const hideBalance = useSettingsStore((state) => state.hideBalance)
  const toggleHideBalance = useSettingsStore((state) => state.toggleHideBalance)
  
  const wallet = useLiveQuery(async () => {
    if (!walletId || isNaN(walletId)) return null
    try {
      const item = await db.wallets.get(walletId)
      if (item) return item
      const all = await db.wallets.toArray()
      return all.find((w) => String(w.id) === String(walletId)) || null
    } catch {
      return null
    }
  }, [walletId])
  const dbWallets = useLiveQuery(() => db.wallets.toArray(), [])

  const allWallets = useMemo(() => {
    return dbWallets || []
  }, [dbWallets])

  const allTransactions = useLiveQuery(async () => {
    if (!walletId || isNaN(walletId)) return []
    const [srcTxsNum, srcTxsStr, tgtTxsNum, tgtTxsStr] = await Promise.all([
      db.transactions.where('walletId').equals(walletId).toArray(),
      db.transactions.where('walletId').equals(String(walletId)).toArray(),
      db.transactions.where('targetWalletId').equals(walletId).toArray(),
      db.transactions.where('targetWalletId').equals(String(walletId)).toArray(),
    ])
    const txMap = new Map()
    for (const tx of [...srcTxsNum, ...srcTxsStr]) {
      if (tx && tx.id != null) txMap.set(tx.id, tx)
    }
    for (const tx of [...tgtTxsNum, ...tgtTxsStr]) {
      if (tx && tx.id != null && tx.type === 'transfer') txMap.set(tx.id, tx)
    }
    const txs = Array.from(txMap.values())
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
  const [isEditWalletModalOpen, setIsEditWalletModalOpen] = useState(false)
  const [editWalletForm, setEditWalletForm] = useState({
    name: '',
    institutionType: '',
    accountNumber: '',
    notes: '',
  })
  const [newBalanceRaw, setNewBalanceRaw] = useState('')

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

  const {
    swipedId: swipedTransactionId,
    setSwipedId: setSwipedTransactionId,
    isSwipingId,
    getSwipeHandlers,
  } = useSwipeAction()

  const openEditTransaction = useCallback((transaction) => {
    setEditingTransaction(transaction)
    const targetCurrency = transaction.currency || wallet?.currency || defaultCurrency
    const receipt = transaction.receiptImage || transaction.receipt || transaction.receiptUrl || transaction.image || null
    setEditFormData({
      date: transaction.date,
      amount: formatMoneyValueForInput(transaction.amount, targetCurrency),
      type: transaction.type,
      category: transaction.category,
      notes: transaction.notes || '',
      currency: targetCurrency,
      walletId: transaction.walletId,
      targetWalletId: transaction.targetWalletId || '',
      receiptImage: receipt,
      receipt: receipt,
      isSplit: Boolean(transaction.isSplit),
      splitItems: Array.isArray(transaction.splitItems) ? JSON.parse(JSON.stringify(transaction.splitItems)) : [],
    })
  }, [wallet?.currency, defaultCurrency])

  const handleEditSubmit = async () => {
    if (!editingTransaction?.id) return
    try {
      setPageError('')
      await updateTransaction(editingTransaction.id, {
        ...editFormData,
        amount: parseMoneyInput(editFormData.amount, editFormData.currency),
        receiptImage: editFormData.receiptImage || null,
        isSplit: Boolean(editFormData.isSplit),
        splitItems: editFormData.isSplit && Array.isArray(editFormData.splitItems) ? editFormData.splitItems : undefined,
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


  const handleExportWalletCsv = async () => {
    setIsActionMenuOpen(false)
    await exportTransactionsToCsv(allTransactions || [], wallet ? [wallet] : [], wallet?.currency || defaultCurrency, locale)
  }

  const handleOpenEditWallet = () => {
    if (!wallet) return
    setEditWalletForm({
      name: wallet.name || '',
      institutionType: wallet.institutionType || 'bank',
      accountNumber: wallet.accountNumber || '',
      notes: wallet.notes || '',
    })
    setIsActionMenuOpen(false)
    setIsEditWalletModalOpen(true)
  }

  const handleSaveEditWallet = async (e) => {
    e.preventDefault()
    if (!editWalletForm.name.trim()) return
    try {
      await updateWallet(walletId, {
        name: editWalletForm.name.trim(),
        institutionType: editWalletForm.institutionType,
        accountNumber: editWalletForm.accountNumber.trim(),
        notes: editWalletForm.notes.trim(),
      })
      setIsEditWalletModalOpen(false)
    } catch (err) {
      setPageError(err.message || 'Gagal mengubah dompet.')
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
        const notes = (tx.notes || '').toLowerCase()
        const amountStr = String(tx.amount || '')
        matchesSearch = catName.includes(query) || subName.includes(query) || notes.includes(query) || amountStr.includes(query)

        if (!matchesSearch && tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
          matchesSearch = tx.splitItems.some((si) => {
            if (!si) return false
            const siLabels = getTransactionCategoryLabels(si.category, si.type || tx.type, locale)
            const siCat = (siLabels?.main || si.category || '').toLowerCase()
            const siSub = (siLabels?.sub || si.subcategory || '').toLowerCase()
            const siNotes = (si.notes || '').toLowerCase()
            const siAmount = String(si.amount || '')
            return siCat.includes(query) || siSub.includes(query) || siNotes.includes(query) || siAmount.includes(query)
          })
        }
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
          if (tx.isPendingReview === true || tx.isPendingReview === 1) return
          const walletCurrency = wallet?.currency || defaultCurrency
          if (tx.type === 'income') {
            const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
            net += amt
          } else if (tx.type === 'expense') {
            const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
            net -= amt
          } else if (tx.type === 'transfer') {
            if (String(tx.targetWalletId) === String(walletId)) {
              const sourceWallet = allWallets.find((w) => String(w.id) === String(tx.walletId))
              const sourceCurrency = tx.currency || sourceWallet?.currency || defaultCurrency
              const targetAmount =
                tx.targetAmount != null && Number(tx.targetAmount) > 0
                  ? Number(tx.targetAmount)
                  : convertCurrency(tx.amount, sourceCurrency, walletCurrency, rates)
              net += targetAmount
            } else if (String(tx.walletId) === String(walletId)) {
              const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
              net -= amt
            }
          } else if (tx.type === 'balance_adjustment') {
            const amt = convertCurrency(tx.amount, tx.currency || walletCurrency, walletCurrency, rates)
            net += amt
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
  }, [filteredTransactions, t, defaultCurrency, wallet?.currency, rates, walletId, allWallets])

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
  const currentRenderedTxCount = useMemo(() => {
    return visibleGroups.reduce((acc, g) => acc + g.items.length, 0)
  }, [visibleGroups])

  const hasMore = currentRenderedTxCount < totalTxCount

  const currentBalance = useMemo(() => {
    if (!wallet) return 0
    return computeWalletBalance(wallet, allTransactions || [], rates, allWallets)
  }, [wallet, allTransactions, rates, allWallets])

  const handleDeleteWallet = async () => {
    try {
      const activeLoans = await db.loans
        .where('walletId')
        .equals(Number(walletId))
        .filter((l) => l.status !== 'paid' && l.status !== 'forgiven' && Number(l.remainingAmount || 0) > 0)
        .toArray()

      if (activeLoans && activeLoans.length > 0) {
        setIsDeleteModalOpen(false)
        setPageError('Tidak bisa menghapus akun ini karena masih terdapat catatan utang/piutang aktif yang terhubung. Selesaikan atau hapus catatan utang/piutang terlebih dahulu.')
        return
      }

      if (isDefaultWallet) {
        const nextWallet = allWallets.find((w) => !w.isArchived && w.id !== walletId)
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

    const isZeroDec = ['IDR', 'JPY', 'KRW', 'VND'].includes(targetCurrency)
    const diff = isZeroDec ? Math.round(newBal - currentBalance) : Math.round((newBal - currentBalance) * 100) / 100
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
        if (String(tx.walletId) === String(walletId)) expense++
        if (String(tx.targetWalletId) === String(walletId)) income++
      }
    }
    return { all: allTransactions.length, expense, income }
  }, [allTransactions, walletId])


  if (wallet === undefined) return <div className="min-h-screen bg-[var(--bg)]" />

  if (wallet === null) {
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
      return locale === 'en' ? 'Cash' : 'Kas Fisik'
    }
    if (rawType === 'investasi' || rawType === 'investment') return locale === 'en' ? 'Investment' : 'Investasi'
    if (!type || type === 'lainnya') return locale === 'en' ? 'Manual Account' : 'Akun Manual'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const updatedAt = safeFormatDate(wallet.createdAt, 'dd MMM yyyy, HH:mm') || (locale === 'en' ? 'Just now' : 'Baru saja')

  const TABS = [
    { id: 'all', label: t('common.all', 'Semua'), count: counts.all },
    { id: 'expense', label: t('common.expense', 'Pengeluaran'), count: counts.expense },
    { id: 'income', label: t('common.income', 'Pemasukan'), count: counts.income },
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
              <div className="relative z-10 w-13 h-13 rounded-full bg-[var(--wallet-logo-bg,var(--panel-strong))] flex items-center justify-center overflow-hidden border-[0.5px] border-[var(--wallet-logo-border,var(--border))] shadow-xs mx-auto mt-2.5 mb-2">
                {isCash ? (
                  <div className="w-full h-full flex items-center justify-center text-amber-500">
                    <MoneyBagIcon size={26} strokeWidth={2.5} />
                  </div>
                ) : getWalletLogoUrl(wallet) ? (
                  <img 
                    src={getWalletLogoUrl(wallet)} 
                    alt={wallet.name} 
                    className="w-full h-full object-cover" 
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
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                  {t('wallets.currentAccountBalance', 'Saldo Akun Saat Ini')}
                </span>
                <button
                  type="button"
                  onClick={toggleHideBalance}
                  className="grid h-7 w-7 min-h-[36px] min-w-[36px] place-items-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
                  title={hideBalance ? t('dashboard.showBalance', 'Tampilkan Saldo') : t('dashboard.hideBalance', 'Sembunyikan Saldo')}
                  aria-label={hideBalance ? t('dashboard.showBalance', 'Tampilkan Saldo') : t('dashboard.hideBalance', 'Sembunyikan Saldo')}
                >
                  {hideBalance ? <EyeOff size={13} strokeWidth={2.3} /> : <Eye size={13} strokeWidth={2.3} />}
                </button>
              </div>
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
            <div className="flex items-center min-h-[2rem]">
              <div className="ft-display text-xl sm:text-3xl font-black text-[var(--fg)] tabular-nums leading-tight flex items-center">
                {hideBalance ? (
                  <MaskedBalance size="lg" />
                ) : (
                  formatCurrency(currentBalance, wallet.currency || defaultCurrency)
                )}
              </div>
            </div>

            {/* Bottom Row: Timestamp & Currency Info */}
            <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span>{t('wallets.lastUpdated', 'Terakhir update: {{time}}', { time: updatedAt })}</span>
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
                  {t('wallets.txHistory', 'Riwayat Transaksi')}
                </h3>
                <span className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums text-[var(--muted)]">
                  {t('wallets.txCount', '{{count}} transaksi', { count: filteredTransactions?.length || 0 })}
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
            {visibleGroups && visibleGroups.length > 0 ? (
              <>
                {visibleGroups.map((group, idx) => (
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
                          onDelete={setSingleDeleteTx}
                          onViewDetail={setDetailTransaction}
                          onPreviewReceipt={setReceiptPreviewTx}
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
                title={t('wallets.emptyTxTitle', 'Belum Ada Transaksi')}
                description={t('wallets.emptyTxDesc', 'Belum ada catatan transaksi di akun dompet ini.')}
              />
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
            <div className="w-10 h-10 rounded-full bg-[var(--wallet-logo-bg,var(--panel))] border-[0.5px] border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center font-black text-xs text-[var(--fg)] shrink-0 shadow-2xs">
              {wallet.customIcon === 'dollar' || wallet.customIcon === 'cash' || wallet.institutionType === 'cash' || String(wallet.name || '').toLowerCase().includes('cash') || String(wallet.name || '').toLowerCase().includes('uang tunai') ? (
                <MoneyBagIcon size={20} className="text-amber-500" strokeWidth={2.5} />
              ) : getWalletLogoUrl(wallet) ? (
                <img src={getWalletLogoUrl(wallet)} alt={wallet.name} className="w-full h-full object-cover rounded-full" />
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
                {t('wallets.primaryBadge', 'Utama')}
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
                  <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.primaryActive', 'Akun Utama (Aktif)')}</p>
                  <p className="text-[10px] text-[var(--muted)]">{t('wallets.primaryActiveDesc', 'Akun ini sedang menjadi akun default Anda')}</p>
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
                  <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.setAsPrimary', 'Jadikan Akun Utama')}</p>
                  <p className="text-[10px] text-[var(--muted)]">{t('wallets.setAsPrimaryDesc', 'Pilihan utama saat mencatat transaksi baru')}</p>
                </div>
              </div>
            </button>
          )}

          {/* Action 2: Edit Wallet Info */}
          <button
            type="button"
            onClick={handleOpenEditWallet}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--field-bg)] text-[var(--muted)] flex items-center justify-center">
                <Edit2 size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.editTitle', 'Ubah Info Dompet')}</p>
                <p className="text-[10px] text-[var(--muted)]">{t('wallets.editDesc', 'Ubah nama akun, tipe institusi, dan catatan')}</p>
              </div>
            </div>
          </button>

          {/* Action 3: Export CSV */}
          <button
            type="button"
            onClick={handleExportWalletCsv}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--field-bg)] text-[var(--muted)] flex items-center justify-center">
                <Download size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.exportCsv', 'Ekspor Transaksi (.CSV)')}</p>
                <p className="text-[10px] text-[var(--muted)]">{t('wallets.exportCsvDesc', 'Unduh seluruh riwayat transaksi dompet ini ke file CSV')}</p>
              </div>
            </div>
          </button>


          {/* Action 5: Delete Wallet */}
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
              <p className="text-xs font-bold text-rose-500">{t('wallets.deleteTitle', 'Hapus Akun Dompet')}</p>
              <p className="text-[10px] text-rose-500/80">{t('wallets.deleteDesc', 'Arsipkan akun ini. Riwayat transaksi tetap aman tersimpan.')}</p>
            </div>
          </button>
        </div>
      </BottomSheet>

      {/* ── Transaction Detail BottomSheet ────────────────────────── */}
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
        wallets={allWallets}
        defaultCurrency={defaultCurrency}
        rates={rates}
        formatCurrency={formatCurrency}
        convertCurrency={convertCurrency}
        locale={locale}
        t={t}
      />

      {/* ── Single Transaction Delete Confirm Modal ─────────────────── */}
      <ConfirmDeleteModal
        isOpen={Boolean(singleDeleteTx)}
        onClose={() => setSingleDeleteTx(null)}
        onConfirm={async () => {
          if (!singleDeleteTx?.id) return
          const txId = singleDeleteTx.id
          setSingleDeleteTx(null)
          try {
            await deleteTransaction(txId)
            if (swipedTransactionId === txId) setSwipedTransactionId(null)
          } catch (err) {
            setPageError(err.message || 'Gagal menghapus transaksi.')
          }
        }}
        title={t('tx.item.delete') || 'Hapus Transaksi'}
        message={t('tx.item.deleteConfirm') || 'Apakah Anda yakin ingin menghapus transaksi ini?'}
      />

      {/* ── Receipt Preview Modal ────────────────────────────────────── */}
      <ReceiptPreviewModal
        isOpen={Boolean(receiptPreviewTx)}
        onClose={() => setReceiptPreviewTx(null)}
        imageSrc={
          receiptPreviewTx?.receiptImage ||
          receiptPreviewTx?.receipt ||
          receiptPreviewTx?.receiptUrl ||
          receiptPreviewTx?.image ||
          null
        }
        amountFormatted={
          receiptPreviewTx
            ? `${receiptPreviewTx.type === 'income' ? '+' : '-'}${formatCurrency(
                Math.abs(Number(receiptPreviewTx.amount || 0)),
                receiptPreviewTx.currency || defaultCurrency,
              )}`
            : ''
        }
        date={receiptPreviewTx?.date}
        notes={receiptPreviewTx?.notes}
        category={
          receiptPreviewTx
            ? getTransactionCategoryLabels(receiptPreviewTx.category, receiptPreviewTx.type, locale)?.main
            : ''
        }
        zIndex="z-[60]"
      />

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
            {t('wallets.deleteConfirmPrefix', 'Apakah Anda yakin ingin menghapus dompet')} <strong className="text-[var(--fg)]">{wallet?.name}</strong>? {t('wallets.deleteConfirmSuffix', 'Dompet akan diarsipkan dan disembunyikan. Seluruh riwayat transaksi tetap aman tersimpan.')}
          </>
        }
      />

      <Modal isOpen={isEditBalanceModalOpen} onClose={() => setIsEditBalanceModalOpen(false)} title={t('wallets.adjustBalance', 'Penyesuaian Saldo')}>
        <form onSubmit={handleEditBalance} className="pt-1">
          <p className="text-[13px] leading-relaxed text-[var(--muted)] mb-4">
            {t('wallets.adjustBalanceDesc', 'Masukkan nominal saldo riil Anda. Sistem otomatis membuat transaksi penyesuaian untuk selisihnya.')}
          </p>
          <div className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] focus-within:border-[var(--accent)] transition-colors mb-5 px-4 py-1">
            <span className="pr-2 text-[var(--muted)] font-black text-lg select-none">
              {(wallet?.currency || defaultCurrency) === 'IDR' ? 'Rp' : (wallet?.currency || defaultCurrency) === 'USD' ? '$' : wallet?.currency || defaultCurrency}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={newBalanceRaw}
              onChange={(e) => setNewBalanceRaw(formatMoneyInput(e.target.value, wallet?.currency || defaultCurrency))}
              onFocus={(e) => {
                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
              }}
              className="w-full bg-transparent py-3 pl-1 pr-2 font-black text-2xl text-[var(--fg)] outline-none tabular-nums"
              autoFocus
            />
          </div>
          <div className="flex gap-2.5">
            <button 
              type="button"
              onClick={() => setIsEditBalanceModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
            >
              {t('wallets.saveBalance', 'Simpan Saldo')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Wallet Info Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isEditWalletModalOpen}
        onClose={() => setIsEditWalletModalOpen(false)}
        title={t('wallets.editTitle', 'Ubah Info Dompet')}
      >
        <form onSubmit={handleSaveEditWallet} className="space-y-4 pt-1">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('wallets.nameLabel', 'Nama Dompet / Akun *')}
            </label>
            <input
              type="text"
              required
              value={editWalletForm.name}
              onChange={(e) => setEditWalletForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('wallets.namePlaceholder', 'Contoh: BCA Utama, Mandiri Tabungan')}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3 text-sm font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('wallets.accountNumberLabel', 'Nomor Rekening / ID Akun (Opsional)')}
            </label>
            <input
              type="text"
              value={editWalletForm.accountNumber}
              onChange={(e) => setEditWalletForm((p) => ({ ...p, accountNumber: e.target.value }))}
              placeholder="1234567890"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3 text-sm font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)] font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('wallets.notesLabel', 'Catatan (Opsional)')}
            </label>
            <textarea
              rows={2}
              value={editWalletForm.notes}
              onChange={(e) => setEditWalletForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder={t('wallets.notesPlaceholder', 'Catatan penggunaan akun...')}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3 text-xs font-medium text-[var(--fg)] outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsEditWalletModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!editWalletForm.name.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
