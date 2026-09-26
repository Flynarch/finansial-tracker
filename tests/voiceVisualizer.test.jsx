// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { VoiceVisualizer } from '../src/components/chat/VoiceVisualizer'

describe('VoiceVisualizer Component & Audio Context Lifecycle', () => {
  let mockStopTrack
  let mockMediaStream
  let mockAudioContext
  let mockGetUserMedia

  beforeEach(() => {
    mockStopTrack = vi.fn()
    mockMediaStream = {
      getTracks: vi.fn(() => [{ stop: mockStopTrack }]),
    }

    mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream)

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    })

    mockAudioContext = {
      createAnalyser: vi.fn(() => ({
        fftSize: 64,
        frequencyBinCount: 32,
        getByteFrequencyData: vi.fn((arr) => arr.fill(50)),
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      close: vi.fn().mockResolvedValue(undefined),
      state: 'running',
    }

    window.AudioContext = vi.fn(function () {
      return mockAudioContext
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders null when isRecording is false', () => {
    const { container } = render(
      <VoiceVisualizer isRecording={false} onStop={vi.fn()} onCancel={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders recording controls and initializes audio stream when isRecording is true', async () => {
    await act(async () => {
      render(
        <VoiceVisualizer isRecording={true} onStop={vi.fn()} onCancel={vi.fn()} />
      )
    })

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(window.AudioContext).toHaveBeenCalled()
  })

  it('immediately stops stream tracks if component unmounts while getUserMedia is pending (cancellation guard)', async () => {
    let resolveStream
    const delayedPromise = new Promise((resolve) => {
      resolveStream = resolve
    })
    mockGetUserMedia.mockReturnValue(delayedPromise)

    const { unmount } = render(
      <VoiceVisualizer isRecording={true} onStop={vi.fn()} onCancel={vi.fn()} />
    )

    // Unmount before getUserMedia resolves
    unmount()

    // Now resolve getUserMedia
    await act(async () => {
      resolveStream(mockMediaStream)
    })

    // Tracks should have been stopped immediately without creating AudioContext
    expect(mockStopTrack).toHaveBeenCalled()
    expect(window.AudioContext).not.toHaveBeenCalled()
  })
})
