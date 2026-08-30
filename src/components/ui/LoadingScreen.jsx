import { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, Sparkles } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { getNextTheme } from '../../lib/themeTransition'

function LoadingScreen({ isPreview = false }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const loadSettings = useSettingsStore((state) => state.loadSettings)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  const isPreviewMode =
    isPreview ||
    location.pathname === '/loading' ||
    searchParams.get('preview') === 'loading' ||
    searchParams.get('loading') === 'true'

  const handleToggleTheme = () => {
    const nextTheme = getNextTheme(theme)
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    if (theme === 'midnight') return <Sparkles className="h-3.5 w-3.5 text-sky-400 shrink-0" />
    return <Moon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
  }

  const getThemeName = () => {
    if (theme === 'light') return t('settings.themeLight', 'Pure Light')
    if (theme === 'midnight') return t('settings.themeMidnight', 'Midnight Sapphire')
    return t('settings.themeDark', 'Matte Dark')
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[var(--bg)] text-[var(--fg)] overflow-hidden select-none p-6">
      {/* Dev Preview Mode Floating Pill */}
      {isPreviewMode ? (
        <div className="relative z-20 flex flex-wrap items-center justify-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--panel-strong)]/90 px-3.5 py-1.5 shadow-md backdrop-blur-md safe-top animate-fadeIn transition-colors duration-300">
          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--field-bg)] border border-[var(--border)] text-[11px] font-bold text-[var(--fg)] hover:opacity-80 active:scale-95 transition cursor-pointer"
            title={t('settings.theme', 'Tema')}
          >
            {getThemeIcon()}
            <span>{getThemeName()}</span>
          </button>

          <span className="h-3 w-px bg-[var(--border)] hidden sm:inline" />

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer transition active:scale-95 px-1 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t('common.backToDashboard', 'Kembali ke Dashboard')}</span>
          </button>
        </div>
      ) : (
        <div className="h-4" />
      )}

      {/* Main Minimalist Center Hub */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto text-center max-w-xs w-full">
        {/* Official FinTrack APK App Logo */}
        <div className="relative flex h-20 w-20 items-center justify-center mb-5">
          <img
            src="/favicon.svg"
            alt="FinTrack"
            className="h-16 w-16 rounded-[22px] shadow-sm border border-[var(--border)] select-none"
          />
        </div>

        {/* Brand Title & Subtitle */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="ft-display text-base font-black tracking-[0.25em] uppercase text-[var(--fg)] transition-colors duration-300">
            FinTrack
          </h1>

          <p className="text-xs font-medium text-[var(--muted)] tracking-wide transition-colors duration-300">
            {t('common.loading', 'Memuat...')}
          </p>
        </div>

        {/* Minimalist Micro Progress Line */}
        <div className="mt-5 w-32 h-0.5 bg-[var(--border)] rounded-full overflow-hidden relative">
          <div className="h-full rounded-full bg-[var(--accent)] animate-[ft-loading-bar_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Bottom Minimalist Footer */}
      <div className="relative z-10 flex items-center justify-center pb-2 safe-bottom">
        <span className="text-[10px] font-medium tracking-widest text-[var(--muted)]/60 uppercase">
          Offline First
        </span>
      </div>
    </div>
  )
}

export default LoadingScreen
