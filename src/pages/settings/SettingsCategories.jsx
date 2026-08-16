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
import { resolveTransactionIconKey } from '../../lib/categoryIcon'
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
          className="mb-3.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-xs font-bold text-[var(--fg)] animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Header Overview Card - Clean & Monochromatic */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-2.5 shadow-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
            <Tag className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--fg)]">Kategori Transaksi</h3>
            <p className="text-[10.5px] font-medium text-[var(--muted)] truncate mt-0.5">
              {EXPENSE_TREE.length} Pengeluaran • {INCOME_TREE.length} Pemasukan
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetType(activeTab)}
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
          title={t('settings.resetDefault', 'Reset ke Bawaan')}
        >
          <RotateCcw className="h-3 w-3" />
          <span>{t('settings.resetDefault', 'Reset')}</span>
        </button>
      </div>

      {/* Segment Tab */}
      <div className="mb-3">
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

          return (
            <div key={cat.id} className="ft-settings-cell space-y-1.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
                    <CategoryIcon name={iconKey} className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-[var(--fg)] truncate">
                      {catName}
                    </span>
                    <span className="block text-[10px] font-medium text-[var(--muted)]">
                      {cat.children?.length || 0} subkategori
                    </span>
                  </div>
                </div>
              </div>

              {/* Subcategories tags */}
              {cat.children && cat.children.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-0.5 pl-9">
                  {cat.children.map((sub) => {
                    const subName = sub.names?.[locale] || sub.names?.id || sub.id
                    return (
                      <span
                        key={sub.id}
                        className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]"
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
