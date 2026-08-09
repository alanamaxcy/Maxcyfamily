/** Month grid, week strip and agenda over the merged calendar + schedule. */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarEvent, LocalEvent } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import {
  DAY_LETTER,
  MONTH_NAMES,
  addDays,
  addMonths,
  eventCoversDate,
  formatDayLabel,
  formatTime,
  monthGridDates,
  monthKeyOf,
  parseISODate,
  weekDates,
} from '@shared/date.ts'
import { blocksForDate, formatClockTime } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, Empty, Field, Segmented, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { ColorPicker, DangerRow, PersonPicker } from './editors/parts.tsx'

type Mode = 'month' | 'week' | 'agenda'

/** Expands stored local events into concrete dates for the visible window. */
function expandLocalEvents(events: LocalEvent[], from: string, to: string): CalendarEvent[] {
  const out: CalendarEvent[] = []

  for (const event of events) {
    const baseDate = event.start.slice(0, 10)
    const durationDays = Math.max(0, Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 86_400_000))

    const emit = (date: string) => {
      // Re-stamp the original time-of-day onto the repeated date.
      const start = event.allDay ? date : `${date}T${event.start.slice(11)}`
      const endDate = event.allDay ? addDays(date, durationDays || 1) : `${addDays(date, durationDays)}T${event.end.slice(11)}`
      out.push({
        id: `${event.id}:${date}`,
        title: event.title,
        start,
        end: endDate,
        allDay: event.allDay,
        ...(event.location ? { location: event.location } : {}),
        ...(event.notes ? { notes: event.notes } : {}),
        color: event.color ?? '#2F6BEA',
        source: 'local',
        sourceName: 'Added here',
        personIds: event.personIds,
      })
    }

    if (event.repeat.type === 'none') {
      if (baseDate >= addDays(from, -durationDays) && baseDate <= to) emit(baseDate)
      continue
    }

    const until = 'until' in event.repeat && event.repeat.until ? event.repeat.until : to
    let cursor = baseDate

    for (let guard = 0; guard < 800 && cursor <= to && cursor <= until; guard++) {
      if (cursor >= from) emit(cursor)
      if (event.repeat.type === 'daily') cursor = addDays(cursor, 1)
      else if (event.repeat.type === 'weekly') {
        cursor = addDays(cursor, 1)
        while (!event.repeat.days.includes(parseISODate(cursor).getDay()) && cursor <= to) {
          cursor = addDays(cursor, 1)
        }
      } else cursor = addMonths(cursor, 1)
    }
  }

  return out
}

export function CalendarView() {
  const { state, today, calendar, calendarError, reloadCalendar, dispatch } = useApp()
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState<LocalEvent | 'new' | null>(null)

  const { weekStartsOn, timezone } = state.core.settings

  const windowStart = mode === 'month' ? `${monthKeyOf(cursor)}-01` : cursor
  const windowEnd = mode === 'agenda' ? addDays(cursor, 45) : addDays(windowStart, 45)

  const allEvents = useMemo(() => {
    const local = expandLocalEvents(state.core.events, addDays(windowStart, -40), windowEnd)
    return [...(calendar?.events ?? []), ...local]
  }, [calendar, state.core.events, windowStart, windowEnd])

  const eventsOn = (date: string) => allEvents.filter((event) => eventCoversDate(event, date, timezone))

  const gridDates = useMemo(() => monthGridDates(cursor, weekStartsOn), [cursor, weekStartsOn])
  const weekRow = useMemo(() => weekDates(cursor, weekStartsOn), [cursor, weekStartsOn])

  const agendaDays = useMemo(() => {
    const days: string[] = []
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i)
      if (eventsOn(date).length > 0 || blocksForDate(state.core, date).length > 0) days.push(date)
    }
    return days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, today, state.core])

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Calendar</span>
          <h1 className="h1">
            {MONTH_NAMES[parseISODate(cursor).getMonth()]} {parseISODate(cursor).getFullYear()}
          </h1>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
            <Icon name="chevronLeft" size={20} />
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => { setCursor(today); setSelected(today) }}>
            Today
          </button>
          <button className="icon-btn" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
            <Icon name="chevronRight" size={20} />
          </button>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 16 }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'agenda', label: 'Agenda' },
          ]}
        />
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => void reloadCalendar(true)} aria-label="Refresh calendars">
            <Icon name="refresh" size={19} />
          </button>
          <button className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={17} /> Event
          </button>
        </div>
      </div>

      {calendarError ? (
        <div className="banner" style={{ marginBottom: 14 }}>
          <Icon name="link" size={16} />
          <span className="truncate">{calendarError}</span>
        </div>
      ) : null}
      {calendar?.errors.map((error) => (
        <div className="banner" key={error.feedId} style={{ marginBottom: 14 }}>
          <Icon name="link" size={16} />
          <span className="truncate">{error.name}: {error.message}</span>
        </div>
      ))}

      {mode === 'month' ? (
        <>
          <div className="cal-head">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index}>{DAY_LETTER[(index + weekStartsOn) % 7]}</span>
            ))}
          </div>
          <motion.div className="cal-grid" layout>
            {gridDates.map((date) => {
              const inMonth = monthKeyOf(date) === monthKeyOf(cursor)
              const dayEvents = eventsOn(date)
              const isToday = date === today

              return (
                <motion.button
                  key={date}
                  className={`cal-cell${inMonth ? '' : ' muted'}${date === selected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setSelected(date)}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <span className="cal-num numeral">{parseISODate(date).getDate()}</span>
                  <span className="cal-dots">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span key={event.id} className="cal-dot" style={{ background: event.color }} />
                    ))}
                  </span>
                </motion.button>
              )
            })}
          </motion.div>

          <DayDetail
            date={selected}
            today={today}
            events={eventsOn(selected)}
            onEditEvent={(event) => {
              const local = state.core.events.find((entry) => event.id.startsWith(`${entry.id}:`))
              if (local) setEditing(local)
            }}
          />
        </>
      ) : null}

      {mode === 'week' ? (
        <>
          <div className="week-strip">
            {weekRow.map((date) => {
              const dayEvents = eventsOn(date)
              return (
                <motion.button
                  key={date}
                  className={`week-cell${date === selected ? ' selected' : ''}${date === today ? ' today' : ''}`}
                  onClick={() => setSelected(date)}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="tiny">{DAY_LETTER[parseISODate(date).getDay()]}</span>
                  <span className="week-num numeral">{parseISODate(date).getDate()}</span>
                  <span className="cal-dots">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className="cal-dot" style={{ background: event.color }} />
                    ))}
                  </span>
                </motion.button>
              )
            })}
          </div>
          <DayDetail
            date={selected}
            today={today}
            events={eventsOn(selected)}
            onEditEvent={(event) => {
              const local = state.core.events.find((entry) => event.id.startsWith(`${entry.id}:`))
              if (local) setEditing(local)
            }}
          />
        </>
      ) : null}

      {mode === 'agenda' ? (
        agendaDays.length === 0 ? (
          <Empty emoji="🌤️" title="Nothing coming up" hint="Add an event, or connect a calendar in Settings." />
        ) : (
          <div className="stack">
            {agendaDays.map((date, index) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="eyebrow" style={{ margin: '4px 0 8px 2px' }}>{formatDayLabel(date, today)}</div>
                <DayDetail date={date} today={today} events={eventsOn(date)} compact />
              </motion.div>
            ))}
          </div>
        )
      ) : null}

      <EventEditor
        event={editing}
        onClose={() => setEditing(null)}
        onSave={(event) => dispatch({ t: 'event.upsert', event })}
        onDelete={(id) => dispatch({ t: 'event.remove', id })}
        defaultDate={selected}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function DayDetail({
  date,
  today,
  events,
  compact = false,
  onEditEvent,
}: {
  date: string
  today: string
  events: CalendarEvent[]
  compact?: boolean
  onEditEvent?: (event: CalendarEvent) => void
}) {
  const { state } = useApp()
  const { timezone } = state.core.settings
  const blocks = blocksForDate(state.core, date)

  const rows = [
    ...blocks.map((block) => ({
      key: block.id,
      time: formatClockTime(block.startTime),
      title: block.title,
      emoji: block.emoji,
      color: block.color,
      meta: 'Schedule',
      personIds: block.personIds,
      event: null as CalendarEvent | null,
    })),
    ...events.map((event) => ({
      key: event.id,
      time: event.allDay ? 'All day' : formatTime(event.start, timezone),
      title: event.title,
      emoji: '',
      color: event.color,
      meta: event.location || event.sourceName,
      personIds: event.personIds,
      event,
    })),
  ]

  if (rows.length === 0) {
    return compact ? null : (
      <div className="card" style={{ marginTop: 18 }}>
        <div className="small" style={{ textAlign: 'center' }}>Nothing on {formatDayLabel(date, today)}</div>
      </div>
    )
  }

  return (
    <div className={compact ? 'card' : 'card'} style={{ marginTop: compact ? 0 : 18, padding: 8 }}>
      {!compact ? (
        <div className="eyebrow" style={{ padding: '6px 10px 10px' }}>{formatDayLabel(date, today)}</div>
      ) : null}
      <AnimatePresence initial={false}>
        {rows.map((row) => {
          const owners = state.core.people.filter((person) => row.personIds.includes(person.id))
          return (
            <motion.div
              key={row.key}
              className="day-event"
              style={tint(row.color)}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => row.event && onEditEvent?.(row.event)}
              role={row.event && onEditEvent ? 'button' : undefined}
            >
              <span className="day-event-rail" />
              <span className="day-event-time numeral">{row.time}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600 }}>
                  {row.emoji ? `${row.emoji} ` : ''}
                  {row.title}
                </div>
                {row.meta ? <div className="tiny truncate">{row.meta}</div> : null}
              </div>
              {owners.length > 0 ? (
                <span className="row" style={{ gap: 4 }}>
                  {owners.slice(0, 3).map((person) => (
                    <Avatar key={person.id} person={person} size={22} />
                  ))}
                </span>
              ) : null}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function EventEditor({
  event,
  onClose,
  onSave,
  onDelete,
  defaultDate,
}: {
  event: LocalEvent | 'new' | null
  onClose: () => void
  onSave: (event: LocalEvent) => void
  onDelete: (id: string) => void
  defaultDate: string
}) {
  const { state } = useApp()
  const make = (): LocalEvent => ({
    id: newId('ev'),
    title: '',
    start: `${defaultDate}T09:00`,
    end: `${defaultDate}T10:00`,
    allDay: false,
    personIds: [],
    color: '#2F6BEA',
    repeat: { type: 'none' },
    createdAt: new Date().toISOString(),
  })

  const key = event === 'new' ? `new:${defaultDate}` : (event?.id ?? '')
  const [seeded, setSeeded] = useState<string | null>(null)
  const [draft, setDraft] = useState<LocalEvent>(make)
  const [confirming, setConfirming] = useState(false)

  if (event && seeded !== key) {
    setSeeded(key)
    setDraft(event === 'new' ? make() : structuredClone(event))
  }

  const patch = (changes: Partial<LocalEvent>) => setDraft((current) => ({ ...current, ...changes }))
  const valid = draft.title.trim().length > 0

  return (
    <>
      <Sheet
        open={event !== null}
        onClose={onClose}
        title={event === 'new' ? 'New event' : 'Edit event'}
        subtitle="Saved here, not in your linked calendars"
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-block"
              disabled={!valid}
              onClick={() => {
                if (!valid) return
                onSave({ ...draft, title: draft.title.trim() })
                onClose()
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="What is it?">
          <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Soccer practice" autoFocus />
        </Field>

        <div className="row-between" style={{ marginTop: 16 }}>
          <span className="field-label" style={{ margin: 0 }}>All day</span>
          <button
            className={`switch${draft.allDay ? ' on' : ''}`}
            style={{ justifyContent: draft.allDay ? 'flex-end' : 'flex-start' }}
            onClick={() => {
              const next = !draft.allDay
              patch({
                allDay: next,
                start: next ? draft.start.slice(0, 10) : `${draft.start.slice(0, 10)}T09:00`,
                end: next ? draft.end.slice(0, 10) : `${draft.start.slice(0, 10)}T10:00`,
              })
            }}
            role="switch"
            aria-checked={draft.allDay}
          >
            <span className="switch-knob" />
          </button>
        </div>

        <div className="field-row" style={{ marginTop: 14 }}>
          <label className="field">
            <span className="field-label">Starts</span>
            <input
              type={draft.allDay ? 'date' : 'datetime-local'}
              value={draft.allDay ? draft.start.slice(0, 10) : draft.start.slice(0, 16)}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Ends</span>
            <input
              type={draft.allDay ? 'date' : 'datetime-local'}
              value={draft.allDay ? draft.end.slice(0, 10) : draft.end.slice(0, 16)}
              onChange={(e) => patch({ end: e.target.value })}
            />
          </label>
        </div>

        <Field label="Colour">
          <ColorPicker value={draft.color ?? '#2F6BEA'} onChange={(color) => patch({ color })} />
        </Field>

        <Field label="Who is it for?">
          <PersonPicker
            people={state.core.people.filter((person) => !person.archived)}
            selected={draft.personIds}
            onChange={(personIds) => patch({ personIds })}
          />
        </Field>

        <Field label="Repeats">
          <div className="row wrap" style={{ gap: 6 }}>
            {(['none', 'daily', 'weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                className={`chip${draft.repeat.type === type ? ' chip-on' : ''}`}
                onClick={() =>
                  patch({
                    repeat:
                      type === 'weekly'
                        ? { type, days: [parseISODate(draft.start.slice(0, 10)).getDay()] }
                        : type === 'none'
                          ? { type }
                          : { type },
                  })
                }
                style={{ textTransform: 'capitalize' }}
              >
                {type === 'none' ? 'Never' : type}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Where">
          <input value={draft.location ?? ''} onChange={(e) => patch({ location: e.target.value })} placeholder="Optional" />
        </Field>

        {event !== 'new' && event ? <DangerRow label="Delete this event" onClick={() => setConfirming(true)} /> : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this event?"
        onConfirm={() => {
          if (event && event !== 'new') onDelete(event.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
