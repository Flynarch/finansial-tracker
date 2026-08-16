import { useState, useMemo } from 'react'
import {
  Tag,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
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
import { getCategoryColorClass, resolveTransactionIconKey } from '../../lib/categoryIcon'
import CategoryIcon from '../../components/ui/CategoryIcon'
import useTranslation from '../../hooks/useTranslation'
import { SettingsSection, SettingsSegmentControl } from './settingsComponents'

export default function SettingsCategories() {
  const { t, locale } = useTranslation()
  const [activeTab, setActiveTab] = useState('expense')
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmResetType, setConfirmResetType] = useState(null) // 'expense' | 'income' | null

  const tabOptions = useMemo(
    () => [
      { value: 'expense', label: 'Pengeluaran', icon: TrendingDown },
      { value: 'income', label: 'Pemasukan', icon: TrendingUp },
    ],
    [],
  )

  const currentTree = activeTab === 'expense' ? EXPENSE_TREE : INCOME_TREE

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
          className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-500 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Header Overview Card */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-2xs">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--fg)]">Kategori Transaksi</h3>
            <p className="text-[11px] font-medium text-[var(--muted)] mt-0.5">
              {EXPENSE_TREE.length} Kategori Pengeluaran • {INCOME_TREE.length} Kategori Pemasukan
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetType(activeTab)}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
          title={t('settings.resetDefault', 'Reset ke Bawaan')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('settings.resetDefault', 'Reset Bawaan')}</span>
        </button>
      </div>

      {/* Segment Tab */}
      <div className="mb-4">
        <SettingsSegmentControl
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val)}
          ariaLabel="Tipe Kategori"
        />
      </div>

      {/* Category List */}
      <SettingsSection
        label={`Daftar Kategori ${activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}
        footnote="Kategori digunakan saat mencatat transaksi manual dan pengelompokan anggaran."
      >
        {currentTree.map((cat) => {
          const catName = cat.names?.[locale] || cat.names?.id || cat.id
          const iconKey = resolveTransactionIconKey({ category: cat.id, type: activeTab })
          const colorClass = getCategoryColorClass(cat.id, activeTab)

          return (
            <div key={cat.id} className="ft-settings-cell space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${colorClass}`}>
                    <CategoryIcon name={iconKey} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--fg)] truncate">
                      {catName}
                    </span>
                    <span className="block text-[10.5px] font-medium text-[var(--muted)]">
                      {cat.children?.length || 0} subkategori
                    </span>
                  </div>
                </div>
              </div>

              {/* Subcategories tags */}
              {cat.children && cat.children.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1 pl-10">
                  {cat.children.map((sub) => {
                    const subName = sub.names?.[locale] || sub.names?.id || sub.id
                    return (
                      <span
                        key={sub.id}
                        className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--muted)]"
                      >
                        {subName}
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
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
        confirmText="Reset"
      />
    </>
  )
}
