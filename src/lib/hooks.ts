import { useEffect, useMemo, useRef, useState } from 'react'

/** A clock that re-renders on the minute boundary rather than drifting. */
export function useNow(granularity: 'second' | 'minute' = 'minute'): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: number

    const schedule = () => {
      const current = new Date()
      setNow(current)
      const period = granularity === 'second' ? 1000 : 60_000
      // Land just after the boundary so the displayed value is never stale.
      const delay = period - (current.getTime() % period) + 30
      timer = window.setTimeout(schedule, delay)
    }

    schedule()
    return () => window.clearTimeout(timer)
  }, [granularity])

  return now
}

/** Fires `onIdle` after `minutes` without interaction; resets on any input. */
export function useIdle(minutes: number, enabled: boolean): boolean {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || minutes <= 0) {
      setIdle(false)
      return
    }

    const reset = () => {
      setIdle(false)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setIdle(true), minutes * 60_000)
    }

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const event of events) window.addEventListener(event, reset, { passive: true })
    reset()

    return () => {
      for (const event of events) window.removeEventListener(event, reset)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [minutes, enabled])

  return idle
}

/** Hash-based routing — no dependency, and deep links still work on phones. */
export function useHashRoute(fallback: string): [string, (next: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '') || fallback
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback])

  const navigate = (next: string) => {
    if (next === route) return
    window.location.hash = `/${next}`
    setRoute(next)
  }

  return [route, navigate]
}

/**
 * Keeps the iPad's screen awake while the app is in the foreground. Safari
 * grants this only after a user gesture and drops it when the tab is hidden,
 * so we re-acquire on visibility change.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    if (!nav.wakeLock) return

    let sentinel: { release: () => Promise<void> } | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        sentinel = await nav.wakeLock!.request('screen')
      } catch {
        // Denied (no gesture yet, or low battery) — harmless, we retry later.
      }
    }

    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('pointerdown', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('pointerdown', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [enabled])
}

/** Debounces a value — used by the location search box. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/** Resolves 'auto' into a concrete theme using the household's clock. */
export function useResolvedTheme(preference: 'light' | 'dark' | 'auto', hour: number): 'light' | 'dark' {
  return useMemo(() => {
    if (preference !== 'auto') return preference
    // Night mode from 8pm to 6am so the kitchen isn't lit up at bedtime.
    return hour >= 20 || hour < 6 ? 'dark' : 'light'
  }, [preference, hour])
}
