/** Create or edit a family member, including their profile photo. */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Person } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { PERSON_COLORS } from '@shared/seed.ts'
import { Sheet, ConfirmDialog } from '../../components/Sheet.tsx'
import { Avatar, Field, SPRING } from '../../components/ui.tsx'
import { Icon } from '../../components/Icon.tsx'
import { useApp } from '../../lib/store.tsx'
import { photoUrl, uploadPhoto } from '../../lib/api.ts'
import { PhotoCropper } from '../../components/PhotoCropper.tsx'
import { ColorPicker, DangerRow, EmojiPicker } from './parts.tsx'

const KID_EMOJI = ['🦊', '🐻', '🐨', '🦁', '🐯', '🐸', '🦄', '🐧', '🦖', '🐙', '🦋', '🐝', '🌟', '🚀', '🌈', '⚡️']

function blank(sort: number): Person {
  return {
    id: newId('p'),
    name: '',
    role: 'child',
    color: PERSON_COLORS[sort % PERSON_COLORS.length] ?? '#FF6B5A',
    emoji: KID_EMOJI[sort % KID_EMOJI.length] ?? '🦊',
    points: 0,
    sort,
  }
}

export function PersonEditor({
  person,
  onClose,
  onSave,
  onDelete,
}: {
  person: Person | 'new' | null
  onClose: () => void
  onSave: (person: Person) => void
  onDelete: (id: string) => void
}) {
  const { state, toast } = useApp()
  const [draft, setDraft] = useState<Person>(() => blank(state.core.people.length))
  const [confirming, setConfirming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cropping, setCropping] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!person) return
    setDraft(person === 'new' ? blank(state.core.people.length) : structuredClone(person))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person])

  const patch = (changes: Partial<Person>) => setDraft((current) => ({ ...current, ...changes }))
  const valid = draft.name.trim().length > 0

  const save = () => {
    if (!valid) return
    onSave({ ...draft, name: draft.name.trim() })
    onClose()
  }

  // The cropper already outputs a 640px JPEG, so no further downscaling is
  // needed on this path — it replaces prepareImage rather than following it.
  const uploadCropped = async (blob: Blob, type: string) => {
    setCropping(null)
    setUploading(true)
    try {
      patch({ photoId: await uploadPhoto(blob, type) })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not upload that photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Sheet
        open={person !== null}
        onClose={onClose}
        title={person === 'new' ? 'Add someone' : `Edit ${draft.name || 'person'}`}
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
        <div className="person-preview" style={{ borderColor: draft.color }}>
          <div style={{ position: 'relative' }}>
            <Avatar person={draft} size={104} ring />
            <motion.button
              type="button"
              className="photo-btn"
              onClick={() => fileInput.current?.click()}
              whileTap={{ scale: 0.9 }}
              transition={SPRING}
              aria-label="Change photo"
            >
              <Icon name={uploading ? 'refresh' : 'camera'} size={17} />
            </motion.button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const picked = event.target.files?.[0]
              if (picked) setCropping(picked)
              event.target.value = ''
            }}
          />
          {draft.photoId ? (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-soft btn-sm" onClick={() => fileInput.current?.click()}>
                <Icon name="camera" size={16} /> Change
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => patch({ photoId: undefined })}>
                Use an icon instead
              </button>
            </div>
          ) : (
            <button className="btn btn-soft btn-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Icon name="camera" size={16} /> {uploading ? 'Uploading…' : 'Add a photo'}
            </button>
          )}
        </div>

        <Field label="Name">
          <input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="First name"
            autoFocus
            enterKeyHint="done"
            onKeyDown={(event) => {
              if (event.key === 'Enter') save()
            }}
          />
        </Field>

        <Field label="Role" hint="Grown-ups can undo points and edit anything; kids get the fun screen.">
          <div className="row" style={{ gap: 8 }}>
            {(['child', 'parent'] as const).map((role) => (
              <button
                key={role}
                type="button"
                className={`chip${draft.role === role ? ' chip-on' : ''}`}
                style={{ flex: 1, justifyContent: 'center', height: 44 }}
                onClick={() => patch({ role })}
              >
                {role === 'child' ? '🧒 Kid' : '🧑 Grown-up'}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colour" hint="Used for their ring, their chips on the calendar and their page.">
          <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
        </Field>

        {!draft.photoId ? (
          <Field label="Icon">
            <div className="emoji-grid" style={{ marginBottom: 10 }}>
              {KID_EMOJI.map((emoji) => (
                <motion.button
                  key={emoji}
                  type="button"
                  className={`emoji-cell${emoji === draft.emoji ? ' on' : ''}`}
                  onClick={() => patch({ emoji })}
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
            <EmojiPicker value={draft.emoji} onChange={(emoji) => patch({ emoji })} />
          </Field>
        ) : null}

        <Field label="Birthday" hint="Optional — shows a cake on the calendar.">
          <input
            type="date"
            value={draft.birthday ?? ''}
            onChange={(event) => patch({ birthday: event.target.value || undefined })}
          />
        </Field>

        {person !== 'new' && person ? (
          <>
            <div className="card-flat" style={{ marginTop: 20 }}>
              <div className="row-between">
                <div>
                  <div className="h3">Points balance</div>
                  <div className="small">Adjust by hand if you need to.</div>
                </div>
                <div className="h2 numeral">{draft.points}</div>
              </div>
            </div>
            <DangerRow label={`Remove ${draft.name || 'this person'}`} onClick={() => setConfirming(true)} />
          </>
        ) : null}
      </Sheet>

      <PhotoCropper
        file={cropping}
        onCancel={() => setCropping(null)}
        onCropped={(blob, type) => void uploadCropped(blob, type)}
      />

      <ConfirmDialog
        open={confirming}
        title={`Remove ${draft.name}?`}
        message="Their history stays in the points log, but they disappear from the family screen."
        confirmLabel="Remove"
        onConfirm={() => {
          if (person && person !== 'new') onDelete(person.id)
          onClose()
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}

export { photoUrl }
