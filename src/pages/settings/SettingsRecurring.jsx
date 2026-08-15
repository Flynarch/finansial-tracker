import { format } from 'date-fns'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import CustomDatePicker from '../../components/ui/CustomDatePicker'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import { SettingsSection } from './settingsComponents'

export default function SettingsRecurring() {
  const { t } = useTranslation()
  const recurringTransactions = useLiveQuery(() => db.recurringTransactions.toArray(), [], [])
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    type: 'income',
    category: 'Salary',
    amount: '',
    currency: 'IDR',
    notes: '',
    frequency: 'monthly',
    nextDate: format(new Date(), 'yyyy-MM-dd'),
  })

  const recurringFrequencyLabel = (value) => {
    if (value === 'daily') return t('settings.recurring.frequency.daily')
    if (value === 'weekly') return t('settings.recurring.frequency.weekly')
    return t('settings.recurring.frequency.monthly')
  }

  const handleAddRecurring = async () => {
    await db.recurringTransactions.add({
      ...recurringForm,
      amount: Number(recurringForm.amount || 0),
      enabled: 1,
    })
    setRecurringForm((prev) => ({ ...prev, title: '', amount: '', notes: '' }))
  }

  return (
    <>
      <SettingsSection label={t('settings.recurringTitle')}>
        <div className="ft-settings-cell space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t('settings.recurring.field.title')}</span>
              <input
                type="text"
                value={recurringForm.title}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, title: event.target.value }))}
                className="ft-settings-field-compact"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t('settings.recurring.field.type')}</span>
              <select
                value={recurringForm.type}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, type: event.target.value }))}
                className="ft-settings-field-compact"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t('settings.recurring.field.category')}</span>
              <input
                type="text"
                value={recurringForm.category}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, category: event.target.value }))}
                className="ft-settings-field-compact"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t('settings.recurring.field.amount')}</span>
              <input
                type="number"
                value={recurringForm.amount}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, amount: event.target.value }))}
                className="ft-settings-field-compact"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t('settings.recurring.field.frequency')}</span>
              <select
                value={recurringForm.frequency}
                onChange={(event) => setRecurringForm((prev) => ({ ...prev, frequency: event.target.value }))}
                className="ft-settings-field-compact"
              >
                <option value="daily">{t('settings.recurring.frequency.daily')}</option>
                <option value="weekly">{t('settings.recurring.frequency.weekly')}</option>
                <option value="monthly">{t('settings.recurring.frequency.monthly')}</option>
              </select>
            </label>
            <div className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{t('settings.recurring.field.nextDate')}</span>
              <CustomDatePicker
                value={recurringForm.nextDate}
                onChange={(val) => setRecurringForm((prev) => ({ ...prev, nextDate: val }))}
                title={'Pilih Tanggal Berikutnya'}
              />
            </div>
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={handleAddRecurring}>
            {t('settings.recurring.add')}
          </Button>
        </div>
        <div className="ft-settings-cell bg-[var(--field-bg)]">
          {recurringTransactions.length === 0 ? (
            <EmptyState title={t('settings.recurring.empty')} />
          ) : (
            <ul className="space-y-2">
              {recurringTransactions.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm text-[var(--fg)]">
                    {item.title} · {recurringFrequencyLabel(item.frequency)} · {t('settings.recurring.next')}{' '}
                    {item.nextDate}
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="shrink-0"
                    onClick={() => db.recurringTransactions.delete(item.id)}
                  >
                    {t('settings.delete')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsSection>
    </>
  )
}
