import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import useSettingsStore from '../../store/useSettingsStore'

const AddAccountPage = lazy(() => import('../../pages/AddAccountPage'))

const PROGRESS_KEY = 'ft_onboarding_progress'
const TOTAL_STEPS = 5 // welcome, username, balance, features, confirm
const FEATURE_SLIDE_COUNT = 5

/* ── Persistence helpers ─────────────────────────────────────────── */
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch { /* ignore */ }
}

/* ── Feature slide data ──────────────────────────────────────────── */
const featureSlides = [
  {
    id: 'networth',
    icon: 'networth',
    tag: 'Analisis Real-Time',
    colorClass: 'from-emerald-500/20 via-emerald-500/5 to-transparent text-emerald-500 border-emerald-500/20',
    title: 'Kekayaan Bersih & Riwayat',
    desc: 'Pantau total aset, investasi, dan arus kas bulananmu secara real-time lewat grafik yang rapi.',
  },
  {
    id: 'transactions',
    icon: 'transactions',
    tag: 'Multi-Kategori & Filter',
    colorClass: 'from-blue-500/20 via-blue-500/5 to-transparent text-blue-500 border-blue-500/20',
    title: 'Riwayat Transaksi & Kategori',
    desc: 'Catat pemasukan & pengeluaran dengan multi-kategori, catatan, serta filter & pencarian cepat.',
  },
  {
    id: 'budget',
    icon: 'budget',
    tag: 'Kendali Anggaran',
    colorClass: 'from-sky-500/20 via-sky-500/5 to-transparent text-sky-500 border-sky-500/20',
    title: 'Anggaran & Menabung',
    desc: 'Tetapkan batas pengeluaran bulanan per kategori dan lacak progres tabunganmu menuju target.',
  },
  {
    id: 'habits',
    icon: 'habits',
    tag: 'Konsistensi Harian',
    colorClass: 'from-amber-500/20 via-amber-500/5 to-transparent text-amber-500 border-amber-500/20',
    title: 'Habit Tracker',
    desc: 'Bangun kebiasaan finansial positif, lacak streak harianmu, dan lihat konsistensi lewat heatmap.',
  },
  {
    id: 'todos',
    icon: 'todos',
    tag: 'Produktivitas Finansial',
    colorClass: 'from-purple-500/20 via-purple-500/5 to-transparent text-purple-500 border-purple-500/20',
    title: 'To-do & Papan Ide',
    desc: 'Kelola tugas keuangan harian dan kumpulkan ide-ide finansial di papan kanvas kreatif.',
  },
]

/* ── SVG Icons for feature slides ────────────────────────────────── */
function FeatureIcon({ name, className = '' }) {
  const cls = `${className}`
  const props = { viewBox: '0 0 48 48', className: cls, fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (name === 'networth') return (
    <svg {...props}>
      <rect x="6" y="8" width="36" height="32" rx="5" />
      <path d="M14 32l6-8 5 5 9-13" />
      <circle cx="35" cy="16" r="2" fill="currentColor" stroke="none" opacity="0.4" />
      <path d="M6 18h36" strokeDasharray="2 3" opacity="0.3" />
    </svg>
  )
  if (name === 'transactions') return (
    <svg {...props}>
      <rect x="8" y="6" width="32" height="36" rx="5" />
      <path d="M15 16h18" />
      <path d="M15 24h12" />
      <path d="M15 32h8" />
      <circle cx="34" cy="24" r="4" strokeWidth="2.5" opacity="0.5" />
      <path d="M37 27l2 2" strokeWidth="2.5" opacity="0.5" />
    </svg>
  )
  if (name === 'budget') return (
    <svg {...props}>
      <circle cx="24" cy="24" r="16" />
      <path d="M24 8v16l11 7" />
      <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.1" stroke="none" />
      <path d="M10 38l-3 3" opacity="0.3" />
      <path d="M38 38l3 3" opacity="0.3" />
    </svg>
  )
  if (name === 'habits') return (
    <svg {...props}>
      <rect x="6" y="8" width="36" height="32" rx="5" />
      <path d="M6 16h36" />
      {[0, 1, 2, 3, 4].map(i => (
        <rect key={i} x={12 + i * 6} y="22" width="4" height="4" rx="1" fill="currentColor" opacity={0.2 + i * 0.15} stroke="none" />
      ))}
      {[0, 1, 2, 3, 4].map(i => (
        <rect key={`b${i}`} x={12 + i * 6} y="30" width="4" height="4" rx="1" fill="currentColor" opacity={0.4 - i * 0.06} stroke="none" />
      ))}
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3" strokeWidth="1.5" opacity="0.4" />
    </svg>
  )
  // todos
  return (
    <svg {...props}>
      <rect x="8" y="6" width="32" height="36" rx="5" />
      <path d="M16 16l2 2 4-4" />
      <path d="M26 16h8" />
      <path d="M16 24l2 2 4-4" />
      <path d="M26 24h8" />
      <path d="M16 32l2 2 4-4" opacity="0.4" />
      <path d="M26 32h8" opacity="0.4" />
    </svg>
  )
}

/* ── Progress Dots ───────────────────────────────────────────────── */
function ProgressDots({ total, active }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300 ease-out"
          style={{
            width: i === active ? 24 : 8,
            height: 8,
            backgroundColor: i === active ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 35%, transparent)',
          }}
        />
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function OnboardingFlow() {
  const navigate = useNavigate()
  const hasCompleted = useSettingsStore((s) => s.hasCompletedOnboarding)
  const isLoaded = useSettingsStore((s) => s.isLoaded)
  const setProfileName = useSettingsStore((s) => s.setProfileName)
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding)

  // Load saved progress
  const saved = useMemo(() => loadProgress(), [])

  const [step, setStep] = useState(saved?.step ?? 0)
  const [username, setUsername] = useState(saved?.username ?? '')
  const [featureIdx, setFeatureIdx] = useState(0)
  const [direction, setDirection] = useState(1) // 1=forward, -1=back
  const [isAnimating, setIsAnimating] = useState(false)

  // Validation
  const [usernameError, setUsernameError] = useState('')

  // Live wallet count for step 2 validation
  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  // Entrance animation
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!hasCompleted && isLoaded) {
      requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
    }
  }, [hasCompleted, isLoaded])

  // Persist progress on change
  useEffect(() => {
    if (step > 0) {
      saveProgress({ step, username })
    }
  }, [step, username])

  // Touch swipe for feature slides
  const touchStart = useRef(null)
  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback((e) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    touchStart.current = null
    if (Math.abs(diff) < 50) return
    if (diff > 0 && featureIdx < FEATURE_SLIDE_COUNT - 1) {
      setFeatureIdx(i => i + 1)
    } else if (diff < 0 && featureIdx > 0) {
      setFeatureIdx(i => i - 1)
    }
  }, [featureIdx])

  const goTo = useCallback((nextStep) => {
    const dir = nextStep > step ? 1 : -1
    setDirection(dir)
    setIsAnimating(true)
    setTimeout(() => {
      setStep(nextStep)
      requestAnimationFrame(() => {
        setIsAnimating(false)
      })
    }, 200)
  }, [step])

  const handleNext = useCallback(() => {
    if (step === 1) {
      // Validate username
      const trimmed = username.trim()
      if (!trimmed) { setUsernameError('Nama tidak boleh kosong'); return }
      if (trimmed.length < 2) { setUsernameError('Minimal 2 karakter'); return }
      setUsernameError('')
    }
    goTo(Math.min(step + 1, TOTAL_STEPS - 1))
  }, [step, username, goTo])

  const handleBack = useCallback(() => {
    if (step === 3 && featureIdx > 0) {
      setFeatureIdx(i => i - 1)
      return
    }
    goTo(Math.max(step - 1, 0))
  }, [step, featureIdx, goTo])

  const handleFinish = useCallback(async () => {
    const trimmedName = username.trim()
    // Save profile name
    await setProfileName(trimmedName)
    // Mark onboarding complete
    await completeOnboarding()
    clearProgress()
    // Also mark old onboarding as seen
    try { localStorage.setItem('ft_onboarding_seen_v1', '1') } catch { /* ignore */ }
    navigate('/dashboard', { replace: true })
  }, [username, setProfileName, completeOnboarding, navigate])

  // Don't render if already completed or settings not loaded yet
  if (!isLoaded || hasCompleted) return null

  const slideTransform = isAnimating
    ? `translateX(${direction > 0 ? '-30px' : '30px'})`
    : 'translateX(0)'
  const slideOpacity = isAnimating ? 0 : 1

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background: 'var(--bg)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col px-6 py-8 sm:justify-center sm:py-12">
        {/* Step content area */}
        <div
          className="flex flex-1 flex-col justify-center sm:flex-initial"
          style={{
            transform: slideTransform,
            opacity: slideOpacity,
            transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease',
          }}
        >
          {/* ── Step 0: Welcome ────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--fg)] shadow-lg">
                <span className="text-2xl font-black tracking-wider text-[var(--bg)]">FT</span>
              </div>
              <h1 className="ft-display text-3xl font-black tracking-tight text-[var(--fg)]">FinTrack</h1>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--muted)]">
                Asisten keuangan pribadimu — catat, pantau,<br />dan kendalikan finansialmu.
              </p>
              <button
                type="button"
                onClick={() => goTo(1)}
                className="mt-10 w-full max-w-[280px] rounded-2xl bg-[var(--fg)] py-3.5 text-sm font-bold text-[var(--bg)] shadow-md transition active:scale-[0.97]"
              >
                Mulai
              </button>
              <p className="mt-4 text-[11px] text-[var(--muted-2)]">Data tersimpan lokal di perangkatmu</p>
            </div>
          )}

          {/* ── Step 1: Username ───────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">Langkah 1 dari 3</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--fg)]">Siapa namamu?</h2>
              <p className="mt-1.5 text-sm text-[var(--muted)]">Kami akan menyapamu di Dashboard setiap hari.</p>

              <div className="mt-8">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setUsernameError('') }}
                  placeholder="Masukkan nama kamu"
                  autoFocus
                  maxLength={30}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3.5 text-base font-semibold text-[var(--fg)] outline-none transition placeholder:text-[var(--muted-2)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                />
                {usernameError && (
                  <p className="mt-2 text-xs font-semibold text-rose-400">{usernameError}</p>
                )}
              </div>

              <div className="mt-8 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] transition hover:bg-[var(--panel)] active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 rounded-2xl bg-[var(--fg)] py-3.5 text-sm font-bold text-[var(--bg)] shadow-md transition active:scale-[0.97]"
                >
                  Lanjut
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Tambah Akun / Wallet ────────────────── */}
          {step === 2 && (
            <div className="flex flex-col -mx-6 -my-8 h-screen">
              <Suspense fallback={<div className="flex-1 animate-pulse bg-[var(--bg)]" />}>
                <AddAccountPage
                  isOnboarding
                  onBack={handleBack}
                  onSuccess={() => goTo(3)}
                />
              </Suspense>
            </div>
          )}

          {/* ── Step 3: Feature Tour ──────────────────────────── */}
          {step === 3 && (
            <div
              className="flex flex-col items-center"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Skip button */}
              <button
                type="button"
                onClick={() => goTo(4)}
                className="absolute right-6 top-8 z-20 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] transition hover:bg-[var(--field-bg)] hover:text-[var(--fg)] sm:top-12"
              >
                Lewati Pengenalan →
              </button>

              {/* Feature slide content */}
              <div className="relative w-full overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${featureIdx * 100}%)` }}
                >
                  {featureSlides.map((slide, i) => (
                    <div
                      key={slide.id}
                      className="flex w-full flex-none flex-col items-center px-2 text-center"
                    >
                      <div
                        className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--accent)] shadow-md transition-all duration-500"
                        style={{
                          opacity: featureIdx === i ? 1 : 0.4,
                          transform: featureIdx === i ? 'scale(1)' : 'scale(0.85)',
                        }}
                      >
                        <FeatureIcon name={slide.icon} className="h-12 w-12" />
                      </div>
                      <h3 className="text-xl font-bold tracking-tight text-[var(--fg)]">{slide.title}</h3>
                      <p className="mx-auto mt-2 max-w-[300px] text-[13px] leading-relaxed text-[var(--muted)]">{slide.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature slide dots */}
              <div className="mt-8 flex items-center gap-1.5">
                {featureSlides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFeatureIdx(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: featureIdx === i ? 20 : 6,
                      height: 6,
                      backgroundColor: featureIdx === i ? 'var(--accent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)',
                    }}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="mt-8 flex w-full items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] transition hover:bg-[var(--panel)] active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (featureIdx < FEATURE_SLIDE_COUNT - 1) {
                      setFeatureIdx(i => i + 1)
                    } else {
                      goTo(4)
                    }
                  }}
                  className="flex-1 rounded-2xl bg-[var(--fg)] py-3.5 text-sm font-bold text-[var(--bg)] shadow-md transition active:scale-[0.97]"
                >
                  {featureIdx < FEATURE_SLIDE_COUNT - 1 ? 'Berikutnya' : 'Lanjut'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Summary / Confirm ─────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col">
              <div className="mb-6 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              </div>

              <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--fg)]">Semua siap!</h2>
              <p className="mt-1.5 text-center text-sm text-[var(--muted)]">Pastikan data berikut sudah benar sebelum mulai.</p>

              {/* Summary cards */}
              <div className="mt-8 space-y-3">
                {/* Username */}
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Nama</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-[var(--fg)]">{username.trim()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] transition hover:bg-[var(--field-bg)] active:scale-[0.97]"
                  >
                    Ubah
                  </button>
                </div>

                {/* Wallet */}
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Dompet</p>
                    <p className="mt-0.5 text-sm font-bold text-[var(--fg)]">
                      {wallets?.length > 0 ? `${wallets.length} wallet tersimpan` : 'Belum ada wallet'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] transition hover:bg-[var(--field-bg)] active:scale-[0.97]"
                  >
                    Ubah
                  </button>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-8 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] transition hover:bg-[var(--panel)] active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-bold text-[var(--bg)] shadow-lg transition active:scale-[0.97]"
                >
                  Mulai Pakai FinTrack
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress dots — shown on steps 1-4 */}
        {step > 0 && (
          <div className="mt-8 sm:mt-10">
            <ProgressDots total={TOTAL_STEPS} active={step} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
