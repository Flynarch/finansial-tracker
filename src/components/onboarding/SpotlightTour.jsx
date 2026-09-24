import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Wallet,
  TrendingUp,
  PieChart,
  Sparkles,
  Compass,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  CornerDownLeft,
} from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'

function getVisibleElement(selector) {
  if (typeof document === 'undefined' || !selector) return null
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (selector === '[data-tour="ai-chat-btn"]') {
    if (isMobile) {
      const mobilePill = document.querySelector('.ft-ai-bar, button[data-tour="ai-chat-btn"].ft-ai-bar')
      if (mobilePill) return mobilePill
    } else {
      const desktopBtn = document.querySelector('nav [data-tour="ai-chat-btn"], header [data-tour="ai-chat-btn"]')
      if (desktopBtn) return desktopBtn
    }
  }

  const elements = Array.from(document.querySelectorAll(selector))
  if (elements.length === 0) return null

  return (
    elements.find((el) => {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      )
    }) ||
    elements[0] ||
    null
  )
}

function smoothScrollTo(targetY, duration = 900) {
  if (typeof window === 'undefined') return
  const startY = window.scrollY || window.pageYOffset
  const diff = targetY - startY
  if (Math.abs(diff) < 2) return

  const startTime = performance.now()
  const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5)

  const step = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(1, elapsed / duration)
    const eased = easeOutQuint(progress)
    window.scrollTo(0, startY + diff * eased)
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

/** Generate Driver.js-style evenodd SVG path with rounded rectangle cutout */
function buildCutoutSvgPath(rect, vw, vh) {
  if (!rect) return `M0,0 H${vw} V${vh} H0 Z`
  const { left: x, top: y, width: w, height: h, radius: rawR } = rect
  const r = Math.max(0, Math.min(rawR || 20, w / 2, h / 2))

  return `M0,0 H${vw} V${vh} H0 Z M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0 1 ${r},-${r} Z`
}

export default function SpotlightTour() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isSpotlightTourActive = useSettingsStore((s) => s.isSpotlightTourActive)
  const completeSpotlightTour = useSettingsStore((s) => s.completeSpotlightTour)

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [popoverPos, setPopoverPos] = useState({
    top: 0,
    left: 0,
    width: 360,
    placement: 'bottom',
    arrowLeft: 180,
    arrowTop: 80,
  })

  const rafTrackingId = useRef(null)
  const targetElementRef = useRef(null)

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
        radius: 24,
        padding: 6,
        preferredPlacement: 'bottom',
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
        radius: 24,
        padding: 6,
        preferredPlacement: 'bottom',
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
        radius: 24,
        padding: 6,
        preferredPlacement: 'bottom',
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
        radius: 9999,
        padding: 4,
        preferredPlacement: 'top',
      },
      {
        id: 'bottom-nav',
        target: '[data-tour="bottom-nav"]',
        title: t('tour.step.nav.title', 'Navigasi & Menu Lengkap'),
        desc: t(
          'tour.step.nav.desc',
          'Jelajahi seluruh menu utama seperti Transaksi, Anggaran, Aktivitas, Kalender, dan Pengaturan dengan mudah.',
        ),
        Icon: Compass,
        color: 'text-sky-500 bg-sky-500/12 border-sky-500/20',
        radius: 20,
        padding: 6,
        preferredPlacement: 'top',
      },
    ],
    [t],
  )

  const currentStep = tourSteps[currentStepIndex] || tourSteps[0]

  // Calculate & update target bounding box and popover position with guaranteed zero-overlap
  const computePositions = useCallback(() => {
    if (!isSpotlightTourActive || !currentStep) return

    const el = getVisibleElement(currentStep.target)
    targetElementRef.current = el

    if (!el) {
      setTargetRect(null)
      return
    }

    const rect = el.getBoundingClientRect()
    let top = rect.top
    let left = rect.left
    let width = rect.width
    let height = rect.height

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

    // For bottom-nav step on mobile, include the central FAB button bounds if present
    if (currentStep.id === 'bottom-nav' && !isDesktop) {
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

    const pad = currentStep.padding ?? 6
    const roundedRadius = currentStep.radius ?? 20

    const roundedRect = {
      top: Math.max(0, top - pad),
      left: Math.max(0, left - pad),
      width: width + pad * 2,
      height: height + pad * 2,
      right: left + width + pad,
      bottom: top + height + pad,
      radius: roundedRadius,
    }

    setTargetRect(roundedRect)

    // Viewport dimensions
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
    const cardWidth = Math.min(360, vw - 24)
    const estimatedCardHeight = 185

    let popoverLeft = roundedRect.left + roundedRect.width / 2 - cardWidth / 2
    popoverLeft = Math.max(12, Math.min(popoverLeft, vw - cardWidth - 12))

    let popoverTop
    let placement
    let arrowTop = 60

    // Desktop sidebar step positioning (placed to the right of the sidebar)
    if (currentStep.id === 'bottom-nav' && isDesktop && roundedRect.left <= 40 && roundedRect.width < 320) {
      placement = 'right'
      popoverLeft = Math.min(vw - cardWidth - 20, roundedRect.right + 18)
      popoverTop = Math.max(70, Math.min(vh - estimatedCardHeight - 30, vh / 2 - estimatedCardHeight / 2))
      arrowTop = Math.max(24, Math.min(estimatedCardHeight / 2, estimatedCardHeight - 24))
    } else {
      const spaceBelow = vh - roundedRect.bottom - 16
      const spaceAbove = roundedRect.top - 16

      if (currentStep.preferredPlacement === 'top' || (spaceAbove >= estimatedCardHeight && spaceBelow < estimatedCardHeight)) {
        placement = 'top'
        popoverTop = Math.max(12, roundedRect.top - estimatedCardHeight - 14)
      } else {
        placement = 'bottom'
        popoverTop = Math.min(vh - estimatedCardHeight - 12, roundedRect.bottom + 14)
      }
    }

    const targetCenterX = roundedRect.left + roundedRect.width / 2
    const arrowLeft = Math.max(24, Math.min(targetCenterX - popoverLeft, cardWidth - 24))

    setPopoverPos({
      top: popoverTop,
      left: popoverLeft,
      width: cardWidth,
      placement,
      arrowLeft,
      arrowTop,
    })
  }, [isSpotlightTourActive, currentStep])

  // Continuous tracking loop (RAF) for 320ms during step transitions and smooth scroll
  const startTrackingLoop = useCallback(
    (durationMs = 320) => {
      if (rafTrackingId.current) {
        cancelAnimationFrame(rafTrackingId.current)
      }
      const startTime = performance.now()

      const tick = (now) => {
        computePositions()
        if (now - startTime < durationMs) {
          rafTrackingId.current = requestAnimationFrame(tick)
        } else {
          computePositions()
          rafTrackingId.current = null
        }
      }

      rafTrackingId.current = requestAnimationFrame(tick)
    },
    [computePositions],
  )

  // Step changes: Eased smooth scroll to optimal position
  useEffect(() => {
    if (!isSpotlightTourActive) return

    // Ensure user is on /dashboard during the tour
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard')
    }

    const el = getVisibleElement(currentStep?.target)
    if (el) {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
      const elRect = el.getBoundingClientRect()
      const elDocTop = elRect.top + (window.scrollY || window.pageYOffset)

      let targetScrollY = 0

      if (currentStep.id === 'hero-carousel') {
        targetScrollY = 0
      } else if (currentStep.id === 'networth-chart' || currentStep.id === 'pulse-bento') {
        targetScrollY = Math.max(0, elDocTop - 68)
      } else if (currentStep.id === 'ai-chat-btn' || currentStep.id === 'bottom-nav') {
        if (!isDesktop) {
          targetScrollY = Math.min(
            Math.max(0, elDocTop - 280),
            document.documentElement.scrollHeight - window.innerHeight,
          )
        }
      }

      smoothScrollTo(targetScrollY, 900)
    }

    startTrackingLoop(950)

    return () => {
      if (rafTrackingId.current) {
        cancelAnimationFrame(rafTrackingId.current)
      }
    }
  }, [isSpotlightTourActive, currentStepIndex, location.pathname, navigate, currentStep, startTrackingLoop])

  // Resize and passive scroll listeners
  useEffect(() => {
    if (!isSpotlightTourActive) return undefined

    const handleScrollOrResize = () => {
      computePositions()
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true })

    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined' && targetElementRef.current) {
      resizeObserver = new ResizeObserver(() => computePositions())
      resizeObserver.observe(targetElementRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [isSpotlightTourActive, computePositions])

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

  useBackButton(handleSkip, Boolean(isSpotlightTourActive))

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

  const StepIcon = currentStep?.Icon || Sparkles
  const isLastStep = currentStepIndex === tourSteps.length - 1

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
  const svgPath = buildCutoutSvgPath(targetRect, vw, vh)

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-hidden select-none animate-fadeIn pointer-events-none">
      {/* Driver.js style clean SVG backdrop with evenodd cutout */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-auto"
        onClick={handleNext}
      >
        <path
          d={svgPath}
          fill="rgba(5, 8, 18, 0.72)"
          fillRule="evenodd"
          className="transition-[d] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
      </svg>

      {/* Clean borderless spotlight target hotspot */}
      {targetRect && (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNext()}
          className="pointer-events-auto absolute transition-[top,left,width,height,border-radius] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer focus:outline-none"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: targetRect.radius || 20,
          }}
          title={t('tour.targetHint', 'Klik target untuk lanjut')}
          aria-label={t('tour.targetHint', 'Klik target untuk lanjut')}
        />
      )}

      {/* Floating Tooltip Card */}
      <div
        className="absolute z-10 flex flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-2xl transition-[top,left,width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto"
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
          width: popoverPos.width || 360,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Directional Pointer Arrow (Caret) */}
        {popoverPos.placement === 'bottom' && (
          <div
            className="absolute -top-2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-t border-l border-[var(--border)] bg-[var(--panel-strong)] transition-[left] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xs"
            style={{ left: popoverPos.arrowLeft }}
          />
        )}
        {popoverPos.placement === 'top' && (
          <div
            className="absolute -bottom-2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-[var(--border)] bg-[var(--panel-strong)] transition-[left] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xs"
            style={{ left: popoverPos.arrowLeft }}
          />
        )}
        {popoverPos.placement === 'right' && (
          <div
            className="absolute -left-2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 border-b border-l border-[var(--border)] bg-[var(--panel-strong)] transition-[top] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xs"
            style={{ top: popoverPos.arrowTop }}
          />
        )}

        {/* Card Header & Content keyed to step for smooth entry */}
        <div key={currentStep.id} className="animate-fadeIn">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${currentStep.color} shadow-2xs`}>
                <StepIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-[var(--accent)]/12 px-2.5 py-0.5 text-[9.5px] font-black tracking-wider text-[var(--accent)] uppercase border border-[var(--accent)]/20">
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
              className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition cursor-pointer active:scale-95 shadow-2xs"
              title={t('tour.skip', 'Lewati Tur')}
              aria-label={t('tour.skip', 'Lewati Tur')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="mt-3 min-h-[50px]">
            <p className="text-xs leading-relaxed text-[var(--muted)] font-medium">
              {currentStep?.desc}
            </p>
          </div>
        </div>

        {/* Keyboard Helper (Desktop only) */}
        <div className="hidden sm:flex items-center gap-1 mt-1 text-[10px] font-bold text-[var(--muted-2)]">
          <CornerDownLeft className="h-3 w-3" />
          <span>{t('tour.keyboardHint', 'Gunakan ← → atau Enter untuk navigasi')}</span>
        </div>

        {/* Footer controls */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border)]/70 pt-3">
          {/* Interactive Step dots */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label={t('tour.stepDotsLabel', 'Langkah tur')}>
            {tourSteps.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={idx === currentStepIndex}
                onClick={() => setCurrentStepIndex(idx)}
                aria-label={t('tour.stepDot', { step: idx + 1 })}
                className="h-2 rounded-full transition-[width,background-color] duration-300 cursor-pointer"
                style={{
                  width: idx === currentStepIndex ? 22 : 6,
                  backgroundColor:
                    idx === currentStepIndex ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t('tour.prev', 'Kembali')}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-[var(--bg)] shadow-md transition active:scale-95 hover:opacity-90 cursor-pointer"
            >
              <span>
                {isLastStep
                  ? t('tour.finish', 'Selesai')
                  : t('tour.next', 'Lanjut')}
              </span>
              {isLastStep ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
