import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

/**
 * Trigger tactile impact feedback (light, medium, heavy)
 */
export async function hapticImpact(style = 'light') {
  if (!isNative) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        const ms = style === 'heavy' ? 40 : style === 'medium' ? 25 : 15
        navigator.vibrate(ms)
      } catch (err){
      console.warn('[haptics]', err)
        // ignore
      }
    }
    return
  }

  try {
    let impactStyle = ImpactStyle.Light
    if (style === 'medium') impactStyle = ImpactStyle.Medium
    if (style === 'heavy') impactStyle = ImpactStyle.Heavy

    await Haptics.impact({ style: impactStyle })
  } catch (err){
      console.warn('[haptics]', err)
    // ignore
  }
}

export const triggerHaptic = hapticImpact

/**
 * Trigger success notification haptic
 */
export async function hapticSuccess() {
  if (!isNative) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([15, 30, 20])
      } catch (err){
      console.warn('[haptics]', err)
        // ignore
      }
    }
    return
  }

  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch (err){
      console.warn('[haptics]', err)
    // ignore
  }
}

/**
 * Trigger warning notification haptic
 */
export async function hapticWarning() {
  if (!isNative) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([30, 50, 30])
      } catch (err){
      console.warn('[haptics]', err)
        // ignore
      }
    }
    return
  }

  try {
    await Haptics.notification({ type: NotificationType.Warning })
  } catch (err){
      console.warn('[haptics]', err)
    // ignore
  }
}

/**
 * Trigger error notification haptic
 */
export async function hapticError() {
  if (!isNative) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 60, 40, 60, 40])
      } catch (err){
      console.warn('[haptics]', err)
        // ignore
      }
    }
    return
  }

  try {
    await Haptics.notification({ type: NotificationType.Error })
  } catch (err){
      console.warn('[haptics]', err)
    // ignore
  }
}

/**
 * Trigger selection change haptic (for pickers, sliders, segmented toggles)
 */
export async function hapticSelection() {
  if (!isNative) return
  try {
    await Haptics.selectionChanged()
  } catch (err){
      console.warn('[haptics]', err)
    // ignore
  }
}

