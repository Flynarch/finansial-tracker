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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 ft-motion-overlay"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
      // Prevent background scroll without breaking inner scroll containers.
      onWheel={(event) => event.target === event.currentTarget && event.preventDefault()}
      onTouchMove={(event) => event.target === event.currentTarget && event.preventDefault()}
      onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-2xl"
        style={{ animation: 'ft-scale-in var(--motion-duration) var(--motion-ease) both' }}
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
