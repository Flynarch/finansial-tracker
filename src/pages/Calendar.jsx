import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calendar as ReactBigCalendar } from 'react-big-calendar'
import { dateFnsLocalizer } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '../styles/react-big-calendar-overrides.css'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import CategoryIcon from '../components/ui/CategoryIcon'
import CategoryPickerModal from '../components/transactions/CategoryPickerModal'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import { getTransactionCategoryLabels, resolveTransactionIconKey } from '../lib/categoryIcon'
import { formatExpenseCategory } from '../lib/expenseCategories'
import { formatIncomeCategory } from '../lib/incomeCategories'
import { formatCurrency, formatMoneyInput, getMoneyInputCaret, parseMoneyInput } from '../lib/utils'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
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
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-strong)] text-[var(--fg)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,var(--border))] active:scale-95"
          onClick={() => onNavigate('PREV')}
          aria-label={t('calendar.nav.prev')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="flex h-9 items-center justify-center rounded-xl bg-[var(--panel-strong)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--fg)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,var(--border))] active:scale-95"
          onClick={() => onNavigate('TODAY')}
          aria-label={t('calendar.nav.today')}
        >
          {t('calendar.nav.today')}
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-strong)] text-[var(--fg)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[color-mix(in_srgb,var(--field-bg)_80%,var(--border))] active:scale-95"
          onClick={() => onNavigate('NEXT')}
          aria-label={t('calendar.nav.next')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
  const [isEntering, setIsEntering] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])
  const [isDayModalOpen, setIsDayModalOpen] = useState(false)
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [dayTab, setDayTab] = useState('items') // items | add
  const [txForm, setTxForm] = useState({
    type: 'expense',
    category: '',
    amount: '',
    currency: 'IDR',
    notes: '',
  })
  const [amountInput, setAmountInput] = useState('')
  const [importantForm, setImportantForm] = useState({
    title: '',
    type: 'reminder',
    color: '#f59e0b',
  })

  const transactions = useLiveQuery(() => db.transactions.orderBy('date').toArray(), [], [])
  const importantEvents = useLiveQuery(() => db.calendarEvents.orderBy('date').toArray(), [], [])

  const calendarEvents = useMemo(() => {
    const txEvents = transactions.map((tx) => ({
      id: `tx-${tx.id}`,
      source: 'transaction',
      sourceId: tx.id,
      title: tx.notes ? String(tx.notes) : String(tx.category || ''),
      start: toLocalDate(tx.date),
      end: toLocalDate(tx.date),
      allDay: true,
      type: tx.type,
      color: tx.type === 'income' ? 'var(--status-income)' : 'var(--status-expense)',
      raw: tx,
    }))
    const customEvents = importantEvents.map((event) => ({
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
    return [...txEvents, ...customEvents]
  }, [importantEvents, transactions])

  const indicators = useMemo(() => {
    const map = new Map()
    const bump = (dateKey, patch) => {
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, ...patch })
    }
    transactions.forEach((tx) => {
      if (!tx?.date) return
      const prev = map.get(tx.date) || { income: 0, expense: 0, reminder: 0 }
      map.set(tx.date, {
        ...prev,
        income: prev.income + (tx.type === 'income' ? 1 : 0),
        expense: prev.expense + (tx.type === 'expense' ? 1 : 0),
      })
    })
    importantEvents.forEach((ev) => {
      if (!ev?.date) return
      const prev = map.get(ev.date) || { income: 0, expense: 0, reminder: 0 }
      map.set(ev.date, { ...prev, reminder: prev.reminder + 1 })
    })
    bump(toDateOnlyString(selectedDate), {})
    return map
  }, [importantEvents, selectedDate, transactions])

  const dayItems = useMemo(() => {
    const target = toDateOnlyString(selectedDate)
    return {
      transactions: transactions.filter((tx) => tx.date === target),
      events: importantEvents.filter((event) => event.date === target),
    }
  }, [importantEvents, selectedDate, transactions])

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
    await db.transactions.add({
      date: toDateOnlyString(selectedDate),
      type: txForm.type,
      category: txForm.category,
      amount: parsedAmount,
      currency: txForm.currency,
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
        {/* ── Premium Header ── */}
      <section className="relative overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'radial-gradient(ellipse 120% 120% at 20% -20%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 50%)',
              'radial-gradient(ellipse 80% 80% at 80% 100%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 50%)',
            ].join(','),
          }}
          aria-hidden="true"
        />
        <div className="relative p-5">
          <h1 className="text-xl font-bold tracking-tight text-[var(--fg)] sm:text-2xl">{t('calendar.title')}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('calendar.subtitle')}</p>
        </div>
      </section>

      {/* ── Premium Calendar Wrapper ── */}
      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-[var(--shadow-card)] sm:p-5">
        <div className="ft-cal-shell">
          <ReactBigCalendar
            localizer={localizer}
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
        title={format(selectedDate, 'dd MMMM yyyy')}
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
                                return (
                                  <>
                                    <p className="truncate text-sm font-semibold text-[var(--fg)]">{labels.main}</p>
                                    {sub ? (
                                      <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-[var(--muted)]">
                                        {sub}
                                      </p>
                                    ) : null}
                                    {noteStr ? (
                                      <p className="mt-0.5 truncate text-[10px] italic leading-tight text-[var(--muted-2)]">
                                        {noteStr}
                                      </p>
                                    ) : null}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-[15px] font-bold tabular-nums tracking-tight"
                              style={{ color: tx.type === 'income' ? 'var(--status-income)' : 'var(--status-expense)' }}
                            >
                              {formatCurrency(tx.amount, tx.currency)}
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
                  {dayItems.events.length === 0 ? (
                    <EmptyState title={t('calendar.noImportantDates')} />
                  ) : (
                    dayItems.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 rounded-[1rem] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--panel-strong)_60%,transparent)] px-4 py-3"
                      >
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
                  <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 animate-[ft-fade-in_0.2s_ease-out]">
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
                      <span className="shrink-0 text-xs font-bold text-[var(--accent)]">{t('tx.change') || 'Ubah'} ›</span>
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
                    className="w-full rounded-xl bg-amber-500 py-3 text-[13px] font-bold uppercase tracking-wider text-amber-950 shadow-sm transition hover:bg-amber-400 active:scale-95 disabled:opacity-50"
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
