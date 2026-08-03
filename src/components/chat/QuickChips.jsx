import { useMemo } from 'react'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles, DollarSign, ListChecks, TrendingUp, Target, Flame } from 'lucide-react'

export default function QuickChips({ chips: aiChips, onSelect }) {
  const locale = useSettingsStore((s) => s.locale)
  const isId = locale === 'id'

  const defaultCategoryChips = useMemo(() => {
    return [
      {
        icon: <DollarSign size={15} className="text-emerald-500 shrink-0" />,
        bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        label: isId ? 'Catat Pengeluaran' : 'Record Expense',
        desc: isId ? 'Kopi, belanja, bensin' : 'Coffee, shopping',
        triggerText: isId ? 'Saya ingin mencatat pengeluaran baru' : 'I want to record a new expense',
      },
      {
        icon: <TrendingUp size={15} className="text-sky-500 shrink-0" />,
        bgClass: 'bg-sky-500/10 border-sky-500/20',
        label: isId ? 'Analisis Keuangan' : 'Financial Insights',
        desc: isId ? 'Grafik & rincian bulan ini' : 'Monthly breakdown',
        triggerText: isId ? 'Analisis pengeluaran dan pemasukan saya bulan ini' : 'Analyze my income and expenses this month',
      },
      {
        icon: <Target size={15} className="text-indigo-500 shrink-0" />,
        bgClass: 'bg-indigo-500/10 border-indigo-500/20',
        label: isId ? 'Target Tabungan' : 'Savings Goal',
        desc: isId ? 'Progres impian' : 'Goal progress',
        triggerText: isId ? 'Bagaimana progres target tabungan saya saat ini?' : 'How is my savings goal progress?',
      },
      {
        icon: <ListChecks size={15} className="text-amber-500 shrink-0" />,
        bgClass: 'bg-amber-500/10 border-amber-500/20',
        label: isId ? 'Buat Tugas Baru' : 'Create To-Do',
        desc: isId ? 'Tagihan, daftar belanja' : 'Bills, checklist',
        triggerText: isId ? 'Saya ingin membuat tugas baru' : 'I want to create a new task',
      },
      {
        icon: <Flame size={15} className="text-rose-500 shrink-0" />,
        bgClass: 'bg-rose-500/10 border-rose-500/20',
        label: isId ? 'Habit Hari Ini' : 'Daily Habit',
        desc: isId ? 'Cek streak harian' : 'Daily streak',
        triggerText: isId ? 'Bagaimana status habit harian saya hari ini?' : 'What is my habit status today?',
      },
      {
        icon: <Sparkles size={15} className="text-purple-500 shrink-0" />,
        bgClass: 'bg-purple-500/10 border-purple-500/20',
        label: isId ? 'Tips Hemat AI' : 'AI Saving Tips',
        desc: isId ? 'Saran finansial cerdas' : 'Smart advisor',
        triggerText: isId ? 'Berikan tips hemat berdasarkan riwayat transaksi saya' : 'Give me saving tips based on my transaction history',
      },
    ]
  }, [isId])

  if (aiChips && aiChips.length > 0) {
    return (
      <div className="ft-chat-chips flex items-center gap-2 overflow-x-auto py-1.5 px-0.5 scrollbar-none">
        {aiChips.map((chipText, idx) => (
          <button
            key={idx}
            type="button"
            className="ft-chip inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md px-3.5 py-1.5 text-[12px] font-bold text-[var(--fg)] hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all active:scale-95 shrink-0 shadow-xs"
            onClick={() => onSelect(chipText)}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <Sparkles size={12} className="text-indigo-500 shrink-0" />
            <span>{chipText}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="ft-chip-grid mt-1">
      {defaultCategoryChips.map((item, idx) => (
        <button
          key={idx}
          type="button"
          className="ft-chip-card group relative overflow-hidden transition-all duration-200"
          onClick={() => onSelect(item.triggerText)}
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${item.bgClass} shrink-0`}>
            {item.icon}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-bold text-[var(--fg)] truncate group-hover:text-indigo-500 transition-colors">
              {item.label}
            </span>
            <span className="text-[10px] font-medium text-[var(--muted)] truncate">
              {item.desc}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
