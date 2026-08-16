import { useCallback, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Wallet,
  TrendingUp,
  PieChart,
  Sparkles,
  PlusCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'

function getVisibleElement(selector) {
  if (typeof document === 'undefined' || !selector) return null
  const elements = Array.from(document.querySelectorAll(selector))
  return (
    elements.find((el) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }) ||
    elements[0] ||
    null
  )
}

export default function SpotlightTour() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isSpotlightTourActive = useSettingsStore((s) => s.isSpotlightTourActive)
  const completeSpotlightTour = useSettingsStore((s) => s.completeSpotlightTour)

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 340, placement: 'bottom' })

  const tourSteps = useMemo(
    () => [
      {
        id: 'hero-carousel',
        target: '[data-tour="hero-carousel"]',
        title: t('tour.step.hero.title', 'Kartu Saldo & Keuangan'),
        desc: t(
          'tour.step.hero.desc',
          'Pantau total saldo seluruh dompet, estimasi sisa uang bulanan, serta ringkasan pemasukan dan pengeluaran secara real-time.',
        ),
        Icon: Wallet,
        color: 'text-indigo-500 bg-indigo-500/12 border-indigo-500/20',
      },
      {
        id: 'networth-chart',
        target: '[data-tour="networth-chart"]',
        title: t('tour.step.networth.title', 'Grafik Kekayaan Bersih'),
        desc: t(
          'tour.step.networth.desc',
          'Lacak perkembangan akumulasi aset dan tren pertumbuhan kekayaan finansialmu dengan visualisasi interaktif.',
        ),
        Icon: TrendingUp,
        color: 'text-emerald-500 bg-emerald-500/12 border-emerald-500/20',
      },
      {
        id: 'pulse-bento',
        target: '[data-tour="pulse-bento"]',
        title: t('tour.step.bento.title', 'Anggaran & Target Tabungan'),
        desc: t(
          'tour.step.bento.desc',
          'Kendalikan batas pengeluaran kategori bulanan agar tidak overbudget dan wujudkan impian lewat target tabungan.',
        ),
        Icon: PieChart,
        color: 'text-purple-500 bg-purple-500/12 border-purple-500/20',
      },
      {
        id: 'ai-chat-btn',
        target: '[data-tour="ai-chat-btn"]',
        title: t('tour.step.ai.title', 'Pencatatan Cepat Pakai AI'),
        desc: t(
          'tour.step.ai.desc',
          'Cukup ketik santai transaksi (misal: "Makan siang 35rb"), dan asisten pintar FinTrack akan otomatis mencatatnya.',
        ),
        Icon: Sparkles,
        color: 'text-amber-500 bg-amber-500/12 border-amber-500/20',
      },
      {
        id: 'bottom-nav',
        target: '[data-tour="bottom-nav"]',
        title: t('tour.step.nav.title', 'Navigasi & Tombol Catat'),
        desc: t(
          'tour.step.nav.desc',
          'Gunakan tombol (+) melayang untuk mencatat manual kapan saja, serta jelajahi menu Transaksi, Aktivitas, dan Profil.',
        ),
        Icon: PlusCircle,
        color: 'text-sky-500 bg-sky-500/12 border-sky-500/20',
      },
    ],
    [t],
  )

  const currentStep = tourSteps[currentStepIndex] || tourSteps[0]

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

    // For bottom-nav step on mobile, include the central FAB button bounds if present
    if (currentStep.id === 'bottom-nav') {
      const fabEl = getVisibleElement('[data-tour="quick-add-btn"]')
      if (fabEl) {
        const fabRect = fabEl.getBoundingClientRect()
        const combinedTop = Math.min(rect.top, fabRect.top)
        const combinedBottom = Math.max(rect.bottom, fabRect.bottom)
        const combinedLeft = Math.min(rect.left, fabRect.left)
        const combinedRight = Math.max(rect.right, fabRect.right)

        top = combinedTop
        left = combinedLeft
        width = combinedRight - combinedLeft
        height = combinedBottom - combinedTop
      }
    }

    const padding = 6
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
    const estimatedCardHeight = 220

    let popoverLeft = roundedRect.left + roundedRect.width / 2 - cardWidth / 2
    popoverLeft = Math.max(16, Math.min(popoverLeft, vw - cardWidth - 16))

    let popoverTop
    let placement

    if (currentStep.id === 'bottom-nav') {
      popoverTop = Math.max(16, roundedRect.top - estimatedCardHeight - 14)
      placement = 'top'
    } else if (roundedRect.bottom + estimatedCardHeight + 20 < vh) {
      popoverTop = roundedRect.bottom + 12
      placement = 'bottom'
    } else if (roundedRect.top - estimatedCardHeight - 16 > 0) {
      popoverTop = roundedRect.top - estimatedCardHeight - 12
      placement = 'top'
    } else {
      popoverTop = Math.max(16, vh / 2 - estimatedCardHeight / 2)
      placement = 'center'
    }

    setPopoverPos({ top: popoverTop, left: popoverLeft, width: cardWidth, placement })
  }, [isSpotlightTourActive, currentStep])

  // Scroll to element & update positioning on step change, resize, scroll
  useEffect(() => {
    if (!isSpotlightTourActive) return

    // Ensure user is on /dashboard during the feature tour
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard')
    }

    const timer = setTimeout(() => {
      const el = getVisibleElement(currentStep?.target)
      if (el) {
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

  const handleNext = useCallback(() => {
    if (currentStepIndex < tourSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      completeSpotlightTour()
      setCurrentStepIndex(0)
    }
  }, [currentStepIndex, tourSteps.length, completeSpotlightTour])

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }, [currentStepIndex])

  const handleSkip = useCallback(() => {
    completeSpotlightTour()
    setCurrentStepIndex(0)
  }, [completeSpotlightTour])

  // Keyboard navigation support
  useEffect(() => {
    if (!isSpotlightTourActive) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSpotlightTourActive, handleNext, handlePrev, handleSkip])

  if (!isSpotlightTourActive) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
  const StepIcon = currentStep?.Icon || Sparkles

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
                rx="18"
                ry="18"
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
          fill="rgba(15, 23, 42, 0.72)"
          mask="url(#spotlight-mask)"
          className="transition-all duration-300 ease-out backdrop-blur-2xs"
        />
      </svg>

      {/* Target Highlight Border Ring */}
      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-[var(--accent)] ring-4 ring-[var(--accent)]/20 shadow-2xl transition-all duration-300 ease-out"
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
        className="absolute z-10 flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-2xl transition-all duration-300 ease-out pointer-events-auto backdrop-blur-md"
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
          width: popoverPos.width || 340,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${currentStep.color}`}>
              <StepIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9.5px] font-extrabold tracking-wider text-[var(--accent)] uppercase border border-[var(--accent)]/20">
                {t('tour.stepBadge', { current: currentStepIndex + 1, total: tourSteps.length })}
              </span>
              <h3 className="truncate text-sm sm:text-base font-black text-[var(--fg)] tracking-tight mt-0.5">
                {currentStep?.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)] transition cursor-pointer"
            title={t('tour.skip', 'Lewati Tur')}
            aria-label={t('tour.skip', 'Lewati Tur')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <p className="mt-2.5 text-xs leading-relaxed text-[var(--muted)] font-medium">
          {currentStep?.desc}
        </p>

        {/* Footer controls */}
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border)]/60 pt-3">
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {tourSteps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                aria-label={`Langkah ${idx + 1}`}
                className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  width: idx === currentStepIndex ? 18 : 6,
                  backgroundColor:
                    idx === currentStepIndex ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t('tour.prev', 'Kembali')}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-extrabold text-[var(--bg)] shadow-md transition active:scale-95 hover:opacity-90 cursor-pointer"
            >
              <span>
                {currentStepIndex < tourSteps.length - 1
                  ? t('tour.next', 'Lanjut')
                  : t('tour.finish', 'Selesai')}
              </span>
              {currentStepIndex < tourSteps.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
