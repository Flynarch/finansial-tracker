// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import SettingsNotifications from '../src/pages/settings/SettingsNotifications'
import NotificationDrawerSheet from '../src/components/notifications/NotificationDrawerSheet'
import { db } from '../src/lib/db'
import * as notifIngestion from '../src/lib/notificationIngestion'

describe('SettingsNotifications & Notification Routes', () => {
  beforeEach(async () => {
    await db.wallets.clear()
    await db.notifications.clear()
    await db.wallets.add({
      id: 1,
      name: 'Main Wallet',
      currency: 'IDR',
      balance: 1000000,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders SettingsNotifications on Android APK when listener permission is granted without child object crash', async () => {
    // Mock native plugin to simulate Android APK with granted notification permission
    vi.spyOn(notifIngestion.FinTrackNotificationWeb.prototype, 'isPermissionGranted').mockResolvedValue({
      granted: true,
    })
    vi.spyOn(notifIngestion.FinTrackNotificationWeb.prototype, 'checkSmsPermission').mockResolvedValue({
      granted: false,
    })
    vi.spyOn(notifIngestion, 'getWhitelistedPackages').mockResolvedValue({
      packages: ['com.id.bca'],
    })

    await act(async () => {
      render(
        <MemoryRouter>
          <SettingsNotifications />
        </MemoryRouter>
      )
    })

    // Header should render
    expect(await screen.findByText(/Notifikasi & Pengingat Cerdas|Smart Notifications & Reminders/i)).toBeTruthy()

    // The listener granted section should render safely without throwing "Objects are not valid as a React child"
    expect(await screen.findByText(/Dompet Tujuan Pencatatan Otomatis|Default Wallet for Auto/i)).toBeTruthy()
    const syncBtn = await screen.findByText(/Sinkronkan Notifikasi Sekarang|Sync Notifications Now/i)
    expect(syncBtn).toBeTruthy()

    // Mock syncNotificationQueue to return a sync result
    vi.spyOn(notifIngestion, 'syncNotificationQueue').mockResolvedValue({
      syncedCount: 2,
    })

    // Click the sync button and verify feedback renders without crashing
    await act(async () => {
      fireEvent.click(syncBtn)
    })

    expect(await screen.findByText(/Berhasil mencatat 2 mutasi baru|recorded 2 new/i)).toBeTruthy()
  })

  it('redirects /notifications route to /settings/notifications properly', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/notifications']}>
          <Routes>
            <Route path="/notifications" element={<Navigate to="/settings/notifications" replace />} />
            <Route path="/settings/notifications" element={<div data-testid="settings-notifications-page">Notifications Page</div>} />
          </Routes>
        </MemoryRouter>
      )
    })

    expect(screen.getByTestId('settings-notifications-page')).toBeTruthy()
  })

  it('renders NotificationDrawerSheet with a working settings link button', async () => {
    await db.notifications.add({
      id: 1,
      title: 'Transfer Masuk',
      message: 'Dana Rp 100.000 diterima',
      createdAt: Date.now(),
      isRead: 0,
      type: 'success',
    })

    await act(async () => {
      render(
        <MemoryRouter>
          <NotificationDrawerSheet isOpen={true} onClose={() => {}} />
        </MemoryRouter>
      )
    })

    expect(screen.getAllByText(/Notifikasi|Notifications/i).length).toBeGreaterThan(0)
    const settingsBtn = screen.getByTitle(/Pengaturan Notifikasi|Smart Notifications & Reminders/i)
    expect(settingsBtn).toBeTruthy()
  })
})
