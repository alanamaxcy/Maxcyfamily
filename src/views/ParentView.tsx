/**
 * A grown-up's page.
 *
 * Deliberately not the kid page: no routines, no points, no rewards. A parent
 * needs to know what today looks like, what is coming, what they owe, and what
 * they are cooking — so that is all this screen is.
 */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarEvent, ID, MealSlot, Person } from '@shared/types.ts'
import {
  addDays,
  eventCoversDate,
  formatDayLabel,
  formatTime,
  minutesOfDayInTimezone,
  weekDates,
} from '@shared/date.ts'
import { blocksForDate, formatClockTime, minutesOfDay, resolveDayMeals } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { Avatar, Empty, IconButton, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }
const LOOKAHEAD_DAYS = 14

export function ParentView({ person, onBack }: { person: Person; onBack: () => void }) {
  const { state, today, calendar, dispatch, celebrate } = useApp()
  const now = useNow('minute')
  const { timezone } = state.core.settings
  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), timezone)

  const [showDone, setShowDone] = useState(false)

  /** Their blocks, plus anything family-wide. */
  const blocks = useMemo(() => blocksForDate(state.core, today, person.id), [state.core, today, person.id])

  const mine = (event: CalendarEvent) => event.personIds.length === 0 || event.personIds.includes(person.id)

  const todayEvents = useMemo(
    () =>
      (calendar?.events ?? [])
        .filter((event) => eventCoversDate(event, today, timezone) && mine(event))
        .sort((a, b) => a.start.localeCompare(b.start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendar, today, timezone, person.id],
  )

  /** Today's schedule and calendar on one list, in time order. */
  const timeline = useMemo(() => {
    const rows = [
      ...blocks.map((block) => ({
        id: block.id,
        start: minutesOfDay(block.startTime),
        end: minutesOfDay(block.endTime),
        title: block.title,
        emoji: block.emoji,
        color: block.color,
        when: formatClockTime(block.startTime),
        meta: '',
      })),
      ...todayEvents
        .filter((event) => !event.allDay)
        .map((event) => ({
          id: event.id,
          start: minutesOfDayInTimezone(event.start, timezone),
          end: minutesOfDayInTimezone(event.end, timezone),
          title: event.title,
          emoji: '📅',
          color: event.color,
          when: formatTime(event.start, timezone),
          meta: event.location || event.sourceName,
        })),
    ]
    return rows.sort((a, b) => a.start - b.start)
  }, [blocks, todayEvents, timezone])

  const allDayToday = todayEvents.filter((event) => event.allDay)

  /** The next fortnight, grouped by day, skipping today. */
  const upcoming = useMemo(() => {
    const days: { date: string; events: CalendarEvent[] }[] = []
    for (let i = 1; i <= LOOKAHEAD_DAYS; i++) {
      const date = addDays(today, i)
      const events = (calendar?.events ?? [])
        .filter((event) => eventCoversDate(event, date, timezone) && mine(event))
        .sort((a, b) => a.start.localeCompare(b.start))
      if (events.length > 0) days.push({ date, events })
    }
    return days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, today, timezone, person.id])

  /** Theirs by name, plus anything nobody has claimed. */
  const tasks = useMemo(() => {
    const relevant = state.core.todos.filter(
      (todo) => todo.assigneeId === person.id || todo.assigneeId === undefined,
    )
    const open = relevant
      .filter((todo) => !todo.done)
      .sort((a, b) => {
        // Mine before unclaimed, then by due date, then starred.
        const mineFirst = Number(b.assigneeId === person.id) - Number(a.assigneeId === person.id)
        if (mineFirst !== 0) return mineFirst
        return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
      })
    return { open, done: relevant.filter((todo) => todo.done) }
  }, [state.core.todos, person.id])

  /** Meals this week they are down to cook. */
  const cooking = useMemo(() => {
    const rows: { date: string; slot: MealSlot; title: string; emoji?: string }[] = []
    for (const date of weekDates(today, state.core.settings.weekStartsOn)) {
      const resolved = resolveDayMeals(state.core, date)
      for (const slot of ['breakfast', 'lunch', 'dinner'] as MealSlot[]) {
        const entry = resolved[slot]
        if (entry?.meal.cookId === person.id) {
          rows.push({ date, slot, title: entry.meal.title, ...(entry.meal.emoji ? { emoji: entry.meal.emoji } : {}) })
        }
      }
    }
    return rows
  }, [state.core, today, person.id])

  const current = timeline.find((row) => nowMinutes >= row.start && nowMinutes < row.end)
  const next = timeline.find((row) => row.start > nowMinutes)

  return (
    <div style={tint(person.color)}>
      <motion.div
        className="parent-hero"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <IconButton icon="chevronLeft" label="Back to family" onClick={onBack} filled />
        <Avatar person={person} size={64} ring />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="h1 truncate">{person.name}</h1>
          <p className="small truncate">
            {current
              ? `Now: ${current.title}`
              : next
                ? `Next: ${next.title} at ${next.when}`
                : 'Nothing else scheduled today'}
          </p>
        </div>
      </motion.div>

      <div className="parent-stats">
        <Stat icon="calendar" value={todayEvents.length + blocks.length} label="today" />
        <Stat icon="todos" value={tasks.open.length} label="to do" />
        <Stat icon="meals" value={cooking.length} label="to cook" />
      </div>

      {/* ---------------------------------------------------------- */}
      <section className="kid-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Today</span>
            <h2 className="h2">{formatDayLabel(today, today)}</h2>
          </div>
        </div>

        {allDayToday.length > 0 ? (
          <div className="allday-strip">
            {allDayToday.map((event) => (
              <div key={event.id} className="allday-chip" style={{ '--tint': event.color } as React.CSSProperties}>
                <span className="allday-dot" />
                <span className="truncate">{event.title}</span>
              </div>
            ))}
          </div>
        ) : null}

        {timeline.length === 0 ? (
          <Empty emoji="🌤️" title="A clear day" hint="Nothing on the schedule or the calendar." />
        ) : (
          <div className="card" style={{ padding: 6 }}>
            {timeline.map((row, index) => {
              const isNow = nowMinutes >= row.start && nowMinutes < row.end
              const isPast = nowMinutes >= row.end
              return (
                <motion.div
                  key={row.id}
                  className={`agenda-row${isNow ? ' now' : ''}${isPast ? ' past' : ''}`}
                  style={{ '--tint': row.color } as React.CSSProperties}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
                >
                  <span className="agenda-rail" />
                  <span className="agenda-time numeral">{row.when}</span>
                  <span className="agenda-emoji">{row.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 600 }}>{row.title}</div>
                    {row.meta ? <div className="tiny truncate">{row.meta}</div> : null}
                  </div>
                  {isNow ? <span className="tl-badge">NOW</span> : null}
                </motion.div>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="kid-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">To do</span>
            <h2 className="h2">{tasks.open.length === 0 ? 'All clear' : `${tasks.open.length} open`}</h2>
          </div>
          {tasks.done.length > 0 ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDone((value) => !value)}>
              {showDone ? 'Hide done' : `Done (${tasks.done.length})`}
            </button>
          ) : null}
        </div>

        {tasks.open.length === 0 && !showDone ? (
          <Empty emoji="🎈" title="Nothing on your list" hint="Add tasks on the To-dos tab." />
        ) : (
          <div className="card" style={{ padding: 6 }}>
            <AnimatePresence initial={false}>
              {(showDone ? [...tasks.open, ...tasks.done] : tasks.open).map((todo) => {
                const list = state.core.todoLists.find((entry) => entry.id === todo.listId)
                const overdue = todo.dueDate && !todo.done && todo.dueDate < today

                return (
                  <motion.div
                    key={todo.id}
                    className={`todo-row${todo.done ? ' done' : ''}`}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30, height: 0 }}
                    transition={SPRING}
                  >
                    <button
                      className={`check${todo.done ? ' check-on' : ''}`}
                      style={{ '--tint': person.color } as React.CSSProperties}
                      onClick={(event) => {
                        const done = !todo.done
                        dispatch({ t: 'todo.setDone', id: todo.id, done, at: new Date().toISOString() })
                        if (done) {
                          const box = event.currentTarget.getBoundingClientRect()
                          celebrate({
                            points: 0,
                            x: box.left + box.width / 2,
                            y: box.top + box.height / 2,
                            color: person.color,
                            big: false,
                            emoji: list?.emoji ?? '✅',
                          })
                        }
                      }}
                      aria-label={todo.done ? `Un-check ${todo.text}` : `Complete ${todo.text}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5 9.5 17 19 7.5" />
                      </svg>
                    </button>

                    <div className="todo-main" style={{ cursor: 'default' }}>
                      <span className="todo-text">
                        {todo.starred ? '⭐️ ' : ''}
                        {todo.text}
                      </span>
                      <span className="tiny">
                        {list ? `${list.emoji} ${list.name}` : ''}
                        {todo.assigneeId === undefined ? ' · unclaimed' : ''}
                      </span>
                    </div>

                    {todo.dueDate ? (
                      <span className={`todo-due${overdue ? ' overdue' : ''}`}>
                        {formatDayLabel(todo.dueDate, today)}
                      </span>
                    ) : null}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      {cooking.length > 0 ? (
        <section className="kid-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Kitchen</span>
              <h2 className="h2">You&rsquo;re cooking</h2>
            </div>
          </div>
          <div className="card" style={{ padding: 6 }}>
            {cooking.map((row) => (
              <div key={`${row.date}:${row.slot}`} className="agenda-row" style={{ '--tint': 'var(--forest)' } as React.CSSProperties}>
                <span className="agenda-rail" />
                <span className="agenda-time">{formatDayLabel(row.date, today)}</span>
                <span className="agenda-emoji">{row.emoji ?? '🍽️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{row.title}</div>
                  <div className="tiny">{SLOT_LABEL[row.slot]}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- */}
      <section className="kid-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Coming up</span>
            <h2 className="h2">Next two weeks</h2>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <Empty
            emoji="🗓️"
            title="Nothing on the calendar"
            hint="Connect a calendar in Settings, or add events on the Calendar tab."
          />
        ) : (
          <div className="stack">
            {upcoming.map(({ date, events }) => (
              <div key={date}>
                <div className="eyebrow" style={{ margin: '4px 0 8px 2px' }}>{formatDayLabel(date, today)}</div>
                <div className="card" style={{ padding: 6 }}>
                  {events.map((event) => (
                    <div key={event.id} className="agenda-row" style={{ '--tint': event.color } as React.CSSProperties}>
                      <span className="agenda-rail" />
                      <span className="agenda-time numeral">
                        {event.allDay ? 'All day' : formatTime(event.start, timezone)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{event.title}</div>
                        {event.location ? <div className="tiny truncate">{event.location}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: 'calendar' | 'todos' | 'meals'; value: number; label: string }) {
  return (
    <div className="parent-stat">
      <Icon name={icon} size={18} />
      <span className="parent-stat-value numeral">{value}</span>
      <span className="parent-stat-label">{label}</span>
    </div>
  )
}

export type { ID }
