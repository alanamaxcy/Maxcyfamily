/** Time, date, weather and sync state — the always-visible header. */

import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../lib/store.tsx'
import { useNow } from '../lib/hooks.ts'
import { formatLongDate } from '@shared/date.ts'
import { WeatherIcon } from './WeatherIcon.tsx'
import { IconButton } from './ui.tsx'

/** Each character animates independently, so only the digits that change move. */
function RollingText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex' }}>
      {text.split('').map((character, index) => (
        <span
          key={index}
          style={{
            display: 'inline-block',
            position: 'relative',
            width: character === ':' ? '0.32em' : character === '1' ? '0.54em' : '0.62em',
            textAlign: 'center',
            overflow: 'hidden',
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={character}
              style={{ display: 'inline-block' }}
              initial={{ y: '-72%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '72%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              {character}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

export function TopBar({
  onOpenSettings,
  onOpenWeather,
  onSleepNow,
}: {
  onOpenSettings: () => void
  onOpenWeather: () => void
  onSleepNow: () => void
}) {
  const { state, today, weather, status, pendingCount } = useApp()
  const now = useNow('minute')
  const { timezone } = state.core.settings

  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone || undefined,
  }).formatToParts(now)

  const hour = parts.find((part) => part.type === 'hour')?.value ?? ''
  const minute = parts.find((part) => part.type === 'minute')?.value ?? ''
  const period = parts.find((part) => part.type === 'dayPeriod')?.value ?? ''

  const statusLabel =
    status === 'offline'
      ? `Offline${pendingCount ? ` · ${pendingCount} waiting` : ''}`
      : status === 'error'
        ? 'Sync problem'
        : status === 'syncing'
          ? 'Syncing'
          : 'Synced'

  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <div className="topbar-clock">
          <RollingText text={`${hour}:${minute}`} className="topbar-time numeral" />
          <span className="topbar-ampm">{period}</span>
          <span
            className={`sync-dot ${status}`}
            title={statusLabel}
            aria-label={statusLabel}
            role="status"
            style={{ alignSelf: 'center', marginLeft: 4 }}
          />
        </div>
        <div className="topbar-date truncate">
          {formatLongDate(today)}
          {state.core.settings.householdName ? ` · ${state.core.settings.householdName}` : ''}
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        {weather ? (
          <motion.button
            className="weather-chip"
            onClick={onOpenWeather}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Open weather"
          >
            <WeatherIcon code={weather.now.code} isDay={weather.now.isDay} size={36} />
            <div className="col" style={{ alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span className="weather-chip-temp numeral">{weather.now.temp}°</span>
              {weather.daily[0] ? (
                <span className="tiny numeral">
                  {weather.daily[0].high}° / {weather.daily[0].low}°
                </span>
              ) : null}
            </div>
          </motion.button>
        ) : (
          <div className="skeleton" style={{ width: 128, height: 56, borderRadius: 999 }} />
        )}

        <IconButton icon="moon" label="Start the sleep screen" onClick={onSleepNow} />
        <IconButton icon="settings" label="Settings" onClick={onOpenSettings} />
      </div>
    </header>
  )
}
