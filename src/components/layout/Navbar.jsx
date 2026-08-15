import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Clock,
  HandCoins,
  Sparkles,
  X,
} from 'lucide-react'

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

function Navbar() {
  const { t, locale } = useTranslation()
  const profileName = useSettingsStore((state) => state.profileName)
  const greetingText = getTimeBasedGreeting(locale)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef(null)

  const notifications = useLiveQuery(async () => {
    const data = await db.notifications.toArray()
    return data.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
  })
  const unreadCount = notifications ? notifications.filter((n) => !n.read).length : 0

  const todayLabel = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'id-ID', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

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

  return (
    <header className="pt-5 pb-2 px-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fg)] text-xs font-bold tracking-[0.15em] text-[var(--bg)] shadow-sm">
            {profileName ? profileName.substring(0, 2).toUpperCase() : 'FT'}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <p className="truncate text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase mb-0.5">
              {greetingText}
            </p>
            <h1 className="truncate text-base font-bold tracking-tight text-[var(--fg)] leading-none">
              {profileName || 'FinTrack'}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3" ref={dropdownRef}>
          <span className="hidden rounded-lg bg-[var(--field-bg)] px-3 py-1.5 text-[11px] font-bold tracking-wide text-[var(--muted)] sm:inline-block">
            {todayLabel}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label={t('navbar.notifications') || 'Notifikasi'}
              aria-expanded={showNotifications}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 active:scale-95 cursor-pointer ${
                showNotifications
                  ? 'bg-[var(--fg)] text-[var(--bg)] border-transparent shadow-md'
                  : 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border)] hover:bg-[var(--border)]/40 shadow-xs'
              }`}
            >
              <Bell className="h-4.5 w-4.5" strokeWidth={2.2} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-[var(--panel-strong)]" />
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-3xl border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)]/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/15 max-h-[460px] flex flex-col origin-top-right animate-[ft-spring-dropdown_0.32s_cubic-bezier(0.34,1.56,0.64,1)_both]">
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 mb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black tracking-tight text-[var(--fg)]">
                      Notifikasi
                    </h4>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-500 border border-rose-500/20">
                        {unreadCount} baru
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[11px] font-extrabold flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition cursor-pointer"
                        title="Tandai semua dibaca"
                      >
                        <CheckCheck size={13} />
                        <span>Dibaca</span>
                      </button>
                    )}
                    {notifications && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllNotifications}
                        className="p-1 rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Hapus semua"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 space-y-2.5 ft-hide-scrollbar">
                  {!notifications || notifications.length === 0 ? (
                    <div className="py-10 text-center flex flex-col items-center justify-center">
                      <div className="mb-3 flex h-13 w-13 items-center justify-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]/50 shadow-inner">
                        <BellOff className="h-6 w-6 opacity-60" strokeWidth={1.8} />
                      </div>
                      <p className="text-sm font-black text-[var(--fg)]">Belum Ada Notifikasi</p>
                      <p className="mt-1 px-4 text-xs font-medium leading-relaxed text-[var(--muted)] max-w-[240px]">
                        Pengingat tugas, utang-piutang, dan transaksi berulang akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const { Icon, color, bg } = getNotificationIcon(n.title, n.message)
                      return (
                        <div
                          key={n.id}
                          onClick={() => !n.read && markAsRead(n.id)}
                          className={`group relative flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                            n.read
                              ? 'bg-transparent border-transparent opacity-65 hover:opacity-100 hover:bg-[var(--field-bg)]/50'
                              : 'bg-[var(--field-bg)] border-[color-mix(in_srgb,var(--border)_70%,transparent)] shadow-xs hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                            <Icon size={16} strokeWidth={2.2} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={`text-xs font-extrabold truncate ${n.read ? 'text-[var(--fg)]' : 'text-[var(--fg)]'}`}>
                                {n.title}
                              </span>
                              <span className="text-[10px] font-bold text-[var(--muted-2)] shrink-0">
                                {formatDistanceToNow(new Date(n.createdAt), {
                                  addSuffix: true,
                                  locale: locale === 'en' ? undefined : localeId,
                                })}
                              </span>
                            </div>
                            <p className="text-[11.5px] font-medium leading-relaxed text-[var(--muted)] line-clamp-2">
                              {n.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => deleteNotification(e, n.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                            title="Hapus"
                          >
                            <X size={12} />
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
