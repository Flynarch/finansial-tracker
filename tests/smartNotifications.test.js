import { describe, it, expect } from 'vitest'
import { NOTIFICATION_CHANNELS } from '../src/lib/smartNotifications'

describe('smartNotifications - NOTIFICATION_CHANNELS', () => {
  it('defines valid Android notification channel keys', () => {
    expect(NOTIFICATION_CHANNELS.DAILY_REMINDER).toBe('fintrack_daily_reminder')
    expect(NOTIFICATION_CHANNELS.BUDGET_ALERTS).toBe('fintrack_budget_alerts')
    expect(NOTIFICATION_CHANNELS.BILL_REMINDERS).toBe('fintrack_bill_reminders')
  })
})
