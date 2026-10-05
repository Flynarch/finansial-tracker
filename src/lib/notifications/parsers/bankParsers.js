import { maskFinancialAccountNumbers } from '../../merchantUtils'
import { parseAmountFromRegexMatch, parseWithWalletRegex } from './walletParsers'

export { parseAmountFromRegexMatch }

/**
 * Extracts reference number, Order ID, or Transaction ID from banking notification text.
 */
export function extractTransactionRef(rawText = '') {
  if (!rawText) return null
  const match =
    rawText.match(
      /\b(?:(?:no\.?|nomor)\s*ref(?:erensi)?|ref(?:\s*no\.?)?|id\s*transaksi|transaksi\s*id|order\s*id)\s*[:#]\s*([a-zA-Z0-9_.-]+)/i
    ) ||
    rawText.match(
      /\b(?:(?:no\.?|nomor)\s*ref(?:erensi)?|ref(?:\s*no\.?)?|id\s*transaksi|transaksi\s*id|order\s*id)\s+([a-zA-Z0-9_.-]{4,})/i
    )
  return match ? match[1].trim() : null
}

/**
 * TIER 2: Token Boundary & General Currency Extractor (Fallback for other financial apps)
 */
export function parseWithTokenBoundary(title = '', text = '') {
  const combined = `${title} ${text}`.trim()
  const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)

  if (!amtMatch) return null

  const amount = parseAmountFromRegexMatch(amtMatch[1])
  if (amount <= 0) return null

  const isIncome = /(masuk|terima|diterima|inflow|cr|kredit|top\s*up|cashback|refund|pengembalian|uang kembali|pengembalian saldo)/i.test(combined)

  return {
    institution: 'Bank / E-Wallet',
    amount,
    type: isIncome ? 'income' : 'expense',
    rawDescription: combined,
    confidence: 0.8,
    tier: 2,
  }
}

/**
 * TIER 1: Deterministic Bank-Specific Regex Parsers (0ms offline, ultra-low battery)
 * Also delegates to walletParsers for e-wallets (GoPay, OVO, DANA, ShopeePay, LinkAja).
 */
export function parseWithBankRegex(title = '', text = '', packageName = '') {
  const combined = `${title} ${text}`.trim()
  const lowerPkg = (packageName || '').toLowerCase()

  // 1. BCA / myBCA / SMS BCA (excluding Blu by BCA Digital)
  if (((lowerPkg.includes('bca') && !lowerPkg.includes('blu')) || /\b(?:62)?69888\b|d-bca|m-bca|mybca|bank\s*bca/i.test(combined) || /^(?:bank\s*)?bca\b/i.test(title.trim()) || /^bca[:\s]/i.test(text.trim())) && !/blu\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|terima|(?<!kartu\s+)kredit|setoran)/i.test(combined) && !/(?:debet|db\b|keluar|kartu\s+kredit|pembayaran|transfer\s+ke|d-bca\s+db)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BCA',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 2. Mandiri / Livin / SMS Mandiri
  if (lowerPkg.includes('mandiri') || lowerPkg.includes('bmri') || lowerPkg.includes('livin') || /\b(?:62)?83355\b|livin|bank\s*mandiri/i.test(combined) || /^(?:bank\s*)?mandiri\b/i.test(title.trim()) || /^mandiri[:\s]/i.test(text.trim())) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|diterima)/i.test(combined) && !/(?:trx\s+kartu|debet\s+rek|db\b|keluar|transfer\s+ke|pembayaran)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Mandiri Livin',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 3. BRImo / BRI SMS
  if (lowerPkg.includes('bri') || /\b(?:62)?3355\b|brimo|bank\s*bri|bri-info/i.test(combined) || /^(?:bank\s*)?bri(?:-info)?\b/i.test(title.trim()) || /^bri[:\s]/i.test(text.trim())) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|setoran|dikreditkan)/i.test(combined) && !/(?:trx\s+rekening|debet|db\b|keluar|didebet|transfer\s+ke|pembayaran)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BRImo',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 4. BNI / Wondr / BNI SMS
  if ((((lowerPkg.includes('bni') || lowerPkg.includes('wondr')) && !lowerPkg.includes('cimb')) || /\b(?:62)?3300\b|wondr|bank\s*bni/i.test(combined) || /^(?:bank\s*)?bni\b/i.test(title.trim()) || /^bni[:\s]/i.test(text.trim())) && !/cimb/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|dikredit)/i.test(combined) && !/(?:debet|db\b|keluar|didebet|kartu\s+kredit|transfer\s+ke|pembayaran)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BNI',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 5. Seabank
  if (lowerPkg.includes('seabank') || /seabank|sea bank/i.test(combined)) {
    const isIncome = /(?:masuk|cr|terima|kredit|top\s*up)/i.test(combined) &&
      !/(?:keluar|transfer keluar|pembayaran|debit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Seabank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 6. Bank Jago
  if (lowerPkg.includes('jago') || /bank jago|kantong jago/i.test(combined)) {
    const isIncome = /(?:uang masuk|masuk|menerima|terima|kredit|bertambah)/i.test(combined) &&
      !/(?:uang\s+keluar|keluar|berkurang|pembayaran|transfer\s+ke|debit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Bank Jago',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 7. Blu by BCA Digital
  if (lowerPkg.includes('blu') || lowerPkg.includes('bcadigital') || /blu by bca digital|\bblu\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr|terima|kredit)/i.test(combined) &&
      !/(?:pembayaran|transfer\s+ke|qris|keluar)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Blu',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 8. Jenius (BTPN)
  if (lowerPkg.includes('jenius') || lowerPkg.includes('btpn') || /jenius|btpn/i.test(combined)) {
    const isIncome = /(?:uang masuk|masuk|inflow|terima)/i.test(combined) &&
      !/(?:money out|uang keluar|keluar|bayar|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Jenius',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 9. Bank Syariah Indonesia (BSI)
  if (lowerPkg.includes('bsi') || /bsi\s*mobile|bank syariah indonesia/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|kredit|setoran|terima|diterima)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|kirim\s+uang(?!\s+diterima)|qris|debit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'BSI',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: combined,
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 10. CIMB Niaga (OCTO Mobile / SMS CIMB)
  if (lowerPkg.includes('cimb') || lowerPkg.includes('octo') || lowerPkg.includes('cimbniaga') || /\b(?:62)?3346\b|octo\s*mobile|cimb\s*niaga|\bcimb\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|diterima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|debit|debet|didebit|kartu\s+kredit)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'CIMB Niaga',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 11. LINE Bank (PT Bank KEB Hana)
  if (lowerPkg.includes('linebank') || /line\s*bank|keb\s*hana/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|kartu\s+kredit)/i.test(combined)
    const amtMatch = combined.match(/rp\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'LINE Bank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 12. Permata / PermataBank SMS
  if (lowerPkg.includes('permata') || /\b(?:62)?1418\b|permatabank|bank\s*permata|\bpermata\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Permata',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 13. Danamon SMS
  if (lowerPkg.includes('danamon') || /\b(?:62)?3399\b|d-bank|bank\s*danamon|\bdanamon\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Danamon',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 14. Bank Mega SMS
  if (lowerPkg.includes('mega') || /\b(?:62)?3377\b|m-smile|bank\s*mega|\bmega\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Bank Mega',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 15. Citibank SMS
  if (lowerPkg.includes('citi') || /citibank|\bciti\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Citibank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 16. HSBC SMS
  if (lowerPkg.includes('hsbc') || /bank\s*hsbc|\bhsbc\b/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|(?<!kartu\s+)kredit|terima|dikredit)/i.test(combined) &&
      !/(?:keluar|pembayaran|debit|debet|didebit|kartu\s+kredit|transfer\s+ke)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'HSBC',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 17. Bank Saqu
  if (lowerPkg.includes('banksaqu') || /bank\s*saqu/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|terima|kredit|isi saldo)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|debit)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Bank Saqu',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 18. Superbank
  if (lowerPkg.includes('superbank') || /superbank/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|terima|kredit|isi saldo)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|debit)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Superbank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // 19. Allo Bank
  if (lowerPkg.includes('allobank') || /allo\s*bank/i.test(combined)) {
    const isIncome = /(?:masuk|cr\b|terima|kredit|top\s*up)/i.test(combined) &&
      !/(?:keluar|pembayaran|transfer\s+ke|qris|debit)/i.test(combined)
    const amtMatch = combined.match(/(?:rp|idr)\.?\s*([\d.,]+)/i)
    if (amtMatch) {
      const amount = parseAmountFromRegexMatch(amtMatch[1])
      return {
        institution: 'Allo Bank',
        amount,
        type: isIncome ? 'income' : 'expense',
        rawDescription: maskFinancialAccountNumbers(combined),
        confidence: 0.98,
        tier: 1,
      }
    }
  }

  // Fallback to e-wallet parsers (GoPay, OVO, DANA, ShopeePay, LinkAja)
  return parseWithWalletRegex(title, text, packageName)
}
