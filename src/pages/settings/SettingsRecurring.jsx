import { format } from 'date-fns'
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  RefreshCw,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Layers,
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

  const totalMonthlyRecurringIncome = (recurringTransactions || [])
    .filter((item) => item.type === 'income')
    .reduce((acc, curr) => acc + toSafeNumber(curr.amount), 0)

  return (
    <>
      {/* Overview Hero Summary Banner */}
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
              {t('settings.recurringTitle', 'Transaksi Berulang & Otomasi')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              Catat tagihan rutin, cicilan, dan gaji secara otomatis tepat waktu
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]/60 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Jadwal Aktif</span>
            <span className="block text-xs font-black text-[var(--fg)] mt-0.5">
              {(recurringTransactions || []).length} Jadwal
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Beban/Bulan</span>
            <span className="block text-xs font-black text-[var(--status-expense)] mt-0.5 truncate">
              {formatCurrency(totalMonthlyRecurringExpense, defaultCurrency, locale)}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Masuk/Bulan</span>
            <span className="block text-xs font-black text-[var(--status-income)] mt-0.5 truncate">
              {formatCurrency(totalMonthlyRecurringIncome, defaultCurrency, locale)}
            </span>
          </div>
        </div>
      </div>

      {/* Add New Recurring Form */}
      <SettingsSection label={t('settings.recurring.addTitle', 'Tambah Jadwal Otomatis')}>
        <form onSubmit={handleAddRecurring} className="ft-settings-cell space-y-4">
          <div>
            <SettingsSegmentControl
              options={typeOptions}
              value={recurringForm.type}
              onChange={(val) => setRecurringForm((prev) => ({ ...prev, type: val }))}
              ariaLabel="Tipe Transaksi"
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
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
                className="ft-settings-field-compact font-semibold h-12"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
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
                className="ft-settings-field-compact font-mono font-black text-base h-12"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
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
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
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
            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[var(--fg)] py-3 px-4 text-sm font-black text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>{t('settings.recurring.add', 'Simpan Jadwal Otomatis')}</span>
          </button>
        </form>
      </SettingsSection>

      {/* List Active Recurring Items */}
      <SettingsSection
        label={t('settings.recurring.activeList', 'Daftar Jadwal Transaksi')}
        footnote={t(
          'settings.recurring.footnote',
          'Transaksi akan otomatis dicatat pada dashboard dan saldo akun saat tanggal jatuh tempo tercapai.',
        )}
      >
        {recurringTransactions.length === 0 ? (
          <div className="ft-settings-cell py-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)] mb-3 shadow-2xs">
              <Layers className="h-7 w-7" />
            </div>
            <p className="text-base font-black text-[var(--fg)]">Belum Ada Transaksi Berulang</p>
            <p className="text-xs font-medium text-[var(--muted)] mt-1 max-w-xs mx-auto">
              Jadwalkan pengeluaran rutin atau pemasukan gaji bulanan di atas agar tercatat otomatis.
            </p>
          </div>
        ) : (
          recurringTransactions.map((item) => {
            const isExpense = item.type === 'expense'
            return (
              <div
                key={item.id}
                className="ft-settings-cell flex items-center justify-between gap-3.5"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-2xs ${
                    isExpense
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  }`}>
                    {isExpense ? (
                      <TrendingDown className="h-5.5 w-5.5" />
                    ) : (
                      <TrendingUp className="h-5.5 w-5.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-extrabold text-[var(--fg)] leading-tight">{item.title}</p>
                    <p className="text-xs font-medium text-[var(--muted)] flex items-center gap-1.5 mt-1">
                      <span className="inline-block rounded-lg bg-[var(--field-bg)] px-2 py-0.5 border border-[var(--border)] text-[10px] font-black uppercase text-[var(--muted)]">
                        {recurringFrequencyLabel(item.frequency)}
                      </span>
                      <span>• Jatuh tempo: {item.nextDate}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-sm sm:text-base font-black font-mono ${
                      isExpense ? 'text-[var(--status-expense)]' : 'text-[var(--status-income)]'
                    }`}
                  >
                    {isExpense ? '-' : '+'}
                    {formatCurrency(item.amount, defaultCurrency, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => db.recurringTransactions.delete(item.id)}
                    className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] hover:text-rose-500 hover:bg-[var(--field-bg)] transition cursor-pointer"
                    title={t('settings.delete', 'Hapus')}
                  >
                    <Trash2 className="h-4.5 w-4.5" />
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
