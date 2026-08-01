import { useState } from 'react'
import Button from '../../components/ui/Button'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import { resetExpenseCategoryCustomizations } from '../../lib/expenseCategories'
import { resetIncomeCategoryCustomizations } from '../../lib/incomeCategories'
import useTranslation from '../../hooks/useTranslation'
import { SettingsSection } from './settingsComponents'

export default function SettingsCategories() {
  const { t } = useTranslation()
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmResetType, setConfirmResetType] = useState(null) // 'expense' | 'income' | null

  const handleConfirmReset = () => {
    if (confirmResetType === 'expense') {
      resetExpenseCategoryCustomizations()
      setStatusMessage(t('settings.expenseCategoriesResetDone'))
    } else if (confirmResetType === 'income') {
      resetIncomeCategoryCustomizations()
      setStatusMessage(t('settings.incomeCategoriesResetDone'))
    }
    setConfirmResetType(null)
  }

  return (
    <>
      {statusMessage ? (
        <div className="ft-settings-status mb-4" role="status">
          {statusMessage}
        </div>
      ) : null}

      <SettingsSection label={t('settings.expenseCategories')}>
        <div className="ft-settings-cell">
          <p className="mb-3 text-sm leading-relaxed text-[var(--muted)]">{t('settings.expenseCategoriesIntro')}</p>
          <Button
            type="button"
            className="w-full bg-slate-700 text-slate-100 hover:bg-slate-600 sm:w-auto"
            onClick={() => setConfirmResetType('expense')}
          >
            {t('settings.expenseCategoriesReset')}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection label={t('settings.incomeCategories')}>
        <div className="ft-settings-cell">
          <p className="mb-3 text-sm leading-relaxed text-[var(--muted)]">{t('settings.incomeCategoriesIntro')}</p>
          <Button
            type="button"
            className="w-full bg-slate-700 text-slate-100 hover:bg-slate-600 sm:w-auto"
            onClick={() => setConfirmResetType('income')}
          >
            {t('settings.incomeCategoriesReset')}
          </Button>
        </div>
      </SettingsSection>

      <ConfirmDeleteModal
        isOpen={!!confirmResetType}
        onClose={() => setConfirmResetType(null)}
        onConfirm={handleConfirmReset}
        title="Reset Kategori"
        message={
          confirmResetType === 'expense'
            ? t('settings.confirmResetExpenseCategories')
            : t('settings.confirmResetIncomeCategories')
        }
        confirmText="Reset"
      />
    </>
  )
}
