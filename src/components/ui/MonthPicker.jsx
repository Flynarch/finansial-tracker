import { format, parse } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useTranslation from '../../hooks/useTranslation'
import useBottomSheet from '../../hooks/useBottomSheet'

const ITEM_HEIGHT = 48
const VISIBLE_ITEMS = 5
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/* ── Drum Column (iOS-style scroll wheel) ──────────────────────────── */
function DrumColumn({ items, selectedIndex, onSelect, labelKey = 'label' }) {
  const containerRef = useRef(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startScroll = useRef(0)
  const momentum = useRef(null)
  const lastY = useRef(0)
  const lastTime = useRef(0)

  const scrollToIndex = useCallback((idx, smooth = true) => {
    if (!containerRef.current) return
    const target = idx * ITEM_HEIGHT
    containerRef.current.scrollTo({
      top: target,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  // On mount & selection change, snap to item
  useEffect(() => {
    scrollToIndex(selectedIndex, false)
  }, [selectedIndex, scrollToIndex])

  const snapToNearest = useCallback(() => {
    if (!containerRef.current) return
    const scrollTop = containerRef.current.scrollTop
    const idx = clamp(Math.round(scrollTop / ITEM_HEIGHT), 0, items.length - 1)
    onSelect(idx)
    scrollToIndex(idx, true)
  }, [items.length, onSelect, scrollToIndex])

  const handlePointerDown = useCallback((e) => {
    isDragging.current = true
    startY.current = e.clientY || e.touches?.[0]?.clientY || 0
    startScroll.current = containerRef.current?.scrollTop || 0
    lastY.current = startY.current
    lastTime.current = Date.now()
    if (momentum.current) cancelAnimationFrame(momentum.current)
  }, [])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0
    const delta = startY.current - clientY
    containerRef.current.scrollTop = startScroll.current + delta
    lastY.current = clientY
    lastTime.current = Date.now()
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    snapToNearest()
  }, [snapToNearest])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (!containerRef.current) return
    containerRef.current.scrollTop += e.deltaY
    if (momentum.current) cancelAnimationFrame(momentum.current)
    momentum.current = requestAnimationFrame(() => {
      snapToNearest()
    })
  }, [snapToNearest])

  // The padding items create the effect of centering the selected item
  const paddingItems = Math.floor(VISIBLE_ITEMS / 2)

  return (
    <div
      className="month-picker-drum"
      style={{ height: WHEEL_HEIGHT, position: 'relative' }}
    >
      {/* Selection highlight band */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/8"
        style={{
          top: paddingItems * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
        }}
      />
      {/* Top fade */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        style={{
          height: paddingItems * ITEM_HEIGHT,
          background: 'linear-gradient(to bottom, var(--panel-strong) 20%, transparent)',
        }}
      />
      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
        style={{
          height: paddingItems * ITEM_HEIGHT,
          background: 'linear-gradient(to top, var(--panel-strong) 20%, transparent)',
        }}
      />

      <div
        ref={containerRef}
        className="ft-hide-scrollbar h-full overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { if (isDragging.current) handlePointerUp() }}
        onTouchStart={(e) => handlePointerDown(e.touches[0])}
        onTouchMove={(e) => handlePointerMove(e.touches[0])}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
        onScrollCapture={() => {
          // Debounced snap on scroll end
          if (momentum.current) cancelAnimationFrame(momentum.current)
          if (!isDragging.current) {
            momentum.current = requestAnimationFrame(() => {
              setTimeout(snapToNearest, 80)
            })
          }
        }}
      >
        {/* Top padding spacers */}
        {Array.from({ length: paddingItems }).map((_, i) => (
          <div key={`top-${i}`} style={{ height: ITEM_HEIGHT }} />
        ))}

        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex
          return (
            <button
              key={item.key ?? idx}
              type="button"
              onClick={() => { onSelect(idx); scrollToIndex(idx) }}
              className="w-full select-none transition-all duration-150 cursor-pointer"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className={`text-center transition-all duration-150 ${
                  isSelected
                    ? 'text-base sm:text-lg font-black text-[var(--fg)]'
                    : 'text-sm font-semibold text-[var(--muted)]'
                }`}
                style={{
                  opacity: isSelected ? 1 : 0.55,
                  transform: isSelected ? 'scale(1.06)' : 'scale(0.94)',
                }}
              >
                {item[labelKey]}
              </span>
            </button>
          )
        })}

        {/* Bottom padding spacers */}
        {Array.from({ length: paddingItems }).map((_, i) => (
          <div key={`bot-${i}`} style={{ height: ITEM_HEIGHT }} />
        ))}
      </div>
    </div>
  )
}

/* ── MonthPicker ───────────────────────────────────────────────────── */
export default function MonthPicker({ value, onChange, className = '', compact = false, size = 'md' }) {
  const { locale, t } = useTranslation()
  const { isOpen, isVisible: visible, openSheet, closeSheet: closePicker } = useBottomSheet(false)

  const isCompact = compact || size === 'sm'

  const parsedValue = useMemo(() => {
    try {
      if (!value || !String(value).includes('-')) {
        const now = new Date()
        return { year: now.getFullYear(), month: now.getMonth() }
      }
      const [y, m] = String(value).split('-').map(Number)
      return { year: y || new Date().getFullYear(), month: (m || 1) - 1 }
    } catch {
      const now = new Date()
      return { year: now.getFullYear(), month: now.getMonth() }
    }
  }, [value])

  const [selectedYear, setSelectedYear] = useState(parsedValue.year)
  const [selectedMonth, setSelectedMonth] = useState(parsedValue.month)

  const handleOpenPicker = useCallback(() => {
    setSelectedYear(parsedValue.year)
    setSelectedMonth(parsedValue.month)
    openSheet()
  }, [parsedValue.year, parsedValue.month, openSheet])

  const handleApply = useCallback(() => {
    const formattedMonth = String(selectedMonth + 1).padStart(2, '0')
    onChange?.(`${selectedYear}-${formattedMonth}`)
    closePicker()
  }, [selectedMonth, selectedYear, onChange, closePicker])

  const handleSelectCurrentMonth = useCallback(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    setSelectedYear(y)
    setSelectedMonth(m)
    onChange?.(`${y}-${String(m + 1).padStart(2, '0')}`)
    closePicker()
  }, [onChange, closePicker])

  const monthItems = useMemo(() => {
    const dateLocale = locale === 'en' ? enUS : idLocale
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2026, i, 1)
      const full = format(d, 'MMMM', { locale: dateLocale })
      return {
        key: i,
        label: full,
      }
    })
  }, [locale])

  const yearItems = useMemo(() => {
    const currentY = new Date().getFullYear()
    const start = currentY - 6
    const end = currentY + 6
    const arr = []
    for (let y = start; y <= end; y += 1) {
      arr.push({
        key: y,
        label: String(y),
      })
    }
    return arr
  }, [])

  const yearStartOffset = useMemo(() => {
    const currentY = new Date().getFullYear()
    return currentY - 6
  }, [])

  const displayLabel = useMemo(() => {
    try {
      if (!value) return t('common.select')
      const d = parse(`${value}-01`, 'yyyy-MM-dd', new Date())
      return format(d, 'MMMM yyyy', { locale: locale === 'en' ? enUS : idLocale })
    } catch {
      return value || '-'
    }
  }, [value, locale, t])

  // Preview label inside the picker
  const previewLabel = useMemo(() => {
    const dateLocale = locale === 'en' ? enUS : idLocale
    const d = new Date(selectedYear, selectedMonth, 1)
    return format(d, 'MMMM yyyy', { locale: dateLocale })
  }, [selectedMonth, selectedYear, locale])

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPicker}
        className={`flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--field-bg)] transition hover:border-[var(--fg)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer ${
          isCompact
            ? 'h-8.5 px-2.5 text-xs'
            : 'h-11 px-3.5 text-sm'
        } ${className}`}
      >
        <span className={`flex items-center gap-2 font-bold text-[var(--fg)] ${isCompact ? 'text-xs' : 'text-sm'}`}>
          <svg viewBox="0 0 24 24" className={`${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-[var(--accent)]`} fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="capitalize tracking-tight truncate">{displayLabel}</span>
        </span>
        <svg viewBox="0 0 24 24" className={`${isCompact ? 'h-3.5 w-3.5 ml-1' : 'h-4 w-4 ml-2'} text-[var(--muted)] shrink-0`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4">
          {/* Backdrop */}
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closePicker}
            aria-label={t('common.close') || 'Close'}
          />

          {/* Panel */}
          <div
            className={`relative w-full max-w-[360px] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transition-all duration-300 ${
              visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 sm:translate-y-4 opacity-0 scale-95'
            }`}
            style={{
              transitionTimingFunction: visible ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Drag handle (mobile) */}
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-[var(--border-strong)]/40 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div>
                <p className="text-sm sm:text-base font-black tracking-tight text-[var(--fg)]">
                  {locale === 'en' ? 'Select Period' : 'Pilih Periode'}
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-extrabold capitalize text-[var(--accent)]">{previewLabel}</p>
              </div>
              <button
                type="button"
                onClick={handleSelectCurrentMonth}
                className="rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--panel)] active:scale-95 cursor-pointer"
              >
                {locale === 'en' ? 'Today' : 'Bulan Ini'}
              </button>
            </div>

            {/* Separator */}
            <div className="mx-5 h-px bg-[var(--border)]/40" />

            {/* Drum Wheels */}
            <div className="flex gap-0 px-4 py-2">
              {/* Month Column */}
              <div className="flex-1">
                <p className="mb-2 text-center text-xs sm:text-sm font-black uppercase tracking-wider text-[var(--fg)]">
                  {locale === 'en' ? 'Month' : 'Bulan'}
                </p>
                <DrumColumn
                  items={monthItems}
                  selectedIndex={selectedMonth}
                  onSelect={setSelectedMonth}
                />
              </div>

              {/* Divider */}
              <div className="mx-1 mt-8 w-px self-stretch bg-[var(--border)]/30" />

              {/* Year Column */}
              <div className="flex-1">
                <p className="mb-2 text-center text-xs sm:text-sm font-black uppercase tracking-wider text-[var(--fg)]">
                  {locale === 'en' ? 'Year' : 'Tahun'}
                </p>
                <DrumColumn
                  items={yearItems}
                  selectedIndex={selectedYear - yearStartOffset}
                  onSelect={(idx) => setSelectedYear(yearStartOffset + idx)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-t border-[var(--border)]/40 px-5 py-3.5">
              <button
                type="button"
                onClick={closePicker}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 text-[13px] font-bold text-[var(--muted)] transition hover:text-[var(--fg)] active:scale-[0.98]"
              >
                {t('common.cancel') || 'Batal'}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 rounded-xl bg-[var(--fg)] py-2.5 text-[13px] font-bold text-[var(--bg)] shadow-sm transition hover:opacity-90 active:scale-[0.98]"
              >
                {t('common.confirm') || 'Pilih'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
