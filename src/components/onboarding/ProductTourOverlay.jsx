import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, ArrowRight, Check, X } from 'lucide-react'

const TOUR_STEPS = [
  {
    target: '[data-tour="networth-card"]',
    title: 'Grafik Kekayaan Bersih',
    description: 'Klik area grafik ini untuk melihat detail fluktuasi aset, laju rata-rata, dan statistik dompet kamu.',
  },
  {
    target: '[data-tour="quick-add-btn"]',
    title: 'Tombol Catat Transaksi',
    description: 'Tekan tombol ini kapan saja untuk mencatat pengeluaran, pemasukan, atau transfer dompet dengan cepat.',
  },
  {
    target: '[data-tour="ai-chat-btn"]',
    title: 'Asisten Keuangan AI',
    description: 'Bicaralah dengan AI untuk mencatat otomatis lewat teks, minta analisis hemat, dan rekomendasi anggaran.',
  },
  {
    target: '[data-tour="bottom-nav"]',
    title: 'Navigasi Lengkap',
    description: 'Akses menu Anggaran, Habit Tracker, To-Do List, dan Laporan Keuangan secara instan di bar bawah.',
  },
]

export default function ProductTourOverlay() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    const shouldShow = localStorage.getItem('ft_show_product_tour')
    const completed = localStorage.getItem('ft_product_tour_completed')
    if (shouldShow === 'true' && completed !== 'true') {
      setIsVisible(true)
    }
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const step = TOUR_STEPS[currentStep]
    if (!step) return

    const updateRect = () => {
      const el = document.querySelector(step.target)
      if (el) {
        const bounds = el.getBoundingClientRect()
        setRect({
          top: bounds.top,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
        })
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        setRect(null)
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [isVisible, currentStep])

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    setIsVisible(false)
    localStorage.removeItem('ft_show_product_tour')
    localStorage.setItem('ft_product_tour_completed', 'true')
  }

  if (!isVisible || typeof document === 'undefined') return null

  const step = TOUR_STEPS[currentStep]

  // Dynamic positioning for the tooltip card so it never overlaps the target element!
  const isLowerHalf = rect ? rect.top > window.innerHeight / 2 : false
  const tooltipStyle = isLowerHalf
    ? { top: 'env(safe-area-inset-top, 1rem)', marginTop: '2rem' }
    : { bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Dark Dimmed Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300" onClick={handleComplete} />

      {/* Highlight Box over target element */}
      {rect && (
        <div
          className="absolute rounded-2xl ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-black transition-all duration-300 pointer-events-none shadow-[0_0_30px_rgba(59,130,246,0.5)] z-50"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}

      {/* Tooltip Card with Dynamic Position */}
      <div
        style={tooltipStyle}
        className="absolute inset-x-4 mx-auto max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-2xl transition-all duration-300 space-y-3 z-50"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-bold text-[var(--accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            Tur Aplikasi ({currentStep + 1}/{TOUR_STEPS.length})
          </span>
          <button onClick={handleComplete} className="text-[var(--muted)] hover:text-[var(--fg)] transition p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <h4 className="text-base font-extrabold text-[var(--fg)]">{step.title}</h4>
          <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">{step.description}</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={handleComplete} className="text-xs font-bold text-[var(--muted)] hover:underline">
            Lewati Tur
          </button>
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--fg)] px-4 py-2 text-xs font-bold text-[var(--bg)] shadow-md transition active:scale-95"
          >
            <span>{currentStep === TOUR_STEPS.length - 1 ? 'Selesai' : 'Lanjut'}</span>
            {currentStep === TOUR_STEPS.length - 1 ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
