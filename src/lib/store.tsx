/**
 * App state, sync loop, and the celebration hooks the views fire on.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CalendarResponse, FullState, ID, WeatherResponse } from '@shared/types.ts'
import { applyOps, type Op } from '@shared/ops.ts'
import { initialState, migrate } from '@shared/seed.ts'
import { todayISO } from '@shared/date.ts'
import * as api from './api.ts'

const POLL_INTERVAL_MS = 12_000
const CALENDAR_INTERVAL_MS = 10 * 60_000
const WEATHER_INTERVAL_MS = 15 * 60_000

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface Celebration {
  id: string
  points: number
  /** Screen coordinates the "+5" flies up from. */
  x: number
  y: number
  color: string
  big: boolean
}

export interface ToastMessage {
  id: string
  text: string
  actionLabel?: string
  onAction?: () => void
}

interface AppContextValue {
  state: FullState
  /** Today in the household timezone — recomputed as midnight passes. */
  today: string
  status: SyncStatus
  errorMessage: string | null
  loaded: boolean
  pendingCount: number

  dispatch: (ops: Op | Op[]) => void
  refreshNow: () => Promise<void>
  restore: (state: FullState) => Promise<void>

  calendar: CalendarResponse | null
  calendarError: string | null
  weather: WeatherResponse | null
  reloadCalendar: (force?: boolean) => Promise<void>
  reloadWeather: (force?: boolean) => Promise<void>

  /** Device-local, not synced: who is "using" the display right now. */
  activePersonId: ID | null
  setActivePersonId: (id: ID | null) => void

  celebrations: Celebration[]
  celebrate: (celebration: Omit<Celebration, 'id'>) => void
  toasts: ToastMessage[]
  toast: (text: string, action?: { label: string; onAction: () => void }) => void
  dismissToast: (id: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const ACTIVE_PERSON_KEY = 'family.activePerson'

let counter = 0
function localId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FullState>(() => {
    const cached = api.readCachedState()
    return cached ? migrate(cached) : initialState()
  })
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [queue, setQueue] = useState<Op[]>(() => api.readQueue())

  const [calendar, setCalendar] = useState<CalendarResponse | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)

  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [activePersonId, setActivePersonIdRaw] = useState<ID | null>(
    () => localStorage.getItem(ACTIVE_PERSON_KEY) || null,
  )

  const timezone = state.core.settings.timezone
  const [today, setToday] = useState(() => todayISO(timezone))

  // Guards a poll from overwriting state while a push is still in flight.
  const inflight = useRef(0)
  const revRef = useRef<number>(state.meta.rev)
  const queueRef = useRef<Op[]>(queue)
  queueRef.current = queue

  /* ---------------------------------------------------------------- */
  /* Sync                                                             */
  /* ---------------------------------------------------------------- */

  const commitState = useCallback((next: FullState) => {
    revRef.current = next.meta.rev
    setState(next)
    api.writeCachedState(next)
  }, [])

  const flush = useCallback(
    async (ops: Op[]) => {
      if (ops.length === 0) return
      inflight.current += 1
      setStatus('syncing')

      try {
        const result = await api.pushOps(ops)
        commitState(migrate(result.state))
        setQueue((current) => {
          const remaining = current.slice(ops.length)
          api.writeQueue(remaining)
          return remaining
        })
        setStatus('idle')
        setErrorMessage(null)
      } catch (error) {
        // Ops stay queued; the reconnect handler will retry them in order.
        setStatus(navigator.onLine ? 'error' : 'offline')
        setErrorMessage(error instanceof Error ? error.message : String(error))
      } finally {
        inflight.current -= 1
      }
    },
    [commitState],
  )

  const dispatch = useCallback(
    (input: Op | Op[]) => {
      const ops = Array.isArray(input) ? input : [input]
      if (ops.length === 0) return

      // Optimistic: the tap lands instantly, the network catches up after.
      setState((current) => {
        const next = applyOps(current, ops)
        api.writeCachedState(next)
        return next
      })

      setQueue((current) => {
        const next = [...current, ...ops]
        api.writeQueue(next)
        void flush(next)
        return next
      })
    },
    [flush],
  )

  const poll = useCallback(async () => {
    if (inflight.current > 0) return
    if (queueRef.current.length > 0) {
      void flush(queueRef.current)
      return
    }

    try {
      const result = await api.loadState(revRef.current)
      if (!result.unchanged && result.state) commitState(migrate(result.state))
      else revRef.current = result.rev
      setStatus('idle')
      setErrorMessage(null)
      setLoaded(true)
    } catch (error) {
      setStatus(navigator.onLine ? 'error' : 'offline')
      setErrorMessage(error instanceof Error ? error.message : String(error))
      // A cached state means we can still show a useful screen.
      setLoaded(true)
    }
  }, [commitState, flush])

  // Initial load: always ask for the full document, not a diff.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await api.loadState()
        if (!cancelled && result.state) commitState(migrate(result.state))
      } catch (error) {
        if (!cancelled) {
          setStatus(navigator.onLine ? 'error' : 'offline')
          setErrorMessage(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [commitState])

  useEffect(() => {
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [poll])

  // Coming back to the app should feel instant, not "wait for the next tick".
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    const onOnline = () => {
      setStatus('idle')
      void poll()
    }
    const onOffline = () => setStatus('offline')

    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [poll])

  const refreshNow = useCallback(async () => {
    await poll()
  }, [poll])

  const restore = useCallback(
    async (incoming: FullState) => {
      const result = await api.replaceState(incoming)
      commitState(migrate(result.state))
    },
    [commitState],
  )

  /* ---------------------------------------------------------------- */
  /* Calendar + weather                                               */
  /* ---------------------------------------------------------------- */

  const reloadCalendar = useCallback(async (force = false) => {
    try {
      const data = await api.loadCalendar({ refresh: force })
      setCalendar(data)
      setCalendarError(null)
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const reloadWeather = useCallback(async (force = false) => {
    try {
      setWeather(await api.loadWeather({ refresh: force }))
    } catch {
      // Weather is decoration; a failure shouldn't surface as an app error.
    }
  }, [])

  const feedSignature = state.core.settings.calendars
    .filter((feed) => feed.enabled)
    .map((feed) => feed.id)
    .join(',')

  useEffect(() => {
    if (!loaded) return
    void reloadCalendar()
    const timer = window.setInterval(() => void reloadCalendar(), CALENDAR_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [loaded, feedSignature, reloadCalendar])

  const weatherSignature = `${state.core.settings.weather.latitude},${state.core.settings.weather.longitude},${state.core.settings.weather.units}`

  useEffect(() => {
    if (!loaded) return
    void reloadWeather()
    const timer = window.setInterval(() => void reloadWeather(), WEATHER_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [loaded, weatherSignature, reloadWeather])

  /* ---------------------------------------------------------------- */
  /* Clock rollover                                                   */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const tick = () => {
      const current = todayISO(timezone)
      setToday((previous) => (previous === current ? previous : current))
    }
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
  }, [timezone])

  /* ---------------------------------------------------------------- */
  /* Celebrations + toasts                                            */
  /* ---------------------------------------------------------------- */

  const celebrate = useCallback((celebration: Omit<Celebration, 'id'>) => {
    const entry = { ...celebration, id: localId() }
    setCelebrations((current) => [...current, entry])
    window.setTimeout(() => {
      setCelebrations((current) => current.filter((item) => item.id !== entry.id))
    }, 2200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (text: string, action?: { label: string; onAction: () => void }) => {
      const entry: ToastMessage = {
        id: localId(),
        text,
        ...(action ? { actionLabel: action.label, onAction: action.onAction } : {}),
      }
      setToasts((current) => [...current.slice(-2), entry])
      window.setTimeout(() => dismissToast(entry.id), 5200)
    },
    [dismissToast],
  )

  const setActivePersonId = useCallback((id: ID | null) => {
    setActivePersonIdRaw(id)
    if (id) localStorage.setItem(ACTIVE_PERSON_KEY, id)
    else localStorage.removeItem(ACTIVE_PERSON_KEY)
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      today,
      status,
      errorMessage,
      loaded,
      pendingCount: queue.length,
      dispatch,
      refreshNow,
      restore,
      calendar,
      calendarError,
      weather,
      reloadCalendar,
      reloadWeather,
      activePersonId,
      setActivePersonId,
      celebrations,
      celebrate,
      toasts,
      toast,
      dismissToast,
    }),
    [
      state, today, status, errorMessage, loaded, queue.length, dispatch, refreshNow, restore,
      calendar, calendarError, weather, reloadCalendar, reloadWeather, activePersonId,
      setActivePersonId, celebrations, celebrate, toasts, toast, dismissToast,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside <AppProvider>')
  return context
}

/** Convenience: the person object for the currently selected profile. */
export function useActivePerson() {
  const { state, activePersonId } = useApp()
  return state.core.people.find((person) => person.id === activePersonId) ?? null
}
