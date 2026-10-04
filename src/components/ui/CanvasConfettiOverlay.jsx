import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { triggerHaptic } from '../../lib/haptics'
import useSettingsStore from '../../store/useSettingsStore'

const CONFETTI_COLORS = [
  '#4F6F52', // earthy-green
  '#8B5E3C', // earthy-terra
  '#2E7D32', // status-income emerald
  '#E0A96D', // warm amber
  '#F59E0B', // gold
  '#10B981', // vibrant green
  '#6366F1', // indigo accent
]

export default function CanvasConfettiOverlay({
  duration = 2500,
  particleCount = 65,
  variant = 'burst', // 'burst' | 'cannons'
  onComplete,
}) {
  const canvasRef = useRef(null)
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)

  useEffect(() => {
    triggerHaptic('success')
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(() => onComplete?.(), 500)
      return () => clearTimeout(timer)
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    let width = window.innerWidth
    let height = window.innerHeight

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    if (typeof ctx.scale === 'function') {
      ctx.scale(dpr, dpr)
    }

    const handleResize = () => {
      if (!canvas) return
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
      }
      if (typeof ctx.scale === 'function') {
        ctx.scale(dpr, dpr)
      }
    }
    window.addEventListener('resize', handleResize)

    const isCannons = variant === 'cannons'
    const totalCount = isCannons ? Math.max(particleCount, 85) : particleCount
    const particles = []

    for (let i = 0; i < totalCount; i++) {
      if (isCannons) {
        const isLeft = i % 2 === 0
        const startX = isLeft ? width * 0.08 : width * 0.92
        const startY = height * 0.92
        const angle = isLeft
          ? -Math.PI / 4 - (Math.random() * 0.35 - 0.1)
          : -3 * Math.PI / 4 + (Math.random() * 0.35 - 0.1)
        const speed = Math.random() * 14 + 10
        particles.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 7 + 4,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 14,
          opacity: 1,
          drag: 0.968,
          gravity: 0.38,
          shape: Math.random() > 0.4 ? 'rect' : 'circle',
        })
      } else {
        particles.push({
          x: width * 0.5 + (Math.random() - 0.5) * 60,
          y: height * 0.45 + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 14,
          vy: -Math.random() * 12 - 4,
          size: Math.random() * 7 + 4,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          opacity: 1,
          drag: 0.965,
          gravity: 0.35,
          shape: Math.random() > 0.4 ? 'rect' : 'circle',
        })
      }
    }

    let animationFrameId
    const startTime = performance.now()

    const render = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.vx *= p.drag
        p.vy = p.vy * p.drag + p.gravity
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.opacity = Math.max(0, 1 - progress * 1.1)

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render)
      } else {
        ctx.clearRect(0, 0, width, height)
        onComplete?.()
      }
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [duration, particleCount, variant, reduceMotion, onComplete])

  if (typeof document === 'undefined') return null

  return createPortal(
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
      aria-hidden="true"
    />,
    document.body
  )
}
