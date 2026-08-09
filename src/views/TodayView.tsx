/**
 * The home screen, and the one that's on the wall all day.
 *
 * Top half is the day in two columns — the household Schedule on the left and
 * connected-calendar Events on the right, with a live "now" marker. Bottom half
 * is the family; tapping a face opens that person's page.
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { ID, ScheduleBlock } from '@shared/types.ts'
import { eventCoversDate, minutesOfDayInTimezone } from '@shared/date.ts'
import { blocksForDate, minutesOfDay, progressFor, streakFor } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { Avatar, CountUp, Empty, IconButton, ProgressRing, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { DayColumns } from '../components/DayColumns.tsx'
import { BlockEditor } from './editors/BlockEditor.tsx'
import { PersonEditor } from './editors/PersonEditor.tsx'

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

  const events = useMemo(
    () => (calendar?.events ?? []).filter((event) => eventCoversDate(event, today, timezone)),
    [calendar, today, timezone],
  )

  /** Headline: what is on right now, or what is next. */
  const headline = useMemo(() => {
    const rows = [
      ...blocks.map((block) => ({
        start: minutesOfDay(block.startTime),
        end: minutesOfDay(block.endTime),
        title: block.title,
      })),
      ...events
        .filter((event) => !event.allDay)
        .map((event) => ({
          start: minutesOfDayInTimezone(event.start, timezone),
          end: minutesOfDayInTimezone(event.end, timezone),
          title: event.title,
        })),
    ].sort((a, b) => a.start - b.start)

    if (rows.length === 0) return 'An open day'
    const current = rows.find((row) => nowMinutes >= row.start && nowMinutes < row.end)
    if (current) return current.title
    const next = rows.find((row) => row.start > nowMinutes)
    return next ? `Next: ${next.title}` : 'All done for today'
  }, [blocks, events, timezone, nowMinutes])

  const people = state.core.people.filter((person) => !person.archived).sort((a, b) => a.sort - b.sort)

  return (
    <>
      <section className="today-schedule">
        <div className="section-head">
          <div>
            <span className="eyebrow">Today&rsquo;s schedule</span>
            <h1 className="h1" style={{ marginTop: 2 }}>{headline}</h1>
          </div>
          <button className="btn btn-soft btn-sm" onClick={() => setEditingBlock('new')}>
            <Icon name="plus" size={17} />
            Block
          </button>
        </div>

        <DayColumns
          date={today}
          events={events}
          boundHeight
          onEditBlock={(block) => setEditingBlock(block)}
          onAddBlock={() => setEditingBlock('new')}
        />
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

export { IconButton }
