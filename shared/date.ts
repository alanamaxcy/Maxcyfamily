/**
 * Date helpers. Everything the app schedules against is a plain 'YYYY-MM-DD'
 * string in the household's timezone — that keeps "is this chore due today?"
 * free of UTC-offset bugs, which is the classic way family dashboards end up
 * showing tomorrow's chores at 7pm.
 */

import type { ISODate, MonthKey } from './types.ts'

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Today in the given IANA timezone, as 'YYYY-MM-DD'. */
export function todayISO(timezone?: string, now: Date = new Date()): ISODate {
  return isoInTimezone(now, timezone)
}

/** Format any instant as 'YYYY-MM-DD' in the given timezone. */
export function isoInTimezone(date: Date, timezone?: string): ISODate {
  if (!timezone) return localISO(date)
  try {
    // 'en-CA' formats as YYYY-MM-DD, which is exactly the shape we want.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return localISO(date)
  }
}

/** Current wall-clock hour (0-23) in the given timezone. */
export function hourInTimezone(date: Date, timezone?: string): number {
  if (!timezone) return date.getHours()
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(date)
    const hour = parseInt(parts, 10)
    return Number.isNaN(hour) ? date.getHours() : hour % 24
  } catch {
    return date.getHours()
  }
}

function localISO(date: Date): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse 'YYYY-MM-DD' into a Date at local midnight (never UTC — see file note). */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return localISO(date)
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const date = parseISODate(iso)
  const targetDay = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  // Clamp: 31 Jan + 1 month should land on 28/29 Feb, not drift into March.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(targetDay, lastDay))
  return localISO(date)
}

/** Whole days from `a` to `b` (b - a). Negative if b is earlier. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const MS_PER_DAY = 86_400_000
  // Compare at UTC noon so a DST transition in between can't shift the result.
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const start = Date.UTC(ay ?? 0, (am ?? 1) - 1, ad ?? 1, 12)
  const end = Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1, 12)
  return Math.round((end - start) / MS_PER_DAY)
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: ISODate): number {
  return parseISODate(iso).getDay()
}

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7)
}

export function startOfWeek(iso: ISODate, weekStartsOn = 0): ISODate {
  const dow = dayOfWeek(iso)
  const diff = (dow - weekStartsOn + 7) % 7
  return addDays(iso, -diff)
}

export function weekDates(iso: ISODate, weekStartsOn = 0): ISODate[] {
  const start = startOfWeek(iso, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** All dates shown in a month grid, padded to whole weeks. */
export function monthGridDates(iso: ISODate, weekStartsOn = 0): ISODate[] {
  const first = `${iso.slice(0, 7)}-01`
  const start = startOfWeek(first, weekStartsOn)
  const dates: ISODate[] = []
  for (let i = 0; i < 42; i++) dates.push(addDays(start, i))
  // Trim a trailing all-next-month week so short months don't show 6 rows.
  const month = iso.slice(0, 7)
  while (dates.length > 28 && monthKeyOf(dates[dates.length - 7] as string) !== month) {
    dates.length -= 7
  }
  return dates
}

export function formatDayLabel(iso: ISODate, today: ISODate): string {
  if (iso === today) return 'Today'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const date = parseISODate(iso)
  return `${DAY_SHORT[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]?.slice(0, 3)} ${date.getDate()}`
}

export function formatLongDate(iso: ISODate): string {
  const date = parseISODate(iso)
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
}

/** '7:05 PM' / '19:05' depending on the locale's preference. */
export function formatTime(value: string | Date, timezone?: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  }
}

/** Minutes since midnight for an instant, read in the household's timezone. */
export function minutesOfDayInTimezone(iso: string, timezone?: string): number {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
    const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
    return (hours % 24) * 60 + minutes
  } catch {
    return date.getHours() * 60 + date.getMinutes()
  }
}

/**
 * Does an event touch a given day? All-day values are plain date strings whose
 * end is exclusive, per RFC 5545 — a one-day event ends on the *next* day.
 */
export function eventCoversDate(
  event: { start: string; end: string; allDay: boolean },
  date: ISODate,
  timezone?: string,
): boolean {
  if (event.allDay) {
    const start = event.start.slice(0, 10)
    let end = event.end.slice(0, 10)
    if (end <= start) end = addDays(start, 1)
    return date >= start && date < end
  }

  const startDay = isoInTimezone(new Date(event.start), timezone)
  const endDay = isoInTimezone(new Date(event.end || event.start), timezone)
  return date >= startDay && date <= endDay
}

/** The months we need loaded to cover a date range, inclusive. */
export function monthKeysBetween(fromISO: ISODate, toISO: ISODate): MonthKey[] {
  const keys: MonthKey[] = []
  let cursor = `${fromISO.slice(0, 7)}-01`
  const last = toISO.slice(0, 7)
  for (let i = 0; i < 36; i++) {
    keys.push(monthKeyOf(cursor))
    if (monthKeyOf(cursor) === last) break
    cursor = addMonths(cursor, 1)
  }
  return keys
}
