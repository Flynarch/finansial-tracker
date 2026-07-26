import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'

export default function AiTriggerBar({ isVisible, onOpen }) {
  const locale = useSettingsStore((s) => s.locale)

  if (!isVisible) return null

  return (
    <button
      className="ft-ai-bar md:hidden flex items-center justify-center group relative overflow-hidden p-[1.5px] shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-transform"
      onClick={onOpen}
      aria-label="Open AI Chat"
    >
      <div className="absolute inset-[-1000%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,color-mix(in_srgb,var(--accent)_20%,transparent)_25%,var(--accent)_50%,color-mix(in_srgb,var(--accent)_20%,transparent)_75%,transparent_100%)] opacity-100" />
      <div className="relative flex h-full w-full items-center justify-center gap-1.5 rounded-full bg-[var(--fg)] px-4 py-1.5">
        <Sparkles size={13} className="text-[#ffffff] shrink-0" />
        <span className="text-xs font-semibold text-[var(--bg)]">
          {translate(locale, 'aiChat.trigger')}
        </span>
      </div>
    </button>
  )
}
