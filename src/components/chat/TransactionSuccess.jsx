import { useState, useEffect, useRef, useMemo } from 'react'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { CheckCircle2, RotateCcw, ArrowRight, Wallet, Check, Pencil } from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { format, parseISO } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import { triggerHaptic } from '../../lib/haptics'
import { getDecryptedNoteSync, warmupDecryptionCache, isFieldEncrypted } from '../../lib/fieldEncryption'
import { getLocalDateString } from '../../lib/dateUtils'

const savedTxKeys = new Set()
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const stored = window.sessionStorage.getItem('ft_saved_tx_keys')
    if (stored) {
      JSON.parse(stored).forEach((k) => savedTxKeys.add(k))
    }
  }
} catch {
  // Ignore sessionStorage errors
}

function markPermanentlySaved(key) {
  if (!key) return
  savedTxKeys.add(key)
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('ft_saved_tx_keys', JSON.stringify([...savedTxKeys]))
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

export default function TransactionSuccess({
  data,
  onUndo,
  isUpdate = false,
  action,
  onEditItem,
  wallets = [],
  timestamp,
  msgId,
  isSaved = false,
}) {
  const { t } = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency || 'IDR')
  const txs = useMemo(() => (Array.isArray(data) ? data : (data ? [data] : [])), [data])
  const isSingle = txs.length === 1
  const singleTx = isSingle ? txs[0] : null
  const walletMap = useMemo(() => new Map((wallets || []).map((w) => [w.id, w.name])), [wallets])
  const getWalletName = (tx) => {
    if (!tx) return null
    const sName = tx.walletName || walletMap.get(Number(tx.walletId)) || (tx.walletId ? `Dompet #${tx.walletId}` : null)
    if (tx.type === 'transfer' && tx.targetWalletId) {
      const tName = tx.targetWalletName || walletMap.get(Number(tx.targetWalletId)) || `Dompet #${tx.targetWalletId}`
      return sName ? `${sName} -> ${tName}` : tName
    }
    return sName
  }
  const effectiveIsUpdate = Boolean(
    isUpdate ||
    action === 'update' ||
    singleTx?.isUpdate ||
    singleTx?.action === 'update' ||
    (txs.length > 0 && txs[0]?.isUpdate)
  )

  const [, setDecryptedTick] = useState(0)

  useEffect(() => {
    if (txs && txs.length > 0) {
      warmupDecryptionCache(txs).catch(() => {})
    }
  }, [txs])

  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((t) => t + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  const txKey = useMemo(() => {
    if (msgId) return `msg_${msgId}`
    if (Array.isArray(data) && data.length > 0) {
      const ids = data.map((t) => t.id || t.createdAt).filter(Boolean)
      if (ids.length > 0) return `txs_${ids.join('_')}`
    }
    if (data?.id) return `tx_${data.id}`
    if (timestamp) return `ts_${timestamp}`
    return null
  }, [data, msgId, timestamp])

  const [undoActive, setUndoActive] = useState(() => {
    if (!onUndo || isSaved) return false
    if (txKey && savedTxKeys.has(txKey)) return false
    const effectiveTs = Number(
      timestamp ||
      singleTx?.createdAt ||
      singleTx?.timestamp ||
      (Array.isArray(data) && data[0]?.createdAt) ||
      (Array.isArray(data) && data[0]?.timestamp)
    )
    if (Number.isFinite(effectiveTs) && effectiveTs > 0) {
      if (Date.now() - effectiveTs >= 5000) {
        if (txKey) markPermanentlySaved(txKey)
        return false
      }
    }
    return true
  })
  const [undoProgress, setUndoProgress] = useState(() => {
    if (!onUndo || isSaved) return 0
    if (txKey && savedTxKeys.has(txKey)) return 0
    const effectiveTs = Number(
      timestamp ||
      singleTx?.createdAt ||
      singleTx?.timestamp ||
      (Array.isArray(data) && data[0]?.createdAt) ||
      (Array.isArray(data) && data[0]?.timestamp)
    )
    if (Number.isFinite(effectiveTs) && effectiveTs > 0) {
      const elapsed = Date.now() - effectiveTs
      if (elapsed >= 5000) return 0
      return Math.max(0, Math.min(100, ((5000 - elapsed) / 5000) * 100))
    }
    return 100
  })
  const timerRef = useRef(null)

  useEffect(() => {
    if (!onUndo || !undoActive) return

    const effectiveTs = Number(
      timestamp ||
      singleTx?.createdAt ||
      singleTx?.timestamp ||
      (Array.isArray(data) && data[0]?.createdAt) ||
      (Array.isArray(data) && data[0]?.timestamp)
    )

    const now = Date.now()
    const duration = 5000
    const startTime = Number.isFinite(effectiveTs) && effectiveTs > 0 ? effectiveTs : now
    const interval = 50

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      if (elapsed >= duration) {
        clearInterval(timerRef.current)
        setUndoActive(false)
        setUndoProgress(0)
        if (txKey) markPermanentlySaved(txKey)
      } else {
        setUndoProgress(Math.max(0, Math.min(100, ((duration - elapsed) / duration) * 100)))
      }
    }, interval)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [onUndo, undoActive, txKey, timestamp, singleTx, data])

  const grouped = {}
  txs.forEach((tx) => {
    const d = tx.date || 'unknown'
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(tx)
  })

  const formatDate = (dateStr) => {
    try {
      const parsed = parseISO(dateStr)
      return format(parsed, 'EEEE, dd MMMM yyyy', { locale: locale === 'id' ? idLocale : enUS })
    } catch (err){
      console.warn('[TransactionSuccess]', err)
      return dateStr
    }
  }

  const navigate = useNavigate()
  const setIsOpen = useChatStore((s) => s.setIsOpen)

  const handleViewAll = () => {
    triggerHaptic('light')
    navigate('/transactions', { state: { focusTransactionId: singleTx?.id || txs[0]?.id } })
    setIsOpen(false)
  }

  const handleUndo = () => {
    triggerHaptic('medium')
    if (timerRef.current) clearInterval(timerRef.current)
    if (onUndo) onUndo()
  }

  const isIncome = singleTx?.type === 'income'
  const isTransfer = singleTx?.type === 'transfer'
  const typeLabel = isIncome
    ? (locale === 'en' ? 'Income' : 'Pemasukan')
    : isTransfer
    ? (locale === 'en' ? 'Transfer' : 'Transfer')
    : (locale === 'en' ? 'Expense' : 'Pengeluaran')

  const typeColorClass = isIncome
    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    : isTransfer
    ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
    : 'bg-rose-500/15 text-rose-500 border-rose-500/30'

  return (
    <div className="relative rounded-2xl border border-[var(--border)]/70 bg-[var(--panel-strong)]/85 backdrop-blur-md p-3 sm:p-3.5 shadow-sm overflow-hidden my-1 ft-msg-enter space-y-2.5">
      {/* Top Header Row: Status & Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`p-1 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs ${
              isIncome
                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500'
                : isTransfer
                ? 'bg-sky-500/15 border-sky-500/25 text-sky-500'
                : 'bg-rose-500/15 border-rose-500/25 text-rose-500'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-black text-[var(--fg)] tracking-tight truncate">
            {effectiveIsUpdate
              ? txs.length > 1
                ? t('ai.multipleTxUpdated', '{{count}} Transaksi Diperbarui', { count: txs.length })
                : t('ai.txUpdated', 'Transaksi Diperbarui')
              : txs.length > 1
              ? t('ai.multipleTxLogged', '{{count}} Transaksi Dicatat', { count: txs.length })
              : t('ai.txLogged', 'Transaksi Berhasil Dicatat')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onEditItem && singleTx && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                onEditItem(singleTx)
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] hover:underline transition cursor-pointer active:scale-95"
              title={locale === 'en' ? 'Edit' : 'Edit'}
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleViewAll}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer active:scale-95"
          >
            <span>{t('common.view', 'Lihat')}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Single Transaction Micro-Receipt Body */}
      {isSingle && singleTx ? (
        <div
          onClick={() => onEditItem?.(singleTx)}
          className={`rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/60 p-3 flex flex-col gap-2 ${
            onEditItem ? 'cursor-pointer hover:bg-[var(--field-bg)]/80 transition active:scale-[0.99]' : ''
          }`}
        >
          {/* Amount & Type Badge */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xl sm:text-2xl font-black font-mono tabular-nums tracking-tight text-[var(--fg)]">
              <span className="text-xs text-[var(--muted)] font-bold mr-1">{singleTx.currency || defaultCurrency}</span>
              <span className={isIncome ? 'text-emerald-500' : isTransfer ? 'text-sky-500' : ''}>
                {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(singleTx.amount, singleTx.currency || defaultCurrency).replace(/^[^\d]+/, '')}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider border shrink-0 ${typeColorClass}`}>
              {typeLabel}
            </span>
          </div>

          {/* Category & Notes */}
          {(() => {
            const rawNote = singleTx.notes
            const plain = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
            const safeNote = isFieldEncrypted(plain) ? '' : (plain || '')
            const labels = getTransactionCategoryLabels(singleTx.category, singleTx.type, locale)
            const catDisplay = labels.main ? `${labels.main}${labels.sub ? ` • ${labels.sub}` : ''}` : singleTx.category
            return (
              <div className="flex flex-col gap-0.5">
                {catDisplay && (
                  <p className="text-xs font-bold text-[var(--fg)] truncate">
                    {catDisplay}
                  </p>
                )}
                {safeNote && (
                  <p className="text-[11px] text-[var(--muted)] italic font-normal line-clamp-2">
                    &quot;{safeNote}&quot;
                  </p>
                )}
              </div>
            )
          })()}

          {/* Wallet & Date Specs */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)]/40 text-[10.5px] font-semibold text-[var(--muted)]">
            <div className="flex items-center gap-1.5 truncate">
              {getWalletName(singleTx) && (
                <span className="inline-flex items-center gap-1 truncate text-[var(--fg)] font-bold">
                  <Wallet size={11} className="text-[var(--accent)] shrink-0" />
                  <span className="truncate">{getWalletName(singleTx)}</span>
                </span>
              )}
            </div>
            <span className="shrink-0 text-[10px] tabular-nums">
              {formatDate(singleTx.date || getLocalDateString())}{singleTx.time ? ` • ${singleTx.time}` : ''}
            </span>
          </div>
        </div>
      ) : null}

      {/* Multi-transaction Items List */}
      {!isSingle && (
        <div className={`space-y-2.5 ${txs.length >= 4 ? 'max-h-72 overflow-y-auto ft-hide-scrollbar pr-0.5' : ''}`}>
          {Object.entries(grouped).map(([dateStr, items]) => (
            <div key={dateStr} className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {formatDate(dateStr)}
              </span>
              <div className="space-y-1">
                {items.map((tx, i) => {
                  const txIsIncome = tx.type === 'income'
                  const txIsTransfer = tx.type === 'transfer'
                  const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                  const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                  const colorClass = getCategoryColorClass(iconKey, tx.type)
                  const rawNote = tx.notes
                  const plain = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
                  const safeNote = isFieldEncrypted(plain) ? '' : (plain || '')

                  return (
                    <div
                      key={tx.id || i}
                      className="flex items-start justify-between gap-2.5 rounded-xl border border-[var(--border)]/50 bg-[var(--field-bg)]/60 p-2.5"
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <span className="font-mono text-[9.5px] font-bold text-[var(--muted)]">#{i + 1}</span>
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${colorClass}`}>
                            <CategoryIcon categoryKey={iconKey} className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <p className="text-xs font-bold text-[var(--fg)] truncate">
                            {labels.main || tx.category}
                          </p>
                          <p className="text-[10px] text-[var(--muted)] truncate">
                            <span className="font-bold text-[var(--fg)]">{getWalletName(tx) || (locale === 'en' ? 'Cash' : 'Kas')}</span>
                            {labels.sub ? <span className="opacity-75"> • {labels.sub}</span> : null}
                            {tx.time ? <span className="tabular-nums"> • {tx.time}</span> : null}
                          </p>
                          {safeNote ? (
                            <p className="text-[10.5px] italic text-[var(--muted)] line-clamp-2">
                              &quot;{safeNote}&quot;
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <span
                          className={`font-mono text-xs font-bold tabular-nums ${
                            txIsIncome ? 'text-emerald-500' : txIsTransfer ? 'text-sky-500' : 'text-[var(--fg)]'
                          }`}
                        >
                          {txIsIncome ? '+' : txIsTransfer ? '' : '-'}
                          {formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                        </span>
                        {onEditItem && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light')
                              onEditItem(tx)
                            }}
                            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--panel-strong)] transition cursor-pointer"
                            title={locale === 'en' ? `Edit #${i + 1}` : `Edit #${i + 1}`}
                            aria-label={`Edit ${labels.main || tx.category}`}
                          >
                            <Pencil size={11} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Micro-Actions Footer with Auto-Expiring Undo Bar */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)]/40">
        {onUndo && undoActive ? (
          <div className="relative flex-1 max-w-[130px]">
            <button
              type="button"
              onClick={handleUndo}
              className="w-full relative z-10 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-xl text-[10.5px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer active:scale-95 overflow-hidden"
            >
              <div
                className="absolute inset-0 bg-rose-500/15 pointer-events-none transition-all duration-75 origin-left"
                style={{ width: `${undoProgress}%` }}
              />
              <RotateCcw className="h-3 w-3 relative z-10" />
              <span className="relative z-10">{t('common.undo', 'Batalkan')}</span>
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
            <Check size={12} className="stroke-[2.5]" />
            <span>{effectiveIsUpdate ? t('ai.updatedBadge', 'Diperbarui') : (locale === 'en' ? 'Saved' : 'Tersimpan')}</span>
          </div>
        )}

        <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--muted)]/60 tabular-nums ml-auto">
          FinTrack Ledger
        </span>
      </div>
    </div>
  )
}
