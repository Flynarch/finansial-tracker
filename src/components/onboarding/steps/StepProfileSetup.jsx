import useTranslation from '../../../hooks/useTranslation'
import ProgressHeader from '../ProgressHeader'
import UserAvatar from '../../ui/UserAvatar'
import { Camera, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

export default function StepProfileSetup({
  username = '',
  setUsername,
  profilePhoto,
  usernameError = '',
  setUsernameError,
  onOpenChangePhoto,
  onBack,
  onNext,
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <ProgressHeader step={1} total={4} />

      <div className="text-center space-y-1.5">
        <h3 className="text-2xl font-black tracking-tight text-[var(--fg)]">
          {t('auth.profileStepTitle', 'Konfirmasi Profil Anda')}
        </h3>
        <p className="text-xs text-[var(--muted)] leading-relaxed max-w-sm mx-auto">
          {t(
            'auth.profileStepSubtitle',
            'Nama dan foto profil ini akan ditampilkan pada dashboard dan laporan keuangan Anda.'
          )}
        </p>
      </div>

      {/* Avatar Centerpiece with Clean Camera Button */}
      <div className="flex flex-col items-center justify-center gap-2.5 py-3">
        <div className="relative">
          {/* Profile Avatar Button */}
          <button
            type="button"
            onClick={onOpenChangePhoto}
            className="group/avatar relative block rounded-full p-1 border-[2.5px] border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--field-bg)] shadow-md shadow-black/10 transition hover:border-[var(--accent)] active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title={t('auth.changePhotoBtn', 'Ganti Foto / Persona')}
            aria-label={t('auth.changePhotoBtn', 'Ganti Foto / Persona')}
          >
            <UserAvatar
              name={username || ''}
              photo={profilePhoto}
              size="2xl"
              shape="circle"
              className="w-[88px] h-[88px]"
              border={false}
            />
            <div className="absolute inset-1 rounded-full bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[1px]">
              <Camera size={20} strokeWidth={2.2} />
              <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">
                {t('profile.edit', 'Ubah')}
              </span>
            </div>
          </button>

          {/* Camera badge trigger */}
          <button
            type="button"
            onClick={onOpenChangePhoto}
            className="absolute -bottom-1 -right-1 z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--panel-strong)] bg-[var(--fg)] text-[var(--bg)] shadow-md transition hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label={t('auth.changePhotoBtn', 'Ganti Foto / Persona')}
            title={t('auth.changePhotoBtn', 'Ganti Foto / Persona')}
          >
            <Camera size={14} strokeWidth={2.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenChangePhoto}
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer pt-1"
        >
          {t('auth.changePhotoBtn', 'Ganti Foto / Persona')}
        </button>
      </div>

      {/* Name Input Field */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {t('auth.nameFieldLabel', 'Nama Tampilan')}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (usernameError && setUsernameError) setUsernameError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onNext()
          }}
          placeholder={t('auth.namePlaceholder', 'Nama lengkap Anda')}
          className={`w-full rounded-2xl border bg-[var(--field-bg)] px-4 py-3.5 text-sm font-bold text-[var(--fg)] outline-none transition-all ${
            usernameError
              ? 'border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-[var(--border)] focus:border-[var(--border-strong)]'
          }`}
          autoFocus
        />
        {usernameError && (
          <p className="text-xs font-semibold text-red-500 flex items-center gap-1">
            <AlertCircle size={13} />
            {usernameError}
          </p>
        )}
      </div>

      {/* Bottom Nav Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1.5 py-3.5 px-4 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition-all cursor-pointer"
        >
          <ChevronLeft size={16} />
          <span>{t('common.back', 'Kembali')}</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--accent)] text-[var(--bg)] font-bold text-sm hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <span>{t('auth.continue', 'Lanjut')}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
