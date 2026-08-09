/** Everything configurable: calendars, weather, sleep photos, theme, backup. */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarFeed, FullState, SleepPhoto } from '@shared/types.ts'
import { newId } from '@shared/id.ts'
import { initialState } from '@shared/seed.ts'
import { useApp } from '../lib/store.tsx'
import { photoUrl, searchPlaces, uploadPhoto } from '../lib/api.ts'
import { SLEEP_MAX_DIMENSION, prepareImage } from '../lib/image.ts'
import { useDebounced } from '../lib/hooks.ts'
import { Field, Segmented, Switch, SPRING } from '../components/ui.tsx'
import { Icon } from '../components/Icon.tsx'
import { Sheet, ConfirmDialog } from '../components/Sheet.tsx'
import { ColorPicker, Stepper } from './editors/parts.tsx'

export function SettingsView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, restore, reloadCalendar, toast, status, pendingCount } = useApp()
  const settings = state.core.settings
  const [confirmReset, setConfirmReset] = useState(false)
  const restoreInput = useRef<HTMLInputElement>(null)

  const patch = (changes: Partial<typeof settings>) => dispatch({ t: 'settings.patch', patch: changes })

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `family-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as FullState
      if (!parsed?.core) throw new Error('That file is not a family backup')
      await restore(parsed)
      toast('Restored from backup')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not read that file')
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Settings" subtitle={settings.householdName}>
        <Section title="Household">
          <Field label="Family name" hint="Shown next to the date at the top.">
            <input
              value={settings.householdName}
              onChange={(event) => patch({ householdName: event.target.value })}
              placeholder="The Maxcys"
            />
          </Field>

          <Field label="Time zone" hint="Everything — chores, streaks, the schedule — uses this clock.">
            <select value={settings.timezone} onChange={(event) => patch({ timezone: event.target.value })}>
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </Field>

          <Field label="Week starts on">
            <Segmented
              value={String(settings.weekStartsOn)}
              onChange={(value) => patch({ weekStartsOn: Number(value) })}
              options={[
                { value: '0', label: 'Sunday' },
                { value: '1', label: 'Monday' },
              ]}
            />
          </Field>

          <Field label="Appearance" hint="Auto switches to a dark screen between 8pm and 6am.">
            <Segmented
              value={settings.theme}
              onChange={(theme) => patch({ theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
          </Field>

          <Row label="Confetti when a kid finishes something">
            <Switch on={settings.celebrate} onChange={(celebrate) => patch({ celebrate })} label="Celebrations" />
          </Row>
        </Section>

        <Section title="Calendars" hint="Paste the secret iCal link from Google, Apple or Outlook. Read-only.">
          <CalendarFeeds />
          <button className="btn btn-soft btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => void reloadCalendar(true)}>
            <Icon name="refresh" size={16} /> Refresh calendars now
          </button>
        </Section>

        <Section title="Weather">
          <WeatherSettings />
        </Section>

        <Section title="Sleep screen" hint="After a quiet spell the display turns into a photo frame.">
          <Row label="Turn on the sleep screen">
            <Switch
              on={settings.sleep.enabled}
              onChange={(enabled) => patch({ sleep: { ...settings.sleep, enabled } })}
              label="Sleep screen"
            />
          </Row>

          <Field label="Start after">
            <Stepper
              value={settings.sleep.idleMinutes}
              onChange={(idleMinutes) => patch({ sleep: { ...settings.sleep, idleMinutes } })}
              step={1}
              min={1}
              max={120}
              suffix=" min"
            />
          </Field>

          <Field label="Change photo every">
            <Stepper
              value={settings.sleep.intervalSeconds}
              onChange={(intervalSeconds) => patch({ sleep: { ...settings.sleep, intervalSeconds } })}
              step={5}
              min={5}
              max={600}
              suffix=" sec"
            />
          </Field>

          <Row label="Show the clock">
            <Switch
              on={settings.sleep.showClock}
              onChange={(showClock) => patch({ sleep: { ...settings.sleep, showClock } })}
              label="Clock"
            />
          </Row>
          <Row label="Show what's next">
            <Switch
              on={settings.sleep.showNextEvent}
              onChange={(showNextEvent) => patch({ sleep: { ...settings.sleep, showNextEvent } })}
              label="Next event"
            />
          </Row>
          <Row label="Show the weather">
            <Switch
              on={settings.sleep.showWeather}
              onChange={(showWeather) => patch({ sleep: { ...settings.sleep, showWeather } })}
              label="Weather"
            />
          </Row>

          <SleepPhotos />
        </Section>

        <Section title="Lock" hint="Leave empty for no lock. Set a PIN if you'd rather the link not be wide open.">
          <Field label="PIN">
            <input
              value={settings.pin}
              onChange={(event) => patch({ pin: event.target.value.replace(/\D/g, '').slice(0, 8) })}
              placeholder="No PIN"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
        </Section>

        <Section title="Backup">
          <p className="small" style={{ marginBottom: 12 }}>
            Sync status: <strong>{status}</strong>
            {pendingCount > 0 ? ` · ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to send` : ''}
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-soft btn-block" onClick={exportBackup}>
              <Icon name="download" size={17} /> Export
            </button>
            <button className="btn btn-soft btn-block" onClick={() => restoreInput.current?.click()}>
              <Icon name="upload" size={17} /> Restore
            </button>
          </div>
          <input
            ref={restoreInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              void importBackup(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <button className="btn btn-danger btn-block" style={{ marginTop: 12 }} onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={17} /> Start over
          </button>
        </Section>
      </Sheet>

      <ConfirmDialog
        open={confirmReset}
        title="Erase everything?"
        message="People, points, chores, meals and recipes all go. Export a backup first if you might want them back."
        confirmLabel="Erase it all"
        onConfirm={() => {
          void (async () => {
            await restore(initialState())
            toast('Starting fresh')
            onClose()
          })()
        }}
        onClose={() => setConfirmReset(false)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h3 className="h2">{title}</h3>
      {hint ? <p className="small" style={{ marginTop: 4, marginBottom: 14 }}>{hint}</p> : <div style={{ height: 12 }} />}
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row-between" style={{ padding: '12px 0' }}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function CalendarFeeds() {
  const { state, dispatch, calendar } = useApp()
  const feeds = state.core.settings.calendars
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState('#2F6BEA')

  const save = () => {
    if (!url.trim()) return
    const feed: CalendarFeed = {
      id: newId('cal'),
      name: name.trim() || 'Calendar',
      url: url.trim(),
      color,
      enabled: true,
    }
    dispatch({ t: 'settings.patch', patch: { calendars: [...feeds, feed] } })
    setName('')
    setUrl('')
    setAdding(false)
  }

  const update = (id: string, changes: Partial<CalendarFeed>) =>
    dispatch({
      t: 'settings.patch',
      patch: { calendars: feeds.map((feed) => (feed.id === id ? { ...feed, ...changes } : feed)) },
    })

  return (
    <>
      <AnimatePresence initial={false}>
        {feeds.map((feed) => {
          const error = calendar?.errors.find((entry) => entry.feedId === feed.id)
          return (
            <motion.div
              key={feed.id}
              className="feed-row"
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={SPRING}
            >
              <span className="feed-dot" style={{ background: feed.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={feed.name}
                  onChange={(event) => update(feed.id, { name: event.target.value })}
                  style={{ background: 'transparent', padding: '4px 0', fontWeight: 600 }}
                  aria-label="Calendar name"
                />
                <div className="tiny truncate">{error ? `⚠️ ${error.message}` : feed.url}</div>
              </div>
              <Switch on={feed.enabled} onChange={(enabled) => update(feed.id, { enabled })} label={`Show ${feed.name}`} />
              <button
                className="icon-btn"
                aria-label={`Remove ${feed.name}`}
                onClick={() =>
                  dispatch({ t: 'settings.patch', patch: { calendars: feeds.filter((entry) => entry.id !== feed.id) } })
                }
              >
                <Icon name="trash" size={17} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {adding ? (
        <motion.div className="card-flat" style={{ marginTop: 12 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Family, School, Work" autoFocus />
          </Field>
          <Field label="Secret iCal address" hint="Google Calendar → Settings → your calendar → 'Secret address in iCal format'.">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              inputMode="url"
            />
          </Field>
          <Field label="Colour">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn btn-soft btn-block btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-primary btn-block btn-sm" onClick={save} disabled={!url.trim()}>Add</button>
          </div>
        </motion.div>
      ) : (
        <button className="btn btn-soft btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Add a calendar
        </button>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function WeatherSettings() {
  const { state, dispatch } = useApp()
  const weather = state.core.settings.weather
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 400)
  const [results, setResults] = useState<{ label: string; latitude: number; longitude: number }[]>([])

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    void searchPlaces(debounced)
      .then((places) => {
        if (!cancelled) setResults(places)
      })
      .catch(() => setResults([]))
    return () => {
      cancelled = true
    }
  }, [debounced])

  return (
    <>
      <Field label="Location">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={weather.label || 'Search a town'} />
      </Field>

      <AnimatePresence>
        {results.length > 0 ? (
          <motion.div className="card-flat" style={{ marginTop: 10, padding: 6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {results.map((place) => (
              <button
                key={`${place.latitude},${place.longitude}`}
                className="manage-row"
                onClick={() => {
                  dispatch({
                    t: 'settings.patch',
                    patch: {
                      weather: { ...weather, latitude: place.latitude, longitude: place.longitude, label: place.label },
                    },
                  })
                  setQuery('')
                  setResults([])
                }}
              >
                <span className="manage-emoji">📍</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{place.label}</span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Field label="Units">
        <Segmented
          value={weather.units}
          onChange={(units) => dispatch({ t: 'settings.patch', patch: { weather: { ...weather, units } } })}
          options={[
            { value: 'F', label: 'Fahrenheit' },
            { value: 'C', label: 'Celsius' },
          ]}
        />
      </Field>
    </>
  )
}

/* ------------------------------------------------------------------ */

function SleepPhotos() {
  const { state, dispatch, toast } = useApp()
  const sleep = state.core.settings.sleep
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const uploaded: SleepPhoto[] = []
      for (const file of Array.from(files)) {
        const prepared = await prepareImage(file, SLEEP_MAX_DIMENSION)
        uploaded.push({ id: newId('sp'), photoId: await uploadPhoto(prepared.blob, prepared.type) })
      }
      dispatch({ t: 'settings.patch', patch: { sleep: { ...sleep, photos: [...sleep.photos, ...uploaded] } } })
      toast(`Added ${uploaded.length} photo${uploaded.length === 1 ? '' : 's'}`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label="Photos" hint="No photos? The sleep screen shows a colour wash instead.">
      <div className="photo-grid">
        <AnimatePresence initial={false}>
          {sleep.photos.map((photo) => (
            <motion.div
              key={photo.id}
              className="photo-tile"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={SPRING}
            >
              <img src={photo.photoId ? photoUrl(photo.photoId) : photo.url} alt="" />
              <button
                className="photo-remove"
                aria-label="Remove photo"
                onClick={() =>
                  dispatch({
                    t: 'settings.patch',
                    patch: { sleep: { ...sleep, photos: sleep.photos.filter((entry) => entry.id !== photo.id) } },
                  })
                }
              >
                <Icon name="close" size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <button className="photo-add" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Icon name={busy ? 'refresh' : 'camera'} size={22} />
          <span className="tiny">{busy ? 'Uploading' : 'Add'}</span>
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void addFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </Field>
  )
}

/* ------------------------------------------------------------------ */

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]
