import React, { useMemo } from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'

export default function QuickChips({ chips: aiChips, onSelect }) {
  const locale = useSettingsStore((s) => s.locale)

  const defaultChips = useMemo(() => {
    const hour = new Date().getHours()
    
    // Time-aware suggestions
    if (hour >= 6 && hour < 10) {
      return ['aiChat.chip.kopi', 'aiChat.chip.sarapan', 'aiChat.chip.transport']
    }
    if (hour >= 10 && hour < 14) {
      return ['aiChat.chip.makansiang', 'aiChat.chip.kopi', 'aiChat.chip.belanja']
    }
    if (hour >= 14 && hour < 18) {
      return ['aiChat.chip.snack', 'aiChat.chip.bensin', 'aiChat.chip.belanja']
    }
    if (hour >= 18 && hour < 22) {
      return ['aiChat.chip.makanmalam', 'aiChat.chip.snack', 'aiChat.chip.belanja']
    }
    // Late night
    return ['aiChat.chip.snack', 'aiChat.chip.transport']
  }, [])

  return (
    <div className="ft-chat-chips">
      {aiChips && aiChips.length > 0 ? (
        aiChips.map((chipText, idx) => (
          <button
            key={idx}
            className="ft-chip"
            onClick={() => onSelect(chipText)}
          >
            {chipText}
          </button>
        ))
      ) : (
        defaultChips.map(key => (
          <button
            key={key}
            className="ft-chip"
            onClick={() => onSelect(translate(locale, key))}
          >
            {translate(locale, key)}
          </button>
        ))
      )}
    </div>
  )
}
