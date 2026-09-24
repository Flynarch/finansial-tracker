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

  const [isExiting, setIsExiting] = useState(false)
  const [isClosingControlled, setIsClosingControlled] = useState(false)
  const closeTimeoutRef = useRef(null)

  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const motionDelay = reduceMotion ? 0 : 200

  const [prevControlledIsOpen, setPrevControlledIsOpen] = useState(controlledIsOpen)
  if (isControlled && controlledIsOpen !== prevControlledIsOpen) {
    setPrevControlledIsOpen(controlledIsOpen)
    setIsExiting(false)
    setIsClosingControlled(false)
  }

  // Clear timeout only when controlled state transitions from closed to open
  const wasOpenRef = useRef(Boolean(controlledIsOpen))
  useEffect(() => {
    if (controlledIsOpen && !wasOpenRef.current && closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    wasOpenRef.current = Boolean(controlledIsOpen)
  }, [controlledIsOpen])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [])

  const isMounted = isControlled
    ? (Boolean(controlledIsOpen) || isExiting) && !isClosingControlled
    : (internalOpen || isExiting)

  const isVisible = isControlled
    ? Boolean(controlledIsOpen) && !isExiting && !isClosingControlled
    : internalOpen && !isExiting

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!isMounted || !lockBodyScroll || typeof document === 'undefined') return undefined
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
  }, [isMounted, lockBodyScroll])

  const openSheet = useCallback(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsExiting(false)
    setIsClosingControlled(false)
    if (!isControlled) {
      setInternalOpen(true)
    }
  }, [isControlled])

  const closeSheet = useCallback(() => {
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current)
    setIsExiting(true)
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsExiting(false)
      if (isControlled) {
        setIsClosingControlled(true)
      } else {
        setInternalOpen(false)
      }
      closeTimeoutRef.current = null
      if (onClose) onClose()
    }, motionDelay)
  }, [isControlled, motionDelay, onClose])

  useBackButton(closeSheet, Boolean(isMounted && isVisible && enableBackButton))

  return {
    isMounted,
    isOpen: isMounted,
    isVisible,
    openSheet,
    closeSheet,
    motionDelay,
  }
}

