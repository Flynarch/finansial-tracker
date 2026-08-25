import { useEffect, useRef } from 'react'
import { backButtonManager } from '../lib/backButtonManager'

export default function useBackButton(handler, active = true) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!active) return undefined
    return backButtonManager.register(() => handlerRef.current?.())
  }, [active])
}
