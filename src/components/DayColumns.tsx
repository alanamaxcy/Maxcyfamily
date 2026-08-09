/**
 * A day, in two columns: the household's own **Schedule** on the left and the
 * **Events** coming from connected calendars on the right.
 *
 * Keeping them apart is the point. The schedule is the same most days and is
 * read as a rhythm; events are the exceptions and are read as "what is
 * different today". Merging them into one list buried the one appointment that
 * mattered among twelve identical lesson blocks.
 *
 * Shared by the home screen and the Calendar tab so the two never drift.
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

export interface DayColumnsProps {
  date: string
  events: CalendarEvent[]
  /** Narrow the schedule to one person; omit for the whole family. */
  personId?: string
  onEditBlock?: (block: ScheduleBlock) => void
  onEditEvent?: (event: CalendarEvent) => void
  onAddBlock?: () => void
  onAddEvent?: () => void
  /** Caps each column's height so both fit on one screen. */
  boundHeight?: boolean
}

export function DayColumns({
  date,
  events,
  personId,
  onEditBlock,
  onEditEvent,
  onAddBlock,
  onAddEvent,
  boundHeight = false,
}: DayColumnsProps) {
  const { state, today } = useApp()
  const now = useNow('minute')
  const { timezone } = state.core.settings

  const isToday = date === today
  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), timezone)

  const blocks = useMemo(() => blocksForDate(state.core, date, personId), [state.core, date, personId])

  /** Which calendars to show. Device-local, and only offered when there's a choice. */
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
  const visible = events.filter((event) => !hidden.has(event.source))

  const allDay = visible.filter((event) => event.allDay)
  const timed = useMemo(
    () =>
      visible
        .filter((event) => !event.allDay)
        .map((event) => ({ event, start: minutesOfDayInTimezone(event.start, timezone) }))
        // Sorted by clock time — the old merged list appended events after every
        // schedule block, so a 1pm appointment landed below 7pm bedtime.
        .sort((a, b) => a.start - b.start),
    [visible, timezone],
  )

  return (
    <div className={`day-cols${boundHeight ? ' bound' : ''}`}>
      {/* ---------------------------------------------------------- */}
      <section className="day-col">
        <header className="day-col-head">
          <span className="day-col-title">
            <Icon name="today" size={16} />
            Schedule
          </span>
          <span className="day-col-count numeral">{blocks.length}</span>
          {onAddBlock ? (
            <button className="day-col-add" onClick={onAddBlock} aria-label="Add a schedule block">
              <Icon name="plus" size={16} />
            </button>
          ) : null}
        </header>

        <div className="day-col-body">
          {blocks.length === 0 ? (
            <p className="day-col-empty">Nothing scheduled</p>
          ) : (
            <AnimatePresence initial={false}>
              {blocks.map((block, index) => {
                const start = minutesOfDay(block.startTime)
                const end = minutesOfDay(block.endTime)
                const current = isToday && nowMinutes >= start && nowMinutes < end
                const past = isToday && nowMinutes >= end
                const showNow =
                  isToday &&
                  !current &&
                  nowMinutes < start &&
                  (index === 0 || minutesOfDay(blocks[index - 1]!.endTime) <= nowMinutes)

                const owners = state.core.people.filter((person) => block.personIds.includes(person.id))

                return (
                  <div key={block.id}>
                    {showNow ? <NowRule label={formatTime(now, timezone)} /> : null}
                    <motion.button
                      className={`day-item${current ? ' now' : ''}${past ? ' past' : ''}`}
                      style={{ '--tint': block.color } as React.CSSProperties}
                      onClick={() => onEditBlock?.(block)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.32 }}
                      disabled={!onEditBlock}
                    >
                      <span className="day-item-rail" />
                      <span className="day-item-time numeral">{formatClockTime(block.startTime)}</span>
                      <span className="day-item-emoji">{block.emoji}</span>
                      <span className="day-item-title truncate">{block.title}</span>
                      {owners.length > 0 ? (
                        <span className="row" style={{ gap: 3 }}>
                          {owners.slice(0, 3).map((person) => (
                            <Avatar key={person.id} person={person} size={20} />
                          ))}
                        </span>
                      ) : null}
                      {current ? <span className="tl-badge">NOW</span> : null}
                    </motion.button>
                    {current ? <NowRule label={formatTime(now, timezone)} /> : null}
                  </div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="day-col">
        <header className="day-col-head">
          <span className="day-col-title">
            <Icon name="calendar" size={16} />
            Events
          </span>
          <span className="day-col-count numeral">{visible.length}</span>
          {onAddEvent ? (
            <button className="day-col-add" onClick={onAddEvent} aria-label="Add an event">
              <Icon name="plus" size={16} />
            </button>
          ) : null}
        </header>

        {feeds.length > 1 ? (
          <div className="feed-filter">
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

        <div className="day-col-body">
          {allDay.length === 0 && timed.length === 0 ? (
            <p className="day-col-empty">Nothing on the calendar</p>
          ) : (
            <>
              {allDay.map((event) => (
                <motion.button
                  key={event.id}
                  className="day-item allday"
                  style={{ '--tint': event.color } as React.CSSProperties}
                  onClick={() => onEditEvent?.(event)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.32 }}
                  disabled={!onEditEvent}
                >
                  <span className="day-item-rail" />
                  <span className="day-item-time">All day</span>
                  <span className="day-item-title truncate">{event.title}</span>
                  <span className="day-item-source truncate">{event.sourceName}</span>
                </motion.button>
              ))}

              {timed.map(({ event, start }, index) => {
                const end = minutesOfDayInTimezone(event.end, timezone)
                const current = isToday && nowMinutes >= start && nowMinutes < end
                const past = isToday && nowMinutes >= end

                return (
                  <motion.button
                    key={event.id}
                    className={`day-item${current ? ' now' : ''}${past ? ' past' : ''}`}
                    style={{ '--tint': event.color } as React.CSSProperties}
                    onClick={() => onEditEvent?.(event)}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.32 }}
                    disabled={!onEditEvent}
                  >
                    <span className="day-item-rail" />
                    <span className="day-item-time numeral">{formatTime(event.start, timezone)}</span>
                    <div className="day-item-body">
                      <span className="day-item-title truncate">{event.title}</span>
                      <span className="day-item-source truncate">
                        {event.location ? `${event.location} · ` : ''}
                        {event.sourceName}
                      </span>
                    </div>
                    {current ? <span className="tl-badge">NOW</span> : null}
                  </motion.button>
                )
              })}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function NowRule({ label }: { label: string }) {
  return (
    <motion.div
      className="now-rule-row"
      initial={{ opacity: 0, scaleX: 0.92 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.35 }}
    >
      <span className="now-rule-label numeral">{label}</span>
      <span className="now-rule-line" />
    </motion.div>
  )
}
