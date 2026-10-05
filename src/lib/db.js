import Dexie from 'dexie'
import Decimal from 'decimal.js-light'
import { convertCurrency, roundCurrency, toSafeNumber } from './utils'
import { applyMigrations } from './db/migrations'

export const db = new Dexie('fintrackDB')
applyMigrations(db)



/**
 * Compute the current balance of a wallet dynamically.
 *
 * wallet.balance = saldo awal (initial balance saat wallet dibuat).
 *
 * Current balance = saldo awal
 *   + SUM(income transactions where walletId = id)        -> +amount
 *   - SUM(expense transactions where walletId = id)       -> -amount
 *   + SUM(transfer-in: targetWalletId = id)               -> +amount
 *   - SUM(transfer-out: walletId = id AND type=transfer)  -> -amount
 *   + SUM(balance_adjustment where walletId = id)         -> +amount (already signed)
 */
/**
 * Compute the current balance of a single wallet given its initial balance and transaction list.
 * Single source of truth formula for computing a wallet's current balance.
 */
export function computeWalletBalance(wallet, transactions = [], rates = null, allWallets = []) {
  if (!wallet) return 0
  let bal = new Decimal(toSafeNumber(wallet.balance))
  const walletIdStr = String(wallet.id)
  const walletCurrency = wallet.currency || 'IDR'
  const txList = Array.isArray(transactions) ? transactions : []

  const walletCurrencyMap = new Map()
  if (Array.isArray(allWallets)) {
    for (const w of allWallets) {
      if (w?.id != null) walletCurrencyMap.set(String(w.id), w.currency || 'IDR')
    }
  }

  for (const tx of txList) {
    if (!tx || tx.deletedAt || tx.isPendingReview === true || tx.isPendingReview === 1) continue
    const amount = toSafeNumber(tx.amount)

    if (String(tx.walletId) === walletIdStr) {
      const txCurrency = tx.currency || walletCurrency
      const converted =
        txCurrency === walletCurrency
          ? amount
          : convertCurrency(amount, txCurrency, walletCurrency, rates || {})

      if (tx.type === 'income') bal = bal.plus(converted)
      else if (tx.type === 'expense') bal = bal.minus(converted)
      else if (tx.type === 'transfer') bal = bal.minus(converted)
      else if (tx.type === 'balance_adjustment') bal = bal.plus(converted)
    }

    if (String(tx.targetWalletId) === walletIdStr && tx.type === 'transfer') {
      const sourceCurrency =
        tx.currency ||
        (tx.walletId != null ? walletCurrencyMap.get(String(tx.walletId)) : null) ||
        walletCurrency
      const targetAmt = toSafeNumber(tx.targetAmount)
      const converted =
        targetAmt > 0
          ? targetAmt
          : sourceCurrency === walletCurrency
          ? amount
          : convertCurrency(amount, sourceCurrency, walletCurrency, rates || {})
      bal = bal.plus(converted)
    }
  }
  return roundCurrency(bal.toNumber())
}

/**
 * Compute current balances for ALL wallets given wallet list and transaction list.
 * Returns a List of wallets with currentBalance property attached.
 */
export function computeAllWalletBalances(wallets = [], transactions = [], rates = null, allWallets = null) {
  if (!Array.isArray(wallets) || wallets.length === 0) return []
  const balanceMap = new Map()
  const currencyMap = new Map()
  const txList = Array.isArray(transactions) ? transactions : []

  const referenceWallets = Array.isArray(allWallets) && allWallets.length > 0 ? allWallets : wallets
  for (const w of referenceWallets) {
    if (w && w.id != null) {
      currencyMap.set(String(w.id), w.currency || 'IDR')
    }
  }

  for (const w of wallets) {
    const idKey = String(w.id)
    balanceMap.set(idKey, new Decimal(toSafeNumber(w.balance)))
    if (!currencyMap.has(idKey)) {
      currencyMap.set(idKey, w.currency || 'IDR')
    }
  }

  for (const tx of txList) {
    if (!tx || tx.deletedAt || tx.isPendingReview === true || tx.isPendingReview === 1) continue
    const amount = toSafeNumber(tx.amount)
    const wId = tx.walletId != null ? String(tx.walletId) : null
    const tId = tx.targetWalletId != null ? String(tx.targetWalletId) : null

    if (wId && balanceMap.has(wId)) {
      const sourceCurrency = currencyMap.get(wId) || 'IDR'
      const txCurrency = tx.currency || sourceCurrency
      const converted =
        txCurrency === sourceCurrency
          ? amount
          : convertCurrency(amount, txCurrency, sourceCurrency, rates || {})

      const currentVal = balanceMap.get(wId)
      if (tx.type === 'income') {
        balanceMap.set(wId, currentVal.plus(converted))
      } else if (tx.type === 'expense') {
        balanceMap.set(wId, currentVal.minus(converted))
      } else if (tx.type === 'transfer') {
        balanceMap.set(wId, currentVal.minus(converted))
      } else if (tx.type === 'balance_adjustment') {
        balanceMap.set(wId, currentVal.plus(converted))
      }
    }

    if (tx.type === 'transfer' && tId && balanceMap.has(tId)) {
      const targetCurrency = currencyMap.get(tId) || 'IDR'
      const txCurrency = tx.currency || (wId ? currencyMap.get(wId) : targetCurrency) || targetCurrency
      const targetAmt = toSafeNumber(tx.targetAmount)
      const converted =
        targetAmt > 0
          ? targetAmt
          : txCurrency === targetCurrency
          ? amount
          : convertCurrency(amount, txCurrency, targetCurrency, rates || {})
      const currentTargetVal = balanceMap.get(tId)
      balanceMap.set(tId, currentTargetVal.plus(converted))
    }
  }

  return wallets.map((w) => {
    const rawBal = balanceMap.get(String(w.id))
    const num = rawBal instanceof Decimal ? rawBal.toNumber() : toSafeNumber(w.balance)
    return {
      ...w,
      currentBalance: roundCurrency(num),
    }
  })
}
