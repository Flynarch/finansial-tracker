/**
 * Receipt transaction distribution, item unrolling, and financial rounding for FinTrack AI.
 */
import { sanitizeCategoryPath } from '../categorySanitizer'

/**
 * Distributes taxes, discounts, and item breakdowns across transactions for per_item mode,
 * ensuring sum(amounts) equals the actual grand total paid from user's wallet.
 *
 * @param {Array<object>} transactions - Extracted transaction list
 * @param {object} [resultMeta={}] - Receipt metadata (tax, discount, grand total, merchant, etc.)
 * @param {string} [scanMode='all'] - 'all' or 'per_item'
 * @returns {Array<object>} Reconciled transactions list
 */
export function distributeReceiptTransactions(transactions, resultMeta = {}, scanMode = 'all') {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return transactions
  }

  const zeroDecimalCurrencies = ['IDR', 'JPY', 'KRW', 'VND']
  const getCurrencyRounder = (currency) => {
    const cleanCur = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'IDR'
    const isZeroDec = zeroDecimalCurrencies.includes(cleanCur)
    return (val) => (isZeroDec ? Math.round(val) : Math.round(val * 100) / 100)
  }

  // Non per-item mode: reconcile single summary transaction's amount with grand total if tax/discount was omitted
  if (scanMode !== 'per_item') {
    if (transactions.length === 1) {
      const parent = transactions[0]
      const roundCurrency = getCurrencyRounder(parent.currency || resultMeta.currency)
      const parentTax = Number(parent.tax ?? resultMeta.tax) || 0
      const parentDiscount = Number(parent.discount ?? resultMeta.discount) || 0
      const parentAmount = Number(parent.amount) || 0
      const netAdjustment = parentTax - parentDiscount
      const itemsSum = Array.isArray(parent.items)
        ? parent.items.reduce((acc, it) => acc + (Number(it.price) || 0), 0)
        : 0
      const receiptGrandTotal = Number(resultMeta.total ?? resultMeta.grandTotal ?? parent.total ?? parent.grandTotal) || 0

      let grandTotal = parentAmount
      const parentSubtotal = Number(parent.subtotal ?? resultMeta.subtotal) || 0
      if (receiptGrandTotal > 0) {
        grandTotal = receiptGrandTotal
      } else if (netAdjustment !== 0) {
        if (parentSubtotal > 0 && Math.abs(parentAmount - (parentSubtotal + netAdjustment)) <= 0.01) {
          grandTotal = parentAmount
        } else if (parentSubtotal > 0 && Math.abs(parentAmount - parentSubtotal) <= 0.01) {
          grandTotal = Math.max(0, parentSubtotal + netAdjustment)
        } else if (itemsSum > 0) {
          if (Math.abs(parentAmount - (itemsSum + netAdjustment)) <= 0.01) {
            grandTotal = parentAmount
          } else if (Math.abs(parentAmount - itemsSum) <= 0.01) {
            grandTotal = Math.max(0, itemsSum + netAdjustment)
          }
        } else if (parentAmount > 0) {
          grandTotal = Math.max(0, parentAmount + netAdjustment)
        }
      }

      if (grandTotal > 0 && grandTotal !== parentAmount) {
        return [{
          ...parent,
          amount: roundCurrency(grandTotal),
        }]
      }
    }
    return transactions
  }

  // Case 1: 1 summary transaction containing items array -> unroll items into individual transactions
  if (transactions.length === 1 && Array.isArray(transactions[0]?.items) && transactions[0].items.length >= 1) {
    const parent = transactions[0]
    const roundCurrency = getCurrencyRounder(parent.currency || resultMeta.currency)
    const items = (parent.items || []).filter((it) => (Number(it.price) || 0) > 0)
    const itemsSum = items.reduce((acc, it) => acc + (Number(it.price) || 0), 0)
    const parentTax = Number(parent.tax ?? resultMeta.tax) || 0
    const parentDiscount = Number(parent.discount ?? resultMeta.discount) || 0
    const parentAmount = Number(parent.amount) || 0
    const netAdjustment = parentTax - parentDiscount
    const receiptGrandTotal = Number(resultMeta.total ?? resultMeta.grandTotal ?? resultMeta.amount ?? parent.total ?? parent.grandTotal) || 0
    const alreadyReflectsAdjustment =
      receiptGrandTotal > 0 && Math.abs(itemsSum - receiptGrandTotal) <= 0.01

    let grandTotal = parentAmount
    if (receiptGrandTotal > 0) {
      grandTotal = receiptGrandTotal
    } else if (grandTotal <= 0) {
      grandTotal = Math.max(0, itemsSum + netAdjustment)
    } else if (!alreadyReflectsAdjustment && netAdjustment !== 0 && grandTotal === itemsSum) {
      grandTotal = Math.max(0, itemsSum + netAdjustment)
    }

    let runningSum = 0
    const unrolled = items.map((it, idx) => {
      const rawPrice = Number(it.price) || 0
      let adjustedAmount = rawPrice
      if (grandTotal > 0 && itemsSum > 0) {
        if (idx === items.length - 1) {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal - runningSum))
        } else {
          const ratio = rawPrice / itemsSum
          adjustedAmount = Math.max(0, roundCurrency(grandTotal * ratio))
          runningSum += adjustedAmount
        }
      } else if (grandTotal > 0 && itemsSum === 0) {
        if (idx === items.length - 1) {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal - runningSum))
        } else {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal / items.length))
          runningSum += adjustedAmount
        }
      }
      return {
        type: 'expense',
        category: sanitizeCategoryPath(it.category || it.name, 'expense') || parent.category || 'kebutuhan_harian/belanja_bulanan',
        amount: adjustedAmount,
        notes: it.qty && it.qty > 1 ? `${it.name} (x${it.qty})` : it.name,
        date: parent.date,
        currency: parent.currency,
        merchant: parent.merchant || resultMeta.merchant,
        walletId: parent.walletId,
        paymentMethod: parent.paymentMethod,
        engine: parent.engine || resultMeta.engine,
        engineLabel: parent.engineLabel || resultMeta.engineLabel,
      }
    })
    return unrolled.filter((tx) => Number(tx.amount) > 0)
  }

  // Case 2: AI returned multiple transactions directly, but there is parentTax or parentDiscount to distribute
  if (transactions.length > 1) {
    const roundCurrency = getCurrencyRounder(transactions[0]?.currency || resultMeta.currency)
    const validTxs = transactions.filter((t) => (Number(t.amount) || 0) > 0)
    const totalItemAmount = validTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
    const netTax = Number(resultMeta.tax ?? transactions[0]?.tax) || 0
    const netDiscount = Number(resultMeta.discount ?? transactions[0]?.discount) || 0
    const netAdjustment = netTax - netDiscount

    const explicitGrandTotal = Number(resultMeta.total ?? resultMeta.grandTotal ?? transactions[0]?.total ?? transactions[0]?.grandTotal) || 0
    const explicitParentAmount = Number(resultMeta.amount ?? transactions[0]?.parentAmount) || 0
    const parentSubtotal = Number(resultMeta.subtotal ?? transactions[0]?.subtotal) || 0

    let grandTotal = totalItemAmount
    if (explicitGrandTotal > 0 && Math.abs(totalItemAmount - explicitGrandTotal) > 0.01) {
      grandTotal = explicitGrandTotal
    } else if (explicitParentAmount > 0 && Math.abs(explicitParentAmount - totalItemAmount) <= 0.01) {
      if (explicitGrandTotal > totalItemAmount + 0.01) {
        grandTotal = explicitGrandTotal
      } else {
        grandTotal = totalItemAmount
      }
    } else if (parentSubtotal > 0 && Math.abs(totalItemAmount - parentSubtotal) <= 0.01 && netAdjustment !== 0) {
      grandTotal = Math.max(0, totalItemAmount + netAdjustment)
    } else if (netAdjustment !== 0 && explicitGrandTotal === 0 && explicitParentAmount === 0) {
      grandTotal = Math.max(0, totalItemAmount + netAdjustment)
    }

    // If grandTotal differs from item sum, distribute grandTotal proportionally
    if (grandTotal > 0 && Math.abs(grandTotal - totalItemAmount) > 0.01 && totalItemAmount > 0 && validTxs.length > 0) {
      let runningSum = 0
      return validTxs.map((tx, idx) => {
        const rawAmt = Number(tx.amount) || 0
        let adjustedAmount
        if (idx === validTxs.length - 1) {
          adjustedAmount = Math.max(0, roundCurrency(grandTotal - runningSum))
        } else {
          const ratio = rawAmt / totalItemAmount
          adjustedAmount = Math.max(0, roundCurrency(grandTotal * ratio))
          runningSum += adjustedAmount
        }
        return {
          ...tx,
          amount: adjustedAmount,
        }
      }).filter((tx) => Number(tx.amount) > 0)
    }
    return validTxs
  }

  return transactions.filter((tx) => Number(tx.amount) > 0)
}
