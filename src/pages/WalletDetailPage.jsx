import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, computeWalletBalance } from '../lib/db'
import { Wallet as WalletIcon } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ToastBanner from '../components/ui/ToastBanner'
import WalletDetailHero from '../components/wallet/detail/WalletDetailHero'
import WalletTransactionsList from '../components/wallet/detail/WalletTransactionsList'
import WalletManageModals from '../components/wallet/detail/WalletManageModals'
import { warmupDecryptionCache } from '../lib/fieldEncryption'
import useSettingsStore from '../store/useSettingsStore'
import useTranslation from '../hooks/useTranslation'
import useBackButton from '../hooks/useBackButton'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../lib/api'
import { FALLBACK_EXCHANGE_RATES } from '../lib/utils'
import { getLastSeenTxTimestamp, updateLastSeenTxTimestamp } from '../lib/transactionLastSeen'

export default function WalletDetailPage() {
  const { id } = useParams()
  const walletId = Number(id)
  const navigate = useNavigate()
  const [pageError, setPageError] = useState('')

  // 1. Settings store subscriptions
  const hideBalance = useSettingsStore((state) => state.hideBalance)
  const toggleHideBalance = useSettingsStore((state) => state.toggleHideBalance)
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const isDefaultWallet = defaultWalletId === walletId
  const { locale, t } = useTranslation()

  // 2. Modal visibility states
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isEditWalletModalOpen, setIsEditWalletModalOpen] = useState(false)
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // 3. Hardware back button handling
  useBackButton(() => setIsActionMenuOpen(false), Boolean(isActionMenuOpen))

  // 4. Dexie Live Queries
  const wallet = useLiveQuery(async () => {
    if (!walletId || isNaN(walletId)) return null
    try {
      const item = await db.wallets.get(walletId)
      if (item) return item
      const all = await db.wallets.toArray()
      return all.find((w) => String(w.id) === String(walletId)) || null
    } catch (err) {
      console.error('[WalletDetailPage:getWallet]', err)
      return null
    }
  }, [walletId])

  const dbWallets = useLiveQuery(() => db.wallets.toArray(), [])
  const allWallets = useMemo(() => dbWallets || [], [dbWallets])

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
      if (tx && tx.id != null && !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1) {
        txMap.set(tx.id, tx)
      }
    }
    for (const tx of [...tgtTxsNum, ...tgtTxsStr]) {
      if (
        tx &&
        tx.id != null &&
        !tx.deletedAt &&
        tx.type === 'transfer' &&
        tx.isPendingReview !== true &&
        tx.isPendingReview !== 1
      ) {
        txMap.set(tx.id, tx)
      }
    }
    const txs = Array.from(txMap.values())
    return txs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [walletId])

  // 5. Decryption Cache Warmup
  useEffect(() => {
    if (allTransactions && allTransactions.length > 0) {
      warmupDecryptionCache(allTransactions)
    }
  }, [allTransactions])

  // 6. Currency exchange rates
  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })
  useEffect(() => {
    let isMounted = true
    const loadRates = async () => {
      try {
        const fetched = await fetchCurrencyRates('USD')
        if (isMounted) setRates(fetched)
      } catch (err) {
        console.error('[WalletDetailPage:loadRates]', err)
        if (isMounted) setRates({ ...FALLBACK_EXCHANGE_RATES })
      }
    }
    loadRates()
    return () => {
      isMounted = false
    }
  }, [])

  // 7. Balance computation (Single source of truth)
  const currentBalance = useMemo(() => {
    if (!wallet) return 0
    return computeWalletBalance(wallet, allTransactions || [], rates, allWallets)
  }, [wallet, allTransactions, rates, allWallets])

  // 8. Session last seen timestamp for new transaction badge
  const sessionLastSeenTimestamp = useMemo(() => getLastSeenTxTimestamp(), [])
  useEffect(() => {
    const timer = setTimeout(() => {
      updateLastSeenTxTimestamp()
    }, 3500)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateLastSeenTxTimestamp()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      updateLastSeenTxTimestamp()
    }
  }, [])

  // 9. Early Loading & 404 Returns
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
          <p className="text-xs text-[var(--muted)] mt-1.5 max-w-xs">
            {t('wallets.notFoundDesc', 'Akun atau dompet yang Anda cari tidak tersedia atau mungkin telah dihapus.')}
          </p>
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

  // 10. Main Page Coordination Layout
  return (
    <>
      <div className="ft-page-enter min-h-screen flex flex-col bg-[var(--bg)] pb-28 relative">
        {pageError ? <ToastBanner message={pageError} type="error" onDismiss={() => setPageError('')} /> : null}

        <WalletDetailHero
          wallet={wallet}
          balance={currentBalance}
          isDefaultWallet={isDefaultWallet}
          hideBalance={hideBalance}
          onToggleHideBalance={toggleHideBalance}
          onAdjustBalance={() => setIsEditBalanceModalOpen(true)}
          onOpenOptions={() => setIsActionMenuOpen(true)}
          onBack={() => navigate('/dashboard')}
          defaultCurrency={defaultCurrency}
          locale={locale}
          t={t}
        />

        <WalletTransactionsList
          walletId={walletId}
          wallet={wallet}
          allTransactions={allTransactions}
          allWallets={allWallets}
          rates={rates}
          defaultCurrency={defaultCurrency}
          locale={locale}
          t={t}
          sessionLastSeenTimestamp={sessionLastSeenTimestamp}
          onError={setPageError}
        />
      </div>

      <WalletManageModals
        wallet={wallet}
        allWallets={allWallets}
        allTransactions={allTransactions}
        currentBalance={currentBalance}
        rates={rates}
        defaultCurrency={defaultCurrency}
        isDefaultWallet={isDefaultWallet}
        isActionMenuOpen={isActionMenuOpen}
        setIsActionMenuOpen={setIsActionMenuOpen}
        isEditWalletModalOpen={isEditWalletModalOpen}
        setIsEditWalletModalOpen={setIsEditWalletModalOpen}
        isEditBalanceModalOpen={isEditBalanceModalOpen}
        setIsEditBalanceModalOpen={setIsEditBalanceModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        onError={setPageError}
        locale={locale}
        t={t}
      />
    </>
  )
}
