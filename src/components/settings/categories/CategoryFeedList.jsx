import { memo, useMemo } from 'react'
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { CategoryItemRow } from './CategoryItemRow'
import useSwipeAction from '../../../hooks/useSwipeAction'

export const CategoryFeedList = memo(function CategoryFeedList({
  categories = [],
  activeTab = 'expense',
  locale = 'id',
  t,
  searchQuery = '',
  expandedCatIds,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  onEditParent,
  onDeleteParent,
  onAddSub,
  onEditSub,
  onDeleteSub,
  onClearSearch,
}) {
  const { swipedId, setSwipedId, getSwipeHandlers } = useSwipeAction()

  const allExpanded = useMemo(() => {
    if (!categories || categories.length === 0) return false
    return categories.every((cat) => expandedCatIds?.has?.(cat.id))
  }, [categories, expandedCatIds])

  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-8 text-center">
        <FolderOpen className="mx-auto h-8 w-8 text-[var(--muted)]/50 mb-2" />
        <p className="text-xs font-bold text-[var(--muted)]">
          {searchQuery
            ? t('settings.noCategoriesFound', 'Tidak ada kategori yang cocok dengan pencarian')
            : t('settings.noCategoriesYet', 'Belum ada kategori')}
        </p>
        {searchQuery ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-3 inline-flex items-center rounded-xl bg-[var(--panel-strong)] border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] active:scale-95 transition cursor-pointer shadow-2xs"
          >
            {t('common.clearSearch', 'Hapus Pencarian')}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* List Sub-header with Expand/Collapse All */}
      <div className="flex items-center justify-between px-3 sm:px-4 pt-1 text-xs">
        <span className="text-[11px] font-bold text-[var(--muted)]">
          {categories.length} {t('settings.categoriesTotal', 'Kategori')}
        </span>
        <button
          type="button"
          onClick={allExpanded ? onCollapseAll : onExpandAll}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
        >
          {allExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>{t('settings.collapseAll', 'Tutup Semua')}</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>{t('settings.expandAll', 'Buka Semua')}</span>
            </>
          )}
        </button>
      </div>

      {/* Connected Feed Group Card */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
        {categories.map((cat, idx) => {
          const isCustom = String(cat.id).startsWith('p_') || String(cat.id).startsWith('ip_')
          const isSearchActive = Boolean(searchQuery && searchQuery.trim().length > 0)
          const isExpanded = isSearchActive || Boolean(expandedCatIds?.has?.(cat.id))

          return (
            <CategoryItemRow
              key={cat.id}
              cat={cat}
              activeTab={activeTab}
              locale={locale}
              t={t}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              onEditParent={onEditParent}
              onDeleteParent={onDeleteParent}
              onAddSub={onAddSub}
              onEditSub={onEditSub}
              onDeleteSub={onDeleteSub}
              getSwipeHandlers={getSwipeHandlers}
              swipedId={swipedId}
              setSwipedId={setSwipedId}
              isCustom={isCustom}
              staggerIndex={idx}
            />
          )
        })}
      </div>
    </div>
  )
})
