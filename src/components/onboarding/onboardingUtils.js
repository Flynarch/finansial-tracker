import { createElement } from 'react'

export const PROGRESS_KEY = 'ft_onboarding_progress'
export const TOTAL_STEPS = 5 // 0: Login/Welcome, 1: Profile, 2: Theme, 3: Wallet, 4: Confirm

export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('[OnboardingFlow]', err)
    return null
  }
}

export function saveProgress(data) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('[OnboardingFlow]', err)
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch (err) {
    console.warn('[OnboardingFlow]', err)
  }
}

export function GoogleIcon({ className = 'w-5 h-5' }) {
  return createElement(
    'svg',
    { className, viewBox: '0 0 24 24', fill: 'none' },
    createElement('path', {
      d: 'M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z',
      fill: '#4285F4',
    }),
    createElement('path', {
      d: 'M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z',
      fill: '#34A853',
    }),
    createElement('path', {
      d: 'M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z',
      fill: '#FBBC05',
    }),
    createElement('path', {
      d: 'M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z',
      fill: '#EA4335',
    })
  )
}
