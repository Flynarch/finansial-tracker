import { memo } from 'react'
import { CheckCircle2, Calendar, Store, Sparkles, WifiOff } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'

export const ReceiptHeader = memo(function ReceiptHeader({
  contextualTheme,
  activeMerchant,
  isOnlineAi,
  receiptDate,
  rawPrompt,
}) {
  const { t } = useTranslation()

  return (
    <>
      {/* Top Accent Line */}
      <div className={`h-1 w-full bg-gradient-to-r ${contextualTheme.line}`} />

      {/* Unified Fintech Ticket Header (Store/Merchant + Verified AI Badge + Date) */}
      <div className="px-3.5 py-2.5 border-b border-[var(--border)]/40 bg-[var(--field-bg)]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {activeMerchant ? (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20 shadow-2xs">
              <Store className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div className={`p-1.5 rounded-lg ${contextualTheme.badge} border flex items-center justify-center shrink-0 shadow-2xs`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="min-w-0">
            <span className="block text-xs font-black text-[var(--fg)] truncate leading-tight">
              {activeMerchant || contextualTheme.title}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isOnlineAi ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-500 shrink-0">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{t('ai.engine.online', 'AI Gemini (Online)')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-500 shrink-0">
                  <WifiOff className="h-2.5 w-2.5" />
                  <span>{t('ai.engine.offline', 'NLP Lokal (Offline)')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted)] shrink-0 tabular-nums bg-[var(--panel)] px-2 py-0.5 rounded-md border border-[var(--border)]/60">
          <Calendar className="h-2.5 w-2.5" />
          <span>{receiptDate}</span>
        </div>
      </div>

      {/* Prompt Citation if available */}
      {rawPrompt ? (
        <div className="px-3 py-1 bg-[var(--field-bg)]/20 border-b border-[var(--border)]/30 text-[10px] text-[var(--muted)] italic truncate">
          &ldquo;{rawPrompt}&rdquo;
        </div>
      ) : null}
    </>
  )
})

export default ReceiptHeader
