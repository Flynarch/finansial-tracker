import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionEditSheet from '../transactions/TransactionEditSheet'
import { FALLBACK_EXCHANGE_RATES } from '../../lib/utils'
import { getCachedCurrencyRates } from '../../lib/api'
import { warmupDecryptionCache } from '../../lib/fieldEncryption'
import useSettingsStore from '../../store/useSettingsStore'
import { deleteTransaction, updateTransaction } from '../../services/transactionService'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import { copyToClipboard } from '../../lib/clipboard'
import { triggerHaptic } from '../../lib/haptics'
import {
  generateReceiptRef,
  formatReceiptDate,
  computeReceiptTotals,
  getReceiptContextualTheme,
  buildEditFormData,
  buildUpdatedTxPayload,
} from './receipt/receiptHelpers'
import ReceiptHeader from './receipt/ReceiptHeader'
import SingleTxReceiptCard from './receipt/SingleTxReceiptCard'
import MultiTxReceiptCard from './receipt/MultiTxReceiptCard'
import ReceiptFooter from './receipt/ReceiptFooter'
import ReceiptActions from './receipt/ReceiptActions'
import ReceiptUndoneView from './receipt/ReceiptUndoneView'

export default function AiDigitalReceipt({
  transactions = [],
  rawPrompt = '',
  merchant = '',
  onLogAnother,
  onClose,
  wallets = [],
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const closeQuickLog = useChatStore((s) => s.closeQuickLog)

  const [isUndone, setIsUndone] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [refCode] = useState(generateReceiptRef)

  const [localTxs, setLocalTxs] = useState(() => (Array.isArray(transactions) ? transactions : [transactions]))
  const [editingTx, setEditingTx] = useState(null)
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    type: 'expense',
    category: '',
    notes: '',
    currency: defaultCurrency,
  })

  const [prevTxs, setPrevTxs] = useState(transactions)
  if (prevTxs !== transactions) {
    setPrevTxs(transactions)
    setLocalTxs(Array.isArray(transactions) ? transactions : [transactions])
  }

  const txList = localTxs
  const isSingle = txList.length === 1
  const singleTx = useMemo(() => txList[0] || {}, [txList])
  const engine = singleTx.engine || txList[0]?.engine || (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_nlp' : 'online_ai')
  const isOnlineAi = engine === 'online_ai'

  const [, setDecryptedTick] = useState(0)

  useEffect(() => {
    if (txList && txList.length > 0) {
      warmupDecryptionCache(txList).catch(() => {})
    }
  }, [txList])

  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((tick) => tick + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  const contextualTheme = useMemo(() => {
    return getReceiptContextualTheme(isSingle, singleTx, txList, t)
  }, [isSingle, singleTx, txList, t])

  const activeRates = useMemo(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }, [])

  const { displayCurrency, totalExpense, totalIncome, netTotal } = useMemo(() => {
    return computeReceiptTotals(txList, defaultCurrency, activeRates)
  }, [txList, defaultCurrency, activeRates])

  const handleUndo = useCallback(async () => {
    setIsUndoing(true)
    try {
      await Promise.all(
        txList.filter((tx) => tx.id).map((tx) => deleteTransaction(tx.id))
      )
      setIsUndone(true)
    } catch (err){
      console.warn('[AiDigitalReceipt]', err)
      triggerHaptic('warning')
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: locale === 'en' ? 'Undo Failed' : 'Gagal Membatalkan',
            message: err?.message || (locale === 'en' ? 'Failed to undo transaction' : 'Gagal membatalkan transaksi'),
            type: 'error',
          },
        })
      )
    } finally {
      setIsUndoing(false)
    }
  }, [txList, locale])

  const handleCopyRef = useCallback(async () => {
    const success = await copyToClipboard(refCode)
    if (success) {
      setCopiedRef(true)
      setTimeout(() => setCopiedRef(false), 2000)
    }
  }, [refCode])

  const handleViewTransactions = useCallback(() => {
    if (onClose) onClose()
    closeQuickLog()
    navigate('/transactions')
  }, [onClose, closeQuickLog, navigate])

  const handleStartEdit = useCallback((tx) => {
    setEditingTx(tx)
    setEditFormData(buildEditFormData(tx, defaultCurrency, wallets))
  }, [defaultCurrency, wallets])

  const handleSaveEdit = useCallback(async (event, overrides = {}) => {
    if (!editingTx?.id) return
    const updated = buildUpdatedTxPayload(editFormData, editingTx, overrides, wallets, defaultCurrency)

    try {
      await updateTransaction(editingTx.id, updated)
      setLocalTxs((prev) =>
        prev.map((t) => (t.id === editingTx.id ? { ...t, ...updated } : t))
      )
      setEditingTx(null)
    } catch (err){
      console.warn('[AiDigitalReceipt]', err)
      triggerHaptic('warning')
      window.dispatchEvent(
        new CustomEvent('ft-show-toast', {
          detail: {
            title: locale === 'en' ? 'Update Failed' : 'Gagal Memperbarui',
            message: err?.message || (locale === 'en' ? 'Failed to update transaction' : 'Gagal menyimpan perubahan transaksi'),
            type: 'error',
          },
        })
      )
    }
  }, [editingTx, editFormData, wallets, defaultCurrency, locale])

  const receiptDate = useMemo(() => {
    return formatReceiptDate(txList, singleTx, locale)
  }, [txList, singleTx, locale])

  if (isUndone) {
    return <ReceiptUndoneView txCount={txList.length} onLogAnother={onLogAnother} />
  }

  const activeMerchant = merchant || singleTx.merchant || txList.find((t) => t.merchant)?.merchant || ''

  return (
    <div className="space-y-2.5 ft-mode-enter">
      {/* DIGITAL RECEIPT CARD */}
      <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-lg overflow-hidden">
        <ReceiptHeader
          contextualTheme={contextualTheme}
          activeMerchant={activeMerchant}
          isOnlineAi={isOnlineAi}
          receiptDate={receiptDate}
          rawPrompt={rawPrompt}
        />

        {isSingle ? (
          <SingleTxReceiptCard
            tx={singleTx}
            defaultCurrency={defaultCurrency}
            locale={locale}
            wallets={wallets}
          />
        ) : (
          <MultiTxReceiptCard
            txList={txList}
            defaultCurrency={defaultCurrency}
            displayCurrency={displayCurrency}
            locale={locale}
            wallets={wallets}
            netTotal={netTotal}
            totalExpense={totalExpense}
            totalIncome={totalIncome}
            onStartEdit={handleStartEdit}
          />
        )}

        <ReceiptFooter
          refCode={refCode}
          copiedRef={copiedRef}
          onCopyRef={handleCopyRef}
          contextualTheme={contextualTheme}
        />
      </div>

      <ReceiptActions
        isSingle={isSingle}
        singleTx={singleTx}
        isUndoing={isUndoing}
        onLogAnother={onLogAnother}
        onStartEdit={handleStartEdit}
        handleUndo={handleUndo}
        handleViewTransactions={handleViewTransactions}
      />

      {editingTx && (
        <TransactionEditSheet
          isOpen={Boolean(editingTx)}
          onClose={() => setEditingTx(null)}
          formData={editFormData}
          setFormData={setEditFormData}
          onSubmit={handleSaveEdit}
          t={t}
          locale={locale}
          wallets={wallets}
        />
      )}
    </div>
  )
}
