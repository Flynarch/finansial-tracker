import { parseMoneyInput } from '../../utils'
import { maskFinancialAccountNumbers } from '../../merchantUtils'

export function parseAmountFromRegexMatch(matchedStr = '') {
  if (!matchedStr) return 0
  return parseMoneyInput(matchedStr, 'IDR')
}

/**
 * E-Wallet Regex Parsers (GoPay, OVO, DANA, ShopeePay, LinkAja)
 */
export function parseWithWalletRegex(title = '', text = '', packageName = '') {
  const combined = `${title} ${text}`.trim()
  const lowerPkg = (packageName || '').toLowerCase()

  // 1. GoPay / Gojek
  if (lowerPkg.includes('gojek') || lowerPkg.includes('gopay') || /gopay/i.test(combined)) {
    // "Pembayaran Rp35.000 ke Solaria berhasil"
    // "Kamu menerima transfer Rp100.000 dari Andi"
    const isIncome = /menerima|top up|cashback|masuk|pengembalian dana|refund|uang kembali|pengembalian saldo/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'GoPay',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 2. OVO
  if (lowerPkg.includes('ovo') || /ovo/i.test(combined)) {
    const isIncome = /top up|menerima|cashback|pengembalian dana|refund|uang kembali|pengembalian saldo/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'OVO',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 3. DANA
  const combinedWithoutFundPhrases = combined.replace(/(?:pengembalian|sumber|penerimaan|penarikan|pindah|tarik|sisa)\s+dana/gi, '')
  const isDanaBrand = ((lowerPkg.includes('dana') && !lowerPkg.includes('danamon')) ||
    /\bdana\b/i.test(combinedWithoutFundPhrases) ||
    /dana\s*kaget/i.test(combined)) && !/danamon/i.test(combined)
  if (isDanaBrand) {
    const isRefund = /(?:pengembalian dana|refund|uang kembali|pengembalian saldo)/i.test(combined)
    const isExplicitOutgoing = !isRefund && /(?:kirim uang(?!\s+diterima)|transfer ke|pembayaran|bayar|kamu telah membayar|telah membayar|berhasil dikirim(?:\s+ke)?|berhasil ditransfer(?:\s+ke)?|berhasil terkirim|terkirim(?:\s+ke)?|telah dikirim|uang keluar|kirim dana kaget)/i.test(combined)
    const isExplicitIncoming = isRefund || /(?:kirim uang diterima|isi saldo|saldo bertambah|dapat kiriman|kiriman uang|kamu menerima|menerima saldo|menerima kiriman|saldo masuk|dana masuk|dana diterima|penerimaan dana|dana kaget|dapat dana kaget|terima dana kaget|masuk ke saldo(?!\s*(?:ke\s+)?penerima)|top\s*up|cashback|saldo ditambahkan)/i.test(combined) ||
      (/(?:uang masuk)/i.test(combined) && !/(?:uang masuk ke saldo penerima|uang masuk ke rekening penerima|uang masuk ke tujuan)/i.test(combined))
    const isIncome = isRefund || (!isExplicitOutgoing && isExplicitIncoming)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'DANA',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 4. ShopeePay
  if (lowerPkg.includes('shopee') || /shopeepay/i.test(combined)) {
    const isRefund = /(?:pengembalian dana|refund|uang kembali|pengembalian saldo)/i.test(combined)
    const isIncome = isRefund || (/(?:isi saldo|menerima transfer|terima saldo|saldo masuk|top\s*up|cashback)/i.test(combined) &&
      !/(?:pembayaran|bayar|transfer ke|kirim ke)/i.test(combined))
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'ShopeePay',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  // 5. LinkAja
  if (lowerPkg.includes('linkaja') || /linkaja|link\s*aja/i.test(combined)) {
    const isRefund = /(?:pengembalian dana|refund|uang kembali|pengembalian saldo)/i.test(combined)
    const isIncome = isRefund || (/(?:isi saldo|menerima transfer|terima saldo|saldo masuk|top\s*up|cashback|uang masuk)/i.test(combined) &&
      !/(?:pembayaran|bayar|transfer ke|kirim ke|debit)/i.test(combined))
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'LinkAja',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.95,
        tier: 1,
      }
    }
  }

  return null
}
