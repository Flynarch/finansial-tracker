import { useMemo } from 'react'
import { convertCurrency, toSafeNumber } from '../../lib/utils'

export function useLoanSummary(loans = [], defaultCurrency = 'IDR', rates = {}) {
  return useMemo(() => {
    let totalDebt = 0
    let totalReceivable = 0
    let overdueCount = 0
    const today = new Date().toISOString().split('T')[0]

    for (const loan of loans || []) {
      const remaining = toSafeNumber(loan.remainingAmount ?? loan.totalAmount)
      const converted = convertCurrency(remaining, loan.currency || defaultCurrency, defaultCurrency, rates)

      if (loan.type === 'debt') {
        totalDebt += converted
      } else {
        totalReceivable += converted
      }

      if (loan.dueDate && loan.dueDate < today && remaining > 0) {
        overdueCount += 1
      }
    }

    const netLoanPosition = totalReceivable - totalDebt

    return {
      totalDebt,
      totalReceivable,
      netLoanPosition,
      overdueCount,
    }
  }, [loans, defaultCurrency, rates])
}
