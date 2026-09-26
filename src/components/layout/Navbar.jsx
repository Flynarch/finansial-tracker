import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import UserAvatar from '../ui/UserAvatar'
import NotificationDrawerSheet from '../notifications/NotificationDrawerSheet'
import {
  Bell,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

/* ─── time-based greeting ─── */
function getTimeBasedGreeting(locale = 'id') {
  const hour = new Date().getHours()
  if (locale === 'en') {
    if (hour >= 4 && hour < 12) return 'Good Morning'
    if (hour >= 12 && hour < 17) return 'Good Afternoon'
    if (hour >= 17 && hour < 22) return 'Good Evening'
    return 'Good Night'
  }
  if (hour >= 4 && hour < 11) return 'Selamat Pagi'
  if (hour >= 11 && hour < 15) return 'Selamat Siang'
  if (hour >= 15 && hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

/* ─── today formatted as compact date chip ─── */
function getCompactDate(locale = 'id') {
  const now = new Date()
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(now)
}

function Navbar() {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const profileName = useSettingsStore((state) => state.profileName)
  const greetingText = getTimeBasedGreeting(locale)
  const compactDate = getCompactDate(locale)
  const [showNotifications, setShowNotifications] = useState(false)

  const unreadCount = useLiveQuery(async () => {
    return await db.notifications.filter((n) => !n.read && n.isRead !== 1).count()
  }, []) ?? 0

  return (
    <header className="pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-1 px-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">

        {/* ── Left: Compact Profile Identity ── */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="group flex min-w-0 items-center gap-2.5 text-left rounded-xl py-0.5 pr-2 pl-0.5 -ml-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.97] transition-transform duration-150 cursor-pointer"
          title={t('profile.title', 'Lihat Profil')}
          aria-label={t('profile.title', 'Lihat Profil')}
        >
          {/* Avatar (Compact) */}
          <UserAvatar
            size="md"
            shape="circle"
            showOnlineIndicator={true}
            className="group-hover:scale-105 transition-transform"
          />

          {/* Identity text */}
          <div className="min-w-0 flex flex-col justify-center">
            <p className="truncate text-[11px] font-extrabold tracking-wider text-[var(--muted)] uppercase leading-none select-none mb-0.5">
              {greetingText}
            </p>
            <div className="flex items-center gap-1 min-w-0">
              <h1 className="truncate text-[14px] sm:text-base font-black tracking-tight text-[var(--fg)] leading-tight">
                {profileName || 'FinTrack'}
              </h1>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] group-hover:text-[var(--fg)] group-hover:translate-x-0.5 transition-all duration-200"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </button>

        {/* ── Right: Action Icons (Compact) ── */}
        <div className="flex shrink-0 items-center gap-1.5">

          {/* Date chip — desktop only */}
          <span className="hidden sm:inline-flex items-center rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-[var(--muted)] mr-1">
            {compactDate}
          </span>

          {/* AI Chat */}
          <button
            type="button"
            data-tour="ai-chat-btn"
            onClick={() => navigate('/ai-chat')}
            aria-label={t('aiChat.title', 'Konsultasi AI Chat')}
            title={t('aiChat.title', 'Konsultasi AI Chat')}
            className="relative inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--field-bg)] active:scale-[0.92] shadow-2xs transition-all duration-150 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setShowNotifications(true)}
            aria-label={t('navbar.notifications', 'Notifikasi')}
            title={t('navbar.notifications', 'Notifikasi')}
            className={`relative inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition-all duration-150 active:scale-[0.92] cursor-pointer ${
              showNotifications
                ? 'bg-[var(--fg)] text-[var(--bg)] border-transparent shadow-xs'
                : 'bg-[var(--panel-strong)] text-[var(--fg)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--field-bg)] shadow-2xs'
            }`}
          >
            <Bell className="h-4 w-4" strokeWidth={2.2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white ring-2 ring-[var(--bg)] tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {showNotifications && (
        <NotificationDrawerSheet
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </header>
  )
}

export default Navbar
