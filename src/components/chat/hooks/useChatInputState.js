import { useState, useRef, useCallback } from 'react'
import { useChatSpeech } from '../../../hooks/useChatSpeech'

export function useChatInputState({ locale = 'id', onSpeechError }) {
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [showScanModePicker, setShowScanModePicker] = useState(false)
  const [showMediaSourcePicker, setShowMediaSourcePicker] = useState(false)

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleImageSelect = useCallback((e) => {
    const file = e.target?.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setSelectedImage(ev.target.result)
        setShowScanModePicker(true)
      }
      reader.readAsDataURL(file)
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
