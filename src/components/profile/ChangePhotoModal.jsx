import { useState, useRef } from 'react'
import {
  Upload,
  Trash2,
  Check,
  Camera,
} from 'lucide-react'
import Modal from '../ui/Modal'
import UserAvatar from '../ui/UserAvatar'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'

// Curated preset vector avatars encoded as clean SVG data URIs
const PRESET_AVATARS = [
  {
    id: 'preset-1',
    label: 'Persona Violet',
    color: '#8b5cf6',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g1" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%238B5CF6"/><stop offset="100%25" stop-color="%233B82F6"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g1)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-2',
    label: 'Persona Emerald',
    color: '#10b981',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g2" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%2310B981"/><stop offset="100%25" stop-color="%23047857"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g2)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-3',
    label: 'Persona Amber',
    color: '#f59e0b',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g3" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23F59E0B"/><stop offset="100%25" stop-color="%23EF4444"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g3)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-4',
    label: 'Persona Sky',
    color: '#0ea5e9',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g4" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%230EA5E9"/><stop offset="100%25" stop-color="%236366F1"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g4)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-5',
    label: 'Persona Rose',
    color: '#f43f5e',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g5" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%23F43F5E"/><stop offset="100%25" stop-color="%23FB7185"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g5)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-6',
    label: 'Persona Obsidian',
    color: '#334155',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g6" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%231E293B"/><stop offset="100%25" stop-color="%230F172A"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g6)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-7',
    label: 'Persona Teal',
    color: '#14b8a6',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g7" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%2314B8A6"/><stop offset="100%25" stop-color="%230D9488"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g7)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
  {
    id: 'preset-8',
    label: 'Persona Minimal',
    color: '#64748b',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g8" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0%25" stop-color="%2364748B"/><stop offset="100%25" stop-color="%23475569"/></linearGradient></defs><rect width="120" height="120" fill="url(%23g8)"/><circle cx="60" cy="48" r="22" fill="white" opacity="0.95"/><path d="M24 106 C24 82 42 76 60 76 C78 76 96 82 96 106 Z" fill="white" opacity="0.95"/></svg>`,
  },
]

/**
 * Client-side high-performance canvas image compressor
 * Scales image to maximum 400x400 square (centered crop) and outputs WebP / JPEG
 */
function compressImage(file, maxSize = 400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate square crop dimensions
        const minDim = Math.min(width, height)
        const sx = (width - minDim) / 2
        const sy = (height - minDim) / 2

        const targetSize = Math.min(maxSize, minDim)
        canvas.width = targetSize
        canvas.height = targetSize

        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // Draw cropped square image
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize)

        // Try WebP with JPEG fallback
        try {
          const dataUrl = canvas.toDataURL('image/webp', quality)
          if (dataUrl.startsWith('data:image/webp')) {
            resolve(dataUrl)
            return
          }
        } catch {
          /* ignore and use jpeg */
        }

        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function ChangePhotoModal({ isOpen, onClose }) {
  const { t } = useTranslation()
  const currentPhoto = useSettingsStore((s) => s.profilePhoto)
  const profileName = useSettingsStore((s) => s.profileName)
  const setProfilePhoto = useSettingsStore((s) => s.setProfilePhoto)

  const [previewPhoto, setPreviewPhoto] = useState(currentPhoto || '')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  // Synchronize initial state when modal opens
  const handleOpen = () => {
    setPreviewPhoto(currentPhoto || '')
    setErrorMsg('')
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg(t('profile.photoFormatError', 'Format file harus berupa gambar (JPG, PNG, WebP).'))
      return
    }

    try {
      setIsProcessing(true)
      setErrorMsg('')
      const compressedDataUrl = await compressImage(file, 400, 0.85)
      setPreviewPhoto(compressedDataUrl)
    } catch {
      setErrorMsg(t('profile.photoProcessError', 'Gagal memproses gambar. Silakan coba gambar lain.'))
    } finally {
      setIsProcessing(false)
      // Reset input value so same file can be re-selected if desired
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSelectPreset = (preset) => {
    setPreviewPhoto(preset.dataUrl)
    setErrorMsg('')
  }

  const handleRemovePhoto = () => {
    setPreviewPhoto('')
    setErrorMsg('')
  }

  const handleSave = async () => {
    try {
      setIsProcessing(true)
      await setProfilePhoto(previewPhoto)
      onClose()
    } catch {
      setErrorMsg(t('profile.photoSaveError', 'Gagal menyimpan foto profil.'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onAfterOpen={handleOpen}
      title={t('profile.changePhotoModalTitle', 'Foto Profil')}
      maxWidth="max-w-md"
    >
      <div className="space-y-6 pt-1 pb-2">
        {/* ── 1. Live Interactive Avatar Preview ── */}
        <div className="flex flex-col items-center justify-center pt-2 pb-1">
          <div className="relative group">
            <div className="p-1 rounded-full border-2 border-[var(--accent)]/40 shadow-md">
              <UserAvatar
                photo={previewPhoto}
                name={profileName}
                size={96}
                shape="circle"
                className="w-24 h-24"
              />
            </div>

            {/* Quick Upload Action Button overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)] border-2 border-[var(--panel-strong)] shadow-md transition hover:scale-110 active:scale-95 cursor-pointer"
              title={t('profile.changePhotoDesc', 'Unggah foto dari perangkat')}
              aria-label={t('profile.changePhotoDesc', 'Unggah foto dari perangkat')}
            >
              <Camera size={14} strokeWidth={2.5} />
            </button>
          </div>

          <p className="mt-3 text-sm font-black text-[var(--fg)]">
            {profileName || 'FinTrack User'}
          </p>
          <p className="text-xs font-medium text-[var(--muted)]">
            {previewPhoto
              ? t('profile.photoCustomActive', 'Foto kustom aktif')
              : t('profile.photoDefaultInitials', 'Inisial nama (default)')}
          </p>

          {errorMsg ? (
            <div className="mt-3 w-full rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-center text-xs font-semibold text-rose-500">
              {errorMsg}
            </div>
          ) : null}
        </div>

        {/* Hidden Native File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* ── 2. Primary Actions (Upload & Remove) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 px-3.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] transition active:scale-[0.98] cursor-pointer"
          >
            <Upload size={15} strokeWidth={2.2} className="text-[var(--accent)]" />
            <span>
              {isProcessing
                ? t('profile.processing', 'Memproses...')
                : t('profile.uploadPhoto', 'Unggah Foto')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRemovePhoto}
            disabled={!previewPhoto || isProcessing}
            className={`flex items-center justify-center gap-2 py-3 px-3.5 rounded-2xl border text-xs font-bold transition active:scale-[0.98] cursor-pointer ${
              !previewPhoto
                ? 'border-[var(--border)]/40 bg-[var(--field-bg)]/40 text-[var(--muted)] opacity-50 cursor-not-allowed'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/15'
            }`}
          >
            <Trash2 size={15} strokeWidth={2.2} />
            <span>{t('profile.deletePhoto', 'Hapus Foto')}</span>
          </button>
        </div>

        {/* ── 3. Preset Avatar Collection ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
              {t('profile.personaOptions', 'Pilihan Avatar Persona')}
            </h4>
            <span className="text-[10.5px] font-semibold text-[var(--muted-2)]">
              {t('profile.optionsCount', '8 Pilihan')}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {PRESET_AVATARS.map((preset) => {
              const isSelected = previewPhoto === preset.dataUrl
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs ring-1 ring-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--field-bg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-full overflow-hidden border-[0.5px] border-[var(--wallet-logo-border,var(--border))] shadow-2xs">
                    <img
                      src={preset.dataUrl}
                      alt={preset.label}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[var(--accent)]/30 backdrop-blur-[1px] flex items-center justify-center text-white">
                        <Check size={16} strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] font-bold text-[var(--muted)] group-hover:text-[var(--fg)] truncate max-w-full">
                    {preset.label.replace('Persona ', '')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 4. Footer Actions ── */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition cursor-pointer"
          >
            {t('profile.editModal.cancel', 'Batal')}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="flex-[1.5] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[var(--fg)] text-[var(--bg)] text-xs font-black shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
          >
            <Check size={15} strokeWidth={2.5} />
            <span>{t('profile.saveChanges', 'Simpan Perubahan')}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
