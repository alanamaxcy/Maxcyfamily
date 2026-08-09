/**
 * Editor building blocks. Every list in the app is edited on the iPad, so these
 * are deliberately fat-finger friendly: big swatches, big day toggles, no
 * dropdowns where a row of buttons will do.
 */

import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import type { ID, Person, Schedule } from '@shared/types.ts'
import { DAY_LETTER } from '@shared/date.ts'
import { PERSON_COLORS } from '@shared/seed.ts'
import { Avatar, SPRING, tint } from '../../components/ui.tsx'
import { Icon } from '../../components/Icon.tsx'
import { Dialog } from '../../components/Sheet.tsx'

export const PALETTE = [
  ...PERSON_COLORS,
  '#E8452F', '#1C4FC4', '#0B6146', '#E08C00', '#5B2EE5', '#0A7E78', '#C43A5B', '#8C8FA0',
]

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((color) => (
        <motion.button
          key={color}
          type="button"
          className={`swatch${color.toLowerCase() === value.toLowerCase() ? ' on' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          whileTap={{ scale: 0.85 }}
          transition={SPRING}
          aria-label={`Colour ${color}`}
          aria-pressed={color.toLowerCase() === value.toLowerCase()}
        >
          {color.toLowerCase() === value.toLowerCase() ? <Icon name="check" size={16} strokeWidth={3.4} /> : null}
        </motion.button>
      ))}
      <label className="swatch swatch-custom" title="Custom colour">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Custom colour"
        />
        <Icon name="plus" size={16} />
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const EMOJI_SETS: Record<string, string[]> = {
  School: ['📚', '➗', '✏️', '🔬', '🗺️', '🎨', '🎼', '🧮', '🔤', '🧪', '🌍', '📐', '🖍️', '📝'],
  Day: ['🌅', '☀️', '🌙', '⭐️', '🧺', '🤫', '🛌', '🚗', '⛪️', '🏡', '🎒', '⏰'],
  Food: ['🍳', '🥪', '🍽️', '🍕', '🥗', '🍎', '🥣', '🍪', '🧃', '🍞', '🥕', '🍦'],
  Play: ['⚽️', '🪁', '🎮', '🧩', '🚲', '🏊', '🎭', '🐾', '🌳', '🎪', '🏀', '🎯'],
  Chores: ['🧹', '🗑️', '🧺', '🍽️', '🛏️', '🚿', '🪥', '🧼', '👕', '🪴', '🐕', '🚙'],
  Fun: ['🎉', '🏆', '🎁', '💎', '🍿', '🎟️', '🧸', '🏅', '💫', '🥳', '🦄', '🌈'],
}

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [group, setGroup] = useState<string>(Object.keys(EMOJI_SETS)[0] ?? 'School')

  return (
    <div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
        {Object.keys(EMOJI_SETS).map((name) => (
          <button
            key={name}
            type="button"
            className={`chip${name === group ? ' chip-on' : ''}`}
            onClick={() => setGroup(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="emoji-grid">
        {(EMOJI_SETS[group] ?? []).map((emoji) => (
          <motion.button
            key={emoji}
            type="button"
            className={`emoji-cell${emoji === value ? ' on' : ''}`}
            onClick={() => onChange(emoji)}
            whileTap={{ scale: 0.85 }}
            transition={SPRING}
          >
            {emoji}
          </motion.button>
        ))}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 4))}
        placeholder="Or type any emoji"
        style={{ marginTop: 10, textAlign: 'center', fontSize: 20 }}
        aria-label="Custom emoji"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * A tappable emoji swatch that opens the full picker.
 *
 * The previous inline text input meant reaching for the emoji keyboard, which
 * is fine on an iPad and genuinely awkward on a laptop.
 */
export function EmojiButton({
  value,
  onChange,
  label = 'Choose an icon',
}: {
  value: string
  onChange: (emoji: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <motion.button
        type="button"
        className="emoji-btn"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.88 }}
        transition={SPRING}
        aria-label={label}
        title={label}
      >
        {value || '🙂'}
      </motion.button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <h3 className="h2" style={{ marginBottom: 14 }}>{label}</h3>
        <EmojiPicker
          value={value}
          onChange={(emoji) => {
            onChange(emoji)
            setOpen(false)
          }}
        />
        <button className="btn btn-soft btn-block" style={{ marginTop: 18 }} onClick={() => setOpen(false)}>
          Done
        </button>
      </Dialog>
    </>
  )
}

export function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="day-picker">
      {DAY_LETTER.map((letter, index) => {
        const on = days.includes(index)
        return (
          <motion.button
            key={index}
            type="button"
            className={`day-cell${on ? ' on' : ''}`}
            onClick={() => onChange(on ? days.filter((day) => day !== index) : [...days, index].sort())}
            whileTap={{ scale: 0.88 }}
            transition={SPRING}
            aria-pressed={on}
            aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}
          >
            {letter}
          </motion.button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function SchedulePicker({
  value,
  onChange,
  today,
}: {
  value: Schedule
  onChange: (schedule: Schedule) => void
  today: string
}) {
  const options: { type: Schedule['type']; label: string }[] = [
    { type: 'daily', label: 'Every day' },
    { type: 'weekly', label: 'Certain days' },
    { type: 'weeklyN', label: 'Every other week' },
    { type: 'everyN', label: 'Every few days' },
    { type: 'once', label: 'Just once' },
  ]

  return (
    <div>
      <div className="row wrap" style={{ gap: 6 }}>
        {options.map((option) => (
          <button
            key={option.type}
            type="button"
            className={`chip${value.type === option.type ? ' chip-on' : ''}`}
            onClick={() => {
              if (option.type === value.type) return
              if (option.type === 'daily') onChange({ type: 'daily' })
              if (option.type === 'weekly') onChange({ type: 'weekly', days: [1, 2, 3, 4, 5] })
              if (option.type === 'weeklyN') {
                onChange({ type: 'weeklyN', days: [1], everyWeeks: 2, startDate: today })
              }
              if (option.type === 'everyN') onChange({ type: 'everyN', n: 2, startDate: today })
              if (option.type === 'once') onChange({ type: 'once', date: today })
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {value.type === 'weekly' ? (
        <div style={{ marginTop: 12 }}>
          <DayPicker days={value.days} onChange={(days) => onChange({ type: 'weekly', days })} />
        </div>
      ) : null}

      {value.type === 'weeklyN' ? (
        <div style={{ marginTop: 12 }}>
          <DayPicker
            days={value.days}
            onChange={(days) => onChange({ ...value, days })}
          />
          <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
            {[2, 3, 4].map((weeks) => (
              <button
                key={weeks}
                type="button"
                className={`chip${value.everyWeeks === weeks ? ' chip-on' : ''}`}
                onClick={() => onChange({ ...value, everyWeeks: weeks })}
              >
                {weeks === 2 ? 'Every other week' : `Every ${weeks} weeks`}
              </button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="field-label">Starting the week of</span>
            <input
              type="date"
              value={value.startDate}
              onChange={(event) => onChange({ ...value, startDate: event.target.value })}
            />
            <span className="field-hint">
              Sets which week counts as the first one, so "every other" lands on the right weeks.
            </span>
          </label>
        </div>
      ) : null}

      {value.type === 'everyN' ? (
        <div className="row" style={{ marginTop: 12, gap: 10 }}>
          <span className="small">Every</span>
          <input
            type="number"
            min={1}
            max={60}
            value={value.n}
            onChange={(event) =>
              onChange({ type: 'everyN', n: Math.max(1, Number(event.target.value) || 1), startDate: value.startDate })
            }
            style={{ width: 90 }}
            aria-label="Number of days"
          />
          <span className="small">days, starting</span>
          <input
            type="date"
            value={value.startDate}
            onChange={(event) => onChange({ type: 'everyN', n: value.n, startDate: event.target.value })}
            style={{ width: 'auto', flex: 1 }}
            aria-label="Start date"
          />
        </div>
      ) : null}

      {value.type === 'once' ? (
        <div style={{ marginTop: 12 }}>
          <input
            type="date"
            value={value.date}
            onChange={(event) => onChange({ type: 'once', date: event.target.value })}
            aria-label="Date"
          />
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function PersonPicker({
  people,
  selected,
  onChange,
  everyoneLabel = 'Everyone',
}: {
  people: Person[]
  selected: ID[]
  onChange: (ids: ID[]) => void
  everyoneLabel?: string
}) {
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      <motion.button
        type="button"
        className={`person-pill${selected.length === 0 ? ' on' : ''}`}
        onClick={() => onChange([])}
        whileTap={{ scale: 0.94 }}
        transition={SPRING}
      >
        <span className="person-pill-all">👨‍👩‍👧‍👦</span>
        {everyoneLabel}
      </motion.button>

      {people.map((person) => {
        const on = selected.includes(person.id)
        return (
          <motion.button
            key={person.id}
            type="button"
            className={`person-pill${on ? ' on' : ''}`}
            style={tint(person.color)}
            onClick={() =>
              onChange(on ? selected.filter((id) => id !== person.id) : [...selected, person.id])
            }
            whileTap={{ scale: 0.94 }}
            transition={SPRING}
            aria-pressed={on}
          >
            <Avatar person={person} size={26} />
            {person.name}
          </motion.button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function TimeRange({
  start,
  end,
  onChange,
}: {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  return (
    <div className="field-row">
      <label className="field">
        <span className="field-label">Starts</span>
        <input
          type="time"
          value={start}
          onChange={(event) => {
            const next = event.target.value
            // Dragging the start past the end shifts the end along with it.
            onChange(next, next > end ? next : end)
          }}
        />
      </label>
      <label className="field">
        <span className="field-label">Ends</span>
        <input type="time" value={end} onChange={(event) => onChange(start, event.target.value)} />
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Stepper({
  value,
  onChange,
  step = 5,
  min = 0,
  max = 999,
  suffix,
}: {
  value: number
  onChange: (next: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next))

  return (
    <div className="stepper">
      <motion.button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        whileTap={{ scale: 0.86 }}
        transition={SPRING}
        aria-label="Decrease"
      >
        <Icon name="minus" size={18} strokeWidth={2.6} />
      </motion.button>
      <span className="stepper-value numeral">
        {value}
        {suffix ? <span className="stepper-suffix">{suffix}</span> : null}
      </span>
      <motion.button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        whileTap={{ scale: 0.86 }}
        transition={SPRING}
        aria-label="Increase"
      >
        <Icon name="plus" size={18} strokeWidth={2.6} />
      </motion.button>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function DangerRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-danger btn-block" onClick={onClick} style={{ marginTop: 22 }}>
      <Icon name="trash" size={17} />
      {label}
    </button>
  )
}

export const cardStyle = (color: string): CSSProperties => tint(color)
