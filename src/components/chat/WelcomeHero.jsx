import { memo } from 'react';
import { Sparkles, Receipt, PieChart, TrendingUp, HandCoins } from 'lucide-react';
import useSettingsStore from '../../store/useSettingsStore';
import { formatCurrency } from '../../lib/utils';
import { triggerHaptic } from '../../lib/haptics';

const WelcomeHero = memo(function WelcomeHero({
  onSelectPrompt,
  onStagePrompt,
  onSend,
  todayExpense = 0,
  todayCurrency = 'IDR',
}) {
  const locale = useSettingsStore(state => state.locale) || 'id';
  const isEn = locale === 'en';

  const title = isEn ? 'FinTrack Finance Assistant' : 'Asisten Finansial FinTrack';
  const subtitle = isEn 
    ? 'Smart offline recording, expense auditing, and financial goal tracking.'
    : 'Pencatatan cerdas offline, audit pengeluaran, dan kalkulasi target finansial.';

  const handleSelect = (promptText) => {
    triggerHaptic('light');
    const stageHandler = onStagePrompt || onSelectPrompt || onSend;
    if (stageHandler) {
      stageHandler(promptText);
    }
  };

  const intents = [
    {
      id: 'record',
      icon: Receipt,
      title: isEn ? 'Record Transaction' : 'Catat Transaksi',
      prompt: isEn ? 'I want to record a transaction' : 'Aku mau catat transaksi',
      colors: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
    },
    {
      id: 'budget',
      icon: PieChart,
      title: isEn ? 'Check Budget' : 'Cek Budget',
      prompt: isEn ? 'Remaining budget this month?' : 'Sisa budget bulan ini?',
      colors: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
    },
    {
      id: 'analysis',
      icon: TrendingUp,
      title: isEn ? 'Analysis' : 'Analisis',
      prompt: isEn ? 'Biggest expenses in the last 7 days' : 'Pengeluaran terbesar 7 hari terakhir',
      colors: 'bg-amber-500/15 border-amber-500/25 text-amber-500',
    },
    {
      id: 'debt',
      icon: HandCoins,
      title: isEn ? 'Debt Audit' : 'Audit Utang',
      prompt: isEn ? 'Who hasn\'t paid yet?' : 'Siapa yang belum lunas?',
      colors: 'bg-teal-500/15 border-teal-500/25 text-teal-500',
    }
  ];

  return (
    <div className="flex flex-col items-center gap-5 py-4 px-2 ft-msg-enter">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] ring-4 ring-[var(--accent)]/10">
          <Sparkles size={20} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-black text-[var(--fg)]">{title}</h2>
          <p className="text-[10.5px] font-medium text-[var(--muted)] max-w-[240px] leading-relaxed mx-auto">
            {subtitle}
          </p>
        </div>
      </div>

      {todayExpense > 0 && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--muted)]">
          {isEn ? 'Today:' : 'Hari ini:'} {formatCurrency(todayExpense, todayCurrency)} {isEn ? 'spent' : 'keluar'}
        </div>
      )}

      <div className="grid w-full max-w-sm grid-cols-2 gap-2.5">
        {intents.map((intent) => {
          const Icon = intent.icon;
          return (
            <button
              type="button"
              key={intent.id}
              onClick={() => handleSelect(intent.prompt)}
              className="flex flex-col text-left gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 cursor-pointer active:scale-[0.97] hover:bg-[var(--panel-strong)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${intent.colors}`}>
                <Icon size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-xs font-black text-[var(--fg)]">{intent.title}</span>
                <span className="text-[10.5px] font-medium italic text-[var(--muted)] truncate">
                  &quot;{intent.prompt}&quot;
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default WelcomeHero;
