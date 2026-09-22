import { useRef, useState } from 'react'
import { Paperclip, X, Eye, Loader2 } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import { compressImage, estimateBase64SizeKb } from '../../lib/imageCompression'

export default function ReceiptUploadAttachment({ value, onChange, onView, inputRef, containerRef }) {
  const { t } = useTranslation()
  const localInputRef = useRef(null)
  const fileInputRef = inputRef || localInputRef
  const [isCompressing, setIsCompressing] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsCompressing(true)
      const compressed = await compressImage(file, 1024, 0.75)
      if (compressed) {
        onChange(compressed)
      }
    } catch (err){
      console.warn('[ReceiptUploadAttachment]', err)
      // Ignore error
    } finally {
      setIsCompressing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = (e) => {
    e?.stopPropagation()
    onChange('')
  }

  const sizeKb = value ? estimateBase64SizeKb(value) : 0

  return (
    <div ref={containerRef} className="space-y-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <label className="block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
        {t('transactions.receiptAttachment', 'Bukti / Lampiran Struk')}
      </label>

      {value ? (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
          <div
            onClick={() => onView && onView(value)}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
          >
            <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-[var(--border)] bg-black/10 dark:bg-black/40 shrink-0 flex items-center justify-center">
              <img
                src={value}
                alt="Receipt thumbnail"
                className="h-full w-full object-cover group-hover:scale-105 transition"
                onError={(e) => {
                  e.target.style.display = 'none'
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div className="hidden h-full w-full items-center justify-center text-[var(--muted)]">
                <Paperclip className="h-5 w-5" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-[var(--fg)] truncate">
                {t('transactions.receiptAttached', 'Foto Struk Terlampir')}
              </span>
              <span className="block text-[10.5px] font-semibold text-[var(--muted)] mt-0.5 tabular-nums">
                {sizeKb} KB • {t('transactions.clickToPreview', 'Klik untuk melihat')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onView && (
              <button
                type="button"
                onClick={() => onView(value)}
                className="h-8.5 w-8.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs"
                title={t('common.view', 'Lihat')}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8.5 px-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 flex items-center gap-1 text-[10.5px] font-bold cursor-pointer shadow-2xs"
              title={t('common.change', 'Ganti Foto')}
            >
              <Paperclip className="h-3 w-3" />
              <span>{t('common.change', 'Ganti')}</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="h-8.5 w-8.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('common.remove', 'Hapus')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isCompressing}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 px-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--accent)]/50 hover:bg-[var(--panel)] transition active:scale-98 flex items-center justify-center gap-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer disabled:opacity-50 shadow-2xs"
        >
          {isCompressing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
              <span>{t('common.processing', 'Memproses Gambar...')}</span>
            </>
          ) : (
            <>
              <Paperclip className="h-4 w-4 text-[var(--accent)]" />
              <span>{t('transactions.addReceiptBtn', 'Lampirkan Foto Struk / Nota')}</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
