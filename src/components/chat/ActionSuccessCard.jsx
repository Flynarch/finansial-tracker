import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  ArrowRightLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import BudgetStatusWidget from './widgets/BudgetStatusWidget'
import HabitCardWidget from './widgets/HabitCardWidget'
import TodoCardWidget from './widgets/TodoCardWidget'
import SavingsCardWidget from './widgets/SavingsCardWidget'
import RecurringCardWidget from './widgets/RecurringCardWidget'
import LoanCardWidget from './widgets/LoanCardWidget'
import FinancialHealthWidget from './widgets/FinancialHealthWidget'

const CONFIG = {
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
  habit: {
    log_all: {
      labelKey: 'ai.action.habitsLogged',
      label: 'Semua Kebiasaan Selesai',
      descKey: 'ai.action.habitsLoggedDesc',
      desc: 'Berhasil dicentang untuk hari ini',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: CheckCircle2,
      route: '/habits',
      actionKey: 'ai.action.viewHabits',
    },
  },
  export: {
    export: {
      labelKey: 'ai.action.exportSuccess',
      label: 'Ekspor Data Berhasil',
      descKey: 'ai.action.exportSuccessDesc',
      desc: 'Berkas berhasil diekspor',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
      Icon: FileSpreadsheet,
      route: '/settings',
      actionKey: 'ai.action.viewSettings',
    },
  },
}

export default function ActionSuccessCard({ type = 'todo', action = 'create', title = '', subtitle = '', data = {} }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onClose = useChatStore((s) => s.closeChat)

  // Rich Domain-Specific Widgets
  if (type === 'budget') {
    return (
      <BudgetStatusWidget
        category={data?.category || title}
        limit={data?.limit ?? data?.amount}
        spent={data?.spent}
        currency={data?.currency}
        action={action}
      />
    )
  }

  if (type === 'habit' && action !== 'log_all') {
    return (
      <HabitCardWidget
        habitId={data?.id}
        title={data?.title || title}
        color={data?.color}
        frequencyType={data?.frequencyType}
        action={action}
      />
    )
  }

  if (type === 'todo') {
    return (
      <TodoCardWidget
        todoId={data?.id}
        title={data?.title || title}
        category={data?.category}
        dueDate={data?.dueDate}
        priority={data?.priority}
        subTasks={data?.subTasks}
        action={action}
        completed={Boolean(data?.completed || action === 'done' || action === 'complete')}
      />
    )
  }

  if (type === 'savings') {
    return (
      <SavingsCardWidget
        title={data?.title || title}
        targetAmount={data?.targetAmount ?? data?.target}
        currentAmount={data?.currentAmount ?? data?.current ?? data?.amount}
        currency={data?.currency}
        action={action}
      />
    )
  }

  if (type === 'recurring') {
    return (
      <RecurringCardWidget
        title={data?.title || title}
        amount={data?.amount}
        frequency={data?.frequency}
        currency={data?.currency}
        category={data?.category}
        action={action}
      />
    )
  }

  if (type === 'loan') {
    return (
      <LoanCardWidget
        loanId={data?.id}
        title={data?.title || title}
        personName={data?.personName}
        loanType={data?.type || data?.loanType}
        amount={data?.amount}
        remainingAmount={data?.remainingAmount}
        dueDate={data?.dueDate}
        currency={data?.currency}
        action={action}
      />
    )
  }

  if (type === 'financial_health' || type === 'health') {
    return (
      <FinancialHealthWidget
        score={data?.score}
        rating={data?.rating}
        savingsRate={data?.metrics?.savingsRatio ?? data?.savingsRatio ?? data?.savingsRate}
        expenseVelocity={data?.metrics?.monthlyIncome > 0 ? Math.round((data.metrics.monthlyExpense / data.metrics.monthlyIncome) * 100) : null}
        debtRatio={data?.metrics?.dti ?? data?.dti ?? data?.debtRatio}
        budgetCompliance={data?.metrics?.emergencyMonths != null ? Math.min(100, Math.round(data.metrics.emergencyMonths / 6 * 100)) : null}
        onAction={data?.onAction}
      />
    )
  }

  const fallbackCfg = {
    labelKey: 'ai.action.success',
    label: 'Tindakan Berhasil',
    descKey: 'ai.action.processed',
    desc: 'Berhasil diproses',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500',
    Icon: CheckCircle2,
    route: null,
    actionKey: null,
  }

  const cfg = CONFIG[type]?.[action] || fallbackCfg
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
    <div className="relative rounded-2xl border border-[var(--border)]/70 bg-[var(--panel-strong)]/85 backdrop-blur-md shadow-sm overflow-hidden my-1 ft-msg-enter">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-[var(--accent)]/30" />

      {/* Header Banner */}
      <div className="p-3 flex items-center justify-between border-b border-[var(--border)]/40">
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--field-bg)]/60 border border-[var(--border)]/60 px-3 py-1.5 text-[11px] font-bold text-[var(--fg)] hover:border-[var(--accent)]/50 hover:bg-[var(--field-bg)] transition active:scale-95 shrink-0 shadow-2xs cursor-pointer"
          >
            <span>{actionText}</span>
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}


