/**
 * Calculate scaled dimensions while preserving aspect ratio and avoiding upscaling.
 */
export function calculateTargetDimensions(origWidth, origHeight, maxDimension = 1024) {
  const w = Number(origWidth) || 1
  const h = Number(origHeight) || 1
  if (w <= maxDimension && h <= maxDimension) {
    return { width: Math.round(w), height: Math.round(h) }
  }

  if (w >= h) {
    const ratio = maxDimension / w
    return { width: maxDimension, height: Math.round(h * ratio) }
  } else {
    const ratio = maxDimension / h
    return { width: Math.round(w * ratio), height: maxDimension }
  }
}

/**
 * Check if a string is a valid base64 data image URL.
 */
export function isBase64Image(str) {
  if (typeof str !== 'string' || !str) return false
  return str.startsWith('data:image/') && str.includes(';base64,')
}

/**
 * Estimate size of base64 data URL in kilobytes.
 */
export function estimateBase64SizeKb(base64Str) {
  if (typeof base64Str !== 'string' || !base64Str) return 0
  const commaIdx = base64Str.indexOf(',')
  const data = commaIdx >= 0 ? base64Str.slice(commaIdx + 1) : base64Str
  const bytes = (data.length * 3) / 4
  return Number((bytes / 1024).toFixed(2))
}

/**
 * Compress an image file or base64 string on client-side to lightweight WebP/JPEG format.
 * Returns a Promise that resolves to compressed base64 data URL.
 */
export function compressImage(fileOrDataUrl, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return resolve('')
    }

    const img = new Image()
    img.onload = () => {
      const { width, height } = calculateTargetDimensions(img.width, img.height, maxDimension)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '')
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Try webp first, fallback to jpeg
      let dataUrl = canvas.toDataURL('image/webp', quality)
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(dataUrl)
    }

    img.onerror = (err) => {
      reject(err)
    }

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target.result
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(fileOrDataUrl)
    } else {
      resolve('')
    }
  })
}
