import { useState, useMemo, useEffect, useRef } from 'react'
import { format, addDays, startOfMonth, startOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, Trash2 } from 'lucide-react'
import BottomSheet from './BottomSheet'

const ITEM_HEIGHT = 40

function DrumWheelColumn({ items, value, onChange, label, formatLabel }) {
  const containerRef = useRef(null)
  const isUserScrollingRef = useRef(false)
  const debounceTimerRef = useRef(null)

  const [localIndex, setLocalIndex] = useState(() => {
    const idx = items.indexOf(value)
    return idx >= 0 ? idx : 0
  })
  const [prevValue, setPrevValue] = useState(value)

  if (prevValue !== value) {
    setPrevValue(value)
    const idx = items.indexOf(value)
    if (idx >= 0 && idx !== localIndex) {
      setLocalIndex(idx)
    }
  }

  // Sync scroll position when localIndex changes
  useEffect(() => {
    const container = containerRef.current
    if (!container || isUserScrollingRef.current) return
    const targetScroll = localIndex * ITEM_HEIGHT
    if (Math.abs(container.scrollTop - targetScroll) > 3) {
      container.scrollTo({ top: targetScroll, behavior: 'smooth' })
    }
  }, [localIndex])

  const handleScroll = (e) => {
    isUserScrollingRef.current = true
    const container = e.currentTarget
    const scrollTop = container.scrollTop
    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT)
    const safeIndex = Math.max(0, Math.min(items.length - 1, rawIndex))

    if (safeIndex !== localIndex) {
      setLocalIndex(safeIndex)
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      isUserScrollingRef.current = false
      if (items[safeIndex] !== value) {
        onChange(items[safeIndex])
      }
    }, 150)
  }

  return (
    <div className="flex-1 flex flex-col items-center min-w-0">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1 text-center">
        {label}
      </div>
      <div className="relative w-full h-[120px] rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] overflow-hidden shadow-inner">
        {/* Soft Top & Bottom Gradient Fade Overlay Masks */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--field-bg)] to-transparent z-20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--field-bg)] to-transparent z-20" />

        {/* Center Glass Lens Highlight Bar */}
        <div className="absolute top-[40px] inset-x-1.5 h-[40px] rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/35 pointer-events-none z-10 shadow-xs" />

        {/* Scroll Container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative z-10 h-full overflow-y-auto snap-y snap-mandatory ft-hide-scrollbar py-[40px] overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {items.map((item, idx) => {
            const isSelected = idx === localIndex
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setLocalIndex(idx)
                  onChange(item)
                  containerRef.current?.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' })
                }}
                className={`snap-center h-[40px] w-full flex items-center justify-center text-center transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'text-sm font-extrabold text-[var(--accent)] scale-105'
                    : 'text-xs font-semibold text-[var(--muted)] opacity-40 hover:opacity-75'
                }`}
              >
                {formatLabel ? formatLabel(item) : item}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function CustomDateTimePicker({ dateValue, timeValue, onChangeDate, onChangeTime, label = 'Jatuh Tempo & Jam' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempDate, setTempDate] = useState(dateValue || '')
  const [tempTime, setTempTime] = useState(timeValue || '')
  const [viewDate, setViewDate] = useState(() => (dateValue ? new Date(dateValue) : new Date()))

  const handleOpen = () => {
    setTempDate(dateValue || '')
    setTempTime(timeValue || '')
    setViewDate(dateValue ? new Date(dateValue) : new Date())
    setIsOpen(true)
  }

  const selectedDate = useMemo(() => (dateValue ? new Date(dateValue) : null), [dateValue])
  const tempSelectedDate = useMemo(() => (tempDate ? new Date(tempDate) : null), [tempDate])

  // Always generate a fixed 6-week grid (42 days) to prevent layout shifts when changing months
  const monthStart = startOfMonth(viewDate)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = addDays(startDate, 41)
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const setQuickDate = (daysToAdd) => {
    const target = addDays(new Date(), daysToAdd)
    const formatted = format(target, 'yyyy-MM-dd')
    setTempDate(formatted)
    if (!tempTime) setTempTime('09:00')
    setViewDate(target)
  }

  const clearDate = () => {
    setTempDate('')
    setTempTime('')
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  const currentHour = tempTime ? tempTime.split(':')[0] : '09'
  const currentMinute = tempTime ? tempTime.split(':')[1] || '00' : '00'

  const handleHourChange = (h) => {
    if (!tempDate) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setTempDate(today)
    }
    setTempTime(`${h}:${currentMinute}`)
  }

  const handleMinuteChange = (m) => {
    if (!tempDate) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setTempDate(today)
    }
    setTempTime(`${currentHour}:${m}`)
  }

  const handleApply = () => {
    onChangeDate(tempDate)
    onChangeTime?.(tempTime)
    setIsOpen(false)
  }

  return (
    <div className="relative min-w-0">
      {label && <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">{label}</label>}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) handleOpen()
          else setIsOpen(false)
        }}
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
        maxHeight="max-h-[min(88dvh,46rem)]"
        className="overflow-hidden touch-none"
      >
        <div className="space-y-3 pt-1">
          {/* Quick Presets & Clear Action */}
          <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--border)] overflow-x-auto ft-hide-scrollbar">
            {tempDate ? (
              <button
                type="button"
                onClick={clearDate}
                className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 border border-rose-500/30 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Trash2 className="h-3 w-3" />
                Tanpa Tanggal
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setQuickDate(0)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/40 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(1)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/40 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              Besok
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(7)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/40 transition-colors whitespace-nowrap cursor-pointer shrink-0"
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

          {/* Calendar Grid (Non-scrollable, touch-none to prevent sheet scrolling) */}
          <div className="touch-none select-none">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--muted)] mb-1">
              <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
            </div>
            <div className="grid grid-cols-7 gap-1 min-h-[13.5rem]">
              {calendarDays.map((day) => {
                const isSelected = tempSelectedDate && isSameDay(day, tempSelectedDate)
                const isCurrentMonth = isSameMonth(day, monthStart)
                const isDayToday = isToday(day)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      const formatted = format(day, 'yyyy-MM-dd')
                      setTempDate(formatted)
                      if (!tempTime) setTempTime('09:00')
                    }}
                    className={`h-8 w-full rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white font-extrabold shadow-md ring-2 ring-[var(--accent)]/30 scale-105'
                        : isDayToday
                        ? 'border border-[var(--accent)]/60 text-[var(--accent)] font-extrabold'
                        : isCurrentMonth
                        ? 'text-[var(--fg)] font-bold hover:bg-[var(--field-bg)]'
                        : 'text-[var(--muted-2)] font-semibold opacity-35'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Merged Drum Wheel Time Selector */}
          <div className="pt-2.5 border-t border-[var(--border)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--fg)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
                Atur Jam Pelaksanaan
              </span>
              <span className="text-xs font-black tabular-nums bg-[var(--accent)]/15 text-[var(--accent)] px-2.5 py-0.5 rounded-full border border-[var(--accent)]/30">
                {currentHour}:{currentMinute}
              </span>
            </div>

            <div className="flex items-center gap-2 relative pt-0.5">
              <DrumWheelColumn
                items={hours}
                value={currentHour}
                onChange={handleHourChange}
                label="Jam"
                formatLabel={(h) => `${h} Jam`}
              />

              <div className="font-extrabold text-base text-[var(--accent)] opacity-60 self-center pt-4 shrink-0">:</div>

              <DrumWheelColumn
                items={minutes}
                value={currentMinute}
                onChange={handleMinuteChange}
                label="Menit"
                formatLabel={(m) => `${m} Menit`}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleApply}
            className="w-full py-2.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
          >
            <Check className="h-4 w-4" />
            Selesai
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
