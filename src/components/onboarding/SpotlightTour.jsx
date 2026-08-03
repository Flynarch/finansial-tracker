import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import useSettingsStore from '../../store/useSettingsStore'

const TOUR_STEPS = [
  {
    id: 'networth-card',
    target: '[data-tour="networth-card"]',
    title: 'Total Saldo & Kekayaan',
    desc: 'Lihat akumulasi saldo seluruh dompet dan riwayat perkembangan kekayaan bersihmu secara real-time di sini.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: 'quick-add-btn',
    target: '[data-tour="quick-add-btn"]',
    title: 'Catat Transaksi Cepat',
    desc: 'Gunakan tombol + melayang ini kapan saja untuk mencatat pemasukan atau pengeluaran hanya dalam beberapa detik.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    id: 'budget-chart-section',
    target: '[data-tour="budget-chart-section"]',
    title: 'Anggaran & Analisis Finansial',
    desc: 'Pantau pengeluaran bulanan, batas anggaran tiap kategori, serta grafik tren transaksi untuk menjaga kestabilan finansial.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    ),
  },
  {
    id: 'bottom-nav',
    target: '[data-tour="bottom-nav"]',
    title: 'Menu Navigasi Utama',
    desc: 'Berpindah antar fitur dengan mudah: Transaksi, Anggaran, Habit Tracker, Catatan Finansial, hingga Pengaturan.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
  },
]

function getVisibleElement(selector) {
  if (typeof document === 'undefined' || !selector) return null
  const elements = Array.from(document.querySelectorAll(selector))
  return elements.find(el => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }) || elements[0] || null
}

export default function SpotlightTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const isSpotlightTourActive = useSettingsStore((s) => s.isSpotlightTourActive)
  const completeSpotlightTour = useSettingsStore((s) => s.completeSpotlightTour)

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom' })

  const currentStep = TOUR_STEPS[currentStepIndex]

  // Update bounding box coordinates for active step
  const updateBoundingBox = useCallback(() => {
    if (!isSpotlightTourActive || !currentStep) return

    const el = getVisibleElement(currentStep.target)
    if (!el) {
      setTargetRect(null)
      return
    }

    const rect = el.getBoundingClientRect()
    let top = rect.top
    let left = rect.left
    let width = rect.width
    let height = rect.height

    // For bottom-nav step on mobile, combine bottom nav card and central FAB button bounds if present
    if (currentStep.id === 'bottom-nav') {
      const navCard = el.querySelector('.max-w-\\[393px\\]') || el
      const cardRect = navCard.getBoundingClientRect()
      const fabEl = getVisibleElement('[data-tour="quick-add-btn"]')
      const fabRect = fabEl ? fabEl.getBoundingClientRect() : cardRect

      const combinedTop = Math.min(cardRect.top, fabRect.top)
      const combinedBottom = Math.max(cardRect.bottom, fabRect.bottom)
      const combinedLeft = Math.min(cardRect.left, fabRect.left)
      const combinedRight = Math.max(cardRect.right, fabRect.right)

      top = combinedTop
      left = combinedLeft
      width = combinedRight - combinedLeft
      height = combinedBottom - combinedTop
    }

    const padding = 8
    const roundedRect = {
      top: Math.max(0, top - padding),
      left: Math.max(0, left - padding),
      width: width + padding * 2,
      height: height + padding * 2,
      right: left + width + padding,
      bottom: top + height + padding,
    }

    setTargetRect(roundedRect)

    // Calculate Popover Position
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardWidth = Math.min(360, vw - 32)
    const cardHeight = 210

    let popoverLeft = roundedRect.left + roundedRect.width / 2 - cardWidth / 2
    popoverLeft = Math.max(16, Math.min(popoverLeft, vw - cardWidth - 16))

    let popoverTop
    let placement

    if (currentStep.id === 'bottom-nav') {
      popoverTop = Math.max(16, roundedRect.top - cardHeight - 16)
      placement = 'top'
    } else if (roundedRect.bottom + cardHeight + 16 < vh) {
      popoverTop = roundedRect.bottom + 12
      placement = 'bottom'
    } else if (roundedRect.top - cardHeight - 16 > 0) {
      popoverTop = roundedRect.top - cardHeight - 12
      placement = 'top'
    } else {
      popoverTop = Math.max(16, vh / 2 - cardHeight / 2)
      placement = 'center'
    }

    setPopoverPos({ top: popoverTop, left: popoverLeft, width: cardWidth, placement })
  }, [isSpotlightTourActive, currentStep])

  // Scroll to element & update positioning on step change, resize, scroll
  useEffect(() => {
    if (!isSpotlightTourActive) return

    // Ensure user is on /dashboard
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard')
    }

    const timer = setTimeout(() => {
      const el = getVisibleElement(currentStep?.target)
      if (el) {
        // Auto-scroll target element smoothly to center of viewport
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
      updateBoundingBox()
    }, 120)

    window.addEventListener('resize', updateBoundingBox)
    window.addEventListener('scroll', updateBoundingBox, true)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateBoundingBox)
      window.removeEventListener('scroll', updateBoundingBox, true)
    }
  }, [isSpotlightTourActive, currentStepIndex, location.pathname, navigate, currentStep, updateBoundingBox])

  if (!isSpotlightTourActive) return null

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      completeSpotlightTour()
      setCurrentStepIndex(0)
    }
  }

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }

  const handleSkip = () => {
    completeSpotlightTour()
    setCurrentStepIndex(0)
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-hidden select-none">
      {/* SVG Backdrop with Hole Cutout */}
      <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={handleNext}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.75)"
          mask="url(#spotlight-mask)"
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Target Highlight Border Ring */}
      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)] transition-all duration-300 ease-out"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      {/* Floating Tooltip Card */}
      <div
        className="absolute z-10 flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-2xl transition-all duration-300 ease-out pointer-events-auto"
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
          width: popoverPos.width || 340,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
              {currentStep?.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                Langkah {currentStepIndex + 1} dari {TOUR_STEPS.length}
              </p>
              <h3 className="text-base font-bold text-[var(--fg)] leading-tight">
                {currentStep?.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)] transition"
            title="Selesaikan Tur"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)] font-medium">
          {currentStep?.desc}
        </p>

        {/* Footer controls */}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-3.5">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className="rounded-full transition-all duration-300"
                style={{
                  width: idx === currentStepIndex ? 16 : 6,
                  height: 6,
                  backgroundColor: idx === currentStepIndex ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95"
              >
                Kembali
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--bg)] shadow-md transition active:scale-95 hover:opacity-90"
            >
              {currentStepIndex < TOUR_STEPS.length - 1 ? 'Berikutnya' : 'Selesai'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
