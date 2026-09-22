import { useState, useMemo } from 'react'
import { format, addDays, startOfMonth, startOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parse } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, Check, Trash2, ChevronDown } from 'lucide-react'
import BottomSheet from './BottomSheet'
import useTranslation from '../../hooks/useTranslation'

export default function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Pilih Tanggal',
  allowClear = false,
  clearLabel = 'Tanpa Tanggal',
  className = '',
  buttonClassName = '',
  title = 'Pilih Tanggal',
  disabled = false,
}) {
  const { t, locale } = useTranslation()
  const dateLocale = locale === 'en' ? enUS : idLocale
  const [isOpen, setIsOpen] = useState(false)

  const weekDayHeaders = useMemo(() => {
    return locale === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
  }, [locale])

  const parsedValue = useMemo(() => {
    if (!value) return null
    try {
      return parse(value, 'yyyy-MM-dd', new Date())
    } catch (err){
      console.warn('[CustomDatePicker]', err)
      return null
    }
  }, [value])

  const [tempDate, setTempDate] = useState(value || '')
  const [viewDate, setViewDate] = useState(() => (parsedValue || new Date()))

  const handleOpen = () => {
    setTempDate(value || '')
    setViewDate(parsedValue || new Date())
    setIsOpen(true)
  }

  const tempSelectedDate = useMemo(() => {
    if (!tempDate) return null
    try {
      return parse(tempDate, 'yyyy-MM-dd', new Date())
    } catch (err){
      console.warn('[CustomDatePicker]', err)
      return null
    }
  }, [tempDate])

  // Fixed 6-week grid (42 days)
  const monthStart = startOfMonth(viewDate)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = addDays(startDate, 41)
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const setQuickDate = (daysToAdd) => {
    const target = addDays(new Date(), daysToAdd)
    const formatted = format(target, 'yyyy-MM-dd')
    setTempDate(formatted)
    setViewDate(target)
  }

  const setEndOfMonthDate = () => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const formatted = format(lastDay, 'yyyy-MM-dd')
    setTempDate(formatted)
    setViewDate(lastDay)
  }

  const handleClear = () => {
    setTempDate('')
  }

  const handleApply = () => {
    onChange(tempDate)
    setIsOpen(false)
  }

  const displayFormatted = useMemo(() => {
    if (!parsedValue) return ''
    try {
      return format(parsedValue, 'dd MMM yyyy', { locale: dateLocale })
    } catch (err){
      console.warn('[CustomDatePicker]', err)
      return value || ''
    }
  }, [parsedValue, value, dateLocale])

  return (
    <div className={`relative min-w-0 ${className}`}>
      {label && (
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-left text-xs font-semibold transition-all shadow-2xs cursor-pointer hover:border-[var(--border-strong)] active:scale-[0.99] ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Calendar
            className={`h-3.5 w-3.5 shrink-0 ${displayFormatted ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
            strokeWidth={2.2}
          />
          <span className={`truncate ${displayFormatted ? 'text-[var(--fg)] font-extrabold' : 'text-[var(--muted)] font-normal'}`}>
            {displayFormatted || placeholder}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        maxWidth="max-w-sm"
        maxHeight="max-h-[min(88dvh,42rem)]"
        className="overflow-hidden"
      >
        <div className="space-y-3 pt-1">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--border)]/60 overflow-x-auto ft-hide-scrollbar">
            {allowClear && tempDate && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 border border-rose-500/30 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Trash2 className="h-3 w-3" />
                {clearLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuickDate(0)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {t('datepicker.today', 'Hari Ini')}
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(1)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {t('datepicker.tomorrow', 'Besok')}
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(7)}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {t('datepicker.plus7Days', '+7 Hari')}
            </button>
            <button
              type="button"
              onClick={setEndOfMonthDate}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)]/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              {t('datepicker.endOfMonth', 'Akhir Bulan')}
            </button>
          </div>

          {/* Month Header */}
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--fg)]">
              {format(viewDate, 'MMMM yyyy', { locale: dateLocale })}
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
          <div className="select-none">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--muted)] mb-1">
              {weekDayHeaders.map((dayName) => (
                <span key={dayName}>{dayName}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
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
                    }}
                    className={`h-8 w-full rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent)] text-white font-extrabold shadow-md ring-2 ring-[var(--accent)]/30 scale-105'
                        : isDayToday
                        ? 'border border-[var(--accent)]/60 text-[var(--accent)] font-extrabold'
                        : isCurrentMonth
                        ? 'text-[var(--fg)] font-bold hover:bg-[var(--field-bg)]'
                        : 'text-[var(--muted)]/40 font-medium'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={handleApply}
            className="w-full py-2.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-extrabold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
          >
            <Check className="h-4 w-4" />
            {t('common.done', 'Selesai')}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
