import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import useTranslation from '../../hooks/useTranslation'
import useBottomSheet from '../../hooks/useBottomSheet'

function Modal({
  isOpen,
  title,
  children,
  onClose,
  maxWidth = 'max-w-md',
  maxHeight = 'max-h-[min(90dvh,44rem)]',
  className = '',
  zIndex = 'z-50',
  showHeader = true,
  showCloseButton = true,
  scrollable = true,
  footer,
  enableBackButton = true,
}) {
  const { isMounted, isVisible, closeSheet } = useBottomSheet({
    isOpen,
    onClose,
    useBackButton: enableBackButton,
  })
  const { t } = useTranslation()

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return undefined
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeSheet()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, closeSheet])

  if (!isMounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 sm:backdrop-blur-xs ${
        isVisible ? 'ft-backdrop-enter' : 'ft-backdrop-exit pointer-events-none'
      }`}
      onWheel={(event) => event.target === event.currentTarget && event.preventDefault()}
      onTouchMove={(event) => event.target === event.currentTarget && event.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeSheet()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : t('common.modal', 'Modal')}
        className={`flex flex-col w-full ${maxWidth} ${maxHeight} overflow-hidden rounded-t-[32px] rounded-b-none sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl transform-gpu ${
          isVisible ? 'ft-sheet-enter' : 'ft-sheet-exit'
        } ${className}`}
        style={{
          boxShadow: 'var(--shadow-card)',
          contain: 'paint layout',
        }}
      >
        {/* ZONE 1: FIXED TOP HEADER */}
        {showHeader && (Boolean(title) || showCloseButton) && (
          <div className="shrink-0 px-4 sm:px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 border-b border-[var(--border)]/60 flex items-center justify-between select-none">
            <h3 className="ft-display text-sm sm:text-base font-black tracking-tight text-[var(--fg)]">{title}</h3>
            {showCloseButton && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  closeSheet()
                }}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-all text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] active:scale-95 cursor-pointer"
                aria-label={t('common.close', 'Tutup')}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ZONE 2: ADAPTIVE SCROLLABLE BODY */}
        <div
          className={`flex-1 min-h-0 px-4 sm:px-5 py-3.5 ${
            footer ? '' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'
          } ${
            scrollable ? 'overflow-y-auto overscroll-contain hide-scrollbar' : 'overflow-hidden overscroll-none'
          }`}
          onWheel={(event) => {
            if (!scrollable) event.preventDefault()
            else event.stopPropagation()
          }}
          onTouchMove={(event) => {
            if (!scrollable) {
              const tag = event.target?.tagName?.toLowerCase()
              if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
                event.preventDefault()
              }
            } else {
              event.stopPropagation()
            }
          }}
        >
          {children}
        </div>

        {/* ZONE 3: FIXED BOTTOM FOOTER (Optional) */}
        {footer && (
          <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-[var(--border)]/60 bg-[var(--panel-strong)] pb-[max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom)))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
