// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UserBubble, AiBubble } from '../src/components/chat/ChatBubble'
import PageHeader from '../src/components/ui/PageHeader'

describe('Chat Bubble Compact Layout & Timestamp Polish', () => {
  it('renders UserBubble with compact padding and smaller timestamp', () => {
    const { container } = render(
      <UserBubble content="Halo FinTrack" timestamp={new Date('2026-10-05T12:00:00Z').getTime()} status="confirmed" />
    )

    const bubbleEl = container.querySelector('.rounded-2xl')
    expect(bubbleEl).toBeDefined()
    expect(bubbleEl.className).toContain('px-3.5 py-2')

    const timeSpan = container.querySelector('span.text-\\[9\\.5px\\]')
    expect(timeSpan).toBeDefined()
    expect(timeSpan.textContent).toBeTruthy()
  })

  it('renders AiBubble with compact padding, tighter gap, and smaller timestamp', () => {
    const { container } = render(
      <AiBubble
        content="Pengeluaran berhasil dicatat."
        timestamp={new Date('2026-10-05T12:00:00Z').getTime()}
        position="single"
      />
    )

    const bubbleEl = container.querySelector('.flex-1')
    expect(bubbleEl).toBeDefined()
    expect(bubbleEl.className).toContain('px-3.5 py-2.25')
    expect(bubbleEl.className).toContain('gap-1')

    const timeSpan = container.querySelector('span.text-\\[9\\.5px\\]')
    expect(timeSpan).toBeDefined()
    expect(timeSpan.className).toContain('-mt-0.5')
  })
})

describe('PageHeader and Activity Tab Stability', () => {
  it('ensures PageHeader has min-h-[44px] when titlePosition is left', () => {
    const { container } = render(
      <PageHeader title="Aktivitas" titlePosition="left" />
    )
    const header = container.querySelector('header')
    expect(header).toBeDefined()
    expect(header.className).toContain('min-h-[44px]')
  })
})
