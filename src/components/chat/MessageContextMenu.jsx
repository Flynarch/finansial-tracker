import { memo, useMemo } from 'react'
import { Copy, DollarSign, Pencil, Trash2 } from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import useBottomSheet from '../../hooks/useBottomSheet'
import { formatCurrency } from '../../lib/utils'
import { getDecryptedNoteSync, isFieldEncrypted } from '../../lib/fieldEncryption'

const MessageContextMenu = memo(function MessageContextMenu({
  isOpen,
  onClose,
  messageContent = '',
  messageType,
  messageData = null,
  onCopyText,
  onCopyAmount,
  onEditTransaction,
  onDeleteMessage,
}) {
  const locale = useSettingsStore((s) => s.locale)
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency || 'IDR')
  const { isMounted, isVisible, closeSheet } = useBottomSheet({
    isOpen,
    onClose,
  })

  const txList = useMemo(() => {
    if (Array.isArray(messageData)) return messageData
    if (messageData && typeof messageData === 'object' && messageData.id) return [messageData]
    return []
  }, [messageData])

  const totalAmount = useMemo(() => {
    if (txList.length > 0) {
      return txList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
    }
    return null
  }, [txList])

  const extractedAmount = useMemo(() => {
    if (totalAmount !== null) {
      return String(totalAmount)
    }
    const match = (messageContent || '').match(/(?:Rp\.?\s*|IDR\s*|\$)?(\d[\d.,]*(?:\s*(?:k|rb|ribu|jt|juta))?)/i)
    return match ? match[0].trim() : null
  }, [messageContent, totalAmount])

  const hasAmount = Boolean(extractedAmount)

  if (!isMounted) return null

  const handleAction = (action, ...args) => {
    triggerHaptic('light')
    if (action) action(...args)
    closeSheet()
  }

  return (
    <>
      <div 
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs cursor-pointer ${
          isVisible ? 'ft-backdrop-enter' : 'ft-backdrop-exit pointer-events-none'
        }`}
        onClick={closeSheet}
      />
      
      <div className={`fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl border-t border-[var(--border)] bg-[var(--panel-strong)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] max-h-[75vh] flex flex-col transform-gpu ${
        isVisible ? 'ft-sheet-enter' : 'ft-sheet-exit pointer-events-none'
      }`}>
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30 mx-auto mt-3 mb-2 shrink-0" />
        
        <div className="flex flex-col overflow-y-auto ft-hide-scrollbar flex-1">
          <button 
            type="button"
            className="w-full flex items-center text-left gap-3 px-4 py-3 active:bg-[var(--field-bg)] hover:bg-[var(--field-bg)]/50 transition cursor-pointer focus:outline-none focus-visible:bg-[var(--field-bg)]"
            onClick={() => handleAction(onCopyText, messageContent)}
          >
            <Copy size={18} className="text-[var(--muted)]" />
            <span className="text-sm font-bold text-[var(--fg)]">
              {locale === 'en' ? 'Copy Text' : 'Salin Teks'}
            </span>
          </button>

          {hasAmount && (
            <button 
              type="button"
              className="w-full flex items-center text-left gap-3 px-4 py-3 active:bg-[var(--field-bg)] hover:bg-[var(--field-bg)]/50 transition cursor-pointer focus:outline-none focus-visible:bg-[var(--field-bg)]"
              onClick={() => handleAction(onCopyAmount, extractedAmount)}
            >
              <DollarSign size={18} className="text-[var(--muted)]" />
              <span className="text-sm font-bold text-[var(--fg)]">
                {txList.length > 1
                  ? (locale === 'en' ? `Copy Total (${formatCurrency(totalAmount, txList[0]?.currency || defaultCurrency)})` : `Salin Total Nominal (${formatCurrency(totalAmount, txList[0]?.currency || defaultCurrency)})`)
                  : (locale === 'en' ? 'Copy Amount' : 'Salin Nominal')}
              </span>
            </button>
          )}

          {messageType === 'transaction' && txList.length > 1 && (
            <div className="border-y border-[var(--border)]/40 my-1 py-1">
              <p className="px-4 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                {locale === 'en' ? 'Edit Individual Transaction' : 'Edit Transaksi Tertentu'}
              </p>
              {txList.map((tx, idx) => {
                const rawNote = tx.notes
                const plainNote = isFieldEncrypted(rawNote) ? getDecryptedNoteSync(rawNote) : rawNote
                const safeNote = isFieldEncrypted(plainNote) ? '' : (plainNote || '')
                const label = safeNote || tx.category || (locale === 'en' ? `Item #${idx + 1}` : `Item #${idx + 1}`)
                return (
                  <button
                    key={tx.id || idx}
                    type="button"
                    className="w-full flex items-center justify-between text-left gap-2 px-4 py-2.5 active:bg-[var(--field-bg)] hover:bg-[var(--field-bg)]/50 transition cursor-pointer focus:outline-none focus-visible:bg-[var(--field-bg)]"
                    onClick={() => handleAction(onEditTransaction, tx)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Pencil size={15} className="text-[var(--accent)] shrink-0" />
                      <span className="text-xs font-bold text-[var(--fg)] truncate">
                        #{idx + 1}: {label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--muted)] tabular-nums shrink-0">
                      {formatCurrency(tx.amount, tx.currency || defaultCurrency)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {messageType === 'transaction' && txList.length <= 1 && (
            <button 
              type="button"
              className="w-full flex items-center text-left gap-3 px-4 py-3 active:bg-[var(--field-bg)] hover:bg-[var(--field-bg)]/50 transition cursor-pointer focus:outline-none focus-visible:bg-[var(--field-bg)]"
              onClick={() => handleAction(onEditTransaction, txList[0] || messageData)}
            >
              <Pencil size={18} className="text-[var(--muted)]" />
              <span className="text-sm font-bold text-[var(--fg)]">
                {locale === 'en' ? 'Edit Transaction' : 'Edit Transaksi'}
              </span>
            </button>
          )}

          <button 
            type="button"
            className="w-full flex items-center text-left gap-3 px-4 py-3 active:bg-[var(--field-bg)] hover:bg-[var(--field-bg)]/50 transition cursor-pointer focus:outline-none focus-visible:bg-[var(--field-bg)]"
            onClick={() => handleAction(onDeleteMessage)}
          >
            <Trash2 size={18} className="text-rose-500" />
            <span className="text-sm font-bold text-rose-500">
              {locale === 'en' ? 'Delete Message' : 'Hapus Pesan'}
            </span>
          </button>
        </div>
      </div>
    </>
  )
})

export default MessageContextMenu
