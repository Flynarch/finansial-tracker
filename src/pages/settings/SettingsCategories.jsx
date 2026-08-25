import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Tag,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  FolderOpen,
  Plus,
  X,
} from 'lucide-react'
import { db } from '../../lib/db'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import Modal from '../../components/ui/Modal'
import {
  getMergedExpenseTree,
  addExpenseSubcategory,
  removeExpenseSubcategory,
  resetExpenseCategoryCustomizations,
} from '../../lib/expenseCategories'
import {
  getMergedIncomeTree,
  addIncomeSubcategory,
  removeIncomeSubcategory,
  addIncomeParentCategory,
  resetIncomeCategoryCustomizations,
} from '../../lib/incomeCategories'
import { resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../../components/ui/CategoryIcon'
import useTranslation from '../../hooks/useTranslation'
import {
  SettingsSection,
  SettingsSegmentControl,
  SettingsSearchInput,
} from './settingsComponents'

export default function SettingsCategories() {
  const { t, locale } = useTranslation()
  const [activeTab, setActiveTab] = useState('expense')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmResetType, setConfirmResetType] = useState(null) // 'expense' | 'income' | null
  const [customVersion, setCustomVersion] = useState(0)

  // Modals state
  const [addSubModal, setAddSubModal] = useState({ isOpen: false, parentId: null, parentName: '' })
  const [subNameId, setSubNameId] = useState('')
  const [subNameEn, setSubNameEn] = useState('')

  const [addParentModal, setAddParentModal] = useState(false)
  const [parentNameId, setParentNameId] = useState('')
  const [parentNameEn, setParentNameEn] = useState('')

  const [deleteSubTarget, setDeleteSubTarget] = useState(null) // { parentId, childId, childName }

  const bumpVersion = useCallback(() => setCustomVersion((v) => v + 1), [])

  useEffect(() => {
    const handleCustomChange = () => bumpVersion()
    window.addEventListener('ft_expense_category_custom_changed', handleCustomChange)
    window.addEventListener('ft_income_category_custom_changed', handleCustomChange)
    return () => {
      window.removeEventListener('ft_expense_category_custom_changed', handleCustomChange)
      window.removeEventListener('ft_income_category_custom_changed', handleCustomChange)
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

  const handleAddSubcategory = (e) => {
    e.preventDefault()
    if (!subNameId.trim() || !addSubModal.parentId) return

    if (activeTab === 'expense') {
      addExpenseSubcategory(addSubModal.parentId, subNameId.trim(), subNameEn.trim() || subNameId.trim())
    } else {
      addIncomeSubcategory(addSubModal.parentId, subNameId.trim(), subNameEn.trim() || subNameId.trim())
    }

    bumpVersion()
    setAddSubModal({ isOpen: false, parentId: null, parentName: '' })
    setSubNameId('')
    setSubNameEn('')
    setStatusMessage(t('settings.subAddedSuccess', 'Subkategori berhasil ditambahkan.'))
    setTimeout(() => setStatusMessage(''), 4000)
  }

  const handleAddParentCategory = (e) => {
    e.preventDefault()
    if (!parentNameId.trim()) return

    if (activeTab === 'income') {
      addIncomeParentCategory(parentNameId.trim(), parentNameEn.trim() || parentNameId.trim())
      bumpVersion()
      setAddParentModal(false)
      setParentNameId('')
      setParentNameEn('')
      setStatusMessage(t('settings.catAddedSuccess', 'Kategori utama berhasil ditambahkan.'))
      setTimeout(() => setStatusMessage(''), 4000)
    }
  }

  const handleConfirmDeleteSub = async () => {
    if (!deleteSubTarget) return
    const { parentId, childId } = deleteSubTarget
    const targetPath = `${parentId}/${childId}`
    const fallbackPath = `${parentId}/lainnya`

    if (activeTab === 'expense') {
      removeExpenseSubcategory(parentId, childId)
    } else {
      removeIncomeSubcategory(parentId, childId)
    }

    try {
      // Cascade update transactions with this category to fallback
      await db.transactions.where('category').equals(targetPath).modify({ category: fallbackPath })
    } catch {
      // ignore
    }

    bumpVersion()
    setDeleteSubTarget(null)
    setStatusMessage(t('settings.subRemovedSuccess', 'Subkategori berhasil dihapus dan riwayat transaksi dialihkan ke Lainnya.'))
    setTimeout(() => setStatusMessage(''), 4000)
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
      <div className="mb-5 flex items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
            <Tag className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-[var(--fg)] leading-tight">
              {t('settings.categoriesTitle', 'Kategori Transaksi')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              {t('settings.categoriesSummary', {
                expense: expenseTree.length,
                income: incomeTree.length,
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'income' && (
            <button
              type="button"
              onClick={() => setAddParentModal(true)}
              className="flex items-center gap-1 rounded-xl bg-[var(--fg)] px-3 py-2 text-xs font-extrabold text-[var(--bg)] shadow-2xs transition active:scale-95 cursor-pointer"
              title={t('settings.addCategory', 'Tambah Kategori')}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('settings.category', 'Kategori')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmResetType(activeTab)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-extrabold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
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
            const iconKey = resolveTransactionIconKey(activeTab, cat.id, cat.icon)

            return (
              <div
                key={cat.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-card hover:border-[var(--border-strong)] transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] shadow-2xs">
                      <CategoryIcon icon={iconKey} className="h-5 w-5" />
                    </div>
                    <span className="text-[15px] font-extrabold text-[var(--fg)] truncate leading-tight">
                      {catName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-xs font-bold text-[var(--muted)]">
                      {cat.children?.length || 0} {t('settings.subcategoriesCount', 'subkategori')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddSubModal({ isOpen: true, parentId: cat.id, parentName: catName })}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
                      title={t('settings.addSubcategory', 'Tambah Subkategori')}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Subcategories tags */}
                {cat.children && cat.children.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-13">
                    {cat.children.map((sub) => {
                      const subName = sub.names?.[locale] || sub.names?.id || sub.id
                      return (
                        <span
                          key={sub.id}
                          className="group inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] pl-3 pr-1.5 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-all"
                        >
                          <span>{subName}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteSubTarget({
                                parentId: cat.id,
                                childId: sub.id,
                                childName: subName,
                              })
                            }
                            className="h-4 w-4 rounded-full hover:bg-rose-500/20 hover:text-rose-500 text-[var(--muted)] grid place-items-center transition cursor-pointer"
                            title={t('settings.deleteSubcategory', 'Hapus Subkategori')}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </SettingsSection>

      {/* Add Subcategory Modal */}
      <Modal
        isOpen={addSubModal.isOpen}
        onClose={() => setAddSubModal({ isOpen: false, parentId: null, parentName: '' })}
        title={t('settings.addSubcategoryTitle', { name: addSubModal.parentName }, `Tambah Subkategori (${addSubModal.parentName})`)}
      >
        <form onSubmit={handleAddSubcategory} className="space-y-4 pt-1">
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
              onClick={() => setAddSubModal({ isOpen: false, parentId: null, parentName: '' })}
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

      {/* Add Parent Category Modal */}
      <Modal
        isOpen={addParentModal}
        onClose={() => setAddParentModal(false)}
        title={t('settings.addIncomeCategoryTitle', 'Tambah Kategori Utama Pemasukan')}
      >
        <form onSubmit={handleAddParentCategory} className="space-y-4 pt-1">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.catNameId', 'Nama Kategori (Bahasa Indonesia) *')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={parentNameId}
              onChange={(e) => setParentNameId(e.target.value)}
              placeholder={t('settings.catPlaceholderId', 'Contoh: Freelance, Dividen, Royalti')}
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
              placeholder={t('settings.catPlaceholderEn', 'Example: Freelance, Dividends, Royalties')}
              className="ft-settings-field-compact font-semibold h-12"
            />
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

      {/* Confirm Delete Subcategory Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteSubTarget)}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={handleConfirmDeleteSub}
        title={t('settings.deleteSubcategory', 'Hapus Subkategori')}
        message={t('settings.deleteSubConfirm', { name: deleteSubTarget?.childName }, `Apakah Anda yakin ingin menghapus atau menyembunyikan subkategori "${deleteSubTarget?.childName}"?`)}
        confirmText={t('common.delete', 'Hapus')}
      />

      {/* Confirm Reset All Categories Modal */}
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
