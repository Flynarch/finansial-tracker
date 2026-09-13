import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId, enUS } from 'date-fns/locale'
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Clock,
  HandCoins,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import { db } from '../../lib/db'
import useTranslation from '../../hooks/useTranslation'
import useTransactionStore from '../../store/useTransactionStore'
import { triggerHaptic } from '../../lib/haptics'

function getNotificationMeta(item) {
  const text = `${item.title || ''} ${item.message || ''}`.toLowerCase()
  const type = item.type || ''

  if (
    type === 'alert' ||
    type === 'warning' ||
    text.includes('melebihi') ||
    text.includes('limit') ||
    text.includes('anggaran')
  ) {
    return {
      Icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/12 border border-amber-500/25',
    }
  }
  if (
    type === 'loan' ||
    text.includes('pinjaman') ||
    text.includes('utang') ||
    text.includes('piutang') ||
    text.includes('bayar')
  ) {
    return {
      Icon: HandCoins,
      color: 'text-rose-500',
      bg: 'bg-rose-500/12 border border-rose-500/25',
    }
  }
  if (
    type === 'recurring_auto' ||
    type === 'success' ||
    text.includes('berhasil') ||
    text.includes('otomatis')
  ) {
    return {
      Icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/12 border border-emerald-500/25',
    }
  }
  if (
    type === 'todo' ||
    type === 'habit' ||
    text.includes('tugas') ||
    text.includes('jadwal') ||
    text.includes('due')
  ) {
    return {
      Icon: Clock,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/12 border border-cyan-500/25',
    }
  }
  if (type === 'ai' || text.includes('ai') || text.includes('sistem')) {
    return {
      Icon: Sparkles,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/12 border border-indigo-500/25',
    }
  }
  return {
    Icon: Bell,
    color: 'text-sky-500',
    bg: 'bg-sky-500/12 border border-sky-500/25',
  }
}

function getNotificationAction(item) {
  const titleMsg = `${item.title || ''} ${item.message || ''}`.toLowerCase()
  const type = item.type || ''
  const route = item.route || item.extra?.route || ''

  if (
    route === 'fintrack://quick-add' ||
    route === '/quick-add' ||
    titleMsg.includes('catat') ||
    titleMsg.includes('pengingat harian') ||
    titleMsg.includes('daily reminder')
  ) {
    return {
      labelKey: 'notifications.actionQuickAdd',
      defaultLabel: 'Catat Sekarang',
      type: 'quick-add',
    }
  }
  if (
    route.startsWith('/budget') ||
    type === 'alert' ||
    type === 'warning' ||
    titleMsg.includes('anggaran') ||
    titleMsg.includes('budget') ||
    titleMsg.includes('limit')
  ) {
    return {
      labelKey: 'notifications.actionBudget',
      defaultLabel: 'Lihat Anggaran',
      type: 'route',
      route: '/budget',
    }
  }
  if (
    route.startsWith('/loans') ||
    type === 'loan' ||
    titleMsg.includes('pinjaman') ||
    titleMsg.includes('utang') ||
    titleMsg.includes('piutang')
  ) {
    return {
      labelKey: 'notifications.actionLoans',
      defaultLabel: 'Lihat Pinjaman',
      type: 'route',
      route: '/loans',
    }
  }
  if (
    route.startsWith('/transactions') ||
    type === 'ingestion' ||
    type === 'mutation' ||
    type === 'recurring_auto' ||
    titleMsg.includes('mutasi') ||
    titleMsg.includes('transaksi') ||
    titleMsg.includes('tagihan rutin')
  ) {
    return {
      labelKey: 'notifications.actionTransactions',
      defaultLabel: 'Lihat Mutasi',
      type: 'route',
      route: '/transactions',
    }
  }
  if (
    route.startsWith('/todos') ||
    type === 'todo' ||
    type === 'habit' ||
    titleMsg.includes('tugas') ||
    titleMsg.includes('habit') ||
    titleMsg.includes('jadwal')
  ) {
    return {
      labelKey: 'notifications.actionTodos',
      defaultLabel: 'Buka Jadwal',
      type: 'route',
      route: route || '/todos',
    }
  }
  return null
}

function parseItemDate(createdAt) {
  if (!createdAt) return new Date()
  if (typeof createdAt === 'number') return new Date(createdAt)
  const parsed = new Date(createdAt)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

export default function NotificationDrawerSheet({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const openQuickAdd = useTransactionStore((s) => s.openQuickAdd)
  const [activeTab, setActiveTab] = useState('all')

  const rawNotifications = useLiveQuery(async () => {
    const data = await db.notifications.toArray()
    return data.sort((a, b) => {
      const timeA =
        typeof a.createdAt === 'string'
          ? new Date(a.createdAt).getTime()
          : Number(a.createdAt || 0)
      const timeB =
        typeof b.createdAt === 'string'
          ? new Date(b.createdAt).getTime()
          : Number(b.createdAt || 0)
      return timeB - timeA
    })
  })

  const notifications = useMemo(() => rawNotifications || [], [rawNotifications])

  const isUnread = (n) => !n.read && n.isRead !== 1
  const isAlert = (n) =>
    n.type === 'alert' ||
    n.type === 'warning' ||
    n.type === 'loan' ||
    `${n.title || ''} ${n.message || ''}`.toLowerCase().includes('peringatan') ||
    `${n.title || ''} ${n.message || ''}`.toLowerCase().includes('melebihi') ||
    `${n.title || ''} ${n.message || ''}`.toLowerCase().includes('jatuh tempo')

  const unreadCount = useMemo(
    () => notifications.filter(isUnread).length,
    [notifications]
  )
  const alertsCount = useMemo(
    () => notifications.filter(isAlert).length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') return notifications.filter(isUnread)
    if (activeTab === 'alerts') return notifications.filter(isAlert)
    return notifications
  }, [notifications, activeTab])

  const markAsRead = async (id) => {
    triggerHaptic('light')
    await db.notifications.update(id, { read: true, isRead: 1 })
  }

  const markAllAsRead = async () => {
    triggerHaptic('medium')
    await db.notifications.toCollection().modify({ read: true, isRead: 1 })
  }

  const deleteNotification = async (e, id) => {
    e.stopPropagation()
    triggerHaptic('light')
    await db.notifications.delete(id)
  }

  const clearAllNotifications = async () => {
    triggerHaptic('medium')
    await db.notifications.clear()
  }

  const handleCardClick = async (item) => {
    if (isUnread(item)) {
      await markAsRead(item.id)
    }
    const action = getNotificationAction(item)
    if (!action) return

    onClose?.()
    if (action.type === 'quick-add') {
      openQuickAdd()
    } else if (action.type === 'route' && action.route) {
      navigate(action.route)
    }
  }

  const dateLocale = locale === 'en' ? enUS : localeId

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      showHandle={true}
      maxWidth="sm:max-w-lg"
      maxHeight="max-h-[min(90dvh,46rem)]"
      title={
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight text-[var(--fg)]">
            {t('navbar.notifications', 'Notifikasi')}
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-500 border border-rose-500/25 tabular-nums">
              {unreadCount} {t('notifications.new', 'baru')}
            </span>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-4">
        {/* Top Control Bar: Category Tabs & Batch Actions */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-2.5">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/60">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setActiveTab('all')
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all duration-150 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('notifications.tabAll', 'Semua')} ({notifications.length})
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setActiveTab('unread')
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all duration-150 cursor-pointer ${
                activeTab === 'unread'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('notifications.tabUnread', 'Belum Dibaca')}
              {unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setActiveTab('alerts')
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all duration-150 cursor-pointer ${
                activeTab === 'alerts'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t('notifications.tabAlerts', 'Peringatan')}
              {alertsCount > 0 ? ` (${alertsCount})` : ''}
            </button>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex h-8 items-center gap-1 rounded-xl px-2 text-[11px] font-extrabold text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] transition active:scale-95 cursor-pointer"
                title={t('notifications.markAllRead', 'Tandai semua dibaca')}
              >
                <CheckCheck size={13} />
                <span className="hidden sm:inline">
                  {t('notifications.markAllRead', 'Tandai semua dibaca')}
                </span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
                title={t('common.deleteAll', 'Hapus semua')}
                aria-label={t('common.deleteAll', 'Hapus semua')}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2.5 pt-1">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--field-bg)] text-[var(--muted)] border border-[var(--border)]/60 shadow-inner">
                <BellOff className="h-6 w-6 opacity-60" strokeWidth={1.8} />
              </div>
              <p className="text-[14px] font-black text-[var(--fg)]">
                {activeTab === 'unread'
                  ? t('notifications.emptyUnreadTitle', 'Semua Notifikasi Telah Dibaca')
                  : activeTab === 'alerts'
                  ? t('notifications.emptyAlertsTitle', 'Tidak Ada Peringatan')
                  : t('notifications.emptyTitle', 'Belum Ada Notifikasi')}
              </p>
              <p className="mt-1 px-4 text-[12px] font-medium leading-relaxed text-[var(--muted)] max-w-[280px]">
                {activeTab === 'unread'
                  ? t(
                      'notifications.emptyUnreadDesc',
                      'Tidak ada notifikasi baru yang belum dibaca saat ini.'
                    )
                  : activeTab === 'alerts'
                  ? t(
                      'notifications.emptyAlertsDesc',
                      'Semua anggaran dan komitmen keuangan Anda dalam kondisi aman.'
                    )
                  : t(
                      'notifications.emptyDesc',
                      'Pengingat tugas, utang-piutang, dan transaksi berulang akan muncul di sini.'
                    )}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const { Icon, color, bg } = getNotificationMeta(item)
              const action = getNotificationAction(item)
              const unread = isUnread(item)
              const itemDate = parseItemDate(item.createdAt)

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item)}
                  className={`group relative flex flex-col gap-2 p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer ${
                    unread
                      ? 'bg-[var(--field-bg)] border-[color-mix(in_srgb,var(--border)_80%,transparent)] shadow-xs hover:border-[var(--border-strong)]'
                      : 'bg-transparent border-[var(--border)]/40 opacity-75 hover:opacity-100 hover:bg-[var(--field-bg)]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${color} shadow-2xs`}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                    </div>

                    {/* Content Header & Body */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {unread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 ring-2 ring-rose-500/20" />
                          )}
                          <h5 className="text-[12px] font-black tracking-tight text-[var(--fg)] truncate">
                            {item.title}
                          </h5>
                        </div>

                        <span className="text-[10px] font-bold text-[var(--muted-2)] shrink-0">
                          {formatDistanceToNow(itemDate, {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </span>
                      </div>

                      <p className="text-[11.5px] font-medium leading-relaxed text-[var(--muted)] line-clamp-3">
                        {item.message}
                      </p>
                    </div>

                    {/* Delete Item Button */}
                    <button
                      type="button"
                      onClick={(e) => deleteNotification(e, item.id)}
                      className="p-1 rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0 cursor-pointer"
                      title={t('common.delete', 'Hapus')}
                      aria-label={t('common.delete', 'Hapus')}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Contextual Action Button if available */}
                  {action && (
                    <div className="flex items-center justify-between pl-12 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCardClick(item)
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-[var(--panel-strong)] border border-[var(--border)] px-2.5 py-1 text-[10.5px] font-extrabold text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <span>{t(action.labelKey, action.defaultLabel)}</span>
                        <ArrowRight size={11} className="text-[var(--muted)]" />
                      </button>

                      {unread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(item.id)
                          }}
                          className="text-[10.5px] font-extrabold text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          {t('notifications.read', 'Dibaca')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
