/**
 * The reward for finishing something: a confetti burst from the checkbox that
 * was tapped, plus the points floating up off it.
 *
 * One canvas, one rAF loop that parks itself when there's nothing on screen —
 * a wall display runs for weeks, so an always-on animation loop is not okay.
 */

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../lib/store.tsx'

const COLORS = ['#FF6B5A', '#FFB020', '#12855F', '#2F6BEA', '#7C4DFF', '#0FA8A0', '#F0567A', '#FF8A34']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  spin: number
  width: number
  height: number
  color: string
  life: number
  round: boolean
}

export function Celebrations() {
  const { celebrations } = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const frame = useRef<number | null>(null)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      const list = particles.current
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)

      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]
        if (!p) continue

        p.vy += 0.42 // gravity
        p.vx *= 0.992 // air drag
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        p.life -= 0.011

        if (p.life <= 0 || p.y > window.innerHeight + 60) {
          list.splice(i, 1)
          continue
        }

        context.save()
        context.translate(p.x, p.y)
        context.rotate(p.rotation)
        context.globalAlpha = Math.max(0, Math.min(1, p.life))
        context.fillStyle = p.color

        if (p.round) {
          context.beginPath()
          context.arc(0, 0, p.width / 2, 0, Math.PI * 2)
          context.fill()
        } else {
          context.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
        }
        context.restore()
      }

      if (list.length > 0) {
        frame.current = requestAnimationFrame(tick)
      } else {
        // Nothing left to draw — stop burning frames until the next burst.
        frame.current = null
        context.clearRect(0, 0, window.innerWidth, window.innerHeight)
      }
    }

    const start = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(tick)
    }

    // Exposed on the element so the effect below can kick the loop.
    ;(canvas as HTMLCanvasElement & { __start?: () => void }).__start = start

    return () => {
      window.removeEventListener('resize', resize)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    for (const celebration of celebrations) {
      if (seen.current.has(celebration.id)) continue
      seen.current.add(celebration.id)
      if (reduced) continue

      const count = celebration.big ? 90 : 34
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (celebration.big ? 2.6 : 1.9)
        const speed = (celebration.big ? 9 : 6.5) + Math.random() * (celebration.big ? 11 : 7)
        const round = Math.random() < 0.34

        particles.current.push({
          x: celebration.x,
          y: celebration.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.34,
          width: round ? 5 + Math.random() * 5 : 6 + Math.random() * 6,
          height: round ? 0 : 9 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#FF6B5A',
          life: 1,
          round,
        })
      }
    }

    // Keep the dedupe set from growing forever on a device that never reloads.
    if (seen.current.size > 400) seen.current = new Set(celebrations.map((item) => item.id))

    const canvas = canvasRef.current as (HTMLCanvasElement & { __start?: () => void }) | null
    canvas?.__start?.()
  }, [celebrations])

  return (
    <>
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />
      <AnimatePresence>
        {celebrations
          .filter((celebration) => celebration.points !== 0)
          .map((celebration) => (
            <motion.div
              key={celebration.id}
              className="point-pop"
              style={{
                left: celebration.x,
                top: celebration.y,
                color: celebration.color,
                x: '-50%',
              }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -110, scale: [0.5, 1.25, 1, 0.95] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], times: [0, 0.18, 0.7, 1] }}
              aria-hidden="true"
            >
              {celebration.points > 0 ? `+${celebration.points}` : celebration.points}
            </motion.div>
          ))}
      </AnimatePresence>
    </>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useApp()

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((message) => (
          <motion.div
            key={message.id}
            className="toast"
            layout
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <span>{message.text}</span>
            {message.actionLabel ? (
              <button
                onClick={() => {
                  message.onAction?.()
                  dismissToast(message.id)
                }}
              >
                {message.actionLabel}
              </button>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
