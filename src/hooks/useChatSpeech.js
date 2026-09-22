import { useState, useRef, useEffect, useCallback } from 'react'

export function useChatSpeech({ locale = 'id', inputValue = '', setInputValue, onError }) {
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef(null)
  const baseInputBeforeRecordingRef = useRef('')

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err){
      console.warn('[useChatSpeech]', err)
          // ignore
        }
      }
    }
  }, [])

  const handleStopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err){
      console.warn('[useChatSpeech]', err)
        // ignore
      }
    }
    setIsRecording(false)
  }, [])

  const handleCancelRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err){
      console.warn('[useChatSpeech]', err)
        // ignore
      }
    }
    setIsRecording(false)
    if (setInputValue) {
      setInputValue(baseInputBeforeRecordingRef.current.trim())
    }
  }, [setInputValue])

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      handleStopRecording()
      return
    }

    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null

    if (!SpeechRecognition) {
      onError?.(locale === 'en' ? 'Voice input is not supported on this device.' : 'Perangkat Anda belum mendukung input suara.')
      return
    }

    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (micErr) {
      console.warn('[useChatSpeech]', micErr)
        if (micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError') {
          onError?.(
            locale === 'en'
              ? 'Microphone permission was denied. Please allow microphone access in device settings.'
              : 'Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan.'
          )
          return
        }
      }
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = locale === 'id' ? 'id-ID' : 'en-US'
      recognition.continuous = true
      recognition.interimResults = true
      recognitionRef.current = recognition
      baseInputBeforeRecordingRef.current = inputValue ? `${inputValue.trim()} ` : ''

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onresult = (e) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = 0; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript
          if (e.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        const fullText = (baseInputBeforeRecordingRef.current + finalTranscript + interimTranscript).trim()
        setInputValue?.(fullText)
      }

      recognition.onerror = (event) => {
        setIsRecording(false)
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          onError?.(
            locale === 'en'
              ? 'Microphone permission was denied. Please allow microphone access in device settings.'
              : 'Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan.'
          )
        } else if (event?.error === 'audio-capture') {
          onError?.(
            locale === 'en'
              ? 'Microphone is unavailable or in use by another app.'
              : 'Mikrofon tidak tersedia atau sedang digunakan oleh aplikasi lain.'
          )
        }
      }

      recognition.onend = () => setIsRecording(false)
      recognition.start()
    } catch (err){
      console.warn('[useChatSpeech]', err)
      setIsRecording(false)
    }
  }, [isRecording, locale, inputValue, setInputValue, onError, handleStopRecording])

  return {
    isRecording,
    toggleRecording,
    handleStopRecording,
    handleCancelRecording,
  }
}
