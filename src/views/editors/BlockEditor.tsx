/** Create or edit a schedule block. */

import { useEffect, useState } from 'react'
import type { ScheduleBlock } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { Sheet, ConfirmDialog } from '../../components/Sheet.tsx'
import { Field } from '../../components/ui.tsx'
import { useApp } from '../../lib/store.tsx'
import { ColorPicker, DangerRow, EmojiPicker, PersonPicker, SchedulePicker, TimeRange } from './parts.tsx'

function blank(sort: number): ScheduleBlock {
  return {
    id: newId('blk'),
    title: '',
    emoji: '📚',
    startTime: '09:00',
    endTime: '10:00',
    color: '#2F6BEA',
    personIds: [],
    schedule: { type: 'weekly', days: [1, 2, 3, 4, 5] },
    sort,
  }
}

export function BlockEditor({
  block,
  onClose,
  onSave,
  onDelete,
}: {
  block: ScheduleBlock | 'new' | null
  onClose: () => void
  onSave: (block: ScheduleBlock) => void
  onDelete: (id: string) => void
}) {
  const { state, today } = useApp()
  const [draft, setDraft] = useState<ScheduleBlock>(() => blank(state.core.schedule.length))
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!block) return
    setDraft(block === 'new' ? blank(state.core.schedule.length) : structuredClone(block))
    // Only reseed when the sheet opens on a different target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block])

  const patch = (changes: Partial<ScheduleBlock>) => setDraft((current) => ({ ...current, ...changes }))
  const valid = draft.title.trim().length > 0

  const save = () => {
    if (!valid) return
    onSave({ ...draft, title: draft.title.trim() })
    onClose()
  }

  return (
    <>
      <Sheet
        open={block !== null}
        onClose={onClose}
        title={block === 'new' ? 'New schedule block' : 'Edit block'}
        subtitle="Part of the everyday rhythm"
        footer={
          <>
            <button className="btn btn-soft btn-block" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary btn-block" onClick={save} disabled={!valid}>
              Save
            </button>
          </>
        }
      >
        <Field label="What is it?">
          <input
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="Math, Morning basket, Piano…"
            autoFocus
            enterKeyHint="done"
            onKeyDown={(event) => {
              if (event.key === 'Enter') save()
            }}
          />
        </Field>

        <div style={{ marginTop: 18 }}>
          <TimeRange
            start={draft.startTime}
            end={draft.endTime}
            onChange={(startTime, endTime) => patch({ startTime, endTime })}
          />
        </div>

        <Field label="Colour">
          <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
        </Field>

        <Field label="Icon">
          <EmojiPicker value={draft.emoji} onChange={(emoji) => patch({ emoji })} />
        </Field>

        <Field label="Who is it for?" hint="Leave on Everyone if the whole family does it together.">
          <PersonPicker
            people={state.core.people.filter((person) => !person.archived)}
            selected={draft.personIds}
            onChange={(personIds) => patch({ personIds })}
          />
        </Field>

        <Field label="Which days?">
          <SchedulePicker value={draft.schedule} onChange={(schedule) => patch({ schedule })} today={today} />
        </Field>

        <Field label="Notes" hint="Anything you want on the screen — a chapter, a page number, a reminder.">
          <textarea
            value={draft.notes ?? ''}
            onChange={(event) => patch({ notes: event.target.value })}
            placeholder="Optional"
          />
        </Field>

        {block !== 'new' && block ? (
          <DangerRow label="Delete this block" onClick={() => setConfirming(true)} />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirming}
        title="Delete this block?"
        message="It will disappear from every day it was scheduled on."
        onConfirm={() => {
          if (block && block !== 'new') onDelete(block.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
