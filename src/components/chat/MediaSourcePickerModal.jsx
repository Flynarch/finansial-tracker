import { createPortal } from 'react-dom'
import { Camera, Image as ImageIcon, ChevronRight, X } from 'lucide-react'
import { translate } from '../../lib/i18n'
import { triggerHaptic } from '../../lib/haptics'
import useBottomSheet from '../../hooks/useBottomSheet'

/**
 * MediaSourcePickerModal
 * Sleek bottom-sheet / modal allowing users to choose between Camera and Gallery
 */
export default function MediaSourcePickerModal({
  isOpen,
  onClose,
  onSelectCamera,
  onSelectGallery,
  locale = 'id',
}) {
  const { isMounted, isVisible, closeSheet } = useBottomSheet({
    isOpen,
    onClose,
  })

  if (!isMounted) return null

  const handleCamera = () => {
    triggerHaptic('light')
    closeSheet()
    onSelectCamera()
  }

  const handleGallery = () => {
    triggerHaptic('light')
    closeSheet()
    onSelectGallery()
  }

  const isEn = locale === 'en'

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${
        isVisible ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer ${
          isVisible ? 'ft-backdrop-enter' : 'ft-backdrop-exit pointer-events-none'
        }`}
        onClick={closeSheet}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-t-[28px] sm:rounded-3xl border-t sm:border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-2xl space-y-4 pb-[max(env(safe-area-inset-bottom,0px),1.25rem)] transform-gpu ${
          isVisible ? 'ft-sheet-enter' : 'ft-sheet-exit pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle pill for mobile sheet indication */}
        <div className="flex justify-center sm:hidden -mt-1 mb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--border-strong)] opacity-60" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-black tracking-tight text-[var(--fg)]">
              {translate(locale, 'aiChat.media.title') || (isEn ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
            </h3>
            <p className="text-xs text-[var(--muted)] font-medium">
              {translate(locale, 'aiChat.media.subtitle') || (isEn ? 'Select image source to scan with AI' : 'Pilih sumber gambar untuk dipindai oleh AI')}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] active:scale-95 transition cursor-pointer"
            aria-label={translate(locale, 'common.cancel') || (isEn ? 'Close' : 'Tutup')}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Action Options */}
        <div className="space-y-2.5 pt-1">
          {/* Option 1: Camera */}
          <button
            type="button"
            onClick={handleCamera}
            className="w-full flex items-center justify-between gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 hover:bg-[var(--panel)] hover:border-[var(--accent)]/40 active:scale-[0.98] transition text-left cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)] border border-[var(--accent)]/20 group-hover:scale-105 transition-transform">
                <Camera size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-[var(--fg)] leading-snug">
                  {translate(locale, 'aiChat.media.camera') || (isEn ? 'Take Photo' : 'Ambil Foto (Kamera)')}
                </span>
                <span className="block text-xs text-[var(--muted)] leading-tight mt-0.5 font-medium truncate">
                  {translate(locale, 'aiChat.media.cameraDesc') || (isEn ? 'Use camera to capture physical receipt' : 'Gunakan kamera untuk foto struk fisik secara langsung')}
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-[var(--muted)] group-hover:text-[var(--fg)] group-hover:translate-x-0.5 transition shrink-0" />
          </button>

          {/* Option 2: Gallery */}
          <button
            type="button"
            onClick={handleGallery}
            className="w-full flex items-center justify-between gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 hover:bg-[var(--panel)] hover:border-sky-500/40 active:scale-[0.98] transition text-left cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-500/12 text-sky-500 border border-sky-500/20 group-hover:scale-105 transition-transform">
                <ImageIcon size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-[var(--fg)] leading-snug">
                  {translate(locale, 'aiChat.media.gallery') || (isEn ? 'Choose from Gallery' : 'Pilih dari Galeri')}
                </span>
                <span className="block text-xs text-[var(--muted)] leading-tight mt-0.5 font-medium truncate">
                  {translate(locale, 'aiChat.media.galleryDesc') || (isEn ? 'Select receipt photo from storage' : 'Pilih foto struk atau tangkapan layar dari galeri')}
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-[var(--muted)] group-hover:text-[var(--fg)] group-hover:translate-x-0.5 transition shrink-0" />
          </button>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] active:scale-95 transition cursor-pointer text-center"
        >
          {translate(locale, 'common.cancel') || (isEn ? 'Cancel' : 'Batal')}
        </button>
      </div>
    </div>,
    document.body
  )
}
