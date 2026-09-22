/**
 * Financial advice, monthly insights, and savings goal prediction service for FinTrack AI.
 */
import { getEffectiveApiKey, callApiWithFallback, CHAT_ADVISOR_MODELS } from './client'
import { buildFinancialAdvicePrompt, buildGoalPredictionPrompt } from './promptBuilder'
import { convertCurrency, formatCurrency, toSafeNumber, FALLBACK_EXCHANGE_RATES, isExcludeAnalyticsTx } from '../utils'
import { getCachedCurrencyRates } from '../api'
import useSettingsStore from '../../store/useSettingsStore'

/**
 * Generates AI financial advice and monthly spending analysis in JSON format.
 *
 * @param {Array<object>} monthData - Transactions array for the active month
 * @param {object} [context={}] - Context options
 * @param {string} [context.locale='id'] - Locale ('id' or 'en')
 * @param {string} [context.profileName=''] - User profile name
 * @returns {Promise<string>} JSON string with financial advice
 */
export async function getFinancialAdvice(monthData, context = {}) {
  const { locale = 'id', profileName = '' } = context

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(locale === 'en'
      ? 'No internet connection. AI requires an active internet connection.'
      : 'Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.')
  }
  const apiKey = getEffectiveApiKey()
  if (!apiKey) {
    throw new Error('API Key Gemini belum diset.')
  }

  const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
  const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }

  // Summarize monthData, unpacking splits and excluding non-analytics transactions
  let txSummary = ''
  if (!monthData || monthData.length === 0) {
    txSummary = 'Belum ada transaksi bulan ini.'
  } else {
    const flattenedTxs = []
    monthData.forEach((tx) => {
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        tx.splitItems.forEach((si) => {
          const itemTx = {
            ...tx,
            ...si,
            category: si.category || tx.category,
            amount: si.amount,
            type: si.type || tx.type,
            currency: si.currency || tx.currency || defaultCurrency,
            isExcludeAnalyticsTx: Boolean(si.isExcludeAnalyticsTx),
            isExcludeFromAnalytics: Boolean(si.isExcludeFromAnalytics || si.excludeFromAnalytics),
            excludeFromAnalytics: Boolean(si.excludeFromAnalytics || si.isExcludeFromAnalytics),
          }
          if (!isExcludeAnalyticsTx(itemTx)) {
            flattenedTxs.push(itemTx)
          }
        })
      } else {
        if (!isExcludeAnalyticsTx(tx)) {
          flattenedTxs.push(tx)
        }
      }
    })

    const expenses = flattenedTxs.filter((tx) => tx.type === 'expense')
    const totalExpense = expenses.reduce((acc, tx) => {
      const raw = toSafeNumber(tx.amount)
      return acc + convertCurrency(raw, tx.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)
    const income = flattenedTxs.filter((tx) => tx.type === 'income')
    const totalIncome = income.reduce((acc, tx) => {
      const raw = toSafeNumber(tx.amount)
      return acc + convertCurrency(raw, tx.currency || defaultCurrency, defaultCurrency, activeRates)
    }, 0)

    txSummary = `Total Pemasukan: ${formatCurrency(totalIncome, defaultCurrency)}\nTotal Pengeluaran: ${formatCurrency(totalExpense, defaultCurrency)}\n`

    // Group by category
    const byCategory = {}
    expenses.forEach((tx) => {
      const raw = toSafeNumber(tx.amount)
      const amt = convertCurrency(raw, tx.currency || defaultCurrency, defaultCurrency, activeRates)
      byCategory[tx.category] = (byCategory[tx.category] || 0) + amt
    })

    txSummary += '\nRincian Pengeluaran berdasarkan kategori:\n'
    Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([cat, amt]) => {
        txSummary += `- ${cat}: ${formatCurrency(amt, defaultCurrency)}\n`
      })
  }

  const sysInstruction = buildFinancialAdvicePrompt({ profileName, locale })
  const userPrompt = `Data transaksi bulan ini:\n${txSummary}\n\nBerikan analisis keuangan Anda.`

  try {
    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }]
    const response = await callApiWithFallback(contents, {
      sysInstruction,
      models: CHAT_ADVISOR_MODELS,
      temperature: 0.2,
      responseMimeType: 'application/json',
      timeoutMs: 15000,
      defaultErrorMessage: 'Gagal mendapatkan respon AI.',
    })
    return response.text
  } catch (err) {
    console.error(err)
    throw err
  }
}

export const getMonthlyFinancialInsight = getFinancialAdvice

/**
 * Evaluates savings goal trajectory and returns AI prediction JSON string.
 *
 * @param {object} goalData - Goal data object
 * @param {object} [options={}] - Options
 * @param {string} [options.locale='id'] - Locale ('id' or 'en')
 * @param {string} [options.profileName=''] - Profile name
 * @returns {Promise<string>} Prediction JSON string
 */
export async function getSavingsPrediction(goalData, { locale = 'id', profileName = '' } = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(locale === 'en'
      ? 'No internet connection. AI requires an active internet connection.'
      : 'Koneksi internet terputus. AI membutuhkan koneksi internet untuk bekerja.')
  }

  const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
  const goalCurrency = goalData.currency || defaultCurrency
  const currentAmt = Number(goalData.currentAmount || 0)
  const targetAmt = Number(goalData.targetAmount || 0)
  const isGoalReached = currentAmt >= targetAmt
  const remainingNeeded = Math.max(0, targetAmt - currentAmt)
  const safeGoalName = String(goalData.name || '').replace(/[\r\n\t]+/g, ' ').replace(/[\\"`<>]/g, '').slice(0, 40)
  const avgSavings = Number(goalData.avgSavings || 0)

  const sysInstruction = buildGoalPredictionPrompt({ profileName, locale, isGoalReached })

  const userPrompt = `Data Target Tabungan Pengguna:
- Nama Target: ${safeGoalName}
- Dana Terkumpul: ${formatCurrency(currentAmt, goalCurrency)}
- Target Dana: ${formatCurrency(targetAmt, goalCurrency)}
- Sisa Kebutuhan: ${formatCurrency(remainingNeeded, goalCurrency)}
- Status Capaian: ${isGoalReached ? 'TARGET SUDAH 100% TERCAPAI' : 'Sedang Berjalan'}
- Rata-rata tabungan bulanan (estimasi): ${formatCurrency(avgSavings, goalCurrency)}
- Tenggat Waktu (Opsional): ${goalData.deadline || 'Tidak ada'}

Berikan prediksi pencapaian tabungan ini.`

  try {
    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }]
    const response = await callApiWithFallback(contents, {
      sysInstruction,
      models: CHAT_ADVISOR_MODELS,
      temperature: 0.2,
      responseMimeType: 'application/json',
      timeoutMs: 15000,
      defaultErrorMessage: 'Gagal mendapatkan prediksi tabungan AI.',
    })
    return response.text
  } catch (err) {
    console.error(err)
    throw err
  }
}
