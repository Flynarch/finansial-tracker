import { createPortal } from 'react-dom'
import useBottomSheet from '../../hooks/useBottomSheet'

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
  closeAriaLabel = 'Tutup',
}) {
  const { isVisible: sheetVisible, closeSheet } = useBottomSheet({ isOpen, onClose })

  if ((!isOpen && !sheetVisible) || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 ft-motion-overlay">
      <button
        type="button"
        className={`ft-motion-overlay absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          sheetVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSheet}
        aria-label={closeAriaLabel}
      />
      <div className={`absolute inset-x-0 bottom-0 mx-auto w-full px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] ${maxWidth}`}>
        <div
          className={`ft-motion-panel ${maxHeight} overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-2xl transition-all duration-200 ${
            sheetVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          } ${className}`}
        >
          {showHandle ? <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" /> : null}

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
                  {closeAriaLabel}
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
