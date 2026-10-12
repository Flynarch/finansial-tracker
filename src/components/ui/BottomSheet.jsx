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

  const dialogRef = useRef(null)
  const handleBarRef = useRef(null)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const [isDismissedByDrag, setIsDismissedByDrag] = useState(false)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const hasTriggeredSnapHaptic = useRef(false)
  const snapTimeoutRef = useRef(null)

  const [hasEntered, setHasEntered] = useState(false)

  const [prevSheetVisible, setPrevSheetVisible] = useState(sheetVisible)
  if (sheetVisible !== prevSheetVisible) {
    setPrevSheetVisible(sheetVisible)
    if (!sheetVisible) {
      setHasEntered(false)
    } else {
      setIsDismissedByDrag(false)
    }
  }

  useEffect(() => {
    if (!sheetVisible) return undefined
    if (dialogRef.current) {
      dialogRef.current.style.transform = ''
      dialogRef.current.style.transition = ''
      dialogRef.current.style.opacity = ''
    }
    const timer = setTimeout(() => {
      setHasEntered(true)
    }, 260)
    return () => clearTimeout(timer)
  }, [sheetVisible])

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
    }
  }, [])

  const handleDragStart = useCallback((clientY) => {
    if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = null
    }
    hasTriggeredSnapHaptic.current = false
    setHasEntered(true)
    touchStartY.current = clientY
    touchStartTime.current = Date.now()
    isDraggingRef.current = true
    dragOffsetRef.current = 0
    setIsDismissedByDrag(false)

    if (dialogRef.current) {
      dialogRef.current.style.transition = 'none'
    }
    if (handleBarRef.current) {
      handleBarRef.current.style.transition = 'none'
    }
  }, [])

  const handleDragMove = useCallback((clientY) => {
    if (!touchStartY.current || !isDraggingRef.current) return
    const deltaY = clientY - touchStartY.current
    const currentOffset = deltaY > 0 ? deltaY : deltaY * 0.15

    if (deltaY > 0) {
      if (deltaY >= 80 && !hasTriggeredSnapHaptic.current) {
        hasTriggeredSnapHaptic.current = true
        triggerHaptic('light')
      } else if (deltaY < 80 && hasTriggeredSnapHaptic.current) {
        hasTriggeredSnapHaptic.current = false
      }
    }

    dragOffsetRef.current = currentOffset

    // Direct GPU DOM update without React re-render
    if (dialogRef.current) {
      const y = Math.max(0, currentOffset)
      dialogRef.current.style.transform = `translate3d(0, ${y}px, 0)`
    }

    if (handleBarRef.current) {
      const y = Math.max(0, currentOffset)
      const scaleX = Math.min(1.45, Math.max(1, 1 + (y * 0.2) / 44))
      handleBarRef.current.style.transform = `scale3d(${scaleX}, 1, 1)`
      if (currentOffset >= 80) {
        handleBarRef.current.style.backgroundColor = 'var(--accent)'
      } else {
        handleBarRef.current.style.backgroundColor = ''
      }
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!touchStartY.current && !isDraggingRef.current) return
    const elapsed = Date.now() - touchStartTime.current
    const finalOffset = dragOffsetRef.current
    const velocity = finalOffset / (elapsed || 1) // px per ms

    hasTriggeredSnapHaptic.current = false
    isDraggingRef.current = false
    touchStartY.current = 0

    // Threshold: dragged down > 80px OR high downward flick velocity
    if (finalOffset > 80 || (finalOffset > 30 && velocity > 0.45)) {
      setIsDismissedByDrag(true)
      if (dialogRef.current) {
        dialogRef.current.style.transition = 'transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in'
        dialogRef.current.style.transform = 'translate3d(0, 100%, 0)'
        dialogRef.current.style.opacity = '0'
      }
      closeSheet()
    } else if (finalOffset !== 0) {
      setIsDismissedByDrag(false)
      // Elastic snap back with smooth spring curve
      if (dialogRef.current) {
        dialogRef.current.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
        dialogRef.current.style.transform = 'translate3d(0, 0, 0)'
      }
      if (handleBarRef.current) {
        handleBarRef.current.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 150ms ease'
        handleBarRef.current.style.transform = 'scale3d(1, 1, 1)'
        handleBarRef.current.style.backgroundColor = ''
      }
      snapTimeoutRef.current = setTimeout(() => {
        dragOffsetRef.current = 0
        if (dialogRef.current) {
          dialogRef.current.style.transform = ''
          dialogRef.current.style.transition = ''
          dialogRef.current.style.opacity = ''
        }
        if (handleBarRef.current) {
          handleBarRef.current.style.transform = ''
          handleBarRef.current.style.transition = ''
        }
        snapTimeoutRef.current = null
      }, 200)
    } else {
      setIsDismissedByDrag(false)
      dragOffsetRef.current = 0
      if (dialogRef.current) {
        dialogRef.current.style.transform = ''
        dialogRef.current.style.transition = ''
        dialogRef.current.style.opacity = ''
      }
      if (handleBarRef.current) {
        handleBarRef.current.style.transform = ''
        handleBarRef.current.style.transition = ''
      }
    }
  }, [closeSheet])

  const handleTouchStart = useCallback((e) => {
    handleDragStart(e.touches?.[0]?.clientY ?? 0)
  }, [handleDragStart])

  const handleTouchMove = useCallback((e) => {
    handleDragMove(e.touches?.[0]?.clientY ?? 0)
  }, [handleDragMove])

  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    handleDragStart(e.clientY)

    const onMouseMove = (ev) => {
      handleDragMove(ev.clientY)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      handleDragEnd()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [handleDragStart, handleDragMove, handleDragEnd])

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
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : defaultCloseLabel}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && e.animationName === 'ft-sheet-slide-up') {
              setHasEntered(true)
            }
          }}
          className={`flex flex-col ${maxHeight} w-full rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transform-gpu overflow-hidden ${
            !sheetVisible
              ? (isDismissedByDrag ? '' : 'ft-sheet-exit')
              : hasEntered
              ? ''
              : 'ft-sheet-enter'
          } ${className}`}
          style={{
            boxShadow: 'var(--shadow-card)',
            willChange: 'transform',
            contain: 'paint layout',
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
                onMouseDown={handleMouseDown}
                className="mx-auto -mt-2 mb-2 py-2.5 w-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none -my-1"
              >
                <div
                  ref={handleBarRef}
                  className="h-1.5 w-11 rounded-full bg-[var(--border-strong)] hover:bg-[var(--muted)] transition-colors origin-center"
                />
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
