import { matchPath, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'

const ROUTES_META = [
  { path: '/settings/security', titleKey: 'settings.appLock' },
  { path: '/settings/categories', titleKey: 'settings.section.categories' },
  { path: '/settings/recurring', titleKey: 'settings.recurringTitle' },
  { path: '/settings/currency', titleKey: 'settings.fxRatesTitle' },
  { path: '/settings/notifications', titleKey: 'settings.notifications.title' },
  { path: '/settings/ai', titleKey: 'settings.aiIntegration' },
  { path: '/settings/data', titleKey: 'settings.nav.data' },
  { path: '/settings/help', titleKey: 'settings.helpTitle' },
]

export default function SettingsLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const meta = ROUTES_META.find((r) => matchPath({ path: r.path, end: true }, location.pathname))

  return (
    <div className="ft-settings-page">
      {meta ? (
        <header className="sticky top-0 z-20 mb-5 flex items-center gap-3.5 bg-[var(--bg)] py-3.5 border-b border-[var(--border)]/40 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs transition hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black tracking-tight text-[var(--fg)]">
              {t(meta.titleKey)}
            </h1>
          </div>
        </header>
      ) : null}
      <Outlet />
    </div>
  )
}
