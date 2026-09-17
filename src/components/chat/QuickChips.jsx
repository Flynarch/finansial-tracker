import { ArrowUpRight, PieChart, Target, HandCoins, TrendingUp, Receipt, Flame, ListChecks } from 'lucide-react'

// Detect contextual icon based on chip text keywords
function getChipIcon(text) {
  const lower = (text || '').toLowerCase()
  if (lower.includes('budget') || lower.includes('anggaran')) return <PieChart size={13} className="text-sky-500 shrink-0" />
  if (lower.includes('tabungan') || lower.includes('saving') || lower.includes('target')) return <Target size={13} className="text-[var(--accent)] shrink-0" />
  if (lower.includes('utang') || lower.includes('piutang') || lower.includes('loan') || lower.includes('lunas')) return <HandCoins size={13} className="text-teal-500 shrink-0" />
  if (lower.includes('analisis') || lower.includes('tren') || lower.includes('pengeluaran') || lower.includes('trend')) return <TrendingUp size={13} className="text-amber-500 shrink-0" />
  if (lower.includes('catat') || lower.includes('record') || lower.includes('transaksi')) return <Receipt size={13} className="text-emerald-500 shrink-0" />
  if (lower.includes('habit') || lower.includes('kebiasaan')) return <Flame size={13} className="text-rose-500 shrink-0" />
  if (lower.includes('tugas') || lower.includes('task') || lower.includes('todo')) return <ListChecks size={13} className="text-amber-500 shrink-0" />
  return <ArrowUpRight size={13} className="text-[var(--muted)] shrink-0" />
}

export default function QuickChips({ chips: aiChips, onSelect }) {
  const chipsList = aiChips && aiChips.length > 0 ? aiChips : null

  // If no AI chips provided, render nothing (WelcomeHero handles the empty/welcome state)
  if (!chipsList) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 ft-hide-scrollbar w-full min-w-0 max-w-full">
      {chipsList.map((chipText, idx) => (
        <button
          key={idx}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 shrink-0 shadow-2xs cursor-pointer opacity-0 ft-msg-enter"
          style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'forwards' }}
          onClick={() => onSelect(chipText)}
        >
          {getChipIcon(chipText)}
          <span>{chipText}</span>
        </button>
      ))}
    </div>
  )
}

