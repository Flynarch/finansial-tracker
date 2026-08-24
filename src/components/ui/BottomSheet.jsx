import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import useBottomSheet from '../../hooks/useBottomSheet'
import useTranslation from '../../hooks/useTranslation'

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  showHandle = true,
  maxWidth = 'sm:max-w-lg',
  maxHeight = 'max-h-[min(88dvh,42rem)]',
  className = '',
  closeAriaLabel,
}) {
  const { t } = useTranslation()
  const { isVisible: sheetVisible, closeSheet } = useBottomSheet({ isOpen, onClose })
  const defaultCloseLabel = closeAriaLabel || t('common.close', 'Tutup')

  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!touchStartY.current) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartY.current

    if (deltaY > 0) {
      // Natural downward drag
      setDragOffset(deltaY)
    } else {
      // Elastic rubberband resistance for upward pull
      setDragOffset(deltaY * 0.15)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const elapsed = Date.now() - touchStartTime.current
    const velocity = dragOffset / (elapsed || 1) // px per ms

    setIsDragging(false)

    // Threshold: dragged down > 80px OR high downward flick velocity
    if (dragOffset > 80 || (dragOffset > 30 && velocity > 0.45)) {
      closeSheet()
    }

    setDragOffset(0)
    touchStartY.current = 0
  }, [dragOffset, closeSheet])

  if ((!isOpen && !sheetVisible) || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 ft-motion-overlay">
      {/* Dimmed backdrop */}
      <button
        type="button"
        className={`ft-motion-overlay absolute inset-0 bg-black/60 transition-opacity duration-280 ${
          sheetVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSheet}
        aria-label={defaultCloseLabel}
      />

      {/* Sheet Container with iOS / Vaul-style seamless slide-up and gesture drag-to-dismiss */}
      <div className={`absolute inset-x-0 bottom-0 mx-auto w-full sm:px-4 sm:pb-6 ${maxWidth}`}>
        <div
          className={`${maxHeight} overflow-y-auto overscroll-contain w-full rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 shadow-2xl transform-gpu ft-hide-scrollbar ${className}`}
          style={{
            boxShadow: 'var(--shadow-card)',
            transform: sheetVisible
              ? `translate3d(0, ${Math.max(0, dragOffset)}px, 0)`
              : 'translate3d(0, 100%, 0)',
            transition: isDragging
              ? 'none'
              : 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.32s ease',
            opacity: sheetVisible ? (dragOffset > 0 ? Math.max(0.4, 1 - dragOffset / 300) : 1) : 0,
          }}
        >
          {/* Tactile drag handle & touch zone */}
          {showHandle ? (
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className="mx-auto -mt-2 mb-3 pt-2 pb-1.5 w-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <div className="h-1.5 w-11 rounded-full bg-[var(--border-strong)] transition-all hover:bg-[var(--muted)]" />
            </div>
          ) : null}

          {title || showCloseButton ? (
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3 cursor-grab select-none"
            >
              {title ? (
                typeof title === 'string' ? (
                  <p className="text-base font-black tracking-tight text-[var(--fg)]">{title}</p>
                ) : (
                  title
                )
              ) : <div />}
              {showCloseButton ? (
                <button
                  type="button"
                  className="rounded-xl px-3 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer ft-spring-press"
                  onClick={closeSheet}
                >
                  {defaultCloseLabel}
                </button>
              ) : null}
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
