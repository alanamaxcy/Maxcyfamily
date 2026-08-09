import type { Config, Context } from '@netlify/functions'
import { parseRecipeHtml } from '../../shared/recipes.ts'
import { errorResponse, json } from '../lib/store.mts'

/**
 * Pulls a recipe page and extracts its schema.org JSON-LD.
 *
 * The original app routed this through the public allorigins.win proxy. Doing
 * the fetch here instead removes a third-party dependency from the critical
 * path, avoids handing someone else our browsing, and lets us set a timeout.
 */

const FETCH_TIMEOUT_MS = 12_000
const MAX_HTML_BYTES = 3 * 1024 * 1024

function isPubliclyRoutable(target: URL): boolean {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false

  // Block the obvious SSRF shapes — this endpoint fetches an arbitrary URL, so
  // it must not become a window onto localhost or cloud metadata services.
  const host = target.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false
  if (host === '169.254.169.254' || host === 'metadata.google.internal') return false
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0) return false
    if (a === 172 && (b ?? 0) >= 16 && (b ?? 0) <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 169 && b === 254) return false
  }
  if (host === '::1' || host.startsWith('fd') || host.startsWith('fe80')) return false

  return true
}

export default async (request: Request, _context: Context): Promise<Response> => {
  const url = new URL(request.url)
  const target = url.searchParams.get('url')?.trim()
  if (!target) return errorResponse('Missing ?url=')

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return errorResponse('That does not look like a URL')
  }
  if (!isPubliclyRoutable(parsed)) return errorResponse('That URL is not allowed')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(parsed, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some recipe sites serve a stub to unknown agents.
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) return errorResponse(`That page returned ${response.status}`, 502)

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('html')) return errorResponse('That link is not a web page', 415)

    const html = (await response.text()).slice(0, MAX_HTML_BYTES)
    const { recipe, foundRecipe } = parseRecipeHtml(html, parsed.toString())

    return json({ recipe, foundRecipe })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'That site took too long to respond'
        : error instanceof Error
          ? error.message
          : String(error)
    return errorResponse(`Could not import: ${message}`, 502)
  } finally {
    clearTimeout(timer)
  }
}

export const config: Config = { path: '/api/recipe-import' }
