/** Build and run the recurring routines and chores that drive the habit side. */

import { useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import type { Chore, Routine, RoutineStep } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { DAY_SHORT } from '@shared/date.ts'
import { isDueOn, routineProgress } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { Avatar, Empty, Field, ProgressRing, Segmented, SPRING, tint } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { ColorPicker, DangerRow, EmojiPicker, PersonPicker, SchedulePicker, Stepper } from './editors/parts.tsx'

function scheduleSummary(schedule: Chore['schedule']): string {
  switch (schedule.type) {
    case 'daily':
      return 'Every day'
    case 'weekly':
      return schedule.days.length === 7
        ? 'Every day'
        : schedule.days.length === 0
          ? 'No days picked'
          : schedule.days.map((day) => DAY_SHORT[day]).join(' · ')
    case 'once':
      return `Once on ${schedule.date}`
    case 'everyN':
      return `Every ${schedule.n} days`
  }
}

export function RoutinesView() {
  const { state, today, dispatch } = useApp()
  const [tab, setTab] = useState<'routines' | 'chores'>('routines')
  const [editingRoutine, setEditingRoutine] = useState<Routine | 'new' | null>(null)
  const [editingChore, setEditingChore] = useState<Chore | 'new' | null>(null)

  const people = state.core.people.filter((person) => !person.archived)
  const routines = state.core.routines.filter((routine) => !routine.archived)
  const chores = state.core.chores.filter((chore) => !chore.archived)

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Habits</span>
          <h1 className="h1">Routines &amp; chores</h1>
        </div>
        <button
          className="btn btn-accent btn-sm"
          onClick={() => (tab === 'routines' ? setEditingRoutine('new') : setEditingChore('new'))}
        >
          <Icon name="plus" size={17} /> {tab === 'routines' ? 'Routine' : 'Chore'}
        </button>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'routines', label: 'Routines' },
            { value: 'chores', label: 'Chores' },
          ]}
        />
      </div>

      {tab === 'routines' ? (
        routines.length === 0 ? (
          <Empty
            emoji="🌅"
            title="No routines yet"
            hint="A routine is a short checklist — morning, after school, bedtime. Finishing the whole list earns a bonus."
            action={
              <button className="btn btn-accent" onClick={() => setEditingRoutine('new')}>
                <Icon name="plus" size={18} /> New routine
              </button>
            }
          />
        ) : (
          <div className="stack">
            {routines.map((routine, index) => {
              const owners = people.filter(
                (person) => routine.assigneeIds.length === 0 || routine.assigneeIds.includes(person.id),
              )
              const dueToday = isDueOn(routine.schedule, today)

              return (
                <motion.div
                  key={routine.id}
                  className="card"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  layout
                >
                  <div className="row-between">
                    <div className="row" style={{ gap: 12, minWidth: 0 }}>
                      <span style={{ fontSize: 30 }}>{routine.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="h2 truncate">{routine.name}</div>
                        <div className="small">
                          {scheduleSummary(routine.schedule)} · {routine.steps.length} steps
                          {routine.points > 0 ? ` · ${routine.points} pt bonus` : ''}
                        </div>
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => setEditingRoutine(routine)} aria-label="Edit routine">
                      <Icon name="edit" size={19} />
                    </button>
                  </div>

                  <div className="chip-row" style={{ marginTop: 14 }}>
                    {routine.steps.map((step) => (
                      <span key={step.id} className="chip">
                        {step.emoji} {step.title}
                      </span>
                    ))}
                  </div>

                  {dueToday && owners.length > 0 ? (
                    <div className="routine-people">
                      {owners.map((person) => {
                        const progress = routineProgress(state, routine, person.id, today)
                        return (
                          <div key={person.id} className="routine-person" style={tint(person.color)}>
                            <ProgressRing ratio={progress.ratio} size={40} thickness={4} color={person.color} />
                            <Avatar person={person} size={26} />
                            <span className="tiny numeral">
                              {progress.done}/{progress.total}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </motion.div>
              )
            })}
          </div>
        )
      ) : chores.length === 0 ? (
        <Empty
          emoji="🧹"
          title="No chores yet"
          hint="Chores can belong to one kid or to the whole family."
          action={
            <button className="btn btn-accent" onClick={() => setEditingChore('new')}>
              <Icon name="plus" size={18} /> New chore
            </button>
          }
        />
      ) : (
        <div className="stack">
          {Object.entries(
            chores.reduce<Record<string, Chore[]>>((groups, chore) => {
              const key = chore.category?.trim() || 'Other'
              ;(groups[key] ??= []).push(chore)
              return groups
            }, {}),
          ).map(([category, list]) => (
            <div key={category}>
              <div className="eyebrow" style={{ margin: '6px 0 8px 2px' }}>{category}</div>
              <div className="card" style={{ padding: 6 }}>
                {list.map((chore) => {
                  const owners = people.filter((person) => chore.assigneeIds.includes(person.id))
                  return (
                    <button key={chore.id} className="manage-row" onClick={() => setEditingChore(chore)}>
                      <span className="manage-emoji">{chore.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{chore.title}</div>
                        <div className="tiny">{scheduleSummary(chore.schedule)}</div>
                      </div>
                      {owners.length > 0 ? (
                        <span className="row" style={{ gap: 4 }}>
                          {owners.slice(0, 3).map((person) => (
                            <Avatar key={person.id} person={person} size={24} />
                          ))}
                        </span>
                      ) : (
                        <span className="chip" style={{ height: 26, fontSize: 11.5 }}>Family</span>
                      )}
                      <span className="manage-points numeral">
                        <Icon name="star" size={12} /> {chore.points}
                      </span>
                      <Icon name="chevronRight" size={17} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <RoutineEditor
        routine={editingRoutine}
        onClose={() => setEditingRoutine(null)}
        onSave={(routine) => dispatch({ t: 'routine.upsert', routine })}
        onDelete={(id) => dispatch({ t: 'routine.remove', id })}
      />
      <ChoreEditor
        chore={editingChore}
        onClose={() => setEditingChore(null)}
        onSave={(chore) => dispatch({ t: 'chore.upsert', chore })}
        onDelete={(id) => dispatch({ t: 'chore.remove', id })}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function useDraft<T>(source: T | 'new' | null, make: () => T): [T, (changes: Partial<T>) => void, (next: T) => void] {
  const key = source === 'new' ? 'new' : ((source as { id?: string } | null)?.id ?? '')
  const [seeded, setSeeded] = useState<string | null>(null)
  const [draft, setDraft] = useState<T>(make)

  if (source && seeded !== key) {
    setSeeded(key)
    setDraft(source === 'new' ? make() : structuredClone(source))
  }

  const patch = (changes: Partial<T>) => setDraft((current) => ({ ...current, ...changes }))
  return [draft, patch, setDraft]
}

function RoutineEditor({
  routine,
  onClose,
  onSave,
  onDelete,
}: {
  routine: Routine | 'new' | null
  onClose: () => void
  onSave: (routine: Routine) => void
  onDelete: (id: string) => void
}) {
  const { state, today } = useApp()
  const [draft, patch, setDraft] = useDraft<Routine>(routine, () => ({
    id: newId('rt'),
    name: '',
    emoji: '🌅',
    timeOfDay: 'morning',
    assigneeIds: [],
    steps: [{ id: newId('st'), title: '', emoji: '✅' }],
    schedule: { type: 'daily' },
    points: 10,
    createdAt: new Date().toISOString(),
  }))
  const [confirming, setConfirming] = useState(false)

  const valid = draft.name.trim().length > 0 && draft.steps.some((step) => step.title.trim())

  const setStep = (id: string, changes: Partial<RoutineStep>) =>
    setDraft({ ...draft, steps: draft.steps.map((step) => (step.id === id ? { ...step, ...changes } : step)) })

  return (
    <>
      <Sheet
        open={routine !== null}
        onClose={onClose}
        title={routine === 'new' ? 'New routine' : 'Edit routine'}
        subtitle="A short checklist that repeats"
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-block"
              disabled={!valid}
              onClick={() => {
                if (!valid) return
                onSave({
                  ...draft,
                  name: draft.name.trim(),
                  steps: draft.steps
                    .filter((step) => step.title.trim())
                    .map((step) => ({ ...step, title: step.title.trim() })),
                })
                onClose()
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="Name">
          <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Morning, Bedtime…" autoFocus />
        </Field>

        <Field label="Time of day">
          <div className="row" style={{ gap: 8 }}>
            {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
              <button
                key={slot}
                className={`chip${draft.timeOfDay === slot ? ' chip-on' : ''}`}
                style={{ flex: 1, justifyContent: 'center', height: 42, textTransform: 'capitalize' }}
                onClick={() => patch({ timeOfDay: slot })}
              >
                {slot}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Icon">
          <EmojiPicker value={draft.emoji} onChange={(emoji) => patch({ emoji })} />
        </Field>

        <Field label="Steps" hint="Drag to reorder. Kids tick these off one at a time.">
          <Reorder.Group axis="y" values={draft.steps} onReorder={(steps) => setDraft({ ...draft, steps })}>
            <AnimatePresence initial={false}>
              {draft.steps.map((step) => (
                <Reorder.Item key={step.id} value={step} className="step-row" transition={SPRING}>
                  <span className="step-grip"><Icon name="drag" size={18} /></span>
                  <input
                    className="step-emoji-input"
                    value={step.emoji}
                    onChange={(event) => setStep(step.id, { emoji: event.target.value.slice(0, 4) })}
                    aria-label="Step icon"
                  />
                  <input
                    value={step.title}
                    onChange={(event) => setStep(step.id, { title: event.target.value })}
                    placeholder="Brush teeth"
                    aria-label="Step name"
                  />
                  <button
                    className="icon-btn"
                    aria-label="Remove step"
                    onClick={() => setDraft({ ...draft, steps: draft.steps.filter((entry) => entry.id !== step.id) })}
                  >
                    <Icon name="close" size={17} />
                  </button>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
          <button
            className="btn btn-soft btn-sm btn-block"
            style={{ marginTop: 10 }}
            onClick={() => setDraft({ ...draft, steps: [...draft.steps, { id: newId('st'), title: '', emoji: '✅' }] })}
          >
            <Icon name="plus" size={16} /> Add a step
          </button>
        </Field>

        <Field label="Bonus points" hint="Awarded once when every step is ticked.">
          <Stepper value={draft.points} onChange={(points) => patch({ points })} step={5} max={500} />
        </Field>

        <Field label="Who does it?" hint="Leave it on Everyone and every kid gets this routine.">
          <PersonPicker
            people={state.core.people.filter((person) => !person.archived)}
            selected={draft.assigneeIds}
            onChange={(assigneeIds) => patch({ assigneeIds })}
          />
        </Field>

        <Field label="Which days?">
          <SchedulePicker value={draft.schedule} onChange={(schedule) => patch({ schedule })} today={today} />
        </Field>

        {routine !== 'new' && routine ? <DangerRow label="Delete this routine" onClick={() => setConfirming(true)} /> : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this routine?"
        onConfirm={() => {
          if (routine && routine !== 'new') onDelete(routine.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}

function ChoreEditor({
  chore,
  onClose,
  onSave,
  onDelete,
}: {
  chore: Chore | 'new' | null
  onClose: () => void
  onSave: (chore: Chore) => void
  onDelete: (id: string) => void
}) {
  const { state, today } = useApp()
  const [draft, patch] = useDraft<Chore>(chore, () => ({
    id: newId('ch'),
    title: '',
    emoji: '🧹',
    assigneeIds: [],
    schedule: { type: 'daily' },
    points: 5,
    category: 'Household',
    createdAt: new Date().toISOString(),
  }))
  const [confirming, setConfirming] = useState(false)

  const valid = draft.title.trim().length > 0
  const categories = Array.from(
    new Set(state.core.chores.map((entry) => entry.category?.trim()).filter(Boolean) as string[]),
  )

  return (
    <>
      <Sheet
        open={chore !== null}
        onClose={onClose}
        title={chore === 'new' ? 'New chore' : 'Edit chore'}
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
        <Field label="Chore">
          <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Take out the trash" autoFocus />
        </Field>

        <Field label="Points">
          <Stepper value={draft.points} onChange={(points) => patch({ points })} step={1} max={200} />
        </Field>

        <Field label="Icon">
          <EmojiPicker value={draft.emoji} onChange={(emoji) => patch({ emoji })} />
        </Field>

        <Field label="Group" hint="Chores are grouped by this on the chores list.">
          <input
            value={draft.category ?? ''}
            onChange={(event) => patch({ category: event.target.value })}
            placeholder="Kitchen, Bedroom, Habits…"
            list="chore-categories"
          />
          <datalist id="chore-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>

        <Field label="Who does it?" hint="Leave on Everyone and it becomes a family job anyone can claim.">
          <PersonPicker
            people={state.core.people.filter((person) => !person.archived)}
            selected={draft.assigneeIds}
            onChange={(assigneeIds) => patch({ assigneeIds })}
          />
        </Field>

        <Field label="Which days?">
          <SchedulePicker value={draft.schedule} onChange={(schedule) => patch({ schedule })} today={today} />
        </Field>

        {chore !== 'new' && chore ? <DangerRow label="Delete this chore" onClick={() => setConfirming(true)} /> : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this chore?"
        onConfirm={() => {
          if (chore && chore !== 'new') onDelete(chore.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}

export { ColorPicker }
