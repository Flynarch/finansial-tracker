import { format, getDay, parse, startOfWeek, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { enUS, id } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calendar as ReactBigCalendar } from 'react-big-calendar'
import { dateFnsLocalizer } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '../styles/react-big-calendar-overrides.css'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import CategoryIcon from '../components/ui/CategoryIcon'
import CategoryPickerModal from '../components/transactions/CategoryPickerModal'
import WalletSelectModal, { WalletSelectTrigger } from '../components/ui/WalletSelectModal'
import { db } from '../lib/db'
import { createTransaction } from '../services/transactionService'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { getTransactionCategoryLabels, resolveTransactionIconKey } from '../lib/categoryIcon'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import { formatCurrency, formatMoneyInput, getMoneyInputCaret, parseMoneyInput, toSafeNumber } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { Trash2, ChevronRight, ChevronLeft, CheckCircle2, Circle } from 'lucide-react'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS, en: enUS, id },
})

function toDateOnlyString(date) {
  return format(date, 'yyyy-MM-dd')
}

function toLocalDate(dateString) {
  return new Date(`${dateString}T12:00:00`)
}

function sameDate(a, b) {
  if (!a || !b) return false
  return format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd')
}

/* ─── Premium Calendar Toolbar ─── */
function Toolbar({ label, onNavigate, t }) {
  return (
    <div className="ft-cal-toolbar mb-4 flex items-center justify-between rounded-2xl bg-[var(--field-bg)] px-3 py-2.5 shadow-sm ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--panel-strong)] text-[var(--fg)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,var(--border))] active:scale-95 cursor-pointer"
          onClick={() => onNavigate('PREV')}
          aria-label={t('calendar.nav.prev')}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-xl bg-[var(--panel-strong)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--fg)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,var(--border))] active:scale-95 cursor-pointer"
          onClick={() => onNavigate('TODAY')}
          aria-label={t('calendar.nav.today')}
        >
          {t('calendar.nav.today')}
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--panel-strong)] text-[var(--fg)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,var(--border))] active:scale-95 cursor-pointer"
          onClick={() => onNavigate('NEXT')}
          aria-label={t('calendar.nav.next')}
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>
      <div className="px-2 text-[15px] font-bold tracking-tight text-[var(--fg)]" aria-live="polite">
        {label}
      </div>
    </div>
  )
}

/* ─── Premium Date Header ─── */
function MonthDateHeader({ date, label, selectedDate, indicators, onPick }) {
  const key = format(date, 'yyyy-MM-dd')
  const day = indicators.get(key) || { income: 0, expense: 0, reminder: 0 }
  const isSelected = sameDate(date, selectedDate)
  const isToday = sameDate(date, new Date())
  const showDots = day.income + day.expense + day.reminder > 0

  return (
    <button
      type="button"
      className={`group flex w-full flex-col items-center justify-center gap-1 p-1.5 transition-colors focus:outline-none`}
      onClick={() => onPick(date)}
      aria-label={`Day ${label}`}
    >
      <div
        className={`flex h-8 w-8 flex-col items-center justify-center rounded-full text-[13px] font-bold transition-all ${
          isSelected
            ? 'bg-[var(--accent)] text-[var(--bg)] shadow-md scale-110'
            : isToday
              ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)] ring-1 ring-[var(--accent)]'
              : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
        }`}
      >
        {label}
      </div>
      <div className="flex h-1.5 w-full items-center justify-center gap-0.5">
        {showDots && (
          <>
            {day.expense > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-expense)]" />}
            {day.income > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-income)]" />}
            {day.reminder > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />}
          </>
        )}
      </div>
    </button>
  )
}

function EmptyMonthEvent() {
  return null
}

function Calendar() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const [isEntering, setIsEntering] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])
  const [isDayModalOpen, setIsDayModalOpen] = useState(false)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [dayTab, setDayTab] = useState('items') // items | add
  const [txForm, setTxForm] = useState({
    type: 'expense',
    category: '',
    amount: '',
    currency: defaultCurrency || 'IDR',
    notes: '',
    walletId: defaultWalletId || '',
  })
  const [amountInput, setAmountInput] = useState('')
  const [importantForm, setImportantForm] = useState({
    title: '',
    type: 'reminder',
    color: 'var(--accent)',
  })

  const calStart = useMemo(() => format(startOfMonth(subMonths(selectedDate, 2)), 'yyyy-MM-dd'), [selectedDate])
  const calEnd = useMemo(() => format(endOfMonth(addMonths(selectedDate, 2)), 'yyyy-MM-dd'), [selectedDate])

  const transactions = useLiveQuery(
    () => db.transactions.where('date').between(calStart, calEnd, true, true).toArray(),
    [calStart, calEnd],
    []
  )
  const importantEvents = useLiveQuery(
    () => db.calendarEvents.where('date').between(calStart, calEnd, true, true).toArray(),
    [calStart, calEnd],
    []
  )
  const loans = useLiveQuery(
    () => db.loans.where('dueDate').between(calStart, calEnd, true, true).toArray(),
    [calStart, calEnd],
    []
  )
  const todos = useLiveQuery(
    () => db.todos.where('dueDate').between(calStart, calEnd, true, true).toArray(),
    [calStart, calEnd],
    []
  )
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  const selectedWallet = useMemo(
    () => (wallets || []).find((w) => String(w.id) === String(txForm.walletId || defaultWalletId)),
    [wallets, txForm.walletId, defaultWalletId],
  )

  const calendarEvents = useMemo(() => {
    const txEvents = (transactions || []).map((tx) => ({
      id: `tx-${tx.id}`,
      source: 'transaction',
      sourceId: tx.id,
      title: tx.notes ? String(tx.notes) : String(tx.category || ''),
      start: toLocalDate(tx.date),
      end: toLocalDate(tx.date),
      allDay: true,
      type: tx.type,
      color:
        tx.type === 'income'
          ? 'var(--status-income)'
          : tx.type === 'transfer'
            ? 'var(--accent)'
            : 'var(--status-expense)',
      raw: tx,
    }))
    const customEvents = (importantEvents || []).map((event) => ({
      id: `event-${event.id}`,
      source: 'important',
      sourceId: event.id,
      title: event.title,
      start: toLocalDate(event.date),
      end: toLocalDate(event.date),
      allDay: true,
      type: event.type,
      color: event.color || 'var(--accent)',
      raw: event,
    }))
    const loanEvents = (loans || [])
      .filter((loan) => loan.status !== 'paid' && loan.status !== 'forgiven' && toSafeNumber(loan.remainingAmount ?? loan.totalAmount) > 0)
      .map((loan) => ({
      id: `loan-${loan.id}`,
      source: 'loan',
      sourceId: loan.id,
      title: `${loan.type === 'debt' ? t('loans.debtDueDate', 'Jatuh Tempo Hutang') : t('loans.receivableDueDate', 'Jatuh Tempo Piutang')}: ${loan.title || loan.personName}`,
      start: toLocalDate(loan.dueDate),
      end: toLocalDate(loan.dueDate),
      allDay: true,
      type: 'loan',
      color: loan.type === 'debt' ? 'var(--status-expense)' : 'var(--accent)',
      raw: loan,
    }))
    const todoEvents = (todos || []).map((todo) => ({
      id: `todo-${todo.id}`,
      source: 'todo',
      sourceId: todo.id,
      title: `To-Do: ${todo.title}`,
      start: toLocalDate(todo.dueDate),
      end: toLocalDate(todo.dueDate),
      allDay: true,
      type: 'todo',
      color: todo.completed ? 'var(--status-income)' : 'var(--accent)',
      raw: todo,
    }))
    return [...txEvents, ...customEvents, ...loanEvents, ...todoEvents]
  }, [importantEvents, loans, todos, transactions, t])

  const indicators = useMemo(() => {
    const map = new Map()
    const bump = (dateKey, patch) => {
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, ...patch })
    }
    ;(transactions || []).forEach((tx) => {
      if (!tx?.date) return
      const prev = map.get(tx.date) || { income: 0, expense: 0, reminder: 0 }
      map.set(tx.date, {
        ...prev,
        income: prev.income + (tx.type === 'income' ? 1 : 0),
        expense: prev.expense + (tx.type === 'expense' ? 1 : 0),
      })
    })
    ;(importantEvents || []).forEach((ev) => {
      if (!ev?.date) return
      const prev = map.get(ev.date) || { income: 0, expense: 0, reminder: 0 }
      map.set(ev.date, { ...prev, reminder: prev.reminder + 1 })
    })
    ;(loans || []).forEach((l) => {
      if (!l?.dueDate) return
      const prev = map.get(l.dueDate) || { income: 0, expense: 0, reminder: 0 }
      map.set(l.dueDate, { ...prev, reminder: prev.reminder + 1 })
    })
    ;(todos || []).forEach((td) => {
      if (!td?.dueDate) return
      const prev = map.get(td.dueDate) || { income: 0, expense: 0, reminder: 0 }
      map.set(td.dueDate, { ...prev, reminder: prev.reminder + 1 })
    })
    bump(toDateOnlyString(selectedDate), {})
    return map
  }, [importantEvents, loans, todos, selectedDate, transactions])

  const dayItems = useMemo(() => {
    const target = toDateOnlyString(selectedDate)
    return {
      transactions: (transactions || []).filter((tx) => tx.date === target),
      events: (importantEvents || []).filter((event) => event.date === target),
      loans: (loans || []).filter((loan) => loan.dueDate === target),
      todos: (todos || []).filter((todo) => todo.dueDate === target),
    }
  }, [importantEvents, loans, todos, selectedDate, transactions])

  const [txSubmitError, setTxSubmitError] = useState('')

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

  const eventStyleGetter = () => ({ style: { display: 'none' } }) // Handled in dots instead of chips

  return (
    <div className="min-h-full">
      <div
        className={`ft-motion-page min-h-full space-y-4 transform-gpu ${
          isEntering ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Header */}
        <PageHeader
          title={t('calendar.title')}
          subtitle={t('calendar.subtitle')}
          titlePosition="left"
          className="pt-2 !mb-0"
        />

      {/* ── Premium Calendar Wrapper ── */}
      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-[var(--shadow-card)] sm:p-5">
        <div className="ft-cal-shell">
          <ReactBigCalendar
            localizer={localizer}
            culture={locale === 'id' ? 'id' : 'en-US'}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            views={['month']}
            selectable
            popup={false}
            style={{ height: 480 }}
            onSelectSlot={({ start }) => {
              setSelectedDate(start)
              setDayTab('add')
              setTxForm((prev) => ({ ...prev, type: 'expense', category: '', notes: '' }))
              setAmountInput('')
              setIsDayModalOpen(true)
            }}
            onSelectEvent={(event) => {
              setSelectedDate(event.start)
              setDayTab('items')
              setTxForm((prev) => ({ ...prev, type: 'expense', category: '', notes: '' }))
              setAmountInput('')
              setIsDayModalOpen(true)
            }}
            onNavigate={(date) => setSelectedDate(date)}
            eventPropGetter={eventStyleGetter}
            components={{
              toolbar: (props) => <Toolbar {...props} t={t} />,
              month: {
                event: EmptyMonthEvent,
                dateHeader: (props) => (
                  <MonthDateHeader
                    {...props}
                    indicators={indicators}
                    selectedDate={selectedDate}
                    onPick={(d) => {
                      setSelectedDate(d)
                      setDayTab('items')
                      setIsDayModalOpen(true)
                    }}
                  />
                ),
              },
            }}
          />
        </div>
      </div>

      {/* ── Premium Day Modal ── */}
      <Modal
        isOpen={isDayModalOpen}
        title={format(selectedDate, 'dd MMMM yyyy', { locale: locale === 'id' ? id : enUS })}
        onClose={() => setIsDayModalOpen(false)}
      >
        <div className="space-y-4">
          <div className="inline-flex w-full rounded-xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] p-1 backdrop-blur-md">
            <button
              type="button"
              className={`flex-1 rounded-[0.625rem] py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                dayTab === 'items' ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
              onClick={() => setDayTab('items')}
            >
              {t('calendar.transactions')}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-[0.625rem] py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                dayTab === 'add' ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
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
                  {dayItems.transactions.length === 0 ? (
                    <EmptyState title={t('calendar.noTransactions')} />
                  ) : (
                    dayItems.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="group relative overflow-hidden rounded-[1rem] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_60%,transparent)] p-3 transition hover:bg-[var(--field-bg)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                              style={{
                                background: tx.type === 'income' ? 'color-mix(in srgb, var(--status-income) 15%, transparent)' : 'color-mix(in srgb, var(--status-expense) 15%, transparent)',
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
                                const noteStr = tx.notes ? String(tx.notes).trim() : ''
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
                              style={{ color: tx.type === 'income' ? 'var(--status-income)' : 'var(--status-expense)' }}
                            >
                              {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount, tx.currency)}
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
                  {dayItems.events.length === 0 && dayItems.loans.length === 0 ? (
                    <EmptyState title={t('calendar.noImportantDates')} />
                  ) : (
                    <>
                      {dayItems.loans.map((loan) => (
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
                                {loan.type === 'debt' ? t('loans.debtDueDate', 'Jatuh Tempo Hutang') : t('loans.receivableDueDate', 'Jatuh Tempo Piutang')}: {loan.title || loan.personName}
                              </p>
                              <p className="truncate text-xs font-medium text-[var(--muted)]">
                                {t('loans.remaining', 'Sisa')}: {formatCurrency(loan.remainingAmount ?? loan.totalAmount, loan.currency || defaultCurrency)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {dayItems.events.map((event) => (
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
                  {dayItems.todos.length > 0 && (
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      {dayItems.todos.filter((td) => td.completed).length}/{dayItems.todos.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {dayItems.todos.length === 0 ? (
                    <EmptyState title={t('calendar.noTodos', 'Tidak ada tugas to-do pada tanggal ini.')} />
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
                              await db.todos.update(todo.id, { completed: !todo.completed })
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
                              setIsDayModalOpen(false)
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
                            setIsDayModalOpen(false)
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
                        <span className={`truncate text-sm ${!txForm.category || !txForm.category.trim() ? 'font-normal italic text-[var(--muted)]' : 'font-semibold text-[var(--fg)]'}`}>
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
                    <CategoryPickerModal
                      isOpen={isCatModalOpen}
                      onClose={() => setIsCatModalOpen(false)}
                      txType={txForm.type || 'expense'}
                      selectedCategory={txForm.category}
                      onSelectCategory={(cat) => setTxForm((prev) => ({ ...prev, category: cat }))}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-2)]">
                      Dompet / Akun
                    </label>
                    <WalletSelectTrigger
                      wallet={selectedWallet}
                      placeholder={t('wallets.selectPlaceholder', 'Pilih Dompet')}
                      onClick={() => setIsWalletModalOpen(true)}
                    />
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
                            try { event.target.setSelectionRange(caret, caret) } catch { /* ignore */ }
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
                        {currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
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
    </div>
  </div>
  )
}

export default Calendar
