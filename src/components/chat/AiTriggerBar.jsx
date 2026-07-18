import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'

export default function AiTriggerBar({ isVisible, onOpen }) {
  const locale = useSettingsStore((s) => s.locale)

  if (!isVisible) return null

  return (
    <button
      className="ft-ai-bar md:hidden flex items-center justify-center gap-1.5"
      onClick={onOpen}
      aria-label="Open AI Chat"
    >
      <Sparkles size={13} className="text-[#ffffff] shrink-0" />
      <span>{translate(locale, 'aiChat.trigger')}</span>
    </button>
  )
}
