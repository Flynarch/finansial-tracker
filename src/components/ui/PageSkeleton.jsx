/**
 * Page-specific skeleton loading component.
 * Replaces generic spinning circle loaders with contextual shimmer placeholders
 * that mimic each page's actual layout structure.
 *
 * Uses existing `ft-skeleton` CSS class for shimmer pulse animation.
 *
 * @param {object} props
 * @param {'dashboard'|'transactions'|'calendar'|'budget'|'reports'|'loans'|'savings'|'savings-detail'|'todo'|'todo-detail'|'profile'|'wallet-detail'|'settings'|'chat'|'add-account'|'generic'} [props.variant='generic']
 */

/* ── Shared primitives ──────────────────────────────────────────────── */

function SkeletonBar({ className = '' }) {
  return <div className={`ft-skeleton !rounded-md ${className}`} />
}

function SkeletonCircle({ className = '' }) {
  return <div className={`ft-skeleton !rounded-full ${className}`} />
}

function SkeletonCard({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-xs ${className}`}>
      {children}
    </div>
  )
}

function SkeletonListItem({ showIcon = true }) {
  return (
    <div className="flex items-center justify-between p-3 gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showIcon && (
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
        )}
        <div className="space-y-1.5 flex-1 min-w-0">
          <SkeletonBar className="h-3.5 w-24" />
          <SkeletonBar className="h-2.5 w-36" />
        </div>
      </div>
      <SkeletonBar className="h-4 w-20 shrink-0" />
    </div>
  )
}

function SkeletonDateGroup({ items = 3 }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <SkeletonBar className="h-3 w-28" />
        <div className="h-px flex-1 bg-[var(--border)]/40" />
        <SkeletonBar className="h-3 w-16" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
        {Array.from({ length: items }, (_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </section>
  )
}

function SkeletonPageHeader() {
  return (
    <div className="flex items-center justify-between mb-4">
      <SkeletonBar className="h-6 w-32" />
      <SkeletonCircle className="h-9 w-9" />
    </div>
  )
}

function SkeletonBackHeader() {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-10 w-10 shrink-0 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]" />
      <SkeletonBar className="h-5 w-36" />
    </div>
  )
}

/* ── Variant: Dashboard ─────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Wallet Carousel Hero */}
      <SkeletonCard className="!p-5 space-y-4" style={{ minHeight: '160px' }}>
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="h-5 w-16 !rounded-full" />
        </div>
        <SkeletonBar className="h-8 w-44" />
        <div className="flex gap-6">
          <div className="space-y-1">
            <SkeletonBar className="h-2.5 w-16" />
            <SkeletonBar className="h-4 w-24" />
          </div>
          <div className="space-y-1">
            <SkeletonBar className="h-2.5 w-16" />
            <SkeletonBar className="h-4 w-24" />
          </div>
        </div>
      </SkeletonCard>

      {/* Recent Transactions */}
      <SkeletonCard className="!p-3 space-y-1">
        <div className="flex items-center justify-between px-1 pb-2">
          <SkeletonBar className="h-3.5 w-32" />
          <SkeletonBar className="h-3 w-16" />
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonListItem key={i} />
        ))}
      </SkeletonCard>

      {/* Net Worth Chart */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-3.5 w-28" />
          <SkeletonBar className="h-5 w-24 !rounded-full" />
        </div>
        <SkeletonBar className="h-7 w-36" />
        <div className="h-20 w-full rounded-xl bg-[var(--field-bg)]/60" />
      </SkeletonCard>

      {/* Bento Cards */}
      <div className="grid grid-cols-2 gap-3">
        <SkeletonCard className="space-y-3" style={{ minHeight: '96px' }}>
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-5 w-20" />
          <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)]" />
        </SkeletonCard>
        <SkeletonCard className="space-y-3" style={{ minHeight: '96px' }}>
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-5 w-20" />
          <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)]" />
        </SkeletonCard>
      </div>
    </div>
  )
}

/* ── Variant: Transactions ──────────────────────────────────────────── */

function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* Search Bar */}
      <div className="h-10 w-full rounded-xl bg-[var(--field-bg)] border border-[var(--border)]" />
      {/* Filter Chips */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBar key={i} className="h-7 w-16 !rounded-full" />
        ))}
      </div>
      {/* Transaction Groups */}
      <SkeletonDateGroup items={3} />
      <SkeletonDateGroup items={2} />
    </div>
  )
}

/* ── Variant: Calendar ──────────────────────────────────────────────── */

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* Month navigation */}
      <div className="flex items-center justify-between px-2">
        <SkeletonCircle className="h-8 w-8" />
        <SkeletonBar className="h-5 w-32" />
        <SkeletonCircle className="h-8 w-8" />
      </div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 px-1">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonBar key={i} className="h-3 mx-auto w-6" />
        ))}
      </div>
      {/* Calendar grid */}
      <SkeletonCard className="!p-2">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 py-2">
              <SkeletonBar className="h-3 w-5" />
              {i % 5 === 0 && <SkeletonCircle className="h-1.5 w-1.5" />}
            </div>
          ))}
        </div>
      </SkeletonCard>
      {/* Event list below calendar */}
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </div>
  )
}

/* ── Variant: Budget ────────────────────────────────────────────────── */

function BudgetSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* Month selector */}
      <div className="flex items-center justify-center gap-3">
        <SkeletonCircle className="h-8 w-8" />
        <SkeletonBar className="h-5 w-28" />
        <SkeletonCircle className="h-8 w-8" />
      </div>
      {/* Summary card */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-3.5 w-24" />
          <SkeletonBar className="h-3 w-20" />
        </div>
        <SkeletonBar className="h-7 w-36" />
        <div className="h-2 w-full rounded-full bg-[var(--field-bg)]" />
      </SkeletonCard>
      {/* Budget items */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="!p-3.5 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBar className="h-3.5 w-24" />
              <SkeletonBar className="h-2.5 w-32" />
            </div>
            <SkeletonBar className="h-4 w-20 shrink-0" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)]" />
        </SkeletonCard>
      ))}
    </div>
  )
}

/* ── Variant: Reports ───────────────────────────────────────────────── */

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="space-y-2" style={{ minHeight: '80px' }}>
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-6 w-24" />
            <SkeletonBar className="h-2.5 w-20" />
          </SkeletonCard>
        ))}
      </div>
      {/* Chart area */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-4 w-32" />
          <SkeletonBar className="h-6 w-20 !rounded-full" />
        </div>
        <div className="flex h-40 items-end gap-1.5 pt-6">
          {[40, 65, 45, 80, 55, 70, 35, 60, 75, 50, 85, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-[var(--field-bg)]"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </SkeletonCard>
      {/* Donut placeholder */}
      <SkeletonCard className="flex items-center gap-4 !p-5">
        <SkeletonCircle className="h-28 w-28 shrink-0" />
        <div className="flex-1 space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonCircle className="h-3 w-3" />
              <SkeletonBar className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  )
}

/* ── Variant: Loans ─────────────────────────────────────────────────── */

function LoansSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <SkeletonCard className="space-y-2" style={{ minHeight: '80px' }}>
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-6 w-24" />
        </SkeletonCard>
        <SkeletonCard className="space-y-2" style={{ minHeight: '80px' }}>
          <SkeletonBar className="h-3 w-16" />
          <SkeletonBar className="h-6 w-24" />
        </SkeletonCard>
      </div>
      {/* Tab chips */}
      <div className="flex gap-2">
        <SkeletonBar className="h-8 w-20 !rounded-full" />
        <SkeletonBar className="h-8 w-20 !rounded-full" />
        <SkeletonBar className="h-8 w-24 !rounded-full" />
      </div>
      {/* Loan items */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="!p-3.5 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBar className="h-3.5 w-28" />
              <SkeletonBar className="h-2.5 w-36" />
            </div>
            <SkeletonBar className="h-5 w-24 shrink-0" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)]" />
        </SkeletonCard>
      ))}
    </div>
  )
}

/* ── Variant: Savings ───────────────────────────────────────────────── */

function SavingsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* Summary hero */}
      <SkeletonCard className="space-y-3 !p-5">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-8 w-40" />
        <div className="flex gap-4">
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="h-3 w-20" />
        </div>
      </SkeletonCard>
      {/* Goal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="!p-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]/60" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-3.5 w-24" />
                <SkeletonBar className="h-2.5 w-32" />
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--field-bg)]" />
            <div className="flex justify-between">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-3 w-12" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

/* ── Variant: Savings Detail ────────────────────────────────────────── */

function SavingsDetailSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBackHeader />
      {/* Hero progress */}
      <SkeletonCard className="flex flex-col items-center !p-6 space-y-4">
        <SkeletonCircle className="h-28 w-28" />
        <SkeletonBar className="h-6 w-36" />
        <SkeletonBar className="h-3 w-48" />
        <div className="flex gap-3 w-full">
          <SkeletonBar className="h-10 flex-1 !rounded-xl" />
          <SkeletonBar className="h-10 flex-1 !rounded-xl" />
        </div>
      </SkeletonCard>
      {/* Fund history */}
      <SkeletonCard className="!p-3 space-y-1">
        <div className="px-1 pb-2">
          <SkeletonBar className="h-3.5 w-28" />
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonListItem key={i} />
        ))}
      </SkeletonCard>
    </div>
  )
}

/* ── Variant: Todo ──────────────────────────────────────────────────── */

function TodoSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* Filter tabs */}
      <div className="flex gap-2">
        <SkeletonBar className="h-8 w-16 !rounded-full" />
        <SkeletonBar className="h-8 w-16 !rounded-full" />
        <SkeletonBar className="h-8 w-20 !rounded-full" />
      </div>
      {/* Todo card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="!p-3 space-y-2.5" style={{ minHeight: '140px' }}>
            <div className="flex items-start gap-2.5">
              <SkeletonCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-3.5 w-3/4" />
                <SkeletonBar className="h-2.5 w-1/2" />
              </div>
            </div>
            <SkeletonBar className="h-2.5 w-20" />
            <div className="flex gap-1.5 mt-auto">
              <SkeletonBar className="h-5 w-12 !rounded-full" />
              <SkeletonBar className="h-5 w-14 !rounded-full" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

/* ── Variant: Todo Detail ───────────────────────────────────────────── */

function TodoDetailSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBackHeader />
      {/* Title & meta */}
      <div className="space-y-2">
        <SkeletonBar className="h-6 w-48" />
        <SkeletonBar className="h-3 w-32" />
      </div>
      {/* Progress */}
      <SkeletonCard className="space-y-3">
        <div className="flex justify-between">
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="h-3 w-12" />
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--field-bg)]" />
      </SkeletonCard>
      {/* Checklist items */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3">
            <SkeletonCircle className="h-5 w-5 shrink-0" />
            <SkeletonBar className={`h-3.5 ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Variant: Profile ───────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      {/* Avatar & User Info */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <SkeletonCircle className="h-20 w-20" />
        <SkeletonBar className="h-5 w-32" />
        <SkeletonBar className="h-3 w-44" />
      </div>
      {/* Menu sections */}
      <SkeletonCard className="!p-0 divide-y divide-[var(--border)]/40">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3.5 p-3.5">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--field-bg)]" />
            <SkeletonBar className="h-3.5 flex-1 max-w-[140px]" />
            <SkeletonBar className="h-3 w-4 shrink-0 ml-auto" />
          </div>
        ))}
      </SkeletonCard>
      <SkeletonCard className="!p-0 divide-y divide-[var(--border)]/40">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3.5 p-3.5">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--field-bg)]" />
            <SkeletonBar className="h-3.5 flex-1 max-w-[140px]" />
            <SkeletonBar className="h-3 w-4 shrink-0 ml-auto" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  )
}

/* ── Variant: Wallet Detail ─────────────────────────────────────────── */

function WalletDetailSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBackHeader />
      {/* Wallet balance hero */}
      <SkeletonCard className="flex flex-col items-center !p-6 space-y-3">
        <div className="h-14 w-14 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]" />
        <SkeletonBar className="h-5 w-28" />
        <SkeletonBar className="h-8 w-40" />
        <SkeletonBar className="h-3 w-36" />
      </SkeletonCard>
      {/* Transaction list */}
      <SkeletonDateGroup items={3} />
      <SkeletonDateGroup items={2} />
    </div>
  )
}

/* ── Variant: Settings ──────────────────────────────────────────────── */

function SettingsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--field-bg)]" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBar className="h-3.5 w-28" />
            <SkeletonBar className="h-2.5 w-44" />
          </div>
          <SkeletonBar className="h-3 w-4 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/* ── Variant: Chat ──────────────────────────────────────────────────── */

function ChatSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-[60vh]">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]/40">
        <SkeletonCircle className="h-9 w-9" />
        <div className="space-y-1.5">
          <SkeletonBar className="h-4 w-24" />
          <SkeletonBar className="h-2.5 w-16" />
        </div>
      </div>
      {/* Chat body placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="h-16 w-16 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)]" />
        <SkeletonBar className="h-5 w-36" />
        <SkeletonBar className="h-3 w-52" />
        {/* Quick action chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBar key={i} className="h-8 w-28 !rounded-full" />
          ))}
        </div>
      </div>
      {/* Input bar */}
      <div className="p-3 border-t border-[var(--border)]/40">
        <div className="h-10 w-full rounded-xl bg-[var(--field-bg)] border border-[var(--border)]" />
      </div>
    </div>
  )
}

/* ── Variant: Add Account ───────────────────────────────────────────── */

function AddAccountSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBackHeader />
      <SkeletonCard className="space-y-4 !p-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonBar className="h-3 w-20" />
            <div className="h-11 w-full rounded-xl bg-[var(--field-bg)] border border-[var(--border)]" />
          </div>
        ))}
        <SkeletonBar className="h-11 w-full !rounded-xl" />
      </SkeletonCard>
    </div>
  )
}

/* ── Variant: Generic fallback ──────────────────────────────────────── */

function GenericSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard className="space-y-3">
        <SkeletonBar className="h-4 w-2/5" />
        <SkeletonBar className="h-3 w-full" />
        <SkeletonBar className="h-3 w-4/5" />
        <SkeletonBar className="h-8 w-1/3 !rounded-lg mt-2" />
      </SkeletonCard>
      <SkeletonCard className="space-y-3">
        <SkeletonBar className="h-4 w-1/3" />
        <SkeletonBar className="h-3 w-full" />
        <SkeletonBar className="h-3 w-3/5" />
      </SkeletonCard>
    </div>
  )
}

/* ── Variant Map ────────────────────────────────────────────────────── */

const VARIANT_MAP = {
  dashboard: DashboardSkeleton,
  transactions: TransactionsSkeleton,
  calendar: CalendarSkeleton,
  budget: BudgetSkeleton,
  reports: ReportsSkeleton,
  loans: LoansSkeleton,
  savings: SavingsSkeleton,
  'savings-detail': SavingsDetailSkeleton,
  todo: TodoSkeleton,
  'todo-detail': TodoDetailSkeleton,
  profile: ProfileSkeleton,
  'wallet-detail': WalletDetailSkeleton,
  settings: SettingsSkeleton,
  chat: ChatSkeleton,
  'add-account': AddAccountSkeleton,
  generic: GenericSkeleton,
}



export default function PageSkeleton({ variant = 'generic' }) {
  const Component = VARIANT_MAP[variant] || GenericSkeleton

  return (
    <div
      role="status"
      aria-busy="true"
      className="w-full animate-in fade-in duration-200"
    >
      <Component />
    </div>
  )
}
