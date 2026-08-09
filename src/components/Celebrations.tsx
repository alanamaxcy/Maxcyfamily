/**
 * The reward for finishing something.
 *
 * Three things fire from the checkbox that was tapped:
 *   1. a confetti burst,
 *   2. copies of the item's own emoji, thrown with the confetti,
 *   3. one hero emoji that launches and arcs the full width of the screen.
 *
 * All of it runs on a single canvas plus a couple of DOM sprites, and the rAF
 * loop parks itself the moment nothing is left to draw — this display runs for
 * weeks at a time, so an always-on animation loop is not acceptable.
 */

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp, type Celebration } from '../lib/store.tsx'

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
  decay: number
  shape: 'rect' | 'circle' | 'emoji'
  emoji?: string
  size?: number
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Celebrations() {
  const { celebrations } = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const frame = useRef<number | null>(null)
  const start = useRef<() => void>(() => {})
  const seen = useRef(new Set<string>())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
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

        p.vy += 0.4 // gravity
        p.vx *= 0.992 // air drag
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        p.life -= p.decay

        if (p.life <= 0 || p.y > window.innerHeight + 80) {
          list.splice(i, 1)
          continue
        }

        context.save()
        context.translate(p.x, p.y)
        context.rotate(p.rotation)
        context.globalAlpha = Math.max(0, Math.min(1, p.life))

        if (p.shape === 'emoji') {
          const size = p.size ?? 26
          context.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`
          context.textAlign = 'center'
          context.textBaseline = 'middle'
          context.fillText(p.emoji ?? '⭐️', 0, 0)
        } else if (p.shape === 'circle') {
          context.fillStyle = p.color
          context.beginPath()
          context.arc(0, 0, p.width / 2, 0, Math.PI * 2)
          context.fill()
        } else {
          context.fillStyle = p.color
          context.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
        }
        context.restore()
      }

      if (list.length > 0) {
        frame.current = requestAnimationFrame(tick)
      } else {
        frame.current = null
        context.clearRect(0, 0, window.innerWidth, window.innerHeight)
      }
    }

    start.current = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(tick)
    }

    return () => {
      window.removeEventListener('resize', resize)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return

    for (const celebration of celebrations) {
      if (seen.current.has(celebration.id)) continue
      seen.current.add(celebration.id)

      const confettiCount = celebration.big ? 78 : 30
      const emojiCount = celebration.emoji ? (celebration.big ? 12 : 6) : 0

      for (let i = 0; i < confettiCount; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (celebration.big ? 2.6 : 1.9)
        const speed = (celebration.big ? 9 : 6.5) + Math.random() * (celebration.big ? 11 : 7)
        const circle = Math.random() < 0.34

        particles.current.push({
          x: celebration.x,
          y: celebration.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.34,
          width: circle ? 5 + Math.random() * 5 : 6 + Math.random() * 6,
          height: circle ? 0 : 9 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#FF6B5A',
          life: 1,
          decay: 0.011,
          shape: circle ? 'circle' : 'rect',
        })
      }

      // The item's own emoji, thrown a little harder and spinning slower so it
      // stays readable on the way up.
      for (let i = 0; i < emojiCount; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
        const speed = 8 + Math.random() * 9

        particles.current.push({
          x: celebration.x,
          y: celebration.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: (Math.random() - 0.5) * 0.5,
          spin: (Math.random() - 0.5) * 0.13,
          width: 0,
          height: 0,
          color: '',
          life: 1.1,
          decay: 0.0085,
          shape: 'emoji',
          emoji: celebration.emoji ?? '⭐️',
          size: 22 + Math.random() * 20,
        })
      }
    }

    // Keep the dedupe set bounded on a device that never reloads.
    if (seen.current.size > 400) seen.current = new Set(celebrations.map((item) => item.id))

    start.current()
  }, [celebrations])

  return (
    <>
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <AnimatePresence>
        {celebrations.map((celebration) => (
          <EmojiShot key={celebration.id} celebration={celebration} />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {celebrations
          .filter((celebration) => celebration.points !== 0)
          .map((celebration) => (
            <motion.div
              key={celebration.id}
              className="point-pop"
              style={{ left: celebration.x, top: celebration.y, color: celebration.color, x: '-50%' }}
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

/**
 * The hero: one big copy of the emoji that launches from the checkbox, arcs up
 * and across the whole screen, then drops away. A few ghost copies trail behind
 * it so it reads as a streak rather than a single sliding sprite.
 */
function EmojiShot({ celebration }: { celebration: Celebration }) {
  if (!celebration.emoji || prefersReducedMotion()) return null

  const heroSize = celebration.big ? 96 : 68
  const margin = heroSize * 0.9

  // Fly toward the roomier side so the arc gets the full width, and land
  // somewhere still on screen — an emoji that exits is an emoji nobody saw.
  const direction = celebration.x < window.innerWidth / 2 ? 1 : -1
  const landing =
    direction > 0 ? window.innerWidth - margin : margin
  const dx = landing - celebration.x

  // Arc height, kept clear of the top edge and of the origin.
  const peak = Math.max(90, Math.min(window.innerHeight * 0.34, celebration.y - margin))
  const duration = celebration.big ? 2 : 1.7

  // Five keyframes make a real parabola instead of a bent line.
  const xs = [0, dx * 0.25, dx * 0.5, dx * 0.75, dx]
  const ys = [0, -peak * 0.72, -peak, -peak * 0.78, -peak * 0.32]

  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => {
        const isHero = index === 0
        const delay = index * 0.055
        const ghost = 0.36 - index * 0.06

        return (
          <motion.div
            key={index}
            className="emoji-shot"
            style={{
              left: celebration.x,
              top: celebration.y,
              // Centre the sprite with margins so framer owns the transform
              // outright — it interpolates plain numbers, not calc() strings.
              marginLeft: -heroSize / 2,
              marginTop: -heroSize / 2,
              fontSize: heroSize,
              zIndex: 305 - index,
            }}
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }}
            animate={{
              x: xs,
              y: ys,
              scale: isHero ? [0.2, 1.3, 1.15, 0.85] : [0.15, 0.8, 0.62, 0.4],
              opacity: isHero ? [0, 1, 1, 0] : [0, ghost, ghost * 0.6, 0],
              rotate: [0, direction * 170, direction * 400],
            }}
            exit={{ opacity: 0 }}
            transition={{
              // Horizontal travel eases out; vertical runs linear so gravity
              // reads off the keyframe shape rather than the timing curve.
              x: { duration, delay, ease: [0.19, 0.62, 0.35, 1] },
              y: { duration, delay, ease: 'linear', times: [0, 0.25, 0.5, 0.75, 1] },
              rotate: { duration, delay, ease: 'linear' },
              scale: { duration, delay, times: [0, 0.16, 0.7, 1], ease: 'easeOut' },
              opacity: { duration, delay, times: [0, 0.09, 0.76, 1] },
            }}
            aria-hidden="true"
          >
            {celebration.emoji}
          </motion.div>
        )
      })}
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
