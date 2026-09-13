import { describe, it, expect } from 'vitest'
import {
  calculateTargetDimensions,
  isBase64Image,
  estimateBase64SizeKb,
} from '../src/lib/imageCompression'

describe('imageCompression - Dimensions & Helpers', () => {
  it('scales down landscape dimensions proportionally when exceeding maxDimension', () => {
    const dims = calculateTargetDimensions(2048, 1024, 1024)
    expect(dims.width).toBe(1024)
    expect(dims.height).toBe(512)
  })

  it('scales down portrait dimensions proportionally when exceeding maxDimension', () => {
    const dims = calculateTargetDimensions(1024, 2048, 1024)
    expect(dims.width).toBe(512)
    expect(dims.height).toBe(1024)
  })

  it('does not upscale images that are already smaller than maxDimension', () => {
    const dims = calculateTargetDimensions(640, 480, 1024)
    expect(dims.width).toBe(640)
    expect(dims.height).toBe(480)
  })

  it('validates base64 data URLs correctly', () => {
    expect(isBase64Image('data:image/webp;base64,UklGRmQAAABXRUJQVlA4...')).toBe(true)
    expect(isBase64Image('data:image/jpeg;base64,/9j/4AAQSkZJRg...')).toBe(true)
    expect(isBase64Image('data:image/png;base64,iVBORw0KGgo...')).toBe(true)
    expect(isBase64Image('https://example.com/photo.jpg')).toBe(false)
    expect(isBase64Image('')).toBe(false)
    expect(isBase64Image(null)).toBe(false)
  })

  it('estimates base64 payload size accurately in kilobytes', () => {
    // 4000 characters of base64 represents ~3000 bytes (~2.93 KB)
    const mockBase64 = 'data:image/webp;base64,' + 'A'.repeat(4000)
    const sizeKb = estimateBase64SizeKb(mockBase64)
    expect(sizeKb).toBeGreaterThan(2.5)
    expect(sizeKb).toBeLessThan(3.5)
  })
})
