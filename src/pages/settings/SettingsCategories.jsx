import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Tag,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  FolderOpen,
  Plus,
  Pencil,
  Sparkles,
  Search,
  Check,
  Palette,
} from 'lucide-react'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import Modal from '../../components/ui/Modal'
import {
  getMergedExpenseTree,
  addExpenseParentCategory,
  updateExpenseCategoryName,
  setExpenseCategoryColor,
  setExpenseCategoryIcon,
  addExpenseSubcategory,
  resetExpenseCategoryCustomizations,
  EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT,
} from '../../lib/expenseCategories'
import {
  getMergedIncomeTree,
  addIncomeParentCategory,
  updateIncomeCategoryName,
  setIncomeCategoryColor,
  setIncomeCategoryIcon,
  addIncomeSubcategory,
  resetIncomeCategoryCustomizations,
  INCOME_CATEGORY_CUSTOM_CHANGED_EVENT,
} from '../../lib/incomeCategories'
import {
  cascadeDeleteParentCategory,
  cascadeDeleteSubcategory,
} from '../../lib/categoryCleanup'
import {
  resolveTransactionIconKey,
  autoDetectCategoryIcon,
  getCategoryToneClass,
  AVAILABLE_CATEGORY_ICONS,
} from '../../lib/categoryIcon'
import CategoryIcon from '../../components/ui/CategoryIcon'
import useTranslation from '../../hooks/useTranslation'
import {
  SettingsSection,
  SettingsSegmentControl,
  SettingsSearchInput,
} from './settingsComponents'

const COLOR_TONES = [
  { id: 'emerald', bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', ring: 'ring-emerald-500', name: 'Hijau' },
  { id: 'teal', bg: 'bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30', ring: 'ring-teal-500', name: 'Toska' },
  { id: 'cyan', bg: 'bg-cyan-500/15', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30', ring: 'ring-cyan-500', name: 'Sian' },
  { id: 'sky', bg: 'bg-sky-500/15', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/30', ring: 'ring-sky-500', name: 'Langit' },
  { id: 'blue', bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', ring: 'ring-blue-500', name: 'Biru' },
  { id: 'indigo', bg: 'bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30', ring: 'ring-indigo-500', name: 'Indigo' },
  { id: 'violet', bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30', ring: 'ring-violet-500', name: 'Violet' },
  { id: 'purple', bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', ring: 'ring-purple-500', name: 'Ungu' },
  { id: 'fuchsia', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-500/30', ring: 'ring-fuchsia-500', name: 'Fuchsia' },
  { id: 'pink', bg: 'bg-pink-500/15', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/30', ring: 'ring-pink-500', name: 'Merah Muda' },
  { id: 'rose', bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', ring: 'ring-rose-500', name: 'Mawar' },
  { id: 'amber', bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', ring: 'ring-amber-500', name: 'Emas' },
  { id: 'orange', bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30', ring: 'ring-orange-500', name: 'Oranye' },
  { id: 'yellow', bg: 'bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/30', ring: 'ring-yellow-500', name: 'Kuning' },
  { id: 'lime', bg: 'bg-lime-500/15', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/30', ring: 'ring-lime-500', name: 'Limau' },
  { id: 'slate', bg: 'bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30', ring: 'ring-slate-500', name: 'Netral' },
]

export default function SettingsCategories() {
  const { t, locale } = useTranslation()
  const [activeTab, setActiveTab] = useState('expense')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmResetType, setConfirmResetType] = useState(null)
  const [customVersion, setCustomVersion] = useState(0)

  // Modals state
  // 1. Add Parent Category Modal
  const [addParentModal, setAddParentModal] = useState(false)
  const [parentNameId, setParentNameId] = useState('')
  const [parentNameEn, setParentNameEn] = useState('')
  const [parentIcon, setParentIcon] = useState('food')
  const [parentTone, setParentTone] = useState('emerald')
  const [isParentIconManuallySet, setIsParentIconManuallySet] = useState(false)

  // 2. Edit Parent Category Modal
  const [editParentModal, setEditParentModal] = useState(null)
  const [editParentNameId, setEditParentNameId] = useState('')
  const [editParentNameEn, setEditParentNameEn] = useState('')
  const [editParentIcon, setEditParentIcon] = useState('food')
  const [editParentTone, setEditParentTone] = useState('emerald')

  // 3. Add Subcategory Modal
  const [addSubModal, setAddSubModal] = useState({ isOpen: false, parentId: null, parentName: '', parentIcon: 'food' })
  const [subNameId, setSubNameId] = useState('')
  const [subNameEn, setSubNameEn] = useState('')

  // 4. Edit Subcategory Modal
  const [editSubModal, setEditSubModal] = useState(null)
  const [editSubNameId, setEditSubNameId] = useState('')
  const [editSubNameEn, setEditSubNameEn] = useState('')

  // 5. Delete Confirmation Modals
  const [deleteSubTarget, setDeleteSubTarget] = useState(null)
  const [deleteParentTarget, setDeleteParentTarget] = useState(null)

  // 6. Icon Picker Modal
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [iconPickerTarget, setIconPickerTarget] = useState('add_parent')
  const [iconSearchQuery, setIconSearchQuery] = useState('')

  const bumpVersion = useCallback(() => setCustomVersion((v) => v + 1), [])

  useEffect(() => {
    const handleCustomChange = () => bumpVersion()
    window.addEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, handleCustomChange)
    window.addEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, handleCustomChange)
    return () => {
      window.removeEventListener(EXPENSE_CATEGORY_CUSTOM_CHANGED_EVENT, handleCustomChange)
      window.removeEventListener(INCOME_CATEGORY_CUSTOM_CHANGED_EVENT, handleCustomChange)
    }
  }, [bumpVersion])

  const expenseTree = useMemo(() => {
    void customVersion
    return getMergedExpenseTree()
  }, [customVersion])

  const incomeTree = useMemo(() => {
    void customVersion
    return getMergedIncomeTree()
  }, [customVersion])

  const currentTree = activeTab === 'expense' ? expenseTree : incomeTree

  const tabOptions = useMemo(
    () => [
      {
        value: 'expense',
        label: `${t('common.expense', 'Pengeluaran')} (${expenseTree.length})`,
        icon: TrendingDown,
      },
      {
        value: 'income',
        label: `${t('common.income', 'Pemasukan')} (${incomeTree.length})`,
        icon: TrendingUp,
      },
    ],
    [t, expenseTree.length, incomeTree.length],
  )

  // Filter categories by search query
  const filteredTree = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return currentTree

    return currentTree.filter((cat) => {
      const catName = (cat.names?.[locale] || cat.names?.id || cat.id).toLowerCase()
      if (catName.includes(query)) return true
      const hasMatchingSub = (cat.children || []).some((sub) => {
        const subName = (sub.names?.[locale] || sub.names?.id || sub.id).toLowerCase()
        return subName.includes(query)
      })
      return hasMatchingSub
    })
  }, [currentTree, searchQuery, locale])

  // Real-time auto-icon generator when user types parent category name
  const handleParentNameChange = (value) => {
    setParentNameId(value)
    if (!isParentIconManuallySet) {
      const detected = autoDetectCategoryIcon(value, activeTab)
      setParentIcon(detected)
    }
  }

  // Open Add Parent Category Modal
  const openAddParent = () => {
    setParentNameId('')
    setParentNameEn('')
    const defaultIcon = activeTab === 'income' ? 'income' : 'food'
    setParentIcon(defaultIcon)
    const currentListLength = (activeTab === 'income' ? incomeTree.length : expenseTree.length) || 0
    const nextTone = COLOR_TONES[currentListLength % COLOR_TONES.length]?.id || (activeTab === 'income' ? 'emerald' : 'indigo')
    setParentTone(nextTone)
    setIsParentIconManuallySet(false)
    setAddParentModal(true)
  }

  // Submit Add Parent Category
  const handleAddParentCategory = (e) => {
    e.preventDefault()
    if (!parentNameId.trim()) return

    const trimmedId = parentNameId.trim()
    const trimmedEn = parentNameEn.trim() || trimmedId

    if (activeTab === 'expense') {
      addExpenseParentCategory(trimmedId, trimmedEn, parentTone, parentIcon)
    } else {
      addIncomeParentCategory(trimmedId, trimmedEn, parentTone, parentIcon)
    }

    bumpVersion()
    setAddParentModal(false)
    setParentNameId('')
    setParentNameEn('')
    setStatusMessage(t('settings.catAddedSuccess', 'Kategori utama berhasil ditambahkan.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  // Open Edit Parent Category Modal
  const openEditParent = (cat) => {
    const isCustom = String(cat.id).startsWith('p_') || String(cat.id).startsWith('ip_')
    const currentIcon = cat.icon || resolveTransactionIconKey(activeTab, cat.id, cat.icon)
    const currentTone = cat.color || (activeTab === 'income' ? 'emerald' : 'sky')

    setEditParentModal({
      id: cat.id,
      nameId: cat.names?.id || cat.id,
      nameEn: cat.names?.en || cat.names?.id || cat.id,
      icon: currentIcon,
      tone: currentTone,
      isCustom,
    })
    setEditParentNameId(cat.names?.id || cat.id)
    setEditParentNameEn(cat.names?.en || cat.names?.id || cat.id)
    setEditParentIcon(currentIcon)
    setEditParentTone(currentTone)
  }

  // Submit Edit Parent Category
  const handleSaveEditParent = (e) => {
    e.preventDefault()
    if (!editParentModal || !editParentNameId.trim()) return

    const { id } = editParentModal
    const trimmedId = editParentNameId.trim()
    const trimmedEn = editParentNameEn.trim() || trimmedId

    if (activeTab === 'expense') {
      updateExpenseCategoryName(id, null, trimmedId, trimmedEn)
      setExpenseCategoryColor(id, editParentTone)
      setExpenseCategoryIcon(id, editParentIcon)
    } else {
      updateIncomeCategoryName(id, null, trimmedId, trimmedEn)
      setIncomeCategoryColor(id, editParentTone)
      setIncomeCategoryIcon(id, editParentIcon)
    }

    bumpVersion()
    setEditParentModal(null)
    setStatusMessage(t('settings.catUpdatedSuccess', 'Kategori berhasil diperbarui.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  // Handle Add Subcategory
  const handleAddSubcategory = (e) => {
    e.preventDefault()
    if (!subNameId.trim() || !addSubModal.parentId) return

    if (activeTab === 'expense') {
      addExpenseSubcategory(addSubModal.parentId, subNameId.trim(), subNameEn.trim() || subNameId.trim())
    } else {
      addIncomeSubcategory(addSubModal.parentId, subNameId.trim(), subNameEn.trim() || subNameId.trim())
    }

    bumpVersion()
    setAddSubModal({ isOpen: false, parentId: null, parentName: '', parentIcon: 'food' })
    setSubNameId('')
    setSubNameEn('')
    setStatusMessage(t('settings.subAddedSuccess', 'Subkategori berhasil ditambahkan.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  // Open Edit Subcategory Modal
  const openEditSub = (parentId, sub, parentName) => {
    setEditSubModal({
      parentId,
      childId: sub.id,
      nameId: sub.names?.id || sub.id,
      nameEn: sub.names?.en || sub.names?.id || sub.id,
      parentName,
    })
    setEditSubNameId(sub.names?.id || sub.id)
    setEditSubNameEn(sub.names?.en || sub.names?.id || sub.id)
  }

  // Submit Edit Subcategory
  const handleSaveEditSub = (e) => {
    e.preventDefault()
    if (!editSubModal || !editSubNameId.trim()) return

    const { parentId, childId } = editSubModal
    const trimmedId = editSubNameId.trim()
    const trimmedEn = editSubNameEn.trim() || trimmedId

    if (activeTab === 'expense') {
      updateExpenseCategoryName(parentId, childId, trimmedId, trimmedEn)
    } else {
      updateIncomeCategoryName(parentId, childId, trimmedId, trimmedEn)
    }

    bumpVersion()
    setEditSubModal(null)
    setStatusMessage(t('settings.subUpdatedSuccess', 'Subkategori berhasil diperbarui.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  // Confirm Delete Subcategory
  const handleConfirmDeleteSub = async () => {
    if (!deleteSubTarget) return
    const { parentId, childId } = deleteSubTarget
    await cascadeDeleteSubcategory(parentId, childId, activeTab)

    bumpVersion()
    setDeleteSubTarget(null)
    setEditSubModal(null)
    setStatusMessage(t('settings.subRemovedSuccess', 'Subkategori berhasil dihapus dan dialihkan.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  // Confirm Delete Parent Category
  const handleConfirmDeleteParent = async () => {
    if (!deleteParentTarget) return
    const { parentId } = deleteParentTarget
    await cascadeDeleteParentCategory(parentId, activeTab)

    bumpVersion()
    setDeleteParentTarget(null)
    setEditParentModal(null)
    setStatusMessage(t('settings.catRemovedSuccess', 'Kategori utama berhasil dihapus.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  const handleConfirmReset = () => {
    if (confirmResetType === 'expense') {
      resetExpenseCategoryCustomizations()
      bumpVersion()
      setStatusMessage(
        t('settings.expenseCategoriesResetDone', 'Kategori pengeluaran berhasil di-reset ke bawaan.'),
      )
    } else if (confirmResetType === 'income') {
      resetIncomeCategoryCustomizations()
      bumpVersion()
      setStatusMessage(
        t('settings.incomeCategoriesResetDone', 'Kategori pemasukan berhasil di-reset ke bawaan.'),
      )
    }
    setConfirmResetType(null)
    setTimeout(() => setStatusMessage(''), 4000)
  }

  // Filtered available icons in picker
  const filteredIcons = useMemo(() => {
    const q = iconSearchQuery.toLowerCase().trim()
    if (!q) return AVAILABLE_CATEGORY_ICONS
    return AVAILABLE_CATEGORY_ICONS.filter(
      (item) =>
        item.key.includes(q) ||
        item.labelId.toLowerCase().includes(q) ||
        item.labelEn.toLowerCase().includes(q),
    )
  }, [iconSearchQuery])

  const selectIcon = (key) => {
    if (iconPickerTarget === 'add_parent') {
      setParentIcon(key)
      setIsParentIconManuallySet(true)
    } else if (iconPickerTarget === 'edit_parent') {
      setEditParentIcon(key)
    }
    setIconPickerOpen(false)
  }

  return (
    <>
      {statusMessage ? (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Header Overview Card */}
      <div className="mb-5 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="grid h-11 w-11 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
            <Tag className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-black text-[var(--fg)] leading-tight truncate">
              {t('settings.categoriesTitle', 'Kategori Transaksi')}
            </h3>
            <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)] mt-0.5 truncate">
              {t('settings.categoriesSummary', {
                expense: expenseTree.length,
                income: incomeTree.length,
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={openAddParent}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-[var(--fg)] px-3.5 py-2.5 text-xs font-extrabold text-[var(--bg)] shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer whitespace-nowrap"
            title={t('settings.addCategory', 'Tambah Kategori')}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>{t('settings.category', 'Kategori')}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmResetType(activeTab)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-extrabold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
            title={t('settings.resetDefault', 'Reset ke Bawaan')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t('settings.resetDefault', 'Reset')}</span>
          </button>
        </div>
      </div>

      {/* Segment Tab Switcher */}
      <div className="mb-4">
        <SettingsSegmentControl
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          ariaLabel={t('settings.typeCategories', 'Tipe Kategori')}
        />
      </div>

      {/* Search Bar */}
      <div className="mb-5">
        <SettingsSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('settings.searchCategoriesPlaceholder', {
            type: activeTab === 'expense' ? t('common.expense', 'pengeluaran') : t('common.income', 'pemasukan'),
          })}
        />
      </div>

      {/* Main Categories Section */}
      <SettingsSection
        title={activeTab === 'expense' ? t('settings.expenseCategories', 'Kategori Pengeluaran') : t('settings.incomeCategories', 'Kategori Pemasukan')}
        description={t('settings.categoriesDesc', 'Kelola daftar kategori dan subkategori sesuai kebiasaan finansial Anda')}
      >
        {filteredTree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] p-8 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-[var(--muted)]/50 mb-2" />
            <p className="text-xs font-bold text-[var(--muted)]">
              {t('settings.noCategoriesFound', 'Tidak ada kategori yang cocok dengan pencarian')}
            </p>
          </div>
        ) : (
          filteredTree.map((cat) => {
            const catName = cat.names?.[locale] || cat.names?.id || cat.id
            const iconKey = cat.icon || resolveTransactionIconKey(activeTab, cat.id, cat.icon)
            const toneClass = getCategoryToneClass(cat.color || (activeTab === 'income' ? 'emerald' : 'sky'))

            return (
              <div
                key={cat.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-card hover:border-[var(--border-strong)] transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${toneClass} shadow-2xs transition-transform active:scale-95`}>
                      <CategoryIcon icon={iconKey} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-extrabold text-[var(--fg)] truncate leading-tight">
                          {catName}
                        </span>
                        {String(cat.id).startsWith('p_') || String(cat.id).startsWith('ip_') ? (
                          <span className="rounded-md bg-[var(--accent)]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--accent)]">
                            Kustom
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] font-medium text-[var(--muted)]">
                        {cat.children?.length || 0} {t('settings.subcategoriesCount', 'subkategori')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditParent(cat)}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
                      title={t('common.edit', 'Edit Kategori')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddSubModal({ isOpen: true, parentId: cat.id, parentName: catName, parentIcon: iconKey })}
                      className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 h-8 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
                      title={t('settings.addSubcategory', 'Tambah Subkategori')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t('settings.sub', 'Sub')}</span>
                    </button>
                  </div>
                </div>

                {/* Subcategories tags */}
                {cat.children && cat.children.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border)]/40">
                    {cat.children.map((sub) => {
                      const subName = sub.names?.[locale] || sub.names?.id || sub.id
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => openEditSub(cat.id, sub, catName)}
                          className="group inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--accent)]/50 hover:bg-[var(--panel-strong)] transition-all active:scale-95 cursor-pointer shadow-2xs"
                          title={t('common.edit', 'Edit Subkategori')}
                        >
                          <span className="truncate max-w-[150px]">{subName}</span>
                          <Pencil className="h-2.5 w-2.5 text-[var(--muted-2)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </SettingsSection>

      {/* ── MODAL 1: Add Parent Category ── */}
      <Modal
        isOpen={addParentModal}
        onClose={() => setAddParentModal(false)}
        title={activeTab === 'expense' ? t('settings.addExpenseCategoryTitle', 'Tambah Kategori Pengeluaran') : t('settings.addIncomeCategoryTitle', 'Tambah Kategori Pemasukan')}
      >
        <form onSubmit={handleAddParentCategory} className="space-y-4 pt-1">
          {/* Live Dynamic Icon Preview */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]">
            <div className="relative group">
              <div className={`grid h-16 w-16 place-items-center rounded-3xl ${getCategoryToneClass(parentTone)} shadow-md transition-all`}>
                <CategoryIcon icon={parentIcon} className="h-8 w-8" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIconPickerTarget('add_parent')
                  setIconSearchQuery('')
                  setIconPickerOpen(true)
                }}
                className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)] shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
                title={t('settings.pickAnotherIcon', 'Pilih Ikon Lain')}
              >
                <Pencil size={11} strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs font-black text-[var(--fg)] capitalize">
                {AVAILABLE_CATEGORY_ICONS.find((i) => i.key === parentIcon)?.labelId || parentIcon}
              </p>
              <p className="text-[10px] font-medium text-[var(--muted)] flex items-center justify-center gap-1 mt-0.5">
                <Sparkles size={11} className="text-[var(--accent)]" />
                <span>{t('settings.autoIconHint', 'Ikon otomatis menyesuaikan saat nama diketik')}</span>
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.catNameId', 'Nama Kategori (Bahasa Indonesia) *')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={parentNameId}
              onChange={(e) => handleParentNameChange(e.target.value)}
              placeholder={t('settings.catPlaceholderId', 'Contoh: Kopi, Bensin, Gym, Freelance')}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.catNameEn', 'Nama Kategori (English - Opsional)')}
            </label>
            <input
              type="text"
              value={parentNameEn}
              onChange={(e) => setParentNameEn(e.target.value)}
              placeholder={t('settings.catPlaceholderEn', 'Example: Coffee, Fuel, Gym, Freelance')}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>

          {/* Color Tone Swatches */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.iconToneColor', 'Warna / Tone Ikon')}
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {COLOR_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setParentTone(tone.id)}
                  className={`h-10 rounded-xl ${tone.bg} ${tone.border} flex items-center justify-center transition active:scale-95 cursor-pointer relative ${
                    parentTone === tone.id ? 'ring-2 ' + tone.ring + ' scale-105 shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={tone.name}
                >
                  <div className={`h-4 w-4 rounded-full ${tone.text.replace('text-', 'bg-')}`} />
                  {parentTone === tone.id && (
                    <Check size={12} className="absolute text-white stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setAddParentModal(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!parentNameId.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL 2: Edit Parent Category ── */}
      <Modal
        isOpen={Boolean(editParentModal)}
        onClose={() => setEditParentModal(null)}
        title={t('settings.editCategoryTitle', 'Edit Kategori Utama')}
      >
        <form onSubmit={handleSaveEditParent} className="space-y-4 pt-1">
          {/* Live Icon & Change Trigger */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]">
            <div className="relative group">
              <div className={`grid h-16 w-16 place-items-center rounded-3xl ${getCategoryToneClass(editParentTone)} shadow-md transition-all`}>
                <CategoryIcon icon={editParentIcon} className="h-8 w-8" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIconPickerTarget('edit_parent')
                  setIconSearchQuery('')
                  setIconPickerOpen(true)
                }}
                className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)] shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
                title={t('settings.changeIcon', 'Ganti Ikon')}
              >
                <Palette size={11} strokeWidth={2.5} />
              </button>
            </div>
            <p className="mt-2 text-xs font-black text-[var(--fg)] capitalize">
              {AVAILABLE_CATEGORY_ICONS.find((i) => i.key === editParentIcon)?.labelId || editParentIcon}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.catNameId', 'Nama Kategori (Bahasa Indonesia) *')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={editParentNameId}
              onChange={(e) => setEditParentNameId(e.target.value)}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.catNameEn', 'Nama Kategori (English - Opsional)')}
            </label>
            <input
              type="text"
              value={editParentNameEn}
              onChange={(e) => setEditParentNameEn(e.target.value)}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>

          {/* Color Tone Swatches */}
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.iconToneColor', 'Warna / Tone Ikon')}
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {COLOR_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setEditParentTone(tone.id)}
                  className={`h-10 rounded-xl ${tone.bg} ${tone.border} flex items-center justify-center transition active:scale-95 cursor-pointer relative ${
                    editParentTone === tone.id ? 'ring-2 ' + tone.ring + ' scale-105 shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={tone.name}
                >
                  <div className={`h-4 w-4 rounded-full ${tone.text.replace('text-', 'bg-')}`} />
                  {editParentTone === tone.id && (
                    <Check size={12} className="absolute text-white stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {editParentModal?.isCustom && (
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() =>
                  setDeleteParentTarget({
                    parentId: editParentModal.id,
                    parentName: editParentNameId,
                  })
                }
                className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-500/20 active:scale-[0.98] transition cursor-pointer"
              >
                {t('settings.deleteCustomCategory', 'Hapus Kategori Kustom Ini')}
              </button>
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditParentModal(null)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!editParentNameId.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL 3: Add Subcategory ── */}
      <Modal
        isOpen={addSubModal.isOpen}
        onClose={() => setAddSubModal({ isOpen: false, parentId: null, parentName: '', parentIcon: 'food' })}
        title={t('settings.addSubcategoryTitle', { name: addSubModal.parentName }, `Tambah Subkategori (${addSubModal.parentName})`)}
      >
        <form onSubmit={handleAddSubcategory} className="space-y-4 pt-1">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--panel-strong)] text-[var(--fg)] border border-[var(--border)] shadow-2xs">
              <CategoryIcon icon={addSubModal.parentIcon} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {t('settings.parentCategoryLabel', 'Kategori Induk:')}
              </p>
              <p className="text-xs font-black text-[var(--fg)]">{addSubModal.parentName}</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.subNameId', 'Nama Subkategori (Bahasa Indonesia) *')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={subNameId}
              onChange={(e) => setSubNameId(e.target.value)}
              placeholder={t('settings.subPlaceholderId', 'Contoh: Kopi Kekinian, Donat, Susu')}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.subNameEn', 'Nama Subkategori (English - Opsional)')}
            </label>
            <input
              type="text"
              value={subNameEn}
              onChange={(e) => setSubNameEn(e.target.value)}
              placeholder={t('settings.subPlaceholderEn', 'Example: Specialty Coffee, Donuts')}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setAddSubModal({ isOpen: false, parentId: null, parentName: '', parentIcon: 'food' })}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!subNameId.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL 4: Edit Subcategory ── */}
      <Modal
        isOpen={Boolean(editSubModal)}
        onClose={() => setEditSubModal(null)}
        title={t('settings.editSubcategoryTitle', 'Edit Subkategori')}
      >
        <form onSubmit={handleSaveEditSub} className="space-y-4 pt-1">
          {editSubModal?.parentName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs text-[var(--muted)] font-medium">
              <span>{t('settings.parentCategoryLabel', 'Kategori Induk:')}</span>
              <span className="font-bold text-[var(--fg)]">{editSubModal.parentName}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.subNameId', 'Nama Subkategori (Bahasa Indonesia) *')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={editSubNameId}
              onChange={(e) => setEditSubNameId(e.target.value)}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.subNameEn', 'Nama Subkategori (English - Opsional)')}
            </label>
            <input
              type="text"
              value={editSubNameEn}
              onChange={(e) => setEditSubNameEn(e.target.value)}
              className="ft-settings-field-compact font-semibold h-12"
            />
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() =>
                setDeleteSubTarget({
                  parentId: editSubModal.parentId,
                  childId: editSubModal.childId,
                  childName: editSubNameId,
                })
              }
              className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-500/20 active:scale-[0.98] transition cursor-pointer"
            >
              {t('settings.deleteSubcategoryThis', 'Hapus Subkategori Ini')}
            </button>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditSubModal(null)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!editSubNameId.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL 5: Full Icon Picker Grid Modal ── */}
      <Modal
        isOpen={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        title={t('settings.pickCategoryIcon', 'Pilih Ikon Kategori')}
      >
        <div className="space-y-3 pt-1">
          {/* Search inside icon picker */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
            <input
              type="text"
              autoFocus
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.target.value)}
              placeholder={t('settings.searchIconsPlaceholder', 'Cari ikon (misal: kopi, bensin, wifi, uang)...')}
              className="ft-settings-field-compact pl-10 h-11 text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto p-1 ft-hide-scrollbar">
            {filteredIcons.map((item) => {
              const currentActive =
                iconPickerTarget === 'add_parent' ? parentIcon : editParentIcon
              const isSelected = currentActive === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectIcon(item.key)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all active:scale-90 cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <CategoryIcon icon={item.key} className="h-6 w-6 mb-1" />
                  <span className="text-[9px] font-bold text-center leading-tight truncate w-full">
                    {item.labelId}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* ── MODAL 6: Confirm Delete Subcategory Modal ── */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteSubTarget)}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={handleConfirmDeleteSub}
        title={t('settings.deleteSubcategory', 'Hapus Subkategori')}
        message={t(
          'settings.deleteSubConfirm',
          { name: deleteSubTarget?.childName },
          `Apakah Anda yakin ingin menghapus subkategori "${deleteSubTarget?.childName}"? Riwayat transaksi akan dialihkan ke kategori umum.`,
        )}
        confirmText={t('common.delete', 'Hapus')}
      />

      {/* ── MODAL 7: Confirm Delete Parent Category Modal ── */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteParentTarget)}
        onClose={() => setDeleteParentTarget(null)}
        onConfirm={handleConfirmDeleteParent}
        title={t('settings.deleteParentCategory', 'Hapus Kategori Utama')}
        message={t(
          'settings.deleteParentConfirm',
          { name: deleteParentTarget?.parentName },
          `Apakah Anda yakin ingin menghapus kategori "${deleteParentTarget?.parentName}" beserta subkategorinya?`,
        )}
        confirmText={t('common.delete', 'Hapus')}
      />

      {/* ── MODAL 8: Confirm Reset All Categories Modal ── */}
      <ConfirmDeleteModal
        isOpen={Boolean(confirmResetType)}
        onClose={() => setConfirmResetType(null)}
        onConfirm={handleConfirmReset}
        title={t('settings.resetCategoriesTitle', 'Reset Kategori ke Bawaan')}
        message={
          confirmResetType === 'expense'
            ? t('settings.confirmResetExpenseCategories', 'Apakah Anda yakin ingin mengembalikan kategori pengeluaran ke pengaturan default?')
            : t('settings.confirmResetIncomeCategories', 'Apakah Anda yakin ingin mengembalikan kategori pemasukan ke pengaturan default?')
        }
        confirmText={t('settings.resetDefault', 'Reset')}
      />
    </>
  )
}
