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
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import WalletSelectModal, { WalletSelectTrigger } from '../../components/ui/WalletSelectModal'
import CategoryPickerModal from '../../components/transactions/CategoryPickerModal'
import { db } from '../../lib/db'
import {
  formatCurrency,
  formatCompactCurrency,
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
    autoExecute: true,
  })

  // Edit modal state
  const [editingItem, setEditingItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)
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
    autoExecute: true,
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
      { value: 'yearly', label: t('settings.recurring.frequency.yearly', 'Tahunan') },
    ],
    [t],
  )

  const recurringFrequencyLabel = (value) => {
    if (value === 'daily') return t('settings.recurring.frequency.daily', 'Harian')
    if (value === 'weekly') return t('settings.recurring.frequency.weekly', 'Mingguan')
    if (value === 'yearly') return t('settings.recurring.frequency.yearly', 'Tahunan')
    return t('settings.recurring.frequency.monthly', 'Bulanan')
  }

  const handleAddRecurring = async (e) => {
    e.preventDefault()
    const numericAmount = parseMoneyInput(recurringForm.amount, recurringForm.currency)
    const targetWalletId = recurringForm.walletId || defaultWalletId || wallets?.[0]?.id || ''
    if (!recurringForm.title || numericAmount <= 0) return

    const parsedAnchor = parseInt(String(recurringForm.nextDate || '').split('-')[2], 10) || new Date().getDate()

    await db.recurringTransactions.add({
      ...recurringForm,
      anchorDay: parsedAnchor,
      walletId: targetWalletId,
      amount: numericAmount,
      currency: recurringForm.currency || defaultCurrency,
      enabled: 1,
      autoExecute: recurringForm.autoExecute !== false,
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
      walletId: defaultWalletId || wallets?.[0]?.id || '',
      autoExecute: true,
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
      walletId: item.walletId || defaultWalletId || wallets?.[0]?.id || '',
      autoExecute: item.autoExecute !== false,
    })
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingItem?.id) return
    const numericAmount = parseMoneyInput(editForm.amount, editForm.currency)
    if (!editForm.title || numericAmount <= 0) return

    const prevDay = parseInt(String(editingItem.nextDate || '').split('-')[2], 10)
    const newDay = parseInt(String(editForm.nextDate || '').split('-')[2], 10) || 1
    const dayChanged = Boolean(editingItem.nextDate && prevDay !== newDay)
    const finalAnchorDay = (editingItem.anchorDay && !dayChanged) ? editingItem.anchorDay : newDay

    await db.recurringTransactions.update(editingItem.id, {
      ...editForm,
      amount: numericAmount,
      anchorDay: finalAnchorDay,
      autoExecute: editForm.autoExecute !== false,
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

  const getMonthlyEstimatedAmount = (item) => {
    const raw = toSafeNumber(item.amount)
    const freq = String(item.frequency || '').toLowerCase()
    const factor = freq === 'daily' ? 30 : freq === 'weekly' ? 4.33 : freq === 'yearly' ? (1 / 12) : 1
    return raw * factor
  }

  const totalMonthlyRecurringExpense = activeItems
    .filter((item) => item.type === 'expense')
    .reduce((acc, curr) => acc + getMonthlyEstimatedAmount(curr), 0)

  const totalMonthlyRecurringIncome = activeItems
    .filter((item) => item.type === 'income')
    .reduce((acc, curr) => acc + getMonthlyEstimatedAmount(curr), 0)

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
              {t('settings.recurringSubtitle', 'Catat tagihan rutin, cicilan, dan gaji secara otomatis tepat waktu')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]/60 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">
              {t('settings.recurring.activeSchedules', 'Jadwal Aktif')}
            </span>
            <span className="block text-xs font-black text-[var(--fg)] mt-0.5 truncate">
              {activeItems.length} / {(recurringTransactions || []).length}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">
              {t('settings.recurring.expenseMonthly', 'Beban/Bulan')}
            </span>
            <span className="block text-[11px] sm:text-xs font-black text-[var(--status-expense)] mt-0.5 tracking-tight leading-tight truncate">
              {formatCompactCurrency(totalMonthlyRecurringExpense, defaultCurrency, locale)}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate">
              {t('settings.recurring.incomeMonthly', 'Masuk/Bulan')}
            </span>
            <span className="block text-[11px] sm:text-xs font-black text-[var(--status-income)] mt-0.5 tracking-tight leading-tight truncate">
              {formatCompactCurrency(totalMonthlyRecurringIncome, defaultCurrency, locale)}
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

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.recurring.executionMode', 'Metode Pencatatan')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecurringForm((prev) => ({ ...prev, autoExecute: true }))}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
                  recurringForm.autoExecute !== false
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-2xs'
                    : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {t('settings.recurring.autoDebit', 'Otomatis Potong Saldo')}
              </button>
              <button
                type="button"
                onClick={() => setRecurringForm((prev) => ({ ...prev, autoExecute: false }))}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
                  recurringForm.autoExecute === false
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-2xs'
                    : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {t('settings.recurring.reminderOnly', 'Hanya Pengingat')}
              </button>
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
            <p className="text-base font-black text-[var(--fg)]">{t('settings.recurring.empty', 'Belum Ada Transaksi Berulang')}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)] max-w-xs mx-auto">
              {t('settings.recurring.emptyDesc', 'Semua jadwal tagihan bulanan atau pemasukan berkala Anda akan tercatat di sini.')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recurringTransactions.map((item) => {
              const isExpense = item.type === 'expense'
              const isEnabled = item.enabled === 1 || item.enabled === true
              const itemWallet = (wallets || []).find((w) => String(w.id) === String(item.walletId))

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] space-y-3 transition-all ${
                    isEnabled ? 'opacity-100 shadow-2xs' : 'opacity-60 bg-[var(--field-bg)]/50'
                  }`}
                >
                  {/* Top Row: Icon + Info + Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border shadow-2xs ${
                          isExpense
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        {isExpense ? (
                          <TrendingDown className="h-5 w-5" />
                        ) : (
                          <TrendingUp className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-extrabold text-[var(--fg)] leading-tight truncate">
                            {item.title}
                          </h4>
                          <span className="inline-flex items-center rounded-md bg-[var(--field-bg)] px-1.5 py-0.5 border border-[var(--border)] text-[10px] font-bold uppercase text-[var(--muted)]">
                            {recurringFrequencyLabel(item.frequency)}
                          </span>
                          {item.autoExecute !== false ? (
                            <span className="inline-flex items-center rounded-md bg-[var(--status-transfer-soft)] border border-[var(--status-transfer)]/30 px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--status-transfer)] uppercase">
                              Auto-Debit
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-500/15 border border-slate-500/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted)] uppercase">
                              {t('settings.recurring.reminderBadge', 'Pengingat')}
                            </span>
                          )}
                          {!isEnabled && (
                            <span className="rounded-md bg-slate-500/15 border border-slate-500/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted)]">
                              {t('settings.inactive', 'Nonaktif')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mt-1 truncate">
                          {itemWallet && (
                            <span className="font-bold text-[var(--fg)]/80 truncate">
                              {itemWallet.name}
                            </span>
                          )}
                          {item.category && (
                            <>
                              <span>•</span>
                              <span className="truncate">
                                {isExpense
                                  ? formatExpenseCategory(item.category, locale)
                                  : formatIncomeCategory(item.category, locale)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm sm:text-base font-black font-mono tracking-tight block ${
                          isExpense ? 'text-[var(--status-expense)]' : 'text-[var(--status-income)]'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatCurrency(item.amount, item.currency || defaultCurrency, locale)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Next Date info + Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--border)]/60 text-xs">
                    <div className="flex items-center gap-1.5 text-[var(--muted)] text-[11px] font-medium min-w-0 truncate">
                      <span className="truncate">{t('settings.recurring.dueDatePrefix', 'Jatuh tempo')}: <strong className="font-bold text-[var(--fg)]">{item.nextDate}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleEnabled(item, e)}
                        className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${
                          isEnabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                        }`}
                        title={isEnabled ? t('common.inactive', 'Nonaktifkan') : t('common.active', 'Aktifkan')}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold">{isEnabled ? t('common.active', 'Aktif') : t('common.inactive', 'Mati')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="h-8 w-8 grid place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
                        title={t('common.edit', 'Ubah')}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingItem(item)}
                        className="h-8 w-8 grid place-items-center rounded-xl text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
                        title={t('settings.delete', 'Hapus')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SettingsSection>

      {/* Category Picker for Add Form */}
      <CategoryPickerModal
        isOpen={isCategoryPickerOpen}
        onClose={() => setIsCategoryPickerOpen(false)}
        txType={recurringForm.type}
        selectedCategory={recurringForm.category}
        onSelectCategory={(cat) => setRecurringForm((prev) => ({ ...prev, category: cat }))}
      />

      {/* Wallet Picker for Add Form */}
      <WalletSelectModal
        isOpen={isWalletPickerOpen}
        onClose={() => setIsWalletPickerOpen(false)}
        wallets={wallets || []}
        selectedWalletId={recurringForm.walletId}
        onSelectWallet={(id) => {
          setRecurringForm((prev) => ({ ...prev, walletId: id }))
          setIsWalletPickerOpen(false)
        }}
        allowNone={false}
      />

      <CategoryPickerModal
        isOpen={isEditCategoryPickerOpen}
        onClose={() => setIsEditCategoryPickerOpen(false)}
        txType={editForm.type}
        selectedCategory={editForm.category}
        onSelectCategory={(cat) => setEditForm((prev) => ({ ...prev, category: cat }))}
      />

      <WalletSelectModal
        isOpen={isEditWalletPickerOpen}
        onClose={() => setIsEditWalletPickerOpen(false)}
        wallets={wallets || []}
        selectedWalletId={editForm.walletId}
        onSelectWallet={(id) => {
          setEditForm((prev) => ({ ...prev, walletId: id }))
          setIsEditWalletPickerOpen(false)
        }}
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
              ariaLabel={t('settings.recurring.frequency', 'Frekuensi')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.recurring.field.nextDate', 'Tanggal Jatuh Tempo')}
            </label>
            <CustomDatePicker
              value={editForm.nextDate}
              onChange={(val) => setEditForm((prev) => ({ ...prev, nextDate: val }))}
              title={t('calendar.selectDate', 'Pilih Tanggal')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('settings.recurring.executionMode', 'Metode Pencatatan')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditForm((prev) => ({ ...prev, autoExecute: true }))}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
                  editForm.autoExecute !== false
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-2xs'
                    : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {t('settings.recurring.autoDebit', 'Otomatis Potong Saldo')}
              </button>
              <button
                type="button"
                onClick={() => setEditForm((prev) => ({ ...prev, autoExecute: false }))}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
                  editForm.autoExecute === false
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-2xs'
                    : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {t('settings.recurring.reminderOnly', 'Hanya Pengingat')}
              </button>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!editForm.title || !parseMoneyInput(editForm.amount, editForm.currency)}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.saveChanges', 'Simpan Perubahan')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (deletingItem?.id) {
            await db.recurringTransactions.delete(deletingItem.id)
            setDeletingItem(null)
          }
        }}
        title={t('settings.deleteRecurringTitle', 'Hapus Transaksi Berulang?')}
        message={t('settings.deleteRecurringDesc', 'Jadwal otomatis untuk transaksi ini akan dihapus permanen.')}
      />
    </>
  )
}
