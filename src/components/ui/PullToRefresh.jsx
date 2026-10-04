import { useState, useRef, useEffect, useCallback } from 'react'
import { triggerHaptic } from '../../lib/haptics'
import useSettingsStore from '../../store/useSettingsStore'
import { Loader2, ArrowDown, Check } from 'lucide-react'

/**
 * PullToRefresh
 * Mobile-first elastic pull-to-refresh component with spring physics,
 * logarithmic rubber-banding, circular SVG progress ring, and haptic feedback.
 */
export default function PullToRefresh({
  onRefresh,
  disabled = false,
  pullDownThreshold = 65,
  maxPull = 110,
  children,
  className = '',
  contentClassName = '',
  scrollContainerRef,
}) {
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)

  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasThresholdPassed, setHasThresholdPassed] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const touchStartY = useRef(0)
  const isPullingRef = useRef(false)
  const thresholdPassedRef = useRef(false)
  const innerContainerRef = useRef(null)
  const pullDistanceRef = useRef(0)
  const isRefreshingRef = useRef(false)

  const progress = Math.min(1, pullDistance / pullDownThreshold)
  const circleCircumference = 2 * Math.PI * 9 // r = 9 -> ~56.55

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshingRef.current || isDone) return
    const scrollTop = scrollContainerRef?.current
      ? scrollContainerRef.current.scrollTop
      : window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0

    if (scrollTop <= 1) {
      touchStartY.current = e.touches[0].clientY
      isPullingRef.current = true
      setIsPulling(true)
      thresholdPassedRef.current = false
    }
  }, [disabled, isDone, scrollContainerRef])

  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current || disabled || isRefreshingRef.current || isDone) return
    const currentY = e.touches[0].clientY
    const rawDeltaY = currentY - touchStartY.current

    if (rawDeltaY > 0) {
      // Damped logarithmic rubber-banding
      const dampedDistance = Math.min(maxPull, Math.pow(rawDeltaY, 0.82) * 1.6)
      pullDistanceRef.current = dampedDistance
      setPullDistance(dampedDistance)

      if (dampedDistance >= pullDownThreshold && !thresholdPassedRef.current) {
        thresholdPassedRef.current = true
        setHasThresholdPassed(true)
        triggerHaptic('light')
      } else if (dampedDistance < pullDownThreshold && thresholdPassedRef.current) {
        thresholdPassedRef.current = false
        setHasThresholdPassed(false)
      }

      // Prevent native browser refresh overlay on mobile Chrome/Android
      if (e.cancelable && rawDeltaY > 10) {
        e.preventDefault()
      }
    } else {
      pullDistanceRef.current = 0
      setPullDistance(0)
      isPullingRef.current = false
      setIsPulling(false)
    }
  }, [disabled, isDone, maxPull, pullDownThreshold])

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled) return
    isPullingRef.current = false
    setIsPulling(false)

    if (pullDistanceRef.current >= pullDownThreshold && !isRefreshingRef.current) {
      isRefreshingRef.current = true
      setIsRefreshing(true)
      pullDistanceRef.current = 48
      setPullDistance(48) // Lock at indicator height
      triggerHaptic('medium')

      try {
        if (typeof onRefresh === 'function') {
          await onRefresh()
        }
      } catch (err) {
        console.warn('[PullToRefresh] onRefresh failed:', err)
      } finally {
        setIsDone(true)
        triggerHaptic('success')
        setTimeout(() => {
          isRefreshingRef.current = false
          setIsRefreshing(false)
          setIsDone(false)
          pullDistanceRef.current = 0
          setPullDistance(0)
          setHasThresholdPassed(false)
          thresholdPassedRef.current = false
        }, 400)
      }
    } else {
      pullDistanceRef.current = 0
      setPullDistance(0)
      setHasThresholdPassed(false)
      thresholdPassedRef.current = false
    }
  }, [disabled, onRefresh, pullDownThreshold])

  // Bind touch listeners to scroll container (supports non-passive touchmove for Android)
  useEffect(() => {
    const el = scrollContainerRef?.current || innerContainerRef.current
    if (!el || typeof el.addEventListener !== 'function') return

    const onStart = (e) => handleTouchStart(e)
    const onMove = (e) => handleTouchMove(e)
    const onEnd = () => handleTouchEnd()

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollContainerRef, handleTouchStart, handleTouchMove, handleTouchEnd])

  return (
    <div
      ref={scrollContainerRef ? undefined : innerContainerRef}
      className={`relative ${className}`}
      style={{
        overscrollBehaviorY: 'contain',
      }}
    >
      {/* Floating Indicator Capsule */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center justify-center ${
          reduceMotion
            ? 'transition-opacity duration-150'
            : isPulling
            ? 'transition-none'
            : 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
        }`}
        style={{
          opacity: pullDistance > 8 || isRefreshing ? 1 : 0,
          transform: `translate3d(-50%, ${Math.max(0, pullDistance - 42)}px, 0) scale(${
            Math.min(1.05, 0.7 + progress * 0.35)
          })`,
        }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] shadow-[var(--shadow-card)] backdrop-blur-md">
          {isRefreshing ? (
            isDone ? (
              <Check className="h-4.5 w-4.5 text-emerald-500 animate-in zoom-in-75 duration-200" strokeWidth={3} />
            ) : (
              <Loader2 className="h-4.5 w-4.5 animate-spin text-[var(--accent)]" strokeWidth={2.5} />
            )
          ) : (
            <div className="relative flex h-6 w-6 items-center justify-center">
              {/* Circular Progress Ring */}
              <svg className="h-6 w-6 -rotate-90 transform" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  className="stroke-[var(--border)]/60"
                  strokeWidth="2.2"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  className="stroke-[var(--accent)] transition-[stroke-dashoffset] duration-75"
                  strokeWidth="2.2"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={circleCircumference * (1 - progress)}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              {/* Directional Arrow inside ring */}
              <ArrowDown
                className={`absolute h-3.5 w-3.5 text-[var(--fg)] transition-transform duration-200 ${
                  hasThresholdPassed ? 'rotate-180 text-[var(--accent)]' : 'rotate-0'
                }`}
                strokeWidth={2.5}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content wrapper with elastic spring follow */}
      <div
        className={`${
          isPulling
            ? 'transition-none'
            : 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
        } transform-gpu ${contentClassName}`}
        style={{
          transform: pullDistance > 0 ? `translate3d(0, ${pullDistance * 0.4}px, 0)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
