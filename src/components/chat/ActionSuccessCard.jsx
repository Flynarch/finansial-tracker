
import { useNavigate } from 'react-router-dom'
import { Check, ListChecks, PiggyBank, Flame, CalendarCheck, CircleDollarSign, Target, PlusCircle, Trash2, ArrowRight } from 'lucide-react'
import useChatStore from '../../store/useChatStore'
import useSettingsStore from '../../store/useSettingsStore'

const CONFIG = {
  habit: {
    create: {
      label: 'Habit Baru Dibuat',
      desc: 'Ditambahkan ke daftar kebiasaan harian',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Flame,
      route: '/todos',
      actionText: 'Lihat Habit',
    },
    log: {
      label: 'Habit Tercatat',
      desc: 'Konsistensi hari ini terjaga',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
      route: '/todos',
      actionText: 'Lihat Habit',
    },
    log_all: {
      label: 'Semua Habit Tercatat',
      desc: 'Konsistensi harian sempurna!',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
      route: '/todos',
      actionText: 'Lihat Habit',
    },
  },
  todo: {
    create: {
      label: 'Tugas Ditambahkan',
      desc: 'Masuk ke To-Do List',
      gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: ListChecks,
      route: '/todos',
      actionText: 'Buka Daftar Tugas',
    },
    complete: {
      label: 'Tugas Selesai',
      desc: 'Satu lagi terselesaikan!',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Check,
      route: '/todos',
      actionText: 'Buka Daftar Tugas',
    },
  },
  budget: {
    create: {
      label: 'Budget Ditetapkan',
      desc: 'Batas anggaran bulan ini aktif',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: PiggyBank,
      route: '/budget',
      actionText: 'Lihat Anggaran',
    },
    update: {
      label: 'Budget Diperbarui',
      desc: 'Batas anggaran bulan ini diubah',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CircleDollarSign,
      route: '/budget',
      actionText: 'Lihat Anggaran',
    },
  },
  savings: {
    create: {
      label: 'Target Tabungan Dibuat',
      desc: 'Mulai kumpulkan dana sekarang',
      gradient: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Target,
      route: '/savings',
      actionText: 'Buka Tabungan',
    },
    add_funds: {
      label: 'Tabungan Bertambah',
      desc: 'Makin dekat dengan target',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: PlusCircle,
      route: '/savings',
      actionText: 'Buka Tabungan',
    },
  },
  recurring: {
    create: {
      label: 'Langganan Dijadwalkan',
      desc: 'Tercatat otomatis sesuai jadwal',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
      route: '/settings/recurring',
      actionText: 'Lihat Langganan',
    },
    update: {
      label: 'Langganan Diperbarui',
      desc: 'Penyesuaian jadwal atau nominal',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
      route: '/settings/recurring',
      actionText: 'Lihat Langganan',
    },
    delete: {
      label: 'Langganan Dibatalkan',
      desc: 'Tidak akan ditagih lagi',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Trash2,
      route: '/settings/recurring',
      actionText: 'Lihat Langganan',
    },
  },
  export: {
    create: {
      label: 'Laporan Siap',
      desc: 'Pengunduhan segera dimulai',
      gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Check,
      route: '/reports',
      actionText: 'Buka Laporan',
    },
  },
}

export default function ActionSuccessCard({ type = 'todo', action = 'create', title = '', subtitle = '', embedded = false }) {
  const navigate = useNavigate()
  const onClose = useChatStore((s) => s.closeChat)
  const locale = useSettingsStore((s) => s.locale)
  const isId = locale === 'id'

  const cfg = CONFIG[type]?.[action] || CONFIG.todo?.create || CONFIG.habit.create
  const IconComp = cfg.Icon

  const handleActionClick = () => {
    if (onClose) onClose()
    if (cfg.route) {
      navigate(cfg.route)
    }
  }

  const containerClasses = embedded
    ? "ft-action-card rounded-xl border border-[var(--border)]/60 bg-[var(--bg)]/50 overflow-hidden mt-1"
    : "ft-action-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden shadow-xs"

  return (
    <div className={containerClasses}>
      {/* Banner */}
      <div className="ft-action-banner flex items-center justify-between p-3" style={{ background: cfg.gradient }}>
        <div className="flex items-center gap-2.5">
          <div className="ft-action-banner-icon flex h-7 w-7 items-center justify-center rounded-full" style={{ background: cfg.iconBg }}>
            <IconComp size={15} strokeWidth={2.5} color="white" />
          </div>
          <div className="ft-action-banner-content flex flex-col">
            <span className="text-xs font-bold text-white leading-tight">{cfg.label}</span>
            <span className="text-[10px] text-white/80 font-medium">{cfg.desc}</span>
          </div>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-xs">
          <svg className="w-3.5 h-3.5 stroke-white" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" className="ft-check-animated" />
          </svg>
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[var(--fg)] truncate">{title}</div>
          {subtitle && <div className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</div>}
        </div>
        {cfg.actionText && (
          <button
            type="button"
            onClick={handleActionClick}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all active:scale-95 shrink-0"
          >
            <span>{cfg.actionText}</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
