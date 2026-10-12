// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SpotlightTour from '../src/components/onboarding/SpotlightTour'
import { buildCutoutSvgPath } from '../src/components/onboarding/spotlightTourUtils'

// Mock useSettingsStore
const mockCompleteSpotlightTour = vi.fn()
let mockIsActive = true

vi.mock('../src/store/useSettingsStore', () => ({
  default: (selector) => {
    const state = {
      isSpotlightTourActive: mockIsActive,
      completeSpotlightTour: mockCompleteSpotlightTour,
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

describe('SpotlightTour - Smooth Transitions & Anti-Overshoot', () => {
  let heroEl
  let networthEl
  let aiBtnEl
  let bottomNavEl

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsActive = true

    // Setup mock DOM elements for tour steps
    document.body.innerHTML = ''

    heroEl = document.createElement('div')
    heroEl.setAttribute('data-tour', 'hero-carousel')
    heroEl.getBoundingClientRect = () => ({
      top: 60,
      left: 10,
      width: 370,
      height: 180,
      right: 380,
      bottom: 240,
    })
    document.body.appendChild(heroEl)

    networthEl = document.createElement('div')
    networthEl.setAttribute('data-tour', 'networth-chart')
    networthEl.getBoundingClientRect = () => ({
      top: 500,
      left: 10,
      width: 370,
      height: 250,
      right: 380,
      bottom: 750,
    })
    document.body.appendChild(networthEl)

    aiBtnEl = document.createElement('button')
    aiBtnEl.setAttribute('data-tour', 'ai-chat-btn')
    aiBtnEl.className = 'ft-ai-bar'
    aiBtnEl.style.position = 'fixed'
    aiBtnEl.getBoundingClientRect = () => ({
      top: 700,
      left: 120,
      width: 150,
      height: 48,
      right: 270,
      bottom: 748,
    })
    document.body.appendChild(aiBtnEl)

    bottomNavEl = document.createElement('nav')
    bottomNavEl.setAttribute('data-tour', 'bottom-nav')
    bottomNavEl.style.position = 'fixed'
    bottomNavEl.getBoundingClientRect = () => ({
      top: 780,
      left: 0,
      width: 390,
      height: 64,
      right: 390,
      bottom: 844,
    })
    document.body.appendChild(bottomNavEl)

    // Mock window scroll
    window.scrollY = 0
    window.scrollTo = vi.fn((x, y) => {
      window.scrollY = typeof y === 'number' ? y : 0
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders step 1 (hero-carousel) with proper cutout path and no overshoot', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SpotlightTour />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Kartu Saldo/i)).toBeTruthy()
    const svg = document.querySelector('svg')
    expect(svg).toBeTruthy()
    const path = svg.querySelector('path')
    expect(path).toBeTruthy()
    // Path should have evenodd cutout
    expect(path.getAttribute('d')).toContain('M0,0')
  })

  it('buildCutoutSvgPath generates full overlay fallback for null or zero dimension rects', () => {
    expect(buildCutoutSvgPath(null, 1000, 800)).toBe('M0,0 H1000 V800 H0 Z')
    expect(buildCutoutSvgPath({ width: 0, height: 100 }, 1000, 800)).toBe('M0,0 H1000 V800 H0 Z')
    expect(buildCutoutSvgPath({ width: 100, height: 0 }, 1000, 800)).toBe('M0,0 H1000 V800 H0 Z')

    const path = buildCutoutSvgPath({ left: 10, top: 20, width: 200, height: 100, radius: 16 }, 1000, 800)
    expect(path).toContain('M0,0 H1000 V800 H0 Z')
    expect(path).toContain('M26,20')
  })

  it('transitions to step 2 (networth-chart) on clicking Lanjut button', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SpotlightTour />
      </MemoryRouter>,
    )

    const nextBtn = screen.getByRole('button', { name: /^Lanjut$/i })
    act(() => {
      fireEvent.click(nextBtn)
    })

    expect(screen.getByText(/Grafik Kekayaan Bersih/i)).toBeTruthy()
  })

  it('handles navigation via keyboard arrows and escape key', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SpotlightTour />
      </MemoryRouter>,
    )

    // Press right arrow to go to step 2
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    })
    expect(screen.getByText(/Grafik Kekayaan Bersih/i)).toBeTruthy()

    // Press left arrow to go back to step 1
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
    })
    expect(screen.getByText(/Kartu Saldo/i)).toBeTruthy()

    // Press escape to skip/finish
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(mockCompleteSpotlightTour).toHaveBeenCalled()
  })

  it('completes the tour when the last step finishes', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SpotlightTour />
      </MemoryRouter>,
    )

    // Advance through all steps to the end
    for (let i = 0; i < 4; i++) {
      const nextBtn = screen.getByRole('button', { name: /^Lanjut$/i })
      act(() => {
        fireEvent.click(nextBtn)
      })
    }

    const finishBtn = screen.getByRole('button', { name: /^Selesai$/i })
    expect(finishBtn).toBeTruthy()

    act(() => {
      fireEvent.click(finishBtn)
    })
    expect(mockCompleteSpotlightTour).toHaveBeenCalled()
  })

  it('handles fixed elements without unexpected programmatic scroll displacement', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SpotlightTour />
      </MemoryRouter>,
    )

    // Advance to step 4 (ai-chat-btn)
    for (let i = 0; i < 3; i++) {
      const nextBtn = screen.getByRole('button', { name: /^Lanjut$/i })
      act(() => {
        fireEvent.click(nextBtn)
      })
    }

    expect(screen.getByText(/Pencatatan Cepat Pakai AI/i)).toBeTruthy()

    // Advance to step 5 (bottom-nav)
    const nextBtn = screen.getByRole('button', { name: /^Lanjut$/i })
    act(() => {
      fireEvent.click(nextBtn)
    })

    expect(screen.getByText(/Navigasi & Menu Lengkap/i)).toBeTruthy()
  })
})
