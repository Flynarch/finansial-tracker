import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { CheckCheck } from 'lucide-react'

function Navbar() {
  const { t, locale } = useTranslation()
  const profileName = useSettingsStore((state) => state.profileName)
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef(null)

  const notifications = useLiveQuery(() => db.notifications.reverse().sortBy('createdAt'))
  const unreadCount = notifications ? notifications.filter(n => !n.read).length : 0

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
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length > 0) {
      await db.notifications.where('id').anyOf(unreadIds).modify({ read: true })
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2.5 shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--fg)] text-xs font-black tracking-wider text-[var(--bg)] shadow-sm">
            FT
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">FinTrack</span>
              {profileName ? (
                <>
                  <span className="text-[10px] text-[var(--border-strong)]">•</span>
                  <span className="truncate text-[11px] font-semibold text-[var(--accent)]">{profileName}</span>
                </>
              ) : null}
            </div>
            <p className="truncate text-sm font-bold tracking-tight text-[var(--fg)] sm:text-base">
              {profileName ? `Hai, ${profileName}` : 'Keuangan Pribadi'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5" ref={dropdownRef}>
          <span className="hidden rounded-lg border border-[var(--border)]/60 bg-[var(--field-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] sm:inline-block">
            {todayLabel}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label={t('navbar.notifications') || 'Notifikasi'}
              aria-expanded={showNotifications}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                showNotifications
                  ? 'border-[var(--fg)] bg-[var(--panel)] text-[var(--fg)] shadow-sm'
                  : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:bg-[var(--panel)] hover:shadow-[var(--accent-glow)]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6.5 16.5V11a5.5 5.5 0 1 1 11 0v5.5l1.5 1.5H5z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-[var(--panel-strong)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="ft-motion-panel absolute right-0 top-11 z-50 w-80 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-xl sm:w-96 max-h-[400px] flex flex-col">
                <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 mb-2 shrink-0">
                  <h4 className="text-sm font-bold tracking-wide text-[var(--fg)]">
                    Notifikasi
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs font-medium flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition"
                    >
                      <CheckCheck size={14} /> Tandai dibaca
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-2">
                  {!notifications || notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]/40">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M6.5 16.5V11a5.5 5.5 0 1 1 11 0v5.5l1.5 1.5H5z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-[var(--fg)]">Belum Ada Notifikasi</p>
                      <p className="mt-1 px-2 text-xs leading-relaxed text-[var(--muted)]">
                        Pengingat jadwal dan pembaruan akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => !n.read && markAsRead(n.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer ${n.read ? 'bg-transparent border-transparent opacity-60' : 'bg-[var(--field-bg)] border-[var(--border)] shadow-sm'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-[var(--fg)]">{n.title}</span>
                          <span className="text-[10px] text-[var(--muted)]">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: locale === 'en' ? undefined : localeId })}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text)]">{n.message}</p>
                      </div>
                    ))
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
