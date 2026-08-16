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
  maxWidth = 'max-w-md',
  maxHeight = 'max-h-[min(78dvh,40rem)]',
  className = '',
  closeAriaLabel,
}) {
  const { t } = useTranslation()
  const { isVisible: sheetVisible, closeSheet } = useBottomSheet({ isOpen, onClose })
  const defaultCloseLabel = closeAriaLabel || t('common.close', 'Tutup')

  if ((!isOpen && !sheetVisible) || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 ft-motion-overlay">
      <button
        type="button"
        className={`ft-motion-overlay absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 ${
          sheetVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSheet}
        aria-label={defaultCloseLabel}
      />
      <div className={`absolute inset-x-0 bottom-0 mx-auto w-full px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] ${maxWidth}`}>
        <div
          className={`${maxHeight} overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-2xl transition-all duration-380 ft-hide-scrollbar ${
            sheetVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-12 scale-95 opacity-0'
          } ${className}`}
          style={{
            boxShadow: 'var(--shadow-card)',
            transitionTimingFunction: sheetVisible ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {showHandle ? <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-[var(--border-strong)]/70" /> : null}

          {title || showCloseButton ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              {title ? (
                typeof title === 'string' ? (
                  <p className="text-sm font-semibold text-[var(--fg)]">{title}</p>
                ) : (
                  title
                )
              ) : <div />}
              {showCloseButton ? (
                <button
                  type="button"
                  className="rounded-xl px-3 py-1 text-sm text-[var(--muted)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
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
