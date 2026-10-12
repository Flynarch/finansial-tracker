import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Check,
  X,
  Move,
} from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'

const VIEWPORT_SIZE = 240
const EXPORT_SIZE = 400

function PhotoCropperContent({
  imageSrc,
  onApply,
  onClose,
  t,
}) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  const dragStartRef = useRef({ x: 0, y: 0 })
  const initialPanRef = useRef({ x: 0, y: 0 })
  const imageRef = useRef(null)

  // Measure natural dimensions of the loaded image
  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    }
    img.src = imageSrc
  }, [imageSrc])

  // Calculate base dimensions covering the VIEWPORT_SIZE box
  const getBaseDimensions = useCallback(() => {
    const { width, height } = imageDimensions
    if (!width || !height) return { baseW: VIEWPORT_SIZE, baseH: VIEWPORT_SIZE }

    if (width >= height) {
      const baseH = VIEWPORT_SIZE
      const baseW = VIEWPORT_SIZE * (width / height)
      return { baseW, baseH }
    } else {
      const baseW = VIEWPORT_SIZE
      const baseH = VIEWPORT_SIZE * (height / width)
      return { baseW, baseH }
    }
  }, [imageDimensions])

  const { baseW, baseH } = getBaseDimensions()

  // Pointer drag handling for pan
  const handlePointerDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    initialPanRef.current = { ...pan }
    if (e.currentTarget?.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Safe fallback
      }
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    })
  }

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false)
      if (e.currentTarget?.releasePointerCapture) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          // Safe fallback
        }
      }
    }
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.08 : -0.08
    setZoom((prev) => Math.min(3.5, Math.max(1, Number((prev + delta).toFixed(2)))))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  const handleApply = () => {
    if (!imageRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = EXPORT_SIZE
    canvas.height = EXPORT_SIZE
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      onApply(imageSrc)
      return
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const k = EXPORT_SIZE / VIEWPORT_SIZE

    ctx.save()
    // Move origin to center of output canvas
    ctx.translate(EXPORT_SIZE / 2, EXPORT_SIZE / 2)
    // Apply scaled pan
    ctx.translate(pan.x * k, pan.y * k)
    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180)
    // Apply zoom
    ctx.scale(zoom, zoom)

    // Draw centered base image
    const renderW = baseW * k
    const renderH = baseH * k
    ctx.drawImage(imageRef.current, -renderW / 2, -renderH / 2, renderW, renderH)

    ctx.restore()

    try {
      const dataUrl = canvas.toDataURL('image/webp', 0.88)
      if (dataUrl.startsWith('data:image/webp')) {
        onApply(dataUrl)
        return
      }
    } catch {
      // Fallback to jpeg
    }

    onApply(canvas.toDataURL('image/jpeg', 0.88))
  }

  return (
    <div className="space-y-4 pt-0.5 select-none">
      <p className="text-xs text-[var(--muted)] text-center leading-relaxed font-medium">
        {t('profile.cropSubtitle', 'Geser foto untuk mengatur posisi, dan gunakan zoom untuk memperbesar.')}
      </p>

      {/* ── Circular Crop Viewport ── */}
      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-2xl bg-neutral-900 shadow-md touch-none cursor-grab active:cursor-grabbing border border-[var(--border)]"
          style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* The Scaled and Positioned Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt={t('profile.cropTarget', 'Foto profil yang disesuaikan')}
            draggable={false}
            className="absolute pointer-events-none max-w-none origin-center"
            style={{
              width: `${baseW}px`,
              height: `${baseH}px`,
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rotation}deg) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          />

          {/* Dark Mask with Circular Clear Viewport Window */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full rounded-full ring-[999px] ring-black/70 border-2 border-white/90 shadow-inner" />
          </div>

          {/* Subtle Crosshair Guide while dragging */}
          {isDragging && (
            <div className="absolute inset-0 pointer-events-none rounded-full flex items-center justify-center opacity-40">
              <div className="w-full h-[1px] bg-white/40" />
              <div className="h-full w-[1px] bg-white/40 absolute" />
            </div>
          )}

          {/* Hint pill on initial view */}
          {!isDragging && pan.x === 0 && pan.y === 0 && zoom === 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white border border-white/20 shadow-xs">
              <Move size={11} />
              <span>{t('profile.cropDragHint', 'Geser untuk memposisikan')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls (Zoom & Rotation) ── */}
      <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] space-y-3">
        {/* Zoom Slider */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(1, Number((prev - 0.2).toFixed(2))))}
            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer active:scale-95"
            title={t('profile.cropZoomOut', 'Perkecil')}
            aria-label={t('profile.cropZoomOut', 'Perkecil')}
          >
            <ZoomOut size={13} />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              aria-label={t('profile.cropZoom', 'Tingkat Zoom')}
              className="w-full h-1.5 rounded-lg bg-[var(--border)] accent-[var(--accent)] cursor-pointer"
            />
            <span className="text-[11px] font-mono font-bold text-[var(--muted)] w-9 text-right shrink-0">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(3, Number((prev + 0.2).toFixed(2))))}
            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer active:scale-95"
            title={t('profile.cropZoomIn', 'Perbesar')}
            aria-label={t('profile.cropZoomIn', 'Perbesar')}
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Rotation & Reset Row */}
        <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/70 text-xs">
          <button
            type="button"
            onClick={handleRotate}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition cursor-pointer active:scale-95 shadow-2xs"
          >
            <RotateCw size={12} />
            <span>{t('profile.cropRotate', 'Putar 90°')}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer active:scale-95 shadow-2xs"
          >
            <RotateCcw size={12} />
            <span>{t('profile.cropReset', 'Atur Ulang')}</span>
          </button>
        </div>
      </div>

      {/* ── Footer Actions ── */}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition cursor-pointer active:scale-95"
        >
          <X size={14} />
          <span>{t('profile.cropCancel', 'Batal')}</span>
        </button>

        <button
          type="button"
          onClick={handleApply}
          className="flex-[1.5] flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[var(--accent)] text-[var(--bg)] text-xs font-black shadow-xs transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{t('profile.cropApply', 'Terapkan Foto')}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Interactive Avatar Photo Cropper
 * Allows precise pan, zoom, and rotation within a circular avatar boundary.
 */
export default function PhotoCropperModal({
  isOpen,
  imageSrc,
  onApply,
  onClose,
  zIndex = 'z-[60]',
}) {
  const { t } = useTranslation()

  if (!isOpen || !imageSrc) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('profile.cropTitle', 'Sesuaikan Foto Profil')}
      maxWidth="max-w-sm"
      zIndex={zIndex}
    >
      <PhotoCropperContent
        key={imageSrc}
        imageSrc={imageSrc}
        onApply={onApply}
        onClose={onClose}
        t={t}
      />
    </Modal>
  )
}
