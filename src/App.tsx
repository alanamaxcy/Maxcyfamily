import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { hourInTimezone } from '@shared/date.ts'
import { AppProvider, useApp } from './lib/store.tsx'
import { useAppUpdate, useHashRoute, useIdle, useNow, useResolvedTheme, useWakeLock } from './lib/hooks.ts'
import { TopBar } from './components/TopBar.tsx'
import { Nav } from './components/Nav.tsx'
import { MORE_ITEMS, MoreMenu } from './components/MoreMenu.tsx'
import { Icon } from './components/Icon.tsx'
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
  const [moreOpen, setMoreOpen] = useState(false)
  // Set by the top-bar moon; independent of the idle timer so it works even
  // when the automatic sleep screen is switched off.
  const [forceSleep, setForceSleep] = useState(false)
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
  const idle = useIdle(sleep.idleMinutes, sleep.enabled && !settingsOpen && !moreOpen && !forceSleep)
  const asleep = forceSleep || idle

  const updateReady = useAppUpdate()

  /*
   * Nobody refreshes a picture frame. When a newer build exists and the sleep
   * screen has been up for a couple of minutes, reload — the screen is showing
   * a photo, so the reload is invisible and the display comes back current.
   * While someone is using it, they get a banner and choose for themselves.
   */
  useEffect(() => {
    if (!updateReady || !asleep) return
    const timer = window.setTimeout(() => window.location.reload(), 120_000)
    return () => window.clearTimeout(timer)
  }, [updateReady, asleep])

  const personId = route.startsWith('person/') ? route.slice('person/'.length) : null
  // A person page belongs to Home, which is where the faces are.
  const activeTab = personId ? 'today' : route
  const moreActive = MORE_ITEMS.some((item) => item.id === activeTab)

  const body = useMemo(() => {
    if (personId) return <PersonView personId={personId} onBack={() => navigate('today')} />

    switch (route) {
      case 'schedule':
      // 'calendar' kept as an alias so an old bookmark or hash still lands.
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
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWeather={() => navigate('weather')}
        onSleepNow={() => setForceSleep(true)}
      />

      <main className="page" key={route}>
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            // Home sizes its faces to the screen, so its wrapper has to fill
            // the scroll area rather than shrink to its content.
            className={route === 'today' ? 'route-fill' : undefined}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {updateReady ? (
              <button className="banner banner-action" onClick={() => window.location.reload()}>
                <Icon name="refresh" size={16} />
                <span className="truncate">A newer version is ready</span>
                <span className="banner-cta">Reload</span>
              </button>
            ) : null}

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

      <Nav
        active={activeTab}
        onChange={navigate}
        onOpenMore={() => setMoreOpen(true)}
        moreActive={moreActive}
      />

      <MoreMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={navigate}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsView open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AnimatePresence>
        {asleep ? <Screensaver onWake={() => setForceSleep(false)} /> : null}
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
