import { useState, useRef } from 'react'
import {
  Upload,
  Trash2,
  Check,
  Camera,
  Sliders,
} from 'lucide-react'
import Modal from '../ui/Modal'
import UserAvatar from '../ui/UserAvatar'
import PhotoCropperModal from './PhotoCropperModal'
import { PRESET_AVATARS, AVATAR_CATEGORIES } from './presetAvatarsData'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'

function ChangePhotoContent({
  currentPhoto = '',
  profileName,
  onSavePhoto,
  setProfilePhoto,
  onClose,
  t,
}) {
  const [previewPhoto, setPreviewPhoto] = useState(currentPhoto || '')
  const [rawImageForCrop, setRawImageForCrop] = useState(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  const isPresetSelected = PRESET_AVATARS.some((p) => p.dataUrl === previewPhoto)
  const selectedPreset = PRESET_AVATARS.find((p) => p.dataUrl === previewPhoto)
  const isCustomPhoto = Boolean(previewPhoto && !isPresetSelected)

  const filteredAvatars =
    activeCategory === 'all'
      ? PRESET_AVATARS
      : PRESET_AVATARS.filter((p) => p.category === activeCategory)

  // File upload trigger -> open cropper
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg(t('profile.photoFormatError', 'Format file harus berupa gambar (JPG, PNG, WebP).'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => {
      setErrorMsg(t('profile.photoProcessError', 'Gagal memproses gambar. Silakan coba gambar lain.'))
    }
    reader.onload = (event) => {
      setRawImageForCrop(event.target?.result)
      setIsCropperOpen(true)
      setErrorMsg('')
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Open cropper for current custom photo
  const handleOpenAdjustCurrent = () => {
    if (!previewPhoto) return
    setRawImageForCrop(previewPhoto)
    setIsCropperOpen(true)
  }

  // Cropper applied
  const handleCropApply = (croppedDataUrl) => {
    setPreviewPhoto(croppedDataUrl)
    setIsCropperOpen(false)
    setErrorMsg('')
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
      if (onSavePhoto) {
        onSavePhoto(previewPhoto)
      } else {
        await setProfilePhoto(previewPhoto)
      }
      onClose()
    } catch (err) {
      console.warn('[ChangePhotoModal]', err)
      setErrorMsg(t('profile.photoSaveError', 'Gagal menyimpan foto profil.'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4 pt-0.5">
      {/* ── 1. Compact Header Profile Card & Actions ── */}
      <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]">
        <div className="relative shrink-0">
          <div className="p-0.5 rounded-full border-2 border-[var(--accent)]/60 shadow-xs">
            <UserAvatar
              photo={previewPhoto}
              name={profileName}
              size={60}
              shape="circle"
              className="w-15 h-15"
            />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="absolute -bottom-1 -right-1 grid h-6.5 w-6.5 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)] border-2 border-[var(--panel-strong)] shadow-xs transition hover:scale-110 active:scale-95 cursor-pointer"
            title={t('profile.changePhotoDesc', 'Unggah foto dari perangkat')}
            aria-label={t('profile.changePhotoDesc', 'Unggah foto dari perangkat')}
          >
            <Camera size={12} strokeWidth={2.5} />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-black text-[var(--fg)] truncate">
              {profileName || 'FinTrack User'}
            </p>
            <p className="text-[11px] font-medium text-[var(--muted)] leading-tight">
              {previewPhoto
                ? isPresetSelected
                  ? selectedPreset?.label
                  : t('profile.photoCustomActive', 'Foto kustom aktif')
                : t('profile.photoDefaultInitials', 'Inisial nama (default)')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-1 py-1 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition cursor-pointer shadow-2xs active:scale-95"
            >
              <Upload size={12} />
              <span>{t('profile.uploadPhoto', 'Unggah Foto')}</span>
            </button>

            {isCustomPhoto && (
              <button
                type="button"
                onClick={handleOpenAdjustCurrent}
                disabled={isProcessing}
                className="flex items-center gap-1 py-1 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[11px] font-bold text-[var(--accent)] hover:border-[var(--accent)]/50 transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Sliders size={12} />
                <span>{t('profile.adjustPhoto', 'Sesuaikan')}</span>
              </button>
            )}

            {previewPhoto ? (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isProcessing}
                className="flex items-center gap-1 py-1 px-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-[11px] font-bold text-red-500 hover:bg-red-500/20 transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Trash2 size={12} />
                <span>{t('profile.removePhoto', 'Hapus')}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-center text-xs font-semibold text-rose-500">
          {errorMsg}
        </div>
      ) : null}

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── 2. Preset Avatars Section with Category Filter ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {t('profile.presetAvatars', 'Pilihan Avatar Profil')}
          </label>
          <span className="text-[10px] font-bold text-[var(--muted-2)]">
            {filteredAvatars.length} {t('common.options', 'Pilihan')}
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {AVATAR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                activeCategory === cat.id
                  ? 'bg-[var(--accent)] text-[var(--bg)] shadow-2xs font-black'
                  : 'bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] border border-[var(--border)]'
              }`}
            >
              {t(cat.labelKey, cat.labelDefault)}
            </button>
          ))}
        </div>

        {/* Responsive Avatars Grid */}
        <div className="grid grid-cols-4 gap-2 max-h-[340px] sm:max-h-[380px] overflow-y-auto overscroll-contain pr-1">
          {filteredAvatars.map((preset) => {
            const isSelected = previewPhoto === preset.dataUrl
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/12 shadow-sm ring-2 ring-[var(--accent)] scale-[1.02]'
                    : 'border-[var(--border)] bg-[var(--field-bg)] hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-95'
                }`}
              >
                <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden border border-[var(--border)] shadow-xs transition-transform duration-200 group-hover:scale-105">
                  <img
                    src={preset.dataUrl}
                    alt={preset.label}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-[var(--accent)]/35 backdrop-blur-[1px] flex items-center justify-center text-white">
                      <Check size={18} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div className="w-full text-center min-w-0">
                  <p className="text-[10.5px] font-bold text-[var(--fg)] truncate leading-tight">
                    {preset.label}
                  </p>
                  <p className="text-[9px] font-medium text-[var(--muted)] truncate leading-tight">
                    {preset.subtitle}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 3. Footer Actions ── */}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 px-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)] transition cursor-pointer active:scale-95"
        >
          {t('profile.editModal.cancel', 'Batal')}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isProcessing}
          className="flex-[1.5] flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs font-black shadow-xs transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{t('profile.saveChanges', 'Simpan Perubahan')}</span>
        </button>
      </div>

      {/* ── 4. Interactive Photo Cropper Modal ── */}
      {isCropperOpen && (
        <PhotoCropperModal
          isOpen={isCropperOpen}
          imageSrc={rawImageForCrop}
          onApply={handleCropApply}
          onClose={() => setIsCropperOpen(false)}
          zIndex="z-[70]"
        />
      )}
    </div>
  )
}

export default function ChangePhotoModal({
  isOpen,
  onClose,
  currentPhoto: propCurrentPhoto,
  onSavePhoto,
  zIndex = 'z-50',
}) {
  const { t } = useTranslation()
  const profileName = useSettingsStore((s) => s.profileName)
  const storeProfilePhoto = useSettingsStore((s) => s.profilePhoto)
  const setProfilePhoto = useSettingsStore((s) => s.setProfilePhoto)

  const effectivePhoto = propCurrentPhoto !== undefined ? propCurrentPhoto : (storeProfilePhoto || '')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('profile.changePhotoModalTitle', 'Foto Profil')}
      maxWidth="max-w-md"
      zIndex={zIndex}
    >
      {isOpen ? (
        <ChangePhotoContent
          key={effectivePhoto || 'default'}
          currentPhoto={effectivePhoto}
          profileName={profileName}
          onSavePhoto={onSavePhoto}
          setProfilePhoto={setProfilePhoto}
          onClose={onClose}
          t={t}
        />
      ) : null}
    </Modal>
  )
}
