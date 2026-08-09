import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  eventCoversDate,
  monthGridDates,
  monthKeysBetween,
  startOfWeek,
} from '@shared/date.ts'
import { blocksForDate, isDueOn, minutesOfDay, formatClockTime } from '@shared/schedule.ts'
import { initialState } from '@shared/seed.ts'

describe('isDueOn', () => {
  it('handles weekly schedules', () => {
    const schedule = { type: 'weekly' as const, days: [1, 3, 5] }
    expect(isDueOn(schedule, '2026-08-10')).toBe(true) // Monday
    expect(isDueOn(schedule, '2026-08-11')).toBe(false) // Tuesday
  })

  it('handles every-N-days from a start date', () => {
    const schedule = { type: 'everyN' as const, n: 3, startDate: '2026-08-01' }
    expect(isDueOn(schedule, '2026-08-01')).toBe(true)
    expect(isDueOn(schedule, '2026-08-04')).toBe(true)
    expect(isDueOn(schedule, '2026-08-05')).toBe(false)
  })

  it('never fires before the start date', () => {
    const schedule = { type: 'everyN' as const, n: 2, startDate: '2026-08-10' }
    expect(isDueOn(schedule, '2026-08-08')).toBe(false)
  })
})

describe('date maths', () => {
  it('clamps month arithmetic instead of overflowing', () => {
    // 31 Jan + 1 month must not become 3 March.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  })

  it('counts days across a DST boundary', () => {
    // US DST starts 8 March 2026; a naive ms/86400000 would return 0.95 here.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1)
  })

  it('rolls dates across month ends', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('builds whole-week month grids', () => {
    const dates = monthGridDates('2026-08-09', 0)
    expect(dates.length % 7).toBe(0)
    expect(startOfWeek(dates[0]!, 0)).toBe(dates[0])
    // The grid must cover every day of the target month.
    expect(dates).toContain('2026-08-01')
    expect(dates).toContain('2026-08-31')
  })

  it('lists the months spanning a range', () => {
    expect(monthKeysBetween('2026-07-15', '2026-09-02')).toEqual(['2026-07', '2026-08', '2026-09'])
  })
})

describe('eventCoversDate', () => {
  it('treats an all-day end as exclusive', () => {
    // RFC 5545: a single all-day event on the 9th ends on the 10th.
    const event = { start: '2026-08-09', end: '2026-08-10', allDay: true }
    expect(eventCoversDate(event, '2026-08-09')).toBe(true)
    expect(eventCoversDate(event, '2026-08-10')).toBe(false)
  })

  it('tolerates an all-day event whose end equals its start', () => {
    const event = { start: '2026-08-09', end: '2026-08-09', allDay: true }
    expect(eventCoversDate(event, '2026-08-09')).toBe(true)
  })

  it('covers every day a multi-day all-day event spans', () => {
    const event = { start: '2026-08-09', end: '2026-08-12', allDay: true }
    expect(eventCoversDate(event, '2026-08-11')).toBe(true)
    expect(eventCoversDate(event, '2026-08-12')).toBe(false)
  })
})

describe('schedule blocks', () => {
  it('sorts the day by start time', () => {
    const state = initialState()
    const monday = blocksForDate(state.core, '2026-08-10')
    const times = monday.map((block) => minutesOfDay(block.startTime))

    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(monday.length).toBeGreaterThan(0)
  })

  it('drops weekday-only blocks at the weekend', () => {
    const state = initialState()
    const saturday = blocksForDate(state.core, '2026-08-08')
    expect(saturday.some((block) => block.title === 'Math')).toBe(false)
    expect(saturday.some((block) => block.title === 'Dinner')).toBe(true)
  })

  it('shows family-wide blocks to a specific person', () => {
    const state = initialState()
    const forKid = blocksForDate(state.core, '2026-08-10', 'kid')
    // Every seeded block is family-wide, so narrowing must not empty the list.
    expect(forKid.length).toBe(blocksForDate(state.core, '2026-08-10').length)
  })
})

describe('formatClockTime', () => {
  it('renders 12-hour time', () => {
    expect(formatClockTime('09:00')).toBe('9:00 AM')
    expect(formatClockTime('13:15')).toBe('1:15 PM')
    expect(formatClockTime('00:30')).toBe('12:30 AM')
    expect(formatClockTime('12:00')).toBe('12:00 PM')
  })
})
