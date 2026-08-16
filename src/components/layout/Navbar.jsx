import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import useChatStore from '../../store/useChatStore'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Trash2,
  Clock,
  HandCoins,
  Sparkles,
  X,
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

/* ─── notification category icon ─── */
function getNotificationIcon(title = '', message = '') {
  const text = (title + ' ' + message).toLowerCase()
  if (text.includes('pinjaman') || text.includes('utang') || text.includes('piutang') || text.includes('bayar')) {
    return { Icon: HandCoins, color: 'text-rose-500', bg: 'bg-rose-500/12 border border-rose-500/20' }
  }
  if (text.includes('tugas') || text.includes('jatuh tempo') || text.includes('due') || text.includes('jadwal')) {
    return { Icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/12 border border-amber-500/20' }
  }
  if (text.includes('ai') || text.includes('sistem') || text.includes('berhasil')) {
    return { Icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-500/12 border border-indigo-500/20' }
  }
  return { Icon: Bell, color: 'text-sky-500', bg: 'bg-sky-500/12 border border-sky-500/20' }
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
  const dropdownRef = useRef(null)

  const notifications = useLiveQuery(async () => {
    const data = await db.notifications.toArray()
    return data.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
  })
  const unreadCount = notifications ? notifications.filter((n) => !n.read).length : 0

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [showNotifications])

  const markAsRead = async (id) => {
    await db.notifications.update(id, { read: true })
  }

  const markAllAsRead = async () => {
    if (!notifications) return
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) {
      await db.notifications.where('id').anyOf(unreadIds).modify({ read: true })
    }
  }

  const deleteNotification = async (e, id) => {
    e.stopPropagation()
    await db.notifications.delete(id)
  }

  const clearAllNotifications = async () => {
    await db.notifications.clear()
  }

  const initials = profileName ? profileName.substring(0, 2).toUpperCase() : 'FT'

  return (
    <header className="pt-[max(env(safe-area-inset-top,0px),1.25rem)] pb-2 px-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">

        {/* ── Left: Profile Identity ── */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="group flex min-w-0 items-center gap-3 text-left rounded-2xl py-1.5 pr-2 pl-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.97] transition-transform duration-150 cursor-pointer"
          title={t('profile.title', 'Lihat Profil')}
          aria-label={t('profile.title', 'Lihat Profil')}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[0.85rem] text-[13px] font-black tracking-wide transition-shadow duration-200 group-hover:shadow-md"
              style={{
                background: 'linear-gradient(145deg, var(--fg), color-mix(in srgb, var(--fg) 75%, var(--accent)))',
                color: 'var(--bg)',
              }}
            >
              {initials}
            </div>
            {/* Online status indicator */}
            <span className="absolute -bottom-[2px] -right-[2px] h-[10px] w-[10px] rounded-full bg-emerald-500 ring-[2.5px] ring-[var(--bg)]" />
          </div>

          {/* Identity text */}
          <div className="min-w-0 flex flex-col gap-0.5">
            <p className="truncate text-[10px] font-extrabold tracking-[0.14em] text-[var(--muted)] uppercase leading-none select-none">
              {greetingText}
            </p>
            <div className="flex items-center gap-0.5 min-w-0">
              <h1 className="truncate text-[15px] font-black tracking-tight text-[var(--fg)] leading-tight">
                {profileName || 'FinTrack'}
              </h1>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] group-hover:text-[var(--fg)] group-hover:translate-x-0.5 transition-all duration-200"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </button>

        {/* ── Right: Action Icons ── */}
        <div className="flex shrink-0 items-center gap-1.5" ref={dropdownRef}>

          {/* Date chip — desktop only */}
          <span className="hidden sm:inline-flex items-center rounded-lg bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-[var(--muted)] mr-1">
            {compactDate}
          </span>

          {/* AI Chat */}
          <button
            type="button"
            onClick={() => useChatStore.getState().setIsOpen(true)}
            aria-label={t('aiChat.title', 'Konsultasi AI Chat')}
            title={t('aiChat.title', 'Konsultasi AI Chat')}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--field-bg)] active:scale-[0.92] shadow-[var(--shadow-soft)] transition-all duration-150 cursor-pointer"
          >
            <Sparkles className="h-[15px] w-[15px]" strokeWidth={2.2} />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label={t('navbar.notifications', 'Notifikasi')}
              aria-expanded={showNotifications}
              title={t('navbar.notifications', 'Notifikasi')}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-150 active:scale-[0.92] cursor-pointer ${
                showNotifications
                  ? 'bg-[var(--fg)] text-[var(--bg)] border-transparent shadow-md'
                  : 'bg-[var(--panel-strong)] text-[var(--fg)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--field-bg)] shadow-[var(--shadow-soft)]'
              }`}
            >
              <Bell className="h-[15px] w-[15px]" strokeWidth={2.2} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-[3px] text-[8px] font-black text-white ring-2 ring-[var(--bg)] tabular-nums">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* ── Notification Dropdown ── */}
            {showNotifications && (
              <div className="absolute right-0 top-11 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)]/95 backdrop-blur-xl p-3.5 shadow-2xl shadow-black/15 max-h-[460px] flex flex-col origin-top-right animate-[ft-spring-dropdown_0.32s_cubic-bezier(0.34,1.56,0.64,1)_both]">
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2.5 mb-2.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[13px] font-black tracking-tight text-[var(--fg)]">
                      {t('navbar.notifications', 'Notifikasi')}
                    </h4>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-black text-rose-500 border border-rose-500/20 tabular-nums">
                        {unreadCount} {t('notifications.new', 'baru')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[10px] font-extrabold flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition cursor-pointer"
                        title={t('notifications.markAllRead', 'Tandai semua dibaca')}
                      >
                        <CheckCheck size={12} />
                        <span>{t('notifications.read', 'Dibaca')}</span>
                      </button>
                    )}
                    {notifications && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllNotifications}
                        className="p-1 rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title={t('common.deleteAll', 'Hapus semua')}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 space-y-2 ft-hide-scrollbar">
                  {!notifications || notifications.length === 0 ? (
                    <div className="py-10 text-center flex flex-col items-center justify-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]/50 shadow-inner">
                        <BellOff className="h-5 w-5 opacity-60" strokeWidth={1.8} />
                      </div>
                      <p className="text-[13px] font-black text-[var(--fg)]">
                        {t('notifications.emptyTitle', 'Belum Ada Notifikasi')}
                      </p>
                      <p className="mt-1 px-4 text-[11px] font-medium leading-relaxed text-[var(--muted)] max-w-[220px]">
                        {t('notifications.emptyDesc', 'Pengingat tugas, utang-piutang, dan transaksi berulang akan muncul di sini.')}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const { Icon, color, bg } = getNotificationIcon(n.title, n.message)
                      return (
                        <div
                          key={n.id}
                          onClick={() => !n.read && markAsRead(n.id)}
                          className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            n.read
                              ? 'bg-transparent border-transparent opacity-65 hover:opacity-100 hover:bg-[var(--field-bg)]/50'
                              : 'bg-[var(--field-bg)] border-[color-mix(in_srgb,var(--border)_70%,transparent)] shadow-xs hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}>
                            <Icon size={14} strokeWidth={2.2} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[11px] font-extrabold truncate text-[var(--fg)]">
                                {n.title}
                              </span>
                              <span className="text-[9px] font-bold text-[var(--muted-2)] shrink-0">
                                {formatDistanceToNow(new Date(n.createdAt), {
                                  addSuffix: true,
                                  locale: locale === 'en' ? undefined : localeId,
                                })}
                              </span>
                            </div>
                            <p className="text-[10.5px] font-medium leading-relaxed text-[var(--muted)] line-clamp-2">
                              {n.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => deleteNotification(e, n.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                            title={t('common.delete', 'Hapus')}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
