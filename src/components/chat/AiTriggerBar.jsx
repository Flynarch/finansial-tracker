
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
      className={`ft-ai-bar fixed bottom-[calc(7.2rem+env(safe-area-inset-bottom))] inset-x-0 mx-auto w-fit z-40 md:hidden inline-flex items-center gap-2 rounded-full border border-[var(--border)]/80 bg-[var(--panel-strong)] px-4 py-2 shadow-md shadow-black/5 active:scale-95 shrink-0 hover:border-[var(--accent)]/40 whitespace-nowrap max-w-[calc(100vw-32px)] transition-all duration-200 cursor-pointer ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
          : 'translate-y-4 opacity-0 scale-90 pointer-events-none'
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <Sparkles size={14} className="text-[var(--fg)] shrink-0" />
      <span className="text-[12px] font-bold text-[var(--fg)] tracking-tight leading-none whitespace-nowrap">
        {translate(locale, 'aiChat.trigger')}
      </span>
    </button>
  )
}
