import type { Config, Context } from '@netlify/functions'
import ICAL from 'ical.js'
import type { CalendarEvent, CalendarFeed, CalendarResponse } from '../../shared/types.ts'
import { cached, errorResponse, json, readState } from '../lib/store.mts'

/**
 * Reads the household's subscribed iCal feeds and returns a flat, expanded list
 * of events for a date window. Fetching server-side dodges CORS (calendar
 * providers send no ACAO header) and keeps the secret feed URLs off the iPad.
 */

const CACHE_TTL_SECONDS = 600
const MAX_OCCURRENCES_PER_EVENT = 400
const FETCH_TIMEOUT_MS = 12_000

function hash(value: string): string {
  // djb2 — we only need a short, stable cache key, not cryptographic strength.
  let h = 5381
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

async function fetchFeed(url: string): Promise<string> {
  // webcal:// is just https with a different scheme badge.
  const normalized = url.replace(/^webcal:\/\//i, 'https://')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8', 'user-agent': 'MaxcyFamilyDisplay/1.0' },
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = await response.text()
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Not an iCal feed')
    return text
  } finally {
    clearTimeout(timer)
  }
}

function registerTimezones(component: ICAL.Component): void {
  for (const vtimezone of component.getAllSubcomponents('vtimezone')) {
    try {
      const timezone = new ICAL.Timezone(vtimezone)
      if (timezone.tzid && !ICAL.TimezoneService.has(timezone.tzid)) {
        ICAL.TimezoneService.register(timezone, timezone.tzid)
      }
    } catch {
      // A malformed VTIMEZONE shouldn't sink the whole feed.
    }
  }
}

/** All-day values are date-only; timed values become absolute instants. */
function serialize(time: ICAL.Time): string {
  return time.isDate ? time.toString() : time.toJSDate().toISOString()
}

function parseFeed(ics: string, feed: CalendarFeed, windowStart: Date, windowEnd: Date): CalendarEvent[] {
  const component = new ICAL.Component(ICAL.parse(ics))
  registerTimezones(component)

  const vevents = component.getAllSubcomponents('vevent')
  const events: CalendarEvent[] = []

  // Modified instances of a recurring series carry RECURRENCE-ID and must be
  // attached to their parent, otherwise a moved soccer practice shows twice.
  const masters: ICAL.Event[] = []
  const exceptions: ICAL.Event[] = []

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent)
      if (event.isRecurrenceException()) exceptions.push(event)
      else masters.push(event)
    } catch {
      // Skip anything ical.js refuses to model.
    }
  }

  for (const exception of exceptions) {
    const parent = masters.find((master) => master.uid === exception.uid)
    if (parent) {
      try {
        parent.relateException(exception)
      } catch {
        // Unrelatable exception — it still renders below as its own entry.
      }
    }
  }

  const rangeStart = ICAL.Time.fromJSDate(windowStart, true)
  const rangeEnd = ICAL.Time.fromJSDate(windowEnd, true)

  const push = (
    uid: string,
    title: string,
    start: ICAL.Time,
    end: ICAL.Time,
    location: string,
    description: string,
    suffix = '',
  ): void => {
    events.push({
      id: `${feed.id}:${hash(uid)}${suffix}`,
      title: title || '(no title)',
      start: serialize(start),
      end: serialize(end),
      allDay: start.isDate,
      ...(location ? { location } : {}),
      ...(description ? { notes: description.slice(0, 500) } : {}),
      color: feed.color,
      source: feed.id,
      sourceName: feed.name,
      personIds: feed.personId ? [feed.personId] : [],
    })
  }

  for (const event of masters) {
    const title = event.summary ?? ''
    const location = event.location ?? ''
    const description = event.description ?? ''

    if (!event.isRecurring()) {
      const start = event.startDate
      const end = event.endDate ?? event.startDate
      if (!start) continue
      // Keep anything overlapping the window, not just events starting inside it.
      if (end.compare(rangeStart) < 0 || start.compare(rangeEnd) > 0) continue
      push(event.uid ?? title, title, start, end, location, description)
      continue
    }

    try {
      const iterator = event.iterator()
      let occurrence: ICAL.Time | null
      let count = 0

      while ((occurrence = iterator.next())) {
        if (++count > MAX_OCCURRENCES_PER_EVENT) break
        if (occurrence.compare(rangeEnd) > 0) break

        const details = event.getOccurrenceDetails(occurrence)
        if (details.endDate.compare(rangeStart) < 0) continue

        push(
          event.uid ?? title,
          details.item.summary ?? title,
          details.startDate,
          details.endDate,
          details.item.location ?? location,
          details.item.description ?? description,
          `:${occurrence.toString()}`,
        )
      }
    } catch {
      // A broken RRULE shouldn't take out the other events in the feed.
    }
  }

  // Exceptions whose parent never made it into this window still deserve a slot.
  for (const exception of exceptions) {
    const alreadyShown = events.some((event) => event.id.startsWith(`${feed.id}:${hash(exception.uid ?? '')}`))
    if (alreadyShown) continue
    const start = exception.startDate
    const end = exception.endDate ?? start
    if (!start) continue
    if (end.compare(rangeStart) < 0 || start.compare(rangeEnd) > 0) continue
    push(
      exception.uid ?? '',
      exception.summary ?? '',
      start,
      end,
      exception.location ?? '',
      exception.description ?? '',
      ':ex',
    )
  }

  return events
}

export default async (request: Request, _context: Context): Promise<Response> => {
  try {
    const url = new URL(request.url)
    const daysBack = Math.min(90, Math.max(0, Number(url.searchParams.get('back') ?? 14)))
    const daysAhead = Math.min(400, Math.max(1, Number(url.searchParams.get('ahead') ?? 120)))
    const force = url.searchParams.get('refresh') === '1'

    const { state } = await readState()
    const feeds = state.core.settings.calendars.filter((feed) => feed.enabled && feed.url.trim())

    if (feeds.length === 0) {
      return json({ events: [], fetchedAt: new Date().toISOString(), errors: [] } satisfies CalendarResponse)
    }

    const now = Date.now()
    const windowStart = new Date(now - daysBack * 86_400_000)
    const windowEnd = new Date(now + daysAhead * 86_400_000)

    // Bucket the cache key by day so the window shifting by a second doesn't miss.
    const key = `calendar/${hash(feeds.map((feed) => `${feed.id}:${feed.url}`).join('|'))}-${daysBack}-${daysAhead}-${Math.floor(now / 86_400_000)}`

    const result = await cached<CalendarResponse>(
      key,
      CACHE_TTL_SECONDS,
      async () => {
        const events: CalendarEvent[] = []
        const errors: CalendarResponse['errors'] = []

        const settled = await Promise.allSettled(
          feeds.map(async (feed) => ({ feed, ics: await fetchFeed(feed.url) })),
        )

        for (let i = 0; i < settled.length; i++) {
          const outcome = settled[i]
          const feed = feeds[i]
          if (!feed || !outcome) continue

          if (outcome.status === 'rejected') {
            const reason = outcome.reason
            errors.push({
              feedId: feed.id,
              name: feed.name,
              message: reason instanceof Error ? reason.message : String(reason),
            })
            continue
          }

          try {
            events.push(...parseFeed(outcome.value.ics, feed, windowStart, windowEnd))
          } catch (error) {
            errors.push({
              feedId: feed.id,
              name: feed.name,
              message: error instanceof Error ? error.message : 'Could not read this feed',
            })
          }
        }

        events.sort((a, b) => a.start.localeCompare(b.start))
        return { events, fetchedAt: new Date().toISOString(), errors }
      },
      force,
    )

    return json({ ...result.value, fetchedAt: result.fetchedAt } satisfies CalendarResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return errorResponse(`Calendar error: ${message}`, 500)
  }
}

export const config: Config = { path: '/api/calendar' }
