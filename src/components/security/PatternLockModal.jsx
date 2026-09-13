import { useState, useRef, useCallback } from 'react'
import Modal from '../ui/Modal'
import { Grid3X3, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'
import useTranslation from '../../hooks/useTranslation'

const DOTS = [
  { id: 0, x: 45, y: 45 },
  { id: 1, x: 125, y: 45 },
  { id: 2, x: 205, y: 45 },
  { id: 3, x: 45, y: 125 },
  { id: 4, x: 125, y: 125 },
  { id: 5, x: 205, y: 125 },
  { id: 6, x: 45, y: 205 },
  { id: 7, x: 125, y: 205 },
  { id: 8, x: 205, y: 205 },
]

export default function PatternLockModal({ isOpen, onClose, onSave, currentSecret = '' }) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1) // 1: draw pattern, 2: confirm pattern
  const [firstPattern, setFirstPattern] = useState([])
  const [currentPath, setCurrentPath] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [cursorPos, setCursorPos] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const svgRef = useRef(null)

  const handleClose = useCallback(() => {
    setStep(1)
    setFirstPattern([])
    setCurrentPath([])
    setIsDrawing(false)
    setCursorPos(null)
    setErrorMsg('')
    setIsSuccess(false)
    onClose()
  }, [onClose])

  const getSvgPoint = (e) => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    // Map to 0-250 coordinate space
    const x = ((clientX - rect.left) / rect.width) * 250
    const y = ((clientY - rect.top) / rect.height) * 250
    return { x, y }
  }

  const findNearbyDot = (pt) => {
    if (!pt) return null
    const threshold = 32
    return DOTS.find((d) => Math.hypot(d.x - pt.x, d.y - pt.y) < threshold) || null
  }

  const handlePointerDown = (e) => {
    if (isSuccess) return
    setErrorMsg('')
    const pt = getSvgPoint(e)
    if (!pt) return
    setIsDrawing(true)
    const dot = findNearbyDot(pt)
    if (dot) {
      triggerHaptic('light')
      setCurrentPath([dot.id])
    } else {
      setCurrentPath([])
    }
    setCursorPos(pt)
  }

  const handlePointerMove = (e) => {
    if (!isDrawing || isSuccess) return
    const pt = getSvgPoint(e)
    if (!pt) return
    setCursorPos(pt)

    const dot = findNearbyDot(pt)
    if (dot && !currentPath.includes(dot.id)) {
      triggerHaptic('selection')
      setCurrentPath((prev) => [...prev, dot.id])
    }
  }

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || isSuccess) return
    setIsDrawing(false)
    setCursorPos(null)

    if (currentPath.length < 4) {
      if (currentPath.length > 0) {
        triggerHaptic('warning')
        setErrorMsg(t('settings.patternTooShort', 'Hubungkan minimal 4 titik.'))
      }
      setCurrentPath([])
      return
    }

    if (step === 1) {
      setFirstPattern(currentPath)
      setCurrentPath([])
      setStep(2)
    } else {
      const p1Str = firstPattern.join('-')
      const p2Str = currentPath.join('-')
      if (p1Str === p2Str) {
        triggerHaptic('success')
        setIsSuccess(true)
        setTimeout(() => {
          onSave(p1Str)
          handleClose()
        }, 400)
      } else {
        triggerHaptic('warning')
        setErrorMsg(t('settings.patternMismatch', 'Pola tidak cocok. Silakan ulangi.'))
        setCurrentPath([])
        setTimeout(() => {
          setStep(1)
          setFirstPattern([])
          setErrorMsg('')
        }, 1200)
      }
    }
  }, [isDrawing, isSuccess, currentPath, step, firstPattern, onSave, handleClose, t])

  const displayPath = currentPath

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={currentSecret ? t('settings.changePattern', 'Ubah Pola Aplikasi') : t('settings.setPattern', 'Atur Pola Aplikasi')}
      maxWidth="max-w-xs"
    >
      <div className="flex flex-col items-center text-center py-2 space-y-3 select-none">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-2xs">
          <Grid3X3 className="h-6 w-6" />
        </div>

        <div>
          <h3 className="text-sm font-black text-[var(--fg)]">
            {step === 1
              ? t('settings.drawNewPattern', 'Gambar Pola Baru')
              : t('settings.confirmPattern', 'Konfirmasi Pola')}
          </h3>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            {step === 1
              ? t('settings.patternMinDots', 'Hubungkan minimal 4 titik')
              : t('settings.patternStep2Desc', 'Gambar kembali pola yang sama')}
          </p>
        </div>

        {errorMsg ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500 animate-fadeIn">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : isSuccess ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{t('common.saved', 'Pola Berhasil Disimpan!')}</span>
          </div>
        ) : (
          <div className="h-4" />
        )}

        {/* Pattern Canvas Container */}
        <div className="relative touch-none rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/60 p-2 shadow-inner">
          <svg
            ref={svgRef}
            viewBox="0 0 250 250"
            className="h-60 w-60 touch-none cursor-crosshair"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            {/* Connecting lines */}
            {displayPath.map((dotId, index) => {
              if (index === displayPath.length - 1) return null
              const nextId = displayPath[index + 1]
              const p1 = DOTS[dotId]
              const p2 = DOTS[nextId]
              return (
                <line
                  key={`line-${index}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#6366f1"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              )
            })}

            {/* Active tracking line to pointer */}
            {isDrawing && cursorPos && displayPath.length > 0 && (
              <line
                x1={DOTS[displayPath[displayPath.length - 1]].x}
                y1={DOTS[displayPath[displayPath.length - 1]].y}
                x2={cursorPos.x}
                y2={cursorPos.y}
                stroke="#6366f1"
                strokeWidth="3"
                strokeDasharray="4,4"
                strokeLinecap="round"
                opacity="0.8"
              />
            )}

            {/* 3x3 Nodes */}
            {DOTS.map((dot) => {
              const isSelected = displayPath.includes(dot.id)
              return (
                <g key={dot.id}>
                  {/* Outer glow ring when selected */}
                  {isSelected && (
                    <circle
                      cx={dot.x}
                      cy={dot.y}
                      r="18"
                      fill="#6366f1"
                      fillOpacity="0.2"
                      className="animate-pulse"
                    />
                  )}
                  {/* Outer circle */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="10"
                    fill="var(--field-bg)"
                    stroke={isSelected ? '#6366f1' : 'var(--border-strong)'}
                    strokeWidth={isSelected ? '3' : '2'}
                  />
                  {/* Center dot */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="4"
                    fill={isSelected ? '#6366f1' : 'var(--muted)'}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Action Button: Reset Pattern */}
        <button
          type="button"
          onClick={() => {
            setCurrentPath([])
            if (step === 2) {
              setStep(1)
              setFirstPattern([])
            }
            setErrorMsg('')
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer py-1.5 px-3 rounded-xl hover:bg-[var(--field-bg)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('common.reset', 'Ulangi Pola')}</span>
        </button>
      </div>
    </Modal>
  )
}
