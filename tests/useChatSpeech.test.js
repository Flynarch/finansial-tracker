// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatSpeech } from '../src/hooks/useChatSpeech'

describe('useChatSpeech Hook Lifecycle & Memory Leak Guards', () => {
  let mockRecognition
  let mockAbort
  let mockStop
  let mockStart

  beforeEach(() => {
    mockAbort = vi.fn()
    mockStop = vi.fn()
    mockStart = vi.fn(() => {
      mockRecognition.onstart?.()
    })

    mockRecognition = {
      start: mockStart,
      stop: mockStop,
      abort: mockAbort,
      lang: '',
      continuous: false,
      interimResults: false,
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    }

    window.SpeechRecognition = vi.fn(function () {
      return mockRecognition
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })

  it('aborts recognition and clears event listeners on unmount (prevent unmounted setState)', async () => {
    const { result, unmount } = renderHook(() =>
      useChatSpeech({
        locale: 'id',
        inputValue: '',
        setInputValue: vi.fn(),
        onError: vi.fn(),
        onAutoSubmit: vi.fn(),
      })
    )

    // Trigger recording
    await act(async () => {
      await result.current.toggleRecording()
    })

    expect(result.current.isRecording).toBe(true)
    expect(mockStart).toHaveBeenCalled()

    // Unmount while recording is active
    unmount()

    // Listeners must be detached before aborting
    expect(mockRecognition.onresult).toBeNull()
    expect(mockRecognition.onerror).toBeNull()
    expect(mockRecognition.onend).toBeNull()
    expect(mockAbort).toHaveBeenCalled()
  })
})
