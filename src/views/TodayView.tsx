/**
 * Home. Nothing but the family.
 *
 * The schedule lives on its own tab now, which frees this screen to be what a
 * wall display is actually for from across a room: big faces you can tap. Each
 * card carries the day's progress ring, points and streak, so a glance tells
 * you who still owes something.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ID, Person } from '@shared/types.ts'
import { hourInTimezone } from '@shared/date.ts'
import { progressFor, streakFor } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useElementSize, useNow } from '../lib/hooks.ts'
import { Avatar, CountUp, Empty, ProgressRing, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { PersonEditor } from './editors/PersonEditor.tsx'

export function TodayView({ onOpenPerson }: { onOpenPerson: (id: ID) => void }) {
  const { state, today, dispatch } = useApp()
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [arranging, setArranging] = useState(false)
  const [photoRef, photo] = useElementSize<HTMLDivElement>()
  const now = useNow('minute')

  const people = state.core.people.filter((person) => !person.archived).sort((a, b) => a.sort - b.sort)

  /*
   * Arrows rather than drag: the cards sit in a grid, and a kid tapping a face
   * is the most common thing that happens on this screen — a drag gesture layered
   * on top of that would fire by accident all day. Rearranging is its own mode,
   * so taps stay taps.
   *
   * Positions are reassigned from the new order rather than swapped between the
   * two cards: a restored backup or a hand-edited file can leave two people
   * holding the same sort value, and swapping those is a no-op that looks like
   * a broken button. A household is small enough that rewriting all of them
   * costs nothing.
   */
  const move = (person: Person, direction: -1 | 1) => {
    const index = people.findIndex((entry) => entry.id === person.id)
    if (index === -1 || index + direction < 0 || index + direction >= people.length) return

    const ordered = [...people]
    const [moved] = ordered.splice(index, 1)
    if (!moved) return
    ordered.splice(index + direction, 0, moved)

    dispatch(
      ordered
        .map((entry, position) => ({ entry, position }))
        .filter(({ entry, position }) => entry.sort !== position)
        .map(({ entry, position }) => ({
          t: 'person.upsert' as const,
          person: { ...entry, sort: position },
        })),
    )
  }

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
  // Short enough to stay on one line next to the buttons on a phone.
  const summary =
    people.length === 0
      ? 'Nobody here yet'
      : outstanding === 0
        ? 'Everyone is caught up'
        : `${outstanding} still to go`

  return (
    <>
      <div className="section-head home-head">
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow truncate" style={{ display: 'block' }}>
            {arranging ? 'Use the arrows' : summary}
          </span>
          <h1 className="h1 truncate" style={{ marginTop: 2 }}>
            {arranging ? 'Rearrange' : greeting}
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {arranging ? (
            <button className="btn btn-accent btn-sm" onClick={() => setArranging(false)}>
              <Icon name="check" size={17} /> Done
            </button>
          ) : (
            <>
              {people.length > 1 ? (
                <button
                  className="icon-btn"
                  onClick={() => setArranging(true)}
                  aria-label="Rearrange the family"
                  title="Rearrange"
                >
                  <Icon name="drag" size={19} />
                </button>
              ) : null}
              <button className="btn btn-soft btn-sm" onClick={() => setEditing('new')}>
                <Icon name="plus" size={17} /> Person
              </button>
            </>
          )}
        </div>
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
              // The arrows are siblings of the card, not children: a button
              // inside a button is invalid and behaves unpredictably on touch.
              <motion.div key={person.id} className="home-cell" layout transition={SPRING}>
                <motion.button
                  className={`home-card${allDone ? ' done' : ''}${arranging ? ' arranging' : ''}`}
                  style={tint(person.color)}
                  onClick={() => (arranging ? undefined : onOpenPerson(person.id))}
                  initial={{ opacity: 0, y: 26, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  whileTap={arranging ? undefined : { scale: 0.97 }}
                  tabIndex={arranging ? -1 : undefined}
                  aria-label={person.name}
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

                <AnimatePresence>
                  {arranging ? (
                    <motion.div
                      className="home-arrange"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.22 }}
                    >
                      <button
                        className="home-arrange-btn"
                        onClick={() => move(person, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${person.name} earlier`}
                      >
                        <Icon name="chevronLeft" size={22} strokeWidth={2.6} />
                      </button>
                      <span className="home-arrange-pos numeral">{index + 1}</span>
                      <button
                        className="home-arrange-btn"
                        onClick={() => move(person, 1)}
                        disabled={index === people.length - 1}
                        aria-label={`Move ${person.name} later`}
                      >
                        <Icon name="chevronRight" size={22} strokeWidth={2.6} />
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
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
