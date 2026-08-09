import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Helper to trigger haptic vibration feedback on supported mobile devices.
 */
function triggerHaptic(duration = 10) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(duration)
    } catch {
      // Ignore vibration errors on unsupported environments
    }
  }
}

/**
 * Calculates 2-stage magnetic detent displacement and mode.
 * @param {number} rawDx - Raw touch displacement X (negative when dragging left)
 * @param {Object} [options]
 * @param {number} [options.editDetent=-72] - Rest position for Edit detent
 * @param {number} [options.deleteThreshold=-125] - Threshold to switch to Delete mode
 * @returns {{ dx: number, mode: 'none' | 'edit' | 'delete' }}
 */
export function calculateMagneticSwipe(rawDx, { editDetent = -72, deleteThreshold = -125 } = {}) {
  if (rawDx >= 0) {
    // Rightward elastic rubber-band friction
    return { dx: rawDx * 0.25, mode: 'none' }
  }

  if (rawDx <= deleteThreshold) {
    // Stage 2: Delete breakout mode
    const extra = rawDx - deleteThreshold
    const dx = deleteThreshold + extra * 0.35
    return { dx: Math.max(-210, dx), mode: 'delete' }
  }

  if (rawDx <= -25) {
    // Stage 1: Strong Magnetic Detent Well around -72px
    const target = editDetent
    const diff = rawDx - target
    const sign = diff < 0 ? -1 : 1
    const normalized = Math.min(1, Math.abs(diff) / 50)
    const compressed = Math.pow(normalized, 2) * 22 * sign
    const dx = target + compressed
    return { dx, mode: 'edit' }
  }

  return { dx: rawDx, mode: 'none' }
}

/**
 * Updates DOM background visual for progressive swipe layer (Habits style).
 */
export function updateSwipeBgVisual(bgEl, mode, { editLabel = 'Edit', deleteLabel = 'Hapus' } = {}) {
  if (!bgEl || bgEl.dataset.swipeMode === mode) return
  
  const previousMode = bgEl.dataset.swipeMode
  bgEl.dataset.swipeMode = mode
  bgEl.classList.remove('opacity-0', 'opacity-100', 'bg-rose-500/15', 'text-rose-500', 'bg-sky-500/15', 'text-sky-500')

  if (mode === 'delete') {
    if (previousMode !== 'delete') triggerHaptic(15)
    bgEl.classList.add('opacity-100', 'bg-rose-500/15', 'text-rose-500')
    bgEl.innerHTML = `<div class="flex items-center gap-1.5 font-extrabold text-xs transform transition-transform duration-200 scale-100"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span>${deleteLabel}</span></div>`
  } else if (mode === 'edit') {
    if (previousMode !== 'edit') triggerHaptic(10)
    bgEl.classList.add('opacity-100', 'bg-sky-500/15', 'text-sky-500')
    bgEl.innerHTML = `<div class="flex items-center gap-1.5 font-extrabold text-xs transform transition-transform duration-200 scale-100"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>${editLabel}</span></div>`
  } else {
    bgEl.classList.add('opacity-0')
    bgEl.innerHTML = ''
  }
}

/**
 * Hook to manage swipe-to-reveal action states and touch gesture handlers.
 * 
 * @param {any} initialSwipedId - Initial swiped item ID (default null)
 * @param {Object} options - Configuration options
 * @param {boolean} [options.closeOnScroll=true] - Whether to automatically reset swiped ID on window scroll
 * @returns {Object} { swipedId, setSwipedId, getSwipeHandlers, resetSwipe }
 */
export default function useSwipeAction(initialSwipedId = null, { closeOnScroll = true } = {}) {
  const [swipedId, setSwipedIdState] = useState(initialSwipedId)
  const [isSwipingId, setIsSwipingId] = useState(null)
  
  const swipedIdRef = useRef(initialSwipedId)
  const touchStartXRef = useRef(null)
  const touchStartYRef = useRef(null)

  // Drag-mode refs for continuous 60fps pan
  const swipeIdRef = useRef(null)
  const swipeDxRef = useRef(0)
  const ignoreNextClickRef = useRef(false)
  const rafIdRef = useRef(null)

  const setSwipedId = useCallback((idOrFn) => {
    setSwipedIdState((prev) => {
      const next = typeof idOrFn === 'function' ? idOrFn(prev) : idOrFn
      swipedIdRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    if (!closeOnScroll || typeof window === 'undefined') return undefined
    const closeSwipeOnScroll = () => {
      if (swipedIdRef.current !== null) {
        setSwipedId(null)
        setIsSwipingId(null)
      }
      if (swipeIdRef.current) swipeIdRef.current = null
    }
    window.addEventListener('scroll', closeSwipeOnScroll, { passive: true })
    return () => window.removeEventListener('scroll', closeSwipeOnScroll)
  }, [closeOnScroll, setSwipedId])

  const getSwipeHandlers = useCallback(
    (id, callbacks = {}) => ({
      onTouchStart: (event) => {
        const touch = event.touches?.[0] || event.changedTouches?.[0]
        if (!touch) return
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        swipeIdRef.current = String(id)
        touchStartXRef.current = touch.clientX
        touchStartYRef.current = touch.clientY
        swipeDxRef.current = String(swipedIdRef.current) === String(id) ? -72 : 0
        ignoreNextClickRef.current = false

        event.currentTarget.style.transition = 'none'
        event.currentTarget.style.willChange = 'transform'

        // Auto-close any previously open swiped item when touching a different item
        if (swipedIdRef.current !== null && String(swipedIdRef.current) !== String(id)) {
          setSwipedId(null)
        }
      },
      onTouchMove: (event) => {
        if (swipeIdRef.current !== String(id)) return
        const touch = event.touches?.[0] || event.changedTouches?.[0]
        if (!touch || touchStartXRef.current == null || touchStartYRef.current == null) return

        const dx = touch.clientX - touchStartXRef.current
        const dy = touch.clientY - touchStartYRef.current
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)

        // Cancel horizontal swipe if user starts scrolling vertically
        if (absDy > absDx * 1.2 && absDy > 10 && absDx < 15) {
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
          }
          swipeIdRef.current = null
          setIsSwipingId(null)
          setSwipedId(null)
          const currentTarget = event.currentTarget
          currentTarget.style.transition = 'transform 320ms cubic-bezier(0.25, 1, 0.5, 1)'
          currentTarget.style.transform = 'translateX(0px)'
          currentTarget.style.willChange = 'auto'
          updateSwipeBgVisual(currentTarget.previousElementSibling, 'none')
          return
        }

        const initialDx = String(swipedIdRef.current) === String(id) ? -72 : 0
        let totalDx = initialDx + dx

        const { dx: magneticDx, mode: magneticMode } = calculateMagneticSwipe(totalDx, {
          editDetent: -72,
          deleteThreshold: -125,
        })
        swipeDxRef.current = magneticDx

        if (rafIdRef.current !== null) return
        const currentTarget = event.currentTarget
        const bgEl = currentTarget.previousElementSibling

        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (swipeIdRef.current !== String(id)) return
          const currentDx = swipeDxRef.current
          currentTarget.style.transform = `translate3d(${currentDx}px, 0px, 0px)`
          updateSwipeBgVisual(bgEl, magneticMode, {
            editLabel: callbacks.editLabel || 'Edit',
            deleteLabel: callbacks.deleteLabel || 'Hapus',
          })
        })
      },
      onTouchEnd: (event) => {
        if (swipeIdRef.current !== String(id)) return
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        const finalDx = swipeDxRef.current
        swipeIdRef.current = null
        setIsSwipingId(null)

        const currentTarget = event.currentTarget
        currentTarget.style.willChange = 'auto'
        currentTarget.style.transition = 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)'
        currentTarget.style.transform = 'translate3d(0px, 0px, 0px)'

        const bgEl = currentTarget.previousElementSibling
        updateSwipeBgVisual(bgEl, 'none')

        if (finalDx <= -125) {
          // Stage 2: Delete breakout action on release
          setSwipedId(null)
          if (callbacks.onDelete) {
            callbacks.onDelete(id)
          }
          ignoreNextClickRef.current = true
          setTimeout(() => { ignoreNextClickRef.current = false }, 150)
        } else if (finalDx <= -30) {
          // Stage 1: Edit action on release
          setSwipedId(null)
          if (callbacks.onEdit) {
            callbacks.onEdit(id)
          }
          ignoreNextClickRef.current = true
          setTimeout(() => { ignoreNextClickRef.current = false }, 150)
        } else {
          // Reset to neutral (0px)
          setSwipedId(null)
        }
      },
      onTouchCancel: (event) => {
        swipeIdRef.current = null
        setIsSwipingId(null)
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        const currentTarget = event.currentTarget
        currentTarget.style.transition = 'transform 320ms cubic-bezier(0.25, 1, 0.5, 1)'
        currentTarget.style.transform = 'translate3d(0px, 0px, 0px)'
        updateSwipeBgVisual(currentTarget.previousElementSibling, 'none')
        setSwipedId(null)
      },
    }),
    [setSwipedId]
  )

  const resetSwipe = useCallback(() => {
    setSwipedId(null)
    setIsSwipingId(null)
    touchStartXRef.current = null
    touchStartYRef.current = null
    swipeIdRef.current = null
    swipeDxRef.current = 0
  }, [setSwipedId])

  return {
    swipedId,
    setSwipedId,
    isSwipingId,
    setIsSwipingId,
    getSwipeHandlers,
    resetSwipe,
    swipeIdRef,
    touchStartXRef,
    touchStartYRef,
    swipeStartXRef: touchStartXRef,
    swipeStartYRef: touchStartYRef,
    swipeDxRef,
    ignoreNextClickRef,
  }
}
