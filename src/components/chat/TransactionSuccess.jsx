import { useState, useEffect, useRef, useMemo } from 'react'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { CheckCircle2, RotateCcw, ArrowRight, Wallet, Check, Sparkles, WifiOff, Pencil } from 'lucide-react'
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

export default function TransactionSuccess({ data, onUndo, isUpdate = false, action, onEditItem, wallets = [] }) {
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
  const engine = singleTx?.engine || txs[0]?.engine || (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_nlp' : 'online_ai')
  const isOnlineAi = engine === 'online_ai'

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

  // 5-second auto-expiring undo timer
  const [undoActive, setUndoActive] = useState(Boolean(onUndo))
  const [undoProgress, setUndoProgress] = useState(100)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!onUndo) return
    const duration = 5000
    const interval = 50
    const step = (interval / duration) * 100

    timerRef.current = setInterval(() => {
      setUndoProgress((prev) => {
        if (prev <= step) {
          clearInterval(timerRef.current)
          setUndoActive(false)
          return 0
        }
        return prev - step
      })
    }, interval)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [onUndo])

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

  // Single transaction hero details
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
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm overflow-hidden my-1 ft-msg-enter">
      {/* Top Accent Line */}
      <div className={`h-1 w-full ${isIncome ? 'bg-emerald-500/60' : isTransfer ? 'bg-sky-500/60' : 'bg-rose-500/60'}`} />

      {/* Header Banner */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border)]/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-black text-[var(--fg)] tracking-tight truncate">
              {effectiveIsUpdate
                ? (txs.length > 1
                    ? t('ai.multipleTxUpdated', '{{count}} Transaksi Diperbarui', { count: txs.length })
                    : t('ai.txUpdated', 'Transaksi Diperbarui'))
                : (txs.length > 1
                    ? t('ai.multipleTxLogged', '{{count}} Transaksi Dicatat', { count: txs.length })
                    : t('ai.txLogged', 'Transaksi Berhasil Dicatat'))}
            </span>
            {isOnlineAi ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-500 shrink-0">
                <Sparkles className="h-2.5 w-2.5" />
                <span>AI Gemini (Online)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-500 shrink-0">
                <WifiOff className="h-2.5 w-2.5" />
                <span>NLP Lokal (Offline)</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onEditItem && singleTx && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                onEditItem(singleTx)
              }}
              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--accent)] hover:underline transition cursor-pointer active:scale-95"
              title={locale === 'en' ? 'Edit' : 'Edit'}
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleViewAll}
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer active:scale-95"
          >
            <span>{t('common.view', 'Lihat')}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Single Transaction Hero Section */}
      {isSingle && singleTx ? (
        <div
          onClick={() => onEditItem?.(singleTx)}
          className={`p-4 flex flex-col items-center justify-center text-center bg-[var(--field-bg)]/40 border-b border-[var(--border)]/30 ${onEditItem ? 'cursor-pointer hover:bg-[var(--field-bg)]/60 transition active:scale-[0.99]' : ''}`}
        >
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border mb-1.5 ${typeColorClass}`}>
            {typeLabel}
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight text-[var(--fg)]">
            <span className="text-xs text-[var(--muted)] font-bold mr-1">{singleTx.currency || defaultCurrency}</span>
            <span>{isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(singleTx.amount, singleTx.currency || defaultCurrency).replace(/^[^\d]+/, '')}</span>
          </div>
          {(() => {
            const rawNote = singleTx.notes
            const plain = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
            const safeNote = isFieldEncrypted(plain) ? '' : (plain || '')
            const labels = getTransactionCategoryLabels(singleTx.category, singleTx.type, locale)
            const catDisplay = labels.main ? `${labels.main}${labels.sub ? ` • ${labels.sub}` : ''}` : singleTx.category
            return (
              <div className="mt-1 flex flex-col items-center gap-0.5 max-w-[90%]">
                {catDisplay && (
                  <p className="text-xs font-bold text-[var(--fg)] truncate">
                    {catDisplay}
                  </p>
                )}
                {safeNote && (
                  <p className="text-[11px] text-[var(--muted)] italic font-normal truncate">
                    &quot;{safeNote}&quot;
                  </p>
                )}
              </div>
            )
          })()}

          {/* Account & Date Specs */}
          <div className="flex items-center gap-3 mt-2 text-[10.5px] font-semibold text-[var(--muted)]">
            {getWalletName(singleTx) && (
              <span className="inline-flex items-center gap-1">
                <Wallet size={11} className="text-[var(--accent)]" />
                <span className="text-[var(--fg)] font-bold">{getWalletName(singleTx)}</span>
              </span>
            )}
            <span>{formatDate(singleTx.date || getLocalDateString())}</span>
            {singleTx.time && (
              <span>• {singleTx.time}</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Multi-transaction Items List */}
      {!isSingle && (
        <div className={`p-3 space-y-3 ${txs.length >= 4 ? 'max-h-72 overflow-y-auto ft-hide-scrollbar pr-0.5' : ''}`}>
          {Object.entries(grouped).map(([dateStr, items]) => (
            <div key={dateStr} className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {formatDate(dateStr)}
              </span>
              <div className="space-y-1.5">
                {items.map((tx, i) => {
                  const iconKey = resolveTransactionIconKey(tx.category, tx.type)
                  const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
                  const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                  const txIsIncome = tx.type === 'income'
                  const txIsTransfer = tx.type === 'transfer'
                  const wName = getWalletName(tx)
                  const rawNote = tx.notes
                  const plain = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
                  const safeNote = isFieldEncrypted(plain) ? '' : (plain || '')

                  return (
                    <div
                      key={tx.id || i}
                      onClick={() => onEditItem?.(tx)}
                      className="flex items-start justify-between gap-2.5 p-2.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/40 hover:border-[var(--accent)]/40 transition cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div className={`grid h-8 w-8 place-items-center rounded-xl ${colorClass} shrink-0 mt-0.5`}>
                          <CategoryIcon icon={iconKey} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Baris 1: Kategori Utama & Urutan */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-[var(--muted)] shrink-0">#{i + 1}</span>
                            <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
                              {labels.main || tx.category}
                            </p>
                          </div>

                          {/* Baris 2: Nama Wallet (kontras bold) • Subkategori • Jam */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] mt-1 text-[var(--muted)]">
                            {wName && (
                              <span className="font-bold text-[var(--fg)] inline-flex items-center gap-0.5">
                                <Wallet size={10} className="text-[var(--accent)] shrink-0" />
                                <span>{wName}</span>
                              </span>
                            )}
                            {labels.sub && (
                              <span>• {labels.sub}</span>
                            )}
                            {tx.time && (
                              <span>• {tx.time}</span>
                            )}
                          </div>

                          {/* Baris 3: Catatan pengguna di baris baru (italic dengan tanda kutip, line-clamp-2) */}
                          {safeNote && (
                            <p className="text-[11px] font-normal italic text-[var(--fg)]/80 mt-1 line-clamp-2 break-words">
                              &quot;{safeNote}&quot;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1.5 pl-1">
                        <span className={`text-xs font-black tabular-nums ${txIsIncome ? 'ft-income-text' : txIsTransfer ? 'text-sky-500' : 'ft-expense-text'}`}>
                          {txIsIncome ? '+' : txIsTransfer ? '' : '-'}{formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                        </span>
                        {onEditItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              triggerHaptic('light')
                              onEditItem(tx)
                            }}
                            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--panel-strong)] transition cursor-pointer"
                            title={locale === 'en' ? `Edit #${i + 1}` : `Edit #${i + 1}`}
                            aria-label={`Edit ${labels.main || tx.category}`}
                          >
                            <Pencil size={12} strokeWidth={2} />
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

      {/* Ticket Tear Perforation */}
      <div className="relative flex items-center px-3 py-0.5">
        <div className="absolute -left-2 h-4 w-4 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        <div className="w-full border-t border-dashed border-[var(--border-strong)]/50" />
        <div className="absolute -right-2 h-4 w-4 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
      </div>

      {/* Card Actions Footer with Auto-Expiring Undo Bar */}
      <div className="p-2.5 bg-[var(--field-bg)]/40 flex items-center justify-between gap-2">
        {onUndo && undoActive ? (
          <div className="relative flex-1 max-w-[130px]">
            <button
              type="button"
              onClick={handleUndo}
              className="w-full relative z-10 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer active:scale-95 overflow-hidden"
            >
              {/* Expiring progress indicator background */}
              <div
                className="absolute inset-0 bg-rose-500/15 pointer-events-none transition-all duration-75 origin-left"
                style={{ width: `${undoProgress}%` }}
              />
              <RotateCcw className="h-3 w-3 relative z-10" />
              <span className="relative z-10">{t('common.undo', 'Batalkan')}</span>
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-500">
            <Check size={13} className="stroke-[2.5]" />
            <span>{effectiveIsUpdate ? t('ai.updatedBadge', 'Diperbarui') : (locale === 'en' ? 'Saved' : 'Tersimpan')}</span>
          </div>
        )}

        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 ml-auto">
          FinTrack Verified
        </span>
      </div>
    </div>
  )
}
