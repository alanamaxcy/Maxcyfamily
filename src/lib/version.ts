/**
 * Knowing whether a newer deploy exists.
 *
 * The iPad runs as a home-screen app and is never manually refreshed, so
 * without this it can sit on an old build indefinitely — which looks exactly
 * like "the change didn't ship".
 */

declare const __BUILD_ID__: string

/** Stamped in at build time by the emit-version plugin in vite.config.ts. */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

/**
 * Reads the deployed build id. Returns null on any failure — offline, a
 * half-finished deploy, an HTML error page — so a hiccup never shows a
 * spurious update prompt.
 */
export async function fetchDeployedBuild(): Promise<string | null> {
  try {
    // Cache-busted twice over: the query string defeats any intermediate that
    // ignores the header, and no-store defeats the browser's own cache.
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null

    const data = (await response.json()) as { build?: unknown }
    return typeof data.build === 'string' ? data.build : null
  } catch {
    return null
  }
}
