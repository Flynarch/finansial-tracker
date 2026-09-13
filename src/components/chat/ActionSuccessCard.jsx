import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  ArrowRightLeft,
  ArrowRight,
} from 'lucide-react'
import useChatStore from '../../store/useChatStore'
import useTranslation from '../../hooks/useTranslation'
import BudgetStatusWidget from './widgets/BudgetStatusWidget'
import HabitCardWidget from './widgets/HabitCardWidget'
import TodoCardWidget from './widgets/TodoCardWidget'
import SavingsCardWidget from './widgets/SavingsCardWidget'
import RecurringCardWidget from './widgets/RecurringCardWidget'
import LoanCardWidget from './widgets/LoanCardWidget'

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

  if (type === 'habit') {
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
        title={data?.title || title}
        personName={data?.personName}
        loanType={data?.type || data?.loanType}
        amount={data?.amount}
        dueDate={data?.dueDate}
        currency={data?.currency}
        action={action}
      />
    )
  }

  const cfg = CONFIG[type]?.[action] || CONFIG.wallet?.create
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
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm overflow-hidden my-1 animate-in fade-in slide-in-from-top-2 duration-200">
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
    </div>
  )
}

ActionSuccessCard.propTypes = {
  type: PropTypes.string,
  action: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  data: PropTypes.object,
}

