import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook to manage swipe-to-reveal action states and touch gesture handlers.
 * 
 * @param {any} initialSwipedId - Initial swiped item ID (default null)
 * @param {Object} options - Configuration options
 * @param {number} [options.threshold=30] - Minimum touch delta X in px to trigger reveal/hide
 * @param {boolean} [options.closeOnScroll=true] - Whether to automatically reset swiped ID on window scroll
 * @returns {Object} { swipedId, setSwipedId, getSwipeHandlers, resetSwipe }
 */
export default function useSwipeAction(initialSwipedId = null, { threshold = 30, closeOnScroll = true } = {}) {
  const [swipedId, setSwipedId] = useState(initialSwipedId)
  const [isSwipingId, setIsSwipingId] = useState(null)
  const touchStartXRef = useRef(null)
  const touchStartYRef = useRef(null)

  // Drag-mode refs (for continuous pan / fluid drag like TodoList / Habits)
  const swipeIdRef = useRef(null)
  const swipeStartXRef = useRef(0)
  const swipeStartYRef = useRef(0)
  const swipeDxRef = useRef(0)
  const ignoreNextClickRef = useRef(false)

  useEffect(() => {
    if (!closeOnScroll || typeof window === 'undefined') return undefined
    const closeSwipeOnScroll = () => {
      setSwipedId(null)
      setIsSwipingId(null)
      if (swipeIdRef.current) swipeIdRef.current = null
    }
    window.addEventListener('scroll', closeSwipeOnScroll, { passive: true })
    return () => window.removeEventListener('scroll', closeSwipeOnScroll)
  }, [closeOnScroll])

  const getSwipeHandlers = useCallback(
    (id) => ({
      onTouchStart: (event) => {
        const touch = event.changedTouches[0]
        if (!touch) return
        touchStartXRef.current = touch.clientX
        touchStartYRef.current = touch.clientY
      },
      onTouchMove: (event) => {
        const touch = event.changedTouches[0]
        const startX = touchStartXRef.current
        const startY = touchStartYRef.current
        if (!touch || startX == null || startY == null) return

        const dx = touch.clientX - startX
        const dy = touch.clientY - startY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)

        if (absDy > absDx * 1.2 && absDy > 10) {
          touchStartXRef.current = null
          touchStartYRef.current = null
          setIsSwipingId((prev) => (prev !== null ? null : prev))
          setSwipedId((prev) => (prev === id ? prev : null))
          return
        }

        if (absDx > 10 && absDx > absDy) {
          setIsSwipingId(id)
        }
      },
      onTouchEnd: (event) => {
        const endX = event.changedTouches[0]?.clientX ?? null
        const startX = touchStartXRef.current
        if (startX != null && endX != null) {
          const deltaX = endX - startX
          if (deltaX < -threshold) {
            setSwipedId(id)
          } else if (deltaX > threshold) {
            setSwipedId(null)
          } else {
            setSwipedId((prev) => (prev === id ? prev : null))
          }
        }
        touchStartXRef.current = null
        touchStartYRef.current = null
        setIsSwipingId(null)
      },
      onTouchCancel: () => {
        touchStartXRef.current = null
        touchStartYRef.current = null
        setIsSwipingId(null)
      },
    }),
    [threshold]
  )

  const resetSwipe = useCallback(() => {
    setSwipedId(null)
    setIsSwipingId(null)
    touchStartXRef.current = null
    touchStartYRef.current = null
    swipeIdRef.current = null
    swipeDxRef.current = 0
  }, [])

  return {
    swipedId,
    setSwipedId,
    isSwipingId,
    setIsSwipingId,
    getSwipeHandlers,
    resetSwipe,
    swipeIdRef,
    swipeStartXRef,
    swipeStartYRef,
    swipeDxRef,
    ignoreNextClickRef,
  }
}
