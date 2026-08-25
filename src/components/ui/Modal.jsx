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
  zIndex = 'z-50',
  showHeader = true,
  showCloseButton = true,
}) {
  const { isVisible, closeSheet } = useBottomSheet({ isOpen, onClose })
  const { t } = useTranslation()

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return undefined
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeSheet()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, closeSheet])

  if (!isOpen && !isVisible) return null

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3 sm:p-6 bg-black/60 transition-opacity duration-280 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      // Prevent background scroll without breaking inner scroll containers.
      onWheel={(event) => event.target === event.currentTarget && event.preventDefault()}
      onTouchMove={(event) => event.target === event.currentTarget && event.preventDefault()}
      onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : t('common.modal', 'Modal')}
        className={`w-full ${maxWidth} max-h-[min(94dvh,44rem)] overflow-y-auto overscroll-contain hide-scrollbar rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-280 transform-gpu ${
          isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-3 opacity-0'
        }`}
        style={{
          boxShadow: 'var(--shadow-card)',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        {showHeader && (Boolean(title) || showCloseButton) && (
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border)]/60 pb-2.5">
            <h3 className="ft-display text-sm sm:text-base font-black tracking-tight text-[var(--fg)]">{title}</h3>
            {showCloseButton && (
              <button
                type="button"
                onClick={closeSheet}
                className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full transition-all text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] active:scale-95 cursor-pointer"
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
        {children}
      </div>
    </div>,
    document.body
  )
}

export default Modal
