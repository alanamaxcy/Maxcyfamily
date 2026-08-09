/** The family list — add, edit and reorder everyone. */

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ID, Person } from '@shared/types.ts'
import { historyStrip, progressFor, streakFor } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, CountUp, Empty, ProgressRing, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { PersonEditor } from './editors/PersonEditor.tsx'

export function ProfilesView({ onOpenPerson }: { onOpenPerson: (id: ID) => void }) {
  const { state, today, dispatch } = useApp()
  const [editing, setEditing] = useState<Person | 'new' | null>(null)

  const people = [...state.core.people].filter((person) => !person.archived).sort((a, b) => a.sort - b.sort)
  const move = (person: Person, direction: -1 | 1) => {
    const ordered = [...people]
    const index = ordered.findIndex((entry) => entry.id === person.id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= ordered.length) return

    const swap = ordered[target]
    if (!swap) return
    dispatch([
      { t: 'person.upsert', person: { ...person, sort: swap.sort } },
      { t: 'person.upsert', person: { ...swap, sort: person.sort } },
    ])
  }

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Family</span>
          <h1 className="h1">Everyone at home</h1>
        </div>
        <button className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={17} /> Add
        </button>
      </div>

      {people.length === 0 ? (
        <Empty
          emoji="👨‍👩‍👧‍👦"
          title="No one here yet"
          hint="Add each person in the house. Kids get their own page with routines and points."
          action={
            <button className="btn btn-accent" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} /> Add the first person
            </button>
          }
        />
      ) : (
        <div className="stack">
          {people.map((person, index) => {
            const progress = progressFor(state, person.id, today)
            const streak = streakFor(state, person.id, today)
            const strip = historyStrip(state, person.id, today, 21)

            return (
              <motion.div
                key={person.id}
                className="card profile-row"
                style={tint(person.color)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                layout
              >
                <button className="profile-main" onClick={() => onOpenPerson(person.id)}>
                  <ProgressRing ratio={progress.total === 0 ? 0 : progress.ratio} size={72} thickness={5} color={person.color}>
                    <Avatar person={person} size={56} />
                  </ProgressRing>

                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="h2 truncate">{person.name}</span>
                      <span className="chip chip-tinted" style={{ height: 24, fontSize: 11.5 }}>
                        {person.role === 'parent' ? 'Grown-up' : 'Kid'}
                      </span>
                    </div>

                    <div className="row" style={{ gap: 14, marginTop: 5 }}>
                      <span className="row small" style={{ gap: 4 }}>
                        <Icon name="star" size={14} />
                        <strong className="numeral"><CountUp value={person.points} /></strong>
                      </span>
                      {streak > 1 ? (
                        <span className="row small" style={{ gap: 4 }}>
                          <Icon name="flame" size={14} />
                          <strong className="numeral">{streak}</strong>
                        </span>
                      ) : null}
                      <span className="small numeral">
                        {progress.done}/{progress.total} today
                      </span>
                    </div>

                    <div className="heat-strip" aria-hidden="true">
                      {strip.map((day) => (
                        <span
                          key={day.date}
                          className="heat-cell"
                          style={{
                            background:
                              day.total === 0
                                ? 'var(--surface-3)'
                                : `color-mix(in srgb, ${person.color} ${Math.round(18 + day.ratio * 82)}%, transparent)`,
                          }}
                          title={`${day.date}: ${Math.round(day.ratio * 100)}%`}
                        />
                      ))}
                    </div>
                  </div>
                </button>

                <div className="profile-actions">
                  <button className="icon-btn" onClick={() => move(person, -1)} aria-label="Move up" disabled={index === 0}>
                    <Icon name="chevronDown" size={18} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(person, 1)}
                    aria-label="Move down"
                    disabled={index === people.length - 1}
                  >
                    <Icon name="chevronDown" size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => setEditing(person)} aria-label={`Edit ${person.name}`}>
                    <Icon name="edit" size={18} />
                  </button>
                </div>
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
