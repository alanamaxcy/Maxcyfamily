/**
 * Shrinks a picked photo before it is uploaded.
 *
 * Phone cameras hand us 3–5 MB, 4000px images. Storing those costs Blob space,
 * costs the iPad a slow decode on every render, and gains nothing — a profile
 * bubble is 104px and the sleep screen is at most a 2732px panel. Re-encoding
 * to JPEG also normalises HEIC, which non-Apple browsers cannot display.
 *
 * If anything in the pipeline fails (an unusual codec, a locked-down canvas),
 * we hand back the original file rather than blocking the upload.
 */

export interface PreparedImage {
  blob: Blob
  type: string
  width: number
  height: number
  /** True when we re-encoded; false when the original is being passed through. */
  processed: boolean
}

export async function prepareImage(file: File, maxDimension: number, quality = 0.86): Promise<PreparedImage> {
  const fallback: PreparedImage = {
    blob: file,
    type: file.type || 'image/jpeg',
    width: 0,
    height: 0,
    processed: false,
  }

  try {
    const bitmap = await loadBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))

    // Already small enough and already a web-safe format — leave it alone.
    if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      close(bitmap)
      return { ...fallback, width: bitmap.width, height: bitmap.height }
    }

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      close(bitmap)
      return fallback
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    // Flatten onto white; JPEG has no alpha and would otherwise go black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    close(bitmap)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) return fallback

    // A re-encode that came out bigger is not worth having.
    if (blob.size >= file.size && scale === 1) return { ...fallback, width, height }

    return { blob, type: 'image/jpeg', width, height, processed: true }
  } catch {
    return fallback
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation applies the EXIF rotation, so portrait photos taken
      // sideways don't land on the wall rotated.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Safari has historically been patchy here; fall through to <img>.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not decode that image'))
      image.src = url
    })
  } finally {
    // Safe once decoding has finished or failed.
    URL.revokeObjectURL(url)
  }
}

function close(bitmap: ImageBitmap | HTMLImageElement): void {
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
}

/** Profile bubbles never render bigger than ~130px, even at 2× on a big iPad. */
export const PROFILE_MAX_DIMENSION = 640

/** Sleep photos go full-bleed on a 2732px panel; 2048 is plenty after fit-cover. */
export const SLEEP_MAX_DIMENSION = 2048
