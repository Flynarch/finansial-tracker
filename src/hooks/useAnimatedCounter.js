import { useState, useEffect, useRef } from 'react'
import useSettingsStore from '../store/useSettingsStore'

/**
 * Enhanced Quartic-Exponential hybrid easing function for financial tickers.
 * Provides a gentle ramp at start and an ultra-soft landing at the end.
 *
 * @param {number} t - Progress between 0 and 1
 * @returns {number}
 */
export function smoothFinancialEase(t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  // Blend between quartic ease-out and exponential ease-out for maximum fluid feel
  const expo = 1 - Math.pow(2, -10 * t)
  const quartic = 1 - Math.pow(1 - t, 4)
  return 0.7 * expo + 0.3 * quartic
}

/**
 * Calculate adaptive duration based on the numeric delta.
 * Small changes finish promptly (~400ms); large balance shifts glide gracefully (~750ms).
 *
 * @param {number} delta - Absolute difference between start and end
 * @param {number} [customDuration] - Optional explicit duration override
 * @returns {number} - Duration in milliseconds
 */
export function calculateAdaptiveDuration(delta, customDuration) {
  if (typeof customDuration === 'number' && customDuration > 0) {
    return customDuration
  }
  if (delta === 0) return 0
  // Logarithmic scaling: 400ms for small changes, up to ~750ms for large millions
  return Math.min(Math.max(400, Math.round(Math.log10(Math.max(1, delta)) * 105)), 750)
}

/**
 * useAnimatedCounter hook
 * Smoothly interpolates numeric values from previous to next value using requestAnimationFrame
 * with ultra-smooth easing curves for 60-120 FPS buttery smooth transitions.
 *
 * @param {number} targetValue - The numeric value to animate to
 * @param {object} [options] - Animation configuration options
 * @param {number} [options.duration] - Custom duration in milliseconds (if omitted, adaptive duration is used)
 * @param {boolean} [options.enabled=true] - Whether animation is enabled
 * @param {boolean} [options.skipInitial=false] - Whether to skip animation on initial component mount
 * @returns {number} - Current animated value
 */
export function useAnimatedCounter(targetValue, { duration, enabled = true, skipInitial = false } = {}) {
  const numericTarget = Number.isFinite(Number(targetValue)) ? Number(targetValue) : 0
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)

  const isFirstMountRef = useRef(true)
  const [currentValue, setCurrentValue] = useState(() => numericTarget)
  const prevValueRef = useRef(numericTarget)
  const currentValRef = useRef(numericTarget)
  const animFrameRef = useRef(null)

  useEffect(() => {
    // If reduceMotion is active or animation is disabled, sync via RAF
    if (!enabled || reduceMotion) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      prevValueRef.current = numericTarget
      currentValRef.current = numericTarget
      const frame = requestAnimationFrame(() => {
        setCurrentValue(numericTarget)
      })
      isFirstMountRef.current = false
      return () => cancelAnimationFrame(frame)
    }

    // Skip animation on initial mount if requested
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      if (skipInitial) {
        prevValueRef.current = numericTarget
        currentValRef.current = numericTarget
        return undefined
      }
    }

    const startValue = prevValueRef.current
    const endValue = numericTarget

    if (startValue === endValue) {
      return undefined
    }

    const delta = Math.abs(endValue - startValue)
    const animDuration = calculateAdaptiveDuration(delta, duration)

    if (animDuration === 0) {
      const frame = requestAnimationFrame(() => {
        setCurrentValue(endValue)
        prevValueRef.current = endValue
        currentValRef.current = endValue
      })
      return () => cancelAnimationFrame(frame)
    }

    let startTime = null

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / animDuration, 1)

      const easeProgress = smoothFinancialEase(progress)
      const nextVal = startValue + (endValue - startValue) * easeProgress

      currentValRef.current = nextVal
      setCurrentValue(nextVal)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        currentValRef.current = endValue
        setCurrentValue(endValue)
        prevValueRef.current = endValue
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      prevValueRef.current = currentValRef.current
    }
  }, [numericTarget, duration, enabled, reduceMotion, skipInitial])

  if (!enabled || reduceMotion) {
    return numericTarget
  }

  return currentValue
}

export default useAnimatedCounter
