import { useEffect } from 'react'
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
  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.style.height = 'auto'
      if (inputValue) {
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
      }
    }
  }, [inputValue, inputRef])

  return (
    <footer className="shrink-0 border-t border-transparent bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/90 to-transparent backdrop-blur-md pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] pt-2 px-3.5 z-20 space-y-2">
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

      {/* Seamless Pill Input Capsule */}
      <form
        className="flex items-center gap-1.5 rounded-full border border-[var(--border)]/70 bg-[var(--panel-strong)]/90 backdrop-blur-xl px-2 py-1 shadow-lg shadow-black/5 dark:shadow-black/25 focus-within:border-[var(--accent)]/70 focus-within:ring-2 focus-within:ring-[var(--accent)]/15 transition-all"
        onSubmit={(e) => {
          e.preventDefault()
          if (isLoading || (!inputValue.trim() && !selectedImage)) return
          triggerHaptic('light')
          onSend(inputValue, selectedImage)
        }}
      >
        {/* Unified Camera / Gallery Media Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light')
            onOpenMediaPicker()
          }}
          className={`grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full transition active:scale-95 cursor-pointer ${
            selectedImage
              ? 'border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]'
          }`}
          title={translate(locale, 'aiChat.media.title') || (locale === 'en' ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
          aria-label={translate(locale, 'aiChat.media.title') || (locale === 'en' ? 'Attach Photo or Receipt' : 'Lampirkan Foto atau Struk')}
        >
          <Camera size={17} strokeWidth={2.2} />
        </button>

        {/* Mic button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light')
            onToggleRecording()
          }}
          className={`grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full transition active:scale-95 cursor-pointer ${
            isRecording
              ? 'border border-rose-500 bg-rose-500/20 text-rose-500 shadow-xs'
              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]'
          }`}
          title={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti merekam') : (locale === 'en' ? 'Voice Input' : 'Input Suara')}
          aria-label={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti merekam') : (locale === 'en' ? 'Voice Input' : 'Input Suara')}
        >
          <Mic size={17} strokeWidth={2.2} />
        </button>

        {/* Auto-growing Textarea */}
        <textarea
          ref={inputRef}
          rows={1}
          value={inputValue}
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck={true}
          autoComplete="on"
          onChange={(e) => {
            setInputValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              const isTouchMobile =
                typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(pointer: coarse)').matches

              if (isTouchMobile) {
                // On mobile touchscreens, Enter inserts a newline instead of submitting
                return
              }

              e.preventDefault()
              if (e.nativeEvent?.isComposing || e.keyCode === 229) return
              if (isLoading || (!inputValue.trim() && !selectedImage)) return
              onSend(inputValue, selectedImage)
            }
          }}
          placeholder={translate(locale, 'aiChat.placeholder') || (locale === 'en' ? 'Ask anything...' : 'Ketik apapun...')}
          className="flex-1 max-h-[120px] min-h-[36px] resize-none bg-transparent py-2 px-2 text-[13px] font-medium leading-snug text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={isLoading || (!inputValue.trim() && !selectedImage)}
          className={`grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full transition-all duration-150 active:scale-95 cursor-pointer ${
            inputValue.trim() || selectedImage
              ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30 hover:opacity-90'
              : 'bg-[var(--field-bg)] text-[var(--muted)] opacity-40 cursor-not-allowed'
          }`}
          title={translate(locale, 'common.send') || 'Kirim'}
          aria-label={translate(locale, 'common.send') || 'Kirim'}
        >
          {isLoading ? (
            <Sparkles size={15} className="animate-spin text-white" />
          ) : (
            <Send size={15} strokeWidth={2.4} />
          )}
        </button>
      </form>
    </footer>
  )
}
