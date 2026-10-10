import { format, getDay, parse, startOfWeek, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { enUS, id } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calendar as ReactBigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '../styles/react-big-calendar-overrides.css'
import PageHeader from '../components/ui/PageHeader'
import TransactionEditSheet from '../components/transactions/TransactionEditSheet'
import CalendarDayModal from '../components/calendar/CalendarDayModal'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import { getDecryptedNoteSync, warmupDecryptionCache, isFieldEncrypted } from '../lib/fieldEncryption'
import { toSafeNumber } from '../lib/utils'
import { generateInstallmentSchedule } from '../lib/loanUtils'
import { ChevronRight, ChevronLeft } from 'lucide-react'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS, en: enUS, id },
})

function toDateOnlyString(date) {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

function toLocalDate(dateString) {
  if (!dateString) return new Date()
  const cleanDate = String(dateString).split('T')[0]
  return new Date(`${cleanDate}T12:00:00`)
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
      className="group flex w-full flex-col items-center justify-center gap-1 p-1.5 transition-colors focus:outline-none"
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
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const defaultWalletId = useSettingsStore((state) => state.defaultWalletId)
  const [isEntering, setIsEntering] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isDayModalOpen, setIsDayModalOpen] = useState(false)
  const [dayTab, setDayTab] = useState('items') // items | add
  const [editingTx, setEditingTx] = useState(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const calStart = useMemo(() => format(subMonths(startOfMonth(selectedDate), 2), 'yyyy-MM-dd'), [selectedDate])
  const calEnd = useMemo(() => format(endOfMonth(addMonths(startOfMonth(selectedDate), 2)), 'yyyy-MM-dd'), [selectedDate])

  const transactions = useLiveQuery(
    async () => {
      const list = await db.transactions.where('date').between(calStart, `${calEnd}\uffff`, true, true).toArray()
      return (list || []).filter((tx) => !tx.deletedAt && tx.isPendingReview !== true && tx.isPendingReview !== 1)
    },
    [calStart, calEnd],
    []
  )
  const importantEvents = useLiveQuery(
    () => db.calendarEvents.where('date').between(calStart, calEnd, true, true).toArray(),
    [calStart, calEnd],
    []
  )
  const loansData = useLiveQuery(
    async () => {
      const inRangeLoans = await db.loans.where('dueDate').between(calStart, calEnd, true, true).toArray()
      const installmentLoans = await db.loans
        .filter((l) => (l.status === 'active' || l.status === 'partially_paid') && Number(l.tenorMonths) > 1)
        .toArray()

      const loanMap = new Map()
      inRangeLoans.forEach((l) => loanMap.set(l.id, l))
      installmentLoans.forEach((l) => loanMap.set(l.id, l))
      const allLoans = Array.from(loanMap.values())

      const loanIds = allLoans.map((l) => l.id)
      const payments = loanIds.length > 0
        ? await db.loanPayments.where('loanId').anyOf(loanIds).toArray()
        : []

      const paymentsByLoan = new Map()
      payments.forEach((p) => {
        if (!paymentsByLoan.has(p.loanId)) paymentsByLoan.set(p.loanId, [])
        paymentsByLoan.get(p.loanId).push(p)
      })

      return { loans: allLoans, paymentsByLoan }
    },
    [calStart, calEnd],
    { loans: [], paymentsByLoan: new Map() }
  )
  const todos = useLiveQuery(
    () => db.todos.where('dueDate').between(calStart, calEnd, true, true).toArray(),
    [calStart, calEnd],
    []
  )
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  const [decryptedTick, setDecryptedTick] = useState(0)

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      warmupDecryptionCache(transactions)
    }
  }, [transactions])

  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((t) => t + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  const calendarEvents = useMemo(() => {
    void decryptedTick
    const txEvents = (transactions || [])
      .filter((tx) => tx.isPendingReview !== true && tx.isPendingReview !== 1)
      .map((tx) => {
        const rawNote = tx.notes
        const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
        const resolvedNote = isFieldEncrypted(plainNote) ? '' : (plainNote || '')
        return {
          id: `tx-${tx.id}`,
          source: 'transaction',
          sourceId: tx.id,
          title: resolvedNote ? String(resolvedNote) : String(tx.category || ''),
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
        }
      })
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
    const loanEvents = []
    const rawLoans = loansData?.loans || []
    const paymentsByLoan = loansData?.paymentsByLoan || new Map()

    for (const loan of rawLoans) {
      if (loan.status === 'paid' || loan.status === 'forgiven' || toSafeNumber(loan.remainingAmount ?? loan.totalAmount) <= 0) {
        continue
      }
      const tenor = parseInt(loan.tenorMonths, 10) || 0
      if (tenor > 1) {
        const pmts = paymentsByLoan.get(loan.id) || []
        const schedule = generateInstallmentSchedule(loan, pmts)
        const relevantInstallments = schedule.filter(
          (inst) => inst.status !== 'paid' && inst.dueDate >= calStart && inst.dueDate <= calEnd
        )
        for (const inst of relevantInstallments) {
          loanEvents.push({
            id: `loan-${loan.id}-inst-${inst.installmentNumber}`,
            source: 'loan',
            sourceId: loan.id,
            title: `${loan.type === 'debt' ? t('loans.debtDueDate', 'Jatuh Tempo Hutang') : t('loans.receivableDueDate', 'Jatuh Tempo Piutang')}: ${loan.title || loan.personName} (#${inst.installmentNumber})`,
            start: toLocalDate(inst.dueDate),
            end: toLocalDate(inst.dueDate),
            allDay: true,
            type: 'loan',
            color: loan.type === 'debt' ? 'var(--status-expense)' : 'var(--accent)',
            raw: { ...loan, installment: inst },
          })
        }
      } else {
        if (loan.dueDate && loan.dueDate >= calStart && loan.dueDate <= calEnd) {
          loanEvents.push({
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
          })
        }
      }
    }
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
  }, [importantEvents, loansData, todos, transactions, t, decryptedTick, calStart, calEnd])

  const indicators = useMemo(() => {
    const map = new Map()
    const bump = (dateKey, patch) => {
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, ...patch })
    }
    ;(transactions || []).forEach((tx) => {
      if (!tx?.date || tx.isPendingReview === true || tx.isPendingReview === 1) return
      const dateKey = String(tx.date).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      let inc = 0
      let exp = 0
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemType = si.type || tx.type
          if (itemType === 'income') inc++
          else if (itemType === 'expense') exp++
        })
      } else {
        if (tx.type === 'income') inc++
        else if (tx.type === 'expense') exp++
      }
      map.set(dateKey, {
        ...prev,
        income: prev.income + inc,
        expense: prev.expense + exp,
      })
    })
    ;(importantEvents || []).forEach((ev) => {
      if (!ev?.date) return
      const dateKey = String(ev.date).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
    })
    for (const l of (loansData?.loans || [])) {
      if (l.status === 'paid' || l.status === 'forgiven' || toSafeNumber(l.remainingAmount ?? l.totalAmount) <= 0) continue
      const tenor = parseInt(l.tenorMonths, 10) || 0
      if (tenor > 1) {
        const pmts = loansData?.paymentsByLoan?.get(l.id) || []
        const schedule = generateInstallmentSchedule(l, pmts)
        schedule.forEach((inst) => {
          if (inst.status !== 'paid' && inst.dueDate) {
            const dateKey = String(inst.dueDate).slice(0, 10)
            const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
            map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
          }
        })
      } else if (l.dueDate) {
        const dateKey = String(l.dueDate).slice(0, 10)
        const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
        map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
      }
    }
    ;(todos || []).forEach((td) => {
      if (!td?.dueDate) return
      const dateKey = String(td.dueDate).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, reminder: 0 }
      map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
    })
    bump(toDateOnlyString(selectedDate), {})
    return map
  }, [importantEvents, loansData, todos, selectedDate, transactions])

  const dayItems = useMemo(() => {
    const target = toDateOnlyString(selectedDate)
    return {
      transactions: (transactions || []).filter((tx) => (tx.date ? String(tx.date).slice(0, 10) === target : false)),
      events: (importantEvents || []).filter((event) => (event.date ? String(event.date).slice(0, 10) === target : false)),
      loans: (() => {
        const result = []
        for (const loan of (loansData?.loans || [])) {
          if (loan.status === 'paid' || loan.status === 'forgiven' || toSafeNumber(loan.remainingAmount ?? loan.totalAmount) <= 0) {
            continue
          }
          const tenor = parseInt(loan.tenorMonths, 10) || 0
          if (tenor > 1) {
            const pmts = loansData?.paymentsByLoan?.get(loan.id) || []
            const schedule = generateInstallmentSchedule(loan, pmts)
            const matchedInst = schedule.find((inst) => inst.status !== 'paid' && inst.dueDate === target)
            if (matchedInst) {
              result.push({
                ...loan,
                installment: matchedInst,
                remainingAmount: matchedInst.remainingAmount ?? matchedInst.amount,
                title: `${loan.title || loan.personName} (#${matchedInst.installmentNumber})`,
              })
            }
          } else {
            if (loan.dueDate && String(loan.dueDate).slice(0, 10) === target) {
              result.push(loan)
            }
          }
        }
        return result
      })(),
      todos: (todos || []).filter((todo) => (todo.dueDate ? String(todo.dueDate).slice(0, 10) === target : false)),
    }
  }, [importantEvents, loansData, todos, selectedDate, transactions])

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
                setIsDayModalOpen(true)
              }}
              onSelectEvent={(event) => {
                setSelectedDate(event.start)
                setDayTab('items')
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

        {/* ── Extracted Day Modal ── */}
        <CalendarDayModal
          isOpen={isDayModalOpen}
          onClose={() => setIsDayModalOpen(false)}
          selectedDate={selectedDate}
          dayItems={dayItems}
          wallets={wallets}
          defaultWalletId={defaultWalletId}
          defaultCurrency={defaultCurrency}
          onEditTx={(tx) => setEditingTx(tx)}
          dayTab={dayTab}
          setDayTab={setDayTab}
        />

        {editingTx && (
          <TransactionEditSheet
            isOpen={Boolean(editingTx)}
            transaction={editingTx}
            onClose={() => setEditingTx(null)}
            onSaved={() => setEditingTx(null)}
            wallets={wallets}
            locale={locale}
          />
        )}
      </div>
    </div>
  )
}

export default Calendar
