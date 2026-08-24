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
  Edit2,
  Power,
  Tag,
} from 'lucide-react'
import CustomDatePicker from '../../components/ui/CustomDatePicker'
import Modal from '../../components/ui/Modal'
import WalletSelectModal, { WalletSelectTrigger } from '../../components/ui/WalletSelectModal'
import CategoryPickerModal from '../../components/transactions/CategoryPickerModal'
import { db } from '../../lib/db'
import {
  formatCurrency,
  toSafeNumber,
  formatMoneyInput,
  parseMoneyInput,
  formatMoneyValueForInput,
} from '../../lib/utils'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection, SettingsSegmentControl } from './settingsComponents'

export default function SettingsRecurring() {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const recurringTransactions = useLiveQuery(() => db.recurringTransactions.toArray(), [], [])
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  const [recurringForm, setRecurringForm] = useState({
    title: '',
    type: 'expense',
    category: 'tagihan/listrik',
    amount: '',
    currency: defaultCurrency,
    notes: '',
    frequency: 'monthly',
    nextDate: format(new Date(), 'yyyy-MM-dd'),
    walletId: defaultWalletId || '',
  })

  // Edit modal state
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '',
    type: 'expense',
    category: '',
    amount: '',
    currency: defaultCurrency,
    notes: '',
    frequency: 'monthly',
    nextDate: format(new Date(), 'yyyy-MM-dd'),
    walletId: '',
  })

  // Pickers state for add form
  const [isWalletPickerOpen, setIsWalletPickerOpen] = useState(false)
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)

  // Pickers state for edit form
  const [isEditWalletPickerOpen, setIsEditWalletPickerOpen] = useState(false)
  const [isEditCategoryPickerOpen, setIsEditCategoryPickerOpen] = useState(false)

  const selectedWallet = useMemo(
    () => (wallets || []).find((w) => String(w.id) === String(recurringForm.walletId)),
    [wallets, recurringForm.walletId],
  )

  const selectedEditWallet = useMemo(
    () => (wallets || []).find((w) => String(w.id) === String(editForm.walletId)),
    [wallets, editForm.walletId],
  )

  const typeOptions = useMemo(
    () => [
      { value: 'expense', label: t('common.expense', 'Pengeluaran'), icon: TrendingDown },
      { value: 'income', label: t('common.income', 'Pemasukan'), icon: TrendingUp },
    ],
    [t],
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
    const numericAmount = parseMoneyInput(recurringForm.amount, recurringForm.currency)
    if (!recurringForm.title || numericAmount <= 0) return

    await db.recurringTransactions.add({
      ...recurringForm,
      amount: numericAmount,
      currency: recurringForm.currency || defaultCurrency,
      enabled: 1,
      createdAt: new Date().toISOString(),
    })

    setRecurringForm({
      title: '',
      type: 'expense',
      category: 'tagihan/listrik',
      amount: '',
      currency: defaultCurrency,
      notes: '',
      frequency: 'monthly',
      nextDate: format(new Date(), 'yyyy-MM-dd'),
      walletId: defaultWalletId || '',
    })
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setEditForm({
      title: item.title || '',
      type: item.type || 'expense',
      category: item.category || '',
      amount: formatMoneyValueForInput(item.amount, item.currency || defaultCurrency),
      currency: item.currency || defaultCurrency,
      notes: item.notes || '',
      frequency: item.frequency || 'monthly',
      nextDate: item.nextDate || format(new Date(), 'yyyy-MM-dd'),
      walletId: item.walletId || '',
    })
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingItem?.id) return
    const numericAmount = parseMoneyInput(editForm.amount, editForm.currency)
    if (!editForm.title || numericAmount <= 0) return

    await db.recurringTransactions.update(editingItem.id, {
      ...editForm,
      amount: numericAmount,
    })

    setEditingItem(null)
  }

  const handleToggleEnabled = async (item, e) => {
    e?.stopPropagation()
    const isCurrentlyEnabled = item.enabled === 1 || item.enabled === true
    await db.recurringTransactions.update(item.id, {
      enabled: isCurrentlyEnabled ? 0 : 1,
    })
  }

  const activeItems = (recurringTransactions || []).filter(
    (item) => item.enabled === 1 || item.enabled === true,
  )

  const totalMonthlyRecurringExpense = activeItems
    .filter((item) => item.type === 'expense')
    .reduce((acc, curr) => acc + toSafeNumber(curr.amount), 0)

  const totalMonthlyRecurringIncome = activeItems
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
              {activeItems.length} / {(recurringTransactions || []).length}
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
              onChange={(val) =>
                setRecurringForm((prev) => ({
                  ...prev,
                  type: val,
                  category: val === 'expense' ? 'tagihan/listrik' : 'gaji/gaji_bulanan',
                }))
              }
              ariaLabel="Tipe Transaksi"
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                {t('settings.recurring.field.title', 'Nama Transaksi')} *
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
                {t('settings.recurring.field.amount', 'Nominal')} *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="0"
                value={recurringForm.amount}
                onChange={(event) =>
                  setRecurringForm((prev) => ({
                    ...prev,
                    amount: formatMoneyInput(event.target.value, recurringForm.currency),
                  }))
                }
                className="ft-settings-field-compact font-mono font-black text-base h-12"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Kategori
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(true)}
                className="flex h-12 w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 text-left transition hover:border-[var(--border-strong)]"
              >
                <div className="flex items-center gap-2 truncate">
                  <Tag className="h-4 w-4 text-[var(--muted)] shrink-0" />
                  <span className="truncate text-xs font-bold text-[var(--fg)]">
                    {recurringForm.type === 'expense'
                      ? formatExpenseCategory(recurringForm.category, locale)
                      : formatIncomeCategory(recurringForm.category, locale)}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[var(--accent)] shrink-0">Ubah ›</span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Dompet / Akun *
              </label>
              <WalletSelectTrigger
                wallet={selectedWallet}
                placeholder={t('wallets.selectPlaceholder', 'Pilih Dompet')}
                onClick={() => setIsWalletPickerOpen(true)}
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
            disabled={!recurringForm.title || !parseMoneyInput(recurringForm.amount, recurringForm.currency)}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[var(--fg)] py-3 px-4 text-sm font-black text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer disabled:opacity-50"
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
            const isEnabled = item.enabled === 1 || item.enabled === true
            const itemWallet = (wallets || []).find((w) => String(w.id) === String(item.walletId))

            return (
              <div
                key={item.id}
                className={`ft-settings-cell flex items-center justify-between gap-3.5 transition-opacity ${
                  isEnabled ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-2xs ${
                      isExpense
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    }`}
                  >
                    {isExpense ? (
                      <TrendingDown className="h-5.5 w-5.5" />
                    ) : (
                      <TrendingUp className="h-5.5 w-5.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[15px] font-extrabold text-[var(--fg)] leading-tight">{item.title}</p>
                      {!isEnabled && (
                        <span className="rounded-md bg-slate-500/15 border border-slate-500/20 px-1.5 py-0.2 text-[9px] font-bold text-[var(--muted)]">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[var(--muted)] flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-block rounded-lg bg-[var(--field-bg)] px-2 py-0.5 border border-[var(--border)] text-[10px] font-black uppercase text-[var(--muted)]">
                        {recurringFrequencyLabel(item.frequency)}
                      </span>
                      {itemWallet && (
                        <span className="text-[11px] font-bold text-[var(--fg)]/80">
                          • {itemWallet.name}
                        </span>
                      )}
                      <span>• Jatuh tempo: {item.nextDate}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-sm sm:text-base font-black font-mono ${
                      isExpense ? 'text-[var(--status-expense)]' : 'text-[var(--status-income)]'
                    }`}
                  >
                    {isExpense ? '-' : '+'}
                    {formatCurrency(item.amount, item.currency || defaultCurrency, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleToggleEnabled(item, e)}
                    className={`grid h-8 w-8 place-items-center rounded-xl border transition cursor-pointer ${
                      isEnabled
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                        : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                    title={isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer shadow-2xs"
                    title={t('common.edit', 'Ubah')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => db.recurringTransactions.delete(item.id)}
                    className="grid h-8 w-8 place-items-center rounded-xl text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                    title={t('settings.delete', 'Hapus')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </SettingsSection>

      <CategoryPickerModal
        isOpen={isEditCategoryPickerOpen}
        onClose={() => setIsEditCategoryPickerOpen(false)}
        type={editForm.type}
        selectedCategory={editForm.category}
        onSelectCategory={(cat) => setEditForm((prev) => ({ ...prev, category: cat }))}
      />

      <WalletSelectModal
        isOpen={isEditWalletPickerOpen}
        onClose={() => setIsEditWalletPickerOpen(false)}
        wallets={wallets || []}
        selectedWalletId={editForm.walletId}
        onSelectWallet={(id) => setEditForm((prev) => ({ ...prev, walletId: id }))}
        allowNone={false}
      />

      {/* Edit Recurring Modal */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={t('recurring.editTitle', 'Ubah Jadwal Otomatis')}
      >
        <form onSubmit={handleSaveEdit} className="space-y-3.5 pt-1">
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Nama Transaksi *
            </label>
            <input
              type="text"
              required
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              className="ft-settings-field-compact font-semibold h-11"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Nominal *
            </label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={editForm.amount}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  amount: formatMoneyInput(e.target.value, editForm.currency),
                }))
              }
              className="ft-settings-field-compact font-mono font-black text-base h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Kategori
              </label>
              <button
                type="button"
                onClick={() => setIsEditCategoryPickerOpen(true)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 text-left transition hover:border-[var(--border-strong)] text-xs font-bold"
              >
                <span className="truncate">
                  {editForm.type === 'expense'
                    ? formatExpenseCategory(editForm.category, locale)
                    : formatIncomeCategory(editForm.category, locale)}
                </span>
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                Dompet / Akun
              </label>
              <WalletSelectTrigger
                wallet={selectedEditWallet}
                placeholder={t('wallets.selectPlaceholder', 'Pilih Dompet')}
                onClick={() => setIsEditWalletPickerOpen(true)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Frekuensi
            </label>
            <SettingsSegmentControl
              options={frequencyOptions}
              value={editForm.frequency}
              onChange={(val) => setEditForm((prev) => ({ ...prev, frequency: val }))}
              ariaLabel="Frekuensi"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Tanggal Jatuh Tempo Berikutnya
            </label>
            <CustomDatePicker
              value={editForm.nextDate}
              onChange={(val) => setEditForm((prev) => ({ ...prev, nextDate: val }))}
              title={t('calendar.selectDate', 'Pilih Tanggal')}
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!editForm.title || !parseMoneyInput(editForm.amount, editForm.currency)}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Picker for Edit Form */}
      <CategoryPickerModal
        isOpen={isEditCategoryPickerOpen}
        onClose={() => setIsEditCategoryPickerOpen(false)}
        txType={editForm.type || 'expense'}
        selectedCategory={editForm.category}
        onSelectCategory={(cat) => setEditForm((prev) => ({ ...prev, category: cat }))}
      />

      {/* Wallet Picker for Edit Form */}
      <WalletSelectModal
        isOpen={isEditWalletPickerOpen}
        onClose={() => setIsEditWalletPickerOpen(false)}
        wallets={wallets || []}
        selectedWalletId={editForm.walletId}
        onSelectWallet={(wId) => {
          setEditForm((prev) => ({ ...prev, walletId: wId }))
          setIsEditWalletPickerOpen(false)
        }}
      />
    </>
  )
}
