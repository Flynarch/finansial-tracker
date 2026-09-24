/**
 * Page-specific skeleton loading component with high-fidelity layout matching.
 * Provides contextual shimmer placeholders that mirror each page's actual visual hierarchy
 * to eliminate layout shift (CLS = 0) and prevent jarring skeleton flash.
 *
 * @param {object} props
 * @param {'dashboard'|'transactions'|'calendar'|'budget'|'reports'|'loans'|'savings'|'savings-detail'|'todo'|'todo-detail'|'profile'|'wallet-detail'|'settings'|'chat'|'add-account'|'generic'} [props.variant='generic']
 */

/* ── Shared primitives ──────────────────────────────────────────────── */

export function SkeletonBar({ className = '' }) {
  return <div className={`ft-skeleton !rounded-lg ${className}`} />
}

export function SkeletonCircle({ className = '' }) {
  return <div className={`ft-skeleton !rounded-full border border-[var(--border)]/40 shrink-0 ${className}`} />
}

export function SkeletonCard({ className = '', children, style }) {
  return (
    <div className={`ft-skeleton-card p-4 sm:p-5 shadow-xs ${className}`} style={style}>
      {children}
    </div>
  )
}

export function SkeletonListItem({ showIcon = true }) {
  return (
    <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showIcon && (
          <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
        )}
        <div className="space-y-1.5 flex-1 min-w-0">
          <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
          <SkeletonBar className="h-2.5 w-40 !rounded-md" />
        </div>
      </div>
      <SkeletonBar className="h-4.5 w-22 shrink-0 !rounded-lg" />
    </div>
  )
}

export function SkeletonDateGroup({ items = 3 }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2.5 px-1 py-1">
        <SkeletonBar className="h-3 w-28 !rounded-md" />
        <div className="h-px flex-1 bg-[var(--border)]/40" />
        <SkeletonBar className="h-3 w-16 !rounded-md" />
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
      <SkeletonBar className="h-6.5 w-36 !rounded-xl" />
      <SkeletonCircle className="h-9 w-9" />
    </div>
  )
}

function SkeletonBackHeader() {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
      <SkeletonBar className="h-5.5 w-40 !rounded-xl" />
    </div>
  )
}

/* ── Variant: Dashboard ─────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Wallet Carousel Hero Card */}
      <SkeletonCard className="!p-5 space-y-4" style={{ minHeight: '175px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonCircle className="h-6 w-6" />
            <SkeletonBar className="h-3.5 w-24 !rounded-md" />
          </div>
          <SkeletonBar className="h-6 w-20 !rounded-full" />
        </div>
        <div className="space-y-1.5">
          <SkeletonBar className="h-3 w-16 !rounded-md" />
          <SkeletonBar className="h-8.5 w-52 !rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5 rounded-xl border border-[var(--border)]/40 p-2.5 bg-[var(--panel)]">
            <SkeletonBar className="h-2.5 w-16 !rounded-md" />
            <SkeletonBar className="h-4 w-28 !rounded-lg" />
          </div>
          <div className="space-y-1.5 rounded-xl border border-[var(--border)]/40 p-2.5 bg-[var(--panel)]">
            <SkeletonBar className="h-2.5 w-16 !rounded-md" />
            <SkeletonBar className="h-4 w-28 !rounded-lg" />
          </div>
        </div>
      </SkeletonCard>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 p-2 rounded-2xl border border-[var(--border)]/40 bg-[var(--panel-strong)] shadow-2xs">
            <SkeletonCircle className="h-10 w-10" />
            <SkeletonBar className="h-2.5 w-12 !rounded-md" />
          </div>
        ))}
      </div>

      {/* Recent Transactions Card */}
      <SkeletonCard className="!p-3.5 space-y-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <SkeletonBar className="h-4 w-36 !rounded-lg" />
          <SkeletonBar className="h-3 w-16 !rounded-md" />
        </div>
        <div className="space-y-1 divide-y divide-[var(--border)]/40">
          {[1, 2, 3].map((i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      </SkeletonCard>

      {/* Net Worth Chart Placeholder */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-4 w-32 !rounded-lg" />
          <SkeletonBar className="h-6 w-24 !rounded-full" />
        </div>
        <SkeletonBar className="h-7 w-40 !rounded-lg" />
        <div className="h-24 w-full rounded-2xl ft-skeleton border border-[var(--border)]/40" />
      </SkeletonCard>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 gap-3">
        <SkeletonCard className="space-y-3" style={{ minHeight: '100px' }}>
          <SkeletonBar className="h-3 w-20 !rounded-md" />
          <SkeletonBar className="h-5 w-24 !rounded-lg" />
          <div className="h-2 w-full rounded-full ft-skeleton" />
        </SkeletonCard>
        <SkeletonCard className="space-y-3" style={{ minHeight: '100px' }}>
          <SkeletonBar className="h-3 w-20 !rounded-md" />
          <SkeletonBar className="h-5 w-24 !rounded-lg" />
          <div className="h-2 w-full rounded-full ft-skeleton" />
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
      <div className="h-11 w-full rounded-2xl ft-skeleton border border-[var(--border)]/50" />
      {/* Filter Chips */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBar key={i} className="h-7.5 w-18 !rounded-full" />
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
        <SkeletonBar className="h-5 w-32 !rounded-lg" />
        <SkeletonCircle className="h-8 w-8" />
      </div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 px-1">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonBar key={i} className="h-3 mx-auto w-6 !rounded-md" />
        ))}
      </div>
      {/* Calendar grid */}
      <SkeletonCard className="!p-2.5">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-2 rounded-xl ft-skeleton/40">
              <SkeletonBar className="h-3 w-5 !rounded-md" />
              {i % 4 === 0 && <SkeletonCircle className="h-1.5 w-1.5" />}
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
        <SkeletonBar className="h-5 w-28 !rounded-lg" />
        <SkeletonCircle className="h-8 w-8" />
      </div>
      {/* Summary card */}
      <SkeletonCard className="space-y-3 !p-5">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-3.5 w-24 !rounded-md" />
          <SkeletonBar className="h-3 w-20 !rounded-md" />
        </div>
        <SkeletonBar className="h-7 w-36 !rounded-lg" />
        <div className="h-2.5 w-full rounded-full ft-skeleton" />
      </SkeletonCard>
      {/* Budget items */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="!p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-36 !rounded-md" />
            </div>
            <SkeletonBar className="h-4.5 w-20 shrink-0 !rounded-lg" />
          </div>
          <div className="h-2 w-full rounded-full ft-skeleton" />
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
          <SkeletonCard key={i} className="space-y-2.5 !p-4" style={{ minHeight: '84px' }}>
            <SkeletonBar className="h-3 w-16 !rounded-md" />
            <SkeletonBar className="h-6 w-24 !rounded-lg" />
            <SkeletonBar className="h-2.5 w-20 !rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      {/* Chart area */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-4 w-32 !rounded-lg" />
          <SkeletonBar className="h-6 w-20 !rounded-full" />
        </div>
        <div className="flex h-40 items-end gap-2 pt-6">
          {[40, 65, 45, 80, 55, 70, 35, 60, 75, 50, 85, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md ft-skeleton border-t border-[var(--border)]/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </SkeletonCard>
      {/* Donut placeholder */}
      <SkeletonCard className="flex items-center gap-4 !p-5">
        <SkeletonCircle className="h-28 w-28 shrink-0" />
        <div className="flex-1 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonCircle className="h-3 w-3" />
              <SkeletonBar className="h-3 flex-1 !rounded-md" />
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
        <SkeletonCard className="space-y-2.5" style={{ minHeight: '84px' }}>
          <SkeletonBar className="h-3 w-16 !rounded-md" />
          <SkeletonBar className="h-6 w-24 !rounded-lg" />
        </SkeletonCard>
        <SkeletonCard className="space-y-2.5" style={{ minHeight: '84px' }}>
          <SkeletonBar className="h-3 w-16 !rounded-md" />
          <SkeletonBar className="h-6 w-24 !rounded-lg" />
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
        <SkeletonCard key={i} className="!p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-36 !rounded-md" />
            </div>
            <SkeletonBar className="h-5 w-24 shrink-0 !rounded-lg" />
          </div>
          <div className="h-2 w-full rounded-full ft-skeleton" />
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
        <SkeletonBar className="h-3 w-24 !rounded-md" />
        <SkeletonBar className="h-8.5 w-44 !rounded-xl" />
        <div className="flex gap-4 pt-1">
          <SkeletonBar className="h-3 w-24 !rounded-md" />
          <SkeletonBar className="h-3 w-24 !rounded-md" />
        </div>
      </SkeletonCard>
      {/* Goal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="!p-4 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-32 !rounded-md" />
              </div>
            </div>
            <div className="h-2 w-full rounded-full ft-skeleton" />
            <div className="flex justify-between items-center">
              <SkeletonBar className="h-3 w-20 !rounded-md" />
              <SkeletonBar className="h-3 w-14 !rounded-md" />
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
        <SkeletonBar className="h-6 w-36 !rounded-lg" />
        <SkeletonBar className="h-3 w-48 !rounded-md" />
        <div className="flex gap-3 w-full pt-2">
          <SkeletonBar className="h-11 flex-1 !rounded-2xl" />
          <SkeletonBar className="h-11 flex-1 !rounded-2xl" />
        </div>
      </SkeletonCard>
      {/* Fund history */}
      <SkeletonCard className="!p-3.5 space-y-1">
        <div className="px-1 pb-2">
          <SkeletonBar className="h-3.5 w-28 !rounded-md" />
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
        <SkeletonBar className="h-8 w-18 !rounded-full" />
        <SkeletonBar className="h-8 w-18 !rounded-full" />
        <SkeletonBar className="h-8 w-22 !rounded-full" />
      </div>
      {/* Todo card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="!p-4 space-y-3" style={{ minHeight: '135px' }}>
            <div className="flex items-start gap-3">
              <SkeletonCircle className="h-5.5 w-5.5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-3.5 w-3/4 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-1/2 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-2.5 w-24 !rounded-md" />
            <div className="flex gap-2 mt-auto pt-1">
              <SkeletonBar className="h-5.5 w-14 !rounded-full" />
              <SkeletonBar className="h-5.5 w-16 !rounded-full" />
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
        <SkeletonBar className="h-6.5 w-52 !rounded-xl" />
        <SkeletonBar className="h-3 w-36 !rounded-md" />
      </div>
      {/* Progress */}
      <SkeletonCard className="space-y-3">
        <div className="flex justify-between items-center">
          <SkeletonBar className="h-3 w-20 !rounded-md" />
          <SkeletonBar className="h-3 w-12 !rounded-md" />
        </div>
        <div className="h-2.5 w-full rounded-full ft-skeleton" />
      </SkeletonCard>
      {/* Checklist items */}
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-2xs">
            <SkeletonCircle className="h-5.5 w-5.5 shrink-0" />
            <SkeletonBar className={`h-3.5 !rounded-lg ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
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
        <SkeletonBar className="h-5 w-32 !rounded-lg" />
        <SkeletonBar className="h-3 w-44 !rounded-md" />
      </div>
      {/* Menu sections */}
      <SkeletonCard className="!p-0 divide-y divide-[var(--border)]/40 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3.5 p-3.5">
            <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
            <SkeletonBar className="h-3.5 flex-1 max-w-[150px] !rounded-lg" />
            <SkeletonBar className="h-3 w-4 shrink-0 ml-auto !rounded-md" />
          </div>
        ))}
      </SkeletonCard>
      <SkeletonCard className="!p-0 divide-y divide-[var(--border)]/40 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3.5 p-3.5">
            <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
            <SkeletonBar className="h-3.5 flex-1 max-w-[150px] !rounded-lg" />
            <SkeletonBar className="h-3 w-4 shrink-0 ml-auto !rounded-md" />
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
      <SkeletonCard className="flex flex-col items-center !p-6 space-y-3.5 text-center">
        <div className="h-14 w-14 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
        <SkeletonBar className="h-4.5 w-28 !rounded-lg" />
        <SkeletonBar className="h-8.5 w-44 !rounded-xl" />
        <SkeletonBar className="h-3 w-36 !rounded-md" />
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
        <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-2xs">
          <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
            <SkeletonBar className="h-2.5 w-48 !rounded-md" />
          </div>
          <SkeletonBar className="h-3 w-4 shrink-0 !rounded-md" />
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
          <SkeletonBar className="h-4 w-24 !rounded-lg" />
          <SkeletonBar className="h-2.5 w-16 !rounded-md" />
        </div>
      </div>
      {/* Chat body placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="h-16 w-16 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
        <SkeletonBar className="h-5 w-36 !rounded-lg" />
        <SkeletonBar className="h-3 w-52 !rounded-md" />
        {/* Quick action chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBar key={i} className="h-8 w-28 !rounded-full" />
          ))}
        </div>
      </div>
      {/* Input bar */}
      <div className="p-3 border-t border-[var(--border)]/40">
        <div className="h-11 w-full rounded-2xl ft-skeleton border border-[var(--border)]/50" />
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
            <SkeletonBar className="h-3 w-20 !rounded-md" />
            <div className="h-12 w-full rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          </div>
        ))}
        <SkeletonBar className="h-12 w-full !rounded-2xl" />
      </SkeletonCard>
    </div>
  )
}

/* ── Variant: Generic fallback ──────────────────────────────────────── */

function GenericSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard className="space-y-3.5">
        <SkeletonBar className="h-4 w-2/5 !rounded-lg" />
        <SkeletonBar className="h-3 w-full !rounded-md" />
        <SkeletonBar className="h-3 w-4/5 !rounded-md" />
        <SkeletonBar className="h-9 w-1/3 !rounded-xl mt-2" />
      </SkeletonCard>
      <SkeletonCard className="space-y-3.5">
        <SkeletonBar className="h-4 w-1/3 !rounded-lg" />
        <SkeletonBar className="h-3 w-full !rounded-md" />
        <SkeletonBar className="h-3 w-3/5 !rounded-md" />
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
