import { useState, useMemo } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isAfter,
  isBefore,
  parseISO,
  isValid,
  subDays,
  startOfYear,
} from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from './Modal'

export default function CustomDatePickerModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  onSelectRange,
  locale = 'id',
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (startDate && isValid(parseISO(startDate))) return parseISO(startDate)
    return new Date()
  })

  const [selectingTarget, setSelectingTarget] = useState('start') // 'start' | 'end'
  const [tempStart, setTempStart] = useState(startDate || '')
  const [tempEnd, setTempEnd] = useState(endDate || '')

  const dateLocale = locale === 'en' ? enUS : idLocale

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [calendarStart, calendarEnd])

  const parsedStart = useMemo(() => (tempStart ? parseISO(tempStart) : null), [tempStart])
  const parsedEnd = useMemo(() => (tempEnd ? parseISO(tempEnd) : null), [tempEnd])

  const handleDateClick = (day) => {
    const formatted = format(day, 'yyyy-MM-dd')

    if (selectingTarget === 'start') {
      setTempStart(formatted)
      if (tempEnd && formatted > tempEnd) {
        setTempEnd(formatted)
      }
      setSelectingTarget('end')
    } else {
      if (tempStart && formatted < tempStart) {
        setTempStart(formatted)
        setTempEnd(tempStart)
      } else {
        setTempEnd(formatted)
      }
      setSelectingTarget('start')
    }
  }

  const applyPreset = (type) => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    if (type === 'today') {
      setTempStart(todayStr)
      setTempEnd(todayStr)
    } else if (type === '7days') {
      setTempStart(format(subDays(today, 6), 'yyyy-MM-dd'))
      setTempEnd(todayStr)
    } else if (type === 'month') {
      setTempStart(format(startOfMonth(today), 'yyyy-MM-dd'))
      setTempEnd(todayStr)
    } else if (type === 'year') {
      setTempStart(format(startOfYear(today), 'yyyy-MM-dd'))
      setTempEnd(todayStr)
    }
  }

  const handleSave = () => {
    onSelectRange({ startDate: tempStart, endDate: tempEnd })
    onClose()
  }

  const handleReset = () => {
    setTempStart('')
    setTempEnd('')
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} title="Pilih Tanggal Transaksi" onClose={onClose}>
      <div className="space-y-4 py-1">
        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5 pb-1">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: '7days', label: '7 Hari Terakhir' },
            { id: 'month', label: 'Bulan Ini' },
            { id: 'year', label: 'Tahun Ini' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Selected Inputs Display */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5">
          <button
            type="button"
            onClick={() => setSelectingTarget('start')}
            className={`rounded-xl p-2 text-left transition ${
              selectingTarget === 'start'
                ? 'border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] ring-1 ring-[var(--accent)]'
                : 'hover:bg-[var(--panel)]'
            }`}
          >
            <span className="block text-[10px] font-extrabold uppercase text-[var(--muted)]">
              Dari Tanggal
            </span>
            <span className="mt-0.5 block text-xs font-black text-[var(--fg)] truncate">
              {tempStart ? format(parseISO(tempStart), 'dd MMM yyyy', { locale: dateLocale }) : 'Pilih...'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectingTarget('end')}
            className={`rounded-xl p-2 text-left transition ${
              selectingTarget === 'end'
                ? 'border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] ring-1 ring-[var(--accent)]'
                : 'hover:bg-[var(--panel)]'
            }`}
          >
            <span className="block text-[10px] font-extrabold uppercase text-[var(--muted)]">
              Sampai Tanggal
            </span>
            <span className="mt-0.5 block text-xs font-black text-[var(--fg)] truncate">
              {tempEnd ? format(parseISO(tempEnd), 'dd MMM yyyy', { locale: dateLocale }) : 'Pilih...'}
            </span>
          </button>
        </div>

        {/* Month Header Navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="rounded-xl border border-[var(--border)] p-1.5 text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-black text-[var(--fg)]">
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-xl border border-[var(--border)] p-1.5 text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95"
            aria-label="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-1">
          {/* Day Headers */}
          <div className="grid grid-cols-7 text-center">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
              <span key={d} className="py-1 text-[10px] font-black uppercase text-[var(--muted)]">
                {d}
              </span>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isStart = tempStart && dayStr === tempStart
              const isEnd = tempEnd && dayStr === tempEnd
              const isInRange =
                parsedStart &&
                parsedEnd &&
                isAfter(day, parsedStart) &&
                isBefore(day, parsedEnd)

              let dayClasses = 'h-9 w-full rounded-xl text-xs font-bold transition flex items-center justify-center '

              if (!isCurrentMonth) {
                dayClasses += 'text-[var(--muted)]/40 opacity-40 '
              } else {
                dayClasses += 'text-[var(--fg)] '
              }

              if (isStart || isEnd) {
                dayClasses += 'bg-[var(--accent)] text-white shadow-xs font-black '
              } else if (isInRange) {
                dayClasses += 'bg-[color-mix(in_srgb,var(--accent)_18%,var(--field-bg))] text-[var(--accent)] font-black '
              } else if (isCurrentMonth) {
                dayClasses += 'hover:bg-[var(--field-bg)] '
              }

              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className={dayClasses}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="ft-btn-primary flex-1 py-2 text-xs font-bold"
          >
            Simpan Tanggal
          </button>
        </div>
      </div>
    </Modal>
  )
}
