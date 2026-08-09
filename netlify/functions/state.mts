import type { Config, Context } from '@netlify/functions'
import type { Op } from '../../shared/ops.ts'
import type { FullState } from '../../shared/types.ts'
import { commit, errorResponse, json, readRev, readState, replaceState } from '../lib/store.mts'

/**
 * GET  /api/state?rev=N   → { unchanged: true } when nothing moved, else the full state
 * POST /api/state         → { ops: Op[] } applied atomically; returns the new state
 * PUT  /api/state         → replace everything (restore from a backup file)
 */
export default async (request: Request, _context: Context): Promise<Response> => {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const since = url.searchParams.get('rev')

      if (since !== null) {
        const rev = await readRev()
        // A null rev means nothing has ever been written; fall through and seed.
        if (rev !== null && String(rev) === since) {
          return json({ unchanged: true, rev })
        }
      }

      const { state, rev } = await readState()
      return json({ state, rev })
    }

    if (request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as { ops?: Op[] } | null
      if (!body || !Array.isArray(body.ops)) {
        return errorResponse('Expected a JSON body of the form { ops: [...] }')
      }
      if (body.ops.length > 500) {
        return errorResponse('Too many ops in one request (max 500)', 413)
      }

      const { state, rev } = await commit(body.ops)
      return json({ state, rev })
    }

    if (request.method === 'PUT') {
      const body = (await request.json().catch(() => null)) as { state?: FullState } | null
      if (!body?.state?.core) return errorResponse('Expected { state: { core, activity, meta } }')

      const { state, rev } = await replaceState(body.state)
      return json({ state, rev })
    }

    return errorResponse('Method not allowed', 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return errorResponse(`State error: ${message}`, 500)
  }
}

export const config: Config = { path: '/api/state' }
