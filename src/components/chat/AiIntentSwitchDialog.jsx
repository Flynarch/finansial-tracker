import { MessageSquareText, Sparkles, ArrowRight, RotateCcw } from 'lucide-react'

export default function AiIntentSwitchDialog({
  rawPrompt = '',
  onSwitchToChat,
  onStay,
}) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-250 p-1">
      {/* Visual Notice Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--field-bg)] p-5 text-center shadow-md space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-xs">
          <Sparkles className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-black text-[var(--fg)] tracking-tight">
            Wah, sepertinya ini bukan catatan transaksi!
          </h3>
          <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
            Input Anda berupa pertanyaan atau obrolan. Mau lanjut ke <strong>Mode Chat</strong> untuk berdiskusi dengan Asisten FinTrack?
          </p>
        </div>

        {/* User Prompt Quote */}
        {rawPrompt ? (
          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-strong)] p-3 text-xs font-semibold text-[var(--fg)] italic max-w-xs mx-auto truncate">
            "{rawPrompt}"
          </div>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onStay}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] py-3 px-3.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Ubah Catatan</span>
        </button>

        <button
          type="button"
          onClick={() => onSwitchToChat(rawPrompt)}
          className="ft-btn-primary flex-1 flex items-center justify-center gap-1.5 py-3 px-4 text-xs font-black cursor-pointer shadow-lg"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          <span>Lanjut ke Chat</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
