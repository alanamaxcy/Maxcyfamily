/** Day, week and month over the household schedule and connected calendars. */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { CalendarEvent, LocalEvent, ScheduleBlock } from '@shared/types.ts'
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
import { useApp } from '../lib/store.tsx'
import { Field, Segmented } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { ColorPicker, DangerRow, PersonPicker } from './editors/parts.tsx'
import { DayColumns } from '../components/DayColumns.tsx'
import { BlockEditor } from './editors/BlockEditor.tsx'

type Mode = 'day' | 'week' | 'month'

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
  const [mode, setMode] = useState<Mode>('day')
  const [cursor, setCursor] = useState(today)
  const [editingEvent, setEditingEvent] = useState<LocalEvent | 'new' | null>(null)
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | 'new' | null>(null)

  const { weekStartsOn, timezone } = state.core.settings

  // A window wide enough for whichever view is showing.
  const windowStart = addDays(mode === 'month' ? `${monthKeyOf(cursor)}-01` : cursor, -40)
  const windowEnd = addDays(mode === 'month' ? `${monthKeyOf(cursor)}-01` : cursor, 60)

  const allEvents = useMemo(
    () => [...(calendar?.events ?? []), ...expandLocalEvents(state.core.events, windowStart, windowEnd)],
    [calendar, state.core.events, windowStart, windowEnd],
  )

  const eventsOn = (date: string) => allEvents.filter((event) => eventCoversDate(event, date, timezone))

  /** A tapped event opens its editor only if we own it. */
  const openEvent = (event: CalendarEvent) => {
    const local = state.core.events.find((entry) => event.id.startsWith(`${entry.id}:`))
    if (local) setEditingEvent(local)
  }

  const gridDates = useMemo(() => monthGridDates(cursor, weekStartsOn), [cursor, weekStartsOn])
  const strip = useMemo(() => weekDates(cursor, weekStartsOn), [cursor, weekStartsOn])

  const step = (direction: -1 | 1) => {
    if (mode === 'month') setCursor(addMonths(cursor, direction))
    else if (mode === 'week') setCursor(addDays(cursor, direction * 7))
    else setCursor(addDays(cursor, direction))
  }

  return (
    <>
      <div className="section-head">
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Calendar</span>
          <h1 className="h1 truncate">
            {mode === 'day'
              ? formatDayLabel(cursor, today)
              : `${MONTH_NAMES[parseISODate(cursor).getMonth()]} ${parseISODate(cursor).getFullYear()}`}
          </h1>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
            <Icon name="chevronLeft" size={20} />
          </button>
          <button className="btn btn-soft btn-sm" onClick={() => setCursor(today)}>Today</button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next">
            <Icon name="chevronRight" size={20} />
          </button>
        </div>
      </div>

      <div className="row-between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => void reloadCalendar(true)} aria-label="Refresh calendars">
            <Icon name="refresh" size={19} />
          </button>
          <button className="btn btn-accent btn-sm" onClick={() => setEditingEvent('new')}>
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

      {/* A week of dates, always present so moving day to day is one tap. */}
      {mode !== 'month' ? (
        <div className="week-strip" style={{ marginBottom: 16 }}>
          {strip.map((date) => {
            const count = eventsOn(date).length
            return (
              <motion.button
                key={date}
                className={`week-cell${date === cursor ? ' selected' : ''}${date === today ? ' today' : ''}`}
                onClick={() => {
                  setCursor(date)
                  setMode('day')
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="tiny">{DAY_LETTER[parseISODate(date).getDay()]}</span>
                <span className="week-num numeral">{parseISODate(date).getDate()}</span>
                <span className="cal-dots">
                  {eventsOn(date).slice(0, 3).map((event) => (
                    <span key={event.id} className="cal-dot" style={{ background: event.color }} />
                  ))}
                  {count === 0 ? <span className="cal-dot" style={{ opacity: 0 }} /> : null}
                </span>
              </motion.button>
            )
          })}
        </div>
      ) : null}

      {mode === 'day' ? (
        <DayColumns
          date={cursor}
          events={eventsOn(cursor)}
          onEditBlock={(block) => setEditingBlock(block)}
          onEditEvent={openEvent}
          onAddBlock={() => setEditingBlock('new')}
          onAddEvent={() => setEditingEvent('new')}
        />
      ) : null}

      {mode === 'week' ? (
        <div className="stack">
          {strip.map((date) => (
            <div key={date}>
              <div className="eyebrow" style={{ margin: '4px 0 8px 2px' }}>{formatDayLabel(date, today)}</div>
              <DayColumns
                date={date}
                events={eventsOn(date)}
                onEditBlock={(block) => setEditingBlock(block)}
                onEditEvent={openEvent}
              />
            </div>
          ))}
        </div>
      ) : null}

      {mode === 'month' ? (
        <>
          <div className="cal-head">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index}>{DAY_LETTER[(index + weekStartsOn) % 7]}</span>
            ))}
          </div>
          <div className="cal-grid">
            {gridDates.map((date) => {
              const inMonth = monthKeyOf(date) === monthKeyOf(cursor)
              const dayEvents = eventsOn(date)
              const isToday = date === today

              return (
                <motion.button
                  key={date}
                  className={`cal-cell${inMonth ? '' : ' muted'}${isToday ? ' today' : ''}`}
                  onClick={() => {
                    setCursor(date)
                    setMode('day')
                  }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <span className="cal-num numeral">{parseISODate(date).getDate()}</span>
                  {/* Titles, not dots — a dot tells you nothing you can act on. */}
                  <span className="cal-chips">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="cal-chip truncate"
                        style={{ '--tint': event.color } as React.CSSProperties}
                      >
                        {event.allDay ? '' : `${formatTime(event.start, timezone).replace(/:00/, '')} `}
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="cal-more">+{dayEvents.length - 3} more</span>
                    ) : null}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </>
      ) : null}

      <EventEditor
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={(event) => dispatch({ t: 'event.upsert', event })}
        onDelete={(id) => dispatch({ t: 'event.remove', id })}
        defaultDate={cursor}
      />
      <BlockEditor
        block={editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={(block) => dispatch({ t: 'block.upsert', block })}
        onDelete={(id) => dispatch({ t: 'block.remove', id })}
      />
    </>
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
