import { useState, useMemo } from 'react'
import {
  Activity,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { calculateFinancialHealth } from '../../lib/financialHealth'
import { triggerHaptic } from '../../lib/haptics'

export default function FinancialHealthWidget({
  monthlyIncome = 0,
  monthlyExpense = 0,
  totalLiquidBalance = 0,
  activeLoans = [],
  budgets = [],
  budgetSpentMap = {},
}) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const healthData = useMemo(() => {
    return calculateFinancialHealth({
      monthlyIncome,
      monthlyExpense,
      totalLiquidBalance,
      activeLoans,
      budgets,
      budgetSpentMap,
    })
  }, [monthlyIncome, monthlyExpense, totalLiquidBalance, activeLoans, budgets, budgetSpentMap])

  const handleOpenDetail = () => {
    triggerHaptic('light')
    setIsDetailOpen(true)
  }

  // If insufficient data, show a friendly onboarding card
  if (healthData.status === 'insufficient_data') {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
              <Activity className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--fg)] tracking-tight">Kesehatan Finansial</h3>
              <p className="text-xs font-medium text-[var(--muted)]">Catat transaksi untuk melihat skor Anda</p>
            </div>
          </div>
          <span className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--muted)]">
            Siap Aktif
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      <section
        onClick={handleOpenDetail}
        className="group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card hover:border-[var(--border-strong)] transition-all duration-200 cursor-pointer active:scale-[0.99]"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border ${healthData.bg} ${healthData.color} shadow-2xs`}>
              <Activity className="h-4.5 w-4.5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Skor Kesehatan Finansial</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-[var(--fg)] tracking-tight">
                  {healthData.score}<span className="text-xs font-bold text-[var(--muted)]">/100</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${healthData.bg} ${healthData.color}`}>
                  {healthData.title}
                </span>
              </div>
            </div>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--muted)] group-hover:text-[var(--fg)] transition">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {/* 4 Pillars Mini Progress Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border)]/60">
          {healthData.pillars.map((pillar, idx) => {
            const pct = Math.round((pillar.score / pillar.maxScore) * 100)
            return (
              <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)]/60 p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-[var(--muted)] truncate">{pillar.name}</span>
                  <span className="text-[var(--fg)]">{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--border)]/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Detailed Health Analysis Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className={`grid h-8 w-8 place-items-center rounded-xl border ${healthData.bg} ${healthData.color}`}>
              <Activity className="h-4 w-4 stroke-[2.2]" />
            </div>
            <span className="text-base font-black text-[var(--fg)] tracking-tight">Analisis Kesehatan Keuangan</span>
          </div>
        }
        className="max-w-md"
      >
        <div className="space-y-4 pt-1 pb-2">
          {/* Hero Score Badge */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 text-center shadow-card space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider mb-1" style={{ borderColor: 'var(--border)' }}>
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Status: {healthData.title}</span>
            </div>
            <div className="text-4xl font-black text-[var(--fg)] tracking-tight">
              {healthData.score}
              <span className="text-sm font-bold text-[var(--muted)] ml-1">/ 100</span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xs mx-auto">
              Skor dihitung berdasarkan 4 pilar fundamental: Rasio Tabungan, Dana Darurat, Beban Utang, dan Disiplin Anggaran.
            </p>
          </div>

          {/* Pillars Breakdown */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Rincian 4 Pilar</span>
            <div className="space-y-2">
              {healthData.pillars.map((pillar, idx) => {
                const pct = Math.round((pillar.score / pillar.maxScore) * 100)
                return (
                  <div key={idx} className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)]/80 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--fg)]">{pillar.name}</span>
                      <span className="text-xs font-black text-[var(--fg)]">
                        {pillar.score} / {pillar.maxScore} Poin
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--border)]/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">{pillar.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-[var(--fg)]">
              <Sparkles className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <span>Saran & Rekomendasi Aksi</span>
            </div>
            <ul className="text-xs text-[var(--muted)] space-y-1.5 list-disc list-inside leading-relaxed">
              {healthData.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </>
  )
}
