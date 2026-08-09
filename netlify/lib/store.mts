/**
 * Blob access + the commit protocol.
 *
 * Netlify Blobs has no compare-and-swap, so a naive read-modify-write can lose
 * an update when two devices tap at the same instant. We stamp every write with
 * a random writer token, then re-read the (body-free) metadata to see whether
 * our write is still the newest. If someone landed on top of us, our ops are
 * replayed against their state and written again. Ops are semantic, so replay
 * is always safe — see shared/ops.ts.
 */

import { getStore } from '@netlify/blobs'
import type { FullState, MonthKey } from '../../shared/types.ts'
import { applyOps, type Op } from '../../shared/ops.ts'
import { initialState, migrate } from '../../shared/seed.ts'
import { newId } from '../../shared/id.ts'

const STATE_KEY = 'state/v1'
const STORE_NAME = 'maxcy-family'
const PHOTO_STORE = 'maxcy-family-photos'

/** Months of chore/points history we keep. Older months are pruned on write. */
const RETENTION_MONTHS = 14
const MAX_COMMIT_ATTEMPTS = 5

export function stateStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

export function photoStore() {
  return getStore({ name: PHOTO_STORE, consistency: 'strong' })
}

export interface StateEnvelope {
  state: FullState
  rev: number
}

export async function readState(): Promise<StateEnvelope> {
  const store = stateStore()
  const found = await store.getWithMetadata(STATE_KEY, { type: 'json' })

  if (!found?.data) {
    const fresh = initialState()
    return { state: fresh, rev: fresh.meta.rev }
  }

  const state = migrate(found.data as FullState)
  return { state, rev: state.meta.rev }
}

/** Current revision without transferring the body — used by the poll endpoint. */
export async function readRev(): Promise<number | null> {
  const store = stateStore()
  const meta = await store.getMetadata(STATE_KEY)
  if (!meta) return null
  const rev = Number(meta.metadata?.['rev'])
  return Number.isFinite(rev) ? rev : null
}

function pruneActivity(state: FullState): void {
  const keys = Object.keys(state.activity) as MonthKey[]
  if (keys.length <= RETENTION_MONTHS) return

  // Month keys sort lexicographically, so the newest are simply the last ones.
  const keep = new Set(keys.sort().slice(-RETENTION_MONTHS))
  for (const key of keys) {
    if (!keep.has(key)) delete state.activity[key]
  }
}

async function write(state: FullState, writer: string): Promise<void> {
  await stateStore().setJSON(STATE_KEY, state, {
    metadata: { rev: state.meta.rev, writer, updatedAt: state.meta.updatedAt },
  })
}

export async function commit(ops: Op[]): Promise<StateEnvelope> {
  if (ops.length === 0) return readState()

  let lastState: FullState | null = null

  for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt++) {
    const writer = newId('w')
    const { state } = await readState()
    const next = applyOps(state, ops)
    pruneActivity(next)

    await write(next, writer)
    lastState = next

    const after = await stateStore().getMetadata(STATE_KEY)
    if (!after || after.metadata?.['writer'] === writer) {
      return { state: next, rev: next.meta.rev }
    }

    // Someone wrote after us. Back off a touch, then replay onto their state.
    await new Promise((resolve) => setTimeout(resolve, 40 + attempt * 60))
  }

  // Extremely unlikely; return what we last wrote rather than failing the tap.
  const fallback = lastState ?? (await readState()).state
  return { state: fallback, rev: fallback.meta.rev }
}

/** Wholesale replace — used by the settings "restore from backup" path. */
export async function replaceState(state: FullState): Promise<StateEnvelope> {
  const next = migrate(state)
  next.meta = { rev: (next.meta.rev ?? 0) + 1, updatedAt: new Date().toISOString() }
  pruneActivity(next)
  await write(next, newId('w'))
  return { state: next, rev: next.meta.rev }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  })
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, { status })
}

/* ------------------------------------------------------------------ */
/* Tiny cache helper shared by the calendar and weather endpoints       */
/* ------------------------------------------------------------------ */

interface CacheEnvelope<T> {
  fetchedAt: string
  value: T
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
  force = false,
): Promise<{ value: T; fetchedAt: string; stale: boolean }> {
  const store = stateStore()

  if (!force) {
    try {
      const hit = (await store.get(`cache/${key}`, { type: 'json' })) as CacheEnvelope<T> | null
      if (hit?.fetchedAt) {
        const age = (Date.now() - new Date(hit.fetchedAt).getTime()) / 1000
        if (age < ttlSeconds) return { value: hit.value, fetchedAt: hit.fetchedAt, stale: false }
      }
    } catch {
      // A corrupt cache entry should never block a live fetch.
    }
  }

  try {
    const value = await produce()
    const fetchedAt = new Date().toISOString()
    await store.setJSON(`cache/${key}`, { fetchedAt, value } satisfies CacheEnvelope<T>)
    return { value, fetchedAt, stale: false }
  } catch (error) {
    // Upstream is down — serve whatever we have rather than a blank screen.
    const hit = (await store.get(`cache/${key}`, { type: 'json' }).catch(() => null)) as CacheEnvelope<T> | null
    if (hit?.fetchedAt) return { value: hit.value, fetchedAt: hit.fetchedAt, stale: true }
    throw error
  }
}
