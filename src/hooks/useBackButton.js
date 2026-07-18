import { useEffect } from 'react'
import { backButtonManager } from '../lib/backButtonManager'

export default function useBackButton(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined
    return backButtonManager.register(handler)
  }, [handler, active])
}
