import { useState, useRef, useCallback } from 'react'
import { useChatSpeech } from '../../../hooks/useChatSpeech'
import { compressImage } from '../../../lib/imageCompression'

export function useChatInputState({ locale = 'id', onSpeechError }) {
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [showScanModePicker, setShowScanModePicker] = useState(false)
  const [showMediaSourcePicker, setShowMediaSourcePicker] = useState(false)

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleImageSelect = useCallback(async (e) => {
    const file = e.target?.files?.[0]
    if (file) {
      try {
        const compressed = await compressImage(file, 1024, 0.75)
        if (compressed) {
          setSelectedImage(compressed)
          setShowScanModePicker(true)
        }
      } catch (err) {
        console.warn('[useChatInputState.handleImageSelect] Compression failed, falling back:', err)
        const reader = new FileReader()
        reader.onload = (ev) => {
          setSelectedImage(ev.target.result)
          setShowScanModePicker(true)
        }
        reader.readAsDataURL(file)
      } finally {
        if (e.target) {
          e.target.value = ''
        }
      }
    }
  }, [])

  const {
    isRecording,
    toggleRecording,
    handleStopRecording,
    handleCancelRecording,
  } = useChatSpeech({
    locale,
    inputValue,
    setInputValue,
    onError: onSpeechError,
  })

  return {
    inputValue,
    setInputValue,
    selectedImage,
    setSelectedImage,
    showScanModePicker,
    setShowScanModePicker,
    showMediaSourcePicker,
    setShowMediaSourcePicker,
    inputRef,
    fileInputRef,
    cameraInputRef,
    handleImageSelect,
    isRecording,
    toggleRecording,
    handleStopRecording,
    handleCancelRecording,
  }
}
