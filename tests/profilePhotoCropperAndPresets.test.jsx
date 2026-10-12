// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { PRESET_AVATARS, AVATAR_CATEGORIES } from '../src/components/profile/presetAvatarsData'
import PhotoCropperModal from '../src/components/profile/PhotoCropperModal'
import ChangePhotoModal from '../src/components/profile/ChangePhotoModal'

// Mock useSettingsStore
const mockSetProfilePhoto = vi.fn()
const mockStoreState = {
  profileName: 'Alex Johnson',
  profilePhoto: '',
  setProfilePhoto: mockSetProfilePhoto,
}

vi.mock('../src/store/useSettingsStore', () => ({
  default: (selector) => {
    return typeof selector === 'function' ? selector(mockStoreState) : mockStoreState
  },
}))

describe('Preset Avatars Dataset Integrity', () => {
  it('contains at least 18 unique, well-formed preset vector avatars', () => {
    expect(PRESET_AVATARS.length).toBeGreaterThanOrEqual(18)
    const ids = new Set()
    for (const avatar of PRESET_AVATARS) {
      expect(avatar.id).toBeDefined()
      expect(ids.has(avatar.id)).toBe(false)
      ids.add(avatar.id)
      expect(avatar.label).toBeTruthy()
      expect(avatar.category).toBeTruthy()
      expect(avatar.dataUrl).toContain('data:image/svg+xml')
      expect(avatar.dataUrl).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(avatar.dataUrl).toContain('viewBox="0 0 120 120"')
    }
  })

  it('covers all defined categories with balanced distributions', () => {
    expect(AVATAR_CATEGORIES.length).toBeGreaterThanOrEqual(4)
    const categoryIds = AVATAR_CATEGORIES.map((c) => c.id).filter((id) => id !== 'all')

    for (const catId of categoryIds) {
      const count = PRESET_AVATARS.filter((a) => a.category === catId).length
      expect(count).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('PhotoCropperModal - Interactive Avatar Cropper', () => {
  const dummyImageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  beforeEach(() => {
    cleanup()
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('renders cropper modal when isOpen is true with zoom controls and reset', () => {
    const onApply = vi.fn()
    const onClose = vi.fn()

    render(
      <PhotoCropperModal
        isOpen={true}
        imageSrc={dummyImageSrc}
        onApply={onApply}
        onClose={onClose}
      />,
    )

    expect(screen.getByText(/Sesuaikan Foto Profil/i)).toBeTruthy()
    expect(screen.getByText(/Putar 90°/i)).toBeTruthy()
    expect(screen.getByText(/Atur Ulang/i)).toBeTruthy()
    expect(screen.getByText(/Terapkan Foto/i)).toBeTruthy()
    expect(screen.getByText(/Batal/i)).toBeTruthy()

    const zoomSlider = screen.getByRole('slider')
    expect(zoomSlider).toBeTruthy()
    expect(zoomSlider.getAttribute('value')).toBe('1')
  })

  it('updates zoom level via slider and plus/minus buttons', () => {
    render(
      <PhotoCropperModal
        isOpen={true}
        imageSrc={dummyImageSrc}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const zoomSlider = screen.getByRole('slider')
    act(() => {
      fireEvent.change(zoomSlider, { target: { value: '1.5' } })
    })
    expect(screen.getByText(/150%/i)).toBeTruthy()

    const zoomInBtn = screen.getByRole('button', { name: /Perbesar/i })
    act(() => {
      fireEvent.click(zoomInBtn)
    })
    expect(screen.getByText(/170%/i)).toBeTruthy()

    const zoomOutBtn = screen.getByRole('button', { name: /Perkecil/i })
    act(() => {
      fireEvent.click(zoomOutBtn)
    })
    expect(screen.getByText(/150%/i)).toBeTruthy()

    // Test Reset
    const resetBtn = screen.getByRole('button', { name: /Atur Ulang/i })
    act(() => {
      fireEvent.click(resetBtn)
    })
    expect(screen.getByText(/100%/i)).toBeTruthy()
  })

  it('triggers onApply with canvas data url when clicking Terapkan Foto', () => {
    const onApply = vi.fn()
    render(
      <PhotoCropperModal
        isOpen={true}
        imageSrc={dummyImageSrc}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    )

    const applyBtn = screen.getByRole('button', { name: /Terapkan Foto/i })
    act(() => {
      fireEvent.click(applyBtn)
    })

    expect(onApply).toHaveBeenCalled()
    const appliedUrl = onApply.mock.calls[0][0]
    expect(appliedUrl).toContain('data:image/')
  })

  it('triggers onClose when clicking Batal button', () => {
    const onClose = vi.fn()
    render(
      <PhotoCropperModal
        isOpen={true}
        imageSrc={dummyImageSrc}
        onApply={vi.fn()}
        onClose={onClose}
      />,
    )

    const cancelBtn = screen.getByRole('button', { name: /Batal/i })
    act(() => {
      fireEvent.click(cancelBtn)
    })

    expect(onClose).toHaveBeenCalled()
  })
})

describe('ChangePhotoModal - Gallery & Cropper Integration', () => {
  beforeEach(() => {
    cleanup()
    document.body.innerHTML = ''
    vi.clearAllMocks()
    mockStoreState.profilePhoto = ''
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('renders modal with categorized avatar tabs and avatar grid', () => {
    render(
      <ChangePhotoModal
        isOpen={true}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/Foto Profil/i)).toBeTruthy()
    expect(screen.getByText(/Pilihan Avatar Profil/i)).toBeTruthy()

    // Category pills
    expect(screen.getByRole('button', { name: /^Semua$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Karakter$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Finansial$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Abstrak$/i })).toBeTruthy()

    // Maya avatar in Karakter
    expect(screen.getByText('Maya')).toBeTruthy()
  })

  it('filters avatars when clicking category pills', () => {
    render(
      <ChangePhotoModal
        isOpen={true}
        onClose={vi.fn()}
      />,
    )

    // Switch to Finansial
    const fintechBtn = screen.getByRole('button', { name: /^Finansial$/i })
    act(() => {
      fireEvent.click(fintechBtn)
    })

    expect(screen.getByText('Brankas')).toBeTruthy()
    expect(screen.getByText('Dompet')).toBeTruthy()
    expect(screen.queryByText('Maya')).toBeNull()

    // Switch to Abstrak
    const abstractBtn = screen.getByRole('button', { name: /^Abstrak$/i })
    act(() => {
      fireEvent.click(abstractBtn)
    })

    expect(screen.getByText('Aurora')).toBeTruthy()
    expect(screen.queryByText('Brankas')).toBeNull()
  })

  it('selects preset avatar and saves changes', async () => {
    const onSavePhoto = vi.fn()
    const onClose = vi.fn()

    render(
      <ChangePhotoModal
        isOpen={true}
        onClose={onClose}
        onSavePhoto={onSavePhoto}
      />,
    )

    // Select Maya avatar
    const mayaAvatarBtn = screen.getByText('Maya').closest('button')
    act(() => {
      fireEvent.click(mayaAvatarBtn)
    })

    // Click Simpan Perubahan
    const saveBtn = screen.getByRole('button', { name: /Simpan Perubahan/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(onSavePhoto).toHaveBeenCalled()
    const savedUrl = onSavePhoto.mock.calls[0][0]
    expect(savedUrl).toContain('data:image/svg+xml')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows adjust button when a custom photo is active', () => {
    const customDataUrl = 'data:image/png;base64,mockCustom'
    render(
      <ChangePhotoModal
        isOpen={true}
        onClose={vi.fn()}
        currentPhoto={customDataUrl}
      />,
    )

    expect(screen.getByRole('button', { name: /Sesuaikan/i })).toBeTruthy()
    expect(screen.getByText(/Foto kustom aktif/i)).toBeTruthy()
  })
})
