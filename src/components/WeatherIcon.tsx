/** Animated weather glyphs driven by WMO codes, with matching labels. */

import { motion } from 'framer-motion'

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear'
  if (code === 1 || code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'thunder'
  return 'cloudy'
}

export function weatherLabel(code: number): string {
  const labels: Record<number, string> = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Snow showers',
    95: 'Thunderstorm', 96: 'Storm with hail', 99: 'Storm with hail',
  }
  return labels[code] ?? 'Unsettled'
}

/** A one-line hint kids can act on without reading a forecast. */
export function dressHint(code: number, high: number, units: 'F' | 'C'): string {
  const kind = weatherKind(code)
  const cold = units === 'F' ? high < 50 : high < 10
  const chilly = units === 'F' ? high < 65 : high < 18
  const hot = units === 'F' ? high > 85 : high > 29

  if (kind === 'snow') return 'Snow boots, hat and gloves ❄️'
  if (kind === 'thunder') return 'Storms today — stay inside ⛈️'
  if (kind === 'rain' || kind === 'drizzle') return 'Take a raincoat ☔️'
  if (cold) return 'Bundle up, it is cold 🧣'
  if (chilly) return 'Grab a jacket 🧥'
  if (hot) return 'Hot one — water bottle 💦'
  if (kind === 'clear') return 'Sunny — sunglasses 😎'
  return 'Comfortable out there 👕'
}

const SUN = 'var(--amber)'
const CLOUD = 'var(--ink-4)'
const DROP = 'var(--cobalt)'

export function WeatherIcon({
  code,
  size = 40,
  isDay = true,
  animate = true,
}: {
  code: number
  size?: number
  isDay?: boolean
  animate?: boolean
}) {
  const kind = weatherKind(code)
  const spin = animate ? { rotate: 360 } : {}
  const spinTransition = { duration: 40, repeat: Infinity, ease: 'linear' as const }
  const drift = animate ? { x: [0, 2.5, 0, -2.5, 0] } : {}
  const driftTransition = { duration: 9, repeat: Infinity, ease: 'easeInOut' as const }

  const sunCore = (cx: number, cy: number, r: number) =>
    isDay ? (
      <motion.g animate={spin} transition={spinTransition} style={{ originX: `${cx}px`, originY: `${cy}px` }}>
        <circle cx={cx} cy={cy} r={r} fill={SUN} />
        {Array.from({ length: 8 }, (_, index) => {
          const angle = (index * Math.PI) / 4
          const inner = r + 2.6
          const outer = r + 6
          return (
            <line
              key={index}
              x1={cx + Math.cos(angle) * inner}
              y1={cy + Math.sin(angle) * inner}
              x2={cx + Math.cos(angle) * outer}
              y2={cy + Math.sin(angle) * outer}
              stroke={SUN}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          )
        })}
      </motion.g>
    ) : (
      <path
        d={`M ${cx + r} ${cy - r * 0.2} a ${r} ${r} 0 1 1 -${r * 1.1} -${r * 0.95} ${r * 0.78} ${r * 0.78} 0 0 0 ${r * 1.1} ${r * 0.95} Z`}
        fill={SUN}
      />
    )

  const cloud = (dx: number, dy: number, scale: number, fill: string) => (
    <motion.path
      animate={drift}
      transition={driftTransition}
      transform={`translate(${dx} ${dy}) scale(${scale})`}
      d="M8 20a6 6 0 0 1 .6-11.9 8.5 8.5 0 0 1 16.1 2.2A5.4 5.4 0 0 1 24 20Z"
      fill={fill}
    />
  )

  const drops = (color: string, count = 3, freeze = false) =>
    Array.from({ length: count }, (_, index) => (
      <motion.line
        key={index}
        x1={13 + index * 6}
        y1={30}
        x2={11.5 + index * 6}
        y2={35}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        animate={animate && !freeze ? { y: [0, 7], opacity: [0, 1, 0] } : {}}
        transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.22, ease: 'easeIn' }}
      />
    ))

  const flakes = Array.from({ length: 3 }, (_, index) => (
    <motion.circle
      key={index}
      cx={14 + index * 6}
      cy={31}
      r={2}
      fill="var(--teal)"
      animate={animate ? { y: [0, 8], opacity: [0, 1, 0] } : {}}
      transition={{ duration: 1.7, repeat: Infinity, delay: index * 0.36, ease: 'easeIn' }}
    />
  ))

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" role="img" aria-label={weatherLabel(code)}>
      {kind === 'clear' ? sunCore(20, 20, 8.5) : null}

      {kind === 'partly' ? (
        <>
          {sunCore(14.5, 14.5, 6.5)}
          {cloud(6, 12, 0.95, CLOUD)}
        </>
      ) : null}

      {kind === 'cloudy' ? (
        <>
          {cloud(3, 6, 0.8, 'var(--ink-3)')}
          {cloud(7, 12, 1, CLOUD)}
        </>
      ) : null}

      {kind === 'fog' ? (
        <>
          {cloud(7, 7, 1, CLOUD)}
          {[0, 1, 2].map((index) => (
            <motion.line
              key={index}
              x1={9}
              y1={29 + index * 4}
              x2={31}
              y2={29 + index * 4}
              stroke="var(--ink-4)"
              strokeWidth={2.4}
              strokeLinecap="round"
              animate={animate ? { x: [0, 3, 0, -3, 0], opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 4.5, repeat: Infinity, delay: index * 0.4, ease: 'easeInOut' }}
            />
          ))}
        </>
      ) : null}

      {kind === 'drizzle' || kind === 'rain' ? (
        <>
          {cloud(7, 5, 1, CLOUD)}
          {drops(DROP, kind === 'rain' ? 4 : 3)}
        </>
      ) : null}

      {kind === 'snow' ? (
        <>
          {cloud(7, 5, 1, CLOUD)}
          {flakes}
        </>
      ) : null}

      {kind === 'thunder' ? (
        <>
          {cloud(7, 5, 1, 'var(--ink-3)')}
          <motion.path
            d="M21 27l-5 7h4l-2.5 6 8-8h-4.2l3-5z"
            fill={SUN}
            animate={animate ? { opacity: [1, 0.25, 1, 0.6, 1] } : {}}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      ) : null}
    </svg>
  )
}
