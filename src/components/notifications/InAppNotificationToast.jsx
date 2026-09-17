import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { Bell, Clock, HandCoins, Sparkles, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import { hapticImpact } from '../../lib/haptics'

function toTimestamp(val) {
  if (!val) return 0
  if (typeof val === 'number') return val
  const t = new Date(val).getTime()
  return isNaN(t) ? 0 : t
}

function getToastIcon(type = '', title = '', message = '') {
  const text = (title + ' ' + message).toLowerCase()
  if (type === 'loan' || text.includes('pinjaman') || text.includes('utang') || text.includes('piutang')) {
    return { Icon: HandCoins, color: 'text-rose-500', bg: 'bg-rose-500/15 border border-rose-500/20' }
  }
  if (type === 'danger' || type === 'error' || type === 'recurring_failed' || text.includes('gagal') || text.includes('failed')) {
    return { Icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/15 border border-rose-500/20' }
  }
  if (type === 'budget' || text.includes('anggaran') || text.includes('budget')) {
    return { Icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/15 border border-amber-500/20' }
  }
  if (type === 'todo' || type === 'habit' || text.includes('tugas') || text.includes('jatuh tempo') || text.includes('due')) {
    return { Icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/15 border border-amber-500/20' }
  }
  if (type === 'recurring' || type === 'recurring_auto') {
    return { Icon: RefreshCw, color: 'text-emerald-500', bg: 'bg-emerald-500/15 border border-emerald-500/20' }
  }
  if (type === 'success' || text.includes('berhasil') || text.includes('tersimpan')) {
    return { Icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/15 border border-emerald-500/20' }
  }
  if (type === 'ai' || text.includes('ai') || text.includes('sistem')) {
    return { Icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-500/15 border border-indigo-500/20' }
  }
  return { Icon: Bell, color: 'text-sky-500', bg: 'bg-sky-500/15 border border-sky-500/20' }
}

export default function InAppNotificationToast() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeToast, setActiveToast] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)

  const queueRef = useRef([])
  const isShowingRef = useRef(false)
  const timerRef = useRef(null)
  const processedIdsRef = useRef(new Set())
  const touchStartRef = useRef({ y: 0, time: 0, moved: false })
  const processNextToastRef = useRef(null)

  // Listen to new unread database notifications without dropping items in batch
  const recentNotifications = useLiveQuery(async () => {
    const items = await db.notifications.toArray()
    if (!items || items.length === 0) return []
    const now = Date.now()
    return items
      .filter((n) => !n.read && !n.isRead && now - toTimestamp(n.createdAt) <= 15000)
      .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
  }, [])

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsVisible(false)
    setDragOffset(0)

    setTimeout(() => {
      setActiveToast(null)
      isShowingRef.current = false
      if (queueRef.current.length > 0 && typeof processNextToastRef.current === 'function') {
        processNextToastRef.current()
      }
    }, 320)
  }, [])

  const processNextToast = useCallback(() => {
    if (isShowingRef.current || queueRef.current.length === 0) return

    const nextItem = queueRef.current.shift()
    if (!nextItem) return

    isShowingRef.current = true
    setActiveToast(nextItem)
    setDragOffset(0)
    hapticImpact('light')

    requestAnimationFrame(() => {
      setIsVisible(true)
    })

    timerRef.current = setTimeout(() => {
      dismissToast()
    }, nextItem.duration || 4500)
  }, [dismissToast])

  useEffect(() => {
    processNextToastRef.current = processNextToast
  }, [processNextToast])

  const enqueueToast = useCallback(
    (toastData) => {
      if (!toastData) return
      queueRef.current.push(toastData)
      if (!isShowingRef.current) {
        processNextToast()
      }
    },
    [processNextToast]
  )

  useEffect(() => {
    if (!recentNotifications || recentNotifications.length === 0) return

    for (const notif of recentNotifications) {
      const notifId = notif.id || notif.createdAt
      if (processedIdsRef.current.has(notifId)) continue

      processedIdsRef.current.add(notifId)
      enqueueToast({
        id: notifId,
        title: notif.title || t('notifications.defaultTitle', 'Notifikasi Baru'),
        message: notif.message || '',
        type: notif.type,
        route: notif.route,
        relatedId: notif.relatedId,
      })
    }
  }, [recentNotifications, enqueueToast, t])

  // Custom Event Listener for instant manual toasts
  useEffect(() => {
    const handleCustomToast = (event) => {
      if (event.detail) {
        enqueueToast(event.detail)
      }
    }
    window.addEventListener('ft-show-toast', handleCustomToast)
    return () => window.removeEventListener('ft-show-toast', handleCustomToast)
  }, [enqueueToast])

  // Tap-to-navigate action
  const handleToastClick = useCallback(() => {
    if (touchStartRef.current.moved) return
    if (!activeToast) return

    hapticImpact('light')
    const rawRoute = activeToast.route
    const cleanRoute = rawRoute && typeof rawRoute === 'string'
      ? (rawRoute.startsWith('fintrack://') ? rawRoute.replace(/^fintrack:\/\//, '/') : rawRoute)
      : null

    if (cleanRoute === '/recurring') {
      navigate('/settings/recurring')
    } else if (cleanRoute) {
      navigate(cleanRoute)
    } else if (activeToast.type === 'loan') {
      navigate('/loans')
    } else if (activeToast.type === 'todo' || activeToast.type === 'habit') {
      navigate('/todos')
    } else if (activeToast.type === 'budget') {
      navigate('/budget')
    } else if (activeToast.type === 'recurring' || activeToast.type === 'recurring_auto' || activeToast.type === 'recurring_failed') {
      navigate('/settings/recurring')
    }

    dismissToast()
  }, [activeToast, navigate, dismissToast])

  // Touch handlers for swipe-up dismiss gesture with velocity tracking
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
      moved: false,
    }
  }

  const handleTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.abs(dy) > 5) {
      touchStartRef.current.moved = true
    }
    // Only allow upward drag (negative dy) or slight damping downward
    if (dy < 0) {
      setDragOffset(dy)
    } else {
      setDragOffset(dy * 0.15)
    }
  }

  const handleTouchEnd = (e) => {
    const clientY = e.changedTouches?.[0]?.clientY ?? touchStartRef.current.y
    const dy = clientY - touchStartRef.current.y
    const dt = Math.max(1, Date.now() - touchStartRef.current.time)
    const velocity = -dy / dt // px/ms upward

    if (dy < -40 || velocity > 0.4) {
      hapticImpact('light')
      setDragOffset(-120)
      dismissToast()
    } else {
      setDragOffset(0)
    }
  }

  if (!activeToast && !isVisible) return null

  const { Icon, color, bg } = getToastIcon(activeToast?.type, activeToast?.title, activeToast?.message)

  return createPortal(
    <div
      role="alert"
      tabIndex={0}
      onClick={handleToastClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fixed top-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm cursor-pointer select-none transition-all duration-350 ease-out transform-gpu pointer-events-auto ${
        isVisible
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95 pointer-events-none'
      }`}
      style={{
        transform: isVisible
          ? `translate3d(-50%, ${dragOffset}px, 0)`
          : 'translate3d(-50%, -40px, 0) scale(0.95)',
        transition: dragOffset !== 0 ? 'none' : 'transform 360ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 280ms ease-out, scale 280ms ease-out',
        touchAction: 'pan-y',
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[var(--panel-strong)]/95 backdrop-blur-2xl p-3.5 shadow-2xl shadow-black/20 flex items-start gap-3 active:scale-[0.98] transition-transform">
        {/* Icon Badge */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color} shadow-xs`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-black tracking-tight text-[var(--fg)] truncate">
              {activeToast?.title || t('notifications.fallbackTitle', 'Notifikasi')}
            </h5>
            <span className="text-[10px] font-extrabold text-[var(--accent-alt,#6B7C5E)] tracking-wider uppercase shrink-0">
              {t('notifications.toastBadgeNew', 'Baru')}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-[var(--muted)] line-clamp-2">
            {activeToast?.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            dismissToast()
          }}
          className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition shrink-0 cursor-pointer"
          title={t('common.close', 'Tutup')}
        >
          <X size={14} />
        </button>

        {/* Bottom Progress Timer Line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border)]/30 overflow-hidden">
          <div
            className={`h-full ${color.replace('text-', 'bg-')} transition-all duration-[4500ms] linear`}
            style={{ width: isVisible ? '0%' : '100%' }}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
