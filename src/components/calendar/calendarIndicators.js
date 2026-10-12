import { format } from 'date-fns'
import { toSafeNumber } from '../../lib/utils'
import { generateInstallmentSchedule } from '../../lib/loanUtils'

function toDateOnlyString(date) {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

export function computeCalendarIndicators(
  transactions = [],
  importantEvents = [],
  loansData = {},
  todos = [],
  selectedDate = null
) {
  const map = new Map()
  const bump = (dateKey, patch) => {
    const prev = map.get(dateKey) || { income: 0, expense: 0, transfer: 0, reminder: 0 }
    map.set(dateKey, { ...prev, ...patch })
  }
  ;(transactions || []).forEach((tx) => {
    if (!tx?.date || tx.isPendingReview === true || tx.isPendingReview === 1) return
    const dateKey = String(tx.date).slice(0, 10)
    const prev = map.get(dateKey) || { income: 0, expense: 0, transfer: 0, reminder: 0 }
    let inc = 0
    let exp = 0
    let tr = 0
    if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
      tx.splitItems.forEach((si) => {
        const itemType = si.type || tx.type
        if (itemType === 'income') inc++
        else if (itemType === 'expense') exp++
        else if (itemType === 'transfer') tr++
        else if (itemType === 'balance_adjustment') {
          if (Number(si.amount || 0) >= 0) inc++
          else exp++
        }
      })
    } else {
      if (tx.type === 'income') inc++
      else if (tx.type === 'expense') exp++
      else if (tx.type === 'transfer') tr++
      else if (tx.type === 'balance_adjustment') {
        if (Number(tx.amount || 0) >= 0) inc++
        else exp++
      }
    }
    map.set(dateKey, {
      ...prev,
      income: prev.income + inc,
      expense: prev.expense + exp,
      transfer: (prev.transfer || 0) + tr,
    })
  })
  ;(importantEvents || []).forEach((ev) => {
    if (!ev?.date) return
    const dateKey = String(ev.date).slice(0, 10)
    const prev = map.get(dateKey) || { income: 0, expense: 0, transfer: 0, reminder: 0 }
    map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
  })
  for (const l of loansData?.loans || []) {
    if (
      l.status === 'paid' ||
      l.status === 'forgiven' ||
      toSafeNumber(l.remainingAmount ?? l.totalAmount) <= 0
    ) {
      continue
    }
    const tenor = parseInt(l.tenorMonths, 10) || 0
    if (tenor > 1) {
      const pmts = loansData?.paymentsByLoan?.get(l.id) || []
      const schedule = generateInstallmentSchedule(l, pmts)
      schedule.forEach((inst) => {
        if (inst.status !== 'paid' && inst.dueDate) {
          const dateKey = String(inst.dueDate).slice(0, 10)
          const prev = map.get(dateKey) || { income: 0, expense: 0, transfer: 0, reminder: 0 }
          map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
        }
      })
    } else if (l.dueDate) {
      const dateKey = String(l.dueDate).slice(0, 10)
      const prev = map.get(dateKey) || { income: 0, expense: 0, transfer: 0, reminder: 0 }
      map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
    }
  }
  ;(todos || []).forEach((td) => {
    if (!td?.dueDate) return
    const dateKey = String(td.dueDate).slice(0, 10)
    const prev = map.get(dateKey) || { income: 0, expense: 0, transfer: 0, reminder: 0 }
    map.set(dateKey, { ...prev, reminder: prev.reminder + 1 })
  })
  if (selectedDate) {
    bump(toDateOnlyString(selectedDate), {})
  }
  return map
}
