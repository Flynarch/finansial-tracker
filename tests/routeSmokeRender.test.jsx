// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Suspense } from 'react'

// Direct page imports
import Dashboard from '../src/pages/Dashboard'
import Transactions from '../src/pages/Transactions'
import Loans from '../src/pages/Loans'
import Budget from '../src/pages/Budget'
import Savings from '../src/pages/Savings'
import Calendar from '../src/pages/Calendar'
import SettingsHome from '../src/pages/settings/SettingsHome'
import AiFinanceChat from '../src/pages/AiFinanceChat'

describe('Route Smoke Render Tests — Primary Pages Mount Integrity', () => {
  let consoleErrorSpy
  let consoleWarnSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it('mounts Dashboard page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Dashboard />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts Transactions page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Transactions />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts Loans page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/loans']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Loans />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts Budget page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/budget']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Budget />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts Savings page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/savings']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Savings />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts Calendar page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Calendar />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts SettingsHome page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <Suspense fallback={<div>Loading...</div>}>
          <SettingsHome />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })

  it('mounts AiFinanceChat page without throwing uncaught exceptions', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/ai-chat']}>
        <Suspense fallback={<div>Loading...</div>}>
          <AiFinanceChat />
        </Suspense>
      </MemoryRouter>
    )
    expect(container).toBeDefined()
  })
})
