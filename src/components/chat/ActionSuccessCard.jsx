import React from 'react'
import { Check, ListChecks, PiggyBank, Flame, CalendarCheck, CircleDollarSign, Target, PlusCircle, Trash2 } from 'lucide-react'

const CONFIG = {
  habit: {
    create: {
      label: 'Habit Baru Dibuat',
      desc: 'Ditambahkan ke daftar kebiasaan harian',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Flame,
    },
    log: {
      label: 'Habit Tercatat',
      desc: 'Konsistensi hari ini terjaga',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
    },
    log_all: {
      label: 'Semua Habit Tercatat',
      desc: 'Konsistensi harian sempurna!',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
    },
  },
  todo: {
    create: {
      label: 'Tugas Ditambahkan',
      desc: 'Masuk ke To-Do List',
      gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: ListChecks,
    },
    complete: {
      label: 'Tugas Selesai',
      desc: 'Satu lagi terselesaikan!',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Check,
    },
  },
  budget: {
    create: {
      label: 'Budget Ditetapkan',
      desc: 'Batas anggaran bulan ini aktif',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: PiggyBank,
    },
    update: {
      label: 'Budget Diperbarui',
      desc: 'Batas anggaran bulan ini diubah',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CircleDollarSign,
    },
  },
  savings: {
    create: {
      label: 'Target Tabungan Dibuat',
      desc: 'Mulai kumpulkan dana sekarang',
      gradient: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Target,
    },
    add_funds: {
      label: 'Tabungan Bertambah',
      desc: 'Makin dekat dengan target',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: PlusCircle,
    },
  },
  recurring: {
    create: {
      label: 'Langganan Dijadwalkan',
      desc: 'Tercatat otomatis sesuai jadwal',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
    },
    update: {
      label: 'Langganan Diperbarui',
      desc: 'Penyesuaian jadwal atau nominal',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: CalendarCheck,
    },
    delete: {
      label: 'Langganan Dibatalkan',
      desc: 'Tidak akan ditagih lagi',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Trash2,
    },
  },
  export: {
    create: {
      label: 'Laporan Siap',
      desc: 'Pengunduhan segera dimulai',
      gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
      iconBg: 'rgba(255,255,255,0.2)',
      Icon: Check,
    },
  },
}

export default function ActionSuccessCard({ type, action, title, subtitle }) {
  const cfg = CONFIG[type]?.[action] || CONFIG.habit.create
  const IconComp = cfg.Icon

  return (
    <div className="ft-action-card">
      {/* Banner */}
      <div className="ft-action-banner" style={{ background: cfg.gradient }}>
        <div className="ft-action-banner-icon" style={{ background: cfg.iconBg }}>
          <IconComp size={16} strokeWidth={2.5} color="white" />
        </div>
        <div className="ft-action-banner-content">
          <span className="ft-action-banner-label">{cfg.label}</span>
          <span className="ft-action-banner-desc">{cfg.desc}</span>
        </div>
        {/* Decorative check circle */}
        <div className="ft-action-banner-check">
          <Check size={14} strokeWidth={3} color="white" />
        </div>
      </div>

      {/* Body */}
      <div className="ft-action-body">
        <div className="ft-action-body-title">{title}</div>
        {subtitle && <div className="ft-action-body-sub">{subtitle}</div>}
      </div>
    </div>
  )
}
