import { useState, useMemo } from 'react'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import {
  parseTransactionSearchQuery,
  formatAmountConditionBadge,
} from '../../lib/transactionSearchParser'
import SearchQuickChipsModal from './SearchQuickChipsModal'

/**
 * Collapsible search input with quick amount filter chips and pending notifications banner.
 */
export default function TransactionSearchAndBanner({
  isSearchOpen,
  searchQuery,
  onSearchChange,
  pendingReviewCount = 0,
  onOpenStaging,
  t,
}) {
  const [isManageChipsOpen, setIsManageChipsOpen] = useState(false)

  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency) || 'IDR'
  const locale = useSettingsStore((s) => s.locale) || 'id-ID'
  const searchQuickChips = useSettingsStore((s) => s.searchQuickChips) || []
  const setSearchQuickChips = useSettingsStore((s) => s.setSearchQuickChips)
  const resetSearchQuickChips = useSettingsStore((s) => s.resetSearchQuickChips)

  const parsedQuery = useMemo(() => {
    return parseTransactionSearchQuery(searchQuery || '', defaultCurrency)
  }, [searchQuery, defaultCurrency])

  const amountBadgeText = useMemo(() => {
    if (!parsedQuery.amountCondition) return ''
    return formatAmountConditionBadge(parsedQuery.amountCondition, locale, defaultCurrency)
  }, [parsedQuery.amountCondition, locale, defaultCurrency])

  const handleClearAmountFilter = () => {
    triggerHaptic('impactLight')
    if (parsedQuery.textQuery) {
      onSearchChange(parsedQuery.textQuery)
    } else {
      onSearchChange('')
    }
  }

  const handleChipClick = (chipText) => {
    triggerHaptic('selection')
    if (!searchQuery) {
      onSearchChange(chipText)
      return
    }

    // Toggle off if exact chip string is already present
    if (searchQuery.includes(chipText)) {
      if (parsedQuery.textQuery) {
        onSearchChange(parsedQuery.textQuery)
      } else {
        onSearchChange('')
      }
      return
    }

    // If there's text, append or replace operator part
    if (parsedQuery.textQuery) {
      onSearchChange(`${parsedQuery.textQuery} ${chipText}`.trim())
    } else {
      onSearchChange(chipText)
    }
  }

  return (
    <>
      {/* Collapsible Search Input & Quick Chips */}
      {(isSearchOpen || searchQuery) && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder={t('tx.search.placeholder', 'Cari catatan, kategori, atau nominal (>100k, 50k-200k)...')}
              value={searchQuery || ''}
              onChange={(event) => onSearchChange(event.target.value)}
              className="ft-field mt-0 h-11 pl-9 pr-9 text-xs sm:text-sm bg-[var(--field-bg)] border-[var(--border)] rounded-2xl focus:border-[var(--accent)]"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)] p-2 min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-90 cursor-pointer"
                aria-label={t('common.clear', 'Bersihkan')}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>

          {/* Active Amount Filter Badge */}
          {amountBadgeText && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl text-xs font-medium text-[var(--accent)] w-fit animate-in fade-in duration-150">
              <span className="font-semibold">{t('tx.search.chipActiveCondition', 'Filter Nominal')}:</span>
              <span>{amountBadgeText}</span>
              <button
                type="button"
                onClick={handleClearAmountFilter}
                aria-label={t('tx.search.removeFilter', 'Hapus filter nominal')}
                className="ml-1 p-0.5 hover:bg-[var(--accent)]/20 rounded-md transition cursor-pointer active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Quick Filter Chips Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            {searchQuickChips.map((chip) => {
              const isActive = (searchQuery || '').includes(chip)
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className={`shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer active:scale-95 border ${
                    isActive
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-2xs'
                      : 'bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] border-[var(--border)]'
                  }`}
                >
                  {chip}
                </button>
              )
            })}

            {/* Customize Chips Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection')
                setIsManageChipsOpen(true)
              }}
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--fg)] bg-[var(--field-bg)]/60 hover:bg-[var(--field-bg)] border border-dashed border-[var(--border)] rounded-lg transition cursor-pointer active:scale-95"
              title={t('tx.search.manageChips', 'Atur Chip')}
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>{t('tx.search.manageChips', 'Atur Chip')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick banner if pending mutations exist */}
      {pendingReviewCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3.5 py-2.5 text-[var(--fg)] shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
            <p className="text-xs font-semibold truncate">
              {t('tx.staging.bannerDesc', 'Ada {{count}} transaksi baru dari notifikasi siap diperiksa.', { count: pendingReviewCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenStaging}
            className="shrink-0 px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--accent)] text-white transition active:scale-95 cursor-pointer"
          >
            {t('tx.staging.reviewNow', 'Tinjau')}
          </button>
        </div>
      )}

      {/* Manage Chips Modal */}
      <SearchQuickChipsModal
        isOpen={isManageChipsOpen}
        onClose={() => setIsManageChipsOpen(false)}
        chips={searchQuickChips}
        onSave={(updated) => setSearchQuickChips?.(updated)}
        onReset={() => resetSearchQuickChips?.()}
        t={t}
      />
    </>
  )
}
