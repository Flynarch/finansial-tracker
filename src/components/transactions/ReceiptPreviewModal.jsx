import { useState } from 'react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import { FileText, Calendar, Wallet, Tag, ImageOff } from 'lucide-react'

export default function ReceiptPreviewModal({
  isOpen,
  onClose,
  imageSrc,
  title,
  amountFormatted,
  date,
  notes,
  description,
  category,
  zIndex = 'z-[60]',
}) {
  const { t } = useTranslation()
  const [failedImageSrc, setFailedImageSrc] = useState(null)

  const [cachedImage, setCachedImage] = useState(imageSrc)
  const [cachedMeta, setCachedMeta] = useState({ title, amountFormatted, date, notes, description, category })

  if (imageSrc) {
    if (imageSrc !== cachedImage) {
      setCachedImage(imageSrc)
    }
    if (
      title !== cachedMeta.title ||
      amountFormatted !== cachedMeta.amountFormatted ||
      date !== cachedMeta.date ||
      notes !== cachedMeta.notes ||
      description !== cachedMeta.description ||
      category !== cachedMeta.category
    ) {
      setCachedMeta({ title, amountFormatted, date, notes, description, category })
    }
  }

  const activeImageSrc = imageSrc || cachedImage
  const activeMeta = imageSrc ? { title, amountFormatted, date, notes, description, category } : cachedMeta

  if (!activeImageSrc) return null

  const imgError = Boolean(activeImageSrc && failedImageSrc === activeImageSrc)
  const displayNotes = activeMeta.notes || activeMeta.description

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeMeta.title || t('transactions.receiptModalTitle', 'Bukti Transaksi')}
      maxWidth="max-w-lg"
      zIndex={zIndex}
    >
      <div className="space-y-4">
        {/* Receipt Image Container */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-black/5 dark:bg-black/40 flex items-center justify-center min-h-[220px] max-h-[65vh]">
          {imgError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-[var(--muted)]">
              <ImageOff className="h-10 w-10 text-[var(--muted-2)] mb-2" />
              <p className="text-xs font-bold text-[var(--fg)]">{t('transactions.imageLoadError', 'Gagal Memuat Gambar Struk')}</p>
              <p className="text-[10px] mt-1">{t('transactions.imageCorrupted', 'Format berkas tidak didukung atau berkas rusak.')}</p>
            </div>
          ) : (
            <img
              src={activeImageSrc}
              alt="Receipt / Proof"
              onError={() => setFailedImageSrc(activeImageSrc)}
              className="w-full h-auto max-h-[60vh] object-contain rounded-xl select-none"
            />
          )}
        </div>

        {/* Transaction Metadata Strip */}
        {(activeMeta.amountFormatted || activeMeta.date || displayNotes || activeMeta.category) && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-2 text-xs overflow-hidden min-w-0">
            {activeMeta.category && (
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-bold text-[var(--muted)] flex items-center gap-1.5 shrink-0">
                  <Tag className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                  {t('tx.category', 'Kategori')}:
                </span>
                <span className="font-bold text-[var(--fg)] truncate text-right ml-2">
                  {activeMeta.category}
                </span>
              </div>
            )}

            {activeMeta.amountFormatted && (
              <div className="flex items-center justify-between gap-2 min-w-0 border-t border-[var(--border)]/60 pt-2">
                <span className="font-bold text-[var(--muted)] flex items-center gap-1.5 shrink-0">
                  <Wallet className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  {t('common.amount', 'Jumlah')}:
                </span>
                <span className="font-black text-sm tracking-tight text-[var(--fg)] tabular-nums break-all text-right ml-2">
                  {activeMeta.amountFormatted}
                </span>
              </div>
            )}

            {activeMeta.date && (
              <div className="flex items-center justify-between gap-2 min-w-0 border-t border-[var(--border)]/60 pt-2">
                <span className="font-bold text-[var(--muted)] flex items-center gap-1.5 shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                  {t('common.date', 'Tanggal')}:
                </span>
                <span className="font-bold text-[var(--fg)] tabular-nums break-all text-right ml-2">{activeMeta.date}</span>
              </div>
            )}

            {displayNotes && (
              <div className="border-t border-[var(--border)]/60 pt-2 text-[var(--muted)] min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 font-bold">
                  <FileText className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span>{t('common.notes', 'Catatan')}:</span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl bg-[var(--panel)] p-2.5 border border-[var(--border)]/50">
                  <p className="italic text-[var(--fg)] text-[11.5px] leading-relaxed break-words [overflow-wrap:anywhere] break-all whitespace-pre-wrap select-text">
                    &ldquo;{displayNotes}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
