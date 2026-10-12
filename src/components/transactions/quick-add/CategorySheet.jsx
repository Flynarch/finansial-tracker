import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import CategoryIcon from '../../ui/CategoryIcon'
import Button from '../../ui/Button'
import { getCategoryToneClass } from '../../../lib/categoryIcon'
import useTranslation from '../../../hooks/useTranslation'
import useBackButton from '../../../hooks/useBackButton'
import { triggerHaptic } from '../../../lib/haptics'
import {
  addExpenseParentCategory,
  addExpenseSubcategory,
  setExpenseCategoryColor,
} from '../../../lib/expenseCategories'
import {
  addIncomeParentCategory,
  addIncomeSubcategory,
  setIncomeCategoryColor,
} from '../../../lib/incomeCategories'
import { cascadeDeleteSubcategory } from '../../../lib/categoryCleanup'
import ConfirmDeleteModal from '../../ui/ConfirmDeleteModal'

const COLOR_TONES = ['amber', 'emerald', 'sky', 'indigo', 'purple', 'rose', 'teal', 'slate', 'orange', 'pink', 'yellow']

export default function CategorySheet({
  isOpen,
  isEnter,
  onClose,
  txType,
  activeTree,
  activeParentId,
  setActiveParentId,
  selectedCategory,
  onSelectCategory,
  resolveParentIcon,
  getEffectiveTone,
  onCategoryCustomChanged,
}) {
  const { t, locale } = useTranslation()
  const lang = locale === 'en' ? 'en' : 'id'

  const [editMode, setEditMode] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [newParentName, setNewParentName] = useState('')
  const [deleteSubTarget, setDeleteSubTarget] = useState(null)
  const sheetRef = useRef(null)
  const handleBarRef = useRef(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const [isDismissedByDrag, setIsDismissedByDrag] = useState(false)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const hasTriggeredSnapHaptic = useRef(false)
  const snapTimeoutRef = useRef(null)

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setIsDismissedByDrag(false)
    }
  }

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
    }
  }, [])

  useBackButton(onClose, Boolean(isOpen))

  const handleDragStart = useCallback((clientY) => {
    if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = null
    }
    hasTriggeredSnapHaptic.current = false
    touchStartY.current = clientY
    touchStartTime.current = Date.now()
    isDraggingRef.current = true
    dragOffsetRef.current = 0
    setIsDismissedByDrag(false)

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
    }
    if (handleBarRef.current) {
      handleBarRef.current.style.transition = 'none'
    }
  }, [])

  const handleDragMove = useCallback((clientY) => {
    if (!touchStartY.current || !isDraggingRef.current) return
    const deltaY = clientY - touchStartY.current
    const currentOffset = deltaY > 0 ? deltaY : deltaY * 0.15

    if (deltaY > 0) {
      if (deltaY >= 80 && !hasTriggeredSnapHaptic.current) {
        hasTriggeredSnapHaptic.current = true
        triggerHaptic('light')
      } else if (deltaY < 80 && hasTriggeredSnapHaptic.current) {
        hasTriggeredSnapHaptic.current = false
      }
    }

    dragOffsetRef.current = currentOffset

    // Direct GPU DOM update without React re-render
    if (sheetRef.current) {
      const y = Math.max(0, currentOffset)
      sheetRef.current.style.transform = `translate3d(0, ${y}px, 0)`
    }

    if (handleBarRef.current) {
      const y = Math.max(0, currentOffset)
      const scaleX = Math.min(1.45, Math.max(1, 1 + (y * 0.2) / 44))
      handleBarRef.current.style.transform = `scale3d(${scaleX}, 1, 1)`
      if (currentOffset >= 80) {
        handleBarRef.current.style.backgroundColor = 'var(--accent)'
      } else {
        handleBarRef.current.style.backgroundColor = ''
      }
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!touchStartY.current && !isDraggingRef.current) return
    const elapsed = Date.now() - touchStartTime.current
    const finalOffset = dragOffsetRef.current
    const velocity = finalOffset / (elapsed || 1)

    hasTriggeredSnapHaptic.current = false
    isDraggingRef.current = false
    touchStartY.current = 0

    if (finalOffset > 80 || (finalOffset > 30 && velocity > 0.45)) {
      setIsDismissedByDrag(true)
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in'
        sheetRef.current.style.transform = 'translate3d(0, 100%, 0)'
        sheetRef.current.style.opacity = '0'
      }
      onClose()
    } else if (finalOffset !== 0) {
      setIsDismissedByDrag(false)
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
        sheetRef.current.style.transform = 'translate3d(0, 0, 0)'
      }
      if (handleBarRef.current) {
        handleBarRef.current.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 150ms ease'
        handleBarRef.current.style.transform = 'scale3d(1, 1, 1)'
        handleBarRef.current.style.backgroundColor = ''
      }
      snapTimeoutRef.current = setTimeout(() => {
        dragOffsetRef.current = 0
        if (sheetRef.current) {
          sheetRef.current.style.transform = ''
          sheetRef.current.style.transition = ''
          sheetRef.current.style.opacity = ''
        }
        if (handleBarRef.current) {
          handleBarRef.current.style.transform = ''
          handleBarRef.current.style.transition = ''
        }
        snapTimeoutRef.current = null
      }, 200)
    } else {
      setIsDismissedByDrag(false)
      dragOffsetRef.current = 0
      if (sheetRef.current) {
        sheetRef.current.style.transform = ''
        sheetRef.current.style.transition = ''
        sheetRef.current.style.opacity = ''
      }
      if (handleBarRef.current) {
        handleBarRef.current.style.transform = ''
        handleBarRef.current.style.transition = ''
      }
    }
  }, [onClose])

  const handleTouchStart = useCallback((e) => {
    handleDragStart(e.touches?.[0]?.clientY ?? 0)
  }, [handleDragStart])

  const handleTouchMove = useCallback((e) => {
    handleDragMove(e.touches?.[0]?.clientY ?? 0)
  }, [handleDragMove])

  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    handleDragStart(e.clientY)

    const onMouseMove = (ev) => {
      handleDragMove(ev.clientY)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      handleDragEnd()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [handleDragStart, handleDragMove, handleDragEnd])

  if (!isOpen) return null

  const activeParent = activeTree?.find((p) => p.id === activeParentId)

  const handleAddParent = () => {
    if (!newParentName.trim()) return
    if (txType === 'expense') addExpenseParentCategory(newParentName.trim(), newParentName.trim())
    else addIncomeParentCategory(newParentName.trim(), newParentName.trim())
    setNewParentName('')
    onCategoryCustomChanged?.()
  }

  const handleAddSub = () => {
    if (!newSubName.trim() || !activeParent) return
    if (txType === 'expense') addExpenseSubcategory(activeParent.id, newSubName.trim(), newSubName.trim())
    else addIncomeSubcategory(activeParent.id, newSubName.trim(), newSubName.trim())
    setNewSubName('')
    onCategoryCustomChanged?.()
  }

  const handleConfirmDeleteSub = async () => {
    if (!deleteSubTarget) return
    await cascadeDeleteSubcategory(deleteSubTarget.parentId, deleteSubTarget.childId, txType)
    setDeleteSubTarget(null)
    onCategoryCustomChanged?.()
  }

  const handleSetColor = (parentId, tone) => {
    if (txType === 'expense') setExpenseCategoryColor(parentId, tone)
    else setIncomeCategoryColor(parentId, tone)
    onCategoryCustomChanged?.()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto" role="presentation">
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 transition-opacity duration-240 ease-out ${
          isEnter ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label={t('addTx.closeSheet', 'Tutup')}
        onClick={() => {
          triggerHaptic('light')
          onClose()
        }}
      />
      <div
        ref={sheetRef}
        className="relative flex max-h-[min(88vh,36rem)] w-full flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transform-gpu will-change-transform"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          transform: isDismissedByDrag
            ? 'translate3d(0, 100%, 0)'
            : (isEnter ? 'translate3d(0, 0, 0)' : 'translate3d(0, 100%, 0)'),
          transition: isDismissedByDrag
            ? 'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in'
            : 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)',
          opacity: isDismissedByDrag ? 0 : undefined,
          willChange: 'transform',
          contain: 'paint layout',
        }}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className="mx-auto mt-1 h-7 w-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div
            ref={handleBarRef}
            className="h-1.5 w-11 rounded-full bg-[var(--border-strong)]/60 transition-colors origin-center"
          />
        </div>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between gap-2 border-b border-[var(--border)]/70 px-4 py-2.5 cursor-grab select-none touch-none"
        >
          <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--fg)]">
            {txType === 'expense'
              ? editMode
                ? t('addTx.manageCategory', 'Kelola Kategori')
                : t('addTx.pickCategory', 'Pilih Kategori')
              : editMode
                ? t('addTx.manageIncomeCategory', 'Kelola Pemasukan')
                : t('addTx.categorySheetTitle', 'Pilih Kategori Pemasukan')}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)] active:scale-95 transition-all"
              aria-label={editMode ? t('addTx.doneEditing', 'Selesai') : t('common.edit', 'Edit')}
              onClick={() => {
                setEditMode((prev) => !prev)
                setNewSubName('')
                setNewParentName('')
              }}
            >
              {editMode ? (
                <span className="px-1 text-sm font-semibold text-[var(--accent)]">{t('addTx.doneEditing', 'Selesai')}</span>
              ) : (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)]"
              aria-label={t('addTx.closeSheet', 'Tutup')}
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-[220px] flex-1 divide-x divide-[var(--border)]">
          {/* Left pane: Main categories */}
          <div className="flex w-[min(46%,11rem)] shrink-0 flex-col justify-between">
            <ul className="ft-hide-scrollbar min-w-0 flex-1 overflow-y-auto py-1">
              {(activeTree || []).map((parent) => {
                const selected = activeParentId === parent.id
                const hasChildren = (parent.children || []).length > 0
                return (
                  <li key={parent.id} className="border-b border-[var(--border)]/30 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (!editMode && (!hasChildren || selected)) {
                          onSelectCategory(parent.id)
                          onClose()
                        } else {
                          setActiveParentId(parent.id)
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition border-l-[2.5px] ${
                        selected
                          ? 'bg-[color-mix(in_srgb,var(--fg)_7%,var(--field-bg))] text-[var(--fg)] font-semibold border-l-[var(--fg)]/80'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)] border-l-transparent'
                      }`}
                    >
                      <CategoryIcon icon={resolveParentIcon(parent.id)} className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 leading-snug truncate">{parent.names?.[lang] || parent.id}</span>
                      {hasChildren || editMode ? <span className="shrink-0 text-[var(--muted)]">›</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            {editMode ? (
              <div className="border-t border-[var(--border)]/70 p-2 bg-[var(--field-bg)]/40">
                <input
                  type="text"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddParent()
                    }
                  }}
                  placeholder={lang === 'id' ? '+ Kategori Utama' : '+ Main Category'}
                  className="ft-field w-full text-xs px-2 py-1 mb-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full text-xs py-1"
                  onClick={handleAddParent}
                >
                  {lang === 'id' ? 'Tambah Utama' : 'Add Main'}
                </Button>
              </div>
            ) : null}
          </div>

          {/* Right pane: Subcategories */}
          {!activeParent ? (
            <div className="flex min-h-[220px] min-w-0 flex-1 flex-col items-center justify-center p-6 text-center text-[var(--muted)] animate-[ft-fade-up_0.25s_ease-out]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] mb-3 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[var(--fg)] mb-1">{lang === 'id' ? 'Pilih Kategori Utama' : 'Select Main Category'}</p>
              <p className="text-xs text-[var(--muted)] max-w-[180px] leading-relaxed">{lang === 'id' ? 'Klik salah satu kategori di sebelah kiri untuk melihat daftar subkategori.' : 'Click a category on the left to view its subcategories.'}</p>
            </div>
          ) : editMode ? (
            <div className="flex min-h-[220px] min-w-0 flex-1 flex-col">
              <div className="border-b border-[var(--border)]/70 p-3 bg-[var(--field-bg)]/30">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-[var(--fg)]">
                    {lang === 'id' ? `Pilihan Warna (${activeParent.names?.[lang] || activeParent.id})` : `Color Option (${activeParent.names?.[lang] || activeParent.id})`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {COLOR_TONES.map((tone) => {
                    const activeTone = getEffectiveTone(activeParent.id)
                    const active = activeTone === tone
                    return (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => handleSetColor(activeParent.id, tone)}
                        className={`h-6 w-6 rounded-full transition ${getCategoryToneClass(tone)} ${
                          active
                            ? 'scale-105 ring-2 ring-[var(--fg)]/80 ring-offset-2 ring-offset-[var(--panel)] shadow-2xs'
                            : 'border border-[var(--border)] opacity-80 hover:opacity-100'
                        }`}
                        title={tone}
                      />
                    )
                  })}
                </div>
              </div>
              <ul className="ft-hide-scrollbar min-w-0 flex-1 overflow-y-auto py-1">
                {(activeParent.children || []).length === 0 ? (
                  <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{t('addTx.emptySubs', 'Belum ada subkategori')}</li>
                ) : (
                  (activeParent.children || []).map((child) => (
                    <li
                      key={child.id}
                      className="flex items-center gap-2 border-b border-[var(--border)]/40 px-3 py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 text-left text-[13px] font-medium text-[var(--fg)]">
                        {child.names?.[lang] || child.id}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer"
                        aria-label={t('common.delete', 'Hapus')}
                        onClick={() =>
                          setDeleteSubTarget({
                            parentId: activeParent.id,
                            childId: child.id,
                            childName: child.names?.[lang] || child.id,
                          })
                        }
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="shrink-0 border-t border-[var(--border)]/70 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSub()
                      }
                    }}
                    placeholder={t('addTx.subNamePlaceholder', 'Nama subkategori...')}
                    className="ft-field min-w-0 flex-1 text-sm py-1.5 px-3"
                  />
                  <Button
                    type="button"
                    className="shrink-0"
                    onClick={handleAddSub}
                  >
                    {t('addTx.addSub', 'Tambah')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[220px] min-w-0 flex-1 flex-col">
              <ul key={activeParent?.id} className="ft-hide-scrollbar flex-1 overflow-y-auto py-1 px-1.5 ft-swush-in">
                {(activeParent?.children || []).length === 0 ? (
                  <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{t('addTx.emptySubs', 'Belum ada subkategori')}</li>
                ) : (
                  activeParent?.children?.map((child) => {
                    const path = `${activeParent.id}/${child.id}`
                    const picked = selectedCategory === path
                    return (
                      <li key={child.id} className="py-1 border-b border-[var(--border)]/35 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection')
                            onSelectCategory(path)
                            onClose()
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-[13px] transition active:scale-[0.98] ${
                            picked
                              ? 'border border-[var(--fg)]/60 bg-[color-mix(in_srgb,var(--fg)_6%,var(--field-bg))] font-semibold text-[var(--fg)] shadow-2xs'
                              : 'border border-transparent hover:bg-[var(--field-bg)] font-medium text-[var(--fg)]'
                          }`}
                        >
                          <span className="min-w-0 flex-1">{child.names?.[lang] || child.id}</span>
                          {picked && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                          )}
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(deleteSubTarget)}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={handleConfirmDeleteSub}
        title={t('settings.deleteSubcategory', 'Hapus Subkategori')}
        message={t(
          'settings.deleteSubConfirm',
          `Apakah Anda yakin ingin menghapus subkategori "${deleteSubTarget?.childName}"? Riwayat transaksi akan dialihkan ke kategori umum.`,
          { name: deleteSubTarget?.childName },
        )}
        confirmText={t('common.delete', 'Hapus')}
        zIndex="z-[110]"
      />
    </div>,
    document.body
  )
}
