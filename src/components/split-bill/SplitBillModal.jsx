import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  Trash2,
  Share2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import ToastBanner from '../ui/ToastBanner'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import CustomDatePicker from '../ui/CustomDatePicker'
import CategoryIcon from '../ui/CategoryIcon'
import { db } from '../../lib/db'
import { getAllWalletBalances } from '../../lib/balanceEngine'
import { createTransaction } from '../../services/transactionService'
import { formatCurrency, formatMoneyInput, parseMoneyInput, FALLBACK_EXCHANGE_RATES } from '../../lib/utils'
import { fetchCurrencyRates, getCachedCurrencyRates } from '../../lib/api'
import { getCachedDashboardWallets } from '../../hooks/dashboard/dashboardCache'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

const QUICK_SPLIT_CATEGORIES = [
  { key: 'makanan/makan_diluar', label: 'Makanan & Resto', icon: 'food', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { key: 'kebutuhan_harian/belanja_bulanan', label: 'Belanja', icon: 'shopping', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { key: 'kultur/games', label: 'Hiburan', icon: 'entertainment', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { key: 'transportasi/bensin', label: 'Transport', icon: 'transport', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30' },
  { key: 'lainnya_kategori/umum', label: 'Lainnya', icon: 'other', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' },
]

export default function SplitBillModal({ isOpen, onClose, onSuccess }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency) || 'IDR'
  const defaultWalletId = useSettingsStore((s) => s.defaultWalletId)

  const [step, setStep] = useState(1) // 1: Info, 2: Participants, 3: Success Summary
  const [billTitle, setBillTitle] = useState('')
  const [billDate, setBillDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState('makanan/makan_diluar')
  const [totalAmountInput, setTotalAmountInput] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [walletId, setWalletId] = useState(defaultWalletId || '')
  const [splitMode, setSplitMode] = useState('equal') // 'equal' | 'custom'
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [createdSummary, setCreatedSummary] = useState(null)

  const [participants, setParticipants] = useState([
    { id: 'me', name: 'Saya (Payer)', amount: '', isPayer: true },
    { id: '1', name: 'Teman 1', amount: '', isPayer: false },
    { id: '2', name: 'Teman 2', amount: '', isPayer: false },
  ])

  const [rates, setRates] = useState(() => getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES })

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      fetchCurrencyRates('USD')
        .then((r) => r && setRates(r))
        .catch((err) => console.warn('[SplitBillModal]', err))
    }, 300)
    return () => clearTimeout(timer)
  }, [isOpen])

  const wallets = useLiveQuery(
    async () => {
      if (!isOpen) return []
      const raw = await db.wallets.filter((w) => !w.isArchived).toArray()
      if (!raw || raw.length === 0) return []
      return await getAllWalletBalances(raw, rates)
    },
    [isOpen, rates],
    getCachedDashboardWallets() || []
  )

  const selectedWallet = useMemo(() => {
    if (walletId) {
      const found = wallets?.find((w) => String(w.id) === String(walletId))
      if (found) return found
    }
    if (defaultWalletId) {
      const def = wallets?.find((w) => String(w.id) === String(defaultWalletId))
      if (def) return def
    }
    return wallets?.[0] || null
  }, [wallets, walletId, defaultWalletId])

  const activeWalletId = selectedWallet?.id || walletId || ''
  const activeCurrency = currency || selectedWallet?.currency || defaultCurrency || 'IDR'
  const parsedTotal = parseMoneyInput(totalAmountInput, activeCurrency)

  // Equal split calculation per person with exact rounding sum
  const friendShareEqual = useMemo(() => {
    if (participants.length <= 1 || parsedTotal <= 0) return 0
    return Math.floor(parsedTotal / participants.length)
  }, [parsedTotal, participants.length])

  const payerShareEqual = useMemo(() => {
    if (participants.length <= 1 || parsedTotal <= 0) return 0
    const nonPayerCount = participants.length - 1
    return parsedTotal - (friendShareEqual * nonPayerCount)
  }, [parsedTotal, participants.length, friendShareEqual])

  // Custom split sum and remainder
  const customSum = useMemo(() => {
    return participants.reduce((sum, p) => sum + parseMoneyInput(p.amount, activeCurrency), 0)
  }, [participants, activeCurrency])

  const remainingCustom = parsedTotal - customSum

  const handleAutoFillRemaining = () => {
    if (remainingCustom <= 0) return

    setParticipants((prev) => {
      // Find all participants whose amount is 0 or empty
      const zeroIndices = prev
        .map((p, idx) => ({ idx, val: parseMoneyInput(p.amount, activeCurrency) }))
        .filter((item) => item.val === 0)
        .map((item) => item.idx)

      // If there are zero-amount participants, distribute among them.
      // Otherwise, if all already have non-zero amounts, distribute among all non-payer participants.
      let targetIndices = zeroIndices
      if (targetIndices.length === 0) {
        targetIndices = prev.map((_, idx) => idx).filter((idx) => !prev[idx].isPayer)
        if (targetIndices.length === 0) {
          targetIndices = [prev.length - 1]
        }
      }

      const count = targetIndices.length
      const share = Math.floor(remainingCustom / count)
      const remainder = remainingCustom - share * count

      const targetSet = new Set(targetIndices)
      let remainderAssigned = false

      return prev.map((p, idx) => {
        if (!targetSet.has(idx)) return p

        const currentVal = parseMoneyInput(p.amount, activeCurrency)
        let addAmount = share
        if (!remainderAssigned && remainder > 0) {
          addAmount += remainder
          remainderAssigned = true
        }

        const newVal = currentVal + addAmount
        return {
          ...p,
          amount: formatMoneyInput(String(newVal), activeCurrency),
        }
      })
    })
  }

  const handleAddParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      { id: String(Date.now()), name: `Teman ${prev.length}`, amount: '', isPayer: false },
    ])
  }

  const handleRemoveParticipant = (id) => {
    if (participants.length <= 2) return
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  const handleUpdateParticipant = (id, field, val) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)),
    )
  }

  const handleCreateSplitBill = async () => {
    try {
      setErrorMsg('')
      if (!billTitle.trim()) {
        setErrorMsg('Silakan masukkan nama tagihan (misal: Makan Bersama).')
        return
      }
      if (parsedTotal <= 0) {
        setErrorMsg('Nominal total tagihan harus lebih dari 0.')
        return
      }
      if (!activeWalletId) {
        setErrorMsg('Silakan pilih dompet yang membayar.')
        return
      }

      if (splitMode === 'custom' && customSum !== parsedTotal) {
        setErrorMsg(
          `Total pembagian (${formatCurrency(customSum, activeCurrency, locale)}) harus sama dengan total tagihan (${formatCurrency(parsedTotal, activeCurrency, locale)}).`,
        )
        return
      }

      const splitBillId = `SPLIT-${Date.now()}`
      const effectiveDate = billDate || format(new Date(), 'yyyy-MM-dd')

      const payer = participants.find((p) => p.isPayer) || participants[0]
      const userShare = splitMode === 'equal'
        ? payerShareEqual
        : parseMoneyInput(payer?.amount || 0, activeCurrency)
      const friendsShare = parsedTotal - userShare

      // 1. Record transactions and loans atomically inside a Dexie transaction
      let personalTxId = null
      let friendsTxId = null
      const receivablesCreated = []

      await db.transaction(
        'rw',
        [db.transactions, db.loans, db.wallets, db.walletBalanceCache, db.budgets, db.goals, db.goalLogs, db.loanPayments, db.notifications],
        async () => {
          // User's Personal Share as Operational Expense Transaction
          if (userShare > 0) {
            personalTxId = await createTransaction({
              date: effectiveDate,
              amount: userShare,
              type: 'expense',
              category: category || 'makanan/makan_diluar',
              notes: `Split Bill (Porsi Saya): ${billTitle}`,
              currency: activeCurrency,
              walletId: Number(activeWalletId),
              tags: ['patungan', 'splitbill'],
              splitBillId,
            })
          }

          // Friends' Portion as Non-Analytic Loan Disbursement Transaction
          if (friendsShare > 0) {
            friendsTxId = await createTransaction({
              date: effectiveDate,
              amount: friendsShare,
              type: 'expense',
              category: 'Pinjaman Diberikan',
              isExcludeAnalyticsTx: true,
              excludeFromAnalytics: true,
              isExcludeFromAnalytics: true,
              splitBillId,
              notes: `Split Bill (Talangan Teman): ${billTitle}`,
              currency: activeCurrency,
              walletId: Number(activeWalletId),
              tags: ['patungan', 'splitbill', 'exclude_analytics'],
            })
          }

          // Receivable Loans for each non-payer participant
          for (let i = 0; i < participants.length; i++) {
            const p = participants[i]
            if (p.isPayer) continue
            const shareAmount = splitMode === 'equal' ? friendShareEqual : parseMoneyInput(p.amount, activeCurrency)
            if (shareAmount > 0) {
              const loanId = await db.loans.add({
                type: 'receivable', // piutang (teman berhutang pada kita)
                personName: p.name.trim(),
                title: `Patungan: ${billTitle}`,
                totalAmount: shareAmount,
                remainingAmount: shareAmount,
                currency: activeCurrency,
                startDate: effectiveDate,
                status: 'active',
                notes: `Auto-generated from Split Bill (${billTitle})`,
                walletId: Number(activeWalletId),
                initialTransactionId: friendsTxId || personalTxId,
                splitBillId,
                createdAt: Date.now(),
              })
              receivablesCreated.push({
                id: loanId,
                personName: p.name.trim(),
                amount: shareAmount,
              })
            }
          }
        }
      )

      setCreatedSummary({
        title: billTitle,
        total: parsedTotal,
        splitBillId,
        receivables: receivablesCreated,
        currency: activeCurrency,
      })

      setStep(3)
      onSuccess?.()
    } catch (err){
      console.warn('[SplitBillModal]', err)
      setErrorMsg('Gagal membuat split bill. Coba periksa kembali data Anda.')
    }
  }

  const generateWhatsAppText = (personName, amount) => {
    const text = `Halo ${personName}, ini rincian patungan untuk "${billTitle}": *${formatCurrency(amount, activeCurrency, locale)}*. Terima kasih!`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  const handleReset = () => {
    setStep(1)
    setBillTitle('')
    setBillDate(format(new Date(), 'yyyy-MM-dd'))
    setCategory('makanan/makan_diluar')
    setTotalAmountInput('')
    setCreatedSummary(null)
    setErrorMsg('')
    setParticipants([
      { id: 'me', name: 'Saya (Payer)', amount: '', isPayer: true },
      { id: '1', name: 'Teman 1', amount: '', isPayer: false },
      { id: '2', name: 'Teman 2', amount: '', isPayer: false },
    ])
  }

  return (
    <Modal
      isOpen={isOpen}
      title={step === 3 ? t('splitBill.completedTitle', 'Split Bill Selesai') : t('splitBill.modalTitle', 'Bagi Tagihan (Split Bill)')}
      onClose={() => {
        handleReset()
        onClose?.()
      }}
    >
      {/* Zero Layout Shift Error Container */}
      <div
        className={`grid transition-all duration-200 ease-out overflow-hidden ${
          errorMsg ? 'grid-rows-[1fr] opacity-100 mb-3' : 'grid-rows-[0fr] opacity-0 mb-0'
        }`}
      >
        <div className="min-h-0">
          {errorMsg ? <ToastBanner message={errorMsg} /> : null}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 block">
              {t('splitBill.titleLabel', 'Nama Tagihan / Acara')}
            </label>
            <input
              type="text"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder={t('splitBill.titlePlaceholder', 'Contoh: Makan Malam di Resto A')}
              className="w-full bg-[var(--field-bg)] rounded-xl py-2.5 px-3 text-sm font-semibold text-[var(--fg)] outline-none border border-[var(--border)] focus:border-[var(--border-strong)]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 block">
              {t('splitBill.totalAmountLabel', 'Total Tagihan')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--muted-2)] bg-[var(--field-bg)] px-3 py-2.5 rounded-xl border border-[var(--border)]">
                {activeCurrency}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={totalAmountInput}
                onChange={(e) => setTotalAmountInput(formatMoneyInput(e.target.value, activeCurrency))}
                placeholder="0"
                className="flex-1 bg-[var(--field-bg)] rounded-xl py-2.5 px-3 text-base font-extrabold text-[var(--fg)] outline-none border border-[var(--border)] focus:border-[var(--border-strong)]"
              />
            </div>
          </div>

          {/* Category Quick Selector with Icons and Color Accents */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1.5 block">
              {t('settings.category', 'Kategori')}
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_SPLIT_CATEGORIES.map((cat) => {
                const isActive = category === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-[var(--panel-strong)] border-2 border-[var(--accent)] text-[var(--fg)] shadow-xs ring-2 ring-[var(--accent)]/20'
                        : 'bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel)]'
                    }`}
                  >
                    <div className={`grid h-5 w-5 place-items-center rounded-lg border ${cat.color} shrink-0`}>
                      <CategoryIcon icon={cat.icon} className="h-3 w-3" />
                    </div>
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date & Wallet Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 block">
                {t('splitBill.dateLabel', 'Tanggal Tagihan')}
              </label>
              <div className="bg-[var(--field-bg)] rounded-xl px-0.5 border border-[var(--border)]">
                <CustomDatePicker
                  value={billDate}
                  onChange={setBillDate}
                  title={t('splitBill.selectDate', 'Pilih Tanggal Tagihan')}
                  buttonClassName="border-none bg-transparent shadow-none px-3 py-2 min-h-[42px]"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1 block">
                {t('splitBill.payerWalletLabel', 'Dompet Pembayar')}
              </label>
              <WalletSelectTrigger
                wallet={selectedWallet}
                placeholder={t('splitBill.selectWallet', 'Pilih Dompet Pembayar')}
                compact
                onClick={() => setWalletModalOpen(true)}
                className="!h-[42px] border border-[var(--border)]"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              className="w-full h-11 justify-center font-bold"
              onClick={() => {
                if (!billTitle.trim() || parsedTotal <= 0 || !activeWalletId) {
                  setErrorMsg(t('splitBill.fillAllError', 'Harap lengkapi semua data tagihan.'))
                  return
                }
                setErrorMsg('')
                setStep(2)
              }}
            >
              <span>{t('splitBill.nextToMembers', 'Lanjut ke Anggota')}</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 pt-1">
          {/* Split Mode Selector */}
          <div className="flex rounded-xl bg-[var(--field-bg)] p-1 border border-[var(--border)]">
            <button
              type="button"
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                splitMode === 'equal'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
              onClick={() => setSplitMode('equal')}
            >
              {t('splitBill.equalSplit', 'Bagi Rata (Equal)')}
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                splitMode === 'custom'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
              onClick={() => setSplitMode('custom')}
            >
              {t('splitBill.customSplit', 'Kustom Nominal')}
            </button>
          </div>

          {splitMode === 'equal' && (
            <div className="p-3 rounded-xl bg-[var(--badge-bg)] border border-[var(--badge-border)] text-xs font-semibold text-[var(--fg)] flex items-center justify-between">
              <span>{t('splitBill.sharePerFriend', 'Bagian per teman ({{count}} orang):', { count: participants.length - 1 })}</span>
              <span className="font-extrabold text-sm text-[var(--accent)]">
                {formatCurrency(friendShareEqual, activeCurrency, locale)}
              </span>
            </div>
          )}

          {splitMode === 'custom' && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                remainingCustom === 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}
            >
              <span className="truncate">
                {remainingCustom === 0
                  ? t('splitBill.exactMatch', 'Total pembagian pas')
                  : remainingCustom > 0
                  ? `${t('splitBill.remainingUnallocated', 'Sisa belum dialokasikan')}: ${formatCurrency(remainingCustom, activeCurrency, locale)}`
                  : `${t('splitBill.excess', 'Kelebihan')}: ${formatCurrency(Math.abs(remainingCustom), activeCurrency, locale)}`}
              </span>
              {remainingCustom > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFillRemaining}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-[var(--panel-strong)] text-[var(--fg)] hover:bg-[var(--panel)] text-[10.5px] font-bold shadow-xs cursor-pointer active:scale-95 transition"
                >
                  {t('splitBill.distributeRemaining', 'Bagi Rata Sisa')}
                </button>
              )}
            </div>
          )}

          {/* Participant List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]"
              >
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={p.name}
                    disabled={p.isPayer}
                    onChange={(e) => handleUpdateParticipant(p.id, 'name', e.target.value)}
                    placeholder={t('splitBill.friendName', 'Nama Teman')}
                    className="w-full bg-transparent text-xs font-bold text-[var(--fg)] outline-none"
                  />
                  {p.isPayer && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                      {t('splitBill.payerShareBadge', 'Pembayar Tagihan (Bagian: {{amount}})', {
                        amount: formatCurrency(splitMode === 'equal' ? payerShareEqual : parseMoneyInput(p.amount, activeCurrency), activeCurrency, locale)
                      })}
                    </span>
                  )}
                </div>

                {splitMode === 'custom' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={p.amount}
                    onChange={(e) =>
                      handleUpdateParticipant(p.id, 'amount', formatMoneyInput(e.target.value, activeCurrency))
                    }
                    placeholder="0"
                    className="w-24 text-right bg-[var(--panel)] py-1 px-2 rounded-lg text-xs font-bold text-[var(--fg)] border border-[var(--border)] outline-none"
                  />
                ) : (
                  <span className="text-xs font-bold text-[var(--fg)] tabular-nums">
                    {formatCurrency(p.isPayer ? payerShareEqual : friendShareEqual, activeCurrency, locale)}
                  </span>
                )}

                {!p.isPayer && (
                  <button
                    type="button"
                    disabled={participants.length <= 2}
                    onClick={() => handleRemoveParticipant(p.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      participants.length <= 2
                        ? 'text-[var(--muted-2)]/30 cursor-not-allowed'
                        : 'text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer active:scale-95'
                    }`}
                    title={participants.length <= 2 ? t('splitBill.minMembers', 'Minimal 2 orang') : t('common.delete', 'Hapus')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddParticipant}
            className="w-full py-2 border border-dashed border-[var(--border)] rounded-xl text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('splitBill.addFriend', 'Tambah Teman')}</span>
          </button>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              className="bg-[var(--field-border)] text-[var(--fg)] hover:bg-[var(--field-border-hover)]"
              onClick={() => setStep(1)}
            >
              {t('common.back', 'Kembali')}
            </Button>
            <Button
              type="button"
              className="flex-1 h-11 justify-center font-bold"
              onClick={handleCreateSplitBill}
            >
              {t('splitBill.saveAndRecord', 'Simpan & Catat Piutang')}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && createdSummary && (
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[var(--fg)]">{t('splitBill.successTitle', 'Tagihan Berhasil Dibagi!')}</h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              {t('splitBill.successDesc', 'Pengeluaran utama dicatat, dan {{count}} piutang otomatis dibuat di menu Hutang & Piutang.', {
                count: createdSummary.receivables.length
              })}
            </p>
          </div>

          {/* Share reminder to friends */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
              {t('splitBill.sendReminderWhatsApp', 'Kirim Pengingat WhatsApp')}
            </div>
            {createdSummary.receivables.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]"
              >
                <div>
                  <div className="text-xs font-bold text-[var(--fg)]">{rec.personName}</div>
                  <div className="text-[11px] text-[var(--muted)]">{formatCurrency(rec.amount, activeCurrency, locale)}</div>
                </div>
                <a
                  href={generateWhatsAppText(rec.personName, rec.amount)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              type="button"
              className="w-full h-11 justify-center font-bold"
              onClick={() => {
                handleReset()
                onClose?.()
              }}
            >
              {t('common.done', 'Selesai')}
            </Button>
          </div>
        </div>
      )}

      {/* Wallet Select Modal */}
      <WalletSelectModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        wallets={wallets}
        selectedWalletId={walletId}
        onSelectWallet={(id) => {
          setWalletId(id)
          const chosen = wallets?.find((w) => String(w.id) === String(id))
          if (chosen?.currency) setCurrency(chosen.currency)
        }}
        title={t('splitBill.selectWallet', 'Pilih Dompet Pembayar')}
      />
    </Modal>
  )
}
