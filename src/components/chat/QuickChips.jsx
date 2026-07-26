import React, { useMemo } from 'react'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles, DollarSign, ListChecks, TrendingUp, Target, Flame } from 'lucide-react'

export default function QuickChips({ chips: aiChips, onSelect }) {
  const locale = useSettingsStore((s) => s.locale)
  const isId = locale === 'id'

  const defaultCategoryChips = useMemo(() => {
    return [
      {
        icon: <DollarSign size={13} className="text-emerald-500" />,
        label: isId ? 'Catat Pengeluaran' : 'Record Expense',
        triggerText: isId ? 'Saya ingin mencatat pengeluaran baru' : 'I want to record a new expense',
      },
      {
        icon: <ListChecks size={13} className="text-amber-500" />,
        label: isId ? 'Buat To-Do' : 'Create To-Do',
        triggerText: isId ? 'Saya ingin membuat tugas baru' : 'I want to create a new task',
      },
      {
        icon: <TrendingUp size={13} className="text-sky-500" />,
        label: isId ? 'Analisis Keuangan' : 'Financial Insights',
        triggerText: isId ? 'Saya ingin menganalisis keuangan' : 'I want to analyze my finances',
      },
      {
        icon: <Target size={13} className="text-indigo-500" />,
        label: isId ? 'Target Tabungan' : 'Savings Goal',
        triggerText: isId ? 'Saya ingin membuat target tabungan' : 'I want to create a savings goal',
      },
      {
        icon: <Flame size={13} className="text-rose-500" />,
        label: isId ? 'Habit Harian' : 'Daily Habit',
        triggerText: isId ? 'Saya ingin membuat habit harian' : 'I want to create a daily habit',
      },
    ]
  }, [isId])

  return (
    <div className="ft-chat-chips flex items-center gap-2 overflow-x-auto py-1.5 px-0.5 scrollbar-none">
      {aiChips && aiChips.length > 0 ? (
        aiChips.map((chipText, idx) => (
          <button
            key={idx}
            type="button"
            className="ft-chip inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all active:scale-95 shrink-0"
            onClick={() => onSelect(chipText)}
          >
            <Sparkles size={12} className="text-[var(--muted)]" />
            <span>{chipText}</span>
          </button>
        ))
      ) : (
        defaultCategoryChips.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className="ft-chip inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all active:scale-95 shrink-0"
            onClick={() => onSelect(item.triggerText)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))
      )}
    </div>
  )
}
