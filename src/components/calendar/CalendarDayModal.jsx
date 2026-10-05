import { format } from 'date-fns'
import { enUS, id } from 'date-fns/locale'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import CategoryIcon from '../ui/CategoryIcon'
import CategoryPickerModal from '../transactions/CategoryPickerModal'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import { db } from '../../lib/db'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { createTransaction } from '../../services/transactionService'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'
import { getTransactionCategoryLabels, resolveTransactionIconKey } from '../../lib/categoryIcon'
import { getDecryptedNoteSync } from '../../lib/fieldEncryption'
import { formatExpenseCategory } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'
import { formatCurrency, formatMoneyInput, getMoneyInputCaret, parseMoneyInput } from '../../lib/utils'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

function toDateOnlyString(date) {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

function CalendarDayModal({
  isOpen,
  onClose,
  selectedDate,
  dayItems,
  wallets = [],
  defaultWalletId = '',
  defaultCurrency = 'IDR',
  onEditTx,
  dayTab = 'items',
  setDayTab,
}) {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [txSubmitError, setTxSubmitError] = useState('')
  const [amountInput, setAmountInput] = useState('')

  const [txForm, setTxForm] = useState(() => ({
    type: 'expense',
    category: '',
    amount: '',
    currency: defaultCurrency || 'IDR',
    notes: '',
    walletId: defaultWalletId || (wallets?.[0]?.id ?? ''),
  }))

  const [importantForm, setImportantForm] = useState({
    title: '',
    type: 'reminder',
    color: 'var(--accent)',
  })

  useBackButton(
    () => setDayTab('items'),
    Boolean(isOpen && dayTab === 'add' && !isCatModalOpen && !isWalletModalOpen),
  )

  const selectedWallet = useMemo(
    () => (wallets || []).find((w) => String(w.id) === String(txForm.walletId || defaultWalletId)),
    [wallets, txForm.walletId, defaultWalletId],
  )

  const handleAddTransactionFromDate = async () => {
    setTxSubmitError('')
    const parsedAmount = parseMoneyInput(amountInput, txForm.currency)
    if (!(parsedAmount > 0)) {
      setTxSubmitError(t('addTx.amountRequired', 'Nominal harus lebih dari 0.'))
      return
    }
    if (!txForm.category || !txForm.category.trim()) {
      setTxSubmitError(t('addTx.selectCategoryRequired', 'Silakan pilih kategori terlebih dahulu.'))
      return
    }
    await createTransaction({
      date: toDateOnlyString(selectedDate),
      type: txForm.type,
      category: txForm.category,
      amount: parsedAmount,
      currency: txForm.currency,
      walletId: txForm.walletId || defaultWalletId || (wallets?.[0]?.id ?? null),
      notes: txForm.notes,
      createdAt: Date.now(),
    })
    setAmountInput('')
    setTxForm((prev) => ({ ...prev, notes: '' }))
    setTxSubmitError('')
    setDayTab('items')
  }

  const handleAddImportantDate = async () => {
    if (!importantForm.title.trim()) return
    await db.calendarEvents.add({
      date: toDateOnlyString(selectedDate),
      title: importantForm.title.trim(),
      type: importantForm.type,
      color: importantForm.color,
    })
    setImportantForm((prev) => ({ ...prev, title: '' }))
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      title={selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: locale === 'id' ? id : enUS }) : ''}
      onClose={onClose}
      enableBackButton={dayTab !== 'add'}
    >
      <div className="space-y-4">
        <div className="inline-flex w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-1 backdrop-blur-md">
          <button
            type="button"
            className={`flex-1 rounded-[0.625rem] py-2.5 text-xs font-bold uppercase tracking-wider transition ${
              dayTab === 'items'
                ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => setDayTab('items')}
          >
            {t('calendar.transactions')}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[0.625rem] py-2.5 text-xs font-bold uppercase tracking-wider transition ${
              dayTab === 'add'
                ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => setDayTab('add')}
          >
            {t('calendar.addTransaction')}
          </button>
        </div>

        {dayTab === 'items' ? (
          <div className="space-y-5">
            {/* Transactions List */}
            <section>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {t('calendar.transactions')}
              </h4>
              <div className="space-y-2">
                {!dayItems?.transactions || dayItems.transactions.length === 0 ? (
                  <EmptyState variant="transactions" title={t('calendar.noTransactions')} />
                ) : (
                  dayItems.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onEditTx?.(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onEditTx?.(tx)
                        }
                      }}
                      className="group relative overflow-hidden rounded-[1rem] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_60%,transparent)] p-3 transition hover:bg-[var(--field-bg)] cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                            style={{
                              background:
                                tx.type === 'income'
                                  ? 'color-mix(in srgb, var(--status-income) 15%, transparent)'
                                  : 'color-mix(in srgb, var(--status-expense) 15%, transparent)',
                              color: tx.type === 'income' ? 'var(--status-income)' : 'var(--status-expense)',
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                              {tx.type === 'income' ? (
                                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                              ) : (
                                <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                              )}
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            {(() => {
                              const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
                              const sub = labels.sub || null
                              const resolvedNote = getDecryptedNoteSync(tx.notes)
                              const noteStr = resolvedNote ? String(resolvedNote).trim() : ''
                              const txWallet = wallets?.find((w) => String(w.id) === String(tx.walletId))
                              const walletName = txWallet?.name || 'Wallet'
                              let createdTime = null
                              const createdAtMs = Number(tx.createdAt)
                              if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
                                createdTime = format(new Date(createdAtMs), 'HH:mm')
                              }

                              return (
                                <>
                                  <p className="truncate text-sm font-bold text-[var(--fg)]">{labels.main}</p>
                                  <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-[var(--muted)]">
                                    <span className="text-[var(--fg)]/90 font-bold">{walletName}</span>
                                    {sub ? <> • {sub}</> : null}
                                    {createdTime ? <> • {createdTime}</> : null}
                                  </p>
                                  {noteStr ? (
                                    <p className="mt-0.5 text-[11px] italic leading-tight text-[var(--muted)] line-clamp-2 break-words">
                                      &ldquo;{noteStr}&rdquo;
                                    </p>
                                  ) : null}
                                </>
                              )
                            })()}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className="text-sm sm:text-[15px] font-extrabold tabular-nums tracking-tight"
                            style={{
                              color:
                                tx.type === 'income'
                                  ? 'var(--status-income)'
                                  : tx.type === 'transfer'
                                  ? 'var(--accent)'
                                  : 'var(--status-expense)',
                            }}
                          >
                            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''} {formatCurrency(tx.amount, tx.currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Events List */}
            <section>
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {t('calendar.importantDates')}
              </h4>
              <div className="space-y-2">
                {(!dayItems?.events || dayItems.events.length === 0) && (!dayItems?.loans || dayItems.loans.length === 0) ? (
                  <EmptyState variant="calendar" title={t('calendar.noImportantDates')} />
                ) : (
                  <>
                    {(dayItems?.loans || []).map((loan) => (
                      <div
                        key={`loan-${loan.id}`}
                        className={`flex items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 ${
                          loan.type === 'debt'
                            ? 'border-[var(--status-expense)]/30 bg-[var(--status-expense)]/10'
                            : 'border-[var(--status-income)]/30 bg-[var(--status-income)]/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-[color-mix(in_srgb,var(--bg)_10%,transparent)] shadow-sm ${
                              loan.type === 'debt' ? 'bg-[var(--status-expense)]' : 'bg-[var(--status-income)]'
                            }`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--fg)]">
                              {loan.type === 'debt'
                                ? t('loans.debtDueDate', 'Jatuh Tempo Hutang')
                                : t('loans.receivableDueDate', 'Jatuh Tempo Piutang')}
                              : {loan.title || loan.personName}
                            </p>
                            <p className="truncate text-xs font-medium text-[var(--muted)]">
                              {t('loans.remaining', 'Sisa')}:{' '}
                              {formatCurrency(loan.remainingAmount ?? loan.totalAmount, loan.currency || defaultCurrency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(dayItems?.events || []).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between gap-3 rounded-[1rem] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_60%,transparent)] px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[color-mix(in_srgb,var(--bg)_10%,transparent)] shadow-sm"
                            style={{ backgroundColor: event.color || 'var(--accent)' }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--fg)]">{event.title}</p>
                            <p className="truncate text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{event.type}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => db.calendarEvents.delete(event.id)}
                          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--status-expense)] hover:bg-[var(--status-expense)]/10 transition cursor-pointer shrink-0"
                          title={t('calendar.deleteAgenda', 'Hapus Agenda')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            {/* To-Do Tasks List */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                  {t('calendar.todos', 'Tugas & To-Do')}
                </h4>
                {dayItems?.todos && dayItems.todos.length > 0 && (
                  <span className="text-[11px] font-semibold text-[var(--muted)]">
                    {dayItems.todos.filter((td) => td.completed).length}/{dayItems.todos.length}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {!dayItems?.todos || dayItems.todos.length === 0 ? (
                  <EmptyState variant="todos" title={t('calendar.noTodos', 'Tidak ada tugas to-do pada tanggal ini.')} />
                ) : (
                  dayItems.todos.map((todo) => (
                    <div
                      key={`todo-${todo.id}`}
                      className={`flex items-center justify-between gap-3 rounded-[1rem] border p-3 transition ${
                        todo.completed
                          ? 'border-[color-mix(in_srgb,var(--border)_30%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_40%,transparent)] opacity-60'
                          : 'border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_80%,transparent)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = !todo.completed
                            await db.todos.update(todo.id, {
                              completed: next,
                              ...(next ? { completedAt: new Date().toISOString() } : { completedAt: null }),
                            })
                            if (next && Capacitor.isNativePlatform()) {
                              await LocalNotifications.cancel({
                                notifications: [{ id: 100000 + todo.id * 10 + 1 }, { id: 100000 + todo.id * 10 + 2 }],
                              }).catch(() => {})
                            }
                          }}
                          className="text-[var(--accent)] hover:scale-110 active:scale-95 transition shrink-0 cursor-pointer"
                          aria-label={todo.title}
                        >
                          {todo.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-[var(--muted)]" />
                          )}
                        </button>
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            onClose()
                            navigate(`/todos/${todo.id}`)
                          }}
                        >
                          <p className={`truncate text-sm font-bold ${todo.completed ? 'line-through text-[var(--muted)]' : 'text-[var(--fg)]'}`}>
                            {todo.title}
                          </p>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {todo.category || 'General'}
                            {todo.reminderTime ? ` • ${todo.reminderTime}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate(`/todos/${todo.id}`)
                        }}
                        className="p-1 text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer shrink-0"
                        aria-label={t('common.details', 'Detail')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Add Transaction Section */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4">
              <h5 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {t('calendar.addTransaction')}
              </h5>
              {txSubmitError && (
                <div className="mb-3 rounded-xl border border-[var(--status-expense)]/30 bg-[var(--status-expense)]/10 p-3 text-xs font-semibold text-[var(--status-expense)] animate-[ft-fade-in_0.2s_ease-out]">
                  {txSubmitError}
                </div>
              )}
              <div className="space-y-3.5">
                <div className="inline-flex w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_40%,transparent)] p-1">
                  <button
                    type="button"
                    className={`flex-1 rounded-[0.625rem] py-2 text-xs font-bold uppercase tracking-wider transition ${
                      txForm.type === 'expense'
                        ? 'bg-[var(--panel-strong)] text-[var(--status-expense)] shadow-sm ring-1 ring-[var(--status-expense)] ring-opacity-50'
                        : 'text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                    onClick={() =>
                      setTxForm((p) => ({
                        ...p,
                        type: 'expense',
                        category: p.type === 'expense' ? p.category : '',
                      }))
                    }
                  >
                    {t('tx.type.expense')}
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-[0.625rem] py-2 text-xs font-bold uppercase tracking-wider transition ${
                      txForm.type === 'income'
                        ? 'bg-[var(--panel-strong)] text-[var(--status-income)] shadow-sm ring-1 ring-[var(--status-income)] ring-opacity-50'
                        : 'text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                    onClick={() =>
                      setTxForm((p) => ({
                        ...p,
                        type: 'income',
                        category: p.type === 'income' ? p.category : '',
                      }))
                    }
                  >
                    {t('tx.type.income')}
                  </button>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-2)]">
                    {t('addTx.category')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCatModalOpen(true)}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 text-left transition hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="flex h-7 w-9 shrink-0 items-center justify-center">
                        <CategoryIcon icon={resolveTransactionIconKey(txForm.category, txForm.type)} className="h-5 w-5" />
                      </span>
                      <span
                        className={`truncate text-sm ${
                          !txForm.category || !txForm.category.trim()
                            ? 'font-normal italic text-[var(--muted)]'
                            : 'font-semibold text-[var(--fg)]'
                        }`}
                      >
                        {!txForm.category || !txForm.category.trim()
                          ? t('addTx.selectCategory', 'Pilih Kategori...')
                          : txForm.type === 'expense'
                            ? formatExpenseCategory(txForm.category, locale)
                            : formatIncomeCategory(txForm.category, locale)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[var(--accent)] flex items-center gap-0.5">
                      {t('tx.change') || 'Ubah'}
                      <ChevronRight size={13} strokeWidth={2.5} />
                    </span>
                  </button>
                  {isCatModalOpen && (
                    <CategoryPickerModal
                      isOpen={isCatModalOpen}
                      onClose={() => setIsCatModalOpen(false)}
                      txType={txForm.type || 'expense'}
                      selectedCategory={txForm.category}
                      onSelectCategory={(cat) => setTxForm((prev) => ({ ...prev, category: cat }))}
                    />
                  )}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-2)]">
                    {t('tx.walletOrAccount', 'Dompet / Akun')}
                  </label>
                  <WalletSelectTrigger
                    wallet={selectedWallet}
                    placeholder={t('wallets.selectPlaceholder', 'Pilih Dompet')}
                    onClick={() => setIsWalletModalOpen(true)}
                  />
                  {isWalletModalOpen && (
                    <WalletSelectModal
                      isOpen={isWalletModalOpen}
                      onClose={() => setIsWalletModalOpen(false)}
                      wallets={wallets || []}
                      selectedWalletId={txForm.walletId || defaultWalletId}
                      onSelectWallet={(wId) => {
                        setTxForm((prev) => ({ ...prev, walletId: wId }))
                        setIsWalletModalOpen(false)
                      }}
                    />
                  )}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-2)]">
                    {t('addTx.amount')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      inputMode="decimal"
                      value={amountInput}
                      onChange={(event) => {
                        const raw = event.target.value
                        const next = formatMoneyInput(raw, txForm.currency)
                        const caret = getMoneyInputCaret(raw, next, event.target.selectionStart ?? raw.length, txForm.currency)
                        setAmountInput(next)
                        requestAnimationFrame(() => {
                          try {
                            event.target.setSelectionRange(caret, caret)
                          } catch (err) {
                            console.warn('[CalendarDayModal]', err)
                          }
                        })
                      }}
                      placeholder="0"
                      className="ft-field mt-0 flex-1 font-bold tabular-nums"
                    />
                    <select
                      value={txForm.currency}
                      onChange={(event) => setTxForm((prev) => ({ ...prev, currency: event.target.value }))}
                      className="ft-field mt-0 w-24 font-bold"
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-2)]">
                    {t('addTx.notes')}
                  </label>
                  <input
                    type="text"
                    value={txForm.notes}
                    onChange={(event) => setTxForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder={t('addTx.notesPlaceholder')}
                    className="ft-field mt-0"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddTransactionFromDate}
                  disabled={!(parseMoneyInput(amountInput, txForm.currency) > 0)}
                  className="ft-btn-primary mt-2 w-full py-3 text-[13px] uppercase tracking-wider"
                >
                  {t('addTx.save')}
                </button>
              </div>
            </section>

            {/* Add Event Section */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4">
              <h5 className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted-2)]">
                {t('calendar.addImportantDate')}
              </h5>
              <div className="space-y-3">
                <input
                  type="text"
                  value={importantForm.title}
                  onChange={(event) => setImportantForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={t('calendar.labelPlaceholder')}
                  className="ft-field mt-0"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importantForm.type}
                    onChange={(event) => setImportantForm((prev) => ({ ...prev, type: event.target.value }))}
                    placeholder={t('calendar.typePlaceholder')}
                    className="ft-field mt-0 flex-1"
                  />
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border)]">
                    <input
                      type="color"
                      value={importantForm.color}
                      onChange={(event) => setImportantForm((prev) => ({ ...prev, color: event.target.value }))}
                      className="absolute -inset-2 h-14 w-20 cursor-pointer"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddImportantDate}
                  disabled={!importantForm.title.trim()}
                  className="ft-btn-primary w-full py-3 text-xs font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {t('calendar.addImportantDate')}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default CalendarDayModal
