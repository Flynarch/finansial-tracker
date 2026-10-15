import { useMemo, useEffect } from 'react'
import { Sparkles, X, Mic, MicOff, Camera, Send, ArrowUpRight, Wallet } from 'lucide-react'
import VoiceVisualizer from '../VoiceVisualizer'
import CategoryIcon from '../../ui/CategoryIcon'
import { getCategoryColorClass, resolveTransactionIconKey } from '../../../lib/categoryIcon'
import { getFrequentUserEntities } from '../../../lib/ai/entityMemory'
import { formatCurrency } from '../../../lib/utils'
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
  defaultCurrency = 'IDR',
  omissionData,
  setOmissionData,
  isInputFocused = false,
  setIsInputFocused,
}) {
  const frequentEntities = useMemo(() => {
    try {
      const list = getFrequentUserEntities(3)
      return Array.isArray(list) ? list.filter((e) => e && e.name && e.lastAmount > 0) : []
    } catch {
      return []
    }
  }, [])

  const handleInputChange = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
    setInputValue(e.target.value)
  }

  const handleFocus = () => {
    triggerHaptic('light')
    setIsInputFocused?.(true)
  }

  const handleBlur = (e) => {
    const related = e.relatedTarget
    if (related && related.closest && related.closest('[data-quicklog-keep-focus="true"]')) {
      return
    }
    setTimeout(() => {
      if (document.activeElement === inputRef?.current) return
      setIsInputFocused?.(false)
    }, 150)
  }

  const handleClearInput = () => {
    triggerHaptic('light')
    setInputValue('')
    if (inputRef?.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
  }

  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.style.height = 'auto'
      if (inputRef.current.scrollHeight > 0) {
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`
      }
    }
  }, [inputValue, inputRef])

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

      {/* Sapaan Kontekstual / Dynamic Header */}
      <div
        data-testid="quicklog-greeting"
        className={`transition-all duration-300 ease-out overflow-hidden ${
          isInputFocused
            ? 'max-h-0 opacity-0 mb-0 pointer-events-none'
            : 'max-h-24 opacity-100 space-y-0.5 pb-0.5'
        }`}
      >
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
      <div
        data-quicklog-keep-focus="true"
        className="relative rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3 focus-within:border-[var(--accent)] transition-colors shadow-inner"
      >
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
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
          className="w-full resize-none overflow-y-auto bg-transparent text-[15px] sm:text-sm font-medium text-[var(--fg)] placeholder:text-[var(--muted)]/80 focus:outline-none min-h-[64px] max-h-[160px] pr-7 leading-relaxed transition-[height] duration-100 ease-out"
        />

        {Boolean(inputValue?.length > 0 && !isRecording) && (
          <button
            type="button"
            onClick={handleClearInput}
            aria-label={t('common.clear', 'Hapus')}
            className="absolute right-2 top-2 p-1 rounded-md text-[var(--muted)] hover:text-[var(--fg)] active:scale-90 transition cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

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

      {/* Frequent Quick Repeat Cards (Sering Dicatat) */}
      {!inputValue.trim() && !selectedImage && frequentEntities.length > 0 && (
        <div
          data-testid="quicklog-frequent-cards"
          className={`transition-all duration-300 ease-out overflow-hidden ${
            isInputFocused
              ? 'max-h-0 opacity-0 pointer-events-none'
              : 'max-h-40 opacity-100 space-y-1.5 pt-1 animate-in fade-in duration-200'
          }`}
        >
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
              {t('aiQuickLog.frequentHeader', 'Sering Dicatat')}
            </span>
            <span className="text-[9.5px] text-[var(--muted)]/60 font-medium">
              {t('aiQuickLog.frequentHint', 'Ketuk untuk isi instan')}
            </span>
          </div>

          <div className="flex overflow-x-auto gap-2 no-scrollbar snap-x snap-mandatory pb-1 -mx-1 px-1">
            {frequentEntities.map((entity, idx) => {
              const cat = entity.category || 'kebutuhan_harian/lainnya'
              const iconKey = resolveTransactionIconKey(cat, 'expense')
              const colorClass = getCategoryColorClass(iconKey, 'expense', cat)
              const amtStr = formatCurrency(entity.lastAmount, defaultCurrency)
              const matchedWallet = wallets.find((w) => String(w.id) === String(entity.walletId))
              const walletName = matchedWallet?.name || ''

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light')
                    const text = `${entity.name} ${formatCurrency(entity.lastAmount, defaultCurrency)}${walletName ? ` pake ${walletName}` : ''}`
                    setInputValue(text)
                    inputRef.current?.focus()
                  }}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2 hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs text-left snap-start shrink-0 w-[70%] sm:w-auto sm:flex-1 max-w-[220px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ${colorClass}`}>
                      <CategoryIcon icon={iconKey} className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[var(--fg)] leading-tight">
                        {entity.name}
                      </p>
                      {walletName && (
                        <p className="truncate text-[9.5px] font-medium text-[var(--muted)]">
                          {walletName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-[11px] font-black ft-expense-text tabular-nums">
                      -{amtStr}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Sample Chips (Horizontal Scroll) */}
      <div
        data-testid="quicklog-sample-chips"
        className={`transition-all duration-300 ease-out overflow-hidden ${
          isInputFocused
            ? 'max-h-0 opacity-0 pointer-events-none'
            : 'max-h-32 opacity-100 space-y-1.5 pt-1'
        }`}
      >
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
            {t('aiQuickLog.sampleChipsHeader', 'Coba Catat Cepat')}
          </span>
          <span className="text-[9.5px] text-[var(--muted)]/60 font-medium">
            {t('aiQuickLog.sampleChipsHint', 'Geser atau ketuk')}
          </span>
        </div>

        <div
          className="overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)',
          }}
        >
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 -mx-1 px-1">
            {sampleChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  triggerHaptic('light')
                  setInputValue(chip)
                  inputRef.current?.focus()
                }}
                className="flex items-center gap-1.5 shrink-0 snap-start rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
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
        <div
          data-testid="quicklog-connected-accounts"
          className={`transition-all duration-300 ease-out overflow-hidden ${
            isInputFocused
              ? 'max-h-0 opacity-0 pointer-events-none'
              : 'max-h-12 opacity-100 flex items-center gap-1.5 text-[11px] text-[var(--muted)] pt-0.5'
          }`}
        >
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
