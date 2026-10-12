/**
 * Page-specific skeleton loading component with high-fidelity layout matching.
 * Provides contextual shimmer placeholders that mirror each page's actual visual hierarchy
 * to eliminate layout shift (CLS = 0) and prevent jarring skeleton flash.
 *
 * @param {object} props
 * @param {'dashboard'|'transactions'|'calendar'|'budget'|'reports'|'loans'|'savings'|'savings-detail'|'todo'|'todo-detail'|'profile'|'wallet-detail'|'settings'|'chat'|'add-account'|'generic'} [props.variant='generic']
 */

import { SettingsCategoriesSkeleton as ModernSettingsCategoriesSkeleton } from '../settings/categories/SettingsCategoriesSkeleton'

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
      <div className="ft-hero-card ft-skeleton-card !p-5 space-y-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)]">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-3 w-24 !rounded-md" />
            <SkeletonCircle className="h-5 w-5" />
            <div className="flex gap-1 ml-1">
              <span className="h-1.5 w-3.5 rounded-full ft-skeleton block" />
              <span className="h-1.5 w-1.5 rounded-full ft-skeleton block" />
            </div>
          </div>
          <SkeletonBar className="h-5 w-20 !rounded-full" />
        </div>
        {/* Main balance */}
        <div className="py-1">
          <SkeletonBar className="h-8.5 w-48 !rounded-xl" />
        </div>
        {/* Dual stat pills: Income and Expense */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)]/60 bg-[var(--field-bg)] p-3">
            <div className="h-8 w-8 shrink-0 rounded-xl ft-skeleton" />
            <div className="space-y-1 min-w-0 flex-1">
              <SkeletonBar className="h-2.5 w-16 !rounded-md" />
              <SkeletonBar className="h-4 w-20 !rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)]/60 bg-[var(--field-bg)] p-3">
            <div className="h-8 w-8 shrink-0 rounded-xl ft-skeleton" />
            <div className="space-y-1 min-w-0 flex-1">
              <SkeletonBar className="h-2.5 w-16 !rounded-md" />
              <SkeletonBar className="h-4 w-20 !rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Card (Single Highlighted Item mirroring DashboardRecentTx.jsx) */}
      <div className="ft-skeleton-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-4 w-36 !rounded-lg" />
          <SkeletonBar className="h-3 w-20 !rounded-md" />
        </div>
        <div className="space-y-2">
          <SkeletonBar className="h-2.5 w-28 !rounded-md" />
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <SkeletonBar className="h-3.5 w-32 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-24 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-4.5 w-24 shrink-0 !rounded-lg" />
          </div>
        </div>
      </div>

      {/* Net Worth Chart Card */}
      <div className="ft-skeleton-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-4 w-24 !rounded-lg" />
          <SkeletonBar className="h-5 w-20 !rounded-full" />
        </div>
        <SkeletonBar className="h-7 w-36 !rounded-xl" />
        <div className="h-20 w-full rounded-xl ft-skeleton border border-[var(--border)]/40" />
      </div>

      {/* Habit Consistency Heatmap Card */}
      <div className="ft-skeleton-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="space-y-1">
            <SkeletonBar className="h-3.5 w-32 !rounded-md" />
            <SkeletonBar className="h-2.5 w-20 !rounded-md" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <SkeletonBar className="h-5 w-10 !rounded-md" />
            <SkeletonBar className="h-2 w-14 !rounded-md" />
          </div>
        </div>
        <div className="h-8 w-full rounded-xl ft-skeleton" />
      </div>

      {/* Bento Grid: Anggaran & Target Tabungan (Mirroring DashboardPulseBento.jsx) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="ft-skeleton-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs space-y-3 min-h-[128px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl ft-skeleton" />
              <SkeletonBar className="h-3.5 w-16 !rounded-md" />
            </div>
            <SkeletonBar className="h-3.5 w-3.5 !rounded-md" />
          </div>
          <div className="space-y-1">
            <SkeletonBar className="h-5 w-20 !rounded-md" />
            <SkeletonBar className="h-2.5 w-24 !rounded-md" />
          </div>
          <div className="h-2 w-full rounded-full ft-skeleton" />
        </div>
        <div className="ft-skeleton-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-xs space-y-3 min-h-[128px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl ft-skeleton" />
              <SkeletonBar className="h-3.5 w-16 !rounded-md" />
            </div>
            <SkeletonBar className="h-3.5 w-3.5 !rounded-md" />
          </div>
          <div className="space-y-1">
            <SkeletonBar className="h-5 w-20 !rounded-md" />
            <SkeletonBar className="h-2.5 w-24 !rounded-md" />
          </div>
          <div className="h-2 w-full rounded-full ft-skeleton" />
        </div>
      </div>

      {/* Loans & Debts Card (Mirroring DashboardLoanWidget.jsx) */}
      <div className="ft-skeleton-card rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl ft-skeleton" />
            <div className="space-y-1">
              <SkeletonBar className="h-3.5 w-24 !rounded-md" />
              <SkeletonBar className="h-2.5 w-32 !rounded-md" />
            </div>
          </div>
          <SkeletonBar className="h-7 w-20 !rounded-xl" />
        </div>
        <div className="h-16 w-full rounded-xl ft-skeleton border border-[var(--border)]/40" />
      </div>
    </div>
  )
}

/* ── Variant: Transactions ──────────────────────────────────────────── */

function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      {/* 2-Segmented View Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--field-bg)] p-1 border border-[var(--border)]">
        <SkeletonBar className="h-9 w-full !rounded-xl" />
        <SkeletonBar className="h-9 w-full !rounded-xl" />
      </div>
      {/* Search Bar + Filter Trigger */}
      <div className="flex items-center gap-2">
        <div className="h-11 flex-1 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
        <div className="h-11 w-11 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
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
      {/* Toolbar Container */}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-[var(--field-bg)] px-3 py-2.5 shadow-sm border border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <div className="h-11 w-11 rounded-xl ft-skeleton" />
          <div className="h-11 w-20 rounded-xl ft-skeleton" />
          <div className="h-11 w-11 rounded-xl ft-skeleton" />
        </div>
        <SkeletonBar className="h-5 w-28 !rounded-lg" />
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
      <div className="flex items-center justify-between mb-4">
        <SkeletonBar className="h-6.5 w-36 !rounded-xl" />
        <SkeletonBar className="h-10 w-24 !rounded-2xl" />
      </div>
      {/* Summary card */}
      <SkeletonCard className="space-y-3.5 !p-5 sm:!p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-3 w-24 !rounded-md" />
            <SkeletonBar className="h-5 w-12 !rounded-full" />
          </div>
          <SkeletonBar className="h-8 w-28 !rounded-xl" />
        </div>
        <SkeletonBar className="h-6 w-36 !rounded-xl" />
        <div className="space-y-1 pt-1">
          <SkeletonBar className="h-8 w-44 !rounded-xl" />
        </div>
        <div className="h-3 w-full rounded-full ft-skeleton" />
      </SkeletonCard>
      {/* Section Header */}
      <div className="flex items-center justify-between px-1 pt-2">
        <SkeletonBar className="h-3 w-28 !rounded-md" />
      </div>
      {/* Budget items in responsive grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonCard key={i} className="!p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-36 !rounded-md" />
              </div>
              <SkeletonBar className="h-4.5 w-16 shrink-0 !rounded-lg" />
            </div>
            <div className="h-2 w-full rounded-full ft-skeleton" />
          </SkeletonCard>
        ))}
      </div>
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
      {/* Smart Insights Strip */}
      <SkeletonCard className="flex items-center justify-between !p-3.5">
        <div className="flex items-center gap-3">
          <SkeletonCircle className="h-8 w-8" />
          <div className="space-y-1">
            <SkeletonBar className="h-3.5 w-36 !rounded-md" />
            <SkeletonBar className="h-2.5 w-24 !rounded-md" />
          </div>
        </div>
        <SkeletonBar className="h-6 w-16 !rounded-full" />
      </SkeletonCard>
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
      {/* Net Worth Chart Placeholder */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-4 w-36 !rounded-lg" />
          <SkeletonBar className="h-6 w-20 !rounded-full" />
        </div>
        <div className="h-36 w-full rounded-2xl ft-skeleton border border-[var(--border)]/40" />
      </SkeletonCard>
    </div>
  )
}

/* ── Variant: Loans ─────────────────────────────────────────────────── */

function LoansSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBar className="h-6.5 w-36 !rounded-xl" />
        <SkeletonBar className="h-10 w-24 !rounded-2xl" />
      </div>
      {/* Divided Summary Card */}
      <SkeletonCard className="space-y-3.5 !p-5">
        <div className="grid grid-cols-2 divide-x divide-[var(--border)]/60">
          <div className="space-y-1.5">
            <SkeletonBar className="h-2.5 w-16 !rounded-md" />
            <SkeletonBar className="h-6 w-24 !rounded-lg" />
          </div>
          <div className="space-y-1.5 pl-4">
            <SkeletonBar className="h-2.5 w-16 !rounded-md" />
            <SkeletonBar className="h-6 w-24 !rounded-lg" />
          </div>
        </div>
        <div className="h-2 w-full rounded-full ft-skeleton" />
        <div className="pt-2 border-t border-dashed border-[var(--border)]/40 flex items-center justify-between">
          <SkeletonBar className="h-3 w-20 !rounded-md" />
          <SkeletonBar className="h-4 w-24 !rounded-lg" />
        </div>
      </SkeletonCard>
      {/* Primary Type Tab Switcher (2 Segmented Tabs) */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--field-bg)] p-1 border border-[var(--border)]">
        <SkeletonBar className="h-9 w-full !rounded-xl" />
        <SkeletonBar className="h-9 w-full !rounded-xl" />
      </div>
      {/* Secondary Status Filter Chips */}
      <div className="flex gap-2 overflow-hidden">
        <SkeletonBar className="h-7 w-16 !rounded-full shrink-0" />
        <SkeletonBar className="h-7 w-16 !rounded-full shrink-0" />
        <SkeletonBar className="h-7 w-20 !rounded-full shrink-0" />
        <SkeletonBar className="h-7 w-16 !rounded-full shrink-0" />
      </div>
      {/* Loan Items */}
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
      <div className="flex items-center justify-between mb-4">
        <SkeletonBar className="h-6.5 w-36 !rounded-xl" />
        <div className="flex items-center gap-2">
          <SkeletonCircle className="h-10 w-10 !rounded-2xl" />
          <SkeletonBar className="h-10 w-24 !rounded-2xl" />
        </div>
      </div>
      {/* Summary hero */}
      <SkeletonCard className="space-y-3.5 !p-5">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-3 w-24 !rounded-md" />
          <SkeletonBar className="h-5 w-12 !rounded-full" />
        </div>
        <div className="flex items-baseline gap-2 pt-0.5">
          <SkeletonBar className="h-8.5 w-40 !rounded-xl" />
          <SkeletonBar className="h-5 w-24 !rounded-lg" />
        </div>
        <div className="pt-2 border-t border-[var(--border)]/40 flex items-center justify-between">
          <SkeletonBar className="h-3 w-24 !rounded-md" />
          <SkeletonBar className="h-4 w-16 !rounded-full" />
        </div>
        {/* Full-width Progress Bar */}
        <div className="h-3 w-full rounded-full ft-skeleton" />
      </SkeletonCard>
      {/* Section Header */}
      <div className="flex items-center justify-between px-1 pt-1">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
      </div>
      {/* Goal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
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
      {/* Header with Title + Right Action Button */}
      <div className="flex items-center justify-between mb-2">
        <SkeletonBar className="h-7 w-28 !rounded-xl" />
        <SkeletonBar className="h-11 w-24 !rounded-2xl" />
      </div>
      {/* 2-Segmented Control: Tugas vs Kebiasaan */}
      <div className="grid grid-cols-2 gap-1 rounded-[1rem] bg-[var(--field-bg)] p-1 border border-[var(--border)]">
        <SkeletonBar className="h-9 w-full !rounded-xl" />
        <SkeletonBar className="h-9 w-full !rounded-xl" />
      </div>
      {/* Filter tabs */}
      <div className="flex gap-2">
        <SkeletonBar className="h-8 w-16 !rounded-full" />
        <SkeletonBar className="h-8 w-16 !rounded-full" />
        <SkeletonBar className="h-8 w-20 !rounded-full" />
        <SkeletonBar className="h-8 w-16 !rounded-full" />
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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="pt-2 px-1 mb-0">
        <SkeletonBar className="h-7 w-28 !rounded-xl" />
      </div>

      {/* Hero Profile Card */}
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] p-5 pb-8 pt-8 shadow-[var(--shadow-card)] flex flex-col items-center">
        {/* Avatar circle 88px with camera badge */}
        <div className="relative mb-4">
          <SkeletonCircle className="h-[88px] w-[88px]" />
          <div className="absolute bottom-0 right-0 h-8 w-8 rounded-full ft-skeleton border-2 border-[var(--panel-strong)]" />
        </div>
        {/* Display Name bar + pencil icon */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <SkeletonBar className="h-6 w-36 !rounded-xl" />
          <SkeletonCircle className="h-6 w-6" />
        </div>
        {/* Account status badge pill */}
        <SkeletonBar className="h-6 w-44 !rounded-full" />
      </div>

      {/* 3-Column Stats Row (Transaksi, Anggaran, Tabungan) */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 overflow-hidden rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] space-y-2.5"
          >
            <div className="h-8 w-8 rounded-[0.6rem] ft-skeleton" />
            <SkeletonBar className="h-6 w-10 !rounded-lg" />
            <SkeletonBar className="h-2.5 w-16 !rounded-md" />
          </div>
        ))}
      </div>

      {/* Account & Preferences Button Card */}
      <div className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--panel-strong)] px-5 py-4 shadow-[var(--shadow-card)]">
        <div className="h-11 w-11 shrink-0 rounded-[var(--radius-md)] ft-skeleton" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <SkeletonBar className="h-4 w-36 !rounded-lg" />
          <SkeletonBar className="h-3 w-52 !rounded-md" />
        </div>
        <SkeletonBar className="h-4 w-4 shrink-0 !rounded-md" />
      </div>

      {/* Shortcuts Section (6 Rows) */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-28 !rounded-md px-0.5" />
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] shadow-[var(--shadow-card)] divide-y divide-[color-mix(in_srgb,var(--border)_65%,transparent)]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton" />
              <div className="flex-1 space-y-1 min-w-0">
                <SkeletonBar className="h-4 w-28 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-40 !rounded-md" />
              </div>
              <SkeletonBar className="h-4 w-4 shrink-0 !rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Version Footer */}
      <div className="flex items-center justify-center gap-3 pt-6 pb-2">
        <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--border)_50%,transparent)]" />
        <SkeletonBar className="h-3 w-28 !rounded-md" />
        <div className="h-px flex-1 bg-[color-mix(in_srgb,var(--border)_50%,transparent)]" />
      </div>
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

/* ── Variant: Settings & Sub-pages ────────────────────────────────── */

function SettingsHomeSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SkeletonPageHeader />

      {/* Profile Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <SkeletonCircle className="h-14 w-14" />
            <div className="space-y-2 flex-1 min-w-0">
              <SkeletonBar className="h-4.5 w-36 !rounded-lg" />
              <SkeletonBar className="h-3 w-48 !rounded-md" />
            </div>
          </div>
          <SkeletonBar className="h-4 w-4 shrink-0 !rounded-md" />
        </div>

        {/* 3 Quick status pills */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-3 border-t border-[var(--border)]/60">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-1.5 flex flex-col items-center gap-1.5">
              <SkeletonBar className="h-2.5 w-12 !rounded-md" />
              <SkeletonBar className="h-3.5 w-16 !rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Prefs Bento Grid */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-28 !rounded-md" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 shadow-2xs">
              <SkeletonCircle className="h-9 w-9" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <SkeletonBar className="h-2.5 w-14 !rounded-md" />
                <SkeletonBar className="h-3.5 w-20 !rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Directory Section 1: Fitur & Keuangan */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-32 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3.5 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
                <SkeletonBar className="h-3.5 w-32 !rounded-lg" />
              </div>
              <SkeletonBar className="h-3 w-3 shrink-0 !rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Directory Section 2: Keamanan, Notifikasi & AI */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-40 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3.5 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
                <SkeletonBar className="h-3.5 w-36 !rounded-lg" />
              </div>
              <SkeletonBar className="h-3 w-3 shrink-0 !rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Directory Section 3: Bantuan & Dukungan */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-3.5 gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
                <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
              </div>
              <SkeletonBar className="h-3 w-3 shrink-0 !rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsSecuritySkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <SkeletonCard className="!p-5 space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4.5 w-48 !rounded-lg" />
            <SkeletonBar className="h-3 w-56 !rounded-md" />
          </div>
        </div>
      </SkeletonCard>

      {/* Section: Kunci Aplikasi */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-28 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          {/* Method selector */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
              <SkeletonBar className="h-3 w-40 !rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
              <div className="h-9 rounded-xl ft-skeleton" />
              <div className="h-9 rounded-xl ft-skeleton opacity-50" />
              <div className="h-9 rounded-xl ft-skeleton opacity-50" />
            </div>
          </div>
          {/* Change PIN button row */}
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1">
                <SkeletonBar className="h-3.5 w-24 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-36 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-8.5 w-24 !rounded-xl" />
          </div>
          {/* Biometric Toggle row */}
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1 flex-1">
                <SkeletonBar className="h-3.5 w-44 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-56 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-6 w-11 !rounded-full shrink-0" />
          </div>
          {/* Auto-lock Timeout row */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <SkeletonBar className="h-3.5 w-32 !rounded-lg" />
              <SkeletonBar className="h-3 w-20 !rounded-md" />
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 rounded-xl ft-skeleton opacity-60" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Passkeys */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-40 !rounded-md" />
        <SkeletonCard className="!p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
            <div className="space-y-1">
              <SkeletonBar className="h-3.5 w-32 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-48 !rounded-md" />
            </div>
          </div>
          <SkeletonBar className="h-8.5 w-20 !rounded-xl" />
        </SkeletonCard>
      </div>

      {/* Section: E2EE */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <SkeletonCard className="!p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
            <div className="space-y-1 flex-1">
              <SkeletonBar className="h-3.5 w-40 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-52 !rounded-md" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <SkeletonBar className="h-10 flex-1 !rounded-xl" />
            <SkeletonBar className="h-10 flex-1 !rounded-xl" />
          </div>
        </SkeletonCard>
      </div>
    </div>
  )
}

export function SettingsCategoriesSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header Overview Card */}
      <SkeletonCard className="!p-4 sm:!p-5 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4 w-36 !rounded-lg" />
            <SkeletonBar className="h-3 w-28 !rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-10 w-24 !rounded-xl" />
          <SkeletonBar className="h-10 w-20 !rounded-xl" />
        </div>
      </SkeletonCard>

      {/* Segment Tab Switcher */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
        <div className="h-10 rounded-xl ft-skeleton" />
        <div className="h-10 rounded-xl ft-skeleton opacity-50" />
      </div>

      {/* Search Input Bar */}
      <div className="h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />

      {/* Category Cards List */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="!p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SkeletonBar className="h-4 w-28 !rounded-lg" />
                    <SkeletonBar className="h-4.5 w-8 !rounded-full" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <SkeletonCircle className="h-8 w-8" />
                <SkeletonCircle className="h-8 w-8" />
              </div>
            </div>
            {/* Subcategory Chips Row */}
            <div className="flex items-center gap-1.5 pt-1 overflow-hidden">
              <SkeletonBar className="h-7 w-20 !rounded-xl" />
              <SkeletonBar className="h-7 w-24 !rounded-xl" />
              <SkeletonBar className="h-7 w-16 !rounded-xl" />
              <SkeletonBar className="h-7 w-20 !rounded-xl" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

function SettingsRecurringSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Overview Card with 3 Metrics */}
      <SkeletonCard className="!p-5 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4.5 w-44 !rounded-lg" />
            <SkeletonBar className="h-3 w-56 !rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border)]/60">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2 flex flex-col items-center gap-1.5">
              <SkeletonBar className="h-2.5 w-14 !rounded-md" />
              <SkeletonBar className="h-3.5 w-20 !rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Form Card: Tambah Jadwal Otomatis */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <SkeletonCard className="!p-4 sm:!p-5 space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
            <div className="h-9 rounded-xl ft-skeleton" />
            <div className="h-9 rounded-xl ft-skeleton opacity-50" />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-1.5">
                <SkeletonBar className="h-2.5 w-20 !rounded-md" />
                <div className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <SkeletonBar className="h-2.5 w-28 !rounded-md" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-10 rounded-xl ft-skeleton" />
              <div className="h-10 rounded-xl ft-skeleton opacity-60" />
            </div>
          </div>
          <SkeletonBar className="h-12 w-full !rounded-xl" />
        </SkeletonCard>
      </div>

      {/* Existing Recurring List */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-40 !rounded-md" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <SkeletonCard key={i} className="!p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
                <div className="space-y-1.5">
                  <SkeletonBar className="h-3.5 w-32 !rounded-lg" />
                  <SkeletonBar className="h-2.5 w-24 !rounded-md" />
                </div>
              </div>
              <div className="space-y-1.5 text-right shrink-0">
                <SkeletonBar className="h-4 w-24 !rounded-md" />
                <SkeletonBar className="h-2.5 w-16 !rounded-md ml-auto" />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsCurrencySkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Card & Live Ticker */}
      <SkeletonCard className="!p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
            <div className="space-y-1.5 min-w-0">
              <SkeletonBar className="h-4.5 w-48 !rounded-lg" />
              <SkeletonBar className="h-3 w-40 !rounded-md" />
            </div>
          </div>
          <SkeletonBar className="h-9 w-22 shrink-0 !rounded-xl" />
        </div>
        {/* Live Ticker Strip */}
        <div className="flex items-center gap-2 overflow-hidden pt-2 border-t border-[var(--border)]/60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-32 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
          ))}
        </div>
      </SkeletonCard>

      {/* Currency Converter Section */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <SkeletonCard className="!p-4 sm:!p-5 space-y-4">
          {/* Source Input */}
          <div className="space-y-1.5">
            <SkeletonBar className="h-2.5 w-28 !rounded-md" />
            <div className="flex gap-2.5">
              <div className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
              <div className="h-12 w-28 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-1">
            <SkeletonCircle className="h-10 w-10" />
          </div>

          {/* Target Result */}
          <div className="space-y-1.5">
            <SkeletonBar className="h-2.5 w-24 !rounded-md" />
            <div className="flex gap-2.5">
              <div className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
              <div className="h-12 w-28 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
            </div>
          </div>
        </SkeletonCard>
      </div>

      {/* Main Currencies List */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-32 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3.5 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <SkeletonCircle className="h-8 w-8" />
                <div className="space-y-1">
                  <SkeletonBar className="h-3.5 w-24 !rounded-lg" />
                  <SkeletonBar className="h-2.5 w-36 !rounded-md" />
                </div>
              </div>
              <SkeletonBar className="h-3 w-8 !rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsNotificationsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <SkeletonCard className="!p-5 space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4.5 w-48 !rounded-lg" />
            <SkeletonBar className="h-3 w-64 !rounded-md" />
          </div>
        </div>
      </SkeletonCard>

      {/* Section: Otomasi Notifikasi */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-48 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1 flex-1">
                <SkeletonBar className="h-3.5 w-44 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-56 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-6 w-11 !rounded-full shrink-0" />
          </div>
          <div className="p-3.5 flex gap-2">
            <SkeletonBar className="h-10 flex-1 !rounded-xl" />
            <SkeletonBar className="h-10 flex-1 !rounded-xl" />
          </div>
        </div>
      </div>

      {/* Section: Pengingat Harian */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-40 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1 flex-1">
                <SkeletonBar className="h-3.5 w-36 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-48 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-6 w-11 !rounded-full shrink-0" />
          </div>
          <div className="flex items-center justify-between p-3.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
              <SkeletonBar className="h-3.5 w-28 !rounded-lg" />
            </div>
            <SkeletonBar className="h-9 w-24 !rounded-xl" />
          </div>
          <div className="p-3.5">
            <SkeletonBar className="h-11 w-full !rounded-xl" />
          </div>
        </div>
      </div>

      {/* Section: Batas Anggaran */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
            <div className="space-y-1 flex-1">
              <SkeletonBar className="h-3.5 w-36 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-48 !rounded-md" />
            </div>
          </div>
          <SkeletonBar className="h-6 w-11 !rounded-full shrink-0" />
        </div>
      </div>
    </div>
  )
}

function SettingsAiSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <SkeletonCard className="!p-5 space-y-3">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4.5 w-48 !rounded-lg" />
            <SkeletonBar className="h-3 w-64 !rounded-md" />
          </div>
        </div>
      </SkeletonCard>

      {/* Section: Konfigurasi API Key */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <SkeletonCard className="!p-4 sm:!p-5 space-y-3.5">
          <div className="space-y-1.5">
            <SkeletonBar className="h-2.5 w-28 !rounded-md" />
            <div className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
          </div>
          <SkeletonBar className="h-2.5 w-3/4 !rounded-md" />
          <div className="flex gap-2 pt-1">
            <SkeletonBar className="h-11 flex-1 !rounded-xl" />
            <SkeletonBar className="h-11 flex-1 !rounded-xl" />
          </div>
          <div className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
        </SkeletonCard>
      </div>

      {/* Section: Fitur AI */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-32 !rounded-md" />
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} className="!p-3.5 space-y-2">
              <SkeletonCircle className="h-9 w-9" />
              <SkeletonBar className="h-3.5 w-24 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-32 !rounded-md" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsDataSkeleton() {
  return (
    <div className="space-y-6">
      {/* Storage Metrics Hero Card */}
      <SkeletonCard className="!p-5 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4.5 w-48 !rounded-lg" />
            <SkeletonBar className="h-3 w-60 !rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border)]/60">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2 flex flex-col items-center gap-1.5">
              <SkeletonBar className="h-2.5 w-12 !rounded-md" />
              <SkeletonBar className="h-3.5 w-16 !rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Section: Cadangan & Pemulihan */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <div className="space-y-3">
          {/* Export Card */}
          <SkeletonCard className="!p-4 space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1 flex-1">
                <SkeletonBar className="h-3.5 w-36 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-48 !rounded-md" />
              </div>
            </div>
            <SkeletonBar className="h-12 w-full !rounded-2xl" />
          </SkeletonCard>
          {/* Import Card */}
          <SkeletonCard className="!p-4 space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1 flex-1">
                <SkeletonBar className="h-3.5 w-36 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-48 !rounded-md" />
              </div>
            </div>
            <div className="flex gap-2">
              <SkeletonBar className="h-12 flex-1 !rounded-2xl" />
              <SkeletonBar className="h-12 w-14 !rounded-2xl" />
            </div>
          </SkeletonCard>
        </div>
      </div>

      {/* Section: Zona Bahaya */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-24 !rounded-md" />
        <SkeletonCard className="!p-4 space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
            <div className="space-y-1 flex-1">
              <SkeletonBar className="h-3.5 w-32 !rounded-lg" />
              <SkeletonBar className="h-2.5 w-48 !rounded-md" />
            </div>
          </div>
          <SkeletonBar className="h-12 w-full !rounded-2xl" />
        </SkeletonCard>
      </div>
    </div>
  )
}

function SettingsHelpSkeleton() {
  return (
    <div className="space-y-5">
      {/* Spotlight Tour Hero Card */}
      <SkeletonCard className="!p-5 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-4.5 w-44 !rounded-lg" />
            <SkeletonBar className="h-3 w-56 !rounded-md" />
          </div>
        </div>
        <SkeletonBar className="h-12 w-full !rounded-2xl" />
      </SkeletonCard>

      {/* Search Input & Horizontal Category Pills */}
      <div className="space-y-3">
        <div className="h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
        <div className="flex items-center gap-1.5 overflow-hidden pb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBar key={i} className="h-8 w-24 shrink-0 !rounded-full" />
          ))}
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="space-y-2.5">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} className="!p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 shrink-0 rounded-xl ft-skeleton border border-[var(--border)]/50" />
                <SkeletonBar className="h-3.5 w-3/4 !rounded-lg" />
              </div>
              <SkeletonBar className="h-4 w-4 shrink-0 !rounded-md" />
            </SkeletonCard>
          ))}
        </div>
      </div>
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
    <div className="flex flex-col min-h-screen bg-[var(--bg)] space-y-4 max-w-2xl mx-auto w-full px-4 sm:px-6 pt-1">
      {/* Top Header */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/60" />
        <SkeletonBar className="h-5.5 w-44 !rounded-xl" />
      </div>

      {/* Search Input Placeholder */}
      <div className="h-11 w-full rounded-2xl ft-skeleton border border-[var(--border)]/50" />

      {/* Category Pills Placeholder */}
      <div className="flex items-center gap-2 overflow-hidden pb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBar key={i} className="h-8 w-20 shrink-0 !rounded-full" />
        ))}
      </div>

      {/* Content List: Section 1 */}
      <div className="space-y-2.5 pt-2">
        <SkeletonBar className="h-3 w-36 !rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--panel-strong)] shadow-2xs"
            >
              <SkeletonCircle className="h-11 w-11" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <SkeletonBar className="h-4 w-32 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-20 !rounded-md" />
              </div>
              <SkeletonCircle className="h-5 w-5" />
            </div>
          ))}
        </div>
      </div>

      {/* Content List: Section 2 */}
      <div className="space-y-2.5 pt-2">
        <SkeletonBar className="h-3 w-40 !rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--panel-strong)] shadow-2xs"
            >
              <SkeletonCircle className="h-11 w-11" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <SkeletonBar className="h-4 w-28 !rounded-lg" />
                <SkeletonBar className="h-2.5 w-24 !rounded-md" />
              </div>
              <SkeletonCircle className="h-5 w-5" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Button Placeholder */}
      <div className="pt-2">
        <SkeletonBar className="h-12 w-full !rounded-2xl" />
      </div>
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
  settings: SettingsHomeSkeleton,
  'settings-home': SettingsHomeSkeleton,
  'settings-security': SettingsSecuritySkeleton,
  'settings-categories': ModernSettingsCategoriesSkeleton,
  'settings-recurring': SettingsRecurringSkeleton,
  'settings-currency': SettingsCurrencySkeleton,
  'settings-notifications': SettingsNotificationsSkeleton,
  'settings-ai': SettingsAiSkeleton,
  'settings-data': SettingsDataSkeleton,
  'settings-help': SettingsHelpSkeleton,
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
      className="w-full ft-skeleton-enter"
    >
      <Component />
    </div>
  )
}
