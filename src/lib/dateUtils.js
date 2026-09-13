import { format } from 'date-fns'

/**
 * Returns today's date as 'yyyy-MM-dd' string in the device's local timezone.
 * Replaces `new Date().toISOString().split('T')[0]` which returns UTC date
 * and can be wrong between 00:00-06:59 WIB (UTC+7).
 */
export function getLocalDateString() {
  return format(new Date(), 'yyyy-MM-dd')
}
