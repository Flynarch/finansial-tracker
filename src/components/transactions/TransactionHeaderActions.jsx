import { Filter, MoreVertical, Search } from 'lucide-react'
import PageHeader from '../ui/PageHeader'

/**
 * Top action header component for Transactions page.
 * Manages search trigger, filter sheet trigger, and more options menu dropdown.
 */
export default function TransactionHeaderActions({
  t,
  isSearchOpen,
  onToggleSearch,
  hasSearchQuery,
  activeFilterCount = 0,
  onOpenFilter,
  isMenuOpen,
  setIsMenuOpen,
  onOpenBulkMode,
  onOpenSplitBill,
  onOpenStatementImport,
  onExportCsv,
}) {
  return (
    <PageHeader
      title={t('tx.pageTitle', 'Transaksi')}
      titlePosition="left"
      className="relative z-30 pt-1 !mb-0"
      rightAction={
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search Toggle Button */}
          <button
            type="button"
            onClick={onToggleSearch}
            className={`inline-flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
              isSearchOpen || hasSearchQuery
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)]'
            }`}
            aria-label={t('tx.search.placeholder') || 'Cari'}
            title={t('tx.search.placeholder', 'Cari Transaksi')}
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Filter Modal Trigger Button */}
          <button
            type="button"
            onClick={onOpenFilter}
            className={`relative inline-flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
              activeFilterCount > 0
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)]'
            }`}
            aria-label={t('tx.filter.open')}
            title={t('tx.filter.open', 'Filter Lengkap')}
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]" />
            )}
          </button>

          {/* 3-dots Menu */}
          <div className="relative z-50 shrink-0">
            {isMenuOpen ? (
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                aria-label={t('tx.menu.closeOverlay')}
                onClick={() => setIsMenuOpen(false)}
              />
            ) : null}
            <button
              type="button"
              className="relative z-50 inline-flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)] transition active:scale-95 cursor-pointer"
              onClick={() => setIsMenuOpen((v) => !v)}
              aria-label={t('tx.menu.open')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            <div
              className={`absolute right-0 top-12 z-50 w-52 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 shadow-[var(--shadow-card)] transition-all duration-200 ${
                isMenuOpen
                  ? 'pointer-events-auto scale-100 opacity-100'
                  : 'pointer-events-none scale-95 opacity-0'
              }`}
            >
              <button
                type="button"
                className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                onClick={() => {
                  onOpenBulkMode()
                  setIsMenuOpen(false)
                }}
              >
                {t('tx.menu.bulkEdit', 'Edit Massal (Bulk)')}
              </button>
              <button
                type="button"
                className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                onClick={() => {
                  onOpenSplitBill()
                  setIsMenuOpen(false)
                }}
              >
                {t('tx.menu.splitBill', 'Bagi Tagihan (Split Bill)')}
              </button>
              <button
                type="button"
                className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                onClick={() => {
                  onOpenStatementImport()
                  setIsMenuOpen(false)
                }}
              >
                {t('tx.menu.importStatement', 'Impor Mutasi / e-Statement')}
              </button>
              <button
                type="button"
                className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer flex items-center"
                onClick={() => {
                  onExportCsv()
                  setIsMenuOpen(false)
                }}
              >
                {t('tx.menu.exportCsv')}
              </button>
            </div>
          </div>
        </div>
      }
    />
  )
}
