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

  /*
   * The day as a flat, time-ordered list of the household's blocks and the
   * connected calendars, so "now" and "next" can be read straight off it. Sorted
   * by minute-of-day rather than by the formatted label — "10:00 AM" sorts
   * before "9:00 AM" as a string.
   */
  const agenda = useMemo(() => {
    const blocks = blocksForDate(state.core, today).map((block) => ({
      label: block.title,
      when: formatClockTime(block.startTime),
      emoji: block.emoji,
      start: minutesOfDay(block.startTime),
      end: minutesOfDay(block.endTime),
      isBlock: true,
    }))

    const events = (calendar?.events ?? [])
      .filter((event) => !event.allDay && eventCoversDate(event, today, timezone))
      .map((event) => ({
        label: event.title,
        when: formatTime(event.start, timezone),
        emoji: '📅',
        start: minutesOfDayInTimezone(event.start, timezone),
        end: minutesOfDayInTimezone(event.end, timezone),
        isBlock: false,
      }))

    return [...blocks, ...events].sort((a, b) => a.start - b.start || a.end - b.end)
  }, [state.core, today, calendar, timezone])

  /*
   * Whatever is happening right now, and whatever starts next. When an
   * appointment overlaps a block — a dentist run during Reading — the block is
   * what the house is actually doing, so it wins the "Now" slot.
   */
  const current = agenda.filter((item) => nowMinutes >= item.start && nowMinutes < item.end)
  const happening = current.find((item) => item.isBlock) ?? current[0] ?? null
  const upNext = agenda.find((item) => item.start > nowMinutes) ?? null

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

        {sleep.showWeather && weather ? (
          <motion.div
            className="saver-row"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="saver-pill">
              <WeatherIcon code={weather.now.code} isDay={weather.now.isDay} size={30} />
              <span className="numeral">{weather.now.temp}°</span>
            </span>
          </motion.div>
        ) : null}

        {photo?.caption ? <div className="saver-caption">{photo.caption}</div> : null}

        {/* What the house is doing, and what it is doing next — the two things
            worth knowing from across the room without waking the display. */}
        {sleep.showNextEvent && (happening || upNext) ? (
          <motion.div
            className="saver-agenda"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="saver-slot">
              <span className="saver-slot-label">Now</span>
              {happening ? (
                <span className="saver-slot-body">
                  <span className="saver-slot-emoji">{happening.emoji}</span>
                  <span className="saver-slot-title truncate">{happening.label}</span>
                </span>
              ) : (
                <span className="saver-slot-body saver-slot-empty">Nothing scheduled</span>
              )}
            </div>

            <div className="saver-slot">
              <span className="saver-slot-label">
                Next{upNext ? <span className="saver-slot-when numeral">{upNext.when}</span> : null}
              </span>
              {upNext ? (
                <span className="saver-slot-body">
                  <span className="saver-slot-emoji">{upNext.emoji}</span>
                  <span className="saver-slot-title truncate">{upNext.label}</span>
                </span>
              ) : (
                <span className="saver-slot-body saver-slot-empty">That's the day</span>
              )}
            </div>
          </motion.div>
        ) : null}
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
