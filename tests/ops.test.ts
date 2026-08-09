import { describe, expect, it } from 'vitest'
import type { Chore, FullState, Person, Redemption, Routine } from '@shared/types.ts'
import { applyOps, choreRefKey, type Op } from '@shared/ops.ts'
import { initialState } from '@shared/seed.ts'
import { isChoreDone, isStepDone, progressFor, routineProgress, streakFor } from '@shared/schedule.ts'

const TODAY = '2026-08-09' // a Sunday
const NOW = '2026-08-09T12:00:00.000Z'

function person(id: string, overrides: Partial<Person> = {}): Person {
  return { id, name: id, role: 'child', color: '#FF6B5A', emoji: '🦊', points: 0, sort: 0, ...overrides }
}

function chore(id: string, points: number): Chore {
  return {
    id,
    title: id,
    emoji: '🧹',
    assigneeIds: ['kid'],
    schedule: { type: 'daily' },
    points,
    createdAt: NOW,
  }
}

function routine(id: string, steps: string[], points: number): Routine {
  return {
    id,
    name: id,
    emoji: '🌅',
    timeOfDay: 'morning',
    assigneeIds: ['kid'],
    steps: steps.map((step) => ({ id: step, title: step, emoji: '✅' })),
    schedule: { type: 'daily' },
    points,
    createdAt: NOW,
  }
}

function base(): FullState {
  const state = initialState()
  state.core.people = [person('kid')]
  state.core.chores = [chore('c1', 5), chore('c2', 3)]
  state.core.routines = [routine('r1', ['s1', 's2'], 10)]
  return state
}

const tick = (choreId: string, done: boolean, entryId = `led-${choreId}-${done}`): Op => ({
  t: 'chore.setDone',
  choreId,
  personId: 'kid',
  date: TODAY,
  done,
  at: NOW,
  entryId,
})

const step = (stepId: string, done: boolean, entryId = `bonus-${stepId}`): Op => ({
  t: 'routine.setStepDone',
  routineId: 'r1',
  stepId,
  personId: 'kid',
  date: TODAY,
  done,
  at: NOW,
  entryId,
})

describe('chore completion', () => {
  it('awards points and records the completion', () => {
    const next = applyOps(base(), [tick('c1', true)])

    expect(next.core.people[0]?.points).toBe(5)
    expect(isChoreDone(next, 'c1', 'kid', TODAY)).toBe(true)
    expect(next.activity['2026-08']?.ledger).toHaveLength(1)
  })

  it('reverses the points when un-ticked', () => {
    const next = applyOps(base(), [tick('c1', true), tick('c1', false)])

    expect(next.core.people[0]?.points).toBe(0)
    expect(isChoreDone(next, 'c1', 'kid', TODAY)).toBe(false)
    expect(next.activity['2026-08']?.ledger ?? []).toHaveLength(0)
  })

  it('never pays twice for the same chore on the same day', () => {
    // This is what protects us when an offline queue replays after reconnecting.
    const ops = [tick('c1', true, 'a'), tick('c1', true, 'b'), tick('c1', true, 'c')]
    const next = applyOps(base(), ops)

    expect(next.core.people[0]?.points).toBe(5)
    expect(next.activity['2026-08']?.ledger).toHaveLength(1)
  })

  it('is safe to replay a whole batch after losing a write race', () => {
    const ops = [tick('c1', true, 'a'), tick('c2', true, 'b')]
    const once = applyOps(base(), ops)
    const twice = applyOps(once, ops)

    expect(once.core.people[0]?.points).toBe(8)
    expect(twice.core.people[0]?.points).toBe(8)
  })
})

describe('routine bonus', () => {
  it('pays only once every step is ticked', () => {
    const afterFirst = applyOps(base(), [step('s1', true)])
    expect(afterFirst.core.people[0]?.points).toBe(0)

    const afterSecond = applyOps(afterFirst, [step('s2', true)])
    expect(afterSecond.core.people[0]?.points).toBe(10)
    expect(routineProgress(afterSecond, afterSecond.core.routines[0]!, 'kid', TODAY).ratio).toBe(1)
  })

  it('takes the bonus back when a step is un-ticked', () => {
    let state = applyOps(base(), [step('s1', true), step('s2', true)])
    expect(state.core.people[0]?.points).toBe(10)

    state = applyOps(state, [step('s2', false)])
    expect(state.core.people[0]?.points).toBe(0)
    expect(isStepDone(state, 'r1', 's2', 'kid', TODAY)).toBe(false)
  })
})

describe('rewards', () => {
  const redemption: Redemption = {
    id: 'rdm1',
    rewardId: 'reward_treat',
    rewardTitle: 'Pick a treat',
    rewardEmoji: '🍦',
    personId: 'kid',
    cost: 40,
    status: 'pending',
    at: NOW,
  }

  function earned(points: number): FullState {
    return applyOps(base(), [
      { t: 'points.adjust', entry: { id: 'seed', personId: 'kid', delta: points, reason: 'seed', refType: 'manual', at: NOW } },
    ])
  }

  it('spends points on redemption', () => {
    const next = applyOps(earned(100), [{ t: 'reward.redeem', redemption, entryId: 'led-r' }])

    expect(next.core.people[0]?.points).toBe(60)
    expect(next.activity['2026-08']?.redemptions).toHaveLength(1)
  })

  it('refuses to overdraw', () => {
    const next = applyOps(earned(10), [{ t: 'reward.redeem', redemption, entryId: 'led-r' }])

    expect(next.core.people[0]?.points).toBe(10)
    expect(next.activity['2026-08']?.redemptions ?? []).toHaveLength(0)
  })

  it('refunds the points when a redemption is cancelled', () => {
    let state = applyOps(earned(100), [{ t: 'reward.redeem', redemption, entryId: 'led-r' }])
    state = applyOps(state, [{ t: 'redemption.setStatus', id: 'rdm1', status: 'cancelled', at: NOW }])

    expect(state.core.people[0]?.points).toBe(100)
  })

  it('does not refund twice when cancelled repeatedly', () => {
    let state = applyOps(earned(100), [{ t: 'reward.redeem', redemption, entryId: 'led-r' }])
    const cancel: Op = { t: 'redemption.setStatus', id: 'rdm1', status: 'cancelled', at: NOW }
    state = applyOps(state, [cancel, cancel])

    expect(state.core.people[0]?.points).toBe(100)
  })
})

describe('parent undo', () => {
  it('reverses the balance and un-ticks the chore', () => {
    const done = applyOps(base(), [tick('c1', true, 'entry-1')])
    expect(done.core.people[0]?.points).toBe(5)

    const undone = applyOps(done, [{ t: 'ledger.void', id: 'entry-1' }])

    expect(undone.core.people[0]?.points).toBe(0)
    expect(isChoreDone(undone, 'c1', 'kid', TODAY)).toBe(false)
    expect(undone.activity['2026-08']?.ledger[0]?.voided).toBe(true)
  })

  it('is idempotent', () => {
    const done = applyOps(base(), [tick('c1', true, 'entry-1')])
    const undone = applyOps(done, [{ t: 'ledger.void', id: 'entry-1' }, { t: 'ledger.void', id: 'entry-1' }])

    expect(undone.core.people[0]?.points).toBe(0)
  })
})

describe('progress and streaks', () => {
  it('counts chores and every routine step', () => {
    const progress = progressFor(base(), 'kid', TODAY)
    // 2 chores + 2 routine steps
    expect(progress.total).toBe(4)
    expect(progress.done).toBe(0)
  })

  it('does not break a streak because today is unfinished', () => {
    const yesterday = '2026-08-08'
    let state = base()
    state = applyOps(state, [
      { t: 'chore.setDone', choreId: 'c1', personId: 'kid', date: yesterday, done: true, at: NOW, entryId: 'y1' },
      { t: 'chore.setDone', choreId: 'c2', personId: 'kid', date: yesterday, done: true, at: NOW, entryId: 'y2' },
      { t: 'routine.setStepDone', routineId: 'r1', stepId: 's1', personId: 'kid', date: yesterday, done: true, at: NOW, entryId: 'y3' },
      { t: 'routine.setStepDone', routineId: 'r1', stepId: 's2', personId: 'kid', date: yesterday, done: true, at: NOW, entryId: 'y4' },
    ])

    // Nothing done today yet, but yesterday was complete.
    expect(streakFor(state, 'kid', TODAY)).toBe(1)
  })
})

describe('ref keys', () => {
  it('are unique per chore, person and day', () => {
    expect(choreRefKey('c1', 'kid', TODAY)).toBe('chore:c1:kid:2026-08-09')
    expect(choreRefKey('c1', 'kid', '2026-08-10')).not.toBe(choreRefKey('c1', 'kid', TODAY))
  })
})
