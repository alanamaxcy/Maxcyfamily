/**
 * One day's schedule, full width.
 *
 * The household's own blocks are the spine. Calendar events are folded into the
 * same timeline only when the household asks for it — off, this reads as a
 * clean homeschool day; on, the appointments sit in time order alongside it,
 * badged with the calendar they came from so they never look like a block.
 */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarEvent, ScheduleBlock } from '@shared/types.ts'
import { formatTime, minutesOfDayInTimezone } from '@shared/date.ts'
import { blocksForDate, formatClockTime, minutesOfDay } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { Avatar } from './ui.tsx'
import { Icon } from './Icon.tsx'

type Row =
  | { kind: 'block'; id: string; start: number; end: number; block: ScheduleBlock }
  | { kind: 'event'; id: string; start: number; end: number; event: CalendarEvent }

export function DaySchedule({
  date,
  events,
  showEvents,
  personId,
  onEditBlock,
  onEditEvent,
}: {
  date: string
  events: CalendarEvent[]
  showEvents: boolean
  personId?: string
  onEditBlock?: (block: ScheduleBlock) => void
  onEditEvent?: (event: CalendarEvent) => void
}) {
  const { state, today } = useApp()
  const now = useNow('minute')
  const { timezone } = state.core.settings

  const isToday = date === today
  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), timezone)

  const blocks = useMemo(() => blocksForDate(state.core, date, personId), [state.core, date, personId])

  /** Which calendars to include. Only offered when there is a choice. */
  const feeds = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>()
    for (const event of events) {
      if (!seen.has(event.source)) {
        seen.set(event.source, { id: event.source, name: event.sourceName, color: event.color })
      }
    }
    return [...seen.values()]
  }, [events])

  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const visible = showEvents ? events.filter((event) => !hidden.has(event.source)) : []
  const allDay = visible.filter((event) => event.allDay)

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [
      ...blocks.map((block) => ({
        kind: 'block' as const,
        id: block.id,
        start: minutesOfDay(block.startTime),
        end: minutesOfDay(block.endTime),
        block,
      })),
      ...visible
        .filter((event) => !event.allDay)
        .map((event) => ({
          kind: 'event' as const,
          id: event.id,
          start: minutesOfDayInTimezone(event.start, timezone),
          end: minutesOfDayInTimezone(event.end, timezone),
          event,
        })),
    ]
    // Strictly by clock time, so an appointment lands where it belongs rather
    // than after every block.
    return list.sort((a, b) => a.start - b.start || a.end - b.end)
  }, [blocks, visible, timezone])

  if (rows.length === 0 && allDay.length === 0) {
    return (
      <div className="sched-empty">
        <span className="empty-emoji">🗓️</span>
        <div className="h3" style={{ color: 'var(--ink-2)' }}>Nothing scheduled</div>
        <p className="small" style={{ marginTop: 6 }}>Add the blocks that make up a normal day.</p>
      </div>
    )
  }

  return (
    <>
      {showEvents && feeds.length > 1 ? (
        <div className="feed-filter" style={{ padding: '0 2px 12px' }}>
          {feeds.map((feed) => {
            const on = !hidden.has(feed.id)
            return (
              <button
                key={feed.id}
                className={`feed-chip${on ? ' on' : ''}`}
                style={{ '--tint': feed.color } as React.CSSProperties}
                onClick={() =>
                  setHidden((current) => {
                    const next = new Set(current)
                    if (next.has(feed.id)) next.delete(feed.id)
                    else next.add(feed.id)
                    return next
                  })
                }
                aria-pressed={on}
              >
                <span className="feed-chip-dot" />
                {feed.name}
              </button>
            )
          })}
        </div>
      ) : null}

      {allDay.length > 0 ? (
        <div className="allday-strip">
          {allDay.map((event) => (
            <button
              key={event.id}
              className="allday-chip"
              style={{ '--tint': event.color } as React.CSSProperties}
              onClick={() => onEditEvent?.(event)}
            >
              <span className="allday-dot" />
              <span className="truncate">{event.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="sched">
        <AnimatePresence initial={false}>
          {rows.map((row, index) => {
            const current = isToday && nowMinutes >= row.start && nowMinutes < row.end
            const past = isToday && nowMinutes >= row.end
            const showNow =
              isToday &&
              !current &&
              nowMinutes < row.start &&
              (index === 0 || (rows[index - 1]?.end ?? 0) <= nowMinutes)

            const color = row.kind === 'block' ? row.block.color : row.event.color
            const owners =
              row.kind === 'block'
                ? state.core.people.filter((person) => row.block.personIds.includes(person.id))
                : state.core.people.filter((person) => row.event.personIds.includes(person.id))

            return (
              <div key={row.id}>
                {showNow ? <NowRule label={formatTime(now, timezone)} /> : null}

                <motion.button
                  className={`sched-row${current ? ' now' : ''}${past ? ' past' : ''}${row.kind === 'event' ? ' event' : ''}`}
                  style={{ '--tint': color } as React.CSSProperties}
                  onClick={() =>
                    row.kind === 'block' ? onEditBlock?.(row.block) : onEditEvent?.(row.event)
                  }
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.34 }}
                  layout
                >
                  <span className="sched-times">
                    <span className="sched-start numeral">
                      {row.kind === 'block'
                        ? formatClockTime(row.block.startTime)
                        : formatTime(row.event.start, timezone)}
                    </span>
                    <span className="sched-end numeral">
                      {row.kind === 'block'
                        ? formatClockTime(row.block.endTime)
                        : formatTime(row.event.end, timezone)}
                    </span>
                  </span>

                  <span className="sched-rail" />

                  <span className="sched-body">
                    <span className="sched-title-row">
                      {row.kind === 'block' ? (
                        <span className="sched-emoji">{row.block.emoji}</span>
                      ) : (
                        <span className="sched-cal-icon"><Icon name="calendar" size={17} /></span>
                      )}
                      <span className="sched-title truncate">
                        {row.kind === 'block' ? row.block.title : row.event.title}
                      </span>
                      {current ? <span className="tl-badge">NOW</span> : null}
                    </span>

                    {row.kind === 'event' ? (
                      <span className="sched-meta truncate">
                        {row.event.location ? `${row.event.location} · ` : ''}
                        {row.event.sourceName}
                      </span>
                    ) : row.block.notes ? (
                      <span className="sched-meta truncate">{row.block.notes}</span>
                    ) : null}
                  </span>

                  {owners.length > 0 ? (
                    <span className="row" style={{ gap: 4, flex: 'none' }}>
                      {owners.slice(0, 4).map((person) => (
                        <Avatar key={person.id} person={person} size={28} />
                      ))}
                    </span>
                  ) : null}
                </motion.button>

                {current ? <NowRule label={formatTime(now, timezone)} /> : null}
              </div>
            )
          })}
        </AnimatePresence>
      </div>
    </>
  )
}

function NowRule({ label }: { label: string }) {
  return (
    <motion.div
      className="now-rule-row"
      initial={{ opacity: 0, scaleX: 0.94 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.35 }}
    >
      <span className="now-rule-label numeral">{label}</span>
      <span className="now-rule-line" />
    </motion.div>
  )
}
