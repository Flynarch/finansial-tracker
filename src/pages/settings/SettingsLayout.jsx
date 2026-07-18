import { matchPath, Outlet, useLocation, useNavigate } from 'react-router-dom'
import useTranslation from '../../hooks/useTranslation'

const ROUTES_META = [
  { path: '/settings/security', titleKey: 'settings.appLock' },
  { path: '/settings/categories', titleKey: 'settings.section.categories' },
  { path: '/settings/recurring', titleKey: 'settings.recurringTitle' },
  { path: '/settings/data', titleKey: 'settings.nav.data' },
  { path: '/settings/help', titleKey: 'profile.help' },
  { path: '/settings/account', titleKey: 'settings.account.title' },
]

export default function SettingsLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const meta = ROUTES_META.find((r) => matchPath({ path: r.path, end: true }, location.pathname))

  return (
    <div className="ft-settings-page">
      {meta ? (
        <header className="sticky top-0 z-10 mb-6 flex items-center gap-3 bg-[var(--bg)]/95 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--bg)]/80">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-sm transition hover:bg-[var(--field-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label={t('common.back')}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-[var(--fg)]">
            {t(meta.titleKey)}
          </h1>
        </header>
      ) : null}
      <Outlet />
    </div>
  )
}
