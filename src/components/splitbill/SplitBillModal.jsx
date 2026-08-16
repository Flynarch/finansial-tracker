import { useState, useMemo } from 'react'
import {
  Users,
  Percent,
  Receipt,
  Copy,
  Check,
  Plus,
  Trash2,
  Wallet,
  Calculator,
  ChevronDown,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import useWalletStore from '../../store/useWalletStore'
import { db } from '../../lib/db'
import { triggerHaptic } from '../../lib/haptics'

export default function SplitBillModal({ isOpen, onClose, onTransactionCreated }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency) || 'IDR'
  const wallets = useWalletStore((state) => state.wallets) || []

  // Bill metadata
  const [billTitle, setBillTitle] = useState('')
  const [splitMode, setSplitMode] = useState('equal') // 'equal' | 'itemized'
  const [subtotal, setSubtotal] = useState('')

  // Modifiers
  const [taxPercent, setTaxPercent] = useState('10')
  const [servicePercent, setServicePercent] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [tipAmount, setTipAmount] = useState('0')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Equal split
  const [peopleCount, setPeopleCount] = useState(3)

  // Itemized split participants
  const [participants, setParticipants] = useState([
    { id: '1', name: 'Saya', amount: '' },
    { id: '2', name: 'Teman 1', amount: '' },
    { id: '3', name: 'Teman 2', amount: '' },
  ])

  // Payment note / bank info for whatsapp copy
  const [paymentNote, setPaymentNote] = useState('')
  const [copied, setCopied] = useState(false)

  // Direct logging to transaction
  const [selectedWalletId, setSelectedWalletId] = useState(() => wallets[0]?.id || '')
  const [isLoggingTx, setIsLoggingTx] = useState(false)
  const [txSuccessMessage, setTxSuccessMessage] = useState('')

  // Calculations
  const calculatedResult = useMemo(() => {
    const rawSubtotal =
      splitMode === 'equal'
        ? toSafeNumber(subtotal)
        : participants.reduce((sum, p) => sum + toSafeNumber(p.amount), 0)

    const taxVal = (rawSubtotal * toSafeNumber(taxPercent)) / 100
    const serviceVal = (rawSubtotal * toSafeNumber(servicePercent)) / 100
    const discountVal = toSafeNumber(discountAmount)
    const tipVal = toSafeNumber(tipAmount)

    const grandTotal = Math.max(0, rawSubtotal + taxVal + serviceVal + tipVal - discountVal)
    const multiplier = rawSubtotal > 0 ? grandTotal / rawSubtotal : 1

    let shares = []

    if (splitMode === 'equal') {
      const count = Math.max(1, peopleCount)
      const baseShare = Math.floor(grandTotal / count)
      const remainder = grandTotal - baseShare * count

      for (let i = 0; i < count; i++) {
        // distribute remainder cents/rupiah to early participants
        const allocated = i < remainder ? baseShare + 1 : baseShare
        shares.push({
          name: i === 0 ? 'Saya' : `Teman ${i + 1}`,
          base: rawSubtotal / count,
          total: allocated,
        })
      }
    } else {
      // Itemized proportional calculation with exact rounding remainder adjustment
      let runningSum = 0
      shares = participants.map((p, idx) => {
        const pBase = toSafeNumber(p.amount)
        let pTotal = Math.round(pBase * multiplier)
        if (idx === participants.length - 1) {
          // allocate remainder to last participant so sum === grandTotal
          pTotal = Math.max(0, grandTotal - runningSum)
        } else {
          runningSum += pTotal
        }
        return {
          id: p.id,
          name: p.name.trim() || `Orang ${idx + 1}`,
          base: pBase,
          total: pTotal,
        }
      })
    }

    return {
      rawSubtotal,
      taxVal,
      serviceVal,
      discountVal,
      tipVal,
      grandTotal,
      shares,
      myShare: shares[0]?.total || 0,
    }
  }, [splitMode, subtotal, taxPercent, servicePercent, discountAmount, tipAmount, peopleCount, participants])

  // Add participant
  const handleAddParticipant = () => {
    triggerHaptic('light')
    setParticipants((prev) => [
      ...prev,
      { id: String(Date.now()), name: `Teman ${prev.length + 1}`, amount: '' },
    ])
  }

  // Remove participant
  const handleRemoveParticipant = (id) => {
    if (participants.length <= 2) return
    triggerHaptic('light')
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  // Update participant
  const handleUpdateParticipant = (id, field, value) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    )
  }

  // Generate formatted WhatsApp text
  const handleCopyWhatsApp = async () => {
    triggerHaptic('medium')
    const title = billTitle.trim() || 'Patungan / Split Bill'
    let text = `*Rincian ${title}*\n`
    text += `Total Tagihan: ${formatCurrency(calculatedResult.grandTotal, defaultCurrency, locale)}\n`
    text += `Subtotal: ${formatCurrency(calculatedResult.rawSubtotal, defaultCurrency, locale)}\n`
    if (calculatedResult.taxVal > 0) text += `Pajak (${taxPercent}%): ${formatCurrency(calculatedResult.taxVal, defaultCurrency, locale)}\n`
    if (calculatedResult.serviceVal > 0) text += `Service: ${formatCurrency(calculatedResult.serviceVal, defaultCurrency, locale)}\n`
    if (calculatedResult.discountVal > 0) text += `Diskon: -${formatCurrency(calculatedResult.discountVal, defaultCurrency, locale)}\n`
    text += `\n*Pembagian per orang:*\n`

    calculatedResult.shares.forEach((s) => {
      text += `- *${s.name}*: ${formatCurrency(s.total, defaultCurrency, locale)}\n`
    })

    if (paymentNote.trim()) {
      text += `\nTransfer ke:\n${paymentNote.trim()}\n`
    }
    text += `\n_Dihitung dengan FinTrack_`

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  // Log "My Share" directly to FinTrack transactions
  const handleLogMyShare = async () => {
    if (calculatedResult.myShare <= 0) return
    triggerHaptic('success')
    setIsLoggingTx(true)
    try {
      const now = new Date()
      const tx = {
        date: now.toISOString().slice(0, 10),
        createdAt: now.toISOString(),
        type: 'expense',
        category: 'Makanan & Minuman',
        amount: calculatedResult.myShare,
        currency: defaultCurrency,
        notes: billTitle.trim() ? `Split bill: ${billTitle.trim()}` : 'Split bill / Patungan',
        walletId: selectedWalletId ? Number(selectedWalletId) : (wallets[0]?.id ? Number(wallets[0].id) : null),
      }

      await db.transactions.add(tx)
      setTxSuccessMessage('Porsi Anda berhasil dicatat ke transaksi!')
      if (onTransactionCreated) onTransactionCreated(tx)
      setTimeout(() => setTxSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Failed to log split bill tx', err)
    } finally {
      setIsLoggingTx(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
            <Calculator className="h-4 w-4 stroke-[2.2]" />
          </div>
          <span className="text-base font-black text-[var(--fg)] tracking-tight">Kalkulator Bagi Tagihan</span>
        </div>
      }
      className="max-w-lg"
    >
      <div className="space-y-4 pt-1 pb-2">
        {/* Bill Title & Mode Switcher */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
              Nama Tagihan / Acara
            </label>
            <input
              type="text"
              placeholder={t('splitbill.titlePlaceholder', 'Contoh: Makan Siang Bersama, Sewa Lapangan')}
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-xs font-semibold text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setSplitMode('equal')
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                splitMode === 'equal'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Bagi Rata</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setSplitMode('itemized')
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition cursor-pointer ${
                splitMode === 'itemized'
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Per Menu / Item</span>
            </button>
          </div>
        </div>

        {/* Mode: Equal Split Inputs */}
        {splitMode === 'equal' && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/60 p-3.5 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                Total Tagihan (Subtotal)
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3.5 py-2.5 text-sm font-black text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--muted)]">
                  {defaultCurrency}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                Jumlah Orang Patungan
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light')
                    setPeopleCount((c) => Math.max(2, c - 1))
                  }}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] font-black hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer"
                >
                  -
                </button>
                <div className="flex-1 text-center font-black text-sm text-[var(--fg)] py-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)]">
                  {peopleCount} Orang
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light')
                    setPeopleCount((c) => c + 1)
                  }}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--fg)] font-black hover:bg-[var(--field-bg)] active:scale-95 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mode: Itemized Split Inputs */}
        {splitMode === 'itemized' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Daftar Orang & Pesanan
              </span>
              <button
                type="button"
                onClick={handleAddParticipant}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Orang</span>
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {participants.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-2.5"
                >
                  <input
                    type="text"
                    value={p.name}
                    placeholder={`Nama ${idx + 1}`}
                    onChange={(e) => handleUpdateParticipant(p.id, 'name', e.target.value)}
                    className="w-1/3 min-w-[80px] rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs font-bold text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <div className="relative flex-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={p.amount}
                      placeholder={t('splitbill.amountPlaceholder', 'Nominal belanja')}
                      onChange={(e) => handleUpdateParticipant(p.id, 'amount', e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs font-black text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none pr-9"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--muted)]">
                      {defaultCurrency}
                    </span>
                  </div>
                  {participants.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.id)}
                      className="grid h-8 w-8 place-items-center rounded-xl text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Tax, Service, Discount */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-3 text-xs font-black text-[var(--fg)] hover:bg-[var(--field-bg)]/40 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Percent className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Pajak, Service & Diskon</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[var(--muted)]">
                {toSafeNumber(taxPercent) > 0 ? `Tax ${taxPercent}%` : ''}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {showAdvanced && (
            <div className="p-3.5 pt-1 border-t border-[var(--border)]/60 grid grid-cols-2 gap-3 bg-[var(--field-bg)]/30">
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Pajak Resto (%)
                </label>
                <input
                  type="number"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs font-black text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Biaya Layanan (%)
                </label>
                <input
                  type="number"
                  value={servicePercent}
                  onChange={(e) => setServicePercent(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs font-black text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Diskon ({defaultCurrency})
                </label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs font-black text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Tip ({defaultCurrency})
                </label>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs font-black text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Calculation Result Summary Card */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Total Akhir Tagihan</span>
              <div className="text-lg font-black text-[var(--fg)] tracking-tight">
                {formatCurrency(calculatedResult.grandTotal, defaultCurrency, locale)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Bagian Anda</span>
              <div className="text-lg font-black text-[var(--accent)] tracking-tight">
                {formatCurrency(calculatedResult.myShare, defaultCurrency, locale)}
              </div>
            </div>
          </div>

          {/* Breakdown per person */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {calculatedResult.shares.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-[var(--field-bg)]/50">
                <span className="font-bold text-[var(--fg)]">{s.name}</span>
                <span className="font-black text-[var(--fg)]">
                  {formatCurrency(s.total, defaultCurrency, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bank details for WhatsApp note */}
        <div>
          <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
            Nomor Rekening / QRIS (Opsional untuk WhatsApp)
          </label>
          <input
            type="text"
            placeholder={t('splitbill.paymentPlaceholder', 'Contoh: BCA 12345678 a/n Budi / GoPay 08123456')}
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-medium text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        {/* Wallet selector for direct logging */}
        {wallets.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
              Sumber Akun / Dompet untuk Porsi Saya
            </label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-2 text-xs font-bold text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.currency || defaultCurrency})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Success toast if logged */}
        {txSuccessMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-500 animate-fadeIn">
            <Check className="h-4 w-4 shrink-0" />
            <span>{txSuccessMessage}</span>
          </div>
        )}

        {/* Actions Grid */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-3 px-3 text-xs font-black text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-xs"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Tersalin!' : 'Salin WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogMyShare}
              disabled={isLoggingTx || calculatedResult.myShare <= 0}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-white py-3 px-3 text-xs font-black hover:opacity-90 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Wallet className="h-4 w-4" />
              <span>{isLoggingTx ? 'Mencatat...' : 'Catat Porsi Saya'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
