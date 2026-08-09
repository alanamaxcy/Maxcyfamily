/**
 * Talks to the Netlify functions, and keeps working when they're unreachable.
 *
 * The iPad lives on a kitchen wall, so a wifi blip must never look like data
 * loss: state is mirrored into localStorage, unsent ops queue up, and the queue
 * flushes automatically once the network returns.
 */

import type { CalendarResponse, FullState, WeatherResponse } from '@shared/types.ts'
import type { Op } from '@shared/ops.ts'
import type { Recipe } from '@shared/recipes.ts'

const STATE_CACHE_KEY = 'family.state.v1'
const QUEUE_KEY = 'family.queue.v1'

export interface LoadResult {
  unchanged: boolean
  state?: FullState
  rev: number
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    const message = (detail as { error?: string } | null)?.error
    throw new Error(message ?? `Request failed (${response.status})`)
  }

  return (await response.json()) as T
}

export async function loadState(sinceRev?: number): Promise<LoadResult> {
  const query = sinceRev === undefined ? '' : `?rev=${sinceRev}`
  const data = await request<{ unchanged?: boolean; state?: FullState; rev: number }>(`/api/state${query}`)
  return { unchanged: Boolean(data.unchanged), ...(data.state ? { state: data.state } : {}), rev: data.rev }
}

export async function pushOps(ops: Op[]): Promise<{ state: FullState; rev: number }> {
  return request<{ state: FullState; rev: number }>('/api/state', {
    method: 'POST',
    body: JSON.stringify({ ops }),
  })
}

export async function replaceState(state: FullState): Promise<{ state: FullState; rev: number }> {
  return request<{ state: FullState; rev: number }>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ state }),
  })
}

export async function loadCalendar(options: { refresh?: boolean } = {}): Promise<CalendarResponse> {
  return request<CalendarResponse>(`/api/calendar${options.refresh ? '?refresh=1' : ''}`)
}

export async function loadWeather(options: { refresh?: boolean } = {}): Promise<WeatherResponse> {
  return request<WeatherResponse>(`/api/weather${options.refresh ? '?refresh=1' : ''}`)
}

export async function searchPlaces(query: string): Promise<{ label: string; latitude: number; longitude: number }[]> {
  const data = await request<{ results: { label: string; latitude: number; longitude: number }[] }>(
    `/api/geocode?q=${encodeURIComponent(query)}`,
  )
  return data.results
}

export async function importRecipe(url: string): Promise<{ recipe: Omit<Recipe, 'id'>; foundRecipe: boolean }> {
  return request(`/api/recipe-import?url=${encodeURIComponent(url)}`)
}

export async function uploadPhoto(body: Blob, contentType?: string): Promise<string> {
  const response = await fetch('/api/photos', {
    method: 'POST',
    headers: { 'content-type': contentType || body.type || 'application/octet-stream' },
    body,
  })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(detail?.error ?? `Upload failed (${response.status})`)
  }
  const data = (await response.json()) as { id: string }
  return data.id
}

export function photoUrl(id: string): string {
  return `/api/photos/${id}`
}

/* ------------------------------------------------------------------ */
/* Local mirror                                                        */
/* ------------------------------------------------------------------ */

export function readCachedState(): FullState | null {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as FullState) : null
  } catch {
    return null
  }
}

export function writeCachedState(state: FullState): void {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded — the app still works, it just won't cold-start offline.
  }
}

export function readQueue(): Op[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Op[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeQueue(ops: Op[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
  } catch {
    // Nothing useful to do; the ops stay in memory for this session.
  }
}
