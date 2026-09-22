import { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import useSettingsStore from '../../store/useSettingsStore';
import { triggerHaptic } from '../../lib/haptics';

const ScrollToBottomFAB = ({ isVisible = false, unreadCount = 0, onClick }) => {
  const locale = useSettingsStore((state) => state.locale);

  const handleClick = () => {
    triggerHaptic('light');
    if (onClick) {
      onClick();
    }
  };

  const badgeText = locale === 'id'
    ? `${unreadCount} Pesan Baru`
    : `${unreadCount} New Messages`;

  return (
    <div
      className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-10 transition-all duration-200 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <button
        onClick={handleClick}
        className="rounded-full bg-[var(--panel-strong)] border border-[var(--border)] shadow-lg px-3 py-1.5 flex items-center gap-1.5 active:scale-95"
      >
        <span className="text-[11px] font-bold text-[var(--fg)]">
          {unreadCount > 0 ? badgeText : (locale === 'id' ? 'Ke Bawah' : 'To Bottom')}
        </span>
        <ChevronDown size={14} className="text-[var(--fg)]" />
      </button>
    </div>
  );
};

export default memo(ScrollToBottomFAB);

