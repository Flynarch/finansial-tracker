import { format } from 'date-fns'
import { db } from '../../db'
import { invalidateWalletBalance } from '../../balanceEngine'
import { getCachedCurrencyRates } from '../../api'
import { getLocalDateString } from '../../dateUtils'
import { triggerHaptic } from '../../haptics'
import { formatCurrency, convertCurrency } from '../../utils'

export async function handleSavingsAction(result, {
  locale,
  defaultCurrency,
  defaultWalletId,
  wallets = [],
}) {
  const newMsgs = []
  const goals = await db.goals.toArray()
  const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())

  if (result.action === 'create') {
    const targetAmt = Number(result.amount) || 0
    const goalCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
      ? result.currency.trim().toUpperCase()
      : defaultCurrency
    await db.goals.add({
      name: result.name,
      targetAmount: targetAmt,
      currentAmount: 0,
      deadline: null,
      currency: goalCurrency,
    })
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'savings',
        action: 'create',
        title: result.name,
        data: {
          title: result.name,
          targetAmount: targetAmt,
          currentAmount: 0,
          currency: goalCurrency,
        },
      },
    })
  } else if (result.action === 'add_funds') {
    const matched = goals.find((g) => fuzzyMatch(g.name, result.name))
    if (matched) {
      const depositAmt = Number(result.amount) || 0
      if (depositAmt <= 0) {
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'text',
          content: locale === 'en'
            ? 'Deposit amount must be greater than 0.'
            : 'Nominal setoran tabungan harus lebih dari 0.',
        })
      } else {
        const activeWallets = (wallets || []).filter((w) => !w.isArchived)
        let chosenWallet = null
        if (result.walletId) {
          chosenWallet = activeWallets.find((w) => w.id === Number(result.walletId)) || null
        }
        if (!chosenWallet && defaultWalletId) {
          chosenWallet = activeWallets.find((w) => w.id === Number(defaultWalletId)) || null
        }
        if (!chosenWallet) {
          chosenWallet = activeWallets.find((w) => w.institutionType === 'cash') || activeWallets[0] || null
        }

        if (!chosenWallet) {
          newMsgs.push({
            id: Date.now() + 3,
            role: 'ai',
            type: 'text',
            content: locale === 'en'
              ? 'Cannot deposit to savings: no active wallet found to debit funds from. Please create a wallet first.'
              : 'Gagal menyetor ke tabungan: tidak ditemukan dompet aktif untuk memotong saldo. Silakan buat dompet terlebih dahulu.',
          })
        } else {
          const walletIdNum = Number(chosenWallet.id)
          const inputCurrency = result.currency || matched.currency || chosenWallet?.currency || defaultCurrency
          const goalCurrency = matched.currency || defaultCurrency
          const walletCurrency = chosenWallet?.currency || defaultCurrency
          const rates = getCachedCurrencyRates('USD')
          const depositAmtInGoalCurrency = convertCurrency(depositAmt, inputCurrency, goalCurrency, rates)
          const depositAmtInWalletCurrency = convertCurrency(depositAmt, inputCurrency, walletCurrency, rates)
          const newCurrent = (matched.currentAmount || 0) + depositAmtInGoalCurrency
          const logDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

          await db.transaction('rw', [db.transactions, db.goals, db.goalLogs], async () => {
            const createdTxId = await db.transactions.add({
              date: getLocalDateString(),
              amount: depositAmtInWalletCurrency,
              type: 'expense',
              category: 'tabungan',
              notes: `Setor ke Tabungan: ${matched.name}`,
              currency: walletCurrency,
              walletId: walletIdNum,
              goalId: matched.id,
              createdAt: Date.now(),
              isExcludeFromAnalytics: true,
              excludeFromAnalytics: true,
            })

            await db.goals.update(matched.id, { currentAmount: newCurrent })
            await db.goalLogs.add({
              goalId: matched.id,
              amount: depositAmtInGoalCurrency,
              notes: 'Dicatat oleh AI',
              date: logDate,
              walletName: chosenWallet?.name || null,
              transactionId: createdTxId || null,
            })
          })
          await invalidateWalletBalance([walletIdNum])
          triggerHaptic('success')

          const walletSubtitle = locale === 'en'
            ? `Deducted from ${chosenWallet.name}`
            : `Dipotong dari dompet ${chosenWallet.name}`

          newMsgs.push({
            id: Date.now() + 3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'savings',
              action: 'add',
              title: matched.name,
              subtitle: walletSubtitle,
              data: {
                title: matched.name,
                targetAmount: matched.targetAmount,
                currentAmount: newCurrent,
                currency: matched.currency || defaultCurrency,
                walletName: chosenWallet?.name,
              },
            },
          })
        }
      }
    } else {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: locale === 'en'
          ? `Savings goal matching "${result.name || ''}" not found.`
          : `Tabungan yang mirip dengan "${result.name || ''}" tidak ditemukan.`,
      })
    }
  } else if (result.action === 'withdraw') {
    const matched = goals.find((g) => fuzzyMatch(g.name, result.name))
    if (matched) {
      const withdrawAmt = Number(result.amount) || 0
      const currentSavings = Number(matched.currentAmount) || 0
      if (withdrawAmt <= 0) {
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'text',
          content: locale === 'en'
            ? 'Withdrawal amount must be greater than 0.'
            : 'Nominal pencairan tabungan harus lebih dari 0.',
        })
      } else if (withdrawAmt > currentSavings) {
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'text',
          content: locale === 'en'
            ? `Insufficient savings in "${matched.name}". Current balance is ${formatCurrency(currentSavings, matched.currency || defaultCurrency)}.`
            : `Saldo tabungan "${matched.name}" tidak mencukupi. Saldo saat ini adalah ${formatCurrency(currentSavings, matched.currency || defaultCurrency)}.`,
        })
      } else {
        const activeWallets = (wallets || []).filter((w) => !w.isArchived)
        let chosenWallet = null
        if (result.walletId) {
          chosenWallet = activeWallets.find((w) => w.id === Number(result.walletId)) || null
        }
        if (!chosenWallet && defaultWalletId) {
          chosenWallet = activeWallets.find((w) => w.id === Number(defaultWalletId)) || null
        }
        if (!chosenWallet) {
          chosenWallet = activeWallets.find((w) => w.institutionType === 'cash') || activeWallets[0] || null
        }

        if (!chosenWallet) {
          newMsgs.push({
            id: Date.now() + 3,
            role: 'ai',
            type: 'text',
            content: locale === 'en'
              ? 'Cannot withdraw savings: no active destination wallet found. Please create a wallet first.'
              : 'Gagal mencairkan tabungan: tidak ditemukan dompet tujuan aktif. Silakan buat dompet terlebih dahulu.',
          })
        } else {
          const walletIdNum = Number(chosenWallet.id)
          const inputCurrency = result.currency || matched.currency || chosenWallet?.currency || defaultCurrency
          const goalCurrency = matched.currency || defaultCurrency
          const walletCurrency = chosenWallet?.currency || defaultCurrency
          const rates = getCachedCurrencyRates('USD')
          const withdrawAmtInGoalCurrency = convertCurrency(withdrawAmt, inputCurrency, goalCurrency, rates)
          const withdrawAmtInWalletCurrency = convertCurrency(withdrawAmt, inputCurrency, walletCurrency, rates)
          const newCurrent = Math.max(0, currentSavings - withdrawAmtInGoalCurrency)
          const logDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

          await db.transaction('rw', [db.transactions, db.goals, db.goalLogs], async () => {
            const createdTxId = await db.transactions.add({
              date: getLocalDateString(),
              amount: withdrawAmtInWalletCurrency,
              type: 'income',
              category: 'cairkan_tabungan',
              notes: `Pencairan Tabungan: ${matched.name}`,
              currency: walletCurrency,
              walletId: walletIdNum,
              goalId: matched.id,
              createdAt: Date.now(),
              isExcludeFromAnalytics: true,
              excludeFromAnalytics: true,
            })

            const targetAmt = Number(matched.targetAmount) || 0
            await db.goals.update(matched.id, {
              currentAmount: newCurrent,
              isCompleted: targetAmt > 0 ? newCurrent >= targetAmt : false,
            })
            await db.goalLogs.add({
              goalId: matched.id,
              amount: -withdrawAmtInGoalCurrency,
              notes: 'Dicatat oleh AI',
              date: logDate,
              walletName: chosenWallet?.name || null,
              transactionId: createdTxId || null,
            })
          })
          await invalidateWalletBalance([walletIdNum])
          triggerHaptic('success')

          const walletSubtitle = locale === 'en'
            ? `Deposited to ${chosenWallet.name}`
            : `Masuk ke dompet ${chosenWallet.name}`

          newMsgs.push({
            id: Date.now() + 3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'savings',
              action: 'withdraw',
              title: matched.name,
              subtitle: walletSubtitle,
              data: {
                title: matched.name,
                targetAmount: matched.targetAmount,
                currentAmount: newCurrent,
                currency: matched.currency || defaultCurrency,
                walletName: chosenWallet?.name,
              },
            },
          })
        }
      }
    } else {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: locale === 'en'
          ? `Savings goal matching "${result.name || ''}" not found.`
          : `Tabungan yang mirip dengan "${result.name || ''}" tidak ditemukan.`,
      })
    }
  }

  return newMsgs
}
