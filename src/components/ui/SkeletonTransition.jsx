import { useEffect, useRef, useState } from 'react'

/**
 * Smooth Cross-Dissolve Skeleton-to-Content Transition Component.
 *
 * Guarantees zero layout jumps, zero unhandled TypeErrors from unready data,
 * and zero blank flicker between skeleton placeholders and live page content.
 *
 * @param {object} props
 * @param {boolean} props.isLoading - Whether the page/card is still loading data
 * @param {React.ReactNode} props.skeleton - The skeleton placeholder component to render while loading
 * @param {React.ReactNode} props.children - The actual content to render once loaded
 * @param {string} [props.className] - Optional container class name
 */
export default function SkeletonTransition({
  isLoading,
  skeleton,
  children,
  className = '',
}) {
  const [prevLoading, setPrevLoading] = useState(isLoading)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [exitingSkeleton, setExitingSkeleton] = useState(null)
  const timeoutRef = useRef(null)

  // Synchronous state adjustment during render (React 19 pattern)
  // Eliminates the 1-frame gap where the skeleton is unmounted before useEffect runs
  if (isLoading !== prevLoading) {
    setPrevLoading(isLoading)
    if (prevLoading && !isLoading) {
      setIsTransitioning(true)
      setExitingSkeleton(skeleton)
    } else if (!prevLoading && isLoading) {
      setIsTransitioning(false)
      setExitingSkeleton(null)
    }
  }

  useEffect(() => {
    if (isTransitioning) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setIsTransitioning(false)
        setExitingSkeleton(null)
        timeoutRef.current = null
      }, 180)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isTransitioning])

  // While actively loading, strictly render skeleton ONLY.
  // Children is NEVER evaluated/mounted to protect against TypeError on undefined data.
  if (isLoading) {
    return (
      <div className={`relative w-full ${className}`}>
        {skeleton}
      </div>
    )
  }

  const showTransition = isTransitioning && Boolean(exitingSkeleton)

  // Consistent DOM layout structure for both transitioning and settled states:
  // prevents unmounting intermediate wrappers, maintaining scroll position and flexbox integrity.
  return (
    <div className={`relative w-full ${className}`}>
      <div
        className={`w-full min-h-full flex-1 flex flex-col min-h-0 ${
          showTransition ? 'ft-content-loaded' : ''
        }`}
      >
        {children}
      </div>
      {showTransition ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 pointer-events-none ft-skeleton-leaving overflow-hidden"
        >
          {exitingSkeleton}
        </div>
      ) : null}
    </div>
  )
}
