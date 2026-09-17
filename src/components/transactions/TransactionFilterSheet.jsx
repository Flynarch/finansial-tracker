import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Calendar, ChevronRight } from 'lucide-react'
import { ALL_TYPES } from '../../hooks/useTransactionFilters'
import { formatCategoryName, getCategoryColorClass } from '../../lib/categoryIcon'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import useTranslation from '../../hooks/useTranslation'
import useBackButton from '../../hooks/useBackButton'

export default function TransactionFilterSheet({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  userWallets = [],
  usedCategories = [],
  onOpenDatePickerModal,
}) {
  const { t, locale } = useTranslation()
  const [draftFilters, setDraftFilters] = useState(filters)
  const [activeFilterSection, setActiveFilterSection] = useState('type')
  const [draftPeriodPreset, setDraftPeriodPreset] = useState(null)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  const [prevFilters, setPrevFilters] = useState(filters)

  if (filters !== prevFilters) {
    setPrevFilters(filters)
    if (filters.startDate !== draftFilters.startDate || filters.endDate !== draftFilters.endDate) {
      setDraftFilters((p) => ({ ...p, startDate: filters.startDate, endDate: filters.endDate }))
    }
  }

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setDraftFilters(filters)
      setDraftPeriodPreset(null)
    }
  }

  useBackButton(() => {
    onClose()
  }, isOpen)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.classList.add('hide-bottom-nav')
    } else {
      document.body.style.overflow = ''
      document.body.classList.remove('hide-bottom-nav')
    }
    return () => {
      document.body.style.overflow = ''
      document.body.classList.remove('hide-bottom-nav')
    }
  }, [isOpen])

  const allWalletIds = useMemo(() => userWallets.map((w) => String(w.id)), [userWallets])
  const allCategoryKeys = useMemo(() => [...usedCategories], [usedCategories])

  if (!isOpen || typeof document === 'undefined') return null

  const getDatesForQuickRange = (rangeKey) => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const today = `${yyyy}-${mm}-${dd}`

    if (rangeKey === 'all') {
      return { startDate: '', endDate: '' }
    }
    if (rangeKey === 'today') {
      return { startDate: today, endDate: today }
    }
    if (rangeKey === 'monthly') {
      const startKey = `${yyyy}-${mm}-01`
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate()
      const endKey = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`
      return { startDate: startKey, endDate: endKey }
    }
    return { startDate: '', endDate: '' }
  }

  const toggleTypeFilter = (typeKey) => {
    const currentTypes = Array.isArray(draftFilters?.types) ? draftFilters.types : ALL_TYPES
    const isAll = currentTypes.length === ALL_TYPES.length
    let nextTypes = []

    if (typeKey === 'all') {
      nextTypes = isAll ? [] : [...ALL_TYPES]
    } else {
      const nextSet = new Set(currentTypes)
      if (nextSet.has(typeKey)) nextSet.delete(typeKey)
      else nextSet.add(typeKey)
      nextTypes = Array.from(nextSet)
    }
    setDraftFilters((p) => ({ ...p, types: nextTypes }))
  }

  const toggleWalletFilter = (walletIdKey) => {
    const currentWallets = Array.isArray(draftFilters?.walletIds) ? draftFilters.walletIds.map(String) : allWalletIds
    const isAll = userWallets.length > 0 && currentWallets.length === userWallets.length
    let nextWallets = []

    if (walletIdKey === 'all') {
      nextWallets = isAll ? [] : [...allWalletIds]
    } else {
      const targetStr = String(walletIdKey)
      const nextSet = new Set(currentWallets)
      if (nextSet.has(targetStr)) nextSet.delete(targetStr)
      else nextSet.add(targetStr)
      nextWallets = Array.from(nextSet)
    }
    setDraftFilters((p) => ({ ...p, walletIds: nextWallets }))
  }

  const toggleCategoryFilter = (catKey) => {
    const currentCats = Array.isArray(draftFilters?.categories) ? draftFilters.categories : allCategoryKeys
    const isAll = usedCategories.length > 0 && currentCats.length === usedCategories.length
    let nextCats = []

    if (catKey === 'all') {
      nextCats = isAll ? [] : [...allCategoryKeys]
    } else {
      const nextSet = new Set(currentCats)
      if (nextSet.has(catKey)) nextSet.delete(catKey)
      else nextSet.add(catKey)
      nextCats = Array.from(nextSet)
    }
    setDraftFilters((p) => ({ ...p, categories: nextCats }))
  }

  const datesMonthly = getDatesForQuickRange('monthly')
  const isPresetActive = (presetKey) => {
    if (draftPeriodPreset) return draftPeriodPreset === presetKey
    const { startDate, endDate } = getDatesForQuickRange(presetKey)
    return draftFilters.startDate === startDate && draftFilters.endDate === endDate
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative z-10 flex w-full max-h-[85svh] sm:max-w-md flex-col rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Drag handle / Header */}
        <div className="shrink-0 pt-3 pb-2 px-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            <h2 className="text-sm font-extrabold text-[var(--fg)] tracking-tight">
              {t('tx.filter.title', 'Filter Transaksi')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition cursor-pointer"
            aria-label={t('common.close', 'Tutup')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable Filters */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 ft-hide-scrollbar">
          {/* 1. Periode Tanggal */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 space-y-2.5">
            <span className="text-xs font-extrabold text-[var(--fg)] block">
              {t('tx.filter.period', 'Periode Waktu')}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: 'monthly', label: t('tx.filter.thisMonth', 'Bulan Ini') },
                { key: 'today', label: t('tx.filter.today', 'Hari Ini') },
                { key: 'all', label: t('tx.filter.allTime', 'Semua') },
                { key: 'custom', label: t('tx.filter.custom', 'Kustom') },
              ].map((preset) => {
                const isCustomActive = draftPeriodPreset === 'custom' || (!isPresetActive('monthly') && !isPresetActive('today') && !isPresetActive('all'))
                const isActive = preset.key === 'custom' ? isCustomActive : isPresetActive(preset.key)

                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      if (preset.key === 'custom') {
                        setDraftPeriodPreset('custom')
                      } else {
                        setDraftPeriodPreset(preset.key)
                        const dates = getDatesForQuickRange(preset.key)
                        setDraftFilters((p) => ({ ...p, ...dates }))
                      }
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-bold text-center transition active:scale-95 cursor-pointer border ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-xs'
                        : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Intentional Trigger Card for Custom Date Range */}
            {(draftPeriodPreset === 'custom' || (!isPresetActive('monthly') && !isPresetActive('today') && !isPresetActive('all'))) && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenDatePickerModal) onOpenDatePickerModal()
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] hover:border-[var(--accent)] transition cursor-pointer active:scale-[0.98] text-left animate-fadeIn"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block">
                      {t('tx.filter.customRange', 'Rentang Tanggal Kustom')}
                    </span>
                    <span className="text-xs font-bold text-[var(--fg)] truncate block">
                      {draftFilters?.startDate && draftFilters?.endDate
                        ? (String(locale || '').toLowerCase().startsWith('en')
                            ? `${draftFilters.startDate} to ${draftFilters.endDate}`
                            : `${draftFilters.startDate} s/d ${draftFilters.endDate}`)
                        : t('tx.filter.selectCustomDate', 'Klik untuk pilih tanggal')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--muted)] shrink-0" />
              </button>
            )}
          </div>

          {/* 2. Tipe Transaksi */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveFilterSection((prev) => (prev === 'type' ? null : 'type'))}
              className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>{t('tx.filter.type', 'Tipe Transaksi')}</span>
                {(() => {
                  const currentTypes = Array.isArray(draftFilters?.types) ? draftFilters.types : ALL_TYPES
                  const isAll = currentTypes.length === ALL_TYPES.length
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                        !isAll
                          ? 'text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] ring-1 ring-[var(--accent)]/30'
                          : 'text-[var(--muted)] bg-[var(--panel-strong)]'
                      }`}
                    >
                      {!isAll && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
                      <span>{isAll ? t('tx.filter.all', 'Semua') : `${currentTypes.length} Dipilih`}</span>
                    </span>
                  )
                })()}
              </div>
              <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${activeFilterSection === 'type' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
            </button>

            {activeFilterSection === 'type' && (
              <div className="border-t border-[var(--border)] p-2 space-y-1 bg-[var(--panel-strong)] ft-slide-in">
                {(() => {
                  const currentTypes = Array.isArray(draftFilters?.types) ? draftFilters.types : ALL_TYPES
                  const isAllChecked = currentTypes.length === ALL_TYPES.length

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleTypeFilter('all')}
                        className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                          isAllChecked
                            ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                            : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                        }`}
                      >
                        <span>{t('tx.filter.all', 'Semua')}</span>
                        <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                          isAllChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                        }`}>
                          {isAllChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </div>
                      </button>

                      {ALL_TYPES.map((typeKey) => {
                        const isChecked = currentTypes.includes(typeKey)
                        const label =
                          typeKey === 'income'
                            ? t('tx.income', 'Pemasukan')
                            : typeKey === 'expense'
                            ? t('tx.expense', 'Pengeluaran')
                            : t('tx.transfer', 'Transfer')

                        return (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => toggleTypeFilter(typeKey)}
                            className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                              isChecked
                                ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                                : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                            }`}
                          >
                            <span>{label}</span>
                            <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                              isChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                            }`}>
                              {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* 3. Akun / Dompet */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveFilterSection((prev) => (prev === 'wallet' ? null : 'wallet'))}
              className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>{t('wallets.title', 'Akun / Dompet')}</span>
                {(() => {
                  const currentWallets = Array.isArray(draftFilters?.walletIds) ? draftFilters.walletIds.map(String) : allWalletIds
                  const isAll = userWallets.length > 0 && currentWallets.length === userWallets.length
                  let label = t('tx.filter.allAccounts', 'Semua Akun')
                  if (!isAll) {
                    if (currentWallets.length === 1) {
                      const found = userWallets.find((w) => String(w.id) === currentWallets[0])
                      label = found ? found.name : '1 Dipilih'
                    } else {
                      label = `${currentWallets.length} Dipilih`
                    }
                  }
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors truncate max-w-[130px] ${
                        !isAll
                          ? 'text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] ring-1 ring-[var(--accent)]/30'
                          : 'text-[var(--muted)] bg-[var(--panel-strong)]'
                      }`}
                    >
                      {!isAll && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
                      <span className="truncate">{label}</span>
                    </span>
                  )
                })()}
              </div>
              <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${activeFilterSection === 'wallet' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
            </button>
            {activeFilterSection === 'wallet' && (
              <div className="border-t border-[var(--border)] p-2 space-y-1 bg-[var(--panel-strong)] max-h-52 overflow-y-auto overscroll-contain ft-hide-scrollbar ft-slide-in">
                {(() => {
                  const currentWallets = Array.isArray(draftFilters?.walletIds) ? draftFilters.walletIds.map(String) : allWalletIds
                  const isAllChecked = userWallets.length > 0 && currentWallets.length === userWallets.length
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleWalletFilter('all')}
                        className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                          isAllChecked
                            ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                            : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                        }`}
                      >
                        <span>{t('tx.filter.allAccounts', 'Semua Akun')}</span>
                        <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                          isAllChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                        }`}>
                          {isAllChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </div>
                      </button>
                      {userWallets.map((wallet) => {
                        const isChecked = currentWallets.includes(String(wallet.id))
                        return (
                          <button
                            key={wallet.id}
                            type="button"
                            onClick={() => toggleWalletFilter(wallet.id)}
                            className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                              isChecked
                                ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                                : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 h-5 rounded-full aspect-square bg-[var(--panel-strong)] flex items-center justify-center text-[9px] font-black border border-[var(--border)] overflow-hidden shrink-0">
                                {getWalletLogoUrl(wallet) ? (
                                  <img src={getWalletLogoUrl(wallet)} alt={wallet.name} className="w-full h-full object-cover rounded-full aspect-square" />
                                ) : (
                                  wallet.name?.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <span className="truncate">{wallet.name}</span>
                            </div>
                            <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                              isChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                            }`}>
                              {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* 4. Kategori Utama */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveFilterSection((prev) => (prev === 'category' ? null : 'category'))}
              className="flex w-full items-center justify-between px-3.5 py-3 text-left text-xs font-extrabold text-[var(--fg)] hover:bg-[var(--panel)] transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>{t('tx.filter.mainCategory', 'Kategori Utama')}</span>
                {(() => {
                  const currentCats = Array.isArray(draftFilters?.categories) ? draftFilters.categories : allCategoryKeys
                  const isAll = usedCategories.length > 0 && currentCats.length === usedCategories.length
                  let label = t('tx.filter.allCategories', 'Semua Kategori')
                  if (!isAll) {
                    if (currentCats.length === 1) {
                      label = formatCategoryName(currentCats[0], locale)
                    } else {
                      label = t('tx.filter.selectedCount', { count: currentCats.length }, `${currentCats.length} Dipilih`)
                    }
                  }
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors truncate max-w-[130px] ${
                        !isAll
                          ? 'text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] ring-1 ring-[var(--accent)]/30'
                          : 'text-[var(--muted)] bg-[var(--panel-strong)]'
                      }`}
                    >
                      {!isAll && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />}
                      <span className="truncate">{label}</span>
                    </span>
                  )
                })()}
              </div>
              <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${activeFilterSection === 'category' ? 'rotate-180 text-[var(--accent)]' : ''}`} />
            </button>
            {activeFilterSection === 'category' && (
              <div className="border-t border-[var(--border)] grid grid-cols-2 gap-1.5 p-2 bg-[var(--panel-strong)] max-h-60 overflow-y-auto overscroll-contain ft-hide-scrollbar ft-slide-in">
                {(() => {
                  const currentCats = Array.isArray(draftFilters?.categories) ? draftFilters.categories : allCategoryKeys
                  const isAllChecked = usedCategories.length > 0 && currentCats.length === usedCategories.length
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleCategoryFilter('all')}
                        className={`col-span-2 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition cursor-pointer ${
                          isAllChecked
                            ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                            : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                        }`}
                      >
                        <span>{t('tx.filter.allCategories', 'Semua Kategori')}</span>
                        <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition ${
                          isAllChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                        }`}>
                          {isAllChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </div>
                      </button>

                      {usedCategories.map((catKey) => {
                        const isChecked = currentCats.includes(catKey)
                        const catColorClass = getCategoryColorClass(catKey)
                        return (
                          <button
                            key={catKey}
                            type="button"
                            onClick={() => toggleCategoryFilter(catKey)}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold transition text-left cursor-pointer border ${
                              isChecked
                                ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--field-bg))] text-[var(--accent)]'
                                : 'border-[var(--border)]/60 text-[var(--fg)] hover:bg-[var(--field-bg)]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${catColorClass}`} />
                              <span className="truncate text-[11px]">{formatCategoryName(catKey, locale)}</span>
                            </div>
                            <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition ${
                              isChecked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'
                            }`}>
                              {isChecked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 pt-3 bg-[var(--panel-strong)] border-t border-[var(--border)] flex items-center gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-2.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
            onClick={() => {
              const resetValues = {
                search: filters.search,
                types: [...ALL_TYPES],
                walletIds: null,
                categories: null,
                startDate: datesMonthly.startDate,
                endDate: datesMonthly.endDate,
              }
              setDraftFilters(resetValues)
              onApplyFilters(resetValues)
              setDraftPeriodPreset(null)
              onClose()
            }}
          >
            {t('common.reset', 'Reset')}
          </button>
          <button
            type="button"
            className="ft-btn-primary flex-1 py-2.5 text-xs font-bold cursor-pointer"
            onClick={() => {
              if (draftFilters) {
                onApplyFilters(draftFilters)
              }
              onClose()
            }}
          >
            {t('tx.filter.apply', 'Terapkan Filter')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
