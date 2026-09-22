import { Camera, Mic, Send, Sparkles } from 'lucide-react'
import { translate } from '../../lib/i18n'
import { triggerHaptic } from '../../lib/haptics'
import VoiceVisualizer from './VoiceVisualizer'

export default function ChatInputBar({
  inputValue,
  setInputValue,
  inputRef,
  isRecording,
  isLoading,
  selectedImage,
  onSend,
  onToggleRecording,
  onStopRecording,
  onCancelRecording,
  onOpenMediaPicker,
  locale,
}) {
  return (
    <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--panel-strong)]/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] pt-2 px-3 shadow-2xl z-20 space-y-2">
      {/* Voice Visualizer Overlay during recording */}
      {isRecording && (
        <div className="mb-2">
          <VoiceVisualizer
            isRecording={isRecording}
            onStop={onStopRecording}
            onCancel={onCancelRecording}
            locale={locale}
          />
        </div>
      )}

      {/* Text Input Bar */}
      <form
        className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-1.5 shadow-xs focus-within:border-[var(--accent)] transition-colors"
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        {/* Unified Camera / Gallery Media Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light')
            onOpenMediaPicker()
          }}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95 cursor-pointer ${
            selectedImage
              ? 'border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)]'
          }`}
          title={translate(locale, 'aiChat.media.title') || (locale === 'en' ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
          aria-label={translate(locale, 'aiChat.media.title') || (locale === 'en' ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
        >
          <Camera size={18} strokeWidth={2.2} />
        </button>

        {/* Mic button */}
        <button
          type="button"
          onClick={onToggleRecording}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95 cursor-pointer ${
            isRecording
              ? 'border border-rose-500 bg-rose-500/20 text-rose-500 shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-strong)]'
          }`}
          title={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti merekam') : (locale === 'en' ? 'Voice Input' : 'Input Suara')}
          aria-label={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti merekam') : (locale === 'en' ? 'Voice Input' : 'Input Suara')}
        >
          <Mic size={18} strokeWidth={2.2} />
        </button>

        {/* Auto-growing Textarea */}
        <textarea
          ref={inputRef}
          rows={1}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={translate(locale, 'aiChat.placeholder') || (locale === 'en' ? 'Ask anything...' : 'Ketik apapun...')}
          className="flex-1 max-h-[120px] min-h-[36px] resize-none bg-transparent py-2 px-2 text-[13px] font-medium leading-snug text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={isLoading || (!inputValue.trim() && !selectedImage)}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
            inputValue.trim() || selectedImage
              ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30 hover:opacity-90'
              : 'bg-[var(--panel-strong)] text-[var(--muted)] opacity-40 cursor-not-allowed'
          }`}
          title={translate(locale, 'common.send') || 'Kirim'}
          aria-label={translate(locale, 'common.send') || 'Kirim'}
        >
          {isLoading ? (
            <Sparkles size={16} className="animate-spin text-white" />
          ) : (
            <Send size={16} strokeWidth={2.2} />
          )}
        </button>
      </form>
    </footer>
  )
}
