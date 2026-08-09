/** Current conditions, the next 24 hours, and the week. */

import { motion } from 'framer-motion'
import { DAY_SHORT, formatTime, parseISODate } from '@shared/date.ts'
import { useApp } from '../lib/store.tsx'
import { WeatherIcon, dressHint, weatherLabel } from '../components/WeatherIcon.tsx'
import { Icon } from '../components/Icon.tsx'
import { Empty } from '../components/ui.tsx'

export function WeatherView() {
  const { weather, reloadWeather, state } = useApp()
  const { timezone } = state.core.settings

  if (!weather) {
    return (
      <Empty
        emoji="🌤️"
        title="Weather is loading"
        hint="If this sticks around, check the location in Settings."
        action={
          <button className="btn btn-soft" onClick={() => void reloadWeather(true)}>
            <Icon name="refresh" size={17} /> Try again
          </button>
        }
      />
    )
  }

  const nowIndex = weather.hourly.findIndex((hour) => new Date(hour.time).getTime() >= Date.now() - 3_600_000)
  const next24 = weather.hourly.slice(Math.max(0, nowIndex), Math.max(0, nowIndex) + 24)
  const todayForecast = weather.daily[0]

  const maxTemp = Math.max(...next24.map((hour) => hour.temp), 1)
  const minTemp = Math.min(...next24.map((hour) => hour.temp), 0)
  const span = Math.max(1, maxTemp - minTemp)

  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">Weather</span>
          <h1 className="h1">{weather.label}</h1>
        </div>
        <button className="icon-btn icon-btn-filled" onClick={() => void reloadWeather(true)} aria-label="Refresh">
          <Icon name="refresh" size={19} />
        </button>
      </div>

      <motion.div
        className="card weather-hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="row" style={{ gap: 20 }}>
          <WeatherIcon code={weather.now.code} isDay={weather.now.isDay} size={92} />
          <div>
            <div className="weather-temp numeral">{weather.now.temp}°</div>
            <div className="h3">{weatherLabel(weather.now.code)}</div>
            <div className="small numeral">Feels like {weather.now.feelsLike}°</div>
          </div>
        </div>

        {todayForecast ? (
          <div className="weather-hint">{dressHint(todayForecast.code, todayForecast.high, weather.units)}</div>
        ) : null}

        <div className="weather-facts">
          {todayForecast ? (
            <>
              <Fact label="High" value={`${todayForecast.high}°`} />
              <Fact label="Low" value={`${todayForecast.low}°`} />
              <Fact label="Rain" value={`${todayForecast.precipProbability}%`} />
            </>
          ) : null}
          <Fact label="Wind" value={`${weather.now.windSpeed}`} />
          <Fact label="Humidity" value={`${weather.now.humidity}%`} />
        </div>
      </motion.div>

      <div className="section-head" style={{ marginTop: 26 }}>
        <h2 className="h2">Next 24 hours</h2>
      </div>

      <div className="hour-rail">
        {next24.map((hour, index) => {
          const height = 12 + ((hour.temp - minTemp) / span) * 42
          return (
            <motion.div
              key={hour.time}
              className="hour-cell"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="tiny">{index === 0 ? 'Now' : formatTime(hour.time, timezone).replace(':00', '')}</span>
              <WeatherIcon code={hour.code} size={26} isDay animate={false} />
              <span className="hour-temp numeral">{hour.temp}°</span>
              <span className="hour-bar" style={{ height }} />
              {hour.precipProbability >= 25 ? (
                <span className="hour-rain numeral">{hour.precipProbability}%</span>
              ) : (
                <span className="hour-rain" />
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="section-head" style={{ marginTop: 26 }}>
        <h2 className="h2">This week</h2>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {weather.daily.map((day, index) => {
          const weekMin = Math.min(...weather.daily.map((entry) => entry.low))
          const weekMax = Math.max(...weather.daily.map((entry) => entry.high))
          const range = Math.max(1, weekMax - weekMin)
          const left = ((day.low - weekMin) / range) * 100
          const width = ((day.high - day.low) / range) * 100

          return (
            <motion.div
              key={day.date}
              className="day-row"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="day-name">{index === 0 ? 'Today' : DAY_SHORT[parseISODate(day.date).getDay()]}</span>
              <WeatherIcon code={day.code} size={30} isDay animate={false} />
              <span className="day-low numeral">{day.low}°</span>
              <span className="day-track">
                <motion.span
                  className="day-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(6, width)}%`, left: `${left}%` }}
                  transition={{ delay: 0.15 + index * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
              <span className="day-high numeral">{day.high}°</span>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="weather-fact">
      <span className="tiny">{label}</span>
      <span className="h3 numeral">{value}</span>
    </div>
  )
}
