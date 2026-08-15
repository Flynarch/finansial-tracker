import { useNavigate } from 'react-router-dom'
import {
  Check,
  ListChecks,
  PiggyBank,
  Flame,
  CalendarCheck,
  CircleDollarSign,
  Target,
  ArrowRight,
  Wallet,
  ArrowRightLeft,
  HandCoins,
  CheckCircle2,
} from 'lucide-react'
import useChatStore from '../../store/useChatStore'

const CONFIG = {
  habit: {
    create: {
      label: 'Habit Baru Dibuat',
      desc: 'Ditambahkan ke daftar kebiasaan harian',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: Flame,
      route: '/todos',
      actionText: 'Lihat Habit',
    },
    log: {
      label: 'Habit Tercatat',
      desc: 'Konsistensi hari ini terjaga',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CalendarCheck,
      route: '/todos',
      actionText: 'Lihat Habit',
    },
    log_all: {
      label: 'Semua Habit Tercatat',
      desc: 'Konsistensi harian sempurna!',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CalendarCheck,
      route: '/todos',
      actionText: 'Lihat Habit',
    },
  },
  todo: {
    create: {
      label: 'Tugas Baru Dibuat',
      desc: 'Ditambahkan ke daftar To-Do Anda',
      badgeClass: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      Icon: ListChecks,
      route: '/todos',
      actionText: 'Lihat Tugas',
    },
    done: {
      label: 'Tugas Selesai',
      desc: 'Berhasil diselesaikan',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: Check,
      route: '/todos',
      actionText: 'Lihat Tugas',
    },
  },
  budget: {
    create: {
      label: 'Anggaran Berhasil Diset',
      desc: 'Batas pengeluaran kategori diperbarui',
      badgeClass: 'bg-amber-500/15 border-amber-500/25 text-amber-500',
      Icon: CircleDollarSign,
      route: '/budget',
      actionText: 'Lihat Anggaran',
    },
    update: {
      label: 'Anggaran Diperbarui',
      desc: 'Batas pengeluaran telah disesuaikan',
      badgeClass: 'bg-amber-500/15 border-amber-500/25 text-amber-500',
      Icon: CircleDollarSign,
      route: '/budget',
      actionText: 'Lihat Anggaran',
    },
  },
  savings: {
    create: {
      label: 'Target Tabungan Dibuat',
      desc: 'Tujuan baru berhasil ditambahkan',
      badgeClass: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      Icon: Target,
      route: '/savings',
      actionText: 'Lihat Tabungan',
    },
    add: {
      label: 'Setoran Tabungan Berhasil',
      desc: 'Progres impian Anda bertambah',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: PiggyBank,
      route: '/savings',
      actionText: 'Lihat Tabungan',
    },
  },
  recurring: {
    create: {
      label: 'Tagihan Rutin Dibuat',
      desc: 'Jadwal transaksi berulang dikonfigurasi',
      badgeClass: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      Icon: CircleDollarSign,
      route: '/settings/recurring',
      actionText: 'Lihat Jadwal',
    },
  },
  wallet: {
    create: {
      label: 'Dompet Baru Dibuat',
      desc: 'Akun baru siap digunakan',
      badgeClass: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
      Icon: Wallet,
      route: '/dashboard',
      actionText: 'Lihat Dompet',
    },
    transfer: {
      label: 'Transfer Saldo Berhasil',
      desc: 'Pemindahan dana antar dompet selesai',
      badgeClass: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
      Icon: ArrowRightLeft,
      route: '/dashboard',
      actionText: 'Lihat Dompet',
    },
  },
  loan: {
    create: {
      label: 'Catatan Pinjaman Dibuat',
      desc: 'Utang / piutang berhasil dicatat',
      badgeClass: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
      Icon: HandCoins,
      route: '/loans',
      actionText: 'Lihat Pinjaman',
    },
    pay: {
      label: 'Cicilan Berhasil Dicatat',
      desc: 'Sisa tagihan pinjaman telah berkurang',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CheckCircle2,
      route: '/loans',
      actionText: 'Lihat Pinjaman',
    },
  },
}

export default function ActionSuccessCard({ type = 'todo', action = 'create', title = '', subtitle = '' }) {
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

  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm overflow-hidden my-1">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-[var(--accent)]/30" />

      {/* Header Banner */}
      <div className="p-3 flex items-center justify-between border-b border-[var(--border)]/50">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-xl border flex items-center justify-center shadow-2xs ${cfg.badgeClass}`}>
            <IconComp size={15} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-[var(--fg)] leading-tight">{cfg.label}</span>
            <span className="text-[10px] text-[var(--muted)] font-medium">{cfg.desc}</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-[var(--fg)] truncate">{title}</div>
          {subtitle && <div className="text-[10.5px] font-medium text-[var(--muted)] mt-0.5">{subtitle}</div>}
        </div>
        {cfg.actionText && (
          <button
            type="button"
            onClick={handleActionClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--panel)] transition active:scale-95 shrink-0 shadow-2xs cursor-pointer"
          >
            <span>{cfg.actionText}</span>
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Perforated Tear Line */}
      <div className="relative flex items-center px-3 py-0.5">
        <div className="absolute -left-2 h-4 w-4 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
        <div className="w-full border-t border-dashed border-[var(--border-strong)]/50" />
        <div className="absolute -right-2 h-4 w-4 rounded-full bg-[var(--bg)] border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" />
      </div>

      {/* Footer */}
      <div className="p-2 bg-[var(--field-bg)]/40 flex items-center justify-end">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent)]">
          FinTrack Verified
        </span>
      </div>
    </div>
  )
}
