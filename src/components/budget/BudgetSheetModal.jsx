import { format } from 'date-fns'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Button from '../ui/Button'
import CategoryIcon from '../ui/CategoryIcon'
import BottomSheet from '../ui/BottomSheet'
import MonthPicker from '../ui/MonthPicker'
import ToastBanner from '../ui/ToastBanner'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { resolveExpenseParentIconKey } from '../../lib/categoryIcon'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import { formatGroupedIntegerInput, getMoneyInputCaret, toSafeNumber } from '../../lib/utils'
import { getMergedExpenseTree, parseExpenseCategoryPath } from '../../lib/expenseCategories'

const BudgetChildCategoryItem = memo(function BudgetChildCategoryItem({
  child,
  parentId,
  active,
  lang,
  onSelectChild,
}) {
  const path = `${parentId}/${child.id}`
  return (
    <button
      type="button"
      onClick={() => onSelectChild(path)}
      className={`flex min-h-[44px] w-full items-center gap-2 border-b border-[var(--border)]/30 px-3 text-left text-xs font-medium transition last:border-b-0 cursor-pointer active:scale-[0.99] ${
        active
          ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--fg)]'
          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{child?.names?.[lang] || child?.id || ''}</span>
      {active ? <Check size={14} className="text-[var(--accent)] shrink-0" /> : null}
    </button>
  )
}, function areChildPropsEqual(prev, next) {
  return (
    prev.child.id === next.child.id &&
    prev.parentId === next.parentId &&
    prev.active === next.active &&
    prev.lang === next.lang &&
    prev.onSelectChild === next.onSelectChild
  )
})

const BudgetParentCategoryItem = memo(function BudgetParentCategoryItem({
  parent,
  expanded,
  activeMain,
  hasSub,
  lang,
  currentCategoryPath,
  onSelectParent,
  onToggleExpand,
  onSelectChild,
  t,
}) {
  return (
    <li className="border-b border-[var(--border)]/40 last:border-b-0">
      <div
        className={`flex h-[44px] w-full items-stretch text-[13px] font-semibold transition ${
          expanded || activeMain
            ? 'bg-[color-mix(in_srgb,var(--accent)_10%,var(--field-bg))] text-[var(--fg)]'
            : 'text-[var(--fg)] hover:bg-[var(--panel)]'
        }`}
      >
        <button
          type="button"
          className="flex w-[80%] items-center gap-2 px-3 text-left"
          onClick={() => onSelectParent(parent.id)}
        >
          <CategoryIcon icon={resolveExpenseParentIconKey(parent.id)} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{parent?.names?.[lang] || parent?.id || ''}</span>
        </button>

        <button
          type="button"
          className="flex w-[20%] items-center justify-center border-l border-[var(--border)]/40 text-[var(--muted)] cursor-pointer active:scale-90"
          onClick={() => onToggleExpand(parent.id)}
          aria-label={expanded ? t('budget.subCategory.close') : t('budget.subCategory.open')}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {expanded && hasSub ? (
        <div className="px-2 pb-2 pt-1 animate-sub-in">
          <div className="overflow-hidden rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/40">
            {(parent.children || []).map((child) => {
              const path = `${parent.id}/${child.id}`
              const active = currentCategoryPath === path
              return (
                <BudgetChildCategoryItem
                  key={child.id}
                  child={child}
                  parentId={parent.id}
                  active={active}
                  lang={lang}
                  onSelectChild={onSelectChild}
                />
              )
            })}
          </div>
        </div>
      ) : null}
    </li>
  )
}, function areParentPropsEqual(prev, next) {
  if (prev.parent.id !== next.parent.id) return false
  if (prev.expanded !== next.expanded) return false
  if (prev.activeMain !== next.activeMain) return false
  if (prev.hasSub !== next.hasSub) return false
  if (prev.lang !== next.lang) return false
  if (prev.onSelectParent !== next.onSelectParent) return false
  if (prev.onToggleExpand !== next.onToggleExpand) return false
  if (prev.onSelectChild !== next.onSelectChild) return false

  if (prev.expanded || prev.activeMain || next.activeMain) {
    return prev.currentCategoryPath === next.currentCategoryPath
  }

  const prevInParent = String(prev.currentCategoryPath || '').startsWith(`${prev.parent.id}/`)
  const nextInParent = String(next.currentCategoryPath || '').startsWith(`${next.parent.id}/`)
  if (prevInParent || nextInParent) {
    return prev.currentCategoryPath === next.currentCategoryPath
  }

  return true
})

export default function BudgetSheetModal({
  isOpen,
  onClose,
  editingBudget = null,
  initialMonth,
  month,
  initialCategory = '',
  onSaved,
  onDelete,
}) {
  const { locale, t } = useTranslation()
  const [sheetError, setSheetError] = useState('')
  const [expandedParentId, setExpandedParentId] = useState(null)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const limitInputRef = useRef(null)

  const tree = useMemo(() => getMergedExpenseTree(), [])
  const lang = locale === 'en' ? 'en' : 'id'

  const effectiveMonth = month || initialMonth || format(new Date(), 'yyyy-MM')

  const [form, setForm] = useState({
    month: effectiveMonth,
    categoryPath: initialCategory || '',
    limit: '',
  })
  const [limitInput, setLimitInput] = useState('')

  const selectedParentId = useMemo(() => {
    const raw = String(form.categoryPath || '')
    if (!raw) return ''
    if (raw.includes('/')) return raw.split('/')[0]
    return raw
  }, [form.categoryPath])

  const parsedCategoryPath = useMemo(() => {
    if (!form.categoryPath) return null
    return parseExpenseCategoryPath(form.categoryPath)
  }, [form.categoryPath])

  const handleSelectParent = useCallback((parentId) => {
    setForm((p) => ({ ...p, categoryPath: parentId }))
    setExpandedParentId(null)
    setIsCategoryOpen(false)
  }, [])

  const handleToggleExpand = useCallback((parentId) => {
    setExpandedParentId((prev) => (prev === parentId ? null : parentId))
  }, [])

  const handleSelectChild = useCallback((path) => {
    setForm((p) => ({ ...p, categoryPath: path }))
    setIsCategoryOpen(false)
  }, [])

  const [prevOpen, setPrevOpen] = useState(isOpen)
  const [prevEditingBudget, setPrevEditingBudget] = useState(editingBudget)

  if (prevOpen !== isOpen || prevEditingBudget !== editingBudget) {
    setPrevOpen(isOpen)
    setPrevEditingBudget(editingBudget)
    if (isOpen) {
      setSheetError('')
      if (editingBudget) {
        setForm({
          month: editingBudget.month,
          categoryPath: String(editingBudget.category || ''),
          limit: String(editingBudget.limit ?? ''),
        })
        setLimitInput(formatGroupedIntegerInput(editingBudget.limit ?? ''))
        const raw = String(editingBudget.category || '')
        setExpandedParentId(raw.includes('/') ? raw.split('/')[0] : raw || null)
      } else {
        const defaultMonth = month || initialMonth || format(new Date(), 'yyyy-MM')
        const safeInitialCat = typeof initialCategory === 'string' ? initialCategory : ''
        setForm({
          month: defaultMonth,
          categoryPath: safeInitialCat,
          limit: '',
        })
        setLimitInput('')
        setExpandedParentId(safeInitialCat ? (safeInitialCat.includes('/') ? safeInitialCat.split('/')[0] : safeInitialCat) : null)
      }
      setIsCategoryOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !isCategoryOpen) return undefined
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('[data-budget-category]')) return
      setIsCategoryOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen, isCategoryOpen])

  const save = async () => {
    const payload = {
      month: form.month,
      category: String(form.categoryPath || '').trim(),
      limit: toSafeNumber(form.limit),
    }
    if (!payload.category) {
      setSheetError(t('budget.validation.category'))
      return
    }
    if (!payload.month || payload.limit <= 0) {
      setSheetError(t('budget.validation.limit'))
      return
    }
    try {
      setSheetError('')
      if (editingBudget?.id) {
        await db.budgets.update(editingBudget.id, payload)
      } else {
        // Upsert if budget for this month and category already exists
        const existing = await db.budgets
          .where('month')
          .equals(payload.month)
          .and((b) => b.category === payload.category)
          .first()
        if (existing) {
          await db.budgets.update(existing.id, { limit: payload.limit })
        } else {
          await db.budgets.add(payload)
        }
      }
      onSaved?.()
      onClose()
    } catch (err){
      console.warn('[BudgetSheetModal]', err)
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      setSheetError(offline ? t('common.error.offline') : t('common.error.saveFailed'))
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingBudget ? t('budget.sheet.editTitle', 'Edit Anggaran') : t('budget.sheet.addTitle', 'Tambah Anggaran')}
    >
      {sheetError ? <ToastBanner message={sheetError} /> : null}

      <div className="grid gap-3">
        <label className="ft-label text-xs">
          {t('budget.month')}
          <MonthPicker
            value={form.month}
            onChange={(val) => setForm((p) => ({ ...p, month: val }))}
            className="mt-1"
          />
        </label>

        <label className="ft-label text-xs">
          {t('budget.category')}
          <div
            className="mt-1 overflow-hidden rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)]"
            data-budget-category
          >
            <button
              type="button"
              onClick={() => setIsCategoryOpen((v) => !v)}
              className="flex h-11 w-full items-center justify-between gap-3 px-3 text-left"
              aria-expanded={isCategoryOpen}
            >
              <span className="text-[13px] font-medium text-[var(--fg)]">
                {(() => {
                  if (!form.categoryPath) return t('budget.category.placeholder')
                  if (parsedCategoryPath) {
                    const parentName = parsedCategoryPath.parent?.names?.[lang] || parsedCategoryPath.parent?.id || ''
                    const childName = parsedCategoryPath.child?.names?.[lang] || parsedCategoryPath.child?.id || ''
                    return childName ? `${parentName} · ${childName}` : parentName
                  }
                  return String(form.categoryPath || '').trim()
                })()}
              </span>
              <span className="text-[var(--muted)]">
                {isCategoryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            {isCategoryOpen ? (
              <div className="border-t border-[var(--border)]/40 animate-collapse-in">
                <ul
                  className="ft-hide-scrollbar max-h-[420px] min-w-0 overflow-y-auto"
                  style={{ touchAction: 'pan-y' }}
                >
                  {tree.map((parent) => {
                    const expanded = expandedParentId === parent.id
                    const activeMain = selectedParentId === parent.id && !String(form.categoryPath || '').includes('/')
                    const hasSub = (parent.children || []).length > 0

                    return (
                      <BudgetParentCategoryItem
                        key={parent.id}
                        parent={parent}
                        expanded={expanded}
                        activeMain={activeMain}
                        hasSub={hasSub}
                        lang={lang}
                        currentCategoryPath={form.categoryPath}
                        onSelectParent={handleSelectParent}
                        onToggleExpand={handleToggleExpand}
                        onSelectChild={handleSelectChild}
                        t={t}
                      />
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </label>

        <label className="ft-label text-xs">
          {t('budget.limit')}
          <input
            ref={limitInputRef}
            type="text"
            inputMode="numeric"
            value={limitInput}
            onChange={(e) => {
              const rawValue = e.target.value
              const formatted = formatGroupedIntegerInput(rawValue)
              const caret = getMoneyInputCaret(rawValue, formatted, e.target.selectionStart)
              const numericOnly = formatted.replace(/[^0-9]/g, '')
              setForm((p) => ({ ...p, limit: numericOnly }))
              setLimitInput(formatted)
              window.requestAnimationFrame(() => {
                const el = limitInputRef.current
                if (!el) return
                el.setSelectionRange(caret, caret)
              })
            }}
            className="ft-field mt-1 w-full font-semibold tabular-nums"
            placeholder={t('budget.limit.placeholder')}
          />
        </label>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]/40 mt-1">
          {editingBudget && onDelete ? (
            <button
              type="button"
              className="min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
              onClick={() => onDelete(editingBudget)}
            >
              {t('budget.delete', 'Hapus')}
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="min-h-[40px] px-4 py-2 text-xs font-bold active:scale-95 transition-all cursor-pointer"
              onClick={onClose}
            >
              {t('budget.cancel', 'Batal')}
            </Button>
            <Button
              type="button"
              onClick={save}
              className="min-h-[40px] px-5 py-2 text-xs font-bold active:scale-95 transition-all cursor-pointer"
              disabled={!String(form.categoryPath || '').trim() || !String(form.month || '').trim() || toSafeNumber(form.limit) <= 0}
            >
              {t('budget.save', 'Simpan')}
            </Button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
