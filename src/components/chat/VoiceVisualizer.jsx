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
  const [audioLevel, setAudioLevel] = useState(0)

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

  useEffect(() => {
    if (!isRecording || typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setAudioLevel(0)
      return undefined
    }

    let audioCtx = null
    let analyser = null
    let source = null
    let stream = null
    let animId = null
    let isCancelled = false

    async function initAudio() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return

        const userStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (isCancelled) {
          userStream.getTracks().forEach((t) => t.stop())
          return
        }
        stream = userStream
        audioCtx = new AudioContextClass()
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64
        source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
          if (isCancelled) return
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const avg = sum / dataArray.length
          const normalized = Math.min(1, Math.max(0, avg / 128))
          setAudioLevel(normalized)
          animId = requestAnimationFrame(tick)
        }

        tick()
      } catch (err) {
        if (!isCancelled) {
          console.warn('[VoiceVisualizer:initAudio]', err)
        }
      }
    }

    initAudio()

    return () => {
      isCancelled = true
      if (animId) cancelAnimationFrame(animId)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (source) {
        try { source.disconnect() } catch { /* ignore */ }
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close() } catch { /* ignore */ }
      }
    }
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
          {[0.6, 1.0, 0.5, 0.8, 0.4, 0.9].map((scale, i) => {
            const dynamicHeight = Math.max(4, Math.min(20, Math.round(20 * (0.2 + audioLevel * scale))))
            return (
              <span
                key={i}
                style={{ height: `${dynamicHeight}px` }}
                className={`w-1 rounded-full bg-rose-500 transition-all duration-75 ft-wave-bar-${i + 1}`}
              />
            )
          })}
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
