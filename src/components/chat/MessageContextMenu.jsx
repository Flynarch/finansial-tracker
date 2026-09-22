import { memo } from 'react';
import { Copy, DollarSign, Pencil, Trash2 } from 'lucide-react';
import useSettingsStore from '../../store/useSettingsStore';
import { triggerHaptic } from '../../lib/haptics';

const MessageContextMenu = memo(function MessageContextMenu({
  isOpen,
  onClose,
  messageContent,
  messageType,
  onCopyText,
  onCopyAmount,
  onEditTransaction,
  onDeleteMessage
}) {
  const locale = useSettingsStore((s) => s.locale);

  if (!isOpen) return null;

  const hasAmount = /Rp|\d+\.\d{3}/.test(messageContent || '');

  const handleAction = (action) => {
    triggerHaptic('light');
    if (action) action();
    if (onClose) onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[60] bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl border-t border-[var(--border)] bg-[var(--panel-strong)] pb-[max(env(safe-area-inset-bottom,0px),1rem)] animate-slide-up-bottom">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30 mx-auto mt-3 mb-2" />
        
        <div className="flex flex-col">
          <div 
            className="flex items-center gap-3 px-4 py-3 active:bg-[var(--field-bg)] transition cursor-pointer"
            onClick={() => handleAction(onCopyText)}
          >
            <Copy size={18} className="text-[var(--muted)]" />
            <span className="text-sm font-bold text-[var(--fg)]">
              {locale === 'en' ? 'Copy Text' : 'Salin Teks'}
            </span>
          </div>

          {hasAmount && (
            <div 
              className="flex items-center gap-3 px-4 py-3 active:bg-[var(--field-bg)] transition cursor-pointer"
              onClick={() => handleAction(onCopyAmount)}
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
              onClick={() => handleAction(onEditTransaction)}
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
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpBottom {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slide-up-bottom {
          animation: slideUpBottom 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
});

export default MessageContextMenu;
