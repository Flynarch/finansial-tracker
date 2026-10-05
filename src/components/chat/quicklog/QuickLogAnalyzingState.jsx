import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'

export function QuickLogErrorBanner({ errorMessage }) {
  if (!errorMessage) return null
  return (
    <div className="mb-3.5 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 animate-in fade-in duration-200">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{errorMessage}</span>
    </div>
  )
}

export default function QuickLogAnalyzingState({ lastSubmittedPrompt, t, errorMessage }) {
  return (
    <div className="space-y-3.5">
      {errorMessage && <QuickLogErrorBanner errorMessage={errorMessage} />}
      <div className="ft-mode-enter py-3 px-1">
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-sm ft-shimmer-scan flex flex-col items-center text-center space-y-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-sm">
            <Loader2 className="h-7 w-7 animate-spin" />
            <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-[var(--accent)] animate-bounce" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-[var(--fg)] tracking-tight">
              {t('aiQuickLog.analyzingTitle', 'Menganalisis Transaksi...')}
            </h3>
            <p className="text-xs text-[var(--muted)] max-w-xs">
              {t('aiQuickLog.analyzingDesc', 'AI sedang mengidentifikasi nominal, kategori, dan menghubungkan akun dompet Anda.')}
            </p>
          </div>

          {lastSubmittedPrompt && (
            <div className="rounded-xl bg-[var(--field-bg)] border border-[var(--border)] px-3 py-1.5 text-xs italic text-[var(--muted)] max-w-xs truncate shadow-2xs">
              "{lastSubmittedPrompt}"
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-[var(--accent)]">
            <CheckCircle2 className="h-3.5 w-3.5 animate-pulse" />
            <span>FinTrack AI Engine v2.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
