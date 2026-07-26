import React, { useState, useEffect } from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'

const PROMPT_EXAMPLES = {
  id: [
    'Catat kopi 25rb pakai BCA...',
    'Buatkan todo belanja bulanan...',
    'Berapa total pengeluaranku?',
    'Buat target tabungan Laptop...',
    'Catat habit lari pagi...',
  ],
  en: [
    'Record 25k coffee expense...',
    'Create monthly shopping todo...',
    'What is my total expense?',
    'Create laptop savings target...',
    'Log morning run habit...',
  ],
}

export default function AiTriggerBar({ isVisible, onOpen }) {
  const locale = useSettingsStore((s) => s.locale)
  const isId = locale === 'id'
  const examples = PROMPT_EXAMPLES[isId ? 'id' : 'en']

  const [exampleIndex, setExampleIndex] = useState(0)
  const [fadeState, setFadeState] = useState('opacity-100 translate-y-0')

  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(() => {
      setFadeState('opacity-0 -translate-y-1.5')
      setTimeout(() => {
        setExampleIndex((prev) => (prev + 1) % examples.length)
        setFadeState('opacity-100 translate-y-0')
      }, 250)
    }, 3500)
    return () => clearInterval(interval)
  }, [isVisible, examples.length])

  if (!isVisible) return null

  return (
    <button
      className="ft-ai-bar md:hidden flex items-center justify-center group relative overflow-hidden p-[1.5px] shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-transform"
      onClick={onOpen}
      aria-label="Open AI Chat"
    >
      <div className="absolute inset-[-1000%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,color-mix(in_srgb,var(--accent)_20%,transparent)_25%,var(--accent)_50%,color-mix(in_srgb,var(--accent)_20%,transparent)_75%,transparent_100%)] opacity-100" />
      <div className="relative flex h-full w-full items-center justify-between gap-2 rounded-full bg-[var(--fg)] px-3.5 py-1.5 min-w-[240px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles size={13} className="text-[#ffffff] shrink-0" />
          <span className={`text-xs font-semibold text-[var(--bg)] truncate transition-all duration-300 ${fadeState}`}>
            {examples[exampleIndex]}
          </span>
        </div>
        <span className="rounded-full bg-[var(--bg)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--bg)] shrink-0">
          AI
        </span>
      </div>
    </button>
  )
}
