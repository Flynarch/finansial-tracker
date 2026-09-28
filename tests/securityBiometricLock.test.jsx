// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import useSettingsStore from '../src/store/useSettingsStore'
import LockScreen from '../src/components/ui/LockScreen'
import PinPadModal from '../src/components/security/PinPadModal'
import PatternLockModal from '../src/components/security/PatternLockModal'
import { authenticateBiometric } from '../src/lib/biometric'

// Mock db for settings
vi.mock('../src/lib/db', () => ({
  db: {
    settings: {
      put: vi.fn().mockResolvedValue('preferences'),
      get: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(1),
    },
  },
}))

vi.mock('../src/lib/biometric', () => ({
  authenticateBiometric: vi.fn(),
  canUseBiometric: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

vi.mock('../src/lib/smartNotifications', () => ({
  initNotificationChannels: vi.fn().mockResolvedValue(true),
}))

describe('Security & Biometrics State Guard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      locale: 'id',
      securityEnabled: false,
      securityMethod: 'none',
      lockSecret: '',
      biometricEnabled: true,
      autoLockTimeout: 0,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('respects biometricEnabled = false when setting PIN security', async () => {
    await useSettingsStore.getState().setSecurity({
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: '1234',
      biometricEnabled: false,
    })

    const state = useSettingsStore.getState()
    expect(state.securityEnabled).toBe(true)
    expect(state.securityMethod).toBe('pin')
    expect(state.biometricEnabled).toBe(false)
  })

  it('preserves biometricEnabled = false when updating autoLockTimeout or lockSecret without passing biometricEnabled', async () => {
    // First set security with biometrics disabled
    await useSettingsStore.getState().setSecurity({
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: '1234',
      biometricEnabled: false,
    })

    expect(useSettingsStore.getState().biometricEnabled).toBe(false)

    // Now update only timeout - must NOT reset biometricEnabled to true!
    await useSettingsStore.getState().setSecurity({
      autoLockTimeout: 300,
    })

    expect(useSettingsStore.getState().biometricEnabled).toBe(false)
    expect(useSettingsStore.getState().autoLockTimeout).toBe(300)

    // Now update lockSecret and securityMethod without passing biometricEnabled - must NOT reset biometricEnabled to true!
    await useSettingsStore.getState().setSecurity({
      securityMethod: 'pin',
      lockSecret: '5678',
    })

    expect(useSettingsStore.getState().biometricEnabled).toBe(false)
  })

  it('allows toggling biometricEnabled to true explicitly', async () => {
    await useSettingsStore.getState().setSecurity({
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: '1234',
      biometricEnabled: false,
    })

    expect(useSettingsStore.getState().biometricEnabled).toBe(false)

    // Toggle on
    await useSettingsStore.getState().setSecurity({
      biometricEnabled: true,
    })

    expect(useSettingsStore.getState().biometricEnabled).toBe(true)
  })

  it('respects biometricEnabled = false when setting Pattern security', async () => {
    await useSettingsStore.getState().setSecurity({
      securityEnabled: true,
      securityMethod: 'pattern',
      lockSecret: '0-1-2-3',
      biometricEnabled: false,
    })

    const state = useSettingsStore.getState()
    expect(state.securityEnabled).toBe(true)
    expect(state.securityMethod).toBe('pattern')
    expect(state.biometricEnabled).toBe(false)
  })

  it('does NOT call biometric authentication on LockScreen if biometricEnabled is false', async () => {
    vi.useFakeTimers()
    useSettingsStore.setState({
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: '1234',
      biometricEnabled: false,
    })

    render(<LockScreen onUnlock={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(authenticateBiometric).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('calls biometric authentication once and stops when user cancels (does not loop continuously)', async () => {
    vi.useFakeTimers()
    useSettingsStore.setState({
      securityEnabled: true,
      securityMethod: 'pin',
      lockSecret: '1234',
      biometricEnabled: true,
    })

    // Simulate user cancelling biometric (resolves false)
    vi.mocked(authenticateBiometric).mockResolvedValue(false)

    render(<LockScreen onUnlock={vi.fn()} />)

    // Initial mount prompt after 280ms
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(authenticateBiometric).toHaveBeenCalledTimes(1)

    // Wait further - it must NOT re-call in a loop!
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(authenticateBiometric).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('PinPadModal allows toggling biometrics off and passes preference to onSave', async () => {
    const handleSave = vi.fn()
    const handleClose = vi.fn()

    render(
      <PinPadModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        initialBiometric={true}
      />
    )

    // Toggle biometrics off
    const toggleBtn = screen.getByText('Buka juga via Biometrik').closest('button')
    expect(toggleBtn).toBeTruthy()
    fireEvent.click(toggleBtn)

    // Enter PIN: 1, 2, 3, 4
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    // Confirm step
    await new Promise((r) => setTimeout(r, 250))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await new Promise((r) => setTimeout(r, 450))

    expect(handleSave).toHaveBeenCalledWith('1234', false)
  })

  it('PatternLockModal renders biometric toggle and allows toggling preference', () => {
    const handleSave = vi.fn()
    const handleClose = vi.fn()

    render(
      <PatternLockModal
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        initialBiometric={false}
      />
    )

    const toggleBtn = screen.getByText('Buka juga via Biometrik').closest('button')
    expect(toggleBtn).toBeTruthy()
    fireEvent.click(toggleBtn)
  })
})
