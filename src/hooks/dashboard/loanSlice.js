import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { convertCurrency, toSafeNumber } from '../../lib/utils'

/**
 * Pure calculation slice for loan urgency, active debt aggregation, and payment status.
 */
export function calculateLoanSummary(loans = [], defaultCurrency = 'IDR', rates = null) {
  const safeLoans = loans ?? []
  const activeLoans = safeLoans
    .map((l) => {
      const rawRemaining =
        l.remainingAmount !== undefined && l.remainingAmount !== null && l.remainingAmount !== ''
          ? l.remainingAmount
          : l.totalAmount
      const remaining = toSafeNumber(rawRemaining)
      const total = toSafeNumber(l.totalAmount || remaining)
      const paid = Math.max(0, total - remaining)
      const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
      const val = convertCurrency(remaining, l.currency || defaultCurrency, defaultCurrency, rates)
      const isPaid = l.status === 'paid' || l.status === 'forgiven' || remaining <= 0

      let isOverdue = false
      let daysLeft = null
      if (l.dueDate && !isPaid) {
        daysLeft = differenceInCalendarDays(startOfDay(typeof l.dueDate === 'string' ? parseISO(l.dueDate) : new Date(l.dueDate)), startOfDay(new Date()))
        if (daysLeft < 0) isOverdue = true
      }

      return {
        ...l,
        remaining,
        total,
        paid,
        paidPct,
        convertedRemaining: val,
        isPaid,
        isOverdue,
        daysLeft,
      }
    })
    .filter((l) => !l.isPaid)

  const debtLoans = activeLoans.filter((l) => l.type === 'debt')
  const receivableLoans = activeLoans.filter((l) => l.type === 'receivable')

  const totalDebt = debtLoans.reduce((sum, l) => sum + l.convertedRemaining, 0)
  const totalReceivable = receivableLoans.reduce((sum, l) => sum + l.convertedRemaining, 0)

  const sortedUrgent = [...activeLoans].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1
    if (!a.isOverdue && b.isOverdue) return 1
    if (a.isOverdue && b.isOverdue) return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)

    if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft
    if (a.daysLeft !== null && b.daysLeft === null) return -1
    if (a.daysLeft === null && b.daysLeft !== null) return 1

    if (b.convertedRemaining !== a.convertedRemaining) return b.convertedRemaining - a.convertedRemaining
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })

  const mostUrgentItem = sortedUrgent[0] || null
  const netPosition = totalReceivable - totalDebt
  const totalCombined = totalReceivable + totalDebt
  const hasActiveLoans = totalCombined > 0
  const receivablePct = hasActiveLoans ? Math.round((totalReceivable / totalCombined) * 100) : 0
  const debtPct = hasActiveLoans ? 100 - receivablePct : 0

  return {
    activeLoans,
    debtLoans,
    receivableLoans,
    totalDebt,
    totalReceivable,
    debtCount: debtLoans.length,
    receivableCount: receivableLoans.length,
    netPosition,
    receivablePct,
    debtPct,
    hasActiveLoans,
    activeCount: activeLoans.length,
    mostUrgentItem,
    urgentList: sortedUrgent.slice(0, 2),
  }
}
