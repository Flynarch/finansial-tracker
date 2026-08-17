import { memo, useEffect, useState } from 'react'
import { Mic, Check, X } from 'lucide-react'

export const VoiceVisualizer = memo(function VoiceVisualizer({
  isRecording,
  onStop,
  onCancel,
  t,
  locale = 'id',
}) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!isRecording) {
      setSeconds(0)
      return undefined
    }
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isRecording])

  if (!isRecording) return null

  const formatTimer = (s) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 backdrop-blur-xs transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      {/* Left: Pulsing Mic Icon & Waveform */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs">
          <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-35" />
          <Mic className="relative h-3.5 w-3.5" strokeWidth={2.5} />
        </div>

        {/* Audio Waveform Bars */}
        <div className="flex items-center gap-0.5 h-5 px-1">
          <span className="w-1 h-3 rounded-full bg-rose-500 ft-wave-bar-1" />
          <span className="w-1 h-5 rounded-full bg-rose-500 ft-wave-bar-2" />
          <span className="w-1 h-2.5 rounded-full bg-rose-500 ft-wave-bar-3" />
          <span className="w-1 h-4 rounded-full bg-rose-500 ft-wave-bar-4" />
          <span className="w-1 h-2 rounded-full bg-rose-500 ft-wave-bar-5" />
          <span className="w-1 h-4.5 rounded-full bg-rose-500 ft-wave-bar-6" />
        </div>

        {/* Status Text & Timer */}
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-rose-500">
            {locale === 'en' ? 'Listening...' : 'Mendengarkan...'}
          </p>
          <p className="text-[10px] font-semibold tabular-nums text-rose-500/80">
            {formatTimer(seconds)}
          </p>
        </div>
      </div>

      {/* Right: Tactile Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/20 bg-[var(--panel-strong)] text-[var(--muted)] hover:text-rose-500 transition active:scale-95 cursor-pointer"
            title={locale === 'en' ? 'Cancel voice input' : 'Batal'}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onStop}
          className="flex h-7 items-center gap-1 rounded-lg bg-rose-500 px-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-600 transition active:scale-95 cursor-pointer"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span>{t ? t('common.done', 'Selesai') : 'Selesai'}</span>
        </button>
      </div>
    </div>
  )
})

export default VoiceVisualizer
