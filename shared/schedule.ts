/**
 * Turns schedules into "what is actually due today", plus the streak maths that
 * makes the habit side of the app work.
 */

import type {
  ActivityMonth,
  Chore,
  Core,
  FullState,
  ID,
  ISODate,
  MonthKey,
  Routine,
  Schedule,
  ScheduleBlock,
} from './types.ts'
import { addDays, dayOfWeek, daysBetween, monthKeyOf } from './date.ts'
import { choreKey, routineStepKey } from './ops.ts'

export function isDueOn(schedule: Schedule, date: ISODate): boolean {
  switch (schedule.type) {
    case 'daily':
      return true
    case 'weekly':
      return schedule.days.includes(dayOfWeek(date))
    case 'once':
      return schedule.date === date
    case 'everyN': {
      const delta = daysBetween(schedule.startDate, date)
      if (delta < 0) return false
      const n = Math.max(1, Math.floor(schedule.n))
      return delta % n === 0
    }
  }
}

/** 'HH:MM' → minutes since midnight, for sorting and "what's on now". */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

export function formatClockTime(time: string): string {
  const [rawHours, rawMinutes] = time.split(':').map(Number)
  const hours = rawHours ?? 0
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${String(rawMinutes ?? 0).padStart(2, '0')} ${suffix}`
}

/** The day's blocks in time order, optionally narrowed to one person. */
export function blocksForDate(core: Core, date: ISODate, personId?: ID): ScheduleBlock[] {
  return core.schedule
    .filter((block) => {
      if (block.archived) return false
      if (!isDueOn(block.schedule, date)) return false
      // An empty personIds means "everyone", so it always shows.
      if (personId && block.personIds.length > 0 && !block.personIds.includes(personId)) return false
      return true
    })
    .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime) || a.sort - b.sort)
}

export function isAssignedTo(assigneeIds: ID[], personId: ID): boolean {
  return assigneeIds.includes(personId)
}

/** Chores with no assignee are "family" chores anyone can claim. */
export function isFamilyItem(assigneeIds: ID[]): boolean {
  return assigneeIds.length === 0
}

export function choresForPerson(core: Core, personId: ID, date: ISODate): Chore[] {
  return core.chores.filter(
    (chore) => !chore.archived && isAssignedTo(chore.assigneeIds, personId) && isDueOn(chore.schedule, date),
  )
}

export function familyChores(core: Core, date: ISODate): Chore[] {
  return core.chores.filter(
    (chore) => !chore.archived && isFamilyItem(chore.assigneeIds) && isDueOn(chore.schedule, date),
  )
}

export function routinesForPerson(core: Core, personId: ID, date: ISODate): Routine[] {
  return core.routines.filter(
    (routine) =>
      !routine.archived && isAssignedTo(routine.assigneeIds, personId) && isDueOn(routine.schedule, date),
  )
}

export interface Progress {
  done: number
  total: number
  /** 0…1, and 1 when nothing is due (an empty list is a finished list). */
  ratio: number
}

function monthOf(state: Pick<FullState, 'activity'>, date: ISODate): ActivityMonth | undefined {
  return state.activity[monthKeyOf(date) as MonthKey]
}

export function completionsOn(
  state: Pick<FullState, 'activity'>,
  date: ISODate,
): Record<string, { byId: ID; at: string }> {
  return monthOf(state, date)?.completions[date] ?? {}
}

export function isChoreDone(state: Pick<FullState, 'activity'>, choreId: ID, personId: ID, date: ISODate): boolean {
  return Boolean(completionsOn(state, date)[choreKey(choreId, personId)])
}

export function isStepDone(
  state: Pick<FullState, 'activity'>,
  routineId: ID,
  stepId: ID,
  personId: ID,
  date: ISODate,
): boolean {
  return Boolean(completionsOn(state, date)[routineStepKey(routineId, stepId, personId)])
}

/** Everything a person owes on a date: chores plus every step of their routines. */
export function progressFor(state: FullState, personId: ID, date: ISODate): Progress {
  const day = completionsOn(state, date)
  let done = 0
  let total = 0

  for (const chore of choresForPerson(state.core, personId, date)) {
    total++
    if (day[choreKey(chore.id, personId)]) done++
  }
  for (const routine of routinesForPerson(state.core, personId, date)) {
    for (const step of routine.steps) {
      total++
      if (day[routineStepKey(routine.id, step.id, personId)]) done++
    }
  }

  return { done, total, ratio: total === 0 ? 1 : done / total }
}

export function routineProgress(
  state: FullState,
  routine: Routine,
  personId: ID,
  date: ISODate,
): Progress {
  const day = completionsOn(state, date)
  const done = routine.steps.filter((step) => day[routineStepKey(routine.id, step.id, personId)]).length
  const total = routine.steps.length
  return { done, total, ratio: total === 0 ? 1 : done / total }
}

/**
 * Consecutive days where the person finished everything that was due.
 *
 * Days with nothing due are skipped rather than counted or treated as a miss —
 * a kid shouldn't lose a streak because Saturday had no chores. Today only
 * extends the streak when it's already complete; an unfinished today doesn't
 * break it, because the day isn't over yet.
 */
export function streakFor(state: FullState, personId: ID, today: ISODate, maxLookback = 120): number {
  let streak = 0
  let cursor = today

  for (let i = 0; i < maxLookback; i++) {
    const progress = progressFor(state, personId, cursor)

    if (progress.total === 0) {
      // Nothing was due — neutral day, keep walking back.
      cursor = addDays(cursor, -1)
      continue
    }
    if (progress.done >= progress.total) {
      streak++
    } else if (cursor === today) {
      // Today is still in progress; look at yesterday instead of stopping.
    } else {
      break
    }

    cursor = addDays(cursor, -1)
    // Once we walk past loaded activity months there's no data left to read.
    if (!state.activity[monthKeyOf(cursor)]) break
  }

  return streak
}

/** Per-day completion ratios for the habit heat strip, oldest first. */
export function historyStrip(
  state: FullState,
  personId: ID,
  endDate: ISODate,
  days: number,
): { date: ISODate; ratio: number; total: number }[] {
  const out: { date: ISODate; ratio: number; total: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(endDate, -i)
    const progress = progressFor(state, personId, date)
    out.push({ date, ratio: progress.ratio, total: progress.total })
  }
  return out
}

/** Points earned by a person on a given date, ignoring undone entries. */
export function pointsEarnedOn(state: FullState, personId: ID, date: ISODate): number {
  const month = monthOf(state, date)
  if (!month) return 0
  return month.ledger
    .filter((entry) => entry.personId === personId && !entry.voided && entry.at.slice(0, 10) === date && entry.delta > 0)
    .reduce((sum, entry) => sum + entry.delta, 0)
}

/** Most recent ledger activity across all loaded months, newest first. */
export function recentLedger(state: FullState, limit = 40) {
  return Object.values(state.activity)
    .flatMap((month) => month.ledger)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}

export function allRedemptions(state: FullState) {
  return Object.values(state.activity)
    .flatMap((month) => month.redemptions)
    .sort((a, b) => b.at.localeCompare(a.at))
}
