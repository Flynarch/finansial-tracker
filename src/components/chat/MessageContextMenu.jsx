import { memo, useMemo } from 'react'
import { Copy, DollarSign, Pencil, Trash2 } from 'lucide-react'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'
import useBottomSheet from '../../hooks/useBottomSheet'

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
  const { isMounted, isVisible, closeSheet } = useBottomSheet({
    isOpen,
    onClose,
  })

  const extractedAmount = useMemo(() => {
    if (messageData?.amount != null) {
      return String(messageData.amount)
    }
    if (Array.isArray(messageData) && messageData[0]?.amount != null) {
      return String(messageData[0].amount)
    }
    const match = (messageContent || '').match(/(?:Rp\.?\s*|IDR\s*|\$)?(\d[\d.,]*(?:\s*(?:k|rb|ribu|jt|juta))?)/i)
    return match ? match[0].trim() : null
  }, [messageContent, messageData])

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
      
      <div className={`fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl border-t border-[var(--border)] bg-[var(--panel-strong)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] transform-gpu ${
        isVisible ? 'ft-sheet-enter' : 'ft-sheet-exit pointer-events-none'
      }`}>
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30 mx-auto mt-3 mb-2" />
        
        <div className="flex flex-col">
          <div 
            className="flex items-center gap-3 px-4 py-3 active:bg-[var(--field-bg)] transition cursor-pointer"
            onClick={() => handleAction(onCopyText, messageContent)}
          >
            <Copy size={18} className="text-[var(--muted)]" />
            <span className="text-sm font-bold text-[var(--fg)]">
              {locale === 'en' ? 'Copy Text' : 'Salin Teks'}
            </span>
          </div>

          {hasAmount && (
            <div 
              className="flex items-center gap-3 px-4 py-3 active:bg-[var(--field-bg)] transition cursor-pointer"
              onClick={() => handleAction(onCopyAmount, extractedAmount)}
            >
              <DollarSign size={18} className="text-[var(--muted)]" />
              <span className="text-sm font-bold text-[var(--fg)]">
                {locale === 'en' ? 'Copy Amount' : 'Salin Nominal'}
              </span>
            </div>
          )}

          {messageType === 'transaction' && (
            <div 
              className="flex items-center gap-3 px-4 py-3 active:bg-[var(--field-bg)] transition cursor-pointer"
              onClick={() => handleAction(onEditTransaction, messageData)}
            >
              <Pencil size={18} className="text-[var(--muted)]" />
              <span className="text-sm font-bold text-[var(--fg)]">
                {locale === 'en' ? 'Edit Transaction' : 'Edit Transaksi'}
              </span>
            </div>
          )}

          <div 
            className="flex items-center gap-3 px-4 py-3 active:bg-[var(--field-bg)] transition cursor-pointer"
            onClick={() => handleAction(onDeleteMessage)}
          >
            <Trash2 size={18} className="text-rose-500" />
            <span className="text-sm font-bold text-rose-500">
              {locale === 'en' ? 'Delete Message' : 'Hapus Pesan'}
            </span>
          </div>
        </div>
      </div>
    </>
  )
})

export default MessageContextMenu
