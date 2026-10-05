import { Sparkles, X, Mic, MicOff, Camera, Send, ArrowUpRight, Wallet } from 'lucide-react'
import VoiceVisualizer from '../VoiceVisualizer'
import { triggerHaptic } from '../../../lib/haptics'

export default function QuickLogInputSection({
  locale,
  t,
  inputValue,
  setInputValue,
  inputPlaceholder,
  inputRef,
  isRecording,
  handleStopRecording,
  handleCancelRecording,
  toggleRecording,
  selectedImage,
  setSelectedImage,
  setShowMediaSourcePicker,
  handleSubmit,
  sampleChips = [],
  wallets = [],
  omissionData,
  setOmissionData,
}) {
  return (
    <div className="space-y-3 ft-mode-enter">
      {/* Omission Clarification Banner with Interactive Chips */}
      {omissionData && (
        <div className="mb-3.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3 text-xs text-[var(--fg)] animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span className="font-semibold text-xs text-[var(--fg)]">{omissionData.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setOmissionData(null)}
              className="rounded-full p-1 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
              aria-label={t('common.close', 'Tutup')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {Array.isArray(omissionData.chips) && omissionData.chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {omissionData.chips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light')
                    if (chip === 'Nominal Lain' || chip === 'Custom Amount') {
                      inputRef.current?.focus()
                      setOmissionData(null)
                    } else {
                      const combined = `${omissionData.originalText} ${chip}`
                      setInputValue(combined)
                      setOmissionData(null)
                      handleSubmit(combined)
                    }
                  }}
                  className="rounded-xl border border-[var(--accent)]/40 bg-[var(--panel-strong)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition active:scale-95 cursor-pointer shadow-sm"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sapaan Kontekstual */}
      <div className="space-y-0.5 pb-0.5">
        <h2 className="ft-display text-base sm:text-lg font-black tracking-tight text-[var(--fg)]">
          {locale === 'en' ? 'What would you like to log today?' : 'Mau catat apa hari ini?'}
        </h2>
        <p className="text-xs text-[var(--muted)]">
          {locale === 'en'
            ? 'Type or speak your transaction in natural language.'
            : 'Tulis atau ucapkan transaksi Anda dalam bahasa sehari-hari.'}
        </p>
      </div>

      {/* Main Input Box */}
      <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 focus-within:border-[var(--accent)] transition-colors shadow-inner">
        {/* Active Voice Recording Live Waveform Visualizer */}
        {isRecording && (
          <div className="mb-2.5">
            <VoiceVisualizer
              isRecording={isRecording}
              onStop={handleStopRecording}
              onCancel={handleCancelRecording}
              t={t}
              locale={locale}
            />
          </div>
        )}

        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              const isTouchMobile =
                typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(pointer: coarse)').matches

              if (isTouchMobile) {
                return
              }

              e.preventDefault()
              if (e.nativeEvent?.isComposing || e.keyCode === 229) return
              if (!inputValue.trim() && !selectedImage) return
              triggerHaptic('light')
              handleSubmit()
            }
          }}
          placeholder={inputPlaceholder}
          rows={2}
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck={true}
          autoComplete="on"
          enterKeyHint="send"
          className="w-full resize-none bg-transparent text-[15px] sm:text-sm font-medium text-[var(--fg)] placeholder:text-[var(--muted)]/80 focus:outline-none min-h-[64px] leading-relaxed"
        />

        {/* Attached Image Thumbnail */}
        {selectedImage && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1.5 w-fit">
            <img src={selectedImage} alt={t('aiQuickLog.attachedReceipt', 'Struk terlampir')} className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-[10px] font-bold text-[var(--fg)]">
              {t('aiQuickLog.attachedReceipt', 'Struk terlampir')}
            </span>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="rounded-full p-1 text-[var(--muted)] hover:text-rose-500 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Input Actions Footer Bar */}
        <div className="mt-2 flex items-center justify-between pt-2 border-t border-[var(--border)]/40">
          <div className="flex items-center gap-1.5">
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95 cursor-pointer ${
                isRecording
                  ? 'border-rose-500 bg-rose-500/20 text-rose-500 animate-pulse'
                  : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
              title={isRecording ? (locale === 'en' ? 'Stop recording' : 'Berhenti Merekam') : (locale === 'en' ? 'Voice input' : 'Rekam Suara (Voice Input)')}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Unified Camera / Gallery Media Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setShowMediaSourcePicker(true)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)] transition active:scale-95 cursor-pointer"
              title={t('aiChat.media.title', 'Lampirkan Foto atau Struk')}
              aria-label={t('aiChat.media.title', 'Lampirkan Foto atau Struk')}
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light')
              handleSubmit()
            }}
            disabled={!inputValue.trim() && !selectedImage}
            className="ft-btn-primary py-2.5 px-4 text-xs font-black flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-95 transition shadow-sm"
          >
            <span>{t('aiQuickLog.record', 'Catat')}</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Sample Chips (Infinite Marquee) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
            {t('aiQuickLog.sampleChipsHeader', 'Coba Catat Cepat')}
          </span>
          <span className="text-[9.5px] text-[var(--muted)]/60 font-medium">
            {t('aiQuickLog.sampleChipsHint', 'Geser atau ketuk')}
          </span>
        </div>

        <div className="ft-marquee-container ft-marquee-mask overflow-hidden py-1">
          <div className="ft-marquee-track">
            {[...sampleChips, ...sampleChips].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  triggerHaptic('light')
                  setInputValue(chip)
                  inputRef.current?.focus()
                }}
                className="flex items-center gap-1.5 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <span>{chip}</span>
                <ArrowUpRight className="h-3 w-3 text-[var(--muted)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      {wallets.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] pt-0.5">
          <Wallet className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
          <span className="truncate">
            {t('aiQuickLog.connectedAccounts', 'Akun terhubung: {{accounts}}', {
              accounts: wallets.map((w) => w.name).join(', '),
            })}
          </span>
        </div>
      )}
    </div>
  )
}
