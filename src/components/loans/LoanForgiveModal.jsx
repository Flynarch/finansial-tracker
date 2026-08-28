import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { HeartHandshake, Loader2, Info } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import useSettingsStore from '../../store/useSettingsStore'
import useLoanStore from '../../store/useLoanStore'
import { hapticSuccess, hapticWarning } from '../../lib/haptics'

export default function LoanForgiveModal({
  isOpen,
  onClose,
  loan = null,
  onSuccess,
}) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const forgiveLoan = useLoanStore((state) => state.forgiveLoan)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (!loan) return null

  const isDebt = loan.type === 'debt'
  const currency = loan.currency || defaultCurrency
  const remaining = toSafeNumber(loan.remainingAmount)

  const handleConfirm = async () => {
    try {
      setIsLoading(true)
      setError('')
      await forgiveLoan(loan.id, notes.trim())
      hapticSuccess()
      onSuccess?.()
      onClose()
    } catch (err) {
      hapticWarning()
      setError(err.message || t('common.error.generic', 'Terjadi Kendala'))
    } finally {
      setIsLoading(false)
    }
  }

  const modalTitle = isDebt
    ? t('loans.forgive.titleDebt', 'Pemutihan / Ikhlaskan Hutang')
    : t('loans.forgive.titleReceivable', 'Ikhlaskan / Relakan Piutang')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4 pt-1">
        {/* Context Card */}
        <div className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-3.5 space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-500/20 text-purple-500 border border-purple-500/30">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-sm text-[var(--fg)] truncate">{loan.title}</h4>
              <p className="text-xs font-semibold text-[var(--muted)] truncate">
                {isDebt ? `${t('loans.modal.personDebt', 'Pemberi')}: ` : `${t('loans.modal.personReceivable', 'Peminjam')}: `}
                <strong className="text-[var(--fg)]">{loan.personName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-purple-500/20 text-xs font-bold">
            <span className="text-[var(--muted)]">{t('loans.forgive.remainingForgiven', 'Nominal yang Diikhlaskan')}</span>
            <span className="font-black text-purple-500 text-sm tabular-nums">
              {formatCurrency(remaining, currency)}
            </span>
          </div>
        </div>

        {/* Informative Explainer Box */}
        <div className="flex gap-2.5 items-start p-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs text-[var(--muted)]">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-purple-500" />
          <div className="leading-relaxed font-medium">
            {isDebt
              ? t(
                  'loans.forgive.descDebt',
                  { amount: formatCurrency(remaining, currency), name: loan.personName },
                  `Sisa hutang sebesar ${formatCurrency(remaining, currency)} kepada ${loan.personName} telah diikhlaskan/dibebaskan oleh pemberi pinjaman. Tagihan akan ditandai selesai tanpa perubahan saldo dompet.`
                )
              : t(
                  'loans.forgive.descReceivable',
                  { amount: formatCurrency(remaining, currency), name: loan.personName },
                  `Sisa piutang sebesar ${formatCurrency(remaining, currency)} kepada ${loan.personName} akan direlakan dan ditandai selesai. Tidak ada pengurangan atau penambahan pada saldo dompet Anda.`
                )}
          </div>
        </div>

        {/* Note Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--fg)]">
            {t('loans.forgive.notesLabel', 'Alasan / Catatan (Opsional)')}
          </label>
          <input
            type="text"
            className="ft-input w-full text-xs font-semibold py-2 px-3 rounded-xl"
            placeholder={t('loans.forgive.notesPlaceholder', 'Misal: Disedekahkan / Dibebaskan karena musibah')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error ? (
          <div className="text-xs font-bold text-rose-500 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            {error}
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            className="flex-1 bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--field-border)]"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('common.cancel', 'Batal')}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white border-none shadow-xs font-extrabold"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common.processing', 'Memproses...')}</span>
              </span>
            ) : (
              t('loans.forgive.confirmBtn', 'Ikhlaskan Pinjaman')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
