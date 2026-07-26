import React, { useMemo } from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles, DollarSign, ListChecks, Target, Flame, TrendingUp } from 'lucide-react'

export default function QuickChips({ chips: aiChips, onSelect }) {
  const locale = useSettingsStore((s) => s.locale)

  const defaultCategoryChips = useMemo(() => {
    const isId = locale === 'id'
    return [
      {
        icon: <DollarSign size={13} className="text-emerald-500" />,
        label: isId ? 'Catat Pengeluaran' : 'Record Expense',
        prompt: isId ? 'Catat pengeluaran kopi 25rb pakai BCA' : 'Record coffee 25k expense',
      },
      {
        icon: <ListChecks size={13} className="text-amber-500" />,
        label: isId ? 'Buat To-Do Belanja' : 'Create Shopping Todo',
        prompt: isId ? 'Buatkan todo belanja bulanan dengan subtask susu, beras, minyak' : 'Create monthly shopping todo',
      },
      {
        icon: <TrendingUp size={13} className="text-sky-500" />,
        label: isId ? 'Analisis Keuangan' : 'Financial Insights',
        prompt: isId ? 'Berapa total pengeluaranku bulan ini dan kategorinya?' : 'Analyze my expenses this month',
      },
      {
        icon: <Target size={13} className="text-indigo-500" />,
        label: isId ? 'Target Tabungan' : 'Savings Goal',
        prompt: isId ? 'Buat target tabungan Laptop 10 juta' : 'Create 10M laptop savings target',
      },
      {
        icon: <Flame size={13} className="text-rose-500" />,
        label: isId ? 'Habit Harian' : 'Daily Habit',
        prompt: isId ? 'Buat habit lari pagi jam 06:00' : 'Create morning run habit at 06:00',
      },
    ]
  }, [locale])

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
            onClick={() => onSelect(item.prompt)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))
      )}
    </div>
  )
}
