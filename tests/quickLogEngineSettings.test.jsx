// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../src/lib/db'
import useSettingsStore from '../src/store/useSettingsStore'
import SettingsAi from '../src/pages/settings/SettingsAi'

describe('Quick Log Engine Settings & Store Integration', () => {
  beforeEach(async () => {
    cleanup()
    vi.clearAllMocks()
    await db.settings.clear()
    useSettingsStore.setState({
      quickLogEngine: 'smart_ai',
      geminiApiKey: '',
      isLoaded: true,
    })
  })

  afterEach(async () => {
    cleanup()
    await db.settings.clear()
  })

  it('initializes with smart_ai as default quickLogEngine', () => {
    const engine = useSettingsStore.getState().quickLogEngine
    expect(engine).toBe('smart_ai')
  })

  it('updates quickLogEngine and persists to database', async () => {
    await act(async () => {
      await useSettingsStore.getState().setQuickLogEngine('fast_nlp')
    })

    expect(useSettingsStore.getState().quickLogEngine).toBe('fast_nlp')

    const saved = await db.settings.get('preferences')
    expect(saved).toBeDefined()
    expect(saved.quickLogEngine).toBe('fast_nlp')
  })

  it('loads persisted quickLogEngine correctly from db.settings', async () => {
    await db.settings.put({
      key: 'preferences',
      quickLogEngine: 'fast_nlp',
      theme: 'light',
      locale: 'id',
      defaultCurrency: 'IDR',
    })

    await act(async () => {
      await useSettingsStore.getState().loadSettings()
    })

    expect(useSettingsStore.getState().quickLogEngine).toBe('fast_nlp')
  })

  it('falls back to smart_ai when an unknown engine is provided', async () => {
    await act(async () => {
      await useSettingsStore.getState().setQuickLogEngine('unknown_engine')
    })

    expect(useSettingsStore.getState().quickLogEngine).toBe('smart_ai')
  })

  it('renders Quick Log Engine section in SettingsAi and allows switching options', async () => {
    render(
      <MemoryRouter>
        <SettingsAi />
      </MemoryRouter>
    )

    // Verify section title and buttons render
    expect(screen.getByText('Mode Mesin Catat Cepat (Quick Log)')).toBeTruthy()
    const smartButton = screen.getByRole('button', { name: /Mode Pintar \(AI Gemini\)/i })
    const fastButton = screen.getByRole('button', { name: /Mode Instan \(NLP Lokal 0ms\)/i })
    expect(smartButton).toBeTruthy()
    expect(fastButton).toBeTruthy()

    // Default hero badge says "AI Gemini"
    expect(screen.getByText('AI Gemini')).toBeTruthy()

    // Click Fast NLP option
    await act(async () => {
      fireEvent.click(fastButton)
    })

    expect(useSettingsStore.getState().quickLogEngine).toBe('fast_nlp')
    expect(screen.getByText('NLP Lokal')).toBeTruthy()

    // Click Smart AI option back
    await act(async () => {
      fireEvent.click(smartButton)
    })

    expect(useSettingsStore.getState().quickLogEngine).toBe('smart_ai')
    expect(screen.getByText('AI Gemini')).toBeTruthy()
  })
})
