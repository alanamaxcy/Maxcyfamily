import type { Config, Context } from '@netlify/functions'
import type { WeatherResponse } from '../../shared/types.ts'
import { cached, errorResponse, json, readState } from '../lib/store.mts'

/**
 * Open-Meteo needs no API key and no attribution header, which makes it the
 * right fit for a device that should just work for years without anyone
 * rotating a credential.
 *
 * GET /api/weather          → current + hourly + 7 day forecast for the household
 * GET /api/geocode?q=Austin → place search for the settings screen
 */

const WEATHER_TTL_SECONDS = 900

interface OpenMeteoResponse {
  current?: Record<string, number>
  hourly?: Record<string, unknown[]>
  daily?: Record<string, unknown[]>
}

export default async (request: Request, _context: Context): Promise<Response> => {
  const url = new URL(request.url)

  try {
    if (url.pathname.endsWith('/geocode')) {
      const query = (url.searchParams.get('q') ?? '').trim()
      if (query.length < 2) return json({ results: [] })

      const endpoint = new URL('https://geocoding-api.open-meteo.com/v1/search')
      endpoint.searchParams.set('name', query)
      endpoint.searchParams.set('count', '6')
      endpoint.searchParams.set('language', 'en')
      endpoint.searchParams.set('format', 'json')

      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`Geocoder returned ${response.status}`)
      const data = (await response.json()) as {
        results?: { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }[]
      }

      return json({
        results: (data.results ?? []).map((place) => ({
          label: [place.name, place.admin1, place.country_code].filter(Boolean).join(', '),
          latitude: place.latitude,
          longitude: place.longitude,
        })),
      })
    }

    const { state } = await readState()
    const settings = state.core.settings.weather
    const latitude = Number(url.searchParams.get('lat') ?? settings.latitude)
    const longitude = Number(url.searchParams.get('lon') ?? settings.longitude)
    const units = (url.searchParams.get('units') ?? settings.units) === 'C' ? 'C' : 'F'
    const force = url.searchParams.get('refresh') === '1'

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return errorResponse('No location set for weather')
    }

    const key = `weather/${latitude.toFixed(3)},${longitude.toFixed(3)},${units}`

    const result = await cached<WeatherResponse>(
      key,
      WEATHER_TTL_SECONDS,
      async () => {
        const endpoint = new URL('https://api.open-meteo.com/v1/forecast')
        endpoint.searchParams.set('latitude', String(latitude))
        endpoint.searchParams.set('longitude', String(longitude))
        endpoint.searchParams.set(
          'current',
          'temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,relative_humidity_2m',
        )
        endpoint.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability')
        endpoint.searchParams.set(
          'daily',
          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        )
        endpoint.searchParams.set('temperature_unit', units === 'C' ? 'celsius' : 'fahrenheit')
        endpoint.searchParams.set('wind_speed_unit', units === 'C' ? 'kmh' : 'mph')
        endpoint.searchParams.set('timezone', 'auto')
        endpoint.searchParams.set('forecast_days', '7')

        const response = await fetch(endpoint)
        if (!response.ok) throw new Error(`Weather service returned ${response.status}`)
        const data = (await response.json()) as OpenMeteoResponse

        const current = data.current ?? {}
        const hourlyTimes = (data.hourly?.['time'] ?? []) as string[]
        const dailyDates = (data.daily?.['time'] ?? []) as string[]

        const num = (list: unknown[] | undefined, index: number): number => Number(list?.[index] ?? 0)

        return {
          now: {
            temp: Math.round(Number(current['temperature_2m'] ?? 0)),
            feelsLike: Math.round(Number(current['apparent_temperature'] ?? 0)),
            code: Number(current['weather_code'] ?? 0),
            isDay: Number(current['is_day'] ?? 1) === 1,
            windSpeed: Math.round(Number(current['wind_speed_10m'] ?? 0)),
            humidity: Math.round(Number(current['relative_humidity_2m'] ?? 0)),
          },
          hourly: hourlyTimes.map((time, index) => ({
            time,
            temp: Math.round(num(data.hourly?.['temperature_2m'], index)),
            code: num(data.hourly?.['weather_code'], index),
            precipProbability: num(data.hourly?.['precipitation_probability'], index),
          })),
          daily: dailyDates.map((date, index) => ({
            date,
            high: Math.round(num(data.daily?.['temperature_2m_max'], index)),
            low: Math.round(num(data.daily?.['temperature_2m_min'], index)),
            code: num(data.daily?.['weather_code'], index),
            precipProbability: num(data.daily?.['precipitation_probability_max'], index),
            sunrise: String(data.daily?.['sunrise']?.[index] ?? ''),
            sunset: String(data.daily?.['sunset']?.[index] ?? ''),
          })),
          units,
          label: state.core.settings.weather.label,
          fetchedAt: new Date().toISOString(),
        } satisfies WeatherResponse
      },
      force,
    )

    return json({ ...result.value, fetchedAt: result.fetchedAt })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return errorResponse(`Weather error: ${message}`, 500)
  }
}

export const config: Config = { path: ['/api/weather', '/api/geocode'] }
