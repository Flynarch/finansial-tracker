import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  HandCoins,
  CheckSquare,
  Calendar,
  BarChart3,
  User,
  Settings,
} from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import { navItems } from './navItems'

const ICON_MAP = {
  home: LayoutDashboard,
  list: Receipt,
  handcoins: HandCoins,
  todo: CheckSquare,
  calendar: Calendar,
  report: BarChart3,
  user: User,
  gear: Settings,
}

function linkClassName({ isActive }) {
  return `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
    isActive
      ? 'ft-nav-active shadow-2xs text-[var(--fg)] bg-[var(--panel-strong)]'
      : 'text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)]'
  }`
}

function Sidebar() {
  const { t } = useTranslation()

  return (
    <aside data-tour="bottom-nav" className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] px-3.5 py-5 md:block">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard
          return (
            <NavLink key={item.path} to={item.path} className={linkClassName}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] shadow-2xs">
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
