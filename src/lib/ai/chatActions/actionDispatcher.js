import { handleTransactionAction } from './transactionActions'
import { handleHabitAction } from './habitActions'
import { handleSavingsAction } from './savingsActions'
import { handleTodoAction } from './todoActions'
import { handleBudgetAction } from './budgetActions'
import { handleRecurringAction } from './recurringActions'
import { handleExportAction } from './exportActions'
import { handleWalletAction } from './walletActions'
import { handleLoanAction } from './loanActions'

export async function executeAiChatAction(result, context) {
  if (!result || typeof result !== 'object') {
    return { newMsgs: [] }
  }

  if (result.type === 'financial_health') {
    return {
      isFinancialHealth: true,
      healthMsg: {
        id: context.aiMsgId,
        role: 'ai',
        type: 'financial_health',
        score: result.score,
        rating: result.rating,
        metrics: result.metrics,
        content: result.text,
        chips: result.chips,
      },
    }
  }

  const newMsgs = []

  if (result.type === 'transactions') {
    const msgs = await handleTransactionAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'habit') {
    const msgs = await handleHabitAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'savings') {
    const msgs = await handleSavingsAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'todo') {
    const msgs = await handleTodoAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'budget') {
    const msgs = await handleBudgetAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'chart') {
    newMsgs.push({
      id: Date.now() + 5,
      role: 'ai',
      type: 'chart',
      content: result.text || (result.chartType === 'income' ? 'Berikut adalah grafik rincian pemasukan Anda:' : 'Berikut adalah grafik rincian pengeluaran Anda:'),
      data: result.data,
      chips: result.chips,
      chartType: result.chartType,
    })
  } else if (result.type === 'recurring') {
    const msgs = await handleRecurringAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'export') {
    const msgs = await handleExportAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'wallet') {
    const msgs = await handleWalletAction(result, context)
    newMsgs.push(...msgs)
  } else if (result.type === 'loan' || result.type === 'loans') {
    const msgs = await handleLoanAction(result, context)
    newMsgs.push(...msgs)
  }

  return { newMsgs }
}
