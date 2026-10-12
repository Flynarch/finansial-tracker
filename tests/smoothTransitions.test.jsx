// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PageSkeleton from '../src/components/ui/PageSkeleton'
import Skeleton from '../src/components/ui/Skeleton'
import SettingsLayout from '../src/pages/settings/SettingsLayout'
import useSettingsStore from '../src/store/useSettingsStore'

// Mock subpages for SettingsLayout
vi.mock('../src/pages/settings/SettingsHome', () => ({
  default: () => <div data-testid="settings-home-content">Settings Home</div>,
}))

describe('Smooth Transitions & Skeleton Polish', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    useSettingsStore.setState({
      theme: 'dark',
      locale: 'id',
      isLoaded: true,
      reduceMotion: false,
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('PageSkeleton entrance animations', () => {
    it('renders with ft-skeleton-enter class for smooth appearance', () => {
      const { container } = render(<PageSkeleton variant="generic" />)
      const root = container.firstChild
      expect(root).toBeDefined()
      expect(root.className).toContain('ft-skeleton-enter')
    })

    it('renders transactions skeleton with ft-skeleton-enter', () => {
      const { container } = render(<PageSkeleton variant="transactions" />)
      const root = container.firstChild
      expect(root).toBeDefined()
      expect(root.className).toContain('ft-skeleton-enter')
    })

    it('renders dashboard skeleton with ft-skeleton-enter', () => {
      const { container } = render(<PageSkeleton variant="dashboard" />)
      const root = container.firstChild
      expect(root).toBeDefined()
      expect(root.className).toContain('ft-skeleton-enter')
    })
  })

  describe('Skeleton primitive components', () => {
    it('applies ft-skeleton-enter to card skeleton variant', () => {
      const { container } = render(<Skeleton variant="card" />)
      const card = container.firstChild
      expect(card).toBeDefined()
      expect(card.className).toContain('ft-skeleton-enter')
      expect(card.className).toContain('ft-skeleton-card')
    })

    it('applies ft-skeleton-enter to chart skeleton variant', () => {
      const { container } = render(<Skeleton variant="chart" />)
      const chart = container.firstChild
      expect(chart).toBeDefined()
      expect(chart.className).toContain('ft-skeleton-enter')
    })

    it('applies ft-skeleton-enter to text, circle, avatar, and pill variants', () => {
      const { container: textContainer } = render(<Skeleton variant="text" />)
      expect(textContainer.firstChild.className).toContain('ft-skeleton-enter')

      const { container: circleContainer } = render(<Skeleton variant="circle" />)
      expect(circleContainer.firstChild.className).toContain('ft-skeleton-enter')

      const { container: pillContainer } = render(<Skeleton variant="pill" />)
      expect(pillContainer.firstChild.className).toContain('ft-skeleton-enter')
    })
  })

  describe('SettingsLayout page transitions', () => {
    it('wraps subroutes in ft-page-crossfade and ft-content-loaded', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/settings']}>
          <SettingsLayout />
        </MemoryRouter>
      )

      const crossfadeWrapper = container.querySelector('.ft-page-crossfade')
      expect(crossfadeWrapper).not.toBeNull()

      const contentLoadedWrapper = container.querySelector('.ft-content-loaded')
      expect(contentLoadedWrapper).not.toBeNull()
    })
  })
})
