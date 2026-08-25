import Modal from './Modal'
import Button from './Button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  message,
  confirmText,
  cancelText,
  isLoading = false,
}) {
  const { t } = useTranslation()

  const modalTitle = title || t('common.delete')
  const displayMessage = description || message || t('common.deleteConfirmDefault', 'Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.')
  const textConfirm = confirmText || t('common.delete')
  const textCancel = cancelText || t('common.cancel')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4 pt-1">
        <div className="flex gap-3 items-start p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div className="text-xs sm:text-sm font-medium leading-relaxed text-[var(--fg)]">
            {displayMessage}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            className="flex-1 bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--field-border)]"
            onClick={onClose}
            disabled={isLoading}
          >
            {textCancel}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-rose-500 text-white hover:bg-rose-600 border-none shadow-xs font-bold"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common.processing')}</span>
              </span>
            ) : (
              textConfirm
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
