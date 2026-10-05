import { format } from 'date-fns'
import { formatCurrency } from '../../utils'
import useSettingsStore from '../../../store/useSettingsStore'
import { extractTimeSlot } from '../semanticSlotFiller'
import { findWalletInText } from './tokenizer'
import { extractDateFromPhrase } from './dateRules'
import { extractMonetaryAmountFromText } from './amountRules'

/**
 * Intelligent heuristic parser for Indonesian balance transfers, top-ups, and cash withdrawals.
 * Recognizes keywords: transfer, pindah saldo, tarik tunai, top up
 *
 * @param {string} normalizedText
 * @param {Array} [wallets]
 * @param {string} [defaultCurrency='IDR']
 * @param {Date} [referenceDate=new Date()]
 * @returns {object|null}
 */
export function parseTransferTransaction(
  normalizedText,
  wallets = [],
  defaultCurrency = 'IDR',
  referenceDate = new Date()
) {
  if (!normalizedText || typeof normalizedText !== 'string') return null
  const lower = normalizedText.toLowerCase()

  const isTransfer = /\b(transfer|tf|trf|pindah\s+saldo|pindahkan\s+saldo|geser\s+saldo)\b/i.test(lower)
  const isTarikTunai = /\b(tarik\s+tunai|tariktunai|ambil\s+tunai|tarik\s+uang|ambil\s+uang\s+di\s+atm)\b/i.test(lower)
  const isTopUp = /\b(top\s*up|topup|isi\s+saldo)\b/i.test(lower)

  if (!isTransfer && !isTarikTunai && !isTopUp) {
    return null
  }

  // Guard against analytical questions / explanations
  const isQuestion =
    /\?|^(apa|apakah|bagaimana|gimana|kenapa|mengapa|kapan|siapa|cara)\b/i.test(lower) ||
    /\b(cara\s+transfer|cara\s+tarik|cara\s+top\s*up)\b/i.test(lower)
  if (isQuestion) return null

  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date()
  const todayStr = format(ref, 'yyyy-MM-dd')
  const currentTime = format(ref, 'HH:mm')
  const timeSlot = extractTimeSlot(normalizedText, ref)
  const resolvedTime = timeSlot ? timeSlot.timeStr : currentTime
  const defaultWalletId = useSettingsStore.getState?.().defaultWalletId || wallets[0]?.id || 1

  const amt = extractMonetaryAmountFromText(lower)
  if (amt <= 0) {
    return {
      error: true,
      message:
        'Nominal transfer belum disebutkan. Silakan sertakan jumlah uangnya (contoh: "transfer 50rb dari bca ke gopay" atau "tarik tunai 100k dari bca").',
    }
  }

  if (wallets.length < 2) {
    return {
      error: true,
      message: 'Transfer saldo membutuhkan minimal 2 dompet aktif. Silakan buat dompet tujuan terlebih dahulu.',
    }
  }

  let sourceWalletId = null
  let targetWalletId = null

  if (isTarikTunai) {
    // Tarik tunai: target is physical cash
    const cashWallet =
      wallets.find(
        (w) =>
          String(w.institutionType || w.type || '').toLowerCase() === 'cash' ||
          String(w.name || '').toLowerCase().includes('cash') ||
          String(w.name || '').toLowerCase().includes('tunai')
      ) || wallets[1] || wallets[0]
    targetWalletId = cashWallet?.id || wallets[1]?.id

    // Source is the debit bank/e-wallet
    const cleanForSource = lower.replace(/\b(tarik\s+tunai|tariktunai|ambil\s+tunai|tarik\s+uang|cash|tunai)\b/gi, ' ')
    const dariMatch = cleanForSource.match(/\bdari\s+([a-zA-Z0-9_\-\s]+)/i)
    const sourceSnippet = dariMatch ? dariMatch[1] : cleanForSource
    sourceWalletId = findWalletInText(sourceSnippet, wallets, null)

    if (!sourceWalletId || String(sourceWalletId) === String(targetWalletId)) {
      const nonCash = wallets.find((w) => String(w.id) !== String(targetWalletId))
      sourceWalletId = nonCash ? nonCash.id : defaultWalletId
    }
  } else if (isTopUp) {
    // 1. Source is the funding wallet (dari/pakai/lewat/menggunakan/via)
    const dariMatch =
      lower.match(/\b(?:dari|pakai|lewat|menggunakan|via)\s+([a-zA-Z0-9_\s-]+?)(?:\s+(?:ke|sebesar|sejumlah|\d)|$)/i) ||
      lower.match(/\b(?:dari|pakai|lewat|menggunakan|via)\s+([a-zA-Z0-9_\s-]+)/i)
    if (dariMatch) {
      sourceWalletId = findWalletInText(dariMatch[1], wallets, null)
    }

    // 2. Target is destination e-wallet/account
    const cleanForTarget = lower.replace(/\b(?:dari|pakai|lewat|menggunakan|via)\s+([a-zA-Z0-9_\s-]+)/i, ' ')
    const keMatch =
      cleanForTarget.match(/\bke\s+([a-zA-Z0-9_\s-]+?)(?:\s+(?:sebesar|sejumlah|\d)|$)/i) ||
      cleanForTarget.match(/\bke\s+([a-zA-Z0-9_\s-]+)/i)
    if (keMatch) {
      targetWalletId = findWalletInText(keMatch[1], wallets, null)
    }
    if (!targetWalletId) {
      const afterTopUpMatch = cleanForTarget.match(
        /\b(?:top\s*up|topup|isi\s+saldo)\s+(?:saldo\s+)?([a-zA-Z0-9_\s-]+?)(?:\s+(?:sebesar|sejumlah|\d)|$)/i
      )
      if (afterTopUpMatch) {
        targetWalletId = findWalletInText(afterTopUpMatch[1], wallets, null)
      }
    }
    if (!targetWalletId) {
      targetWalletId = findWalletInText(cleanForTarget, wallets, null)
    }

    if (!sourceWalletId || String(sourceWalletId) === String(targetWalletId)) {
      const fallbackSource = wallets.find((w) => String(w.id) !== String(targetWalletId))
      sourceWalletId = fallbackSource ? fallbackSource.id : defaultWalletId
    }
  } else {
    // Standard transfer / pindah saldo
    const dariKeMatch = lower.match(/\bdari\s+([a-zA-Z0-9_\s-]+?)\s+ke\s+([a-zA-Z0-9_\s-]+)/i)
    const keDariMatch = lower.match(/\bke\s+([a-zA-Z0-9_\s-]+?)\s+dari\s+([a-zA-Z0-9_\s-]+)/i)

    if (dariKeMatch) {
      sourceWalletId = findWalletInText(dariKeMatch[1], wallets, null)
      targetWalletId = findWalletInText(dariKeMatch[2], wallets, null)
    } else if (keDariMatch) {
      targetWalletId = findWalletInText(keDariMatch[1], wallets, null)
      sourceWalletId = findWalletInText(keDariMatch[2], wallets, null)
    } else {
      const keOnlyMatch = lower.match(/\bke\s+([a-zA-Z0-9_\s-]+)/i)
      if (keOnlyMatch) {
        targetWalletId = findWalletInText(keOnlyMatch[1], wallets, null)
      }
      const dariOnlyMatch = lower.match(/\bdari\s+([a-zA-Z0-9_\s-]+)/i)
      if (dariOnlyMatch) {
        sourceWalletId = findWalletInText(dariOnlyMatch[1], wallets, null)
      }
      if (!sourceWalletId || !targetWalletId) {
        const simpleKeMatch =
          lower.match(/([a-zA-Z0-9_\s-]+?)\s+ke\s+([a-zA-Z0-9_\s-]+?)(?:\s+(?:sebesar|sejumlah|\d)|$)/i) ||
          lower.match(/([a-zA-Z0-9_-]+)\s+ke\s+([a-zA-Z0-9_-]+)/i)
        if (simpleKeMatch) {
          sourceWalletId = sourceWalletId || findWalletInText(simpleKeMatch[1], wallets, null)
          targetWalletId = targetWalletId || findWalletInText(simpleKeMatch[2], wallets, null)
        }
      }
    }

    if (!sourceWalletId && wallets.length > 0) {
      const configured = wallets.find((w) => w.id === defaultWalletId)
      sourceWalletId = configured ? configured.id : wallets[0].id
    }
    if (!targetWalletId) {
      const other = wallets.find((w) => String(w.id) !== String(sourceWalletId))
      targetWalletId = other ? other.id : wallets[1]?.id || defaultWalletId
    }
  }

  // Ensure source and target are not the exact same wallet
  if (String(sourceWalletId) === String(targetWalletId)) {
    const alternative = wallets.find((w) => String(w.id) !== String(sourceWalletId))
    if (alternative) {
      targetWalletId = alternative.id
    }
  }

  const dateResult = extractDateFromPhrase(normalizedText, ref)
  const resolvedDate = dateResult ? dateResult.dateStr : todayStr

  const sourceWallet = wallets.find((w) => String(w.id) === String(sourceWalletId))
  const destWallet = wallets.find((w) => String(w.id) === String(targetWalletId))
  const txCurrency = sourceWallet?.currency || defaultCurrency
  const srcName = sourceWallet?.name || 'Dompet Asal'
  const dstName = destWallet?.name || 'Dompet Tujuan'

  return {
    type: 'transactions',
    action: 'create',
    amount: amt,
    sourceWalletId: sourceWalletId,
    targetWalletId: targetWalletId,
    transactions: [
      {
        type: 'transfer',
        amount: amt,
        category: 'transfer/umum',
        currency: txCurrency,
        walletId: sourceWalletId,
        targetWalletId: targetWalletId,
        date: resolvedDate,
        time: resolvedTime,
        notes: `Transfer ${srcName} ke ${dstName}`,
      },
    ],
    currency: txCurrency,
    text: `Berhasil mencatat transfer sebesar ${formatCurrency(amt, txCurrency)} dari ${srcName} ke ${dstName}.`,
    chips: ['Catat transaksi lain', 'Lihat riwayat', 'Analisis keuangan'],
    isInstant: true,
  }
}
