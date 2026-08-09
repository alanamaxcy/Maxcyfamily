/**
 * The single source of truth for how state changes.
 *
 * Every op is *semantic* ("tick this chore for this kid on this date") rather
 * than a state diff, and carries its own ids/timestamps from the caller. That
 * gives us two things we need:
 *
 *  1. The client can apply an op optimistically and the server can apply the
 *     very same op authoritatively, with identical results.
 *  2. If two devices write at once, the loser can simply replay its ops on top
 *     of the winner's state and converge — no diff rebasing required.
 */

import type {
  ActivityMonth,
  Completion,
  FullState,
  ID,
  ISODate,
  ISODateTime,
  LedgerEntry,
  LocalEvent,
  Meal,
  MealRule,
  MealSlot,
  MonthKey,
  Person,
  Recipe,
  Redemption,
  RedemptionStatus,
  Reward,
  Routine,
  ScheduleBlock,
  Settings,
  ShoppingItem,
  Chore,
  Todo,
  TodoList,
} from './types.ts'
import { monthKeyOf } from './date.ts'

export type Op =
  | { t: 'person.upsert'; person: Person }
  | { t: 'person.remove'; id: ID }
  | { t: 'block.upsert'; block: ScheduleBlock }
  | { t: 'block.remove'; id: ID }
  | { t: 'chore.upsert'; chore: Chore }
  | { t: 'chore.remove'; id: ID }
  | { t: 'routine.upsert'; routine: Routine }
  | { t: 'routine.remove'; id: ID }
  | { t: 'todoList.upsert'; list: TodoList }
  | { t: 'todoList.remove'; id: ID }
  | { t: 'todo.upsert'; todo: Todo }
  | { t: 'todo.setDone'; id: ID; done: boolean; at: ISODateTime }
  | { t: 'todo.remove'; id: ID }
  | { t: 'todo.clearDone'; listId: ID }
  | { t: 'meal.set'; date: ISODate; slot: MealSlot; meal: Meal | null }
  | { t: 'mealRule.upsert'; rule: MealRule }
  | { t: 'mealRule.remove'; id: ID }
  | { t: 'meal.note'; date: ISODate; note: string }
  | { t: 'meal.clearWeek'; dates: ISODate[] }
  | { t: 'shopping.upsert'; item: ShoppingItem }
  | { t: 'shopping.setDone'; id: ID; done: boolean }
  | { t: 'shopping.remove'; id: ID }
  | { t: 'shopping.clearDone' }
  | { t: 'reward.upsert'; reward: Reward }
  | { t: 'reward.remove'; id: ID }
  | { t: 'event.upsert'; event: LocalEvent }
  | { t: 'event.remove'; id: ID }
  | { t: 'recipe.upsert'; recipe: Recipe }
  | { t: 'recipe.remove'; id: ID }
  | { t: 'recipe.setFavorite'; id: ID; favorite: boolean }
  | { t: 'settings.patch'; patch: Partial<Settings> }
  | { t: 'chore.setDone'; choreId: ID; personId: ID; date: ISODate; done: boolean; at: ISODateTime; entryId: ID }
  | {
      t: 'routine.setStepDone'
      routineId: ID
      stepId: ID
      personId: ID
      date: ISODate
      done: boolean
      at: ISODateTime
      entryId: ID
    }
  | { t: 'reward.redeem'; redemption: Redemption; entryId: ID }
  | { t: 'redemption.setStatus'; id: ID; status: RedemptionStatus; at: ISODateTime }
  | { t: 'points.adjust'; entry: LedgerEntry }
  | { t: 'ledger.void'; id: ID }

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

export function choreKey(choreId: ID, personId: ID): string {
  return `chore:${choreId}:${personId}`
}

export function routineStepKey(routineId: ID, stepId: ID, personId: ID): string {
  return `rstep:${routineId}:${stepId}:${personId}`
}

export function choreRefKey(choreId: ID, personId: ID, date: ISODate): string {
  return `chore:${choreId}:${personId}:${date}`
}

export function routineRefKey(routineId: ID, personId: ID, date: ISODate): string {
  return `routine:${routineId}:${personId}:${date}`
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function emptyMonth(): ActivityMonth {
  return { completions: {}, ledger: [], redemptions: [] }
}

function ensureMonth(state: FullState, key: MonthKey): ActivityMonth {
  let month = state.activity[key]
  if (!month) {
    month = emptyMonth()
    state.activity[key] = month
  }
  return month
}

function ensureDay(month: ActivityMonth, date: ISODate): Record<string, Completion> {
  let day = month.completions[date]
  if (!day) {
    day = {}
    month.completions[date] = day
  }
  return day
}

function findPerson(state: FullState, id: ID): Person | undefined {
  return state.core.people.find((p) => p.id === id)
}

function upsertById<T extends { id: ID }>(list: T[], item: T): void {
  const index = list.findIndex((entry) => entry.id === item.id)
  if (index === -1) list.push(item)
  else list[index] = item
}

/** Find a live (non-voided) ledger entry by its stable refKey. */
function findLedgerByRef(month: ActivityMonth, refKey: string): LedgerEntry | undefined {
  return month.ledger.find((entry) => entry.refKey === refKey && !entry.voided)
}

function award(
  state: FullState,
  month: ActivityMonth,
  entry: Omit<LedgerEntry, 'voided'>,
): void {
  // Guard against replays: the same refKey never earns twice.
  if (entry.refKey && findLedgerByRef(month, entry.refKey)) return
  if (month.ledger.some((existing) => existing.id === entry.id)) return
  month.ledger.push({ ...entry })
  const person = findPerson(state, entry.personId)
  if (person) person.points += entry.delta
}

/** Reverse and delete a ledger entry — used when a tick is taken back. */
function retract(state: FullState, month: ActivityMonth, refKey: string): void {
  const index = month.ledger.findIndex((entry) => entry.refKey === refKey && !entry.voided)
  if (index === -1) return
  const [entry] = month.ledger.splice(index, 1)
  if (!entry) return
  const person = findPerson(state, entry.personId)
  if (person) person.points -= entry.delta
}

/**
 * The routine bonus lands only when every step is ticked, and is taken back the
 * moment a step is un-ticked.
 */
function reconcileRoutineBonus(
  state: FullState,
  routine: Routine,
  personId: ID,
  date: ISODate,
  at: ISODateTime,
  entryId: ID,
): void {
  const month = ensureMonth(state, monthKeyOf(date))
  const day = ensureDay(month, date)
  const refKey = routineRefKey(routine.id, personId, date)
  const allDone =
    routine.steps.length > 0 &&
    routine.steps.every((step) => day[routineStepKey(routine.id, step.id, personId)])

  if (allDone) {
    if (routine.points > 0) {
      award(state, month, {
        id: entryId,
        personId,
        delta: routine.points,
        reason: `${routine.name} routine`,
        refType: 'routine',
        refKey,
        at,
      })
    }
  } else {
    retract(state, month, refKey)
  }
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

/**
 * Applies ops to a *copy* of state and returns it. Cloning up front costs a
 * fraction of a millisecond at family-sized data and removes any chance of a
 * half-applied mutation leaking into React state or a blob write.
 */
export function applyOps(state: FullState, ops: Op[]): FullState {
  const next = structuredClone(state) as FullState
  for (const op of ops) applyOp(next, op)
  next.meta = { rev: state.meta.rev + 1, updatedAt: new Date().toISOString() }
  return next
}

function applyOp(state: FullState, op: Op): void {
  const core = state.core

  switch (op.t) {
    case 'person.upsert': {
      // `points` is derived from the ledger, so never trust an inbound value.
      const existing = findPerson(state, op.person.id)
      upsertById(core.people, { ...op.person, points: existing ? existing.points : op.person.points })
      break
    }
    case 'person.remove': {
      const person = findPerson(state, op.id)
      // Keep the record (archived) so old ledger rows still render a name.
      if (person) person.archived = true
      break
    }

    case 'block.upsert':
      upsertById(core.schedule, op.block)
      break
    case 'block.remove':
      core.schedule = core.schedule.filter((block) => block.id !== op.id)
      break

    case 'chore.upsert':
      upsertById(core.chores, op.chore)
      break
    case 'chore.remove':
      core.chores = core.chores.filter((chore) => chore.id !== op.id)
      break

    case 'routine.upsert':
      upsertById(core.routines, op.routine)
      break
    case 'routine.remove':
      core.routines = core.routines.filter((routine) => routine.id !== op.id)
      break

    case 'todoList.upsert':
      upsertById(core.todoLists, op.list)
      break
    case 'todoList.remove':
      core.todoLists = core.todoLists.filter((list) => list.id !== op.id)
      core.todos = core.todos.filter((todo) => todo.listId !== op.id)
      break

    case 'todo.upsert':
      upsertById(core.todos, op.todo)
      break
    case 'todo.setDone': {
      const todo = core.todos.find((entry) => entry.id === op.id)
      if (todo) {
        todo.done = op.done
        if (op.done) todo.completedAt = op.at
        else delete todo.completedAt
      }
      break
    }
    case 'todo.remove':
      core.todos = core.todos.filter((todo) => todo.id !== op.id)
      break
    case 'todo.clearDone':
      core.todos = core.todos.filter((todo) => !(todo.listId === op.listId && todo.done))
      break

    case 'meal.set': {
      const day = core.meals[op.date] ?? {}
      if (op.meal) {
        day[op.slot] = op.meal
        // Pinning a meal cancels any earlier "skip this day" for the slot.
        if (day.skipped) day.skipped = day.skipped.filter((slot) => slot !== op.slot)
      } else {
        delete day[op.slot]
        // Record the skip so a repeating meal doesn't reappear on this date.
        day.skipped = [...new Set([...(day.skipped ?? []), op.slot])]
      }
      if (day.skipped?.length === 0) delete day.skipped
      if (Object.keys(day).length === 0) delete core.meals[op.date]
      else core.meals[op.date] = day
      break
    }

    case 'mealRule.upsert':
      upsertById(core.mealRules, op.rule)
      break
    case 'mealRule.remove':
      core.mealRules = core.mealRules.filter((rule) => rule.id !== op.id)
      break
    case 'meal.note': {
      const day = core.meals[op.date] ?? {}
      if (op.note) day.note = op.note
      else delete day.note
      if (Object.keys(day).length === 0) delete core.meals[op.date]
      else core.meals[op.date] = day
      break
    }
    case 'meal.clearWeek':
      for (const date of op.dates) delete core.meals[date]
      break

    case 'shopping.upsert':
      upsertById(core.shopping, op.item)
      break
    case 'shopping.setDone': {
      const item = core.shopping.find((entry) => entry.id === op.id)
      if (item) item.done = op.done
      break
    }
    case 'shopping.remove':
      core.shopping = core.shopping.filter((item) => item.id !== op.id)
      break
    case 'shopping.clearDone':
      core.shopping = core.shopping.filter((item) => !item.done)
      break

    case 'reward.upsert':
      upsertById(core.rewards, op.reward)
      break
    case 'reward.remove':
      core.rewards = core.rewards.filter((reward) => reward.id !== op.id)
      break

    case 'event.upsert':
      upsertById(core.events, op.event)
      break
    case 'event.remove':
      core.events = core.events.filter((event) => event.id !== op.id)
      break

    case 'recipe.upsert':
      upsertById(core.recipes, op.recipe)
      break
    case 'recipe.remove':
      core.recipes = core.recipes.filter((recipe) => recipe.id !== op.id)
      break
    case 'recipe.setFavorite': {
      const recipe = core.recipes.find((entry) => entry.id === op.id)
      if (recipe) recipe.favorite = op.favorite
      break
    }

    case 'settings.patch':
      core.settings = { ...core.settings, ...op.patch }
      break

    case 'chore.setDone': {
      const chore = core.chores.find((entry) => entry.id === op.choreId)
      if (!chore) break
      const month = ensureMonth(state, monthKeyOf(op.date))
      const day = ensureDay(month, op.date)
      const key = choreKey(op.choreId, op.personId)
      const refKey = choreRefKey(op.choreId, op.personId, op.date)

      if (op.done) {
        day[key] = { byId: op.personId, at: op.at }
        if (chore.points > 0) {
          award(state, month, {
            id: op.entryId,
            personId: op.personId,
            delta: chore.points,
            reason: chore.title,
            refType: 'chore',
            refKey,
            at: op.at,
          })
        }
      } else {
        delete day[key]
        retract(state, month, refKey)
        if (Object.keys(day).length === 0) delete month.completions[op.date]
      }
      break
    }

    case 'routine.setStepDone': {
      const routine = core.routines.find((entry) => entry.id === op.routineId)
      if (!routine) break
      const month = ensureMonth(state, monthKeyOf(op.date))
      const day = ensureDay(month, op.date)
      const key = routineStepKey(op.routineId, op.stepId, op.personId)

      if (op.done) day[key] = { byId: op.personId, at: op.at }
      else delete day[key]

      reconcileRoutineBonus(state, routine, op.personId, op.date, op.at, op.entryId)

      const stillEmpty = month.completions[op.date]
      if (stillEmpty && Object.keys(stillEmpty).length === 0) delete month.completions[op.date]
      break
    }

    case 'reward.redeem': {
      const person = findPerson(state, op.redemption.personId)
      if (!person) break
      const month = ensureMonth(state, monthKeyOf(op.redemption.at.slice(0, 10)))
      if (month.redemptions.some((entry) => entry.id === op.redemption.id)) break
      // Refuse to overdraw: the UI blocks this, but two devices redeeming at
      // once could otherwise push a kid negative.
      if (person.points < op.redemption.cost) break

      month.redemptions.push({ ...op.redemption })
      award(state, month, {
        id: op.entryId,
        personId: op.redemption.personId,
        delta: -op.redemption.cost,
        reason: op.redemption.rewardTitle,
        refType: 'reward',
        refKey: `reward:${op.redemption.id}`,
        at: op.redemption.at,
      })
      break
    }

    case 'redemption.setStatus': {
      for (const month of Object.values(state.activity)) {
        const redemption = month.redemptions.find((entry) => entry.id === op.id)
        if (!redemption) continue
        const wasActive = redemption.status !== 'cancelled'
        redemption.status = op.status
        redemption.resolvedAt = op.at
        // Cancelling gives the points back; fulfilling just closes it out.
        if (op.status === 'cancelled' && wasActive) {
          retract(state, month, `reward:${op.id}`)
        }
        break
      }
      break
    }

    case 'points.adjust': {
      const month = ensureMonth(state, monthKeyOf(op.entry.at.slice(0, 10)))
      award(state, month, op.entry)
      break
    }

    case 'ledger.void': {
      for (const month of Object.values(state.activity)) {
        const entry = month.ledger.find((candidate) => candidate.id === op.id)
        if (!entry || entry.voided) continue
        entry.voided = true
        const person = findPerson(state, entry.personId)
        if (person) person.points -= entry.delta
        // Undoing an award also clears the tick that produced it, so the chore
        // shows as outstanding again rather than done-but-unpaid.
        if (entry.refKey?.startsWith('chore:')) {
          const [, choreId, personId, date] = entry.refKey.split(':')
          if (choreId && personId && date) {
            const day = month.completions[date]
            if (day) delete day[choreKey(choreId, personId)]
          }
        }
        break
      }
      break
    }
  }
}
