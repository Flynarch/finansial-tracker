import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import useBottomSheet from '../../hooks/useBottomSheet'
import useTranslation from '../../hooks/useTranslation'
import { triggerHaptic } from '../../lib/haptics'

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
  scrollable = true,
  footer,
  enableBackButton = true,
}) {
  const { t } = useTranslation()
  const { isMounted, isVisible: sheetVisible, closeSheet } = useBottomSheet({
    isOpen,
    onClose,
    useBackButton: enableBackButton,
  })
  const defaultCloseLabel = closeAriaLabel || t('common.close', 'Tutup')

  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [isSnappingBack, setIsSnappingBack] = useState(false)
  const snapTimeoutRef = useRef(null)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const hasTriggeredSnapHaptic = useRef(false)

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
    }
  }, [])

  const handleTouchStart = useCallback((e) => {
    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = null
    }
    hasTriggeredSnapHaptic.current = false
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    setIsDragging(true)
    setIsSnappingBack(false)
    setIsDismissing(false)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!touchStartY.current) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartY.current

    if (deltaY > 0) {
      // Natural downward drag
      setDragOffset(deltaY)
      if (deltaY >= 80 && !hasTriggeredSnapHaptic.current) {
        hasTriggeredSnapHaptic.current = true
        triggerHaptic('light')
      } else if (deltaY < 80 && hasTriggeredSnapHaptic.current) {
        hasTriggeredSnapHaptic.current = false
      }
    } else {
      // Elastic rubberband resistance for upward pull
      setDragOffset(deltaY * 0.15)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartY.current && !isDragging) return
    const elapsed = Date.now() - touchStartTime.current
    const velocity = dragOffset / (elapsed || 1) // px per ms

    hasTriggeredSnapHaptic.current = false
    setIsDragging(false)
    touchStartY.current = 0

    // Threshold: dragged down > 80px OR high downward flick velocity
    if (dragOffset > 80 || (dragOffset > 30 && velocity > 0.45)) {
      setIsDismissing(true)
      closeSheet()
    } else if (dragOffset !== 0) {
      // Elastic snap back
      setIsSnappingBack(true)
      setDragOffset(0)
      snapTimeoutRef.current = setTimeout(() => {
        setIsSnappingBack(false)
        snapTimeoutRef.current = null
      }, 200)
    }
  }, [dragOffset, isDragging, closeSheet])

  if (!isMounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 ${
        sheetVisible ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Dimmed backdrop */}
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 cursor-pointer ${
          sheetVisible ? 'ft-backdrop-enter' : 'ft-backdrop-exit'
        }`}
        onClick={closeSheet}
        aria-label={defaultCloseLabel}
      />

      {/* Sheet Container with iOS / Vaul-style seamless slide-up and gesture drag-to-dismiss */}
      <div className={`absolute inset-x-0 bottom-0 mx-auto w-full sm:px-4 sm:pb-6 ${maxWidth}`}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : defaultCloseLabel}
          className={`flex flex-col ${maxHeight} w-full rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transform-gpu overflow-hidden ${
            isDragging || isDismissing || isSnappingBack
              ? ''
              : sheetVisible
              ? 'ft-sheet-enter'
              : 'ft-sheet-exit'
          } ${className}`}
          style={{
            boxShadow: 'var(--shadow-card)',
            ...(isDragging
              ? {
                  transform: `translate3d(0, ${Math.max(0, dragOffset)}px, 0)`,
                  opacity: Math.max(0.4, 1 - dragOffset / 300),
                  transition: 'none',
                }
              : isDismissing
              ? {
                  transform: 'translate3d(0, 100%, 0)',
                  opacity: 0,
                  transition: 'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in',
                }
              : isSnappingBack
              ? {
                  transform: 'translate3d(0, 0, 0)',
                  opacity: 1,
                  transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out',
                }
              : {}),
          }}
        >
          {/* ZONE 1: FIXED TOP (Handle + Sticky Header) */}
          <div className="shrink-0 px-5 pt-3.5 sm:px-6 select-none border-b border-[var(--border)]/60">
            {showHandle && (
              <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className="mx-auto -mt-1.5 mb-2 pt-1 pb-1 w-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
              >
                <div className="h-1.5 w-11 rounded-full bg-[var(--border-strong)] transition-all hover:bg-[var(--muted)]" />
              </div>
            )}

            {(title || showCloseButton) && (
              <div className="mb-3 flex items-center justify-between gap-2">
                {title ? (
                  typeof title === 'string' ? (
                    <p className="text-base font-black tracking-tight text-[var(--fg)]">{title}</p>
                  ) : (
                    title
                  )
                ) : <div />}
                {showCloseButton && (
                  <button
                    type="button"
                    className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-all text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] active:scale-95 cursor-pointer ft-spring-press"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeSheet()
                    }}
                    aria-label={defaultCloseLabel}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ZONE 2: ADAPTIVE SCROLLABLE BODY */}
          <div
            className={`flex-1 min-h-0 px-5 sm:px-6 py-3.5 ${
              footer ? '' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
            } ${
              scrollable
                ? 'overflow-y-auto overscroll-contain ft-hide-scrollbar'
                : 'overflow-hidden overscroll-none'
            }`}
          >
            {children}
          </div>

          {/* ZONE 3: FIXED BOTTOM FOOTER (Optional) */}
          {footer && (
            <div className="shrink-0 px-5 sm:px-6 py-3 border-t border-[var(--border)]/60 bg-[var(--panel-strong)] pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom)))]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
