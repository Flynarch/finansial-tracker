import { useCallback, useEffect, useRef, useState } from 'react'
import useSettingsStore from '../store/useSettingsStore'
import useBackButton from './useBackButton'

/**
 * Hook for managing bottom sheet / modal sheet lifecycle with smooth transitions,
 * timeout cleanup, body scroll locking, and hardware/gesture back button support.
 *
 * Can be used in two modes:
 * 1. Internal state mode: `const { isOpen, isVisible, openSheet, closeSheet, motionDelay } = useBottomSheet(false)`
 * 2. Controlled mode: `const { isVisible, closeSheet, motionDelay } = useBottomSheet({ isOpen: props.isOpen, onClose: props.onClose })`
 *
 * @param {boolean|object} configOrState - Initial boolean state or options object (`{ initialState, isOpen, onClose, lockBodyScroll, useBackButton }`).
 * @returns {object} { isOpen, isVisible, openSheet, closeSheet, motionDelay }
 */
export default function useBottomSheet(configOrState = false) {
  const config = typeof configOrState === 'boolean' ? { initialState: configOrState } : (configOrState || {})
  const {
    initialState = false,
    isOpen: controlledIsOpen,
    onClose,
    lockBodyScroll = true,
    useBackButton: enableBackButton = true,
  } = config

  const isControlled = controlledIsOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(initialState)
  const isOpen = isControlled ? Boolean(controlledIsOpen) : internalOpen

  const [isVisible, setIsVisible] = useState(initialState || Boolean(controlledIsOpen))
  const closeTimeoutRef = useRef(null)

  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 220

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [])

  // Sync controlled isOpen prop to transition frame
  useEffect(() => {
    if (isControlled) {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(Boolean(controlledIsOpen))
      })
      return () => window.cancelAnimationFrame(frame)
    }
    return undefined
  }, [isControlled, controlledIsOpen])

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!isOpen || !lockBodyScroll || typeof document === 'undefined') return undefined
    const { body, documentElement } = document
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverflow = documentElement.style.overflow

    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'

    return () => {
      body.style.overflow = prevBodyOverflow && prevBodyOverflow !== 'hidden' ? prevBodyOverflow : ''
      body.style.touchAction = ''
      body.style.overscrollBehavior = 'none'
      documentElement.style.overflow = prevHtmlOverflow && prevHtmlOverflow !== 'hidden' ? prevHtmlOverflow : ''
      documentElement.style.overscrollBehavior = 'none'
    }
  }, [isOpen, lockBodyScroll])

  const openSheet = useCallback(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    if (!isControlled) {
      setInternalOpen(true)
    }
    window.requestAnimationFrame(() => setIsVisible(true))
  }, [isControlled])

  const closeSheet = useCallback(() => {
    setIsVisible(false)
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = window.setTimeout(() => {
      if (!isControlled) {
        setInternalOpen(false)
      }
      closeTimeoutRef.current = null
      if (onClose) onClose()
    }, motionDelay)
  }, [isControlled, motionDelay, onClose])

  useBackButton(closeSheet, Boolean(isOpen && enableBackButton))

  return {
    isOpen,
    isVisible,
    openSheet,
    closeSheet,
    motionDelay,
  }
}
