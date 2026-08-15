import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { CheckCircle2, RotateCcw, ArrowRight, Plus, Receipt, Wallet as WalletIcon } from 'lucide-react'
import CategoryIcon from '../ui/CategoryIcon'
import { resolveTransactionIconKey, getCategoryColorClass, getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { formatCurrency } from '../../lib/utils'
import { getWalletLogoUrl } from '../../data/walletInstitutions'
import useSettingsStore from '../../store/useSettingsStore'
import useTransactionStore from '../../store/useTransactionStore'
import useChatStore from '../../store/useChatStore'

export default function AiDigitalReceipt({
  transactions = [],
  rawPrompt = '',
  onLogAnother,
  onClose,
  wallets = [],
}) {
  const navigate = useNavigate()
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const closeQuickLog = useChatStore((s) => s.closeQuickLog)

  const [isUndone, setIsUndone] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)

  const txList = Array.isArray(transactions) ? transactions : [transactions]

  const totalExpense = txList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalIncome = txList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const netTotal = totalIncome - totalExpense

  const handleUndo = async () => {
    setIsUndoing(true)
    try {
      for (const tx of txList) {
        if (tx.id) {
          await deleteTransaction(tx.id)
        }
      }
      setIsUndone(true)
    } catch {
      // ignore
    } finally {
      setIsUndoing(false)
    }
  }

  const handleViewTransactions = () => {
    if (closeQuickLog) closeQuickLog()
    if (onClose) onClose()
    navigate('/transactions')
  }

  const getWalletInfo = (walletId) => {
    return wallets.find((w) => String(w.id) === String(walletId))
  }

  const now = new Date()
  const receiptTime = format(now, 'HH:mm')
  const receiptDate = format(now, 'dd MMMM yyyy', { locale: locale === 'en' ? enUS : idLocale })

  if (isUndone) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-250">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 mb-3">
          <RotateCcw className="h-6 w-6" />
        </div>
        <h3 className="text-base font-black text-[var(--fg)]">Pencatatan Dibatalkan</h3>
        <p className="text-xs text-[var(--muted)] mt-1 max-w-[260px]">
          Transaksi telah dihapus dari catatan keuangan Anda.
        </p>
        <button
          type="button"
          onClick={onLogAnother}
          className="ft-btn-primary mt-4 py-2.5 px-5 text-xs font-bold cursor-pointer"
        >
          Catat Transaksi Lain
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* ── Receipt Ticket Container ────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-xl">
        {/* Top Perforated Glow/Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-[var(--accent)] to-teal-500 opacity-80" />

        {/* Receipt Header */}
        <div className="p-4 pb-3 flex items-start justify-between gap-3 border-b border-[var(--border)]/60 bg-[var(--field-bg)]/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase">
                  Tercatat Sukses
                </span>
                <span className="text-[10px] text-[var(--muted)] font-bold">•</span>
                <span className="text-[10px] text-[var(--muted)] font-bold tabular-nums">{receiptTime}</span>
              </div>
              <p className="text-sm font-black text-[var(--fg)] tracking-tight">
                {txList.length > 1 ? `${txList.length} Transaksi Baru` : 'Struk Transaksi Digital'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-[var(--field-bg)] border border-[var(--border)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)]">
            <Receipt className="h-3 w-3 text-[var(--accent)]" />
            <span>FinTrack</span>
          </div>
        </div>

        {/* User Prompt Bubble Reference (if short) */}
        {rawPrompt ? (
          <div className="px-4 py-2 bg-[var(--field-bg)]/20 border-b border-[var(--border)]/40 text-[11px] text-[var(--muted)] italic truncate">
            "{rawPrompt}"
          </div>
        ) : null}

        {/* Itemized Transactions List */}
        <div className="p-3.5 space-y-2.5 max-h-56 overflow-y-auto overscroll-contain ft-hide-scrollbar">
          {txList.map((tx, idx) => {
            const iconKey = resolveTransactionIconKey(tx.category, tx.type)
            const colorClass = getCategoryColorClass(iconKey, tx.type, tx.category)
            const labels = getTransactionCategoryLabels(tx.category, tx.type, locale)
            const isIncome = tx.type === 'income'
            const walletObj = getWalletInfo(tx.walletId)
            const walletLogo = walletObj ? getWalletLogoUrl(walletObj) : null

            let txDateLabel = ''
            if (tx.date) {
              try {
                txDateLabel = format(parseISO(tx.date), 'dd MMM', { locale: locale === 'en' ? enUS : idLocale })
              } catch {
                txDateLabel = tx.date
              }
            }

            return (
              <div
                key={tx.id || idx}
                className="flex items-center justify-between gap-2.5 rounded-2xl border border-[var(--border)]/80 bg-[var(--field-bg)]/80 p-2.5 transition hover:border-[var(--border-strong)]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {/* Category Icon */}
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${colorClass} shadow-2xs`}>
                    <CategoryIcon icon={iconKey} className="h-4.5 w-4.5" />
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="truncate text-xs font-extrabold text-[var(--fg)] leading-tight">
                        {labels.main || tx.category}
                      </p>
                      {txDateLabel ? (
                        <span className="text-[9.5px] font-bold text-[var(--muted)] shrink-0 opacity-70">
                          {txDateLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)] truncate">
                      {walletObj ? (
                        <span className="flex items-center gap-1 font-bold text-[var(--fg)] shrink-0">
                          {walletLogo ? (
                            <img src={walletLogo} alt="" className="h-3 w-3 rounded-full object-contain" />
                          ) : (
                            <WalletIcon className="h-3 w-3 text-[var(--accent)]" />
                          )}
                          {walletObj.name}
                        </span>
                      ) : null}
                      {walletObj && (labels.sub || tx.notes) ? <span className="opacity-40 text-[8px]">•</span> : null}
                      {labels.sub ? <span className="truncate">{labels.sub}</span> : null}
                    </div>

                    {tx.notes ? (
                      <p className="mt-0.5 text-[10.5px] italic text-[var(--muted-2)] font-normal truncate">
                        "{tx.notes}"
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right">
                  <p
                    className={`text-xs sm:text-sm font-black tabular-nums tracking-tight ${
                      isIncome ? 'ft-income-text' : 'ft-expense-text'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {formatCurrency(Math.abs(Number(tx.amount || 0)), tx.currency || defaultCurrency)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Perforated Dashed Tear Line */}
        <div className="relative flex items-center px-2 py-1">
          <div className="absolute -left-2 h-4 w-4 rounded-full bg-[var(--bg)] border-r border-[var(--border)]" />
          <div className="w-full border-t-2 border-dashed border-[var(--border)]" />
          <div className="absolute -right-2 h-4 w-4 rounded-full bg-[var(--bg)] border-l border-[var(--border)]" />
        </div>

        {/* Receipt Summary Footer */}
        <div className="p-4 pt-2 bg-[var(--field-bg)]/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {receiptDate}
            </span>
            <p className="text-[11px] font-extrabold text-[var(--fg)]">
              {txList.length > 1 ? `Total (${txList.length} Item)` : 'Total Transaksi'}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-base font-black tabular-nums tracking-tight ${netTotal >= 0 ? 'ft-income-text' : 'ft-expense-text'}`}>
              {netTotal >= 0 ? '+' : '-'}
              {formatCurrency(Math.abs(netTotal || totalExpense || totalIncome), txList[0]?.currency || defaultCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={isUndoing}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-3 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Batalkan Pencatatan Transaksi"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Batal</span>
        </button>

        <button
          type="button"
          onClick={onLogAnother}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--field-bg)] border border-[var(--border-strong)]/40 px-4 py-3 text-xs font-black text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={3} />
          <span>Catat Transaksi Lagi</span>
        </button>

        <button
          type="button"
          onClick={handleViewTransactions}
          className="ft-btn-primary flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold cursor-pointer"
        >
          <span>Lihat Semua</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
