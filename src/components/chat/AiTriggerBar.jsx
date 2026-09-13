
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'

export default function AiTriggerBar({ isVisible, onOpen }) {
  const locale = useSettingsStore((s) => s.locale)

  return (
    <button
      type="button"
      data-tour="ai-chat-btn"
      onClick={onOpen}
      aria-label={translate(locale, 'aiChat.title') || 'AI Chat'}
      className={`ft-ai-bar md:hidden group ${
        isVisible
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-95 pointer-events-none translate-y-2'
      }`}
    >
      <span className="ft-ai-bar-beam" aria-hidden="true" />
      <span className="ft-ai-bar-inner">
        <Sparkles size={13} className="text-[var(--accent)] shrink-0 transition-transform duration-200 group-hover:scale-110" />
        <span className="text-[11.5px] font-bold text-[var(--fg)] tracking-tight leading-none whitespace-nowrap">
          {translate(locale, 'aiChat.chipTrigger') || (locale === 'en' ? 'Log transactions with AI' : 'Catat transaksi pakai AI')}
        </span>
      </span>
    </button>
  )
}
