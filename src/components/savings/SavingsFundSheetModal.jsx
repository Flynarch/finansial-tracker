import { useState, useRef, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import BottomSheet from '../ui/BottomSheet'
import WalletSelectModal, { WalletSelectTrigger } from '../ui/WalletSelectModal'
import CustomDatePicker from '../ui/CustomDatePicker'
import { db } from '../../lib/db'
import { formatMoneyInput, getMoneyInputCaret, parseMoneyInput } from '../../lib/utils'
import useSettingsStore from '../../store/useSettingsStore'
import { Plus, Minus, Calendar, FileText, Wallet, Check } from 'lucide-react'

export default function SavingsFundSheetModal({
  isOpen,
  onClose,
  goal,
  initialAction = 'add', // 'add' | 'withdraw'
  onGoalCompleted,
}) {
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [fundActionType, setFundActionType] = useState(initialAction)
  const [amountInput, setAmountInput] = useState('')
  const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notesInput, setNotesInput] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef(null)

  const wallets = useLiveQuery(() => db.wallets.toArray(), [], [])
  const selectedWallet = useMemo(() => (wallets || []).find((w) => String(w.id) === String(selectedWalletId)), [wallets, selectedWalletId])

  useEffect(() => {
    if (isOpen) {
      setFundActionType(initialAction)
      setAmountInput('')
      setDateInput(format(new Date(), 'yyyy-MM-dd'))
      setNotesInput('')
      setSelectedWalletId('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialAction])

  if (!goal) return null

  const handleSave = async () => {
    const val = parseMoneyInput(amountInput)
    if (val <= 0 || isSubmitting) return

    setIsSubmitting(true)
    try {
      const isWithdraw = fundActionType === 'withdraw'
      const currentGoalAmt = Number(goal.currentAmount || 0)
      const newGoalAmount = isWithdraw
        ? Math.max(0, currentGoalAmt - val)
        : currentGoalAmt + val

      // 1. Update goal balance
      await db.goals.update(goal.id, { currentAmount: newGoalAmount })

      // 2. Update wallet balance if selected
      const walletIdNum = Number(selectedWalletId)
      let walletObj = null
      if (walletIdNum) {
        walletObj = await db.wallets.get(walletIdNum)
        if (walletObj) {
          const currentBal = Number(walletObj.balance || 0)
          const newWalletBal = isWithdraw
            ? currentBal + val
            : Math.max(0, currentBal - val)
          await db.wallets.update(walletIdNum, { balance: newWalletBal })
        }
      }

      // 3. Add to goal logs
      const now = new Date()
      const selectedDateObj = new Date(`${dateInput}T00:00:00`)
      selectedDateObj.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      const formattedLogDate = format(selectedDateObj, 'yyyy-MM-dd HH:mm:ss')

      const logPayload = {
        goalId: goal.id,
        amount: isWithdraw ? -val : val,
        notes: notesInput.trim() || (isWithdraw ? 'Penarikan Tabungan' : 'Setoran Tabungan'),
        date: formattedLogDate,
      }
      if (walletObj) {
        logPayload.walletName = walletObj.name
      }
      await db.goalLogs.add(logPayload)

      // 4. Add transaction record if wallet was selected
      if (walletIdNum) {
        await db.transactions.add({
          date: dateInput,
          amount: val,
          type: isWithdraw ? 'income' : 'expense',
          category: 'tabungan',
          notes: notesInput.trim() || `${isWithdraw ? 'Tarik dari' : 'Setor ke'} Tabungan: ${goal.name}`,
          currency: goal.currency || defaultCurrency,
          walletId: walletIdNum,
          createdAt: Date.now(),
        })
      }

      const targetAmt = Number(goal.targetAmount || 0)
      const isTargetAchieved = !isWithdraw && targetAmt > 0 && newGoalAmount >= targetAmt

      onClose()

      if (isTargetAchieved) {
        window.setTimeout(() => {
          onGoalCompleted?.({ ...goal, currentAmount: newGoalAmount })
        }, 150)
      }
    } catch (err) {
      console.error('Failed to save savings transaction:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const currency = goal.currency || defaultCurrency

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={goal.name || 'Setor / Tarik Tabungan'}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Tab Setor vs Tarik */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
          <button
            type="button"
            onClick={() => setFundActionType('add')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
              fundActionType === 'add'
                ? 'bg-[var(--earthy-green)] text-white shadow-sm scale-[1.02]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <Plus size={14} strokeWidth={3} />
            Setor (Tambah)
          </button>
          <button
            type="button"
            onClick={() => setFundActionType('withdraw')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
              fundActionType === 'withdraw'
                ? 'bg-[var(--earthy-terra)] text-white shadow-sm scale-[1.02]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <Minus size={14} strokeWidth={3} />
            Tarik (Kurangi)
          </button>
        </div>

        {/* Amount Input */}
        <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-4 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
            {fundActionType === 'withdraw' ? 'Jumlah Penarikan' : 'Jumlah Setoran'}
          </p>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className="w-full bg-transparent text-center text-3xl font-black text-[var(--fg)] outline-none placeholder:text-[var(--muted)]/30 tabular-nums"
            placeholder="0"
            value={amountInput}
            onChange={(e) => {
              const selStart = e.target.selectionStart
              const oldVal = amountInput
              const newVal = formatMoneyInput(e.target.value, currency)
              setAmountInput(newVal)
              window.requestAnimationFrame(() => {
                if (inputRef.current) {
                  const newPos = getMoneyInputCaret(e.target.value, oldVal, newVal, selStart)
                  inputRef.current.setSelectionRange(newPos, newPos)
                }
              })
            }}
          />
        </div>

        {/* Wallet Integration Option */}
        <div className="space-y-1">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
            <Wallet className="h-3.5 w-3.5 text-[var(--accent)]" />
            {fundActionType === 'withdraw' ? 'Masuk ke Dompet (Opsional)' : 'Sumber Dompet (Opsional)'}
          </label>
          <WalletSelectTrigger
            wallet={selectedWallet}
            placeholder="Tanpa Potong Dompet (Manual Log)"
            onClick={() => setWalletModalOpen(true)}
          />
          <WalletSelectModal
            isOpen={walletModalOpen}
            onClose={() => setWalletModalOpen(false)}
            wallets={wallets}
            selectedWalletId={selectedWalletId}
            onSelectWallet={(id) => setSelectedWalletId(id)}
            allowNone
            noneLabel="Tanpa Potong Dompet (Manual Log)"
            title={fundActionType === 'withdraw' ? 'Pilih Dompet Tujuan' : 'Pilih Sumber Dompet'}
          />
        </div>

        {/* Date Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
            Tanggal Transaksi
          </label>
          <CustomDatePicker
            value={dateInput}
            onChange={(val) => setDateInput(val)}
            title="Pilih Tanggal Transaksi"
          />
        </div>

        {/* Notes Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
            Catatan (Opsional)
          </label>
          <input
            type="text"
            placeholder={fundActionType === 'withdraw' ? 'Misal: Kebutuhan mendadak' : 'Misal: Bonus kerja'}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-3 text-xs font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted)]/50"
          />
        </div>

        {/* Warning if withdrawal exceeds balance */}
        {fundActionType === 'withdraw' && parseMoneyInput(amountInput) > Number(goal.currentAmount || 0) && (
          <div className="rounded-xl border border-[var(--earthy-terra)]/30 bg-[var(--earthy-terra-soft)] p-2.5 text-center text-xs font-bold text-[var(--earthy-terra)]">
            Nominal penarikan melebihi saldo tabungan terkumpul.
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={
            !amountInput ||
            parseMoneyInput(amountInput) <= 0 ||
            isSubmitting ||
            (fundActionType === 'withdraw' && parseMoneyInput(amountInput) > Number(goal.currentAmount || 0))
          }
          onClick={handleSave}
          className={`w-full py-3.5 rounded-2xl font-black text-xs text-white shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
            fundActionType === 'withdraw'
              ? 'bg-[var(--earthy-terra)] hover:bg-[var(--earthy-terra-dark)]'
              : 'bg-[var(--earthy-green)] hover:bg-[var(--earthy-green-dark)]'
          }`}
        >
          <Check className="h-4 w-4" />
          {fundActionType === 'withdraw' ? 'Simpan Penarikan' : 'Simpan Setoran'}
        </button>
      </div>
    </BottomSheet>
  )
}
