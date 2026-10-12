import { memo } from 'react'
import {
  Plus,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import CategoryIcon from '../../ui/CategoryIcon'
import { getCategoryToneClass } from '../../../lib/categoryIcon'

export const CategoryItemRow = memo(function CategoryItemRow({
  cat,
  activeTab,
  locale = 'id',
  t,
  isExpanded = false,
  onToggleExpand,
  onEditParent,
  onDeleteParent,
  onAddSub,
  onEditSub,
  onDeleteSub,
  getSwipeHandlers,
  swipedId,
  setSwipedId,
  isCustom = false,
  staggerIndex = 0,
}) {
  const catName = cat.names?.[locale] || cat.names?.id || cat.id
  const iconKey = cat.icon || cat.id
  const toneClass = getCategoryToneClass(cat.color || (activeTab === 'income' ? 'emerald' : 'sky'))
  const children = Array.isArray(cat.children) ? cat.children : []
  const subCount = children.length
  const isSwiped = swipedId === cat.id

  const handleRowClick = () => {
    if (isSwiped && setSwipedId) {
      setSwipedId(null)
      return
    }
    if (onToggleExpand) {
      onToggleExpand(cat.id)
    }
  }

  return (
    <div
      data-category-id={cat.id}
      className="relative overflow-hidden bg-[var(--field-bg)] select-none ft-stagger-in"
      style={{ '--stagger': Math.min(staggerIndex, 8) }}
    >
      {/* Swipeable Category Header Container */}
      <div className="relative overflow-hidden">
        {/* Progressive Swipe Background (Stage 1: Edit Sky, Stage 2: Delete Rose) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-0 flex items-center justify-end px-5 opacity-0 transition-colors duration-150 w-full"
        />

        {/* Main Swipable Category Card Row */}
        <article
          className={`relative z-10 flex touch-pan-y items-center justify-between gap-3 p-3.5 sm:px-4 bg-[var(--panel-strong)] transition-colors cursor-pointer active:bg-[var(--panel)] ${
            isExpanded ? 'bg-[var(--panel)]/70' : ''
          }`}
          onClick={handleRowClick}
          {...(getSwipeHandlers
            ? getSwipeHandlers(cat.id, {
                onEdit: () => onEditParent?.(cat),
                onDelete: () => onDeleteParent?.(cat),
                editLabel: t('common.edit', 'Edit'),
                deleteLabel: t('common.delete', 'Hapus'),
              })
            : {})}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Avatar Icon - Clicking avatar allows quick edit of category with subtle visual affordance */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditParent?.(cat)
              }}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${toneClass} shadow-2xs transition-transform active:scale-95 cursor-pointer hover:ring-2 hover:ring-[var(--border-strong)] relative group`}
              title={t('common.edit', 'Edit Kategori')}
              aria-label={t('common.edit', 'Edit Kategori')}
            >
              <CategoryIcon icon={iconKey} className="h-4.5 w-4.5" />
            </button>

            {/* Title & Metadata */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14.5px] sm:text-[15px] font-black text-[var(--fg)] tracking-tight truncate leading-tight">
                  {catName}
                </span>
                {isCustom ? (
                  <span className="rounded-md bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--accent)] shrink-0">
                    {t('settings.customBadge', 'Kustom')}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-[var(--muted)]">
                {subCount} {t('settings.subcategoriesCount', 'subkategori')}
              </p>
            </div>
          </div>

          {/* Chevron Expand / Collapse Indicator */}
          <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onToggleExpand?.(cat.id)}
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-90 cursor-pointer"
              aria-label={isExpanded ? t('common.collapse', 'Tutup') : t('common.expand', 'Buka')}
              title={isExpanded ? t('common.collapse', 'Tutup') : t('common.expand', 'Buka')}
            >
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180 text-[var(--accent)]' : ''
                }`}
              />
            </button>
          </div>
        </article>
      </div>

      {/* Accordion Subcategories Drawer */}
      <div
        className={`relative z-10 grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100 pointer-events-auto' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-[var(--field-bg)]/60 border-t border-[var(--border)]/30 px-3.5 py-3 sm:px-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-black tracking-wider text-[var(--muted)] uppercase">
                  {t('settings.subcategories', 'Subkategori')}
                </span>
                <span className="rounded-full bg-[var(--border)]/70 px-1.5 py-0.2 text-[9px] font-black text-[var(--muted)]">
                  {subCount}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddSub?.(cat)
                }}
                className="inline-flex items-center gap-1.5 min-h-[36px] sm:min-h-[32px] px-3.5 py-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-xs font-bold text-[var(--accent)] active:scale-95 transition cursor-pointer shadow-2xs select-none touch-manipulation"
                title={t('settings.addSubcategory', 'Tambah Subkategori')}
                aria-label={t('settings.addSubcategory', 'Tambah Subkategori')}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>{t('settings.addSubcategory', 'Tambah Subkategori')}</span>
              </button>
            </div>

            {children.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]/60 bg-[var(--panel-strong)] divide-y divide-[var(--border)]/30 shadow-2xs">
                {children.map((sub) => {
                  const subName = sub.names?.[locale] || sub.names?.id || sub.id
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-[var(--field-bg)]/70 transition-colors"
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer py-1"
                        onClick={() => onEditSub?.(cat.id, sub, catName)}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/70 shrink-0" />
                        <span className="text-xs font-bold text-[var(--fg)] truncate">
                          {subName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSub?.(cat.id, sub)
                          }}
                          className="grid h-8 w-8 min-h-[32px] min-w-[32px] place-items-center rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer"
                          title={t('common.delete', 'Hapus Subkategori')}
                          aria-label={t('common.delete', 'Hapus Subkategori')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)]/70 p-3.5 text-center flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-[var(--panel-strong)]/40">
                <span className="text-xs font-medium text-[var(--muted)]">
                  {t('settings.noSubcategoriesYet', 'Belum ada subkategori.')}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddSub?.(cat)
                  }}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[var(--accent)]/10 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 active:scale-95 inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition select-none touch-manipulation shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span>{t('settings.addNow', 'Tambah sekarang')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
