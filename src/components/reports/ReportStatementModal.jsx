import { Printer, Share2 } from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { formatCurrency } from '../../lib/utils'
import { triggerHaptic } from '../../lib/haptics'

export default function ReportStatementModal({
  isOpen,
  onClose,
  periodName,
  totalIncome = 0,
  totalExpense = 0,
  netSavings = 0,
  categories = [],
  transactions = [],
  wallets = [],
}) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const profileName = useSettingsStore((state) => state.profileName) || 'Pengguna FinTrack'

  const savingsRate =
    totalIncome > 0
      ? Math.max(0, Math.min(100, Math.round((netSavings / totalIncome) * 100)))
      : 0

  const walletMap = new Map()
  if (Array.isArray(wallets)) {
    wallets.forEach((w) => walletMap.set(String(w.id), w.name))
  }

  const handlePrint = () => {
    triggerHaptic('light')
    try {
      window.print()
    } catch {
      /* ignore */
    }
  }

  const handleShare = async () => {
    triggerHaptic('light')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Laporan Keuangan FinTrack - ${periodName}`,
          text: `Ringkasan Laporan FinTrack (${periodName}):\n- Pemasukan: ${formatCurrency(totalIncome, defaultCurrency)}\n- Pengeluaran: ${formatCurrency(totalExpense, defaultCurrency)}\n- Surplus Bersih: ${formatCurrency(netSavings, defaultCurrency)}\n- Rasio Tabungan: ${savingsRate}%`,
        })
      } catch {
        /* ignore */
      }
    }
  }

  const sortedTxs = [...(transactions || [])]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 50)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('reports.statementTitle', 'Laporan Keuangan Resmi')}
      maxWidth="max-w-xl"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Statement Header Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-4">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/60 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                Periode Laporan
              </span>
              <h4 className="text-sm font-black text-[var(--fg)]">{periodName || 'Bulan Ini'}</h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                Pemilik Akun
              </span>
              <p className="text-xs font-bold text-[var(--fg)]">{profileName}</p>
            </div>
          </div>

          {/* 4 Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2.5">
              <span className="block text-[10px] font-bold text-[var(--muted)]">Pemasukan</span>
              <span className="block text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatCurrency(totalIncome, defaultCurrency)}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2.5">
              <span className="block text-[10px] font-bold text-[var(--muted)]">Pengeluaran</span>
              <span className="block text-xs sm:text-sm font-black text-red-600 dark:text-red-400 tabular-nums truncate">
                {formatCurrency(totalExpense, defaultCurrency)}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2.5">
              <span className="block text-[10px] font-bold text-[var(--muted)]">Surplus Bersih</span>
              <span className="block text-xs sm:text-sm font-black text-[var(--fg)] tabular-nums truncate">
                {formatCurrency(netSavings, defaultCurrency)}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2.5">
              <span className="block text-[10px] font-bold text-[var(--muted)]">Rasio Simpan</span>
              <span className="block text-xs sm:text-sm font-black text-[var(--accent)] tabular-nums truncate">
                {savingsRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Categories Breakdown Preview */}
        {categories.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-4">
            <h5 className="mb-2.5 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Distribusi Kategori Utama
            </h5>
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {categories.slice(0, 6).map((cat, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[var(--fg)] mb-1">
                      <span className="truncate">{cat.name}</span>
                      <span className="tabular-nums text-[var(--muted)] shrink-0">{cat.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, cat.percent || 0))}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-black tabular-nums text-[var(--fg)] shrink-0 pl-2">
                    {formatCurrency(cat.amount, defaultCurrency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Transaction History Snapshot */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>Riwayat Transaksi</span>
            <span>{sortedTxs.length} Item</span>
          </div>

          {sortedTxs.length === 0 ? (
            <p className="py-4 text-center text-xs font-medium text-[var(--muted)]">
              Belum ada riwayat transaksi pada periode ini.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {sortedTxs.map((tx) => {
                const walletName = walletMap.get(String(tx.walletId)) || 'Dompet'
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--panel-strong)] p-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-[var(--fg)] truncate">
                        {tx.category || (tx.type === 'transfer' ? 'Transfer' : 'Transaksi')}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--muted)] truncate">
                        {tx.date} • {walletName} {tx.notes ? `• "${tx.notes}"` : ''}
                      </p>
                    </div>
                    <p
                      className={`text-xs font-black tabular-nums shrink-0 ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : tx.type === 'expense'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-[var(--fg)]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                      {formatCurrency(tx.amount, defaultCurrency)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          {typeof navigator !== 'undefined' && Boolean(navigator.share) && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-2.5 text-xs font-bold text-[var(--fg)] shadow-2xs hover:bg-[var(--panel)] active:scale-95 transition cursor-pointer"
            >
              <Share2 className="h-4 w-4 text-[var(--muted)]" />
              <span>Bagikan</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak / Simpan PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] active:scale-95 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  )
}
