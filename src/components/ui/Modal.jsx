import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import useTranslation from '../../hooks/useTranslation'
import useBottomSheet from '../../hooks/useBottomSheet'

function Modal({ isOpen, title, children, onClose }) {
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
      className={`fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-[10vh] bg-black/70 backdrop-blur-md transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      // Prevent background scroll without breaking inner scroll containers.
      onWheel={(event) => event.target === event.currentTarget && event.preventDefault()}
      onTouchMove={(event) => event.target === event.currentTarget && event.preventDefault()}
      onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}
    >
      <div
        className={`w-full max-w-md max-h-[90vh] overflow-y-auto hide-scrollbar rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 sm:p-6 shadow-2xl transition-all duration-380 ${
          isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-92 translate-y-4 opacity-0'
        }`}
        style={{
          boxShadow: 'var(--shadow-card)',
          transitionTimingFunction: isVisible ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="ft-display text-base font-semibold text-[var(--fg)]">{title}</h3>
          <button
            type="button"
            onClick={closeSheet}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default Modal
