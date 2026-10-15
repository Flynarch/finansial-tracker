import { useState, useMemo } from 'react'
import { ChevronDown, X } from 'lucide-react'
import CategoryIcon from '../../ui/CategoryIcon'
import MoneyBagIcon from '../../ui/MoneyBagIcon'
import CategoryPickerModal from '../../transactions/CategoryPickerModal'
import WalletSelectModal from '../../ui/WalletSelectModal'
import { getWalletLogoUrl } from '../../../data/walletInstitutions'
import {
  getCategoryColorClass,
  resolveTransactionIconKey,
  getTransactionCategoryLabels,
} from '../../../lib/categoryIcon'
import { formatCurrency, convertCurrency } from '../../../lib/utils'
import { triggerHaptic } from '../../../lib/haptics'

export default function QuickLogTransactionCardPreview({
  previewData,
  wallets = [],
  defaultCurrency = 'IDR',
  locale = 'id',
  t = (key, fallback) => (typeof fallback === 'string' ? fallback : key),
  onSaveInstant,
  onDismiss = undefined,
  onOpenFullCategoryPicker = undefined,
  onOpenCategoryPicker = undefined,
}) {
  const [stagedOverrides, setStagedOverrides] = useState({})
  const [activeCategoryPickerIdx, setActiveCategoryPickerIdx] = useState(null)
  const [activeWalletPickerIdx, setActiveWalletPickerIdx] = useState(null)

  const transactions = useMemo(() => {
    if (!previewData) return []
    if (Array.isArray(previewData.transactions) && previewData.transactions.length > 0) {
      return previewData.transactions
    }
    if (previewData.type === 'transactions' && Array.isArray(previewData.items)) {
      return previewData.items
    }
    if (previewData.amount !== undefined && previewData.type) {
      return [previewData]
    }
    return []
  }, [previewData])

  const walletMap = useMemo(() => {
    const map = new Map()
    for (const w of wallets) {
      map.set(String(w.id), w)
    }
    return map
  }, [wallets])

  const effectiveTransactions = useMemo(() => {
    return transactions.map((tx, idx) => ({
      ...tx,
      ...(stagedOverrides[idx] || {}),
    }))
  }, [transactions, stagedOverrides])

  if (transactions.length === 0) return null

  const totalAmount = effectiveTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  const isMulti = effectiveTransactions.length > 1

  const handleCardClick = () => {
    triggerHaptic('medium')
    onSaveInstant?.(effectiveTransactions)
  }

  return (
    <div
      data-testid="quicklog-live-card-preview"
      className="space-y-2 rounded-2xl border border-[var(--accent)]/45 bg-[var(--panel-strong)]/95 backdrop-blur-xl p-2.5 sm:p-3 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-3 duration-200 ease-out"
    >
      {/* Header bar: Live Preview Badge, Instant Save Hint, & Subtle Dismiss Button */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent)] truncate">
            {isMulti
              ? `${effectiveTransactions.length} ${t('aiQuickLog.multiDetected', 'Transaksi Terdeteksi')} • ${formatCurrency(totalAmount, defaultCurrency)}`
              : t('aiQuickLog.livePreview', 'Pratinjau Hasil Transaksi')}
          </span>
        </div>
        {onDismiss && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="quicklog-dismiss-preview-btn"
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('light')
                onDismiss?.()
              }}
              className="rounded-lg p-1 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-90 cursor-pointer"
              title={t('common.close', 'Tutup Pratinjau')}
              aria-label={t('common.close', 'Tutup Pratinjau')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Render Individual or Multi Transaction Cards */}
      <div className="space-y-1.5">
        {effectiveTransactions.map((tx, idx) => {
          const type = tx.type || 'expense'
          const category = tx.category || (type === 'income' ? 'pendapatan/gaji' : 'kebutuhan_harian/lainnya')
          const iconKey = resolveTransactionIconKey(category, type)
          const colorClass = getCategoryColorClass(iconKey, type, category)
          const labels = getTransactionCategoryLabels(category, type, locale)

          const walletId = tx.walletId || (wallets[0]?.id ? String(wallets[0].id) : '1')
          const walletObj = walletMap.get(String(walletId)) || wallets[0]
          const isCash =
            walletObj?.customIcon === 'dollar' ||
            walletObj?.customIcon === 'cash' ||
            String(walletObj?.name || '').toLowerCase().includes('cash') ||
            String(walletObj?.name || '').toLowerCase().includes('uang tunai')
          const walletLogo = walletObj ? getWalletLogoUrl(walletObj) : null

          const isIncome = type === 'income'
          const isTransfer = type === 'transfer'
          const amountPrefix = isIncome ? '+' : isTransfer ? '' : '-'
          const amountColorClass = isIncome ? 'ft-income-text' : isTransfer ? 'text-[var(--accent)]' : 'ft-expense-text'

          const cleanNotes = tx.notes || tx.description || tx.merchant || ''
          const txTime = tx.time || ''

          const txCurrency = tx.currency || defaultCurrency
          const hasForeignCurrency = Boolean(txCurrency && txCurrency !== defaultCurrency)
          const convertedEst = hasForeignCurrency
            ? Math.round(convertCurrency(Number(tx.amount) || 0, txCurrency, defaultCurrency))
            : 0

          return (
            <div
              key={idx}
              onClick={handleCardClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCardClick()
              }}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-2.5 transition active:scale-[0.99] cursor-pointer hover:border-[var(--accent)]/50"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Avatar with Category Icon and Wallet Micro-Badge */}
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    className="relative shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      triggerHaptic('light')
                      if (onOpenCategoryPicker || onOpenFullCategoryPicker) {
                        ;(onOpenCategoryPicker || onOpenFullCategoryPicker)(idx)
                      } else {
                        setActiveCategoryPickerIdx(idx)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={t('aiQuickLog.changeCategory', 'Pilih Kategori')}
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${colorClass} shadow-2xs`}
                    >
                      <CategoryIcon icon={iconKey} className="h-4 w-4" />
                    </div>

                    {/* Micro Wallet Logo Badge */}
                    {walletObj && (
                      <div
                        className="absolute -bottom-1 -right-1 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[var(--border)] bg-[var(--panel-strong)] shadow-2xs cursor-pointer"
                        title={walletObj.name}
                        onClick={(e) => {
                          e.stopPropagation()
                          triggerHaptic('light')
                          setActiveWalletPickerIdx(idx)
                        }}
                      >
                        {isCash ? (
                          <div className="w-full h-full flex items-center justify-center text-amber-500">
                            <MoneyBagIcon size={9} strokeWidth={2.5} />
                          </div>
                        ) : walletLogo ? (
                          <img
                            src={walletLogo}
                            alt={walletObj.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <span
                          className="text-[6.5px] font-black leading-none text-[var(--fg)] flex items-center justify-center"
                          style={{ display: isCash || walletLogo ? 'none' : 'flex' }}
                        >
                          {walletObj.name ? walletObj.name.substring(0, 2).toUpperCase() : 'W'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Middle: Title, Wallet, Subcategory, and Clean Notes */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Interactive Category Trigger */}
                      <button
                        type="button"
                        data-testid="quicklog-change-category-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          triggerHaptic('light')
                          if (onOpenCategoryPicker || onOpenFullCategoryPicker) {
                            ;(onOpenCategoryPicker || onOpenFullCategoryPicker)(idx)
                          } else {
                            setActiveCategoryPickerIdx(idx)
                          }
                        }}
                        className="flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[var(--fg)] hover:text-[var(--accent)] transition cursor-pointer text-left"
                        title={t('aiQuickLog.changeCategory', 'Pilih Kategori')}
                      >
                        <span className="truncate">{labels.main}</span>
                        <ChevronDown className="h-3 w-3 text-[var(--muted)] shrink-0" />
                      </button>

                      {tx.merchant && (
                        <span className="truncate rounded-md bg-[var(--field-bg)] border border-[var(--border)] px-1.5 py-0.2 text-[9.5px] font-bold text-[var(--muted)]">
                          {tx.merchant}
                        </span>
                      )}
                    </div>

                    {/* Line 2: Interactive Wallet Name • Subcategory • Time */}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] font-semibold leading-tight text-[var(--muted)]">
                      <button
                        type="button"
                        data-testid="quicklog-change-wallet-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          triggerHaptic('light')
                          setActiveWalletPickerIdx(idx)
                        }}
                        className="inline-flex items-center gap-0.5 rounded px-1 -mx-1 text-[var(--fg)]/90 font-bold hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition cursor-pointer"
                        title={t('aiQuickLog.changeWallet', 'Pilih Dompet')}
                      >
                        <span>{walletObj?.name || 'Dompet'}</span>
                        <ChevronDown className="h-2.5 w-2.5 text-[var(--muted)] shrink-0" />
                      </button>
                      {labels.sub ? <span>• {labels.sub}</span> : null}
                      {txTime ? <span>• {txTime}</span> : null}
                    </div>

                    {/* Line 3: Clean User Notes */}
                    {cleanNotes && (
                      <p className="text-[10.5px] text-[var(--muted)] italic line-clamp-2 leading-relaxed">
                        "{cleanNotes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount, Multi-Currency Estimate & Quick Arrow */}
                <div className="shrink-0 text-right">
                  <span className={`block text-xs sm:text-sm font-black tracking-tight tabular-nums ${amountColorClass}`}>
                    {amountPrefix}
                    {formatCurrency(Number(tx.amount) || 0, txCurrency)}
                  </span>
                  {hasForeignCurrency && convertedEst > 0 && (
                    <span className="block text-[9.5px] font-semibold text-[var(--muted)] tabular-nums">
                      (~{formatCurrency(convertedEst, defaultCurrency)})
                    </span>
                  )}
                  <span className="text-[9px] font-medium text-[var(--muted)] block">
                    {t('aiQuickLog.tapToSave', 'Ketuk untuk simpan')}
                  </span>
                </div>
              </div>

            </div>
          )
        })}
      </div>

      {/* Full Category Picker Modal Popup */}
      {activeCategoryPickerIdx !== null && (
        <CategoryPickerModal
          isOpen={true}
          onClose={() => setActiveCategoryPickerIdx(null)}
          txType={effectiveTransactions[activeCategoryPickerIdx]?.type || 'expense'}
          selectedCategory={effectiveTransactions[activeCategoryPickerIdx]?.category}
          onSelectCategory={(newCat) => {
            triggerHaptic('selection')
            setStagedOverrides((prev) => ({
              ...prev,
              [activeCategoryPickerIdx]: { ...(prev[activeCategoryPickerIdx] || {}), category: newCat },
            }))
            setActiveCategoryPickerIdx(null)
          }}
        />
      )}

      {/* Full Wallet Select Modal Popup */}
      {activeWalletPickerIdx !== null && (
        <WalletSelectModal
          isOpen={true}
          onClose={() => setActiveWalletPickerIdx(null)}
          wallets={wallets}
          selectedWalletId={effectiveTransactions[activeWalletPickerIdx]?.walletId}
          onSelectWallet={(newWalletId) => {
            triggerHaptic('selection')
            setStagedOverrides((prev) => ({
              ...prev,
              [activeWalletPickerIdx]: { ...(prev[activeWalletPickerIdx] || {}), walletId: newWalletId },
            }))
            setActiveWalletPickerIdx(null)
          }}
        />
      )}
    </div>
  )
}
