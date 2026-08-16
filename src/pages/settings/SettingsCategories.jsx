import { useState, useMemo } from 'react'
import {
  Tag,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import {
  EXPENSE_TREE,
  resetExpenseCategoryCustomizations,
} from '../../lib/expenseCategories'
import {
  INCOME_TREE,
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

  const tabOptions = useMemo(
    () => [
      {
        value: 'expense',
        label: `${t('common.expense', 'Pengeluaran')} (${EXPENSE_TREE.length})`,
        icon: TrendingDown,
      },
      {
        value: 'income',
        label: `${t('common.income', 'Pemasukan')} (${INCOME_TREE.length})`,
        icon: TrendingUp,
      },
    ],
    [t],
  )

  const currentTree = activeTab === 'expense' ? EXPENSE_TREE : INCOME_TREE

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
      setStatusMessage(
        t('settings.expenseCategoriesResetDone', 'Kategori pengeluaran berhasil di-reset ke bawaan.'),
      )
    } else if (confirmResetType === 'income') {
      resetIncomeCategoryCustomizations()
      setStatusMessage(
        t('settings.incomeCategoriesResetDone', 'Kategori pemasukan berhasil di-reset ke bawaan.'),
      )
    }
    setConfirmResetType(null)
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
            <p className="text-xs font-medium text-[var(--muted)] truncate mt-1">
              {t('settings.categoriesSummary', {
                expense: EXPENSE_TREE.length,
                income: INCOME_TREE.length,
              })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetType(activeTab)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2 text-xs font-extrabold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
          title={t('settings.resetDefault', 'Reset ke Bawaan')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('settings.resetDefault', 'Reset')}</span>
        </button>
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

      {/* Category List */}
      <SettingsSection
        label={
          activeTab === 'expense'
            ? t('settings.expenseCategoriesList', 'Daftar Kategori Pengeluaran')
            : t('settings.incomeCategoriesList', 'Daftar Kategori Pemasukan')
        }
        footnote={t('settings.categoriesFootnote', 'Kategori digunakan saat mencatat transaksi manual dan pengelompokan anggaran keuangan.')}
      >
        {filteredTree.length === 0 ? (
          <div className="ft-settings-cell py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] mb-2.5 shadow-2xs">
              <FolderOpen className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-[var(--fg)]">
              {t('settings.categoriesNotFound', 'Kategori Tidak Ditemukan')}
            </p>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-xs mx-auto">
              {t('settings.categoriesNotFoundDesc', { query: searchQuery })}
            </p>
          </div>
        ) : (
          filteredTree.map((cat) => {
            const catName = cat.names?.[locale] || cat.names?.id || cat.id
            const iconKey = resolveTransactionIconKey(cat.id, activeTab)

            return (
              <div key={cat.id} className="ft-settings-cell space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)] shadow-2xs">
                      <CategoryIcon icon={iconKey} className="h-5 w-5" />
                    </div>
                    <span className="text-[15px] font-extrabold text-[var(--fg)] truncate leading-tight">
                      {catName}
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-xs font-bold text-[var(--muted)] shrink-0">
                    {cat.children?.length || 0} {t('settings.subcategoriesCount', 'subkategori')}
                  </span>
                </div>

                {/* Subcategories tags */}
                {cat.children && cat.children.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-13">
                    {cat.children.map((sub) => {
                      const subName = sub.names?.[locale] || sub.names?.id || sub.id
                      return (
                        <span
                          key={sub.id}
                          className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-all"
                        >
                          {subName}
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

      <ConfirmDeleteModal
        isOpen={!!confirmResetType}
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
