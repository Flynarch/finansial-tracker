import { useState, useMemo, useCallback, useEffect } from 'react'
import { getDecryptedNoteSync, isFieldEncrypted } from '../lib/fieldEncryption'

export const ALL_TYPES = ['income', 'expense', 'transfer']

export function computeFilteredTransactions(transactions, filters, userWalletsCount, usedCategoriesCount) {
  const activeTypes = filters?.types
  const isAllTypes = !activeTypes || (Array.isArray(activeTypes) && activeTypes.length === ALL_TYPES.length)

  const activeWalletIds = filters?.walletIds
  const isAllWallets = !activeWalletIds || (Array.isArray(activeWalletIds) && userWalletsCount > 0 && activeWalletIds.length === userWalletsCount)

  const activeCategories = filters?.categories
  const isAllCategories = !activeCategories || (Array.isArray(activeCategories) && usedCategoriesCount > 0 && activeCategories.length === usedCategoriesCount)

  const searchLower = (filters?.search || '').toLowerCase().trim()
  const startDate = filters?.startDate
  const endDate = filters?.endDate
  const activeTag = filters?.tag

  return (transactions || [])
    .filter((item) => {
      if (item?.isPendingReview === true || item?.isPendingReview === 1) return false
      if (searchLower) {
        const tagsStr = Array.isArray(item.tags) ? item.tags.join(' ') : ''
        const rawNote = item.notes
        const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
        const itemNoteText = isFieldEncrypted(plainNote) ? '' : (plainNote ?? '')
        let searchTarget = `${itemNoteText} ${item.category ?? ''} ${item.subcategory ?? ''} ${tagsStr} ${item.rawText ?? ''}`
        if (item.isSplit && Array.isArray(item.splitItems)) {
          const splitText = item.splitItems
            .map((si) => {
              const rawSi = si?.notes
              const plainSi = isFieldEncrypted(rawSi) ? getDecryptedNoteSync(rawSi) : rawSi
              const safeSi = isFieldEncrypted(plainSi) ? '' : (plainSi || '')
              return `${si?.category || ''} ${si?.subcategory || ''} ${safeSi}`
            })
            .join(' ')
          searchTarget += ` ${splitText}`
        }
        if (!searchTarget.toLowerCase().includes(searchLower)) return false
      }

      if (activeTag) {
        if (!Array.isArray(item.tags) || !item.tags.includes(activeTag)) return false
      }

      if (!isAllTypes) {
        if (!activeTypes || activeTypes.length === 0) return false
        let matchesType = activeTypes.includes(item.type)
        if (!matchesType && item.type === 'balance_adjustment') {
          const numAmt = Number(item.amount) || 0
          if (activeTypes.includes('income') && numAmt > 0) matchesType = true
          else if (activeTypes.includes('expense') && numAmt < 0) matchesType = true
        }
        if (!matchesType) return false
      }

      if (!isAllWallets) {
        if (!activeWalletIds || activeWalletIds.length === 0) return false
        const wId = String(item.walletId)
        const twId = item.targetWalletId ? String(item.targetWalletId) : null
        const matchWallet = activeWalletIds.some((id) => String(id) === wId || (twId && String(id) === twId))
        if (!matchWallet) return false
      }

      if (!isAllCategories) {
        if (!activeCategories || activeCategories.length === 0) return false
        const itemCat = item.category
          ? String(item.category).includes('/')
            ? String(item.category).split('/')[0].trim()
            : String(item.category).trim()
          : ''
        let matchCat = activeCategories.includes(itemCat)
        if (!matchCat && item.isSplit && Array.isArray(item.splitItems)) {
          matchCat = item.splitItems.some((si) => {
            const sc = si.category
              ? String(si.category).includes('/')
                ? String(si.category).split('/')[0].trim()
                : String(si.category).trim()
              : ''
            return activeCategories.includes(sc)
          })
        }
        if (!matchCat) return false
      }

      const itemDateStr = String(item.date || '').slice(0, 10)
      if (startDate && itemDateStr < startDate) return false
      if (endDate && itemDateStr > endDate) return false

      const minAmt = filters?.minAmount ? Number(filters.minAmount) : null
      const maxAmt = filters?.maxAmount ? Number(filters.maxAmount) : null
      if (minAmt !== null && Number(item.amount) < minAmt) return false
      if (maxAmt !== null && Number(item.amount) > maxAmt) return false

      return true
    })
    .sort((a, b) => {
      const byDate = String(b.date || '').localeCompare(String(a.date || ''))
      if (byDate !== 0) return byDate
      const byCreatedAt = Number(b.createdAt || 0) - Number(a.createdAt || 0)
      if (byCreatedAt !== 0) return byCreatedAt
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
}

export function useTransactionFilters(transactions = [], allWallets = []) {
  const [filters, setFiltersState] = useState(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate()
    return {
      search: '',
      types: ALL_TYPES,
      categories: null,
      walletIds: null,
      startDate: `${yyyy}-${mm}-01`,
      endDate: `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`,
      tag: '',
      minAmount: '',
      maxAmount: '',
    }
  })

  const setFilters = useCallback((updater) => {
    setFiltersState((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }))
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState({
      search: '',
      types: ALL_TYPES,
      categories: null,
      walletIds: null,
      startDate: '',
      endDate: '',
      tag: '',
      minAmount: '',
      maxAmount: '',
    })
  }, [])

  const usedCategories = useMemo(() => {
    const set = new Set()
    const addCat = (cat) => {
      if (!cat) return
      const rawCat = String(cat).trim()
      const parentCat = rawCat.includes('/') ? rawCat.split('/')[0].trim() : rawCat
      if (parentCat) set.add(parentCat)
    }

    for (const tx of transactions) {
      if (!tx || tx.isPendingReview === true || tx.isPendingReview === 1) continue
      if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
        for (const si of tx.splitItems) {
          addCat(si?.category)
        }
      }
      addCat(tx.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [transactions])

  const userWallets = useMemo(() => {
    return (allWallets || []).filter((w) => !w.isArchived)
  }, [allWallets])

  const defaultMonthStart = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }, [])

  const defaultMonthEnd = useMemo(() => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (Array.isArray(filters.types) && filters.types.length < ALL_TYPES.length) count += 1
    if (Array.isArray(filters.walletIds) && filters.walletIds.length < userWallets.length) count += 1
    if (Array.isArray(filters.categories) && filters.categories.length < usedCategories.length) count += 1
    if (filters.tag) count += 1
    if (filters.search) count += 1
    if (filters.startDate !== defaultMonthStart || filters.endDate !== defaultMonthEnd) count += 1
    if (filters.minAmount) count += 1
    if (filters.maxAmount) count += 1
    return count
  }, [filters, userWallets.length, usedCategories.length, defaultMonthStart, defaultMonthEnd])

  const [decryptedTick, setDecryptedTick] = useState(0)
  useEffect(() => {
    const handleDecrypted = () => setDecryptedTick((t) => t + 1)
    if (typeof window !== 'undefined') {
      window.addEventListener('ft-notes-decrypted', handleDecrypted)
      return () => window.removeEventListener('ft-notes-decrypted', handleDecrypted)
    }
  }, [])

  const filteredTransactions = useMemo(() => {
    void decryptedTick
    return computeFilteredTransactions(transactions, filters, userWallets.length, usedCategories.length)
  }, [transactions, filters, userWallets.length, usedCategories.length, decryptedTick])

  return {
    filters,
    setFilters,
    resetFilters,
    filteredTransactions,
    activeFilterCount,
    usedCategories,
    userWallets,
  }
}
