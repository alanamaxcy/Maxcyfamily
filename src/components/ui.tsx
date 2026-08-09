/** Small shared primitives: avatars, rings, checkboxes, switches, segments. */

import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Person } from '@shared/types.ts'
import { photoUrl } from '../lib/api.ts'
import { Icon, type IconName } from './Icon.tsx'

export const SPRING: Transition = { type: 'spring', stiffness: 460, damping: 32, mass: 0.8 }
export const SOFT_SPRING: Transition = { type: 'spring', stiffness: 240, damping: 28 }

/** Style object carrying a person's colour to the CSS custom properties. */
export function tint(color: string): CSSProperties {
  return {
    '--tint': color,
    '--tint-soft': `color-mix(in srgb, ${color} 14%, transparent)`,
  } as CSSProperties
}

/* ------------------------------------------------------------------ */

export function Avatar({
  person,
  size = 48,
  ring = false,
  onClick,
}: {
  person: Pick<Person, 'name' | 'color' | 'emoji' | 'photoId'>
  size?: number
  ring?: boolean
  onClick?: () => void
}) {
  const style: CSSProperties = {
    ...tint(person.color),
    width: size,
    height: size,
    fontSize: Math.round(size * 0.46),
  }

  const content = person.photoId ? (
    <img src={photoUrl(person.photoId)} alt="" />
  ) : person.emoji ? (
    <span>{person.emoji}</span>
  ) : (
    <span>{person.name.slice(0, 1).toUpperCase()}</span>
  )

  if (onClick) {
    return (
      <motion.button
        className={`avatar${ring ? ' avatar-ring' : ''}`}
        style={style}
        onClick={onClick}
        whileTap={{ scale: 0.9 }}
        transition={SPRING}
        aria-label={person.name}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <div className={`avatar${ring ? ' avatar-ring' : ''}`} style={style} aria-hidden="true">
      {content}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function ProgressRing({
  ratio,
  size = 56,
  thickness = 6,
  color = 'var(--forest)',
  children,
}: {
  ratio: number
  size?: number
  thickness?: number
  color?: string
  children?: ReactNode
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, ratio))

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg className="ring" width={size} height={size}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
        />
        <motion.circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {children ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: size * 0.28,
            letterSpacing: '-0.03em',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Check({
  checked,
  color = 'var(--forest)',
  large = false,
  onChange,
  label,
}: {
  checked: boolean
  color?: string
  large?: boolean
  onChange: (event: { x: number; y: number }) => void
  label?: string
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? 'Mark not done' : 'Mark done')}
      className={`check${checked ? ' check-on' : ''}${large ? ' check-lg' : ''}`}
      style={{ '--tint': color } as CSSProperties}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onChange({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      }}
      whileTap={{ scale: 0.85 }}
      animate={checked ? { scale: [1, 1.22, 1] } : { scale: 1 }}
      transition={checked ? { duration: 0.34, ease: [0.34, 1.56, 0.64, 1] } : SPRING}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 9.5 17 19 7.5" />
      </svg>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      style={{ justifyContent: on ? 'flex-end' : 'flex-start' }}
      onClick={() => onChange(!on)}
    >
      <motion.span className="switch-knob" layout transition={SPRING} />
    </button>
  )
}

/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
}) {
  const [bounds, setBounds] = useState<{ left: number; width: number } | null>(null)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = container.current
    if (!root) return
    const active = root.querySelector<HTMLButtonElement>(`button[data-value="${value}"]`)
    if (!active) return
    setBounds({ left: active.offsetLeft, width: active.offsetWidth })
  }, [value, options.length])

  return (
    <div className="seg" ref={container}>
      {bounds ? (
        <motion.div
          className="seg-thumb"
          initial={false}
          animate={{ left: bounds.left, width: bounds.width }}
          transition={SPRING}
        />
      ) : null}
      {options.map((option) => (
        <button
          key={option.value}
          data-value={option.value}
          className={option.value === value ? 'on' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Empty({
  emoji,
  title,
  hint,
  action,
}: {
  emoji: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="empty-emoji">{emoji}</span>
      <div className="h3" style={{ color: 'var(--ink-2)' }}>{title}</div>
      {hint ? <p className="small" style={{ marginTop: 6, maxWidth: 380, marginInline: 'auto' }}>{hint}</p> : null}
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

/* ------------------------------------------------------------------ */

export function IconButton({
  icon,
  onClick,
  label,
  filled = false,
  size = 22,
  style,
}: {
  icon: IconName
  onClick: () => void
  label: string
  filled?: boolean
  size?: number
  style?: CSSProperties
}) {
  return (
    <motion.button
      type="button"
      className={`icon-btn${filled ? ' icon-btn-filled' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.88 }}
      transition={SPRING}
      style={style}
    >
      <Icon name={icon} size={size} />
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

/** Animates between values so points and counts never just snap. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    const from = previous.current
    const to = value
    previous.current = value
    if (from === to) return

    let frame = 0
    const start = performance.now()

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      // easeOutExpo keeps the last digits from crawling.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className="numeral">{display}</span>
}

/* ------------------------------------------------------------------ */

export function Stagger({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export { AnimatePresence, motion }
