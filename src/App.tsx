import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { hourInTimezone } from '@shared/date.ts'
import { AppProvider, useApp } from './lib/store.tsx'
import { useHashRoute, useIdle, useNow, useResolvedTheme, useWakeLock } from './lib/hooks.ts'
import { TopBar } from './components/TopBar.tsx'
import { Nav } from './components/Nav.tsx'
import { Screensaver } from './components/Screensaver.tsx'
import { Celebrations, Toasts } from './components/Celebrations.tsx'
import { TodayView } from './views/TodayView.tsx'
import { PersonView } from './views/PersonView.tsx'
import { CalendarView } from './views/CalendarView.tsx'
import { RoutinesView } from './views/RoutinesView.tsx'
import { RewardsView } from './views/RewardsView.tsx'
import { MealsView } from './views/MealsView.tsx'
import { RecipesView } from './views/RecipesView.tsx'
import { TodosView } from './views/TodosView.tsx'
import { ProfilesView } from './views/ProfilesView.tsx'
import { WeatherView } from './views/WeatherView.tsx'
import { SettingsView } from './views/SettingsView.tsx'

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/views.css'

function Shell() {
  const { state, loaded, status, errorMessage } = useApp()
  const [route, navigate] = useHashRoute('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const now = useNow('minute')

  const { theme, timezone, sleep } = state.core.settings
  const hour = hourInTimezone(now, timezone)
  const resolved = useResolvedTheme(theme, hour)

  useEffect(() => {
    document.documentElement.dataset['theme'] = resolved
  }, [resolved])

  useWakeLock(true)

  // Suppressed while settings are open, so a long edit session doesn't get
  // covered by the photo screen. Any tap resets it, which is what wakes it.
  const asleep = useIdle(sleep.idleMinutes, sleep.enabled && !settingsOpen)

  const activeTab = route.startsWith('person/') ? 'profiles' : route
  const personId = route.startsWith('person/') ? route.slice('person/'.length) : null

  const body = useMemo(() => {
    if (personId) return <PersonView personId={personId} onBack={() => navigate('today')} />

    switch (route) {
      case 'calendar':
        return <CalendarView />
      case 'routines':
        return <RoutinesView />
      case 'rewards':
        return <RewardsView />
      case 'meals':
        return <MealsView />
      case 'recipes':
        return <RecipesView />
      case 'todos':
        return <TodosView />
      case 'profiles':
        return <ProfilesView onOpenPerson={(id) => navigate(`person/${id}`)} />
      case 'weather':
        return <WeatherView />
      default:
        return <TodayView onOpenPerson={(id) => navigate(`person/${id}`)} />
    }
  }, [route, personId, navigate])

  if (!loaded) {
    return (
      <div className="boot">
        <motion.div
          className="boot-mark"
          animate={{ scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          🏡
        </motion.div>
        <p className="small" style={{ marginTop: 18 }}>Getting the day ready…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} onOpenWeather={() => navigate('weather')} />

      <main className="page" key={route}>
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {status === 'error' || status === 'offline' ? (
              // Plain language on the wall; the raw error is for the tooltip.
              <div className="banner" title={errorMessage ?? undefined}>
                <span className="truncate">
                  {status === 'offline'
                    ? 'Offline — everything still works and will sync when the wifi is back.'
                    : "Can't reach the server right now. Taps are saved and will sync automatically."}
                </span>
              </div>
            ) : null}
            {body}
          </motion.div>
        </AnimatePresence>
      </main>

      <Nav active={activeTab} onChange={navigate} />

      <SettingsView open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AnimatePresence>
        {asleep ? <Screensaver onWake={() => undefined} /> : null}
      </AnimatePresence>

      <Celebrations />
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
