import { format } from 'date-fns'
import { createWallet } from '../../../services/walletService'
import { createTransaction as addTransaction } from '../../../services/transactionService'
import { invalidateWalletBalance } from '../../balanceEngine'
import { getCachedCurrencyRates } from '../../api'
import { convertCurrency } from '../../utils'
import { triggerHaptic } from '../../haptics'
import { validateTransferWallets } from '../aiChatHelpers'

export async function handleWalletAction(result, {
  locale,
  defaultCurrency,
  wallets = [],
}) {
  const newMsgs = []

  if (result.action === 'create') {
    const walletName = result.name || 'Dompet Baru'
    const initialBal = result.initialBalance || 0
    const rawType = (result.walletType || 'bank').toLowerCase().replace('-', '')
    const wType = ['bank', 'ewallet', 'cash', 'credit_card', 'investment', 'other'].includes(rawType) ? rawType : 'bank'
    const walletCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
      ? result.currency.trim().toUpperCase()
      : defaultCurrency
    const createdId = await createWallet({
      name: walletName,
      institutionType: wType,
      currency: walletCurrency,
      balance: initialBal,
      logoUrl: null,
      createdAt: Date.now(),
    })
    if (createdId) {
      await invalidateWalletBalance([createdId])
    }
    const balFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: walletCurrency, maximumFractionDigits: 0 }).format(initialBal)
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: { type: 'wallet', action: 'create', title: walletName, subtitle: `Saldo awal: ${balFormatted}` },
    })
  } else if (result.action === 'transfer') {
    const { isValid, fromWallet, toWallet, errorMessageKey } = validateTransferWallets(
      result.fromWalletId,
      result.toWalletId,
      wallets,
    )

    if (!isValid) {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        isError: true,
        preserveContent: true,
        content: errorMessageKey === 'missing_wallets'
          ? (locale === 'en'
              ? 'Transfer requires two different valid wallets. Please specify both source and destination wallets.'
              : 'Transfer membutuhkan dua dompet yang berbeda dan valid. Mohon tentukan dompet asal dan dompet tujuan.')
          : (locale === 'en'
              ? 'Source wallet and destination wallet cannot be the same.'
              : 'Dompet asal dan dompet tujuan transfer tidak boleh sama.'),
      })
    } else {
      const transferAmt = result.amount || 0
      const transferCurrency = fromWallet?.currency || defaultCurrency
      const targetCurrency = toWallet?.currency || transferCurrency
      const rates = getCachedCurrencyRates('USD')
      const targetAmount = convertCurrency(transferAmt, transferCurrency, targetCurrency, rates)
      const amtFormatted = new Intl.NumberFormat(locale, { style: 'currency', currency: transferCurrency, maximumFractionDigits: 0 }).format(transferAmt)

      const txToSave = {
        type: 'transfer',
        category: 'transfer/umum',
        amount: transferAmt,
        targetAmount: targetAmount,
        targetCurrency: targetCurrency,
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: `Transfer AI: ${fromWallet ? fromWallet.name : 'Dompet Asal'} ke ${toWallet ? toWallet.name : 'Dompet Tujuan'}`,
        walletId: fromWallet ? fromWallet.id : null,
        targetWalletId: toWallet ? toWallet.id : null,
        currency: transferCurrency,
        createdAt: Date.now(),
      }
      await addTransaction(txToSave)
      triggerHaptic('success')

      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'action_success',
        data: {
          type: 'wallet',
          action: 'transfer',
          title: `Transfer ${amtFormatted}`,
          subtitle: `${fromWallet ? fromWallet.name : 'Asal'} -> ${toWallet ? toWallet.name : 'Tujuan'}`,
        },
      })
    }
  }

  return newMsgs
}
