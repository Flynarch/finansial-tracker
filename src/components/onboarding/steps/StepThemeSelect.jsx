import useTranslation from '../../../hooks/useTranslation'
import ProgressHeader from '../ProgressHeader'
import { Sun, Moon, Sparkles, Check, ChevronLeft, ChevronRight } from 'lucide-react'

export default function StepThemeSelect({
  theme,
  onThemeSelect,
  onBack,
  onNext,
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <ProgressHeader step={2} total={4} />

      <div className="space-y-1">
        <h3 className="text-2xl font-black tracking-tight text-[var(--fg)]">
          {t('auth.themeStepTitle', 'Pilih Tema Tampilan')}
        </h3>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t(
            'auth.themeStepSubtitle',
            'Pilih estetika visual favorit Anda. Anda dapat mengubahnya kapan saja di Pengaturan.'
          )}
        </p>
      </div>

      {/* Theme Options Stack */}
      <div className="space-y-3 pt-1">
        {/* 1. Putih (Light Theme) */}
        <div
          onClick={(e) => onThemeSelect('light', e)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
            theme === 'light'
              ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
              : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Sun size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="font-black text-sm text-[var(--fg)]">
                  {t('auth.themeLightTitle', 'Pure Light')}
                </h4>
              </div>
            </div>
            {theme === 'light' && (
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shrink-0">
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] pl-10.5">
            {t('auth.themeLightDesc', 'Tampilan bersih, cerah, dan kontras tinggi untuk siang hari.')}
          </p>
        </div>

        {/* 2. Matte Dark Theme */}
        <div
          onClick={(e) => onThemeSelect('dark', e)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
            theme === 'dark'
              ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
              : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-500/15 text-slate-300 flex items-center justify-center shrink-0">
                <Moon size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="font-black text-sm text-[var(--fg)]">
                  {t('auth.themeDarkTitle', 'Matte Dark')}
                </h4>
              </div>
            </div>
            {theme === 'dark' && (
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shrink-0">
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] pl-10.5">
            {t('auth.themeDarkDesc', 'Nuansa gelap elegan berestetika modern dan nyaman di mata.')}
          </p>
        </div>

        {/* 3. Midnight Sapphire Theme */}
        <div
          onClick={(e) => onThemeSelect('midnight', e)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
            theme === 'midnight'
              ? 'border-[var(--accent)] bg-[var(--panel-strong)] ring-2 ring-[var(--accent)]/30'
              : 'border-[var(--border)] bg-[var(--field-bg)] hover:border-[var(--border-strong)]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                <Sparkles size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="font-black text-sm text-[var(--fg)]">
                  {t('auth.themeMidnightTitle', 'Midnight Sapphire')}
                </h4>
              </div>
            </div>
            {theme === 'midnight' && (
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--bg)] flex items-center justify-center shrink-0">
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] pl-10.5">
            {t('auth.themeMidnightDesc', 'Kedalaman warna biru samudra dengan aksen futuristik.')}
          </p>
        </div>
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
          <span>{t('auth.continueToWallet', 'Lanjut ke Dompet')}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
