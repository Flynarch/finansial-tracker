import { format } from 'date-fns'
import { db } from '../../db'
import { sanitizeCategoryPath } from '../../categorySanitizer'

export async function handleRecurringAction(result, {
  locale,
  defaultCurrency,
}) {
  const newMsgs = []
  const recurrings = await db.recurringTransactions.toArray()
  const fuzzyMatch = (str, query) => String(str || '').toLowerCase().includes(String(query || '').toLowerCase())

  if (result.action === 'create') {
    const recAmt = Number(result.amount) || 0
    const recCategory = sanitizeCategoryPath(result.category, 'expense') || 'kebutuhan_harian/umum'
    let resolvedWalletId = result.walletId
    if (!resolvedWalletId) {
      const activeWallets = await db.wallets.filter((w) => !w.isArchived).toArray()
      resolvedWalletId = activeWallets[0]?.id || 1
    }
    const today = new Date()
    const anchorDay = today.getDate()
    await db.recurringTransactions.add({
      title: result.title,
      type: 'expense',
      category: recCategory,
      amount: recAmt,
      currency: defaultCurrency,
      walletId: resolvedWalletId,
      frequency: result.frequency || 'monthly',
      nextDate: format(today, 'yyyy-MM-dd'),
      anchorDay,
      enabled: true,
      autoExecute: true,
    })
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'recurring',
        action: 'create',
        title: result.title,
        data: {
          title: result.title,
          amount: recAmt,
          frequency: result.frequency || 'monthly',
          category: recCategory,
          currency: defaultCurrency,
        },
      },
    })
  } else if (result.action === 'update' || result.action === 'delete') {
    const recTitle = (result.title || '').trim()
    if (!recTitle) {
      newMsgs.push({
        id: Date.now() + 3,
        role: 'ai',
        type: 'text',
        content: locale === 'en'
          ? `Please specify which recurring subscription you would like to ${result.action === 'delete' ? 'cancel' : 'update'}.`
          : `Mohon sebutkan langganan berulang mana yang ingin Anda ${result.action === 'delete' ? 'batalkan' : 'ubah'}.`,
      })
    } else {
      const matched = recurrings.find((r) => fuzzyMatch(r.title, recTitle))
      if (matched) {
        if (result.action === 'update') {
          const updates = {}
          if (result.amount) updates.amount = Number(result.amount)
          if (result.frequency) updates.frequency = result.frequency
          if (result.category) updates.category = sanitizeCategoryPath(result.category, 'expense') || 'kebutuhan_harian/umum'
          await db.recurringTransactions.update(matched.id, updates)
          newMsgs.push({
            id: Date.now() + 3,
            role: 'ai',
            type: 'action_success',
            data: {
              type: 'recurring',
              action: 'update',
              title: matched.title,
              data: {
                title: matched.title,
                amount: updates.amount ?? matched.amount,
                frequency: updates.frequency ?? matched.frequency,
                category: updates.category ?? matched.category,
                currency: defaultCurrency,
              },
            },
          })
        } else {
          newMsgs.push({
            id: Date.now() + 3,
            role: 'ai',
            type: 'delete_confirm',
            data: {
              id: matched.id,
              entityType: 'recurring',
              title: matched.title,
              notes: matched.title,
              amount: matched.amount,
              frequency: matched.frequency,
              category: matched.category,
              currency: defaultCurrency,
            },
            content: locale === 'en'
              ? `Are you sure you want to cancel the recurring subscription "${matched.title}"?`
              : `Apakah Anda yakin ingin membatalkan langganan berulang "${matched.title}"?`,
          })
        }
      } else {
        newMsgs.push({
          id: Date.now() + 3,
          role: 'ai',
          type: 'text',
          content: locale === 'en'
            ? `Recurring subscription "${result.title || ''}" not found.`
            : `Maaf, langganan bernama "${result.title || ''}" tidak ditemukan.`,
        })
      }
    }
  }

  return newMsgs
}
