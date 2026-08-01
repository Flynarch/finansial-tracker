import { useState, useMemo, useRef, useEffect } from 'react'
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Calendar, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import BottomSheet from './BottomSheet'

export default function CustomDateTimePicker({ dateValue, timeValue, onChangeDate, onChangeTime, label = 'Jatuh Tempo & Jam' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => (dateValue ? new Date(dateValue) : new Date()))
  const containerRef = useRef(null)

  const selectedDate = useMemo(() => (dateValue ? new Date(dateValue) : null), [dateValue])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const setQuickDate = (daysToAdd) => {
    const target = addDays(new Date(), daysToAdd)
    const formatted = format(target, 'yyyy-MM-dd')
    onChangeDate(formatted)
    if (!timeValue) onChangeTime?.('09:00')
    setViewDate(target)
  }

  const clearDate = () => {
    onChangeDate('')
    onChangeTime?.('')
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']

  const currentHour = timeValue ? timeValue.split(':')[0] : '09'
  const currentMinute = timeValue ? timeValue.split(':')[1] || '00' : '00'

  const handleHourChange = (h) => {
    if (!selectedDate) {
      const today = format(new Date(), 'yyyy-MM-dd')
      onChangeDate(today)
    }
    onChangeTime?.(`${h}:${currentMinute}`)
  }

  const handleMinuteChange = (m) => {
    if (!selectedDate) {
      const today = format(new Date(), 'yyyy-MM-dd')
      onChangeDate(today)
    }
    onChangeTime?.(`${currentHour}:${m}`)
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      {label && <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3 text-left text-sm font-semibold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all shadow-2xs cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className={`h-4 w-4 shrink-0 ${selectedDate ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`} strokeWidth={2.2} />
          <span className={`truncate ${selectedDate ? 'text-[var(--fg)]' : 'text-[var(--muted)]'}`}>
            {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: idLocale }) : 'Tanpa Tenggat Waktu (Opsional)'}
          </span>
          {selectedDate && timeValue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-bold text-[var(--accent)] shrink-0">
              <Clock className="h-3 w-3" />
              {timeValue}
            </span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${isOpen ? 'rotate-90 text-[var(--accent)]' : ''}`} />
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={label || 'Pilih Tanggal & Jam'}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 pt-1">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--border)] overflow-x-auto ft-hide-scrollbar">
            {selectedDate && (
              <button
                type="button"
                onClick={clearDate}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 transition-colors whitespace-nowrap cursor-pointer"
              >
                Tanpa Tanggal
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuickDate(0)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(1)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Besok
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(7)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Minggu Depan
            </button>
          </div>

          {/* Month Header & Nav */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--fg)]">
              {format(viewDate, 'MMMM yyyy', { locale: idLocale })}
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewDate((d) => subMonths(d, 1))}
                className="p-1 rounded-lg border border-[var(--border)] hover:bg-[var(--field-bg)] text-[var(--fg)] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className="p-1 rounded-lg border border-[var(--border)] hover:bg-[var(--field-bg)] text-[var(--fg)] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--muted)] mb-1">
              <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isCurrentMonth = isSameMonth(day, monthStart)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      const formatted = format(day, 'yyyy-MM-dd')
                      onChangeDate(formatted)
                      if (!timeValue) onChangeTime?.('09:00')
                    }}
                    className={`h-8 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white shadow-md scale-105'
                        : isCurrentMonth
                        ? 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                        : 'text-[var(--muted-2)] opacity-40'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Selector (Hour & Minute) */}
          <div className="pt-3 border-t border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--fg)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
                Atur Jam Pelaksanaan
              </span>
              <span className="text-xs font-black tabular-nums text-[var(--accent)]">
                {currentHour}:{currentMinute}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={currentHour}
                onChange={(e) => handleHourChange(e.target.value)}
                className="ft-field text-xs py-1.5 font-bold flex-1 cursor-pointer"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{h} : 00 Jam</option>
                ))}
              </select>
              <span className="font-bold text-[var(--muted)]">:</span>
              <select
                value={currentMinute}
                onChange={(e) => handleMinuteChange(e.target.value)}
                className="ft-field text-xs py-1.5 font-bold flex-1 cursor-pointer"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>{m} Menit</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Selesai
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
