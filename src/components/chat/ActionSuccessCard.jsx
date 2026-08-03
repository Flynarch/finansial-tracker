import { useNavigate } from 'react-router-dom'
import { Check, ListChecks, PiggyBank, Flame, CalendarCheck, CircleDollarSign, Target, PlusCircle, Trash2, ArrowRight, Wallet, ArrowRightLeft, HandCoins, CheckCircle2 } from 'lucide-react'
import useChatStore from '../../store/useChatStore'

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
      label: 'Tugas Baru Dibuat',
      desc: 'Ditambahkan ke daftar To-Do Anda',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: ListChecks,
      route: '/todos',
      actionText: 'Lihat Tugas',
    },
    done: {
      label: 'Tugas Selesai',
      desc: 'Berhasil diselesaikan',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Check,
      route: '/todos',
      actionText: 'Lihat Tugas',
    },
  },
  budget: {
    create: {
      label: 'Anggaran Berhasil Diset',
      desc: 'Batas pengeluaran kategori diperbarui',
      gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CircleDollarSign,
      route: '/budget',
      actionText: 'Lihat Anggaran',
    },
    update: {
      label: 'Anggaran Diperbarui',
      desc: 'Batas pengeluaran telah disesuaikan',
      gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CircleDollarSign,
      route: '/budget',
      actionText: 'Lihat Anggaran',
    },
  },
  savings: {
    create: {
      label: 'Target Tabungan Dibuat',
      desc: 'Tujuan baru berhasil ditambahkan',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Target,
      route: '/savings',
      actionText: 'Lihat Tabungan',
    },
    add: {
      label: 'Setoran Tabungan Berhasil',
      desc: 'Progres impian Anda bertambah',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: PiggyBank,
      route: '/savings',
      actionText: 'Lihat Tabungan',
    },
  },
  recurring: {
    create: {
      label: 'Tagihan Rutin Dibuat',
      desc: 'Jadwal transaksi berulang dikonfigurasi',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: PlusCircle,
      route: '/settings/recurring',
      actionText: 'Lihat Langganan',
    },
    delete: {
      label: 'Tagihan Berhasil Dibatalkan',
      desc: 'Transaksi berulang dihapus dari sistem',
      gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
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
  wallet: {
    create: {
      label: 'Dompet Baru Dibuat',
      desc: 'Siap digunakan untuk transaksi',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Wallet,
      route: '/dashboard',
      actionText: 'Lihat Dompet',
    },
    transfer: {
      label: 'Transfer Saldo Berhasil',
      desc: 'Pemindahan antar dompet dicatat',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: ArrowRightLeft,
      route: '/dashboard',
      actionText: 'Lihat Dompet',
    },
  },
  loan: {
    create: {
      label: 'Catatan Pinjaman Dibuat',
      desc: 'Berhasil ditambahkan ke daftar Utang & Piutang',
      gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: HandCoins,
      route: '/loans',
      actionText: 'Lihat Pinjaman',
    },
    pay: {
      label: 'Cicilan Berhasil Dicatat',
      desc: 'Sisa tagihan pinjaman telah berkurang',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CheckCircle2,
      route: '/loans',
      actionText: 'Lihat Pinjaman',
    },
  },
}

export default function ActionSuccessCard({ type = 'todo', action = 'create', title = '', subtitle = '', embedded = false }) {
  const navigate = useNavigate()
  const onClose = useChatStore((s) => s.closeChat)

  const cfg = CONFIG[type]?.[action] || CONFIG.todo?.create || CONFIG.habit.create
  const IconComp = cfg.Icon

  const handleActionClick = () => {
    if (onClose) onClose()
    if (cfg.route) {
      navigate(cfg.route)
    }
  }

  const containerClasses = embedded
    ? "ft-action-card rounded-2xl border border-[var(--border)]/60 bg-[var(--bg)]/40 backdrop-blur-md overflow-hidden mt-1.5 shadow-xs"
    : "ft-action-card rounded-2xl border border-[var(--border)]/80 bg-[var(--panel-strong)]/90 backdrop-blur-md overflow-hidden shadow-sm"

  return (
    <div className={containerClasses}>
      {/* Banner */}
      <div className="ft-action-banner flex items-center justify-between p-3.5" style={{ background: cfg.gradient }}>
        <div className="flex items-center gap-3">
          <div className="ft-action-banner-icon flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-md" style={{ background: cfg.iconBg }}>
            <IconComp size={16} strokeWidth={2.5} color="white" />
          </div>
          <div className="ft-action-banner-content flex flex-col">
            <span className="text-[12.5px] font-extrabold text-white leading-tight">{cfg.label}</span>
            <span className="text-[10px] text-white/85 font-semibold">{cfg.desc}</span>
          </div>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shrink-0">
          <svg className="w-3.5 h-3.5 stroke-white" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" className="ft-check-animated" />
          </svg>
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 flex items-center justify-between gap-3 bg-[var(--panel-strong)]/60 backdrop-blur-xs">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-[var(--fg)] truncate">{title}</div>
          {subtitle && <div className="text-[11px] font-semibold text-[var(--muted)] mt-0.5">{subtitle}</div>}
        </div>
        {cfg.actionText && (
          <button
            type="button"
            onClick={handleActionClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] transition-all active:scale-95 shrink-0 shadow-2xs"
          >
            <span>{cfg.actionText}</span>
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
