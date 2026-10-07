/**
 * Format wallet account type for display badge
 */
export function formatAccountType(type, name, currentLocale = 'id') {
  const rawType = String(type || '').toLowerCase().trim()
  const rawName = String(name || '').toLowerCase().trim()

  if (rawType === 'investasi' || rawType === 'investment' || rawType.includes('invest')) {
    return currentLocale === 'en' ? 'Investment' : 'Investasi'
  }
  if (
    rawType.includes('ewallet') ||
    rawType.includes('e-wallet') ||
    rawType.includes('e wallet') ||
    rawName.includes('dana') ||
    rawName.includes('gopay') ||
    rawName.includes('ovo') ||
    rawName.includes('shopee')
  ) {
    return 'E-Wallet'
  }
  if (
    rawType.includes('bank') ||
    rawName.includes('bca') ||
    rawName.includes('mandiri') ||
    rawName.includes('bni') ||
    rawName.includes('bri') ||
    rawName.includes('jago')
  ) {
    return 'Bank'
  }
  if (
    rawType.includes('cash') ||
    rawType.includes('tunai') ||
    rawName.includes('cash') ||
    rawName.includes('tunai')
  ) {
    return currentLocale === 'en' ? 'Cash' : 'Kas Fisik'
  }
  if (!type || type === 'lainnya') {
    return currentLocale === 'en' ? 'Manual Account' : 'Akun Manual'
  }
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Helper to generate 2-letter fallback initials
 */
export function getInitials(text) {
  return text ? text.substring(0, 2).toUpperCase() : ''
}
