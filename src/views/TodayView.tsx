/**
 * The home screen, and the one that's on the wall all day.
 *
 * Top half is the day's rhythm — schedule blocks and calendar events on one
 * timeline, with a live "now" marker. Bottom half is the family; tapping a face
 * opens that kid's page.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { CalendarEvent, ID, ScheduleBlock } from '@shared/types.ts'
import { eventCoversDate, formatTime, minutesOfDayInTimezone } from '@shared/date.ts'
import { blocksForDate, formatClockTime, minutesOfDay, progressFor, streakFor } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { Avatar, CountUp, Empty, IconButton, ProgressRing, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { BlockEditor } from './editors/BlockEditor.tsx'
import { PersonEditor } from './editors/PersonEditor.tsx'

type TimelineEntry =
  | { kind: 'block'; id: string; start: number; end: number; block: ScheduleBlock }
  | { kind: 'event'; id: string; start: number; end: number; event: CalendarEvent }

export function TodayView({ onOpenPerson }: { onOpenPerson: (id: ID) => void }) {
  const { state, today, calendar, dispatch } = useApp()
  const now = useNow('minute')
  const { timezone } = state.core.settings

  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | 'new' | null>(null)
  const [addingPerson, setAddingPerson] = useState(false)

  // Must be read in the household timezone, not the device's — otherwise the
  // "now" marker lands somewhere else entirely from the clock in the top bar.
  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), timezone)

  const blocks = useMemo(() => blocksForDate(state.core, today), [state.core, today])

  const { timed, allDay } = useMemo(() => {
    const events = (calendar?.events ?? []).filter((event) => eventCoversDate(event, today, timezone))
    return {
      timed: events.filter((event) => !event.allDay),
      allDay: events.filter((event) => event.allDay),
    }
  }, [calendar, today, timezone])

  const entries = useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = [
      ...blocks.map((block) => ({
        kind: 'block' as const,
        id: block.id,
        start: minutesOfDay(block.startTime),
        end: minutesOfDay(block.endTime),
        block,
      })),
      ...timed.map((event) => ({
        kind: 'event' as const,
        id: event.id,
        start: minutesOfDayInTimezone(event.start, timezone),
        end: minutesOfDayInTimezone(event.end, timezone),
        event,
      })),
    ]
    return list.sort((a, b) => a.start - b.start || a.end - b.end)
  }, [blocks, timed, timezone])

  // Slide the timeline to whatever is happening right now, once, on arrival.
  const scroller = useRef<HTMLDivElement>(null)
  const scrolledOnce = useRef(false)

  useEffect(() => {
    if (scrolledOnce.current || entries.length === 0) return
    const node = scroller.current?.querySelector<HTMLElement>('[data-current="true"]')
    if (node) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
      scrolledOnce.current = true
    }
  }, [entries.length])

  const people = state.core.people.filter((person) => !person.archived).sort((a, b) => a.sort - b.sort)

  return (
    <>
      <section className="today-schedule">
        <div className="section-head">
          <div>
            <span className="eyebrow">Today&rsquo;s schedule</span>
            <h1 className="h1" style={{ marginTop: 2 }}>
              {entries.length === 0 ? 'An open day' : nowLabel(entries, nowMinutes)}
            </h1>
          </div>
          <button className="btn btn-soft btn-sm" onClick={() => setEditingBlock('new')}>
            <Icon name="plus" size={17} />
            Block
          </button>
        </div>

        {allDay.length > 0 ? (
          <div className="allday-strip">
            {allDay.map((event) => (
              <motion.div
                key={event.id}
                className="allday-chip"
                style={{ '--tint': event.color } as React.CSSProperties}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="allday-dot" />
                <span className="truncate">{event.title}</span>
              </motion.div>
            ))}
          </div>
        ) : null}

        <div className="timeline" ref={scroller}>
          {entries.length === 0 ? (
            <Empty
              emoji="🗓️"
              title="Nothing scheduled yet"
              hint="Add the blocks that make up a normal day — lessons, meals, quiet time. You can change them any time."
              action={
                <button className="btn btn-accent" onClick={() => setEditingBlock('new')}>
                  <Icon name="plus" size={18} /> Add a block
                </button>
              }
            />
          ) : (
            <AnimatePresence initial={false}>
              {entries.map((entry, index) => {
                const isNow = nowMinutes >= entry.start && nowMinutes < entry.end
                const isPast = nowMinutes >= entry.end
                const showNowLine =
                  !isNow &&
                  nowMinutes < entry.start &&
                  (index === 0 || (entries[index - 1]?.end ?? 0) <= nowMinutes)

                return (
                  <div key={entry.id}>
                    {showNowLine ? <NowLine now={now} timezone={timezone} /> : null}
                    <TimelineRow
                      entry={entry}
                      isNow={isNow}
                      isPast={isPast}
                      index={index}
                      timezone={timezone}
                      onEdit={entry.kind === 'block' ? () => setEditingBlock(entry.block) : undefined}
                    />
                    {isNow ? <NowLine now={now} timezone={timezone} inline /> : null}
                  </div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </section>

      <section className="today-family">
        <div className="section-head">
          <span className="eyebrow">Family</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddingPerson(true)}>
            <Icon name="plus" size={16} /> Add
          </button>
        </div>

        {people.length === 0 ? (
          <Empty
            emoji="👋"
            title="Add everyone in the house"
            hint="Each person gets a photo, a colour, their own routines and their own points."
            action={
              <button className="btn btn-accent" onClick={() => setAddingPerson(true)}>
                <Icon name="plus" size={18} /> Add a person
              </button>
            }
          />
        ) : (
          <div className="people-grid">
            {people.map((person, index) => {
              const progress = progressFor(state, person.id, today)
              const streak = streakFor(state, person.id, today)

              return (
                <motion.button
                  key={person.id}
                  className="person-card"
                  style={tint(person.color)}
                  onClick={() => onOpenPerson(person.id)}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  whileTap={{ scale: 0.965 }}
                >
                  <div className="person-card-photo">
                    <ProgressRing ratio={progress.total === 0 ? 0 : progress.ratio} size={112} thickness={5} color={person.color}>
                      <Avatar person={person} size={92} />
                    </ProgressRing>
                    {progress.total > 0 && progress.done >= progress.total ? (
                      <motion.span
                        className="person-done"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      >
                        <Icon name="check" size={15} strokeWidth={3.4} />
                      </motion.span>
                    ) : null}
                  </div>

                  <div className="person-card-name truncate">{person.name}</div>

                  <div className="person-card-stats">
                    <span className="person-points">
                      <Icon name="star" size={14} />
                      <CountUp value={person.points} />
                    </span>
                    {streak > 1 ? (
                      <span className="person-streak">
                        <Icon name="flame" size={14} />
                        {streak}
                      </span>
                    ) : null}
                  </div>

                  {progress.total > 0 ? (
                    <div className="tiny" style={{ marginTop: 2 }}>
                      {progress.done} of {progress.total} done
                    </div>
                  ) : (
                    <div className="tiny" style={{ marginTop: 2 }}>
                      Nothing due
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        )}
      </section>

      <BlockEditor
        block={editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={(block) => dispatch({ t: 'block.upsert', block })}
        onDelete={(id) => dispatch({ t: 'block.remove', id })}
      />
      <PersonEditor
        person={addingPerson ? 'new' : null}
        onClose={() => setAddingPerson(false)}
        onSave={(person) => dispatch({ t: 'person.upsert', person })}
        onDelete={(id) => dispatch({ t: 'person.remove', id })}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function nowLabel(entries: TimelineEntry[], nowMinutes: number): string {
  const current = entries.find((entry) => nowMinutes >= entry.start && nowMinutes < entry.end)
  if (current) return current.kind === 'block' ? current.block.title : current.event.title

  const next = entries.find((entry) => entry.start > nowMinutes)
  if (next) {
    const title = next.kind === 'block' ? next.block.title : next.event.title
    return `Next: ${title}`
  }
  return 'All done for today'
}

function NowLine({ now, timezone, inline = false }: { now: Date; timezone: string; inline?: boolean }) {
  return (
    <motion.div
      className={`now-line${inline ? ' now-line-inline' : ''}`}
      layout
      initial={{ opacity: 0, scaleX: 0.9 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="now-time numeral">{formatTime(now, timezone)}</span>
      <span className="now-rule" />
    </motion.div>
  )
}

function TimelineRow({
  entry,
  isNow,
  isPast,
  index,
  timezone,
  onEdit,
}: {
  entry: TimelineEntry
  isNow: boolean
  isPast: boolean
  index: number
  timezone: string
  onEdit?: () => void
}) {
  const { state } = useApp()

  const color = entry.kind === 'block' ? entry.block.color : entry.event.color
  const title = entry.kind === 'block' ? entry.block.title : entry.event.title
  const emoji = entry.kind === 'block' ? entry.block.emoji : ''
  const startLabel =
    entry.kind === 'block' ? formatClockTime(entry.block.startTime) : formatTime(entry.event.start, timezone)
  const endLabel =
    entry.kind === 'block' ? formatClockTime(entry.block.endTime) : formatTime(entry.event.end, timezone)

  const owners =
    entry.kind === 'block' && entry.block.personIds.length > 0
      ? state.core.people.filter((person) => entry.block.personIds.includes(person.id))
      : []

  return (
    <motion.div
      className={`tl-row${isNow ? ' tl-now' : ''}${isPast ? ' tl-past' : ''}`}
      data-current={isNow ? 'true' : 'false'}
      style={tint(color)}
      layout
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={{ delay: Math.min(index * 0.035, 0.4), duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      onClick={onEdit}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={(event) => {
        if (onEdit && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onEdit()
        }
      }}
    >
      <div className="tl-time">
        <span className="tl-start numeral">{startLabel}</span>
        <span className="tl-end numeral">{endLabel}</span>
      </div>

      <div className="tl-rail">
        <motion.span
          className="tl-dot"
          animate={isNow ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={isNow ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        />
      </div>

      <div className="tl-card">
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          {emoji ? <span className="tl-emoji">{emoji}</span> : <Icon name="calendar" size={18} />}
          <span className="tl-title truncate">{title}</span>
          {isNow ? <span className="tl-badge">NOW</span> : null}
        </div>

        {(owners.length > 0 || entry.kind === 'event') && (
          <div className="tl-meta">
            {owners.length > 0 ? (
              <span className="row" style={{ gap: 5 }}>
                {owners.map((person) => (
                  <Avatar key={person.id} person={person} size={22} />
                ))}
              </span>
            ) : null}
            {entry.kind === 'event' ? (
              <span className="tiny truncate">
                {entry.event.location ? `${entry.event.location} · ` : ''}
                {entry.event.sourceName}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {onEdit ? (
        <span className="tl-edit">
          <Icon name="edit" size={16} />
        </span>
      ) : null}
    </motion.div>
  )
}

export { IconButton }
