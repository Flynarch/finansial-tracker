import { addMonths, differenceInDays, format, parseISO, startOfMonth } from 'date-fns'

/**
 * Generate installment schedule breakdown for a loan.
 *
 * @param {object} loan Loan record from Dexie
 * @param {Array} payments List of loan payment records
 * @returns {Array} List of installments with status, amounts, and due dates
 */
export function generateInstallmentSchedule(loan, payments = []) {
  if (!loan) return []

  const totalAmount = Number(loan.totalAmount) || 0
  const explicitTenor = parseInt(loan.tenorMonths, 10) || 0
  const monthlyPayment = Number(loan.monthlyPayment) || 0

  let tenor = explicitTenor
  if (tenor <= 0) {
    if (monthlyPayment > 0 && totalAmount > 0) {
      tenor = Math.ceil(totalAmount / monthlyPayment)
    } else {
      tenor = 1
    }
  }

  const baseInstallment = monthlyPayment > 0
    ? monthlyPayment
    : (tenor > 0 ? Math.round(totalAmount / tenor) : totalAmount)

  const isFullyPaid = loan.status === 'paid' || (Number(loan.remainingAmount) <= 0 && totalAmount > 0)
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.principalAmount ?? p.amount) || 0), 0)

  let baseDate = new Date()
  if (loan.startDate) {
    try {
      baseDate = parseISO(loan.startDate)
      if (isNaN(baseDate.getTime())) baseDate = new Date()
    } catch (err){
      console.warn('[loanUtils]', err)
      baseDate = new Date()
    }
  }

  let targetDueDay = null
  let firstDueBaseDate = null
  if (loan.dueDate) {
    try {
      const parsedDue = parseISO(loan.dueDate)
      if (!isNaN(parsedDue.getTime())) {
        targetDueDay = parsedDue.getDate()
        firstDueBaseDate = parsedDue
      }
    } catch (err){
      console.warn('[loanUtils]', err)
      // ignore
    }
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  let remainingToAllocate = isFullyPaid ? Infinity : totalPaid

  let remainingPrincipal = totalAmount
  const schedule = []

  for (let i = 1; i <= tenor; i++) {
    let dueDateStr
    if (tenor === 1 && loan.dueDate) {
      dueDateStr = loan.dueDate
    } else if (targetDueDay !== null && firstDueBaseDate) {
      const targetMonthDate = addMonths(startOfMonth(firstDueBaseDate), i - 1)
      const maxDays = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate()
      const clampedDay = Math.min(targetDueDay, maxDays)
      const stepDate = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), clampedDay)
      dueDateStr = format(stepDate, 'yyyy-MM-dd')
    } else {
      dueDateStr = format(addMonths(baseDate, i), 'yyyy-MM-dd')
    }

    let instAmount
    if (i === tenor) {
      // Balance out rounding difference and remainder on the last installment
      instAmount = Math.max(0, remainingPrincipal)
    } else {
      instAmount = Math.min(baseInstallment, Math.max(0, remainingPrincipal))
    }
    remainingPrincipal = Math.max(0, remainingPrincipal - instAmount)

    let paidAmount = 0
    let remAmount = instAmount
    let status = 'unpaid'

    if (isFullyPaid || remainingToAllocate >= instAmount) {
      paidAmount = instAmount
      remAmount = 0
      status = 'paid'
      if (!isFullyPaid) {
        remainingToAllocate -= instAmount
      }
    } else if (remainingToAllocate > 0) {
      paidAmount = remainingToAllocate
      remAmount = instAmount - paidAmount
      status = 'partial'
      remainingToAllocate = 0
    }

    const isOverdue = status !== 'paid' && dueDateStr < todayStr
    let daysRemaining
    try {
      const parsedDue = parseISO(dueDateStr)
      daysRemaining = differenceInDays(parsedDue, new Date())
    } catch (err){
      console.warn('[loanUtils]', err)
      daysRemaining = 0
    }

    schedule.push({
      installmentNumber: i,
      dueDate: dueDateStr,
      amount: instAmount,
      paidAmount,
      remainingAmount: remAmount,
      status,
      isOverdue,
      daysRemaining,
    })
  }

  return schedule
}

/**
 * Summarize installment metrics for a given loan.
 *
 * @param {object} loan
 * @param {Array} payments
 * @returns {object} Summary object
 */
export function getLoanInstallmentSummary(loan, payments = []) {
  if (!loan) {
    return {
      hasInstallments: false,
      totalInstallments: 0,
      paidInstallmentsCount: 0,
      remainingInstallmentsCount: 0,
      nextInstallment: null,
      totalPaid: 0,
      totalRemaining: 0,
      isFullyPaid: true,
      isAnyOverdue: false,
      nextDueDate: null,
      nextAmount: 0,
    }
  }

  const schedule = generateInstallmentSchedule(loan, payments)
  const isFullyPaid = loan.status === 'paid' || (loan.remainingAmount !== undefined && loan.remainingAmount <= 0)
  const hasInstallments = schedule.length > 1 || Boolean(loan.tenorMonths && loan.tenorMonths > 1) || Boolean(loan.monthlyPayment && loan.monthlyPayment > 0)

  const paidCount = schedule.filter((s) => s.status === 'paid').length
  const remainingCount = isFullyPaid ? 0 : schedule.filter((s) => s.status !== 'paid').length
  const nextInstallment = isFullyPaid ? null : (schedule.find((s) => s.status !== 'paid') || null)

  const totalPaid = Array.isArray(payments) && payments.length > 0
    ? payments.reduce((sum, p) => sum + (Number(p?.principalAmount ?? p?.amount) || 0), 0)
    : Math.max(0, (Number(loan.totalAmount) || 0) - (Number(loan.remainingAmount) || 0))

  return {
    hasInstallments,
    totalInstallments: schedule.length,
    paidInstallmentsCount: isFullyPaid ? schedule.length : paidCount,
    remainingInstallmentsCount: remainingCount,
    nextInstallment,
    totalPaid,
    totalRemaining: isFullyPaid ? 0 : (Number(loan.remainingAmount) || 0),
    isFullyPaid,
    isAnyOverdue: schedule.some((s) => s.isOverdue),
    nextDueDate: nextInstallment?.dueDate || null,
    nextAmount: nextInstallment?.remainingAmount || 0,
    schedule,
  }
}

/**
 * Format installment due date with relative context.
 *
 * @param {string} dueDateStr
 * @param {string} locale
 * @returns {string} Formatted label
 */
export function formatInstallmentRelativeDate(dueDateStr, locale = 'id') {
  if (!dueDateStr) return ''

  try {
    const targetDate = parseISO(dueDateStr)
    const today = new Date()
    const days = differenceInDays(targetDate, today)

    if (days === 0) {
      return locale === 'id' ? 'Hari ini' : 'Today'
    }
    if (days === 1) {
      return locale === 'id' ? 'Besok' : 'Tomorrow'
    }
    if (days === -1) {
      return locale === 'id' ? 'Kemarin' : 'Yesterday'
    }
    if (days < -1) {
      return locale === 'id' ? `Lewat ${Math.abs(days)} hari` : `${Math.abs(days)} days overdue`
    }
    if (days <= 7) {
      return locale === 'id' ? `${days} hari lagi` : `In ${days} days`
    }
    return format(targetDate, 'dd/MM/yyyy')
  } catch (err){
      console.warn('[loanUtils]', err)
    return dueDateStr
  }
}
