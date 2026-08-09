/**
 * The sleep screen. After a few idle minutes the app fades into a full-bleed
 * photo with the time over it — so the thing on the kitchen wall looks like a
 * picture frame rather than a tablet showing a web page.
 */

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { eventCoversDate, formatTime, minutesOfDayInTimezone } from '@shared/date.ts'
import { blocksForDate, formatClockTime, minutesOfDay } from '@shared/schedule.ts'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { photoUrl } from '../lib/api.ts'
import { WeatherIcon } from './WeatherIcon.tsx'

const GRADIENTS = [
  'linear-gradient(140deg, #FF6B5A 0%, #FF8A34 45%, #FFB020 100%)',
  'linear-gradient(140deg, #2F6BEA 0%, #7C4DFF 55%, #F0567A 100%)',
  'linear-gradient(140deg, #12855F 0%, #0FA8A0 50%, #2F6BEA 100%)',
  'linear-gradient(140deg, #7C4DFF 0%, #F0567A 50%, #FF8A34 100%)',
]

export function Screensaver({ onWake }: { onWake: () => void }) {
  const { state, today, weather, calendar } = useApp()
  const now = useNow('minute')
  const { sleep, timezone } = state.core.settings

  const photos = sleep.photos.filter((photo) => photo.photoId || photo.url)
  const slideCount = photos.length > 0 ? photos.length : GRADIENTS.length
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slideCount <= 1) return
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slideCount),
      Math.max(5, sleep.intervalSeconds) * 1000,
    )
    return () => window.clearInterval(timer)
  }, [slideCount, sleep.intervalSeconds])

  const nowMinutes = minutesOfDayInTimezone(now.toISOString(), timezone)

  /** The next thing coming up — a schedule block or a calendar event. */
  const upNext = useMemo(() => {
    const blocks = blocksForDate(state.core, today)
      .filter((block) => minutesOfDay(block.startTime) > nowMinutes)
      .map((block) => ({ label: block.title, when: formatClockTime(block.startTime), emoji: block.emoji }))

    const events = (calendar?.events ?? [])
      .filter((event) => !event.allDay && eventCoversDate(event, today, timezone) && new Date(event.start) > now)
      .map((event) => ({ label: event.title, when: formatTime(event.start, timezone), emoji: '📅' }))

    return [...blocks, ...events].sort((a, b) => a.when.localeCompare(b.when))[0] ?? null
  }, [state.core, today, nowMinutes, calendar, timezone, now])

  const photo = photos[index % photos.length]
  const background = photos.length > 0 && photo
    ? undefined
    : GRADIENTS[index % GRADIENTS.length]

  const timeParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || undefined,
  }).formatToParts(now)
  const clock = `${timeParts.find((p) => p.type === 'hour')?.value ?? ''}:${timeParts.find((p) => p.type === 'minute')?.value ?? ''}`
  const period = timeParts.find((p) => p.type === 'dayPeriod')?.value ?? ''

  return (
    <motion.div
      className="saver"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      onClick={onWake}
      onTouchStart={onWake}
      role="button"
      tabIndex={0}
      aria-label="Tap to wake"
      onKeyDown={onWake}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="saver-slide"
          style={
            photo
              ? { backgroundImage: `url(${photo.photoId ? photoUrl(photo.photoId) : photo.url})` }
              : { backgroundImage: background }
          }
          initial={{ opacity: 0, scale: 1.14 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.6, ease: 'easeInOut' },
            // Slow Ken Burns push over the whole time the photo is up.
            scale: { duration: Math.max(5, sleep.intervalSeconds) + 4, ease: 'linear' },
          }}
        />
      </AnimatePresence>

      <div className="saver-veil" />

      <div className="saver-content">
        {sleep.showClock ? (
          <motion.div
            className="saver-clock"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="numeral">{clock}</span>
            <span className="saver-period">{period}</span>
          </motion.div>
        ) : null}

        <motion.div
          className="saver-date"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: timezone || undefined,
          }).format(now)}
        </motion.div>

        <motion.div
          className="saver-row"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {sleep.showWeather && weather ? (
            <span className="saver-pill">
              <WeatherIcon code={weather.now.code} isDay={weather.now.isDay} size={30} />
              <span className="numeral">{weather.now.temp}°</span>
            </span>
          ) : null}

          {sleep.showNextEvent && upNext ? (
            <span className="saver-pill">
              <span>{upNext.emoji}</span>
              <span className="truncate">{upNext.label}</span>
              <span className="saver-when numeral">{upNext.when}</span>
            </span>
          ) : null}
        </motion.div>

        {photo?.caption ? <div className="saver-caption">{photo.caption}</div> : null}
      </div>

      <motion.div
        className="saver-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
      >
        Tap to wake
      </motion.div>
    </motion.div>
  )
}
