import { format } from 'date-fns'
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  RefreshCw,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import CustomDatePicker from '../../components/ui/CustomDatePicker'
import { db } from '../../lib/db'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection, SettingsSegmentControl } from './settingsComponents'

export default function SettingsRecurring() {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const recurringTransactions = useLiveQuery(() => db.recurringTransactions.toArray(), [], [])

  const [recurringForm, setRecurringForm] = useState({
    title: '',
    type: 'expense',
    category: 'tagihan/listrik',
    amount: '',
    currency: defaultCurrency,
    notes: '',
    frequency: 'monthly',
    nextDate: format(new Date(), 'yyyy-MM-dd'),
  })

  const typeOptions = useMemo(
    () => [
      { value: 'expense', label: 'Pengeluaran', icon: TrendingDown },
      { value: 'income', label: 'Pemasukan', icon: TrendingUp },
    ],
    [],
  )

  const frequencyOptions = useMemo(
    () => [
      { value: 'monthly', label: t('settings.recurring.frequency.monthly', 'Bulanan') },
      { value: 'weekly', label: t('settings.recurring.frequency.weekly', 'Mingguan') },
      { value: 'daily', label: t('settings.recurring.frequency.daily', 'Harian') },
    ],
    [t],
  )

  const recurringFrequencyLabel = (value) => {
    if (value === 'daily') return t('settings.recurring.frequency.daily', 'Harian')
    if (value === 'weekly') return t('settings.recurring.frequency.weekly', 'Mingguan')
    return t('settings.recurring.frequency.monthly', 'Bulanan')
  }

  const handleAddRecurring = async (e) => {
    e.preventDefault()
    if (!recurringForm.title || !recurringForm.amount) return

    await db.recurringTransactions.add({
      ...recurringForm,
      amount: Number(recurringForm.amount || 0),
      currency: defaultCurrency,
      enabled: 1,
      createdAt: new Date().toISOString(),
    })
    setRecurringForm((prev) => ({
      ...prev,
      title: '',
      amount: '',
      notes: '',
    }))
  }

  const totalMonthlyRecurringExpense = (recurringTransactions || [])
    .filter((item) => item.type === 'expense')
    .reduce((acc, curr) => acc + toSafeNumber(curr.amount), 0)

  return (
    <>
      {/* Header Overview Card - Clean & Monochromatic */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-2.5 shadow-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--fg)]">
              {t('settings.recurringTitle', 'Transaksi Berulang')}
            </h3>
            <p className="text-[10.5px] font-medium text-[var(--muted)] truncate mt-0.5">
              {(recurringTransactions || []).length} Jadwal Aktif • Estimasi{' '}
              {formatCurrency(totalMonthlyRecurringExpense, defaultCurrency, locale)}/bln
            </p>
          </div>
        </div>
      </div>

      {/* Add New Recurring Form */}
      <SettingsSection label={t('settings.recurring.addTitle', 'Tambah Jadwal Otomatis')}>
        <form onSubmit={handleAddRecurring} className="ft-settings-cell space-y-2.5">
          <div>
            <SettingsSegmentControl
              options={typeOptions}
              value={recurringForm.type}
              onChange={(val) => setRecurringForm((prev) => ({ ...prev, type: val }))}
              ariaLabel="Tipe Transaksi"
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[var(--fg)]">
                {t('settings.recurring.field.title', 'Nama Transaksi')}
              </label>
              <input
                type="text"
                required
                placeholder={t('settings.recurring.placeholder', 'Contoh: Gaji Bulanan, Tagihan WiFi, Netflix')}
                value={recurringForm.title}
                onChange={(event) =>
                  setRecurringForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="ft-settings-field-compact font-medium"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-[var(--fg)]">
                {t('settings.recurring.field.amount', 'Nominal')}
              </label>
              <input
                type="number"
                required
                placeholder="0"
                value={recurringForm.amount}
                onChange={(event) =>
                  setRecurringForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                className="ft-settings-field-compact font-mono font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-[var(--fg)]">
                {t('settings.recurring.field.frequency', 'Frekuensi')}
              </label>
              <SettingsSegmentControl
                options={frequencyOptions}
                value={recurringForm.frequency}
                onChange={(val) => setRecurringForm((prev) => ({ ...prev, frequency: val }))}
                ariaLabel="Frekuensi"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-[var(--fg)]">
                {t('settings.recurring.field.nextDate', 'Tanggal Jatuh Tempo')}
              </label>
              <CustomDatePicker
                value={recurringForm.nextDate}
                onChange={(val) => setRecurringForm((prev) => ({ ...prev, nextDate: val }))}
                title={'Pilih Tanggal'}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1 rounded-lg bg-[var(--fg)] py-2 px-3 text-xs font-extrabold text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('settings.recurring.add', 'Simpan Jadwal')}</span>
          </button>
        </form>
      </SettingsSection>

      {/* List Active Recurring Items */}
      <SettingsSection
        label={t('settings.recurring.activeList', 'Daftar Jadwal Transaksi')}
        footnote={t(
          'settings.recurring.footnote',
          'Transaksi akan otomatis dibuat saat tanggal jatuh tempo tercapai.',
        )}
      >
        {recurringTransactions.length === 0 ? (
          <div className="ft-settings-cell py-6 text-center">
            <div className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] mb-1.5 shadow-2xs">
              <RefreshCw className="h-4 w-4" />
            </div>
            <p className="text-xs font-bold text-[var(--fg)]">Belum Ada Transaksi Berulang</p>
            <p className="text-[10.5px] font-medium text-[var(--muted)] mt-0.5 max-w-xs mx-auto">
              Jadwalkan pengeluaran rutin atau pemasukan gaji bulanan di atas agar tercatat otomatis.
            </p>
          </div>
        ) : (
          recurringTransactions.map((item) => {
            const isExpense = item.type === 'expense'
            return (
              <div
                key={item.id}
                className="ft-settings-cell flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--fg)]">{item.title}</p>
                    <p className="text-[10px] font-medium text-[var(--muted)] flex items-center gap-1 mt-0.5">
                      <span className="inline-block rounded bg-[var(--field-bg)] px-1.5 py-0.2 border border-[var(--border)] text-[9px] font-bold uppercase">
                        {recurringFrequencyLabel(item.frequency)}
                      </span>
                      <span>• Jatuh tempo: {item.nextDate}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isExpense ? 'text-[var(--status-expense)]' : 'text-[var(--status-income)]'
                    }`}
                  >
                    {isExpense ? '-' : '+'}
                    {formatCurrency(item.amount, defaultCurrency, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => db.recurringTransactions.delete(item.id)}
                    className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] hover:text-rose-500 hover:bg-[var(--field-bg)] transition cursor-pointer"
                    title={t('settings.delete', 'Hapus')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </SettingsSection>
    </>
  )
}
