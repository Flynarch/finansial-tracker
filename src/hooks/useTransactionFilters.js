import { useState, useMemo, useCallback } from 'react'

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
      if (searchLower) {
        const tagsStr = Array.isArray(item.tags) ? item.tags.join(' ') : ''
        const searchTarget = `${item.notes ?? ''} ${item.category ?? ''} ${item.subcategory ?? ''} ${tagsStr} ${item.rawText ?? ''}`.toLowerCase()
        if (!searchTarget.includes(searchLower)) return false
      }

      if (activeTag) {
        if (!Array.isArray(item.tags) || !item.tags.includes(activeTag)) return false
      }

      if (!isAllTypes) {
        if (!activeTypes || activeTypes.length === 0 || !activeTypes.includes(item.type)) return false
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
        if (!activeCategories.includes(itemCat)) return false
      }

      if (startDate && item.date < startDate) return false
      if (endDate && item.date > endDate) return false

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
    })
  }, [])

  const usedCategories = useMemo(() => {
    const set = new Set()
    for (const tx of transactions) {
      if (!tx?.category) continue
      const rawCat = String(tx.category).trim()
      const parentCat = rawCat.includes('/') ? rawCat.split('/')[0].trim() : rawCat
      if (parentCat) set.add(parentCat)
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
    return count
  }, [filters, userWallets.length, usedCategories.length, defaultMonthStart, defaultMonthEnd])

  const filteredTransactions = useMemo(() => {
    return computeFilteredTransactions(transactions, filters, userWallets.length, usedCategories.length)
  }, [transactions, filters, userWallets.length, usedCategories.length])

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
