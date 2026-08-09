/**
 * Square crop for profile photos: drag to move, pinch or slide to zoom.
 *
 * The preview and the exported image use the same geometry, so what you frame
 * is exactly what gets saved. The image is always kept covering the frame, so
 * you can never crop in empty space.
 */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from './Sheet.tsx'
import { Icon } from './Icon.tsx'

/** On-screen size of the crop window. */
const FRAME = 272
/** Exported edge length. Matches PROFILE_MAX_DIMENSION. */
const OUTPUT = 640
const MAX_ZOOM = 4

interface Offset {
  x: number
  y: number
}

export function PhotoCropper({
  file,
  onCancel,
  onCropped,
}: {
  file: File | null
  onCancel: () => void
  onCropped: (blob: Blob, type: string) => void
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; startX: number; startY: number; from: Offset } | null>(null)
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    if (!file) return
    setError(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })

    const url = URL.createObjectURL(file)
    const element = new Image()
    element.onload = () => setImage(element)
    element.onerror = () => setError('That image could not be opened')
    element.src = url

    return () => URL.revokeObjectURL(url)
  }, [file])

  // Scale at zoom 1: the short edge exactly fills the frame.
  const baseScale = image ? FRAME / Math.min(image.naturalWidth, image.naturalHeight) : 1
  const scale = baseScale * zoom
  const drawWidth = (image?.naturalWidth ?? 0) * scale
  const drawHeight = (image?.naturalHeight ?? 0) * scale

  const clamp = (next: Offset, atZoom = zoom): Offset => {
    if (!image) return { x: 0, y: 0 }
    const s = baseScale * atZoom
    const maxX = Math.max(0, (image.naturalWidth * s - FRAME) / 2)
    const maxY = Math.max(0, (image.naturalHeight * s - FRAME) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  const changeZoom = (next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next))
    setZoom(clamped)
    setOffset((current) => clamp(current, clamped))
  }

  const onPointerDown = (event: React.PointerEvent) => {
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (a && b) pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      drag.current = null
      return
    }
    drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, from: offset }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      changeZoom(pinch.current.zoom * (distance / pinch.current.distance))
      return
    }

    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    setOffset(
      clamp({
        x: active.from.x + (event.clientX - active.startX),
        y: active.from.y + (event.clientY - active.startY),
      }),
    )
  }

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (drag.current?.id === event.pointerId) drag.current = null
  }

  const confirm = async () => {
    if (!image) return
    setBusy(true)
    try {
      // The visible window, expressed in the original image's pixels.
      const sourceSize = FRAME / scale
      const sx = (image.naturalWidth - sourceSize) / 2 - offset.x / scale
      const sy = (image.naturalHeight - sourceSize) / 2 - offset.y / scale

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare the image')

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      // JPEG has no alpha; flatten so a transparent PNG doesn't come out black.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, OUTPUT, OUTPUT)
      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT, OUTPUT)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.88),
      )
      if (!blob) throw new Error('Could not save the crop')
      onCropped(blob, 'image/jpeg')
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={file !== null} onClose={onCancel}>
      <h3 className="h2">Move and scale</h3>
      <p className="small" style={{ marginTop: 4 }}>Drag the photo, pinch or use the slider to zoom.</p>

      <div
        className="cropper"
        ref={frameRef}
        style={{ width: FRAME, height: FRAME }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {image ? (
          <img
            src={image.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              width: drawWidth,
              height: drawHeight,
              left: FRAME / 2 - drawWidth / 2 + offset.x,
              top: FRAME / 2 - drawHeight / 2 + offset.y,
              maxWidth: 'none',
            }}
          />
        ) : (
          <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />
        )}
        <div className="cropper-mask" aria-hidden="true" />
      </div>

      <div className="cropper-zoom">
        <Icon name="image" size={16} />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => changeZoom(Number(event.target.value))}
          aria-label="Zoom"
        />
        <Icon name="search" size={16} />
      </div>

      {error ? <div className="banner" style={{ marginTop: 12 }}>{error}</div> : null}

      <div className="row" style={{ marginTop: 20, gap: 10 }}>
        <button className="btn btn-soft btn-block" onClick={onCancel}>Cancel</button>
        <motion.button
          className="btn btn-primary btn-block"
          onClick={() => void confirm()}
          disabled={!image || busy}
          whileTap={{ scale: 0.96 }}
        >
          {busy ? 'Saving…' : 'Use photo'}
        </motion.button>
      </div>
    </Dialog>
  )
}
