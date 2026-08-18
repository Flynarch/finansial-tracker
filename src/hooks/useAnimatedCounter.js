import { useState, useEffect, useRef } from 'react'

/**
 * useAnimatedCounter hook
 * Smoothly interpolates numeric values from previous to next value using requestAnimationFrame
 * with ease-out cubic bezier curve for 60-120 FPS buttery smooth transitions.
 * 
 * @param {number} targetValue - The numeric value to animate to
 * @param {object} options - Animation configuration options
 * @param {number} [options.duration=650] - Duration in milliseconds
 * @param {boolean} [options.enabled=true] - Whether animation is enabled
 * @returns {number} - Current animated value
 */
export function useAnimatedCounter(targetValue, { duration = 650, enabled = true } = {}) {
  const numericTarget = Number.isFinite(Number(targetValue)) ? Number(targetValue) : 0
  const [currentValue, setCurrentValue] = useState(numericTarget)
  const prevValueRef = useRef(numericTarget)
  const animFrameRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      prevValueRef.current = numericTarget
      const frameId = requestAnimationFrame(() => {
        setCurrentValue(numericTarget)
      })
      return () => cancelAnimationFrame(frameId)
    }

    const startValue = prevValueRef.current
    const endValue = numericTarget

    if (startValue === endValue) {
      return undefined
    }

    let startTime = null

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Cubic Ease-Out curve: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const nextVal = startValue + (endValue - startValue) * easeOut

      setCurrentValue(nextVal)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        setCurrentValue(endValue)
        prevValueRef.current = endValue
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [numericTarget, duration, enabled])

  return currentValue
}

export default useAnimatedCounter
