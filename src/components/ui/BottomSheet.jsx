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

  if ((!isOpen && !sheetVisible) || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 ft-motion-overlay">
      {/* Dimmed glass backdrop */}
      <button
        type="button"
        className={`ft-motion-overlay absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-320 ${
          sheetVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSheet}
        aria-label={defaultCloseLabel}
      />

      {/* Sheet Container with iOS / Vaul-style seamless slide-up */}
      <div className={`absolute inset-x-0 bottom-0 mx-auto w-full sm:px-4 sm:pb-6 ${maxWidth}`}>
        <div
          className={`${maxHeight} overflow-y-auto w-full rounded-t-[32px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 shadow-2xl transition-all duration-320 transform-gpu will-change-[transform,opacity] ft-hide-scrollbar ${
            sheetVisible
              ? 'translate-y-0 scale-100 opacity-100'
              : 'translate-y-full sm:translate-y-6 sm:scale-96 opacity-0'
          } ${className}`}
          style={{
            boxShadow: 'var(--shadow-card)',
            transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {/* Tactile drag handle */}
          {showHandle ? (
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-strong)]/60 transition-colors hover:bg-[var(--border-strong)]" />
          ) : null}

          {title || showCloseButton ? (
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
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
                  className="rounded-xl px-3 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition-colors cursor-pointer"
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
