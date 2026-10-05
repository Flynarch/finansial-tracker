import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Fingerprint,
  AlertCircle,
  Delete,
  CheckCircle2,
  Lock,
  Grid3X3,
  KeyRound,
} from 'lucide-react'
import { authenticateBiometric } from '../../lib/biometric'
import { authenticatePasskey, getStoredPasskeys } from '../../lib/passkeys'
import { Capacitor } from '@capacitor/core'
import { triggerHaptic } from '../../lib/haptics'
import { verifyPin } from '../../lib/crypto'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

const PATTERN_DOTS = [
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

function LockScreen({ onUnlock }) {
  const { t } = useTranslation()
  const rawSecurityMethod = useSettingsStore((s) => s.securityMethod)
  const storedPin = useSettingsStore((s) => s.storedPin)
  const lockSecret = useSettingsStore((s) => s.lockSecret || '')
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled !== false)
  const unlock = useSettingsStore((s) => s.unlock)

  // Resolve effective security method:
  // If 'none' or not in ['pin', 'pattern', 'biometric'], determine fallback based on storedPin/lockSecret
  let computedMethod = rawSecurityMethod
  if (!computedMethod || computedMethod === 'none' || !['pin', 'pattern', 'biometric'].includes(computedMethod)) {
    if (storedPin || (lockSecret && !lockSecret.includes('-'))) {
      computedMethod = 'pin'
    } else if (lockSecret && lockSecret.includes('-')) {
      computedMethod = 'pattern'
    } else {
      computedMethod = 'none'
    }
  }

  const [modeOverride, setModeOverride] = useState(null)
  const securityMethod = modeOverride || computedMethod
  const isWebPasskeyAvailable = !Capacitor.isNativePlatform() && getStoredPasskeys().length > 0

  // Safety guard: If no method configured or no secret exists at all, unlock immediately
  useEffect(() => {
    if (computedMethod === 'none') {
      onUnlock?.()
      unlock?.()
    }
  }, [computedMethod, onUnlock, unlock])

  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isSuccessUnlocked, setIsSuccessUnlocked] = useState(false)

  // PIN state
  const [pinInput, setPinInput] = useState('')
  const [isShaking, setIsShaking] = useState(false)
  const [isBioFilling, setIsBioFilling] = useState(false)
  const [bioFillCount, setBioFillCount] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [lockoutSeconds])

  // Pattern state
  const [patternPath, setPatternPath] = useState([])
  const [isDrawingPattern, setIsDrawingPattern] = useState(false)
  const [cursorPos, setCursorPos] = useState(null)
  const patternSvgRef = useRef(null)

  // Track timers and intervals to prevent memory leaks and state updates on unmounted component
  const timersRef = useRef(new Set())
  const intervalsRef = useRef(new Set())
  const isMountedRef = useRef(true)

  const setTrackedTimeout = useCallback((fn, delay) => {
    let id
    id = setTimeout(() => {
      timersRef.current.delete(id)
      if (isMountedRef.current) {
        fn()
      }
    }, delay)
    timersRef.current.add(id)
    return id
  }, [])

  const setTrackedInterval = useCallback((fn, delay) => {
    const id = setInterval(() => {
      if (isMountedRef.current) {
        fn()
      }
    }, delay)
    intervalsRef.current.add(id)
    return id
  }, [])

  const clearTrackedInterval = useCallback((id) => {
    clearInterval(id)
    intervalsRef.current.delete(id)
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    const timers = timersRef.current
    const intervals = intervalsRef.current
    return () => {
      isMountedRef.current = false
      timers.forEach((id) => clearTimeout(id))
      timers.clear()
      intervals.forEach((id) => clearInterval(id))
      intervals.clear()
    }
  }, [])

  const isAuthenticatingRef = useRef(false)
  const hasAutoPromptedRef = useRef(false)

  // Biometric Unlock with cascading wave animation
  const handleBiometricUnlock = useCallback(async () => {
    if (isAuthenticatingRef.current || isSuccessUnlocked || isBioFilling) return
    isAuthenticatingRef.current = true
    setIsAuthenticating(true)
    setError('')
    try {
      let success = false
      if (Capacitor.isNativePlatform()) {
        success = await authenticateBiometric()
      } else {
        const passkeys = getStoredPasskeys()
        if (passkeys && passkeys.length > 0) {
          try {
            const result = await authenticatePasskey()
            success = Boolean(result?.success)
          } catch (passkeyErr) {
            console.warn('[LockScreen:passkey]', passkeyErr)
            setError(passkeyErr?.message || t('lock.passkeyFailed', 'Autentikasi Passkey gagal.'))
            success = false
          }
        } else {
          success = await authenticateBiometric()
        }
      }
      if (!isMountedRef.current) return
      if (success) {
        triggerHaptic('success')
        if (securityMethod === 'pin') {
          // Play sequential pin dot fill animation as requested
          setIsBioFilling(true)
          setBioFillCount(1)
          setTrackedTimeout(() => setBioFillCount(2), 70)
          setTrackedTimeout(() => setBioFillCount(3), 140)
          setTrackedTimeout(() => {
            setBioFillCount(4)
            setIsSuccessUnlocked(true)
          }, 210)
          setTrackedTimeout(() => {
            onUnlock()
          }, 450)
        } else if (securityMethod === 'pattern' && lockSecret && !lockSecret.includes('$') && lockSecret.length <= 17) {
          const rawNodes = lockSecret.split('-').map(Number)
          if (rawNodes.length > 0 && rawNodes.every((n) => Number.isInteger(n) && n >= 0 && n <= 8)) {
            let idx = 1
            setPatternPath([rawNodes[0]])
            const interval = setTrackedInterval(() => {
              if (idx < rawNodes.length) {
                setPatternPath(rawNodes.slice(0, idx + 1))
                idx++
              } else {
                clearTrackedInterval(interval)
                setIsSuccessUnlocked(true)
                setTrackedTimeout(() => onUnlock(), 350)
              }
            }, 70)
          } else {
            setIsSuccessUnlocked(true)
            setTrackedTimeout(() => onUnlock(), 300)
          }
        } else {
          setIsSuccessUnlocked(true)
          setTrackedTimeout(() => onUnlock(), 300)
        }
        return
      }
    } catch (err){
      console.warn('[LockScreen]', err)
      /* ignore */
    } finally {
      isAuthenticatingRef.current = false
      if (isMountedRef.current) {
        setIsAuthenticating(false)
      }
    }
  }, [isSuccessUnlocked, isBioFilling, securityMethod, lockSecret, onUnlock, setTrackedTimeout, setTrackedInterval, clearTrackedInterval, t])

  const handleBiometricUnlockRef = useRef(handleBiometricUnlock)
  useEffect(() => {
    handleBiometricUnlockRef.current = handleBiometricUnlock
  })

  // Automatically prompt native biometric/device passcode on mount AT MOST ONCE if biometric enabled
  // Note: On web browsers, WebAuthn requires an explicit user gesture; calling it on mount causes NotAllowedError.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (securityMethod === 'none' || !biometricEnabled || hasAutoPromptedRef.current) return
    hasAutoPromptedRef.current = true
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        handleBiometricUnlockRef.current?.()
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [biometricEnabled, securityMethod])

  // Handle PIN digit input
  const handlePinDigit = async (digit) => {
    if (isBioFilling || isSuccessUnlocked || lockoutSeconds > 0) return
    triggerHaptic('light')
    setError('')

    const nextPin = pinInput + digit
    setPinInput(nextPin)

    if (nextPin.length === 4) {
      const isMatch = await verifyPin(nextPin, lockSecret || storedPin)
      if (isMatch) {
        triggerHaptic('success')
        setIsSuccessUnlocked(true)
        setFailedAttempts(0)
        setTrackedTimeout(() => {
          onUnlock()
        }, 300)
      } else {
        triggerHaptic('warning')
        setIsShaking(true)
        const nextFailed = failedAttempts + 1
        setFailedAttempts(nextFailed)
        if (nextFailed >= 5) {
          setLockoutSeconds(30)
          setError(t('lock.tooManyAttempts', 'Terlalu banyak percobaan salah. Coba lagi dalam 30 detik.'))
        } else {
          setError(t('lock.incorrectPin', 'PIN salah'))
        }
        setTrackedTimeout(() => {
          setPinInput('')
          setIsShaking(false)
        }, 600)
      }
    }
  }

  const handlePinDelete = () => {
    if (isBioFilling || isSuccessUnlocked || lockoutSeconds > 0) return
    triggerHaptic('selection')
    setError('')
    setPinInput((prev) => prev.slice(0, -1))
  }

  // Handle Pattern Input
  const getSvgPoint = (e) => {
    if (!patternSvgRef.current) return null
    const rect = patternSvgRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = ((clientX - rect.left) / rect.width) * 250
    const y = ((clientY - rect.top) / rect.height) * 250
    return { x, y }
  }

  const findNearbyDot = (pt) => {
    if (!pt) return null
    const threshold = 32
    return PATTERN_DOTS.find((d) => Math.hypot(d.x - pt.x, d.y - pt.y) < threshold) || null
  }

  const handlePatternStart = (e) => {
    if (isSuccessUnlocked || lockoutSeconds > 0) return
    setError('')
    const pt = getSvgPoint(e)
    if (!pt) return
    setIsDrawingPattern(true)
    const dot = findNearbyDot(pt)
    if (dot) {
      triggerHaptic('light')
      setPatternPath([dot.id])
    } else {
      setPatternPath([])
    }
    setCursorPos(pt)
  }

  const handlePatternMove = (e) => {
    if (!isDrawingPattern || isSuccessUnlocked || lockoutSeconds > 0) return
    const pt = getSvgPoint(e)
    if (!pt) return
    setCursorPos(pt)

    const dot = findNearbyDot(pt)
    if (dot && !patternPath.includes(dot.id)) {
      triggerHaptic('selection')
      setPatternPath((prev) => [...prev, dot.id])
    }
  }

  const handlePatternEnd = async () => {
    if (!isDrawingPattern || isSuccessUnlocked || lockoutSeconds > 0) return
    setIsDrawingPattern(false)
    setCursorPos(null)

    if (patternPath.length === 0) return

    const drawnStr = patternPath.join('-')
    const isMatch = Boolean(lockSecret) && (await verifyPin(drawnStr, lockSecret))
    if (isMatch) {
      triggerHaptic('success')
      setIsSuccessUnlocked(true)
      setFailedAttempts(0)
      setTrackedTimeout(() => onUnlock(), 300)
    } else {
      triggerHaptic('warning')
      setIsShaking(true)
      const nextFailed = failedAttempts + 1
      setFailedAttempts(nextFailed)
      if (nextFailed >= 5) {
        setLockoutSeconds(30)
        setError(t('lock.tooManyAttempts', 'Terlalu banyak percobaan salah. Coba lagi dalam 30 detik.'))
      } else {
        setError(t('lock.incorrectPattern', 'Pola salah'))
      }
      setTrackedTimeout(() => {
        setPatternPath([])
        setIsShaking(false)
      }, 600)
    }
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del']

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg)]/95 px-4 backdrop-blur-md select-none animate-fadeIn">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Lock Header Icon */}
        <div className={`grid h-16 w-16 place-items-center rounded-3xl border transition-all duration-300 shadow-card mb-3 ${
          isSuccessUnlocked
            ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 scale-105'
            : 'bg-[var(--field-bg)] text-[var(--fg)] border-[var(--border)]'
        }`}>
          {isSuccessUnlocked ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in-75" />
          ) : securityMethod === 'pattern' ? (
            <Grid3X3 className="h-7 w-7 text-[var(--lock)]" />
          ) : securityMethod === 'pin' ? (
            <Lock className="h-7 w-7 text-[var(--lock)]" />
          ) : (
            <Fingerprint className="h-8 w-8 text-[var(--lock)]" />
          )}
        </div>

        <h2 className="text-base font-black tracking-tight text-[var(--fg)]">
          {isSuccessUnlocked ? t('lock.unlocked', 'Terbuka') : t('lock.title', 'FinTrack Terkunci')}
        </h2>
        <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
          {securityMethod === 'pattern'
            ? t('lock.drawPatternDesc', 'Gambar pola untuk membuka')
            : securityMethod === 'pin'
            ? t('lock.enterPinDesc', 'Masukkan 4 digit PIN Anda')
            : t('lock.desc', 'Verifikasi sidik jari, Face ID, atau sandi HP')}
        </p>

        {/* Error Alert */}
        {error || lockoutSeconds > 0 ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-rose-500 animate-fadeIn">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {lockoutSeconds > 0
                ? `${t('lock.tooManyAttempts', 'Terlalu banyak percobaan salah.')} (${lockoutSeconds}s)`
                : error}
            </span>
          </p>
        ) : (
          <div className="h-4 mt-2" />
        )}

        {/* ── MODE 1: PIN LOCK ── */}
        {securityMethod === 'pin' && (
          <div className="w-full flex flex-col items-center mt-2 space-y-4">
            {/* PIN Dots with Shake and Success Wave */}
            <div
              className={`flex items-center gap-4 transition-transform duration-150 ${
                isShaking ? 'translate-x-1 animate-bounce' : ''
              }`}
            >
              {[0, 1, 2, 3].map((i) => {
                const isFilled = isBioFilling ? bioFillCount > i : pinInput.length > i
                return (
                  <div
                    key={i}
                    className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                      isSuccessUnlocked
                        ? 'bg-emerald-500 border-emerald-500 scale-125 shadow-sm'
                        : isFilled
                        ? 'bg-[var(--lock)] border-[var(--lock)] scale-110 shadow-xs'
                        : 'border-[var(--border-strong)] bg-[var(--field-bg)]'
                    }`}
                  />
                )
              })}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[250px] pt-2">
              {digits.map((item, idx) => {
                if (item === 'bio') {
                  if (!biometricEnabled) return <div key={idx} className="h-14 w-14" />
                  const BioIcon = isWebPasskeyAvailable ? KeyRound : Fingerprint
                  const bioAriaLabel = isWebPasskeyAvailable
                    ? t('lock.unlockPasskey', 'Buka dengan Passkey')
                    : t('settings.biometricAuth', 'Verifikasi Biometrik')
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={handleBiometricUnlock}
                      disabled={isAuthenticating || isSuccessUnlocked || isBioFilling || lockoutSeconds > 0}
                      className="h-14 w-14 rounded-2xl flex items-center justify-center text-[var(--lock)] hover:bg-[var(--lock-soft)] border border-transparent hover:border-[var(--lock)]/25 transition active:scale-90 cursor-pointer mx-auto"
                      aria-label={bioAriaLabel}
                    >
                      <BioIcon className="h-6 w-6" />
                    </button>
                  )
                }
                if (item === 'del') {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={handlePinDelete}
                      disabled={pinInput.length === 0 || isBioFilling || isSuccessUnlocked || lockoutSeconds > 0}
                      className="h-14 w-14 rounded-2xl flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-90 cursor-pointer disabled:opacity-30 disabled:pointer-events-none mx-auto"
                      aria-label={t('common.delete', 'Hapus')}
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  )
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePinDigit(item)}
                    disabled={isBioFilling || isSuccessUnlocked || lockoutSeconds > 0}
                    className="h-14 w-14 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 text-[var(--fg)] text-xl font-black transition-all hover:bg-[var(--panel-strong)] hover:border-[var(--border-strong)] active:scale-90 active:bg-[var(--lock-soft)] active:text-[var(--lock)] cursor-pointer shadow-2xs mx-auto flex items-center justify-center"
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── MODE 2: PATTERN LOCK ── */}
        {securityMethod === 'pattern' && (
          <div className="w-full flex flex-col items-center mt-2 space-y-3">
            <div
              className={`relative touch-none rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/60 p-2 shadow-inner transition-transform duration-150 ${
                isShaking ? 'translate-x-1 animate-bounce' : ''
              }`}
            >
              <svg
                ref={patternSvgRef}
                viewBox="0 0 250 250"
                className="h-56 w-56 touch-none cursor-crosshair"
                onMouseDown={handlePatternStart}
                onMouseMove={handlePatternMove}
                onMouseUp={handlePatternEnd}
                onTouchStart={handlePatternStart}
                onTouchMove={handlePatternMove}
                onTouchEnd={handlePatternEnd}
              >
                {/* Connecting lines */}
                {patternPath.map((dotId, index) => {
                  if (index === patternPath.length - 1) return null
                  const nextId = patternPath[index + 1]
                  const p1 = PATTERN_DOTS[dotId]
                  const p2 = PATTERN_DOTS[nextId]
                  return (
                    <line
                      key={`line-${index}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isSuccessUnlocked ? 'var(--income)' : isShaking ? 'var(--expense)' : 'var(--lock)'}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )
                })}

                {/* Active tracking line */}
                {isDrawingPattern && cursorPos && patternPath.length > 0 && (
                  <line
                    x1={PATTERN_DOTS[patternPath[patternPath.length - 1]].x}
                    y1={PATTERN_DOTS[patternPath[patternPath.length - 1]].y}
                    x2={cursorPos.x}
                    y2={cursorPos.y}
                    stroke="var(--lock)"
                    strokeWidth="3"
                    strokeDasharray="4,4"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                )}

                {/* Nodes */}
                {PATTERN_DOTS.map((dot) => {
                  const isSelected = patternPath.includes(dot.id)
                  const dotColor = isSuccessUnlocked ? 'var(--income)' : isShaking ? 'var(--expense)' : 'var(--lock)'
                  return (
                    <g key={dot.id}>
                      {isSelected && (
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r="18"
                          fill={dotColor}
                          fillOpacity="0.2"
                        />
                      )}
                      <circle
                        cx={dot.x}
                        cy={dot.y}
                        r="10"
                        fill="var(--field-bg)"
                        stroke={isSelected ? dotColor : 'var(--border-strong)'}
                        strokeWidth={isSelected ? '3' : '2'}
                      />
                      <circle
                        cx={dot.x}
                        cy={dot.y}
                        r="4"
                        fill={isSelected ? dotColor : 'var(--muted)'}
                      />
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Pattern Biometric Trigger Button */}
            {biometricEnabled && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isAuthenticating || isSuccessUnlocked}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-4 text-xs font-bold text-[var(--fg)] shadow-2xs hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
              >
                {isWebPasskeyAvailable ? (
                  <KeyRound className="h-4 w-4 text-[var(--lock)]" />
                ) : (
                  <Fingerprint className="h-4 w-4 text-[var(--lock)]" />
                )}
                <span>
                  {isWebPasskeyAvailable
                    ? t('lock.unlockPasskey', 'Buka dengan Passkey')
                    : t('lock.unlockBio', 'Buka dengan Sidik Jari')}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── MODE 3: BIOMETRIC ONLY ── */}
        {securityMethod === 'biometric' && (
          <div className="mt-4 w-full space-y-2.5">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isAuthenticating || isSuccessUnlocked}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[var(--fg)] py-4 px-4 text-xs font-extrabold text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer disabled:opacity-60"
            >
              {isWebPasskeyAvailable ? <KeyRound className="h-5 w-5" /> : <Fingerprint className="h-5 w-5" />}
              <span>
                {isAuthenticating
                  ? isWebPasskeyAvailable
                    ? t('lock.passkeyVerifying', 'Memverifikasi Passkey...')
                    : t('lock.biometricVerifying', 'Menunggu Verifikasi HP...')
                  : isWebPasskeyAvailable
                    ? t('lock.unlockPasskey', 'Buka dengan Passkey')
                    : t('lock.unlockBtn', 'Buka dengan Sidik Jari / Sandi HP')}
              </span>
            </button>
            {storedPin || lockSecret ? (
              <button
                type="button"
                onClick={() => setModeOverride(storedPin || !lockSecret.includes('-') ? 'pin' : 'pattern')}
                className="flex items-center justify-center gap-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-3 px-4 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
              >
                <Lock className="h-4 w-4 text-[var(--muted)]" />
                <span>{t('lock.unlockWithPin', 'Buka dengan PIN / Sandi')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onUnlock?.()
                  unlock?.()
                }}
                className="flex items-center justify-center gap-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-3 px-4 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
              >
                <Lock className="h-4 w-4 text-[var(--muted)]" />
                <span>{t('lock.unlockEmergency', 'Buka Aplikasi (Tanpa Sandi)')}</span>
              </button>
            )}
          </div>
        )}

        {/* ── MODE 4: UNCONFIGURED / EMERGENCY UNLOCK ── */}
        {securityMethod === 'none' && (
          <div className="mt-4 w-full">
            <button
              type="button"
              onClick={() => {
                onUnlock?.()
                unlock?.()
              }}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[var(--fg)] py-4 px-4 text-xs font-extrabold text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
            >
              <Lock className="h-5 w-5" />
              <span>{t('lock.unlockBtn', 'Buka Aplikasi')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LockScreen
