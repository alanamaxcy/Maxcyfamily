/**
 * Home. Nothing but the family.
 *
 * The schedule lives on its own tab now, which frees this screen to be what a
 * wall display is actually for from across a room: big faces you can tap. Each
 * card carries the day's progress ring, points and streak, so a glance tells
 * you who still owes something.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ID, Person } from '@shared/types.ts'
import { hourInTimezone } from '@shared/date.ts'
import { progressFor, streakFor } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useElementSize, useNow } from '../lib/hooks.ts'
import { Avatar, CountUp, Empty, ProgressRing, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { PersonEditor } from './editors/PersonEditor.tsx'

export function TodayView({ onOpenPerson }: { onOpenPerson: (id: ID) => void }) {
  const { state, today, dispatch } = useApp()
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [photoRef, photo] = useElementSize<HTMLDivElement>()
  const now = useNow('minute')

  const people = state.core.people.filter((person) => !person.archived).sort((a, b) => a.sort - b.sort)

  /** Sized so a family of 3–4 fills the screen without a scroll. */
  const columns = people.length <= 2 ? 2 : people.length <= 4 ? 2 : 3

  /*
   * Faces grow into whatever room is left. CSS hands the photo box the space the
   * name, points and progress line don't use; measuring it — rather than
   * subtracting a guessed chrome height — means the ring is exactly that big and
   * the card never outgrows its row. A portrait iPad ends up a wall display you
   * can read across a room; a phone falls back to the minimum and scrolls.
   */
  const room = Math.min(photo.width || 0, photo.height || 0)
  const ring = room > 0 ? Math.round(Math.max(128, Math.min(300, room))) : 172

  const hour = hourInTimezone(now, state.core.settings.timezone)
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // A count, not a repeat of the date and household name already in the top bar.
  const outstanding = people.filter((person) => {
    const progress = progressFor(state, person.id, today)
    return progress.total > 0 && progress.done < progress.total
  }).length
  const summary =
    people.length === 0
      ? 'Nobody here yet'
      : outstanding === 0
        ? 'Everyone is all caught up'
        : `${outstanding} still ${outstanding === 1 ? 'has' : 'have'} things to do`

  return (
    <>
      <div className="section-head home-head">
        <div>
          <span className="eyebrow">{summary}</span>
          <h1 className="h1" style={{ marginTop: 2 }}>{greeting}</h1>
        </div>
        <button className="btn btn-soft btn-sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={17} /> Person
        </button>
      </div>

      {people.length === 0 ? (
        <Empty
          emoji="👋"
          title="Add everyone in the house"
          hint="Each person gets a photo, a colour, their own routines and their own points."
          action={
            <button className="btn btn-accent" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} /> Add a person
            </button>
          }
        />
      ) : (
        <div className="home-grid" style={{ '--cols': columns } as React.CSSProperties}>
          {people.map((person, index) => {
            const progress = progressFor(state, person.id, today)
            const streak = streakFor(state, person.id, today)
            const allDone = progress.total > 0 && progress.done >= progress.total

            return (
              <motion.button
                key={person.id}
                className={`home-card${allDone ? ' done' : ''}`}
                style={tint(person.color)}
                onClick={() => onOpenPerson(person.id)}
                initial={{ opacity: 0, y: 26, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Every card is the same size, so one measurement sizes them all. */}
                <div className="home-card-photo" ref={index === 0 ? photoRef : undefined}>
                  <ProgressRing
                    ratio={progress.total === 0 ? 0 : progress.ratio}
                    size={ring}
                    thickness={Math.max(6, Math.round(ring * 0.042))}
                    color={person.color}
                  >
                    <Avatar person={person} size={Math.round(ring * 0.84)} />
                  </ProgressRing>

                  {allDone ? (
                    <motion.span
                      className="home-done"
                      initial={{ scale: 0, rotate: -14 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                    >
                      <Icon name="check" size={20} strokeWidth={3.4} />
                    </motion.span>
                  ) : null}
                </div>

                <div className="home-card-name truncate">{person.name}</div>

                <div className="home-card-stats">
                  <span className="person-points">
                    <Icon name="star" size={15} />
                    <CountUp value={person.points} />
                  </span>
                  {streak > 1 ? (
                    <span className="person-streak">
                      <Icon name="flame" size={15} />
                      {streak}
                    </span>
                  ) : null}
                </div>

                <div className="home-card-progress">
                  {progress.total === 0
                    ? 'Nothing due today'
                    : allDone
                      ? 'All done today 🎉'
                      : `${progress.done} of ${progress.total} done`}
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      <PersonEditor
        person={editing}
        onClose={() => setEditing(null)}
        onSave={(person) => dispatch({ t: 'person.upsert', person })}
        onDelete={(id) => dispatch({ t: 'person.remove', id })}
      />
    </>
  )
}
