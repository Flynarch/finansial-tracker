import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function UserBubble({ content }) {
  return (
    <div className="ft-chat-user ft-swush-in">
      {content}
    </div>
  )
}

export function AiBubble({ content }) {
  return (
    <div className="ft-chat-ai ft-swush-in flex gap-2">
      <div className="shrink-0 mt-0.5 text-[var(--accent)]">
        <Sparkles size={16} />
      </div>
      <div className="flex-1 w-full overflow-hidden ft-md-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  const locale = useSettingsStore(s => s.locale)
  return (
    <div className="ft-chat-ai flex items-center gap-3">
      <div className="shrink-0 text-[var(--accent)] flex items-center">
        <Sparkles size={16} />
      </div>
      <div className="flex items-center">
        <span className="ft-typing-dot"></span>
        <span className="ft-typing-dot"></span>
        <span className="ft-typing-dot"></span>
      </div>
      <span className="text-xs text-[var(--muted)] ml-1">
        {translate(locale, 'aiChat.thinking')}
      </span>
    </div>
  )
}
