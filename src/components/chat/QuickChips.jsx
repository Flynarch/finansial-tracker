import { useMemo } from 'react'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles, DollarSign, ListChecks, TrendingUp, Target, Flame, HandCoins, ArrowUpRight } from 'lucide-react'

export default function QuickChips({ chips: aiChips, onSelect }) {
  const locale = useSettingsStore((s) => s.locale)
  const isId = locale === 'id'

  const defaultCategoryChips = useMemo(() => {
    return [
      {
        icon: <DollarSign size={13} className="text-emerald-500 shrink-0" />,
        label: isId ? 'Catat Pengeluaran' : 'Record Expense',
        triggerText: isId ? 'Saya ingin mencatat pengeluaran baru' : 'I want to record a new expense',
      },
      {
        icon: <TrendingUp size={13} className="text-sky-500 shrink-0" />,
        label: isId ? 'Analisis Keuangan' : 'Financial Insights',
        triggerText: isId ? 'Analisis pengeluaran dan pemasukan saya bulan ini' : 'Analyze my income and expenses this month',
      },
      {
        icon: <Target size={13} className="text-[var(--accent)] shrink-0" />,
        label: isId ? 'Target Tabungan' : 'Savings Goal',
        triggerText: isId ? 'Bagaimana progres target tabungan saya saat ini?' : 'How is my savings goal progress?',
      },
      {
        icon: <HandCoins size={13} className="text-teal-500 shrink-0" />,
        label: isId ? 'Utang & Piutang' : 'Loans & Debts',
        triggerText: isId ? 'Siapa saja yang punya utang ke saya dan berapa total utang saya?' : 'Who owes me money and what is my total debt?',
      },
      {
        icon: <Sparkles size={13} className="text-purple-500 shrink-0" />,
        label: isId ? 'Tips Hemat AI' : 'AI Saving Tips',
        triggerText: isId ? 'Berikan tips hemat berdasarkan riwayat transaksi saya' : 'Give me saving tips based on my transaction history',
      },
      {
        icon: <ListChecks size={13} className="text-amber-500 shrink-0" />,
        label: isId ? 'Tugas Baru' : 'New Task',
        triggerText: isId ? 'Saya ingin membuat tugas baru' : 'I want to create a new task',
      },
      {
        icon: <Flame size={13} className="text-rose-500 shrink-0" />,
        label: isId ? 'Habit Hari Ini' : 'Daily Habit',
        triggerText: isId ? 'Bagaimana status habit harian saya hari ini?' : 'What is my habit status today?',
      },
    ]
  }, [isId])

  const chipsList = aiChips && aiChips.length > 0 ? aiChips : null

  if (chipsList) {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 ft-hide-scrollbar w-full min-w-0 max-w-full">
        {chipsList.map((chipText, idx) => (
          <button
            key={idx}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 shrink-0 shadow-2xs cursor-pointer"
            onClick={() => onSelect(chipText)}
          >
            <span>{chipText}</span>
            <ArrowUpRight className="h-3 w-3 text-[var(--muted)] shrink-0" />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 ft-hide-scrollbar mt-1 w-full min-w-0 max-w-full">
      {defaultCategoryChips.map((item, idx) => (
        <button
          key={idx}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 shrink-0 shadow-2xs cursor-pointer"
          onClick={() => onSelect(item.triggerText)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
