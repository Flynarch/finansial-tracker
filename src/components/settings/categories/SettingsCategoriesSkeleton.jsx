import { memo } from 'react'

export const SettingsCategoriesSkeleton = memo(function SettingsCategoriesSkeleton() {
  return (
    <div className="space-y-4 ft-skeleton-enter">
      {/* Segment Tab Switcher */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
        <div className="h-10 rounded-xl ft-skeleton" />
        <div className="h-10 rounded-xl ft-skeleton opacity-50" />
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="h-11 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] ft-skeleton" />
        <div className="h-11 w-24 rounded-2xl ft-skeleton" />
        <div className="h-11 w-11 rounded-2xl ft-skeleton" />
      </div>

      {/* Section Sub-header */}
      <div className="flex items-center justify-between px-1">
        <div className="h-3 w-24 ft-skeleton !rounded-md" />
        <div className="h-3 w-20 ft-skeleton !rounded-md" />
      </div>

      {/* Connected Feed Group Card */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] divide-y divide-[var(--border)]/40 shadow-xs">
        {/* Row 1: Collapsed */}
        <div className="flex items-center justify-between p-3.5 sm:px-4 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-4 w-28 ft-skeleton !rounded-lg" />
              <div className="h-2.5 w-20 ft-skeleton !rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="h-8 w-8 rounded-xl ft-skeleton" />
            <div className="h-8 w-8 rounded-xl ft-skeleton opacity-40" />
          </div>
        </div>

        {/* Row 2: Expanded with Subcategory Drawer */}
        <div>
          <div className="flex items-center justify-between p-3.5 sm:px-4 gap-3 bg-[var(--panel)]/50">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-4 w-32 ft-skeleton !rounded-lg" />
                <div className="h-2.5 w-24 ft-skeleton !rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-8 w-8 rounded-xl ft-skeleton" />
              <div className="h-8 w-8 rounded-xl ft-skeleton opacity-60" />
            </div>
          </div>

          {/* Subcategory Drawer Skeleton */}
          <div className="bg-[var(--field-bg)]/60 border-t border-[var(--border)]/30 px-3.5 py-3 sm:px-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 ft-skeleton !rounded-md" />
              <div className="h-3 w-28 ft-skeleton !rounded-md" />
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)]/60 bg-[var(--panel-strong)] divide-y divide-[var(--border)]/30">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full ft-skeleton shrink-0" />
                    <div className="h-3 w-24 ft-skeleton !rounded-md" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-6 w-6 rounded-lg ft-skeleton" />
                    <div className="h-6 w-6 rounded-lg ft-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows 3 & 4: Collapsed */}
        {[3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between p-3.5 sm:px-4 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 shrink-0 rounded-2xl ft-skeleton border border-[var(--border)]/50" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-4 w-28 ft-skeleton !rounded-lg" />
                <div className="h-2.5 w-16 ft-skeleton !rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-8 w-8 rounded-xl ft-skeleton" />
              <div className="h-8 w-8 rounded-xl ft-skeleton opacity-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
