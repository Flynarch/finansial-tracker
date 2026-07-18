import { NavLink } from 'react-router-dom'
import useTranslation from '../../hooks/useTranslation'
import { navItems } from './navItems'

function linkClassName({ isActive }) {
  return `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
    isActive
      ? 'ft-nav-active shadow-sm'
      : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-[var(--fg)]'
  }`
}

function Sidebar() {
  const { t } = useTranslation()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] px-3 py-4 md:block">
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClassName}>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--field-bg)] text-[10px] font-bold tracking-wide text-[var(--fg)]">
              {item.short}
            </span>
            <span className="font-medium">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
