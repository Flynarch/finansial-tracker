import { useState, useMemo, useEffect } from 'react'
import Modal from '../ui/Modal'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'
import Button from '../ui/Button'
import CategoryIcon from '../ui/CategoryIcon'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import { resolveExpenseParentIconKey, resolveIncomeParentIconKey } from '../../lib/categoryIcon'
import {
  addExpenseSubcategory,
  getMergedExpenseTree,
  isBuiltinExpenseChild,
  updateExpenseCategoryName,
  EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT,
} from '../../lib/expenseCategories'
import {
  addIncomeSubcategory,
  getMergedIncomeTree,
  isBuiltinIncomeChild,
  updateIncomeCategoryName,
  INCOME_CATEGORY_CUSTOM_CHANGED_EVENT,
} from '../../lib/incomeCategories'
import {
  cascadeDeleteParentCategory,
  cascadeDeleteSubcategory,
} from '../../lib/categoryCleanup'

export default function CategoryPickerModal({ isOpen, onClose, txType = 'expense', selectedCategory, onSelectCategory }) {
  const { locale, t } = useTranslation()
  const lang = locale === 'en' ? 'en' : 'id'

  const [categoryVersion, setCategoryVersion] = useState(0)
  const [expenseParentId, setExpenseParentId] = useState(null)
  const [incomeParentId, setIncomeParentId] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  const [renameParentVal, setRenameParentVal] = useState('')

  const [prevOpen, setPrevOpen] = useState(isOpen)
  const [prevTxType, setPrevTxType] = useState(txType)
  const [prevSelectedCategory, setPrevSelectedCategory] = useState(selectedCategory)

  if (prevOpen !== isOpen || prevTxType !== txType || prevSelectedCategory !== selectedCategory) {
    setPrevOpen(isOpen)
    setPrevTxType(txType)
    setPrevSelectedCategory(selectedCategory)
    if (isOpen) {
      setEditMode(false)
      setNewSubName('')
      if (txType === 'expense' && selectedCategory && typeof selectedCategory === 'string' && selectedCategory.trim()) {
        const [pid] = String(selectedCategory).split('/')
        if (pid) setExpenseParentId(pid)
        else setExpenseParentId(null)
      } else {
        setExpenseParentId(null)
      }
      if (txType === 'income' && selectedCategory && typeof selectedCategory === 'string' && selectedCategory.trim()) {
        const [pid] = String(selectedCategory).split('/')
        if (pid) setIncomeParentId(pid)
        else setIncomeParentId(null)
      } else {
        setIncomeParentId(null)
      }
    }
  }

  useBackButton(() => {
    if (editMode) {
      setEditMode(false)
    } else if (txType === 'expense' && expenseParentId) {
      setExpenseParentId(null)
    } else if (txType === 'income' && incomeParentId) {
      setIncomeParentId(null)
    } else {
      onClose?.()
    }
  }, Boolean(isOpen))

  useEffect(() => {
    const handleChanged = () => setCategoryVersion((v) => v + 1)
    window.addEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, handleChanged)
    window.addEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, handleChanged)
    return () => {
      window.removeEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, handleChanged)
      window.removeEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, handleChanged)
    }
  }, [])

  const mergedExpenseTree = useMemo(() => {
    void categoryVersion
    return getMergedExpenseTree()
  }, [categoryVersion])

  const mergedIncomeTree = useMemo(() => {
    void categoryVersion
    return getMergedIncomeTree()
  }, [categoryVersion])

  const activeTree = txType === 'expense' ? mergedExpenseTree : mergedIncomeTree
  const activeParentId = txType === 'expense' ? expenseParentId : incomeParentId
  const setActiveParentId = txType === 'expense' ? setExpenseParentId : setIncomeParentId
  const resolveParentIcon = txType === 'expense' ? resolveExpenseParentIconKey : resolveIncomeParentIconKey
  const isBuiltinChild = txType === 'expense' ? isBuiltinExpenseChild : isBuiltinIncomeChild

  const activeParent = useMemo(() => {
    return activeTree.find((p) => p.id === activeParentId) || null
  }, [activeTree, activeParentId])

  const [prevActiveParent, setPrevActiveParent] = useState(activeParent)
  const [prevLang, setPrevLang] = useState(lang)
  if (prevActiveParent !== activeParent || prevLang !== lang) {
    setPrevActiveParent(activeParent)
    setPrevLang(lang)
    if (activeParent) {
      setRenameParentVal(activeParent.names[lang] || '')
    }
  }

  const handleAddSub = () => {
    if (!activeParent) return
    const name = newSubName.trim()
    if (!name) return
    if (txType === 'expense') addExpenseSubcategory(activeParent.id, name, name)
    else addIncomeSubcategory(activeParent.id, name, name)
    setNewSubName('')
  }

  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleRemoveSub = (childId) => {
    if (!activeParent) return
    const isBuiltin = isBuiltinChild(activeParent.id, childId)
    const msg = isBuiltin
      ? t('addTx.confirmHideBuiltin') || 'Sembunyikan subkategori ini?'
      : t('addTx.confirmRemoveCustom') || 'Hapus subkategori ini?'
    setDeleteTarget({
      type: 'sub',
      parentId: activeParent.id,
      childId,
      title: isBuiltin ? 'Sembunyikan Subkategori' : 'Hapus Subkategori',
      message: msg,
    })
  }



  const handleRemoveParent = (parentId) => {
    const msg = t('addTx.confirmRemoveCustom') || 'Hapus kategori utama ini?'
    setDeleteTarget({
      type: 'parent',
      parentId,
      title: 'Hapus Kategori Utama',
      message: msg,
    })
  }

  const confirmDeleteCategory = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'sub') {
      await cascadeDeleteSubcategory(deleteTarget.parentId, deleteTarget.childId, txType)
    } else if (deleteTarget.type === 'parent') {
      await cascadeDeleteParentCategory(deleteTarget.parentId, txType)
      if (activeParentId === deleteTarget.parentId) setActiveParentId(null)
    }
    setCategoryVersion((v) => v + 1)
    setDeleteTarget(null)
  }

  const handleRenameParent = () => {
    if (!activeParent || !renameParentVal.trim()) return
    if (txType === 'expense') updateExpenseCategoryName(activeParent.id, null, renameParentVal.trim(), renameParentVal.trim())
    else updateIncomeCategoryName(activeParent.id, null, renameParentVal.trim(), renameParentVal.trim())
  }

  return (
    <Modal
      isOpen={isOpen}
      title={
        txType === 'expense'
          ? lang === 'id'
            ? 'Kategori Pengeluaran'
            : 'Expense Category'
          : lang === 'id'
          ? 'Kategori Pemasukan'
          : 'Income Category'
      }
      enableBackButton={false}
      onClose={onClose}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 bg-[var(--field-bg)]/40">
        <span className="text-xs font-bold text-[var(--muted)]">
          {editMode
            ? lang === 'id'
              ? 'Mode Kelola Kategori'
              : 'Manage Category Mode'
            : lang === 'id'
            ? 'Pilih Kategori'
            : 'Select Category'}
        </span>
        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            editMode
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)]'
          }`}
        >
          {editMode
            ? lang === 'id'
              ? 'Selesai'
              : 'Done'
            : lang === 'id'
            ? 'Kelola'
            : 'Manage'}
        </button>
      </div>

      <div className="max-h-[70vh] min-h-[320px] overflow-hidden flex flex-col">
        <div className="flex flex-1 divide-x divide-[var(--border)] overflow-hidden">
          {/* Left pane: Main categories */}
          <div className="flex w-[min(46%,12rem)] shrink-0 flex-col justify-between overflow-hidden">
            <ul className="ft-hide-scrollbar min-w-0 flex-1 overflow-y-auto py-1">
              {activeTree.map((parent) => {
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
                      onDoubleClick={() => {
                        if (!editMode) {
                          onSelectCategory(parent.id)
                          onClose()
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition border-l-[2.5px] ${
                        selected
                          ? 'bg-[color-mix(in_srgb,var(--fg)_7%,var(--field-bg))] text-[var(--fg)] font-semibold border-l-[var(--fg)]/80'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)] border-l-transparent'
                      }`}
                    >
                      <CategoryIcon icon={resolveParentIcon(parent.id)} className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 leading-snug truncate">{parent.names[lang]}</span>
                      {hasChildren || editMode ? <span className="shrink-0 text-[var(--muted)]">›</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            {editMode ? (
              <div className="border-t border-[var(--border)]/70 p-2 bg-[var(--field-bg)]/40 text-[10px] text-[var(--muted)] text-center">
                <span>{lang === 'id' ? 'Pilih kategori utama di atas untuk mengelola subkategori' : 'Select a main category above to manage subcategories'}</span>
              </div>
            ) : null}
          </div>

          {/* Right pane: Subcategories & Options */}
          {!activeParent ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-[var(--muted)] animate-[ft-fade-up_0.25s_ease-out]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] mb-3 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[var(--fg)] mb-1">{lang === 'id' ? 'Pilih Kategori Utama' : 'Select Main Category'}</p>
              <p className="text-xs text-[var(--muted)] max-w-[180px] leading-relaxed">{lang === 'id' ? 'Klik salah satu kategori di sebelah kiri untuk melihat daftar subkategori.' : 'Click a category on the left to view its subcategories.'}</p>
            </div>
          ) : editMode ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="border-b border-[var(--border)]/70 p-3 bg-[var(--field-bg)]/30">
                <div className="mb-2">
                  <span className="text-xs font-bold text-[var(--fg)] block mb-1">
                    {lang === 'id' ? `Edit Nama Kategori (${activeParent.names[lang]})` : `Rename Category (${activeParent.names[lang]})`}
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={renameParentVal}
                      onChange={(e) => setRenameParentVal(e.target.value)}
                      placeholder={lang === 'id' ? 'Nama baru...' : 'New name...'}
                      className="ft-field flex-1 text-xs px-2 py-1"
                    />
                    <Button type="button" size="sm" className="text-xs py-1 px-2.5 shrink-0" onClick={handleRenameParent}>
                      {lang === 'id' ? 'Simpan' : 'Save'}
                    </Button>
                  </div>
                </div>
                {!activeTree.some((x) => x.id === activeParent.id && x.children?.length > 0 && isBuiltinChild(activeParent.id, x.children[0].id)) ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="w-full text-xs py-1 mt-1"
                    onClick={() => handleRemoveParent(activeParent.id)}
                  >
                    {lang === 'id' ? 'Hapus Kategori Utama Ini' : 'Delete Main Category'}
                  </Button>
                ) : null}
              </div>

              <div className="p-3 flex-1 overflow-y-auto">
                <span className="text-xs font-bold text-[var(--muted)] block mb-2">{lang === 'id' ? 'Daftar Subkategori' : 'Subcategories'}</span>
                <ul className="space-y-1.5">
                  {(activeParent.children || []).map((child) => {
                    const isBuiltin = isBuiltinChild(activeParent.id, child.id)
                    return (
                      <li key={child.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--field-bg)]/50">
                        <span className="text-xs font-medium text-[var(--fg)]">{child.names[lang]}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSub(child.id)}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-600 px-2 py-0.5 rounded border border-rose-500/30 hover:bg-rose-500/10 transition"
                        >
                          {isBuiltin ? (lang === 'id' ? 'Sembunyikan' : 'Hide') : (lang === 'id' ? 'Hapus' : 'Delete')}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="border-t border-[var(--border)]/70 p-3 bg-[var(--field-bg)]/30">
                <span className="text-xs font-bold text-[var(--muted)] block mb-1.5">{lang === 'id' ? '+ Tambah Subkategori' : '+ Add Subcategory'}</span>
                <div className="flex gap-1.5">
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
                    placeholder={t('addTx.subNamePlaceholder') || 'Nama subkategori baru'}
                    className="ft-field min-w-0 flex-1 text-sm py-1.5 px-3"
                  />
                  <Button type="button" className="shrink-0" onClick={handleAddSub}>
                    {t('addTx.addSub') || 'Tambah'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <ul key={activeParent?.id} className="ft-hide-scrollbar flex-1 overflow-y-auto py-1 px-1.5 ft-swush-in">
                {(activeParent?.children || []).length === 0 ? (
                  <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{t('addTx.emptySubs') || 'Belum ada subkategori'}</li>
                ) : (
                  activeParent?.children.map((child) => {
                    const path = `${activeParent.id}/${child.id}`
                    const picked = selectedCategory === path
                    return (
                      <li key={child.id} className="py-1 border-b border-[var(--border)]/35 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCategory(path)
                            onClose()
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left transition ${
                            picked
                              ? 'border border-[var(--fg)]/60 bg-[color-mix(in_srgb,var(--fg)_6%,var(--field-bg))] font-semibold text-[var(--fg)] shadow-2xs'
                              : 'border border-transparent hover:bg-[var(--field-bg)] font-medium text-[var(--fg)]'
                          }`}
                        >
                          <span className="min-w-0 flex-1 text-[13px]">{child.names[lang]}</span>
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
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteCategory}
        title={deleteTarget?.title || 'Hapus Kategori'}
        message={deleteTarget?.message || 'Apakah Anda yakin?'}
      />
    </Modal>
  )
}
