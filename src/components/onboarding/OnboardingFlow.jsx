import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import useSettingsStore from '../../store/useSettingsStore'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import { formatCurrency } from '../../lib/utils'
import MoneyBagIcon from '../ui/MoneyBagIcon'
import {
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react'

const AddAccountPage = lazy(() => import('../../pages/AddAccountPage'))

const PROGRESS_KEY = 'ft_onboarding_progress'
const TOTAL_STEPS = 4 // 0: welcome, 1: username, 2: account, 3: confirm

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
  } catch {
    /* ignore */
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    /* ignore */
  }
}

/* ── Progress Indicator (Minimalist Flat) ────────────────────────── */
function ProgressHeader({ step }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-6">
      <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
        Langkah {step} dari 3
      </span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-6 bg-[var(--fg)]'
                : i < step
                ? 'w-3 bg-[var(--accent)]'
                : 'w-3 bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   MAIN ONBOARDING COMPONENT (Minimalist Flat Aesthetic)
   ════════════════════════════════════════════════════════════════════ */
export default function OnboardingFlow() {
  const navigate = useNavigate()
  const hasCompleted = useSettingsStore((s) => s.hasCompletedOnboarding)
  const isLoaded = useSettingsStore((s) => s.isLoaded)
  const setProfileName = useSettingsStore((s) => s.setProfileName)
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding)
  const startSpotlightTour = useSettingsStore((s) => s.startSpotlightTour)

  const saved = useMemo(() => loadProgress(), [])

  const [step, setStep] = useState(saved?.step ?? 0)
  const [username, setUsername] = useState(saved?.username ?? '')
  const [direction, setDirection] = useState(1)
  const [isAnimating, setIsAnimating] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!hasCompleted && isLoaded) {
      requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
    }
  }, [hasCompleted, isLoaded])

  useEffect(() => {
    if (step > 0) {
      saveProgress({ step, username })
    }
  }, [step, username])

  const goTo = useCallback(
    (nextStep) => {
      const dir = nextStep > step ? 1 : -1
      setDirection(dir)
      setIsAnimating(true)
      setTimeout(() => {
        setStep(nextStep)
        requestAnimationFrame(() => {
          setIsAnimating(false)
        })
      }, 180)
    },
    [step]
  )

  const handleNext = useCallback(() => {
    if (step === 1) {
      const trimmed = username.trim()
      if (!trimmed) {
        setUsernameError('Nama tidak boleh kosong')
        return
      }
      if (trimmed.length < 2) {
        setUsernameError('Minimal 2 karakter')
        return
      }
      setUsernameError('')
    }
    goTo(Math.min(step + 1, TOTAL_STEPS - 1))
  }, [step, username, goTo])

  const handleBack = useCallback(() => {
    goTo(Math.max(step - 1, 0))
  }, [step, goTo])

  const handleDeleteWallet = useCallback(async (e, walletId) => {
    e.stopPropagation()
    await db.wallets.delete(walletId)
  }, [])

  const handleFinish = useCallback(async () => {
    const trimmedName = username.trim()
    await setProfileName(trimmedName)
    await completeOnboarding()
    startSpotlightTour()
    clearProgress()
    try {
      localStorage.setItem('ft_onboarding_seen_v1', '1')
    } catch {
      /* ignore */
    }
    navigate('/dashboard', { replace: true })
  }, [username, setProfileName, completeOnboarding, startSpotlightTour, navigate])

  if (!isLoaded || hasCompleted) return null

  const slideTransform = isAnimating
    ? `translateX(${direction > 0 ? '-20px' : '20px'})`
    : 'translateX(0)'
  const slideOpacity = isAnimating ? 0 : 1

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col px-6 py-8 sm:justify-center sm:py-12">
        <div
          className="flex flex-1 flex-col justify-center sm:flex-initial"
          style={{
            transform: slideTransform,
            opacity: slideOpacity,
            transition: 'transform 0.2s ease-out, opacity 0.15s ease-out',
          }}
        >
          {/* ── Step 0: Welcome Screen (Minimalist Flat) ──────────── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--fg)] text-[var(--bg)] shadow-md">
                <span className="text-3xl font-black tracking-widest">FT</span>
              </div>

              <h1 className="ft-display text-4xl font-black tracking-tight text-[var(--fg)]">
                FinTrack
              </h1>
              <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--muted)] max-w-xs">
                Asisten keuangan pribadimu. Catat, pantau, dan kendalikan finansialmu dengan mudah.
              </p>

              {/* Security Badge */}
              <div className="mt-6 flex items-center gap-2 text-[11px] font-bold text-[var(--muted-2)]">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>100% Data Tersimpan Aman di Perangkat Anda</span>
              </div>

              <button
                type="button"
                onClick={() => goTo(1)}
                className="mt-8 w-full rounded-2xl bg-[var(--fg)] py-4 text-sm font-black text-[var(--bg)] shadow-md transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
              >
                Mulai Setup
              </button>
            </div>
          )}

          {/* ── Step 1: Username Input ────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col">
              <ProgressHeader step={1} />

              <h2 className="text-3xl font-black tracking-tight text-[var(--fg)]">
                Siapa namamu?
              </h2>
              <p className="mt-2 text-sm font-medium text-[var(--muted)] leading-relaxed">
                Kami akan menyapamu di Dasbor setiap hari.
              </p>

              <div className="mt-8">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setUsernameError('')
                  }}
                  placeholder="Masukkan nama kamu..."
                  autoFocus
                  maxLength={30}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-4 text-base font-bold text-[var(--fg)] outline-none transition placeholder:text-[var(--muted-2)] focus:border-[var(--fg)] focus:ring-1 focus:ring-[var(--fg)]"
                />
                {usernameError && (
                  <p className="mt-2 text-xs font-bold text-rose-500">{usernameError}</p>
                )}
              </div>

              <div className="mt-8 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] transition hover:bg-[var(--panel-strong)] active:scale-[0.97] cursor-pointer"
                >
                  <ChevronLeft size={20} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 rounded-2xl bg-[var(--fg)] py-4 text-sm font-black text-[var(--bg)] shadow-md transition hover:opacity-90 active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Lanjut</span>
                  <ChevronRight size={18} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Add Account / Wallet ──────────────────────── */}
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

          {/* ── Step 3: Multi-Wallet Summary & Finish ────────────── */}
          {step === 3 && (
            <div className="flex flex-col max-h-[85vh] overflow-y-auto pr-0.5">
              <ProgressHeader step={3} />

              <div className="mb-3 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500">
                  <Check size={30} strokeWidth={3} />
                </div>
              </div>

              <h2 className="text-center text-3xl font-black tracking-tight text-[var(--fg)]">
                Semua Siap!
              </h2>
              <p className="mt-1 text-center text-xs font-medium text-[var(--muted)]">
                Pastikan data profil dan dompet keuanganmu sudah sesuai.
              </p>

              {/* Summary Sections */}
              <div className="mt-5 space-y-4">
                {/* Profile Name Card */}
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                      Nama Pengguna
                    </p>
                    <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--fg)]">
                      {username.trim()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] transition hover:bg-[var(--border)]/40 cursor-pointer"
                  >
                    Ubah
                  </button>
                </div>

                {/* Added Wallets List Section */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                      Dompet Keuangan Tersimpan ({wallets?.length || 0})
                    </p>
                  </div>

                  {/* List of Wallets */}
                  {wallets && wallets.length > 0 ? (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1 ft-hide-scrollbar">
                      {wallets.map((w) => {
                        const logoUrl = getWalletLogoUrl(w)
                        return (
                          <div
                            key={w.id}
                            className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[var(--field-bg)]"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-[var(--panel-strong)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                                {w.customIcon === 'dollar' ? (
                                  <MoneyBagIcon size={18} strokeWidth={2.5} className="text-amber-500" />
                                ) : logoUrl ? (
                                  <img
                                    src={logoUrl}
                                    alt={w.name}
                                    className="w-full h-full object-contain p-0.5 rounded-full"
                                    onError={(e) => {
                                      e.target.style.display = 'none'
                                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                                    }}
                                  />
                                ) : null}
                                <span
                                  className="font-black text-xs text-[var(--fg)]"
                                  style={{ display: w.customIcon === 'dollar' || logoUrl ? 'none' : 'block' }}
                                >
                                  {w.name?.substring(0, 2).toUpperCase()}
                                </span>
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-black text-[var(--fg)] truncate">{w.name}</p>
                                <p className="text-[10px] font-bold text-[var(--muted)]">
                                  {w.currency || 'IDR'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black text-[var(--fg)] tabular-nums">
                                {formatCurrency(w.balance || 0, w.currency || 'IDR')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteWallet(e, w.id)}
                                className="p-1 rounded-lg text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Hapus Dompet"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center border border-dashed border-[var(--border)] rounded-xl bg-[var(--field-bg)]/50">
                      <Wallet size={20} className="mx-auto text-[var(--muted)] mb-1 opacity-50" />
                      <p className="text-xs font-bold text-[var(--muted)]">Belum ada dompet tersimpan</p>
                    </div>
                  )}

                  {/* Add Extra Wallet Button */}
                  <button
                    type="button"
                    onClick={() => goTo(2)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-xs font-black text-[var(--fg)] hover:bg-[var(--border)]/40 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Plus size={14} strokeWidth={3} />
                    <span>Tambah Dompet Lain</span>
                  </button>
                </div>
              </div>

              {/* Action CTA */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] transition hover:bg-[var(--panel-strong)] active:scale-[0.97] cursor-pointer"
                >
                  <ChevronLeft size={20} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 rounded-2xl bg-[var(--fg)] py-4 text-sm font-black text-[var(--bg)] shadow-md transition hover:opacity-90 active:scale-[0.97] cursor-pointer"
                >
                  Mulai Pakai FinTrack
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
