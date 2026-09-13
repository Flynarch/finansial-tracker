import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { Bell, Clock, HandCoins, Sparkles, X, CheckCircle2 } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'

function getToastIcon(type = '', title = '', message = '') {
  const text = (title + ' ' + message).toLowerCase()
  if (type === 'loan' || text.includes('pinjaman') || text.includes('utang') || text.includes('piutang')) {
    return { Icon: HandCoins, color: 'text-rose-500', bg: 'bg-rose-500/15 border border-rose-500/20' }
  }
  if (type === 'todo' || type === 'habit' || text.includes('tugas') || text.includes('jatuh tempo') || text.includes('due')) {
    return { Icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/15 border border-amber-500/20' }
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
  const [activeToast, setActiveToast] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const lastProcessedIdRef = useRef(null)
  const timerRef = useRef(null)

  // Listen to new database notifications
  const latestNotification = useLiveQuery(async () => {
    const items = await db.notifications.toArray()
    if (items.length === 0) return null
    return items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0]
  }, [])

  const dismissToast = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => {
      setActiveToast(null)
    }, 350)
  }, [])

  const showToast = useCallback((toastData) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    // Haptic vibration
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(15) } catch { /* ignore */ }
    }

    setActiveToast(toastData)
    setIsVisible(true)

    timerRef.current = setTimeout(() => {
      dismissToast()
    }, 4500)
  }, [dismissToast])

  useEffect(() => {
    if (!latestNotification) return
    const notifId = latestNotification.id || latestNotification.createdAt
    // Ignore already processed or read notifications on initial load
    if (lastProcessedIdRef.current === notifId || latestNotification.read) {
      return
    }

    // Process only recent notifications (created in the last 15 seconds)
    const createdTime = latestNotification.createdAt ? new Date(latestNotification.createdAt).getTime() : 0
    if (isNaN(createdTime) || createdTime <= 0 || Date.now() - createdTime > 15000) {
      lastProcessedIdRef.current = notifId
      return
    }

    lastProcessedIdRef.current = notifId
    const toastInfo = {
      title: latestNotification.title || 'Notifikasi Baru',
      message: latestNotification.message || '',
      type: latestNotification.type,
    }
    const frameId = requestAnimationFrame(() => {
      showToast(toastInfo)
    })
    return () => cancelAnimationFrame(frameId)
  }, [latestNotification, showToast])

  // Custom Event Listener for instant manual toasts
  useEffect(() => {
    const handleCustomToast = (event) => {
      if (event.detail) {
        showToast(event.detail)
      }
    }
    window.addEventListener('ft-show-toast', handleCustomToast)
    return () => window.removeEventListener('ft-show-toast', handleCustomToast)
  }, [showToast])

  if (!activeToast && !isVisible) return null

  const { Icon, color, bg } = getToastIcon(activeToast?.type, activeToast?.title, activeToast?.message)

  return createPortal(
    <div
      className={`fixed top-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm transition-all duration-350 ease-out transform-gpu pointer-events-auto ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
      }`}
      style={{
        transition: 'transform 380ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 300ms ease-out, scale 300ms ease-out',
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[var(--panel-strong)]/95 backdrop-blur-2xl p-3.5 shadow-2xl shadow-black/20 flex items-start gap-3">
        {/* Icon Badge */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color} shadow-xs`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-black tracking-tight text-[var(--fg)] truncate">
              {activeToast?.title || 'Notifikasi'}
            </h5>
            <span className="text-[10px] font-extrabold text-[var(--accent)] tracking-wider uppercase shrink-0">
              Baru
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-[var(--muted)] line-clamp-2">
            {activeToast?.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={dismissToast}
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
