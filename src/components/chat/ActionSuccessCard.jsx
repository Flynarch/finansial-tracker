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
import useTranslation from '../../hooks/useTranslation'

const CONFIG = {
  habit: {
    create: {
      labelKey: 'ai.action.habitCreated',
      descKey: 'ai.action.habitCreatedDesc',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: Flame,
      route: '/todos',
      actionKey: 'ai.action.viewHabit',
    },
    log: {
      labelKey: 'ai.action.habitLogged',
      descKey: 'ai.action.habitLoggedDesc',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CalendarCheck,
      route: '/todos',
      actionKey: 'ai.action.viewHabit',
    },
    log_all: {
      labelKey: 'ai.action.allHabitsLogged',
      descKey: 'ai.action.allHabitsLoggedDesc',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CalendarCheck,
      route: '/todos',
      actionKey: 'ai.action.viewHabit',
    },
  },
  todo: {
    create: {
      labelKey: 'ai.action.taskCreated',
      descKey: 'ai.action.taskCreatedDesc',
      badgeClass: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      Icon: ListChecks,
      route: '/todos',
      actionKey: 'ai.action.viewTask',
    },
    done: {
      labelKey: 'ai.action.taskDone',
      descKey: 'ai.action.taskDoneDesc',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: Check,
      route: '/todos',
      actionKey: 'ai.action.viewTask',
    },
  },
  budget: {
    create: {
      labelKey: 'ai.action.budgetSet',
      descKey: 'ai.action.budgetSetDesc',
      badgeClass: 'bg-amber-500/15 border-amber-500/25 text-amber-500',
      Icon: CircleDollarSign,
      route: '/budget',
      actionKey: 'ai.action.viewBudget',
    },
    update: {
      labelKey: 'ai.action.budgetUpdated',
      descKey: 'ai.action.budgetUpdatedDesc',
      badgeClass: 'bg-amber-500/15 border-amber-500/25 text-amber-500',
      Icon: CircleDollarSign,
      route: '/budget',
      actionKey: 'ai.action.viewBudget',
    },
  },
  savings: {
    create: {
      labelKey: 'ai.action.savingsCreated',
      descKey: 'ai.action.savingsCreatedDesc',
      badgeClass: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      Icon: Target,
      route: '/savings',
      actionKey: 'ai.action.viewSavings',
    },
    add: {
      labelKey: 'ai.action.savingsDeposit',
      descKey: 'ai.action.savingsDepositDesc',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: PiggyBank,
      route: '/savings',
      actionKey: 'ai.action.viewSavings',
    },
  },
  recurring: {
    create: {
      labelKey: 'ai.action.recurringCreated',
      descKey: 'ai.action.recurringCreatedDesc',
      badgeClass: 'bg-[var(--accent)]/15 border-[var(--accent)]/25 text-[var(--accent)]',
      Icon: CircleDollarSign,
      route: '/settings/recurring',
      actionKey: 'ai.action.viewRecurring',
    },
  },
  wallet: {
    create: {
      labelKey: 'ai.action.walletCreated',
      descKey: 'ai.action.walletCreatedDesc',
      badgeClass: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
      Icon: Wallet,
      route: '/dashboard',
      actionKey: 'ai.action.viewWallet',
    },
    transfer: {
      labelKey: 'ai.action.transferSuccess',
      descKey: 'ai.action.transferSuccessDesc',
      badgeClass: 'bg-sky-500/15 border-sky-500/25 text-sky-500',
      Icon: ArrowRightLeft,
      route: '/dashboard',
      actionKey: 'ai.action.viewWallet',
    },
  },
  loan: {
    create: {
      labelKey: 'ai.action.loanCreated',
      descKey: 'ai.action.loanCreatedDesc',
      badgeClass: 'bg-rose-500/15 border-rose-500/25 text-rose-500',
      Icon: HandCoins,
      route: '/loans',
      actionKey: 'ai.action.viewLoan',
    },
    pay: {
      labelKey: 'ai.action.loanPaid',
      descKey: 'ai.action.loanPaidDesc',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CheckCircle2,
      route: '/loans',
      actionKey: 'ai.action.viewLoan',
    },
  },
}

export default function ActionSuccessCard({ type = 'todo', action = 'create', title = '', subtitle = '' }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  const cfg = CONFIG[type]?.[action] || CONFIG.todo?.create || CONFIG.habit.create
  const IconComp = cfg.Icon

  const label = t(cfg.labelKey, cfg.label || 'Tindakan Berhasil')
  const desc = t(cfg.descKey, cfg.desc || 'Berhasil diproses')
  const actionText = cfg.actionKey ? t(cfg.actionKey, 'Lihat') : null

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
            <span className="text-xs font-black text-[var(--fg)] leading-tight">{label}</span>
            <span className="text-[10px] text-[var(--muted)] font-medium">{desc}</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-[var(--fg)] truncate">{title}</div>
          {subtitle && <div className="text-[10.5px] font-medium text-[var(--muted)] mt-0.5">{subtitle}</div>}
        </div>
        {actionText && (
          <button
            type="button"
            onClick={handleActionClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--panel)] transition active:scale-95 shrink-0 shadow-2xs cursor-pointer"
          >
            <span>{actionText}</span>
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
