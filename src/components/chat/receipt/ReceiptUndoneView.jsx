import { memo } from 'react'
import { RotateCcw, Plus } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'

export const ReceiptUndoneView = memo(function ReceiptUndoneView({
  txCount = 1,
  onLogAnother,
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in duration-200">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
        <RotateCcw className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-black text-[var(--fg)]">{t('ai.txUndone', 'Transaksi Dibatalkan')}</h3>
        <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
          {txCount > 1
            ? t('ai.multipleTxUndoneDesc', '{{count}} transaksi telah dihapus dari riwayat keuangan Anda.', { count: txCount })
            : t('ai.txUndoneDesc', 'Transaksi telah dihapus dari riwayat keuangan Anda.')}
        </p>
      </div>
      <button
        type="button"
        onClick={onLogAnother}
        className="ft-btn-primary py-2.5 px-5 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition mt-2"
      >
        <Plus className="h-4 w-4" />
        <span>{t('ai.logAnother', 'Catat Transaksi Lain')}</span>
      </button>
    </div>
  )
})

export default ReceiptUndoneView
